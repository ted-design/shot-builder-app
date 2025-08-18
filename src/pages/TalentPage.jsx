// updated TalentPage.jsx
//
// This version of the talent page adopts the shared UI primitives (`Card`,
// `Input`, `Checkbox`, `Button`) to unify styling with other pages.  The
// functionality remains the same: you can search talent, add new entries
// (with optional headshots), and edit or delete existing talent.  Each
// talent entry is displayed in its own card with action buttons.  The
// search bar and new-entry form are presented at the top of the page.

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { db, storage, uploadImageFile, deleteImageByPath } from "../firebase";
import { talentPath } from "../lib/paths";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

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
    return () => {
      alive = false;
    };
  }, [path, size]);
  if (!url)
    return <div className="bg-gray-100 rounded" style={{ width: size, height: size }} />;
  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className="object-cover rounded"
    />
  );
}

export default function TalentPage() {
  const [items, setItems] = useState([]);
  const [qText, setQText] = useState("");
  const [file, setFile] = useState(null);
  const [draft, setDraft] = useState({
    firstName: "",
    lastName: "",
    agency: "",
    phone: "",
    email: "",
    sizing: "",
    url: "",
    gender: "",
  });

  // Subscribe to talent collection
  useEffect(() => {
    const qy = query(collection(db, ...talentPath), orderBy("lastName", "asc"));
    const unsub = onSnapshot(qy, (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
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
      createdAt: Date.now(),
    });
    if (file) {
      const { path } = await uploadImageFile(file, { folder: "talent", id: docRef.id });
      await updateDoc(docRef, { headshotPath: path });
      setFile(null);
    }
    setDraft({ firstName: "", lastName: "", agency: "", phone: "", email: "", sizing: "", url: "", gender: "" });
  };

  const rename = async (t) => {
    const first = prompt("First name", t.firstName || "");
    const last = prompt("Last name", t.lastName || "");
    const name = `${(first || "").trim()} ${(last || "").trim()}`.trim();
    await updateDoc(doc(db, ...talentPath, t.id), { firstName: first, lastName: last, name });
  };
  const changeImage = async (t) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const { path } = await uploadImageFile(f, { folder: "talent", id: t.id });
      await updateDoc(doc(db, ...talentPath, t.id), { headshotPath: path });
      if (t.headshotPath) {
        try {
          await deleteImageByPath(t.headshotPath);
        } catch {}
      }
    };
    input.click();
  };
  const removeImage = async (t) => {
    if (!t.headshotPath) return;
    try {
      await deleteImageByPath(t.headshotPath);
    } catch {}
    await updateDoc(doc(db, ...talentPath, t.id), { headshotPath: null });
  };
  const remove = async (id, prevPath) => {
    await deleteDoc(doc(db, ...talentPath, id));
    if (prevPath) {
      try {
        await deleteImageByPath(prevPath);
      } catch {}
    }
  };

  const filtered = qText
    ? items.filter((i) => ((i.name || "") + " " + (i.agency || "")).toLowerCase().includes(qText.toLowerCase()))
    : items;

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Talent</h1>
        <Input
          placeholder="Search…"
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      {/* Form to create a new talent */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Create New Talent</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              placeholder="First name"
              value={draft.firstName}
              onChange={(e) => change("firstName", e.target.value)}
            />
            <Input
              placeholder="Last name"
              value={draft.lastName}
              onChange={(e) => change("lastName", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              placeholder="Agency (optional)"
              value={draft.agency}
              onChange={(e) => change("agency", e.target.value)}
            />
            <Input
              placeholder="Gender (optional)"
              value={draft.gender}
              onChange={(e) => change("gender", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              placeholder="Phone (optional)"
              value={draft.phone}
              onChange={(e) => change("phone", e.target.value)}
            />
            <Input
              placeholder="Email (optional)"
              value={draft.email}
              onChange={(e) => change("email", e.target.value)}
            />
          </div>
          <Input
            placeholder="Sizing info (optional)"
            value={draft.sizing}
            onChange={(e) => change("sizing", e.target.value)}
          />
          <Input
            placeholder="URL (optional)"
            value={draft.url}
            onChange={(e) => change("url", e.target.value)}
          />
          <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div>
            <Button onClick={create}>Add Talent</Button>
          </div>
        </CardContent>
      </Card>

      {/* List of existing talent */}
      <div className="space-y-4">
        {filtered.map((t) => (
          <Card key={t.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start sm:items-center gap-4">
                <Thumb path={t.headshotPath} size={64} alt={t.name} />
                <div className="flex-1 space-y-1">
                  <div className="font-semibold text-base">
                    {t.name}
                    {t.agency && <span className="text-sm text-gray-600"> • {t.agency}</span>}
                  </div>
                  <div className="text-sm text-gray-600">
                    {[t.phone, t.email].filter(Boolean).join(" • ")}
                  </div>
                  {(t.sizing || t.url) && (
                    <div className="text-sm text-gray-600 mt-1">
                      {t.sizing && <span>Sizing: {t.sizing}</span>}
                      {t.sizing && t.url ? " • " : ""}
                      {t.url && (
                        <a href={t.url} target="_blank" rel="noreferrer" className="underline">
                          {t.url}
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="secondary" onClick={() => changeImage(t)}>
                    Change Image
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => removeImage(t)}>
                    Remove Image
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => rename(t)}>
                    Rename
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(t.id, t.headshotPath)}>
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}