import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { CLIENT_ID, talentPath, locationsPath } from "../lib/paths";
import { ROLE, roleLabel } from "../lib/rbac";
import { useAuth } from "../context/AuthContext";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { PageHeader } from "../components/ui/PageHeader";
import { toast } from "../lib/toast";
import { writeDoc } from "../lib/firestoreWrites";
import { describeFirebaseError } from "../lib/firebaseErrors";
import OrphanedShotsMigration from "../components/admin/OrphanedShotsMigration";

const ROLE_OPTIONS = [ROLE.ADMIN, ROLE.PRODUCER, ROLE.CREW, ROLE.WAREHOUSE, ROLE.VIEWER];

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState(ROLE.PRODUCER);
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { clientId, refreshToken, user: authUser } = useAuth();
  const resolvedClientId = clientId || CLIENT_ID;
  const currentTalentPath = useMemo(() => talentPath(resolvedClientId), [resolvedClientId]);
  const currentLocationsPath = useMemo(() => locationsPath(resolvedClientId), [resolvedClientId]);
  const devToolsEnabled = import.meta.env.VITE_DEV_TOOLS === "true";

  useEffect(() => {
    const ref = collection(db, "clients", resolvedClientId, "users");
    const unsub = onSnapshot(ref, (snapshot) => {
      setUsers(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    return () => unsub();
  }, [resolvedClientId]);

  const setUserClaims = useMemo(() => httpsCallable(functions, "setUserClaims"), []);

  const handleAddUser = async (event) => {
    event.preventDefault();
    const email = newEmail.trim();
    if (!email) {
      setStatus("Enter an email to invite or update a user.");
      return;
    }
    setAdding(true);
    setStatus("");
    try {
      const response = await setUserClaims({
        targetEmail: email,
        role: newRole,
        clientId: resolvedClientId,
      });
      const data = response?.data || {};
      const uid = data.uid;
      if (!uid) throw new Error("Callable did not return a user id.");

      await setDoc(
        doc(db, "clients", resolvedClientId, "users", uid),
        {
          email,
          displayName: newName.trim() || null,
          role: newRole,
          projects: data.projects || {},
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (authUser && authUser.uid === uid) {
        await refreshToken?.();
      }

      setStatus(`Updated claims for ${email}. They will appear in the roster once they sign in.`);
      setNewEmail("");
      setNewName("");
      setNewRole(ROLE.PRODUCER);
    } catch (err) {
      console.error("Failed to add/update user", err);
      setStatus(err.message || String(err));
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (userDoc, nextRole) => {
    setUpdatingId(userDoc.id);
    setStatus("");
    try {
      await setDoc(
        doc(db, "clients", resolvedClientId, "users", userDoc.id),
        {
          role: nextRole,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (userDoc.email) {
        await setUserClaims({
          targetEmail: userDoc.email,
          role: nextRole,
          clientId: resolvedClientId,
        });
        if (authUser && authUser.uid === userDoc.id) {
          await refreshToken?.();
        }
      }

      setStatus(`Updated ${userDoc.email || userDoc.id} to ${roleLabel(nextRole)}.`);
    } catch (err) {
      console.error("Failed to update role", err);
      setStatus(err.message || String(err));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSeedSamples = async () => {
    setSeeding(true);
    try {
      const talentSeeds = [
        {
          firstName: "Alex",
          lastName: "Rivera",
          name: "Alex Rivera",
          agency: "North Collective",
          phone: "555-0112",
          email: "alex.rivera@example.com",
        },
        {
          firstName: "Morgan",
          lastName: "Lee",
          name: "Morgan Lee",
          agency: "Freelance",
          email: "morgan.lee@example.com",
        },
      ];

      const locationSeeds = [
        {
          name: "Studio 22",
          street: "22 Front St W",
          city: "Toronto",
          province: "ON",
          notes: "Drive-in access, blackout curtains",
        },
        {
          name: "Warehouse B",
          street: "410 Industrial Rd",
          city: "Hamilton",
          province: "ON",
          notes: "Roll-up doors, forklift on site",
        },
      ];

      await Promise.all([
        ...talentSeeds.map((seed) =>
          writeDoc("seed talent", () =>
            addDoc(collection(db, ...currentTalentPath), {
              ...seed,
              shotIds: [],
              headshotPath: null,
              createdAt: serverTimestamp(),
              createdBy: authUser?.uid || null,
            })
          )
        ),
        ...locationSeeds.map((seed) =>
          writeDoc("seed location", () =>
            addDoc(collection(db, ...currentLocationsPath), {
              ...seed,
              shotIds: [],
              photoPath: null,
              createdAt: serverTimestamp(),
              createdBy: authUser?.uid || null,
            })
          )
        ),
      ]);

      toast.success("Sample talent and locations created.");
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to seed samples.");
      toast.error({ title: "Seed failed", description: `${code}: ${message}` });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Manage team roles and project access. Updates sync to Firebase custom claims so security rules stay in lockstep."
      />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Team Members</h2>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleAddUser}
            className="mb-6 grid gap-3 rounded-card border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-700 dark:text-slate-300"
          >
            <div className="font-medium text-slate-800 dark:text-slate-200">Invite or Update User</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email"
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Display name (optional)"
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {roleLabel(option)}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={adding}
                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
              >
                {adding ? "Saving..." : "Apply role"}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The user must sign in at least once before appearing in the roster. Claims take effect
              immediately after this action.
            </p>
          </form>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Projects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {users.map((user) => {
                  const projectCount = user.projects ? Object.keys(user.projects).length : 0;
                  const roleValue = user.role || ROLE.VIEWER;
                  return (
                    <tr key={user.id} className="whitespace-nowrap">
                      <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{user.displayName || "—"}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{user.email || "—"}</td>
                      <td className="px-3 py-2">
                        <select
                          className="min-w-[140px] rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/60"
                          value={roleValue}
                          disabled={updatingId === user.id}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {roleLabel(option)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{projectCount}</td>
                    </tr>
                  );
                })}
                {!users.length && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                      No users found for this client yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <OrphanedShotsMigration clientId={resolvedClientId} />

      {devToolsEnabled && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Development Utilities</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Seed sample talent and locations to verify permissions in a sandbox environment.
            </p>
            <button
              type="button"
              onClick={handleSeedSamples}
              disabled={seeding}
              className="inline-flex items-center rounded-md bg-slate-800 dark:bg-slate-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              {seeding ? "Seeding…" : "Seed sample talent & locations"}
            </button>
          </CardContent>
        </Card>
      )}

      {status && (
        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
          {status}
        </div>
      )}
    </div>
  );
}
