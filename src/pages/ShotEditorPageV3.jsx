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
import { doc, onSnapshot, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { shotsPath, productFamilySkusPath } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../hooks/useFirestoreQuery";
import { FLAGS } from "../lib/flags";
import { Button } from "../components/ui/button";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import {
  ArrowLeft,
  MapPin,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ShotEditorHeaderBandV3, ShotContextDock, ShotNotesCanvas, ShotLooksCanvas } from "../components/shots/workspace";

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
 */
function LogisticsPlaceholder() {
  return (
    <div className="space-y-2 py-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Location, schedule, and crew notes
      </p>
      <div className="text-xs text-slate-400 dark:text-slate-500 italic">
        Coming soon
      </div>
    </div>
  );
}

/**
 * TalentPlaceholder - Collapsed group content for talent
 */
function TalentPlaceholder() {
  return (
    <div className="space-y-2 py-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Cast assignments and wardrobe notes
      </p>
      <div className="text-xs text-slate-400 dark:text-slate-500 italic">
        Coming soon
      </div>
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
  const familyDetailCacheRef = useRef(new Map());

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
        setShot({ id: snapshot.id, ...snapshot.data() });
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
    return {
      products: shot.products?.length || 0,
      talent: shot.talent?.length || 0,
      references: shot.referenceImages?.length || 0,
      tags: shot.tags?.length || 0,
    };
  }, [shot]);

  // ══════════════════════════════════════════════════════════════════════════
  // GUARDS
  // ══════════════════════════════════════════════════════════════════════════

  // Guard: Redirect if flag disabled
  if (!FLAGS.shotEditorV3) {
    return <Navigate to={`/projects/${projectId}/shots`} replace />;
  }

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
        <ShotContextDock shot={shot} counts={counts} />

        {/* ──────────────────────────────────────────────────────────
            SHOT CANVAS
            Primary authoring surface - calm, wide, focused.
            No explicit section cards - use spacing and typography.
            ────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto bg-white dark:bg-slate-800">
          <div className="max-w-3xl mx-auto px-8 py-8 space-y-8">
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

            <CollapsibleGroup
              icon={Users}
              label="Talent"
              defaultCollapsed
            >
              <TalentPlaceholder />
            </CollapsibleGroup>

            {/* Bottom spacer */}
            <div className="h-16" />
          </div>
        </main>
      </div>
    </div>
  );
}
