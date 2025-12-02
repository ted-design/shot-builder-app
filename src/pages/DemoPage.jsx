import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  Lock,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { FLAGS } from "../lib/flags";
import { DemoDataProvider, useDemoData } from "../demo/DemoDataContext";
import ProjectCards from "../components/dashboard/ProjectCards";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { StatusBadge } from "../components/ui/StatusBadge";
import { shotStatusOptions } from "../lib/shotStatus";

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
    <DemoDataProvider>
      <DemoExperience />
    </DemoDataProvider>
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

function DemoExperience() {
  const {
    demoUser,
    projects,
    currentProjectId,
    setCurrentProjectId,
    addProject,
    addActivity,
  } = useDemoData();
  const [activeView, setActiveView] = useState("shots");

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) || projects[0] || null,
    [projects, currentProjectId]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <DemoHero demoUser={demoUser} />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step 1</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Pick a project (demo data)</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              These cards are backed by in-memory sample data. Creating or editing here never touches Firebase.
            </p>
          </div>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
            Safe sandbox
          </Badge>
        </div>
        <ProjectCards
          projects={projects}
          canManage={true}
          activeProjectId={currentProject?.id}
          onSelectProject={(project) => setCurrentProjectId(project.id)}
          onEditProject={(project) =>
            addActivity({
              projectId: project.id,
              summary: `Edited ${project.name} (demo only)`,
              detail: "No production write occurred.",
            })
          }
          onCreateProject={() => addProject(`Demo project ${projects.length + 1}`)}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step 2</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Explore core flows — all fake data
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Switch tabs to see how shots, products, libraries, and pulls behave without calling your backend.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Eye className="h-4 w-4" />
            What Stitch sees is in-memory only.
          </div>
        </div>

        <ViewSwitcher activeView={activeView} onChange={setActiveView} />

        <div className="rounded-card border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {activeView === "shots" && <DemoShotsTable project={currentProject} />}
          {activeView === "products" && <DemoProducts />}
          {activeView === "library" && <DemoLibrary />}
          {activeView === "pulls" && <DemoPulls />}
          {activeView === "activity" && <DemoActivityFeed />}
        </div>
      </section>
    </div>
  );
}

