/**
 * ProductDetailPageV3 - Product Workspace Shell
 *
 * DESIGN PHILOSOPHY
 * =================
 * This page transforms the product detail view into a workspace-style experience.
 * Instead of vertical stacking, users navigate between sections via a persistent
 * left rail, with the main panel switching between views.
 *
 * KEY CHANGES FROM V2:
 * 1. Persistent left nav for sections (Overview, Colorways, Samples, Assets, Activity)
 * 2. Main panel switches based on selected section
 * 3. Colorway selection persists across section switches
 * 4. Samples section is primary (not nested in cockpit)
 * 5. Cockpit only appears in Colorways section when colorway selected
 *
 * LAYOUT:
 * - Top: Condensed identity hero (image, name, style, metadata)
 * - Below: 2-column workspace
 *   - LEFT RAIL (sticky): Section navigation with count badges
 *   - MAIN CONTENT: Section-specific content
 *
 * FLAG: productsV3 (enable via ?productsV3=1)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { productFamilyPath, productFamilySkusPath } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { isDemoModeActive } from "../lib/flags";
import { Button } from "../components/ui/button";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import ErrorBoundary from "../components/ErrorBoundary";
import AppImage from "../components/common/AppImage";
import {
  ArrowLeft,
  Edit3,
  Package,
  Palette,
  Box,
  FileText,
  Activity,
  Clock,
  Plus,
  User,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { genderLabel } from "../lib/productMutations";
import { useUsers } from "../hooks/useComments";
import { getCategoryLabel } from "../lib/productCategories";

// Workspace components
import {
  WorkspaceContext,
  WorkspaceRail,
  SamplesSection,
  ColorwaysSection,
  WorkspaceEmptyState,
  SectionHeader,
  BentoCard,
  computeSampleMetrics,
  computeColorwayMetrics,
  SECTION_DESCRIPTIONS,
} from "../components/products/workspace";

// ============================================================================
// OVERVIEW SECTION - Bento Dashboard
// ============================================================================

function OverviewSection({ family, skus, samples, onNavigate }) {
  // Compute metrics for each section
  const colorwayMetrics = useMemo(() => computeColorwayMetrics(skus), [skus]);
  const sampleMetrics = useMemo(() => computeSampleMetrics(samples), [samples]);

  // Compute activity count from audit fields
  const activityMetrics = useMemo(() => {
    let count = 0;

    // Count creation event
    if (family?.createdAt) {
      count += 1;
    }

    // Count update event if meaningfully different from creation (> 60 seconds)
    if (family?.updatedAt && family?.createdAt) {
      const createdTime = family.createdAt?.toDate?.() || family.createdAt;
      const updatedTime = family.updatedAt?.toDate?.() || family.updatedAt;
      const timeDiff = Math.abs(
        new Date(updatedTime).getTime() - new Date(createdTime).getTime()
      );
      if (timeDiff > 60000) {
        count += 1;
      }
    }

    return {
      total: count,
      subMetrics: count > 1 ? [{ value: 1, label: "recent", variant: "info" }] : [],
    };
  }, [family]);

  // Size label for quick info
  const sizeLabel = useMemo(() => {
    if (family.sizes?.length > 0) return family.sizes.join(", ");
    if (family.sizeOptions?.length > 0) return family.sizeOptions.join(", ");
    return "Not specified";
  }, [family]);

  return (
    <div className="p-6 space-y-6">
      {/* Quick stats bar - compact product identity recap */}
      <div className="flex flex-wrap items-center gap-6 py-3 px-4 rounded-lg bg-slate-50/80 dark:bg-slate-800/50">
        <div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Status</p>
          {family.status === "discontinued" ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Discontinued
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Active
            </span>
          )}
        </div>
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
        <div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Sizes</p>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{sizeLabel}</p>
        </div>
        {family.notes && (
          <>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Notes</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{family.notes}</p>
            </div>
          </>
        )}
      </div>

      {/* Section title */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Explore Sections</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Dive into colorways, samples, assets, and activity for this product
        </p>
      </div>

      {/* Bento grid of section cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Colorways card */}
        <BentoCard
          icon={Palette}
          title="Colorways"
          description={SECTION_DESCRIPTIONS.colorways}
          metric={colorwayMetrics.total}
          metricLabel={colorwayMetrics.total === 1 ? "colorway" : "colorways"}
          subMetrics={colorwayMetrics.subMetrics}
          onClick={() => onNavigate("colorways")}
        />

        {/* Samples card */}
        <BentoCard
          icon={Box}
          title="Samples"
          description={SECTION_DESCRIPTIONS.samples}
          metric={sampleMetrics.total}
          metricLabel={sampleMetrics.total === 1 ? "sample" : "samples"}
          subMetrics={sampleMetrics.subMetrics}
          onClick={() => onNavigate("samples")}
        />

        {/* Assets card - coming soon */}
        <BentoCard
          icon={FileText}
          title="Assets"
          description={SECTION_DESCRIPTIONS.assets}
          variant="coming-soon"
          onClick={() => onNavigate("assets")}
        />

        {/* Activity card */}
        <BentoCard
          icon={Activity}
          title="Activity"
          description={SECTION_DESCRIPTIONS.activity}
          metric={activityMetrics.total}
          metricLabel={activityMetrics.total === 1 ? "event" : "events"}
          subMetrics={activityMetrics.subMetrics}
          onClick={() => onNavigate("activity")}
        />
      </div>
    </div>
  );
}

