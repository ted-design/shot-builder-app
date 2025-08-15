{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 function ShotsPage() \{\
  const user = auth.currentUser;\
  const [shots, setShots] = useState([]);\
  const [newName, setNewName] = useState('');\
\
  useEffect(() => \{\
    // live subscription to /shots ordered by createdAt\
    const q = query(collection(db, 'shots'), orderBy('createdAt', 'asc'));\
    const unsub = onSnapshot(q, (snap) => \{\
      const rows = snap.docs.map((d) => (\{ id: d.id, ...d.data() \}));\
      setShots(rows);\
    \});\
    return () => unsub();\
  \}, []);\
\
  async function createShot(e) \{\
    e.preventDefault();\
    const name = newName.trim();\
    if (!name) return;\
    await addDoc(collection(db, 'shots'), \{\
      name,\
      date: null,                 // Unassigned by default\
      createdAt: serverTimestamp(),\
      createdBy: user?.uid || null,\
    \});\
    setNewName('');\
  \}\
\
  return (\
    <div className="p-4">\
      <h2 className="text-xl font-semibold mb-3">Shots</h2>\
      <p className="text-sm text-gray-600 mb-4">\
        Welcome, \{user?.displayName || 'producer'\}.\
      </p>\
\
      <form onSubmit=\{createShot\} className="flex gap-2 mb-4">\
        <input\
          className="border rounded px-2 py-1"\
          placeholder="New shot name\'85"\
          value=\{newName\}\
          onChange=\{(e) => setNewName(e.target.value)\}\
        />\
        <button className="bg-indigo-600 text-white px-3 py-1 rounded" type="submit">\
          Add Shot\
        </button>\
      </form>\
\
      <table className="w-full text-left border">\
        <thead>\
          <tr className="bg-gray-100">\
            <th className="p-2 border">Name</th>\
            <th className="p-2 border">Date</th>\
            <th className="p-2 border">Created</th>\
          </tr>\
        </thead>\
        <tbody>\
          \{shots.map((s) => (\
            <tr key=\{s.id\}>\
              <td className="p-2 border">\{s.name\}</td>\
              <td className="p-2 border">\{s.date ?? 'Unassigned'\}</td>\
              <td className="p-2 border">\
                \{s.createdAt?.toDate\
                  ? s.createdAt.toDate().toLocaleString()\
                  : '\'97'\}\
              </td>\
            </tr>\
          ))\}\
          \{shots.length === 0 && (\
            <tr>\
              <td className="p-2 border" colSpan=\{3\}>No shots yet.</td>\
            </tr>\
          )\}\
        </tbody>\
      </table>\
    </div>\
  );\
\}\
}