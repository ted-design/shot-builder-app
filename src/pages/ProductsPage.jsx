import { useEffect, useState } from "react";
import {
  collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy
} from "firebase/firestore";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { db, storage, uploadImageFile, deleteImageByPath } from "../firebase";
import { productsPath } from "../lib/paths";

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

export default function ProductsPage() {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({ name:"", sku:"", category:"", active:true });
  const [file, setFile] = useState(null);
  const [qText, setQText] = useState("");

  useEffect(() => {
    const qy = query(collection(db, ...productsPath), orderBy("name","asc"));
    const unsub = onSnapshot(qy, s => setItems(s.docs.map(d => ({ id:d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  const create = async () => {
    if (!draft.name) return;
    const docRef = await addDoc(collection(db, ...productsPath), {
      ...draft, shotIds: [], thumbnailPath: null, createdAt: Date.now()
    });
    if (file) {
      const { path } = await uploadImageFile(file, { folder:"products", id: docRef.id });
      await updateDoc(docRef, { thumbnailPath: path });
      setFile(null);
    }
    setDraft({ name:"", sku:"", category:"", active:true });
  };

  const rename = async (item) => {
    const name = prompt("New name", item.name);
    if (!name) return;
    await updateDoc(doc(db, ...productsPath, item.id), { name });
  };

  const changeImage = async (item) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      const { path } = await uploadImageFile(f, { folder:"products", id: item.id });
      await updateDoc(doc(db, ...productsPath, item.id), { thumbnailPath: path });
      if (item.thumbnailPath) { try { await deleteImageByPath(item.thumbnailPath); } catch {} }
    };
    input.click();
  };

  const removeImage = async (item) => {
    if (!item.thumbnailPath) return;
    try { await deleteImageByPath(item.thumbnailPath); } catch {}
    await updateDoc(doc(db, ...productsPath, item.id), { thumbnailPath: null });
  };

  const toggleActive = async (item) => {
    await updateDoc(doc(db, ...productsPath, item.id), { active: !item.active });
  };

  const remove = async (id, prevPath) => {
    await deleteDoc(doc(db, ...productsPath, id));
    if (prevPath) { try { await deleteImageByPath(prevPath); } catch {} }
  };

  const filtered = qText
    ? items.filter(i => (i.name||"").toLowerCase().includes(qText.toLowerCase()))
    : items;

  return (
    <div style={{padding:24}}>
      <h1>Products</h1>

      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <input placeholder="Search..." value={qText} onChange={e=>setQText(e.target.value)}/>
      </div>

      <div style={{display:"grid",gap:8,maxWidth:560,marginBottom:24}}>
        <input placeholder="Name" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/>
        <input placeholder="SKU" value={draft.sku} onChange={e=>setDraft({...draft,sku:e.target.value})}/>
        <input placeholder="Category" value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}/>
        <label style={{display:"flex",gap:8,alignItems:"center"}}>
          <input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>
          Active
        </label>
        <input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/>
        <button onClick={create}>Add Product</button>
      </div>

      <ul style={{display:"grid",gap:8}}>
        {filtered.map(p => (
          <li key={p.id}
              style={{border:"1px solid #ddd",padding:12,borderRadius:8,display:"grid",
                      gridTemplateColumns:"auto 1fr auto",gap:12,alignItems:"center"}}>
            <Thumb path={p.thumbnailPath} size={64} alt={p.name}/>
            <div>
              <div><strong>{p.name}</strong> <span style={{opacity:0.6}}>{p.sku}</span></div>
              <div style={{opacity:0.7,fontSize:12}}>
                {p.category} • {p.active ? "Active" : "Discontinued"}
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>changeImage(p)}>Change Image</button>
              <button onClick={()=>removeImage(p)}>Remove Image</button>
              <button onClick={()=>toggleActive(p)}>{p.active ? "Set Discontinued" : "Set Active"}</button>
              <button onClick={()=>rename(p)}>Rename</button>
              <button onClick={()=>remove(p.id, p.thumbnailPath)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