// ============================================================================
// ASSETS & ACTIVITY SECTIONS (Coming Soon)
// ============================================================================

function AssetsSection() {
  return (
    <div className="p-6">
      <SectionHeader title="Assets" className="px-0 border-0 pb-4" />
      <WorkspaceEmptyState
        icon={FileText}
        title="Documents & Files"
        description="Upload tech packs, material specifications, reference images, and other product documents."
        actionLabel="Upload file"
      />
    </div>
  );
}

/**
 * Format a timestamp to a relative string (e.g., "5 minutes ago")
 * Handles Firestore Timestamps, Date objects, and numeric timestamps
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return null;

  try {
    // Handle Firestore Timestamp objects
    const date =
      timestamp?.toDate?.() ||
      (timestamp instanceof Date ? timestamp : new Date(timestamp));

    // Validate the date is valid
    if (isNaN(date.getTime())) return null;

    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return null;
  }
}

/**
 * Format a timestamp to an absolute date string (e.g., "Jan 15, 2025")
 */
function formatAbsoluteDate(timestamp) {
  if (!timestamp) return null;

  try {
    const date =
      timestamp?.toDate?.() ||
      (timestamp instanceof Date ? timestamp : new Date(timestamp));

    if (isNaN(date.getTime())) return null;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

/**
 * Activity Section - Read-only timeline of product changes
 *
 * Shows real audit data from the product document:
 * - When the product was created (createdAt, createdBy)
 * - When it was last modified (updatedAt, updatedBy)
 *
 * Uses existing document-level fields per v3.1 guidance - no new schema.
 */
function ActivitySection({ family, clientId }) {
  // Fetch users to resolve createdBy/updatedBy IDs to names
  const { data: users = [] } = useUsers(clientId);

  // Resolve a user ID to their display name
  const getUserName = useCallback(
    (userId) => {
      if (!userId) return null;
      const user = users.find((u) => u.id === userId);
      return user?.displayName || user?.email || null;
    },
    [users]
  );

  // Build activity events from product audit fields
  const activityEvents = useMemo(() => {
    const events = [];

    // Product creation event
    if (family?.createdAt) {
      events.push({
        id: "created",
        type: "created",
        label: "Product created",
        timestamp: family.createdAt,
        actorId: family.createdBy,
        icon: Plus,
      });
    }

    // Product updated event (only if different from creation)
    if (family?.updatedAt) {
      const createdTime = family.createdAt?.toDate?.() || family.createdAt;
      const updatedTime = family.updatedAt?.toDate?.() || family.updatedAt;

      // Only show update if it's meaningfully different from creation (> 60 seconds)
      const timeDiff = Math.abs(
        new Date(updatedTime).getTime() - new Date(createdTime).getTime()
      );

      if (timeDiff > 60000) {
        events.push({
          id: "updated",
          type: "updated",
          label: "Product updated",
          timestamp: family.updatedAt,
          actorId: family.updatedBy,
          icon: Clock,
        });
      }
    }

    // Sort by timestamp descending (most recent first)
    events.sort((a, b) => {
      const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp);
      const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp);
      return timeB.getTime() - timeA.getTime();
    });

    return events;
  }, [family]);

  return (
    <div className="p-6">
      <SectionHeader title="Activity" className="px-0 border-0 pb-4" />

      {activityEvents.length === 0 ? (
        // Empty state - no activity yet
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
              <Activity className="w-6 h-6 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              No activity yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              Activity will appear here when the product is created or updated.
            </p>
          </div>
        </div>
      ) : (
        // Activity timeline
        <div className="space-y-1">
          {activityEvents.map((event, index) => {
            const Icon = event.icon;
            const actorName = getUserName(event.actorId);
            const relativeTime = formatTimestamp(event.timestamp);
            const absoluteDate = formatAbsoluteDate(event.timestamp);
            const isLast = index === activityEvents.length - 1;

            return (
              <div key={event.id} className="relative flex gap-3">
                {/* Timeline connector */}
                {!isLast && (
                  <div
                    className="absolute left-[15px] top-8 w-px h-[calc(100%-8px)] bg-slate-200 dark:bg-slate-700"
                    aria-hidden="true"
                  />
                )}

                {/* Event icon */}
                <div className="relative flex-shrink-0">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      ${
                        event.type === "created"
                          ? "bg-emerald-50 dark:bg-emerald-900/20"
                          : "bg-slate-100 dark:bg-slate-700"
                      }
                    `}
                  >
                    <Icon
                      className={`
                        w-4 h-4
                        ${
                          event.type === "created"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-500 dark:text-slate-400"
                        }
                      `}
                    />
                  </div>
                </div>

                {/* Event content */}
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-900 dark:text-slate-100">
                        <span className="font-medium">{event.label}</span>
                        {actorName && (
                          <span className="text-slate-500 dark:text-slate-400">
                            {" "}by{" "}
                            <span className="text-slate-700 dark:text-slate-300">
                              {actorName}
                            </span>
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Timestamp */}
                    {relativeTime && (
                      <span
                        className="flex-shrink-0 text-xs text-slate-400 dark:text-slate-500"
                        title={absoluteDate || undefined}
                      >
                        {relativeTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Context footer */}
      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Activity shows when this product was created and last modified.
          Detailed change history will be available in a future update.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function ProductDetailPageV3() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clientId } = useAuth();

  // ══════════════════════════════════════════════════════════════════════════
  // RETURN TO CONTEXT (P.3 - same pattern as J.6)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Parse returnTo query param and derive navigation target
   *
   * SUPPORTED FORMATS:
   * 1) returnTo=<encoded path starting with "/"> → decode and navigate (internal only)
   *
   * SECURITY: Only allow navigation to internal paths (must start with "/")
   */
  const returnToContext = useMemo(() => {
    const returnTo = searchParams.get("returnTo");
    if (!returnTo) return null;

    // Encoded path format (must start with "/")
    try {
      const decodedPath = decodeURIComponent(returnTo);
      // Security: only allow internal paths starting with "/"
      // Must not contain protocol or external URLs
      if (
        decodedPath.startsWith("/") &&
        !decodedPath.includes("://") &&
        !decodedPath.startsWith("//")
      ) {
        // Derive a simple label from the path
        const pathSegments = decodedPath.split("/").filter(Boolean);
        const lastSegment = pathSegments[pathSegments.length - 1] || "previous page";
        const label = `Return to ${lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/[?#].*$/, "")}`;
        return {
          label,
          path: decodedPath,
        };
      }
    } catch {
      // Invalid encoded string - ignore silently
    }

    // Unrecognized format - do nothing
    return null;
  }, [searchParams]);

  // Data state
  const [family, setFamily] = useState(null);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Workspace state
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedColorwayId, setSelectedColorwayId] = useState(null);

  // Fetch product data
  useEffect(() => {
    if (!clientId || !productId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const familyRef = doc(db, ...productFamilyPath(productId, clientId));
        const familySnap = await getDoc(familyRef);

        if (!isMounted) return;

        if (!familySnap.exists()) {
          setError("Product not found");
          setLoading(false);
          return;
        }

        const familyData = { id: familySnap.id, ...familySnap.data() };
        setFamily(familyData);

        const skusRef = collection(db, ...productFamilySkusPath(productId, clientId));
        const skusQuery = query(skusRef, orderBy("colorName", "asc"));
        const skusSnap = await getDocs(skusQuery);

        if (!isMounted) return;

        const skusData = skusSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((sku) => !sku.deleted);
        setSkus(skusData);
      } catch (err) {
        if (!isMounted) return;
        console.error("[ProductDetailPageV3] Fetch error:", err);
        setError("Failed to load product details");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [clientId, productId]);

  // Demo samples data - only shown in demo mode to demonstrate the UI
  // TODO: Replace with real Firestore integration for samples collection
  const demoSamples = useMemo(() => {
    // Only provide demo data in demo mode
    if (!isDemoModeActive()) return [];
    if (skus.length === 0) return [];
    return [
      { id: "sample-001", label: "Shoot Sample A", type: "Shoot sample", sizeRun: ["S", "M", "L"], status: "arrived", carrier: "FedEx", tracking: "7489201234567890", eta: "Jan 15, 2025", arrivedAt: "Jan 14, 2025", notes: "Primary hero colorway for campaign shoot", scopeSkuId: skus[0]?.id },
      { id: "sample-002", label: "Shoot Sample B", type: "Shoot sample", sizeRun: ["M"], status: "in_transit", carrier: "UPS", tracking: "1Z999AA10123456784", eta: "Jan 20, 2025", arrivedAt: null, notes: "Backup for flat lay shots", scopeSkuId: skus[0]?.id },
      { id: "sample-003", label: "PP Sample 1", type: "Pre-production", sizeRun: ["S", "M", "L", "XL"], status: "requested", carrier: null, tracking: null, eta: "Jan 28, 2025", arrivedAt: null, notes: "Initial pre-production run for fit review", scopeSkuId: skus[1]?.id || skus[0]?.id },
      { id: "sample-004", label: "PP Sample 2", type: "Pre-production", sizeRun: ["M", "L"], status: "in_transit", carrier: "DHL", tracking: "1234567890", eta: "Jan 22, 2025", arrivedAt: null, notes: "Second colorway pre-production", scopeSkuId: skus[2]?.id || skus[0]?.id },
      { id: "sample-005", label: "Bulk Ref 1", type: "Bulk ref", sizeRun: ["M"], status: "arrived", carrier: "FedEx", tracking: "7489207777777777", eta: "Jan 10, 2025", arrivedAt: "Jan 9, 2025", notes: "Reference for color matching during bulk production", scopeSkuId: skus[0]?.id },
      { id: "sample-006", label: "Shoot Sample C", type: "Shoot sample", sizeRun: ["XS", "S"], status: "issue", carrier: "USPS", tracking: "9400111899223100001234", eta: "Jan 12, 2025", arrivedAt: null, notes: "Wrong color shipped - needs replacement", scopeSkuId: skus[1]?.id || skus[0]?.id },
      { id: "sample-007", label: "Bulk Ref 2", type: "Bulk ref", sizeRun: ["L", "XL"], status: "returned", carrier: "UPS", tracking: "1Z999AA10987654321", eta: null, arrivedAt: "Dec 20, 2024", notes: "Returned to factory after review", scopeSkuId: skus[0]?.id },
      { id: "sample-008", label: "PP Sample 3", type: "Pre-production", sizeRun: ["S"], status: "requested", carrier: null, tracking: null, eta: "Feb 1, 2025", arrivedAt: null, notes: null, scopeSkuId: skus[0]?.id },
    ];
  }, [skus]);

  // Computed values
  const displayImage = useMemo(() => {
    return family?.thumbnailImagePath || family?.headerImagePath || null;
  }, [family]);

  const categoryLabel = useMemo(() => {
    if (!family) return null;
    return getCategoryLabel(family.gender, family.productType, family.productSubcategory);
  }, [family]);

  // Counts for nav badges
  const counts = useMemo(() => {
    // Compute activity count from audit fields
    let activityCount = 0;
    if (family?.createdAt) {
      activityCount += 1;
    }
    if (family?.updatedAt && family?.createdAt) {
      const createdTime = family.createdAt?.toDate?.() || family.createdAt;
      const updatedTime = family.updatedAt?.toDate?.() || family.updatedAt;
      const timeDiff = Math.abs(
        new Date(updatedTime).getTime() - new Date(createdTime).getTime()
      );
      if (timeDiff > 60000) {
        activityCount += 1;
      }
    }

    return {
      colorways: skus.length,
      samples: demoSamples.length,
      assets: 0,
      activity: activityCount,
    };
  }, [skus.length, demoSamples.length, family?.createdAt, family?.updatedAt]);

  const handleBack = useCallback(() => {
    navigate("/products");
  }, [navigate]);

  /**
   * Handle "Return to" navigation (P.3)
   * Navigates to the path specified in returnToContext
   */
  const handleReturnTo = useCallback(() => {
    if (returnToContext?.path) {
      navigate(returnToContext.path);
    }
  }, [returnToContext, navigate]);

  // Workspace context value
  const workspaceValue = useMemo(() => ({
    activeSection,
    setActiveSection,
    selectedColorwayId,
    setSelectedColorwayId,
  }), [activeSection, selectedColorwayId]);

  // Guard: Redirect if no clientId
  if (!clientId) {
    return <Navigate to="/products" replace />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading product details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center max-w-md">
          <Package className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{error}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            The product you're looking for may have been moved or deleted.
          </p>
          <Button onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  if (!family) return null;

  return (
    <WorkspaceContext.Provider value={workspaceValue}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        {/* Navigation bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
          <div className="px-6 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Products
                </Button>

                {/* Return to affordance (P.3) - shown when returnTo query param is present */}
                {returnToContext && (
                  <button
                    type="button"
                    onClick={handleReturnTo}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    title={returnToContext.label}
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span className="max-w-[120px] truncate">{returnToContext.label}</span>
                  </button>
                )}
              </div>

              <Button variant="outline" size="sm" disabled title="Edit mode coming soon">
                <Edit3 className="w-4 h-4 mr-1.5" />
                Edit
              </Button>
            </div>
          </div>
        </header>

        {/* Condensed identity hero */}
        <section className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="px-6 py-3">
            <div className="flex items-center gap-4">
              {/* Smaller thumbnail */}
              <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 shadow-sm">
                {displayImage ? (
                  <AppImage src={displayImage} alt={family.styleName} preferredSize={112} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  </div>
                )}
              </div>

              {/* Identity content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {family.styleName}
                  </h1>
                  {family.status === "discontinued" ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Discontinued
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Active
                    </span>
                  )}
                </div>

                {/* Metadata strip */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {family.styleNumber && <span>Style #{family.styleNumber}</span>}
                  {genderLabel(family.gender) && (
                    <>
                      {family.styleNumber && <span className="text-slate-300 dark:text-slate-600">·</span>}
                      <span>{genderLabel(family.gender)}</span>
                    </>
                  )}
                  {categoryLabel && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span>{categoryLabel}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Workspace: Nav rail + Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left rail */}
          <WorkspaceRail
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            counts={counts}
          />

          {/* Main content area */}
          <main className="flex-1 overflow-auto bg-white dark:bg-slate-800">
            <ErrorBoundary>
              {activeSection === "overview" && (
                <OverviewSection family={family} skus={skus} samples={demoSamples} onNavigate={setActiveSection} />
              )}
              {activeSection === "colorways" && (
                <ColorwaysSection family={family} skus={skus} samples={demoSamples} />
              )}
              {activeSection === "samples" && (
                <SamplesSection family={family} skus={skus} samples={demoSamples} />
              )}
              {activeSection === "assets" && <AssetsSection />}
              {activeSection === "activity" && (
                <ActivitySection family={family} clientId={clientId} />
              )}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
