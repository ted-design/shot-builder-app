import { useEffect, useState } from "react";
import {
  collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy
} from "firebase/firestore";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { db, storage, uploadImageFile, deleteImageByPath } from "../firebase";
import { locationsPath } from "../lib/paths";

const resizedPath = (originalPath, size = 200) =>
  originalPath.replace(/(\.[^./]+)$/, `_${size}x${size}$1`);

function Thumb({ path, size = 64, alt = "" }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!path) return setUrl(null);
      try {
        const u200 = await getDownloadURL(storageRef(storage, resizedPath(path, size)));
        if (alive) setUrl(u200);
      } catch {
        const u = await getDownloadURL(storageRef(storage, path));
        if (alive) setUrl(u);
      }
    })();
    return () => { alive = false; };
  }, [path, size]);
  if (!url) return <div style={{width:size,height:size,background:"#eee",borderRadius:8}}/>;
  return <img src={url} alt={alt} width={size} height={size} style={{objectFit:"cover",borderRadius:8}}/>;
}

export default function LocationsPage() {
  const [items, setItems] = useState([]);
  const [qText, setQText] = useState("");

  const [draft, setDraft] = useState({
    name: "",
    street: "",
    unit: "",
    city: "",
    province: "",
    postal: "",
    phone: "",
    notes: ""
  });
  const [file, setFile] = useState(null);

  useEffect(() => {
    const qy = query(collection(db, ...locationsPath), orderBy("name","asc"));
    const unsub = onSnapshot(qy, s => setItems(s.docs.map(d => ({ id:d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  const create = async () => {
    if (!draft.name) return;
    const docRef = await addDoc(collection(db, ...locationsPath), {
      ...draft, shotIds: [], photoPath: null, createdAt: Date.now()
    });
    if (file) {
      const { path } = await uploadImageFile(file, { folder:"locations", id: docRef.id });
      await updateDoc(docRef, { photoPath: path });
      setFile(null);
    }
    setDraft({ name:"", street:"", unit:"", city:"", province:"", postal:"", phone:"", notes:"" });
  };

  const rename = async (item) => {
    const name = prompt("New name", item.name);
    if (!name) return;
    await updateDoc(doc(db, ...locationsPath, item.id), { name });
  };

  const changeImage = async (item) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      const { path } = await uploadImageFile(f, { folder:"locations", id: item.id });
      await updateDoc(doc(db, ...locationsPath, item.id), { photoPath: path });
      if (item.photoPath) { try { await deleteImageByPath(item.photoPath); } catch {} }
    };
    input.click();
  };

  const removeImage = async (item) => {
    if (!item.photoPath) return;
    try { await deleteImageByPath(item.photoPath); } catch {}
    await updateDoc(doc(db, ...locationsPath, item.id), { photoPath: null });
  };

  const remove = async (id, prevPath) => {
    await deleteDoc(doc(db, ...locationsPath, id));
    if (prevPath) { try { await deleteImageByPath(prevPath); } catch {} }
  };

  const filtered = qText
    ? items.filter(i => (i.name||"").toLowerCase().includes(qText.toLowerCase()))
    : items;

  const change = (k, v) => setDraft({ ...draft, [k]: v });

  return (
    <div style={{padding:24}}>
      <h1>Locations</h1>

      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <input placeholder="Search..." value={qText} onChange={e=>setQText(e.target.value)}/>
      </div>

      <div style={{display:"grid",gap:8,maxWidth:720,marginBottom:24}}>
        <input placeholder="Name" value={draft.name} onChange={e=>change("name", e.target.value)}/>
        <input placeholder="Street address" value={draft.street} onChange={e=>change("street", e.target.value)}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input placeholder="Unit (optional)" value={draft.unit} onChange={e=>change("unit", e.target.value)}/>
          <input placeholder="City" value={draft.city} onChange={e=>change("city", e.target.value)}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input placeholder="Province/State" value={draft.province} onChange={e=>change("province", e.target.value)}/>
          <input placeholder="Postal/ZIP" value={draft.postal} onChange={e=>change("postal", e.target.value)}/>
        </div>
        <input placeholder="Phone (optional)" value={draft.phone} onChange={e=>change("phone", e.target.value)}/>
        <textarea placeholder="Other notes / instructions (optional)" value={draft.notes} onChange={e=>change("notes", e.target.value)}/>
        <input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/>
        <button onClick={create}>Add Location</button>
      </div>

      <ul style={{display:"grid",gap:8}}>
        {filtered.map(l => (
          <li key={l.id}
              style={{border:"1px solid #ddd",padding:12,borderRadius:8,display:"grid",
                      gridTemplateColumns:"auto 1fr auto",gap:12,alignItems:"center"}}>
            <Thumb path={l.photoPath} size={64} alt={l.name}/>
            <div>
              <div><strong>{l.name}</strong></div>
              <div style={{fontSize:12,opacity:0.8}}>
                {[l.street, l.unit && `Unit ${l.unit}`, l.city, l.province, l.postal].filter(Boolean).join(", ")}
              </div>
              {l.phone && <div style={{fontSize:12,opacity:0.8}}>☎ {l.phone}</div>}
              {l.notes && <div style={{fontSize:12,opacity:0.8,marginTop:4}}>{l.notes}</div>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>changeImage(l)}>Change Image</button>
              <button onClick={()=>removeImage(l)}>Remove Image</button>
              <button onClick={()=>rename(l)}>Rename</button>
              <button onClick={()=>remove(l.id, l.photoPath)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
