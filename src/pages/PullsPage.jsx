import { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { pullsPath, ACTIVE_PROJECT_ID } from "../lib/paths";

export default function PullsPage() {
  const path = pullsPath(ACTIVE_PROJECT_ID);
  const [pulls, setPulls] = useState([]);
  const [lines, setLines] = useState([{ productId:"", requestedQty:1, note:"" }]);

  useEffect(() => {
    const q = query(collection(db, ...path), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, s => setPulls(s.docs.map(d=>({id:d.id, ...d.data()}))));
    return () => unsub();
  }, [ACTIVE_PROJECT_ID]);

  const addLine = () => setLines([...lines, { productId:"", requestedQty:1, note:"" }]);
  const createPull = async () => {
    const cleaned = lines.filter(l=>l.productId && l.requestedQty>0);
    if (!cleaned.length) return alert("Add at least one line");
    await addDoc(collection(db, ...path), {
      status: "draft", createdAt: Date.now(), lines: cleaned, fulfillments: []
    });
    setLines([{ productId:"", requestedQty:1, note:"" }]);
  };

  const fulfill = async (pull, productId) => {
    const sku = prompt("SKU to fulfill with?");
    const qty = parseInt(prompt("Qty fulfilled?") || "0", 10);
    if (!sku || !qty) return;
    const next = (pull.fulfillments || []);
    next.push({ productId, items:[{ sku, qty }], by: "warehouse-user", at: Date.now() });
    await updateDoc(doc(db, ...path, pull.id), { fulfillments: next, status: "fulfilling" });
  };

  return (
    <div style={{padding:24}}>
      <h1>Pull Sheets</h1>

      <h3>Create Pull</h3>
      {lines.map((l, i) => (
        <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 2fr auto",gap:8,marginBottom:8}}>
          <input placeholder="Product ID" value={l.productId} onChange={e=>{
            const arr=[...lines]; arr[i]={...arr[i], productId:e.target.value}; setLines(arr);
          }}/>
          <input placeholder="Qty" type="number" value={l.requestedQty} onChange={e=>{
            const arr=[...lines]; arr[i]={...arr[i], requestedQty: parseInt(e.target.value||"0",10)}; setLines(arr);
          }}/>
          <input placeholder="Note (size/color) optional" value={l.note} onChange={e=>{
            const arr=[...lines]; arr[i]={...arr[i], note:e.target.value}; setLines(arr);
          }}/>
          <button onClick={addLine}>+</button>
        </div>
      ))}
      <button onClick={createPull}>Create Pull</button>

      <h3 style={{marginTop:24}}>Existing</h3>
      <ul style={{display:"grid",gap:12}}>
        {pulls.map(p => (
          <li key={p.id} style={{border:"1px solid #ddd",borderRadius:8,padding:12}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <strong>Pull {p.id.slice(0,6)}</strong>
              <span>Status: {p.status}</span>
            </div>
            <div style={{display:"grid",gap:6,marginTop:8}}>
              {(p.lines||[]).map((ln, idx)=>(
                <div key={idx} style={{display:"flex",justifyContent:"space-between",background:"#fafafa",padding:"6px 8px",borderRadius:6}}>
                  <span>Product: {ln.productId} • Requested: {ln.requestedQty} {ln.note?`• ${ln.note}`:""}</span>
                  <button onClick={()=>fulfill(p, ln.productId)}>Fulfill</button>
                </div>
              ))}
            </div>
            {(p.fulfillments||[]).length>0 && (
              <>
                <div style={{marginTop:8,fontWeight:600}}>Fulfillments</div>
                <div style={{display:"grid",gap:6}}>
                  {p.fulfillments.map((f, i)=>(
                    <div key={i} style={{fontSize:14,opacity:0.85}}>
                      {f.productId}: {f.items.map(it=>`${it.sku} x ${it.qty}`).join(", ")}
                    </div>
                  ))}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
