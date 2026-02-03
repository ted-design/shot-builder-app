/**
 * ShotEditorPageV3 - Canvas + Left Context Dock Layout
 *
 * DESIGN PHILOSOPHY
 * =================
 * This page uses the same spatial language as ProductDetailPageV3:
 * - LEFT context dock: orientation, status, metadata, activity
 * - CENTER canvas: primary authored work surface
 *
 * NO new navigation paradigms - this is NOT a scroll-based TOC.
 * The dock provides context while the canvas is the authoring focus.
 *
 * LAYOUT:
 * - TOP: Sticky header band (ShotEditorHeaderBandV3)
 * - LEFT: Context dock (status, products, tags, activity)
 * - CENTER: Shot canvas (notes, looks, collapsed groups)
 *
 * FLAG: shotEditorV3 (enable via flag or route)
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Navigate, useParams, useNavigate, useSearchParams } from "react-router-dom";
import ShotReaderView from "../components/shots/ShotReaderView";
import { useIsMobile } from "../hooks/useIsMobile";
import { doc, onSnapshot, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { shotsPath, productFamilySkusPath } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { useProducts, useTalent, useLocations } from "../hooks/useFirestoreQuery";
import { FLAGS } from "../lib/flags";
import { Button } from "../components/ui/button";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import {
  ArrowLeft,
  MapPin,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ShotEditorHeaderBandV3, ShotContextDock, ShotHeroImage, ShotNotesCanvas, ShotLooksCanvas, ShotAssetsSection } from "../components/shots/workspace";
import CommentSection from "../components/comments/CommentSection";

// ============================================================================
// CANVAS SURFACE COMPONENTS
// ============================================================================

/**
 * CollapsibleGroup - Minimal collapsible group for secondary content
 */
