import React, { useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BookOpen,
  Hammer,
  LayoutGrid,
  ListChecks,
  Lock,
  Menu,
  Package,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Table,
  Wand2,
} from "lucide-react";
import { FLAGS } from "../lib/flags";
import { DemoDataProvider, useDemoData } from "../demo/DemoDataContext";
import { DemoAuthProvider } from "../demo/DemoAuthProvider";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { StatusBadge } from "../components/ui/StatusBadge";
import ProjectCards from "../components/dashboard/ProjectCards";
import ProjectCreateModal from "../components/dashboard/ProjectCreateModal";
import ProjectEditModal from "../components/dashboard/ProjectEditModal";
import { Input } from "../components/ui/input";
import { Modal } from "../components/ui/modal";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { adaptUser } from "../auth/adapter";

const DEMO_PARAMS = new Set(["1", "true", "on", "yes"]);

function isDemoEnabled() {
  if (typeof window !== "undefined") {
    const qs = new URLSearchParams(window.location.search);
    const raw = (qs.get("demo") || qs.get("demoMode") || "").trim().toLowerCase();
    if (DEMO_PARAMS.has(raw)) return true;
  }
  return FLAGS.demoMode === true;
}

export default function DemoPage() {
  const enabled = isDemoEnabled();
  if (!enabled) {
    return <DemoDisabled />;
  }

  return (
    <DemoAuthProvider>
      <DemoDataProvider>
        <DemoShell />
      </DemoDataProvider>
    </DemoAuthProvider>
  );
}