function DemoHero({ demoUser }) {
  return (
    <Card className="relative overflow-hidden border-primary/30 shadow-lg shadow-primary/10">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-emerald-100/30 dark:from-indigo-900/30 dark:to-slate-800/60" aria-hidden />
      <CardContent className="relative flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:bg-indigo-900/40 dark:text-indigo-200">
            <Sparkles className="h-4 w-4" />
            Demo mode — no Firebase writes
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Stitch-ready sandbox</h1>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              This route mirrors key Shot Builder flows with canned data. Interactions stay in memory so the redesign agent
              can click, filter, and edit without touching production.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-md bg-white/80 px-3 py-2 text-xs text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-700">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Auth is bypassed — demo user: {demoUser.name}
            </div>
            <div className="flex items-center gap-2 rounded-md bg-white/80 px-3 py-2 text-xs text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-700">
              <RefreshCcw className="h-4 w-4 text-primary" />
              Refresh to reset data
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/20 bg-white/80 px-5 py-4 shadow-sm dark:border-indigo-700/50 dark:bg-slate-900/60">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg dark:bg-indigo-500">
            <Wand2 className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Give Stitch this URL</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">/demo?demo=1</p>
          </div>
          <Badge variant="secondary" className="bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
            Everything here is sample data
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ViewSwitcher({ activeView, onChange }) {
  const tabs = [
    { key: "shots", label: "Shots", description: "Table + statuses" },
    { key: "products", label: "Products", description: "Catalog filters" },
    { key: "library", label: "Library", description: "Talent & locations" },
    { key: "pulls", label: "Pull sheets", description: "Share-safe pulls" },
    { key: "activity", label: "Activity", description: "Recent actions" },
  ];

  return (
    <div className="flex flex-wrap gap-2 rounded-card border border-slate-200 bg-slate-50 p-2 text-sm shadow-inner dark:border-slate-700 dark:bg-slate-900/60">
      {tabs.map((tab) => {
        const isActive = tab.key === activeView;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex flex-col rounded-lg px-3 py-2 transition ${
              isActive
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-primary/30 dark:bg-slate-800 dark:text-slate-100"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
            }`}
            type="button"
          >
            <span className="font-semibold">{tab.label}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{tab.description}</span>
          </button>
        );
      })}
    </div>
  );
}

function DemoShotsTable({ project }) {
  const {
    currentProjectId,
    currentShots,
    productsById,
    talentById,
    locationsById,
    updateShot,
    reorderShots,
    addShot,
  } = useDemoData();

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

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Shots — {project?.name || "Select a project"}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Update statuses, reorder, and add new shots. Everything persists only in memory here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
            {rows.length} shots
          </Badge>
          <Button
            type="button"
            size="sm"
            onClick={() => addShot(currentProjectId, { name: "New storyboard idea" })}
          >
            <Plus className="h-4 w-4" />
            Add sample shot
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">#</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Shot</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Status</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Date</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Location</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Products</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Talent</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Tags</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900/40">
            {rows.map((shot) => (
              <tr key={shot.id} className="align-top">
                <td className="px-3 py-3 text-xs font-mono text-slate-500 dark:text-slate-400">{shot.shotNumber}</td>
                <td className="px-3 py-3">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-20 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                      {shot.coverUrl ? (
                        <img
                          src={shot.coverUrl}
                          alt={shot.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                          No image
                        </div>
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
                    onChange={(e) => updateShot(currentProjectId, shot.id, { status: e.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {shotStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-3">
                  <div className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {shot.date || "—"}
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-200">
                  {shot.locationName || "—"}
                </td>
                <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-200">
                  {shot.productNames.length ? shot.productNames.join(", ") : "—"}
                </td>
                <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-200">
                  {shot.talentNames.length ? shot.talentNames.join(", ") : "—"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(shot.tags || []).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {tag.label}
                      </Badge>
                    ))}
                    {(!shot.tags || !shot.tags.length) && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => reorderShots(currentProjectId, shot.index, Math.max(0, shot.index - 1))}
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
                        reorderShots(
                          currentProjectId,
                          shot.index,
                          Math.min(rows.length - 1, shot.index + 1)
                        )
                      }
                      disabled={shot.index === rows.length - 1}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
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
    </div>
  );
}

function DemoProducts() {
  const { products } = useDemoData();

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Product catalog</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            These cards mirror the product library UI — images and tags are safe samples.
          </p>
        </div>
        <Badge variant="secondary" className="bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
          {products.length} products
        </Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="h-full">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{product.name}</div>
                <StatusBadge status="active">Sample</StatusBadge>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{product.category}</div>
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DemoLibrary() {
  const { talent, locations } = useDemoData();

  return (
    <div className="grid gap-4 p-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Talent</div>
              <p className="text-xs text-slate-500 dark:text-slate-300">Sample roster with tags and pronouns.</p>
            </div>
            <Badge variant="secondary" className="bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
              {talent.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {talent.map((person) => (
            <div
              key={person.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/50"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-50">{person.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {person.role} · {person.pronouns}
                  </div>
                </div>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100">
                  Demo
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(person.tags || []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Locations</div>
              <p className="text-xs text-slate-500 dark:text-slate-300">Loft, rooftop, and studio examples.</p>
            </div>
            <Badge variant="secondary" className="bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
              {locations.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/50"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-50">{loc.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {loc.type} · {loc.address}
                  </div>
                </div>
                <StatusBadge status="active">Sample</StatusBadge>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{loc.notes}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function DemoPulls() {
  const { pulls, productsById, togglePullSharing } = useDemoData();

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Pull sheets</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            These pulls are demo-only. Toggling share never touches production functions.
          </p>
        </div>
        <Badge variant="secondary" className="bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
          {pulls.length} pulls
        </Badge>
      </div>
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
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">Share link stub</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      /pulls/shared/{pull.shareToken || "demo-token"}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => togglePullSharing(pull.id)}
                >
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

function DemoActivityFeed() {
  const { activities } = useDemoData();

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Recent activity</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Timeline is seeded for the agent — entries never call Firestore.
          </p>
        </div>
        <Badge variant="secondary" className="bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
          {activities.length}
        </Badge>
      </div>
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
