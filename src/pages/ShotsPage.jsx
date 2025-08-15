import { useEffect, useState } from "react";
import {
  collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { ACTIVE_PROJECT_ID, projectPath } from "../lib/paths";
import { arrayUnion, arrayRemove } from "firebase/firestore";

import {
  CLIENT_ID,
  getActiveProjectId,
  shotsPath as getShotsPath,
  productsPath,
  talentPath,
  locationsPath,
} from "../lib/paths";

const coll = (...p) => collection(db, ...p);
const d = (...p) => doc(db, ...p);

async function updateReverseIndexes({ shotId, before, after }) {
  const prevP = new Set(before.productIds || []);
  const nextP = new Set(after.productIds || []);
  const prevT = new Set(before.talentIds || []);
  const nextT = new Set(after.talentIds || []);
  const prevL = before.locationId || null;
  const nextL = after.locationId || null;

  // products
  const addsP = [...nextP].filter(x => !prevP.has(x));
  const remsP = [...prevP].filter(x => !nextP.has(x));
  await Promise.all(addsP.map(pid => updateDoc(d(...productsPath, pid), { shotIds: arrayUnion(shotId) }).catch(()=>{})));
  await Promise.all(remsP.map(pid => updateDoc(d(...productsPath, pid), { shotIds: arrayRemove(shotId) }).catch(()=>{})));

  // talent
  const addsT = [...nextT].filter(x => !prevT.has(x));
  const remsT = [...prevT].filter(x => !nextT.has(x));
  await Promise.all(addsT.map(tid => updateDoc(d(...talentPath, tid), { shotIds: arrayUnion(shotId) }).catch(()=>{})));
  await Promise.all(remsT.map(tid => updateDoc(d(...talentPath, tid), { shotIds: arrayRemove(shotId) }).catch(()=>{})));

  // location
  if (prevL && prevL !== nextL) await updateDoc(d(...locationsPath, prevL), { shotIds: arrayRemove(shotId) }).catch(()=>{});
  if (nextL && prevL !== nextL) await updateDoc(d(...locationsPath, nextL), { shotIds: arrayUnion(shotId) }).catch(()=>{});
}

export default function ShotsPage() {
  const [shots, setShots] = useState([]);
  const [draft, setDraft] = useState({
    name:"", description:"", type:"", date:"", locationId:"", productIds:[], talentIds:[], laneId:null
  });
  const [products, setProducts] = useState([]);
  const [talent, setTalent] = useState([]);
  const [locations, setLocations] = useState([]);
  const projectId = getActiveProjectId();


  useEffect(() => {
    const unsubS = onSnapshot(query(coll(...getShotsPath(projectId)), orderBy("date","asc")),
      s => setShots(s.docs.map(d=>({id:d.id, ...d.data()}))));
    const unsubP = onSnapshot(query(coll(...productsPath), orderBy("name","asc")),
      s => setProducts(s.docs.map(d=>({id:d.id, ...d.data()}))));
    const unsubT = onSnapshot(query(coll(...talentPath), orderBy("name","asc")),
      s => setTalent(s.docs.map(d=>({id:d.id, ...d.data()}))));
    const unsubL = onSnapshot(query(coll(...locationsPath), orderBy("name","asc")),
      s => setLocations(s.docs.map(d=>({id:d.id, ...d.data()}))));
    return () => { unsubS(); unsubP(); unsubT(); unsubL(); };
  }, []);

  const createShot = async () => {
    if (!draft.name) return;
    const docRef = await addDoc(coll(...shotsPath), {
      ...draft,
      productIds: draft.productIds || [],
      talentIds: draft.talentIds || [],
      locationId: draft.locationId || null,
      createdAt: Date.now()
    });
    await updateReverseIndexes({
      shotId: docRef.id, before: { productIds:[], talentIds:[], locationId:null },
      after: { productIds: draft.productIds, talentIds: draft.talentIds, locationId: draft.locationId }
    });
    setDraft({ name:"", description:"", type:"", date:"", locationId:"", productIds:[], talentIds:[], laneId:null });
  };

  const updateShot = async (shot, patch) => {
    const before = { productIds: shot.productIds||[], talentIds: shot.talentIds||[], locationId: shot.locationId||null };
    const after = {
      productIds: patch.productIds ?? before.productIds,
      talentIds: patch.talentIds ?? before.talentIds,
      locationId: patch.locationId ?? before.locationId
    };
    await updateDoc(d(...shotsPath, shot.id), patch);
    if (patch.productIds !== undefined || patch.talentIds !== undefined || patch.locationId !== undefined) {
      await updateReverseIndexes({ shotId: shot.id, before, after });
    }
  };

  const removeShot = async (shot) => {
    await updateReverseIndexes({
      shotId: shot.id,
      before: { productIds: shot.productIds||[], talentIds: shot.talentIds||[], locationId: shot.locationId||null },
      after: { productIds: [], talentIds: [], locationId: null }
    });
    await deleteDoc(d(...shotsPath, shot.id));
  };

  return (
    <div style={{padding:24}}>
      <h1>Shots</h1>

      {/* Create */}
      <div style={{display:"grid",gap:8,maxWidth:720,marginBottom:24}}>
        <input placeholder="Name" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/>
        <input placeholder="Description" value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/>
        <input placeholder="Type" value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value})}/>
        <input placeholder="Date (YYYY-MM-DD)" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/>

        <label>Location</label>
        <select value={draft.locationId} onChange={e=>setDraft({...draft,locationId:e.target.value||""})}>
          <option value="">(none)</option>
          {locations.map(l=> <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        <label>Products (Cmd/Ctrl to multi-select)</label>
        <select multiple size={6} value={draft.productIds}
                onChange={(e)=> setDraft({...draft, productIds: Array.from(e.target.selectedOptions).map(o=>o.value)})}>
          {products.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label>Talent (Cmd/Ctrl to multi-select)</label>
        <select multiple size={6} value={draft.talentIds}
                onChange={(e)=> setDraft({...draft, talentIds: Array.from(e.target.selectedOptions).map(o=>o.value)})}>
          {talent.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <button onClick={createShot}>Add Shot</button>
      </div>

      {/* List */}
      <ul style={{display:"grid",gap:8}}>
        {shots.map(s => (
          <li key={s.id} style={{border:"1px solid #ddd",padding:12,borderRadius:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <strong>{s.name}</strong>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>updateShot(s, { name: prompt("New name", s.name) || s.name })}>Rename</button>
                <button onClick={()=>removeShot(s)}>Delete</button>
              </div>
            </div>
            <div style={{opacity:0.8,marginTop:4}}>{s.description}</div>
            <div style={{marginTop:6,fontSize:12,opacity:0.8}}>
              Type: {s.type || "-"} • Date: {s.date || "-"} • Lane: {s.laneId || "-"}
            </div>

            {/* Quick editors */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:8}}>
              <div>
                <div style={{fontSize:12,opacity:0.7}}>Location</div>
                <select value={s.locationId || ""} onChange={e=>updateShot(s, { locationId: e.target.value || null })}>
                  <option value="">(none)</option>
                  {locations.map(l=> <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:12,opacity:0.7}}>Products</div>
                <select multiple size={5} value={s.productIds || []}
                        onChange={(e)=> updateShot(s, { productIds: Array.from(e.target.selectedOptions).map(o=>o.value) })}>
                  {products.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:12,opacity:0.7}}>Talent</div>
                <select multiple size={5} value={s.talentIds || []}
                        onChange={(e)=> updateShot(s, { talentIds: Array.from(e.target.selectedOptions).map(o=>o.value) })}>
                  {talent.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