function DemoShell() {
  const { demoUser, resetAll, projects, currentProjectId, setCurrentProjectId } = useDemoData();
  const navigate = useNavigate();
  const location = useLocation();
  const firstProjectId = projects[0]?.id;
  const activeProjectId = currentProjectId || firstProjectId || "citrus";

  const nav = [
    { to: "/demo/projects", label: "Dashboard", icon: LayoutGrid },
    { to: `/demo/projects/${activeProjectId}/shots`, label: "Shots", icon: ListChecks },
    { to: "/demo/products", label: "Products", icon: Package },
    { to: "/demo/library/talent", label: "Library", icon: BookOpen },
    { to: "/demo/pulls", label: "Pulls", icon: Menu },
    { to: "/demo/activity", label: "Activity", icon: Activity },
  ];

  const activePath = location.pathname;
  const avatar = adaptUser({
    uid: demoUser.id,
    displayName: demoUser.name,
    email: demoUser.email,
    photoURL: demoUser.avatarUrl,
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow-sm dark:bg-indigo-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Demo mode</span>
                <StatusBadge status="active">In-memory only</StatusBadge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Share /demo?demo=1 with Stitch</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm dark:border-emerald-700/60 dark:bg-emerald-900/40 dark:text-emerald-100 md:flex">
              <ShieldCheck className="h-4 w-4" />
              No Firebase writes
            </div>
            <Button variant="secondary" size="sm" onClick={() => resetAll()}>
              <RefreshCcw className="h-4 w-4" />
              Reset demo data
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-800">
              <div className="h-8 w-8 overflow-hidden rounded-full bg-slate-200">
                {avatar?.avatarUrl ? (
                  <img src={avatar.avatarUrl} alt={avatar?.name || "Demo user"} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">DU</div>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold">{avatar?.name}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Producer role</div>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-2 pb-2">
          <nav className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 text-sm shadow-inner dark:bg-slate-800/80">
            {nav.map((item) => {
              const isActive =
                item.to.includes("/demo/projects/") && item.to.includes("/shots")
                  ? activePath.includes("/demo/projects/") && activePath.includes("/shots")
                  : activePath.startsWith(item.to);
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 transition ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-primary/30 dark:bg-slate-900 dark:text-slate-100"
                      : "text-slate-600 hover:bg-white/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/60 dark:hover:text-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route index element={<Navigate to="/demo/projects" replace />} />
          <Route path="projects" element={<DemoProjectsPage />} />
          <Route path="projects/:projectId/shots" element={<DemoShotsPage />} />
          <Route path="products" element={<DemoProductsPage />} />
          <Route path="library/talent" element={<DemoLibraryPage view="talent" />} />
          <Route path="library/locations" element={<DemoLibraryPage view="locations" />} />
          <Route path="pulls" element={<DemoPullsPage />} />
          <Route path="activity" element={<DemoActivityPage />} />
          <Route path="*" element={<Navigate to="/demo/projects" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function DemoDisabled() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Card className="border-dashed">
        <CardHeader className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">Demo mode is off</div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Turn it on with <code>?demo=1</code> in the URL or set <code>VITE_ENABLE_DEMO_MODE=1</code> in your env.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <ShieldCheck className="h-4 w-4" />
            Keeps your real Firebase project untouched.
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <Sparkles className="h-4 w-4" />
            Preloads fake data so the Stitch redesign agent can explore flows.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DemoProjectsPage() {
  const {
    projects,
    currentProjectId,
    setCurrentProjectId,
    addProject,
    updateProject,
    archiveProject,
    deleteProject,
  } = useDemoData();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const navigate = useNavigate();

  const handleSelect = (project) => {
    setCurrentProjectId(project.id);
    navigate(`/demo/projects/${project.id}/shots`);
  };

  return (
    <div className="space-y-4">
      <DemoHeader
        title="Projects dashboard"
        description="Exact cards + modals from the app, backed by sample data only."
        badge="Dashboard"
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create project
          </Button>
        }
      />
      <ProjectCards
        projects={projects}
        canManage
        activeProjectId={currentProjectId}
        onSelectProject={handleSelect}
        onEditProject={(project) => setEditingProject(project)}
        onCreateProject={() => setCreateOpen(true)}
      />
      <ProjectCreateModal
        open={createOpen}
        busy={false}
        onClose={() => setCreateOpen(false)}
        onSubmit={(payload) => {
          const proj = addProject(payload.name, payload);
          setCreateOpen(false);
          setCurrentProjectId(proj.id);
        }}
      />
      <ProjectEditModal
        open={Boolean(editingProject)}
        project={editingProject}
        busy={false}
        deleting={false}
        archiving={false}
        onClose={() => setEditingProject(null)}
        onSubmit={(values) => {
          updateProject(editingProject.id, values);
          setEditingProject(null);
        }}
        onDelete={() => {
          deleteProject(editingProject.id);
          setEditingProject(null);
        }}
        onArchive={() => archiveProject(editingProject.id, true)}
        onUnarchive={() => archiveProject(editingProject.id, false)}
      />
    </div>
  );
}

function DemoShotsPage() {
  const { projectId } = useParams();
  const {
    projects,
    currentProjectId,
    setCurrentProjectId,
    currentShots,
    addShot,
    updateShot,
    reorderShots,
    productsById,
    talentById,
    locationsById,
  } = useDemoData();
  const [view, setView] = useState("table");
  const [editingShot, setEditingShot] = useState(null);

  const activeProjectId = projectId || currentProjectId || projects[0]?.id || null;
  React.useEffect(() => {
    if (activeProjectId && activeProjectId !== currentProjectId) {
      setCurrentProjectId(activeProjectId);
    }
  }, [activeProjectId, currentProjectId, setCurrentProjectId]);

  const rows = useMemo(
    () =>
      currentShots.map((shot, index) => {
        const productNames = (shot.productIds || []).map((id) => productsById.get(id)?.name || "Product");
        const talentNames = (shot.talentIds || []).map((id) => talentById.get(id)?.name || "Talent");
        const locationName = shot.locationId ? locationsById.get(shot.locationId)?.name : null;
        return { ...shot, index, productNames, talentNames, locationName };
      }),
    [currentShots, locationsById, productsById, talentById]
  );

  const handleSaveShot = (draft) => {
    const defaultProducts = Array.from(productsById.keys()).slice(0, 2);
    const payload = {
      ...draft,
      productIds: draft.productIds || defaultProducts,
      talentIds: draft.talentIds || [],
      locationId: draft.locationId || Array.from(locationsById.keys())[0] || null,
    };
    if (draft.id) {
      updateShot(activeProjectId, draft.id, payload);
    } else {
      addShot(activeProjectId, payload);
    }
    setEditingShot(null);
  };

  return (
    <div className="space-y-4">
      <DemoHeader
        title="Shots"
        description="Status editing, reordering, and view toggles — data stays local."
        badge="Shots"
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant={view === "table" ? "default" : "secondary"} size="sm" onClick={() => setView("table")}>
              <Table className="h-4 w-4" />
              Table view
            </Button>
            <Button type="button" variant={view === "board" ? "default" : "secondary"} size="sm" onClick={() => setView("board")}>
              <LayoutGrid className="h-4 w-4" />
              Board view
            </Button>
            <Button type="button" size="sm" onClick={() => setEditingShot({})}>
              <Plus className="h-4 w-4" />
              Add shot
            </Button>
          </div>
        }
      />

      {view === "table" ? (
        <div className="overflow-x-auto rounded-card border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/70">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">#</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Shot</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Date</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Location</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Products</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Talent</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900/50">
              {rows.map((shot) => (
                <tr key={shot.id} className="align-top">
                  <td className="px-3 py-3 text-xs font-mono text-slate-500 dark:text-slate-400">{shot.shotNumber || "S"}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-20 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                        {shot.coverUrl ? (
                          <img src={shot.coverUrl} alt={shot.name} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">No image</div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-50">{shot.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{shot.type}</div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2" dangerouslySetInnerHTML={{ __html: shot.notes }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={shot.status}
                      onChange={(e) => updateShot(activeProjectId, shot.id, { status: e.target.value })}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {["todo", "in_progress", "complete", "on_hold"].map((option) => (
                        <option key={option} value={option}>
                          {option.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <div className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {shot.date || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-200">{shot.locationName || "—"}</td>
                  <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {shot.productNames.length ? shot.productNames.join(", ") : "—"}
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {shot.talentNames.length ? shot.talentNames.join(", ") : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => reorderShots(activeProjectId, shot.index, Math.max(0, shot.index - 1))}
                        disabled={shot.index === 0}
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          reorderShots(activeProjectId, shot.index, Math.min(rows.length - 1, shot.index + 1))
                        }
                        disabled={shot.index === rows.length - 1}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setEditingShot(shot)}>
                        <Hammer className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="flex items-center gap-3 px-3 py-6 text-sm text-slate-600 dark:text-slate-300">
              <AlertCircle className="h-4 w-4" />
              Pick or create a project to see demo shots.
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((shot) => (
            <Card key={shot.id} className="h-full">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{shot.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {shot.productNames.join(", ") || "Products pending"}
                  </div>
                </div>
                <StatusBadge status={shot.status}>{shot.status.replace("_", " ")}</StatusBadge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="aspect-video overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60">
                  {shot.coverUrl ? (
                    <img src={shot.coverUrl} alt={shot.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">No image</div>
                  )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: shot.notes }} />
                <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {shot.date}
                  </Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {shot.locationName || "No location"}
                  </Badge>
                  {shot.tags?.map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100">
                      {tag.label}
                    </Badge>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEditingShot(shot)}>
                    <Hammer className="h-4 w-4" />
                    Edit shot
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DemoShotModal
        open={Boolean(editingShot)}
        shot={editingShot}
        onClose={() => setEditingShot(null)}
        onSave={handleSaveShot}
      />
    </div>
  );
}

function DemoProductsPage() {
  const { products, upsertProduct } = useDemoData();
  const [editing, setEditing] = useState(null);

  const handleSave = (payload) => {
    upsertProduct(payload);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <DemoHeader
        title="Products"
        description="Cards + edit modal to mirror catalog layouts."
        badge="Products"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="h-full">
            <CardHeader className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{product.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{product.category}</div>
              </div>
              <StatusBadge status="active">Sample</StatusBadge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="aspect-video overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50">
                {product.heroImage ? (
                  <img src={product.heroImage} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">No image</div>
                )}
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-200">
                {product.styleName} · {product.colourName}
              </div>
              <div className="flex flex-wrap gap-1">
                {(product.tags || []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(product)}>
                Edit product
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <DemoProductModal open={Boolean(editing)} product={editing} onClose={() => setEditing(null)} onSave={handleSave} />
    </div>
  );
}

function DemoLibraryPage({ view }) {
  const { talent, locations, updateTalent, updateLocation } = useDemoData();
  const [editing, setEditing] = useState(null);
  const isTalent = view === "talent";
  const data = isTalent ? talent : locations;

  const handleSave = (payload) => {
    if (isTalent) {
      updateTalent(payload.id, payload);
    } else {
      updateLocation(payload.id, payload);
    }
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <DemoHeader
        title={isTalent ? "Talent library" : "Location library"}
        description="Roster and locations mirrored with editable cards."
        badge="Library"
      />
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((item) => (
          <Card key={item.id} className="h-full">
            <CardHeader className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{item.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isTalent ? `${item.role} · ${item.pronouns}` : `${item.type} · ${item.address}`}
                </div>
              </div>
              <StatusBadge status="active">Sample</StatusBadge>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">{item.notes}</p>
              <div className="flex flex-wrap gap-1">
                {(item.tags || []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(item)}>
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <DemoSimpleEditModal
        open={Boolean(editing)}
        item={editing}
        isTalent={isTalent}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </div>
  );
}

function DemoPullsPage() {
  const { pulls, productsById, togglePullSharing } = useDemoData();

  return (
    <div className="space-y-4">
      <DemoHeader
        title="Pull sheets"
        description="Share toggle mirrors the live UI; data never leaves the browser."
        badge="Pulls"
      />
      <div className="grid gap-4 md:grid-cols-2">
        {pulls.map((pull) => (
          <Card key={pull.id} className="flex h-full flex-col">
            <CardHeader className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{pull.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Project: {pull.projectId} · Status: {pull.status}
                </div>
              </div>
              <StatusBadge status={pull.shared ? "active" : "on_hold"}>
                {pull.shared ? "Shared (demo)" : "Draft"}
              </StatusBadge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                {pull.items.map((item, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {productsById.get(item.productId)?.name || "Product"} · qty {item.quantity}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-emerald-500" />
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">Share link stub</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      /pulls/shared/{pull.shareToken || "demo-token"}
                    </div>
                  </div>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => togglePullSharing(pull.id)}>
                  {pull.shared ? "Hide share" : "Make shareable"}
                </Button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pull data is locked to the browser session; Stitch can open the share stub without hitting Functions.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DemoActivityPage() {
  const { activities } = useDemoData();

  return (
    <div className="space-y-4">
      <DemoHeader
        title="Activity feed"
        description="Timeline seeded for Stitch; never reads Firestore."
        badge="Activity"
      />
      <div className="space-y-2">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/50"
          >
            <div className="mt-0.5">
              <StatusBadge status="active">Demo</StatusBadge>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{activity.summary}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{activity.detail}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {activity.actor} · {new Date(activity.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoHeader({ title, description, badge, actions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:bg-indigo-900/40 dark:text-indigo-200">
          <Sparkles className="h-4 w-4" />
          {badge}
        </div>
        <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
      </div>
      {actions}
    </div>
  );
}

function DemoShotModal({ open, shot, onClose, onSave }) {
  const [draft, setDraft] = useState(() => shot || {});
  React.useEffect(() => {
    setDraft(shot || {});
  }, [shot]);

  if (!open) return null;

  const updateField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal open={open} onClose={onClose} labelledBy="demo-shot-modal" contentClassName="p-0 max-w-2xl">
      <Card className="border-0 shadow-none">
        <CardHeader className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="demo-shot-modal" className="text-lg font-semibold">Shot editor</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">Mirrors the live edit menus; saves to demo memory.</p>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="text-xl text-slate-500 transition hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Name</label>
              <Input value={draft.name || ""} onChange={(e) => updateField("name", e.target.value)} placeholder="Shot name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Status</label>
              <select
                value={draft.status || "todo"}
                onChange={(e) => updateField("status", e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {["todo", "in_progress", "complete", "on_hold"].map((option) => (
                  <option key={option} value={option}>
                    {option.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Date</label>
              <Input type="date" value={draft.date || ""} onChange={(e) => updateField("date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Location</label>
              <Input value={draft.locationName || ""} onChange={(e) => updateField("locationName", e.target.value)} placeholder="Loft studio" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Products (comma separated)</label>
            <Input
              value={(draft.productNames && draft.productNames.join(", ")) || ""}
              onChange={(e) => updateField("productNames", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              placeholder="Linen set, Logo tee"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Notes (HTML allowed)</label>
            <textarea
              value={draft.notes || ""}
              onChange={(e) => updateField("notes", e.target.value)}
              className="min-h-[120px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => onSave(draft)}>
              Save shot
            </Button>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}

function DemoProductModal({ open, product, onClose, onSave }) {
  const [draft, setDraft] = useState(() => product || {});
  React.useEffect(() => {
    setDraft(product || {});
  }, [product]);

  if (!open) return null;

  const updateField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal open={open} onClose={onClose} labelledBy="demo-product-modal" contentClassName="p-0 max-w-xl">
      <Card className="border-0 shadow-none">
        <CardHeader className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="demo-product-modal" className="text-lg font-semibold">Edit product</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">Matches catalog edit menus; stays in memory.</p>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="text-xl text-slate-500 transition hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Name</label>
            <Input value={draft.name || ""} onChange={(e) => updateField("name", e.target.value)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Style</label>
              <Input value={draft.styleName || ""} onChange={(e) => updateField("styleName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Color</label>
              <Input value={draft.colourName || ""} onChange={(e) => updateField("colourName", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Category</label>
            <Input value={draft.category || ""} onChange={(e) => updateField("category", e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Image URL</label>
            <Input value={draft.heroImage || ""} onChange={(e) => updateField("heroImage", e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={() => onSave({ ...draft, id: draft.id || `prod-${Date.now()}` })}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}

function DemoSimpleEditModal({ open, item, isTalent, onClose, onSave }) {
  const [draft, setDraft] = useState(() => item || {});
  React.useEffect(() => {
    setDraft(item || {});
  }, [item]);

  if (!open) return null;

  const updateField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal open={open} onClose={onClose} labelledBy="demo-edit-modal" contentClassName="p-0 max-w-xl">
      <Card className="border-0 shadow-none">
        <CardHeader className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="demo-edit-modal" className="text-lg font-semibold">{isTalent ? "Edit talent" : "Edit location"}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">Keep layout parity with live editor.</p>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="text-xl text-slate-500 transition hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Name</label>
            <Input value={draft.name || ""} onChange={(e) => updateField("name", e.target.value)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">{isTalent ? "Role" : "Type"}</label>
              <Input value={(isTalent ? draft.role : draft.type) || ""} onChange={(e) => updateField(isTalent ? "role" : "type", e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">{isTalent ? "Pronouns" : "Address"}</label>
              <Input value={(isTalent ? draft.pronouns : draft.address) || ""} onChange={(e) => updateField(isTalent ? "pronouns" : "address", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Notes</label>
            <textarea
              value={draft.notes || ""}
              onChange={(e) => updateField("notes", e.target.value)}
              className="min-h-[100px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={() => onSave(draft)}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
