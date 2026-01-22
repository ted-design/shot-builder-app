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
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { productFamilyPath, productFamilySkusPath } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import AppImage from "../components/common/AppImage";
import {
  ArrowLeft,
  Edit3,
  Package,
  Palette,
  Box,
  FileText,
  Activity,
} from "lucide-react";
import { genderLabel } from "../lib/productMutations";
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

        {/* Activity card - coming soon */}
        <BentoCard
          icon={Activity}
          title="Activity"
          description={SECTION_DESCRIPTIONS.activity}
          variant="coming-soon"
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

function ActivitySection() {
  return (
    <div className="p-6">
      <SectionHeader title="Activity" className="px-0 border-0 pb-4" />
      <WorkspaceEmptyState
        icon={Activity}
        title="Activity Timeline"
        description="Track changes, comments, decisions, and team activity on this product."
        actionLabel="Add note"
      />
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function ProductDetailPageV3() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { clientId } = useAuth();

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

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const familyRef = doc(db, ...productFamilyPath(productId, clientId));
        const familySnap = await getDoc(familyRef);

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
        const skusData = skusSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((sku) => !sku.deleted);
        setSkus(skusData);
      } catch (err) {
        console.error("[ProductDetailPageV3] Fetch error:", err);
        setError("Failed to load product details");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [clientId, productId]);

  // Mock samples data
  const mockSamples = useMemo(() => {
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
  const counts = useMemo(() => ({
    colorways: skus.length,
    samples: mockSamples.length,
    assets: 0,
    activity: 0,
  }), [skus.length, mockSamples.length]);

  const handleBack = useCallback(() => {
    navigate("/products");
  }, [navigate]);

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
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Products
              </Button>

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
            {activeSection === "overview" && (
              <OverviewSection family={family} skus={skus} samples={mockSamples} onNavigate={setActiveSection} />
            )}
            {activeSection === "colorways" && (
              <ColorwaysSection family={family} skus={skus} samples={mockSamples} />
            )}
            {activeSection === "samples" && (
              <SamplesSection family={family} skus={skus} samples={mockSamples} />
            )}
            {activeSection === "assets" && <AssetsSection />}
            {activeSection === "activity" && <ActivitySection />}
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