function CollapsibleGroup({ icon: Icon, label, children, defaultCollapsed = true }) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <section className="border-t border-slate-100 dark:border-slate-700/50 pt-4">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
        )}
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
          {label}
        </span>
      </button>
      {!isCollapsed && (
        <div className="mt-3 ml-6 pl-4 border-l-2 border-slate-100 dark:border-slate-700/50">
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * LogisticsPlaceholder - Collapsed group content for logistics
 * Per design-spec.md: "If not ready, hide or label as 'Planned'"
 */
function LogisticsPlaceholder() {
  return (
    <div className="space-y-2 py-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Location, schedule, and crew notes
      </p>
      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        Planned
      </span>
    </div>
  );
}


// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function ShotEditorPageV3() {
  const { projectId, shotId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const clientId = auth?.clientId;
  const isMobile = useIsMobile();

  // Read-only mode detection via URL param (?readonly=1)
  const isReadOnly = searchParams.get("readonly") === "1";

  const [shot, setShot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ══════════════════════════════════════════════════════════════════════════
  // PRODUCT DATA (for Looks Canvas)
  // Reuses same pattern as ShotsPage.jsx
  // ══════════════════════════════════════════════════════════════════════════

  const { data: families = [] } = useProducts(clientId);

  // Match ShotsPage.jsx pattern: respect FLAGS.projectScopedAssets for talent/location scope
  const assetQueryOptions = FLAGS.projectScopedAssets
    ? { projectId, scope: "project" }
    : {};
  const { data: talent = [] } = useTalent(clientId, assetQueryOptions);
  const { data: locations = [], isLoading: locationsLoading } = useLocations(clientId, assetQueryOptions);

  const familyDetailCacheRef = useRef(new Map());

  // Transform talent records to options format (same pattern as ShotsPage.jsx)
  const talentOptions = useMemo(
    () =>
      talent.map((entry) => {
        const name =
          entry.name ||
          [entry.firstName, entry.lastName].filter(Boolean).join(" ").trim() ||
          "Unnamed talent";
        return { talentId: entry.id, name, headshotPath: entry.headshotPath || entry.photoPath || null };
      }),
    [talent]
  );

  // Transform location records to options format (same shape expected by LocationSelect)
  const locationOptions = useMemo(
    () =>
      locations.map((loc) => ({
        id: loc.id,
        name: loc.name || "Unnamed location",
        photoPath: loc.photoPath || null,
      })),
    [locations]
  );

  // Load family details (colours/SKUs) for product selector
  // Pattern reused from ShotsPage.jsx:1217-1235
  const loadFamilyDetails = useCallback(
    async (familyId) => {
      if (familyDetailCacheRef.current.has(familyId)) {
        return familyDetailCacheRef.current.get(familyId);
      }

      const skusPath = productFamilySkusPath(familyId, clientId);
      const snapshot = await getDocs(
        query(collection(db, ...skusPath), orderBy("colorName", "asc"))
      );
      const colours = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

      const details = {
        colours,
        sizes: families.find((family) => family.id === familyId)?.sizes || [],
      };

      familyDetailCacheRef.current.set(familyId, details);
      return details;
    },
    [families, clientId]
  );

  // Clear family detail cache when families data changes to prevent memory leak
  // (cache could grow unbounded if families are added/removed over time)
  useEffect(() => {
    familyDetailCacheRef.current.clear();
  }, [families]);

  // Fetch shot data with real-time subscription
  useEffect(() => {
    if (!clientId || !shotId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const shotRef = doc(db, ...shotsPath(clientId), shotId);

    const unsubscribe = onSnapshot(
      shotRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setError("Shot not found");
          setLoading(false);
          return;
        }
        const data = snapshot.data();
        // Check if shot was soft-deleted (deleted: true)
        // Deleted shots should not be accessible via direct URL
        if (data.deleted === true) {
          setError("This shot was deleted");
          setLoading(false);
          return;
        }
        setShot({ id: snapshot.id, ...data });
        setLoading(false);
      },
      (err) => {
        console.error("[ShotEditorPageV3] Error:", err);
        setError("Failed to load shot");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [clientId, shotId]);

  // Compute counts for context dock
  const counts = useMemo(() => {
    if (!shot) return {};
    // References are stored per-look in shot.looks[].references[] (F.1 schema)
    const referencesCount = (shot.looks || []).reduce(
      (sum, look) => sum + (look.references?.length || 0),
      0
    );
    return {
      products: shot.products?.length || 0,
      talent: shot.talent?.length || 0,
      references: referencesCount,
      tags: shot.tags?.length || 0,
    };
  }, [shot]);

  // ══════════════════════════════════════════════════════════════════════════
  // GUARDS
  // ══════════════════════════════════════════════════════════════════════════

  // Note: V3 is now the default editor (Delta I.8 cutover).
  // The flag guard was removed since FLAGS.shotEditorV3 is always true.
  // For emergency rollback, use ?legacyShotEditor=1 query param in ShotsPage.

  // Guard: No client
  if (!clientId) {
    return <Navigate to="/projects" replace />;
  }

  // Navigation handler for error state
  const handleBack = () => {
    navigate(`/projects/${projectId}/shots`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading shot...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <span className="text-2xl">!</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{error}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            The shot you&apos;re looking for may have been moved or deleted.
          </p>
          <Button onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Shots
          </Button>
        </div>
      </div>
    );
  }

  if (!shot) return null;

  // Mobile: render read-only detail view instead of full editor
  if (isMobile) {
    return <ShotReaderView shot={shot} counts={counts} readOnly={isReadOnly} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* ================================================================
          STICKY HEADER BAND
          ================================================================ */}
      <ShotEditorHeaderBandV3 shot={shot} projectId={projectId} readOnly={isReadOnly} />

      {/* ================================================================
          TWO-COLUMN WORKSPACE
          Matches ProductDetailPageV3 spatial pattern:
          - LEFT: Context dock (orientation, status, metadata)
          - CENTER: Canvas (primary authoring surface)
          ================================================================ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ──────────────────────────────────────────────────────────
            LEFT CONTEXT DOCK
            Provides orientation and context without acting as navigation.
            Matches Products V3 left rail positioning.
            ────────────────────────────────────────────────────────── */}
        <ShotContextDock
          shot={shot}
          counts={counts}
          locationOptions={locationOptions}
        />

        {/* ──────────────────────────────────────────────────────────
            SHOT CANVAS
            Primary authoring surface - calm, wide, focused.
            No explicit section cards - use spacing and typography.
            ────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto bg-white dark:bg-slate-800">
          <div className="max-w-3xl mx-auto px-8 py-8 space-y-8">
            <ShotHeroImage shot={shot} />

            {/* Primary canvas: Shot Notes */}
            <ShotNotesCanvas shot={shot} readOnly={isReadOnly} />

            {/* Visual canvas: Looks */}
            <ShotLooksCanvas
              shot={shot}
              families={families}
              loadFamilyDetails={loadFamilyDetails}
              readOnly={isReadOnly}
            />

            {/* Collapsed groups for secondary content */}
            <CollapsibleGroup
              icon={MapPin}
              label="Logistics"
              defaultCollapsed
            >
              <LogisticsPlaceholder />
            </CollapsibleGroup>

            {/* Assets Section - Editable Talent, Location, Tags */}
            <ShotAssetsSection
              shot={shot}
              talentOptions={talentOptions}
              locationOptions={locationOptions}
              readOnly={isReadOnly}
            />

            {/* Comments Section - Collaboration surface */}
            <section className="border-t border-slate-100 dark:border-slate-700/50 pt-6">
              <CommentSection
                clientId={clientId}
                shotId={shotId}
                shotName={shot.name}
              />
            </section>

            {/* Bottom spacer */}
            <div className="h-16" />
          </div>
        </main>
      </div>
    </div>
  );
}
