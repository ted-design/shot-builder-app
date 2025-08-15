import { useEffect, useState } from "react";
import {
  collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy
} from "firebase/firestore";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { db, storage, uploadImageFile, deleteImageByPath } from "../firebase";
import { talentPath } from "../lib/paths";

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

export default function TalentPage() {
  const [items, setItems] = useState([]);
  const [qText, setQText] = useState("");
  const [file, setFile] = useState(null);

  const [draft, setDraft] = useState({
    firstName: "", lastName: "",
    agency: "",
    phone: "", email: "",
    sizing: "", // free text for now (e.g., "Top M / Bottom 32 / Shoe 10")
    url: "",
    gender: ""  // keeping your existing field
  });

  useEffect(() => {
    const qy = query(collection(db, ...talentPath), orderBy("lastName","asc"));
    const unsub = onSnapshot(qy, s => setItems(s.docs.map(d => ({ id:d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  const change = (k, v) => setDraft({ ...draft, [k]: v });

  const create = async () => {
    if (!draft.firstName && !draft.lastName) return alert("Enter a name");
    const name = `${draft.firstName || ""} ${draft.lastName || ""}`.trim();
    const docRef = await addDoc(collection(db, ...talentPath), {
      ...draft,
      name,
      shotIds: [],
      headshotPath: null,
      createdAt: Date.now()
    });
    if (file) {
      const { path } = await uploadImageFile(file, { folder:"talent", id: docRef.id });
      await updateDoc(docRef, { headshotPath: path });
      setFile(null);
    }
    setDraft({ firstName:"", lastName:"", agency:"", phone:"", email:"", sizing:"", url:"", gender:"" });
  };

  const rename = async (t) => {
    const first = prompt("First name", t.firstName || "");
    const last = prompt("Last name", t.lastName || "");
    const name = `${(first||"").trim()} ${(last||"").trim()}`.trim();
    await updateDoc(doc(db, ...talentPath, t.id), { firstName:first, lastName:last, name });
  };

  const changeImage = async (t) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      const { path } = await uploadImageFile(f, { folder:"talent", id: t.id });
      await updateDoc(doc(db, ...talentPath, t.id), { headshotPath: path });
      if (t.headshotPath) { try { await deleteImageByPath(t.headshotPath); } catch {} }
    };
    input.click();
  };

  const removeImage = async (t) => {
    if (!t.headshotPath) return;
    try { await deleteImageByPath(t.headshotPath); } catch {}
    await updateDoc(doc(db, ...talentPath, t.id), { headshotPath: null });
  };

  const remove = async (id, prevPath) => {
    await deleteDoc(doc(db, ...talentPath, id));
    if (prevPath) { try { await deleteImageByPath(prevPath); } catch {} }
  };

  const filtered = qText
    ? items.filter(i => ((i.name||"") + " " + (i.agency||"")).toLowerCase().includes(qText.toLowerCase()))
    : items;

  return (
    <div style={{padding:24}}>
      <h1>Talent</h1>

      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <input placeholder="Search..." value={qText} onChange={e=>setQText(e.target.value)}/>
      </div>

      <div style={{display:"grid",gap:8,maxWidth:720,marginBottom:24}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input placeholder="First name" value={draft.firstName} onChange={e=>change("firstName", e.target.value)}/>
          <input placeholder="Last name" value={draft.lastName} onChange={e=>change("lastName", e.target.value)}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input placeholder="Agency (optional)" value={draft.agency} onChange={e=>change("agency", e.target.value)}/>
          <input placeholder="Gender (optional)" value={draft.gender} onChange={e=>change("gender", e.target.value)}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input placeholder="Phone (optional)" value={draft.phone} onChange={e=>change("phone", e.target.value)}/>
          <input placeholder="Email (optional)" value={draft.email} onChange={e=>change("email", e.target.value)}/>
        </div>
        <input placeholder="Sizing info (optional)" value={draft.sizing} onChange={e=>change("sizing", e.target.value)}/>
        <input placeholder="URL (optional)" value={draft.url} onChange={e=>change("url", e.target.value)}/>
        <input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/>
        <button onClick={create}>Add Talent</button>
      </div>

      <ul style={{display:"grid",gap:8}}>
        {filtered.map(t => (
          <li key={t.id}
              style={{border:"1px solid #ddd",padding:12,borderRadius:8,display:"grid",
                      gridTemplateColumns:"auto 1fr auto",gap:12,alignItems:"center"}}>
            <Thumb path={t.headshotPath} size={64} alt={t.name}/>
            <div>
              <div><strong>{t.name}</strong> {t.agency && <span style={{opacity:0.7}}>• {t.agency}</span>}</div>
              <div style={{fontSize:12,opacity:0.8}}>
                {[t.phone, t.email].filter(Boolean).join(" • ")}
              </div>
              {(t.sizing || t.url) && (
                <div style={{fontSize:12,opacity:0.8,marginTop:4}}>
                  {t.sizing && <span>Sizing: {t.sizing}</span>}
                  {t.sizing && t.url ? " • " : ""}
                  {t.url && <a href={t.url} target="_blank" rel="noreferrer">{t.url}</a>}
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>changeImage(t)}>Change Image</button>
              <button onClick={()=>removeImage(t)}>Remove Image</button>
              <button onClick={()=>rename(t)}>Rename</button>
              <button onClick={()=>remove(t.id, t.headshotPath)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
