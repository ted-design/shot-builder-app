/**
 * ShotProductSelectorModal - Product selection modal with compact table/list layout
 *
 * Features:
 * - Compact table rows with tiny thumbnails, full product names
 * - Consistent color swatches (solid hex + optional swatch image)
 * - Compact size trigger with icon
 * - Multi-product selection
 * - No sidebar - footer shows count + submit
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Fuse from "fuse.js";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import AppImage from "../common/AppImage";
import NewProductModal from "../products/NewProductModal";
import {
  getAllTypes,
  getSubcategoriesForTypeUnion,
  getTypesForGender,
  getSubcategoriesForType,
} from "../../lib/productCategories";
import {
  Search,
  X,
  Plus,
  Check,
  Maximize2,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import SourceAllocationSelector, { generateMockSupplyRecords, AllocationStatusBadge } from "./SourceAllocationSelector";

const ALL_SIZES_VALUE = "__ALL_SIZES__";
const MAX_VISIBLE_SWATCHES = 4;

// ============================================================================
// ProductSelectorRow - Table row with inline color/size selection
// ============================================================================

function ProductSelectorRow({
  family,
  familyDetails,
  isLoadingDetails,
  selectedColorIndex,
  onColorSelect,
  onAdd,
  cartCount,
}) {
  const [selectedSize, setSelectedSize] = useState("");
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  // Track if user wants specific supply (triggers size requirement)
  const [wantsSpecificSupply, setWantsSpecificSupply] = useState(false);
  const sizeDropdownRef = useRef(null);

  const colours = useMemo(() => {
    if (!familyDetails?.colours) return [];
    return familyDetails.colours.filter((c) => c.status !== "archived");
  }, [familyDetails]);

  const currentColor = colours[selectedColorIndex] || colours[0] || null;

  // Get image for current color, fallback to family thumbnail
  const displayImage = currentColor?.imagePath || family.thumbnailImagePath || family.headerImagePath;

  // Get available sizes (canonical family sizes)
  const sizes = useMemo(() => {
    if (currentColor?.sizes?.length > 0) return currentColor.sizes;
    if (familyDetails?.sizes?.length > 0) return familyDetails.sizes;
    return family.sizes || family.sizeOptions || [];
  }, [currentColor, familyDetails, family]);

  // Generate mock supply sources for this colorway (for workflow validation)
  // Only generate mock data in development mode - production requires real data
  const supplySources = useMemo(() => {
    if (!currentColor?.id) return [];
    if (!import.meta.env.DEV) return [];
    return generateMockSupplyRecords(currentColor.id, sizes);
  }, [currentColor?.id, sizes]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(e.target)) {
        setShowSizeDropdown(false);
      }
    };
    if (showSizeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSizeDropdown]);

  const handleAdd = () => {
    if (!currentColor) return;

    let size = null;
    let sizeScope = "all"; // Default: all sizes (Bulk)
    let status = "complete";

    if (selectedSize === ALL_SIZES_VALUE) {
      // Explicit "All sizes" selection
      size = null;
      sizeScope = "all";
      status = "complete";
    } else if (selectedSize) {
      // Specific size selected
      size = selectedSize;
      sizeScope = "single";
      status = "complete";
    }
    // If no size selected AND Bulk (default), treat as "all sizes" - already set above

    // Build allocation info
    const selectedSource = selectedSourceId
      ? supplySources.find((s) => s.id === selectedSourceId)
      : null;

    // Determine allocation status
    let allocationStatus = "unassigned";
    if (selectedSource) {
      // Check if source has the selected size
      const sourceHasSize =
        selectedSize === null ||
        selectedSize === undefined ||
        selectedSize === ALL_SIZES_VALUE ||
        (Array.isArray(selectedSource.sizeRun) && selectedSource.sizeRun.includes(selectedSize));

      allocationStatus = sourceHasSize ? "allocated" : "size-unavailable";
    }

    const allocation = {
      sourceSupplyId: selectedSourceId,
      sourceLabel: selectedSource?.label || null,
      sourceStatus: selectedSource?.status || null,
      status: allocationStatus,
    };

    onAdd({
      family,
      colour: currentColor,
      size,
      sizeScope,
      status,
      allocation,
    });

    // Reset selections after adding
    setSelectedSize("");
    setSelectedSourceId(null);
    setWantsSpecificSupply(false);
  };

  const handleSizeSelect = (size) => {
    setSelectedSize(size);
    setShowSizeDropdown(false);
  };

  const getSizeLabel = () => {
    // If user explicitly selected ALL_SIZES_VALUE
    if (selectedSize === ALL_SIZES_VALUE) return "All sizes";
    // If user selected a specific size
    if (selectedSize) return selectedSize;
    // Default: show "All sizes" when Bulk (default) - calm, neutral state
    return "All sizes";
  };

  // Callback for when user wants specific supply - opens size picker if no size selected
  const handleRequestSpecificSupply = () => {
    if (!selectedSize) {
      setShowSizeDropdown(true);
    }
    setWantsSpecificSupply(true);
  };

  const isInCart = cartCount > 0;

  return (
    <div
      className={`
        grid grid-cols-[40px_1fr_140px_80px_100px_40px] gap-2 px-3 py-2.5 items-center
        transition-colors
        ${isInCart
          ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-transparent"
        }
      `}
    >
      {/* Thumbnail */}
      <div className="relative w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
        <AppImage
          src={displayImage}
          alt={family.styleName}
          preferredSize={80}
          className="w-full h-full"
          imageClassName="w-full h-full object-cover"
          fallback={
            <div className="flex items-center justify-center h-full text-3xs text-slate-400 dark:text-slate-500">
              No img
            </div>
          }
          placeholder={
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="xs" />
            </div>
          }
        />
        {/* Cart count badge */}
        {cartCount > 0 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-2xs font-bold rounded-full flex items-center justify-center">
            {cartCount}
          </div>
        )}
      </div>

      {/* Product Name & SKU + Context (Gender/Category) */}
      <div className="min-w-0">
        <div className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate" title={family.styleName}>
          {family.styleName}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {family.styleNumber && (
            <span>#{family.styleNumber}</span>
          )}
          {/* Context: Gender & Category - visible BEFORE confirmation per design-spec.md */}
          {(family.gender || family.productType) && (
            <>
              {family.styleNumber && <span className="text-slate-300 dark:text-slate-600">·</span>}
              <span className="text-slate-400 dark:text-slate-500">
                {family.gender && (
                  <span className="capitalize">
                    {family.gender === "men" ? "Men's" : family.gender === "women" ? "Women's" : family.gender}
                  </span>
                )}
                {family.gender && family.productType && " "}
                {family.productType && (
                  <span className="capitalize">{family.productType}</span>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Color Swatches */}
      <div className="flex items-center gap-1 min-w-0">
        {isLoadingDetails ? (
          <div className="flex items-center gap-1.5">
            <LoadingSpinner size="xs" />
            <span className="text-xs text-slate-400">Loading...</span>
          </div>
        ) : colours.length > 0 ? (
          <>
            {colours.slice(0, MAX_VISIBLE_SWATCHES).map((color, idx) => (
              <button
                key={color.id}
                type="button"
                onClick={() => onColorSelect(idx)}
                className={`
                  w-[18px] h-[18px] rounded-full border-2 transition-all shrink-0
                  ${idx === selectedColorIndex
                    ? "border-slate-900 dark:border-slate-100 ring-1 ring-offset-1 ring-slate-400 dark:ring-slate-500"
                    : "border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-400"
                  }
                `}
                style={{ backgroundColor: color.hexColor || "#ccc" }}
                title={color.colorName}
              >
                {color.swatchImagePath && (
                  <AppImage
                    src={color.swatchImagePath}
                    alt=""
                    className="w-full h-full rounded-full overflow-hidden"
                    imageClassName="w-full h-full object-cover rounded-full"
                    placeholder={null}
                    fallback={null}
                  />
                )}
              </button>
            ))}
            {colours.length > MAX_VISIBLE_SWATCHES && (
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-0.5">
                +{colours.length - MAX_VISIBLE_SWATCHES}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500 italic">No colors</span>
        )}
      </div>

      {/* Size Trigger */}
      <div className="relative" ref={sizeDropdownRef}>
        <button
          type="button"
          onClick={() => setShowSizeDropdown(!showSizeDropdown)}
          disabled={!currentColor || isLoadingDetails}
          className={`
            flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors
            ${selectedSize
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
              : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
            }
            hover:bg-slate-200 dark:hover:bg-slate-600
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <Maximize2 className="w-3 h-3" />
          <span>{getSizeLabel()}</span>
        </button>

        {/* Size Dropdown */}
        {showSizeDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-20 min-w-[100px] max-h-48 overflow-y-auto">
            {/* All sizes option (default for Bulk) */}
            <button
              type="button"
              onClick={() => {
                handleSizeSelect("");
                setWantsSpecificSupply(false);
              }}
              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between ${
                !selectedSize ? "bg-slate-50 dark:bg-slate-700/50" : ""
              }`}
            >
              <span>All sizes</span>
              {!selectedSize && (
                <span className="text-slate-400 dark:text-slate-500 text-2xs">default</span>
              )}
            </button>
            {sizes.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
            )}
            {/* Specific size options */}
            {sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handleSizeSelect(size)}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${
                  selectedSize === size ? "bg-slate-100 dark:bg-slate-700 font-medium" : ""
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Source Allocation Selector */}
      <SourceAllocationSelector
        selectedSize={selectedSize === ALL_SIZES_VALUE ? null : selectedSize}
        colorwayId={currentColor?.id}
        supplySources={supplySources}
        familySizes={sizes}
        selectedSourceId={selectedSourceId}
        onSourceChange={(sourceId) => {
          setSelectedSourceId(sourceId);
          // Reset wantsSpecificSupply when going back to Bulk
          if (!sourceId) setWantsSpecificSupply(false);
        }}
        onRequestSpecificSupply={handleRequestSpecificSupply}
        disabled={!currentColor || isLoadingDetails}
      />

      {/* Add Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!currentColor || isLoadingDetails}
          className={`
            w-7 h-7 rounded-md flex items-center justify-center transition-all
            ${isInCart
              ? "bg-green-500 text-white hover:bg-green-600"
              : "bg-blue-600 text-white hover:bg-blue-700"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          title={isInCart ? "Add another" : "Add to selection"}
        >
          {isInCart ? (
            <Check className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ShotProductSelectorModal({
  open,
  families,
  loadFamilyDetails,
  onSubmit,
  onClose,
  canCreateProduct = false,
  onCreateProduct,
}) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");

  // Product color selection state (per product)
  const [productColorIndexes, setProductColorIndexes] = useState({});

  // Family details cache
  const [familyDetailsCache, setFamilyDetailsCache] = useState({});
  const [loadingFamilies, setLoadingFamilies] = useState(new Set());

  // Cart state
  const [cart, setCart] = useState([]);
  const [cartExpanded, setCartExpanded] = useState(false);

  // Create product modal
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const scrollRef = useRef(null);

  // Available families (non-archived)
  const availableFamilies = useMemo(() => {
    return families.filter((f) => !f.archived);
  }, [families]);

  // Fuse search instance
  const fuse = useMemo(() => {
    return new Fuse(availableFamilies, {
      keys: [
        { name: "styleName", weight: 0.6 },
        { name: "styleNumber", weight: 0.4 },
        { name: "colorNames", weight: 0.2 },
      ],
      threshold: 0.32,
      ignoreLocation: true,
    });
  }, [availableFamilies]);

  // Get type options based on gender filter
  const typeOptions = useMemo(() => {
    if (genderFilter === "all") {
      return getAllTypes();
    }
    return getTypesForGender(genderFilter);
  }, [genderFilter]);

  // Get subcategory options based on gender and type
  const subcategoryOptions = useMemo(() => {
    if (typeFilter === "all") return [];
    if (genderFilter === "all") {
      return getSubcategoriesForTypeUnion(typeFilter);
    }
    return getSubcategoriesForType(genderFilter, typeFilter);
  }, [genderFilter, typeFilter]);

  // Filter families
  const filteredFamilies = useMemo(() => {
    let result = availableFamilies;

    // Gender filter
    if (genderFilter !== "all") {
      result = result.filter(
        (f) => (f.gender || "").toLowerCase() === genderFilter.toLowerCase()
      );
    }

    // Type filter (productType)
    if (typeFilter !== "all") {
      result = result.filter(
        (f) => (f.productType || "").toLowerCase() === typeFilter.toLowerCase()
      );
    }

    // Subcategory filter
    if (subcategoryFilter !== "all") {
      result = result.filter(
        (f) => (f.productSubcategory || "").toLowerCase() === subcategoryFilter.toLowerCase()
      );
    }

    // Search query
    if (searchQuery.trim()) {
      const searchResults = fuse.search(searchQuery.trim());
      const searchIds = new Set(searchResults.map((r) => r.item.id));
      result = result.filter((f) => searchIds.has(f.id));
    }

    return result;
  }, [availableFamilies, genderFilter, typeFilter, subcategoryFilter, searchQuery, fuse]);

  // Load family details for visible families
  useEffect(() => {
    const loadDetails = async () => {
      const familyIds = filteredFamilies
        .map((f) => f.id)
        .filter((id) => !familyDetailsCache[id] && !loadingFamilies.has(id));

      if (familyIds.length === 0) return;

      setLoadingFamilies((prev) => {
        const next = new Set(prev);
        familyIds.forEach((id) => next.add(id));
        return next;
      });

      const results = await Promise.all(
        familyIds.map(async (familyId) => {
          try {
            const details = await loadFamilyDetails(familyId);
            return { familyId, details };
          } catch (error) {
            console.error(`Failed to load details for ${familyId}:`, error);
            return { familyId, details: null };
          }
        })
      );

      setFamilyDetailsCache((prev) => {
        const next = { ...prev };
        results.forEach(({ familyId, details }) => {
          if (details) next[familyId] = details;
        });
        return next;
      });

      setLoadingFamilies((prev) => {
        const next = new Set(prev);
        familyIds.forEach((id) => next.delete(id));
        return next;
      });
    };

    loadDetails();
  }, [filteredFamilies, familyDetailsCache, loadingFamilies, loadFamilyDetails]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setGenderFilter("all");
      setTypeFilter("all");
      setSubcategoryFilter("all");
      setProductColorIndexes({});
      setCart([]);
      setCartExpanded(false);
      setCreateModalOpen(false);
    }
  }, [open]);

  // Handle gender change - reset downstream filters
  const handleGenderChange = (value) => {
    setGenderFilter(value);
    setTypeFilter("all");
    setSubcategoryFilter("all");
  };

  // Handle type change - reset subcategory
  const handleTypeChange = (value) => {
    setTypeFilter(value);
    setSubcategoryFilter("all");
  };

  // Select color for a product
  const handleColorSelect = (familyId, colorIndex) => {
    setProductColorIndexes((prev) => ({
      ...prev,
      [familyId]: colorIndex,
    }));
  };

  // Add product to cart
  const handleAddToCart = useCallback((selection) => {
    const { family, colour, size, sizeScope, status, allocation } = selection;

    // Check for duplicate
    const isDuplicate = cart.some(
      (item) =>
        item.familyId === family.id &&
        item.colorId === colour.id &&
        item.size === size &&
        item.sizeScope === sizeScope
    );

    if (isDuplicate) {
      return;
    }

    const cartItem = {
      id: `${family.id}-${colour.id}-${Date.now()}`,
      familyId: family.id,
      productName: family.styleName,
      styleNumber: family.styleNumber,
      colorId: colour.id,
      colorName: colour.colorName,
      colorHex: colour.hexColor,
      colorImage: colour.imagePath,
      size,
      sizeScope,
      status,
      // Allocation info
      allocation: allocation || { sourceSupplyId: null, status: "unassigned" },
    };

    setCart((prev) => [...prev, cartItem]);
  }, [cart]);

  // Remove from cart
  const handleRemoveFromCart = (index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // Clear cart
  const handleClearCart = () => {
    setCart([]);
  };

  // Submit all cart items
  const handleSubmit = () => {
    if (cart.length === 0) return;

    // Convert cart items to the format expected by onSubmit
    const selections = cart.map((item) => {
      const family = families.find((f) => f.id === item.familyId);
      const details = familyDetailsCache[item.familyId];
      const colour = details?.colours?.find((c) => c.id === item.colorId);

      return {
        family,
        colour: colour || {
          id: item.colorId,
          colorName: item.colorName,
          imagePath: item.colorImage,
          hexColor: item.colorHex,
        },
        size: item.size,
        sizeScope: item.sizeScope,
        status: item.status,
        allocation: item.allocation,
      };
    });

    onSubmit(selections);
    onClose();
  };

  // Count items in cart per family
  const getCartCountForFamily = (familyId) => {
    return cart.filter((item) => item.familyId === familyId).length;
  };

  // Handle product creation
  const handleProductCreated = async (payload) => {
    if (!onCreateProduct) return;
    try {
      const familyId = await onCreateProduct(payload);
      setCreateModalOpen(false);
      return familyId;
    } catch (error) {
      throw error;
    }
  };


  // Gender options
  const genderOptions = [
    { value: "all", label: "All Genders" },
    { value: "men", label: "Men's" },
    { value: "women", label: "Women's" },
    { value: "unisex", label: "Unisex" },
  ];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        labelledBy="product-selector-title"
        contentClassName="p-0 max-w-4xl w-full max-h-[85vh]"
      >
        <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <div>
              <h2 id="product-selector-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Add Products to Shot
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Click swatches to preview colors, then add with your size
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filters Bar */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>

              {/* Gender */}
              <select
                value={genderFilter}
                onChange={(e) => handleGenderChange(e.target.value)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary h-9"
              >
                {genderOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Type/Category */}
              <select
                value={typeFilter}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary h-9"
              >
                <option value="all">All Categories</option>
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Subcategory */}
              {subcategoryOptions.length > 0 && (
                <select
                  value={subcategoryFilter}
                  onChange={(e) => setSubcategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary h-9"
                >
                  <option value="all">All Types</option>
                  {subcategoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Create Product Button */}
              {canCreateProduct && onCreateProduct && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateModalOpen(true)}
                  className="shrink-0 h-9"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  New Product
                </Button>
              )}
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[40px_1fr_140px_80px_100px_40px] gap-2 px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 shrink-0">
            <div></div>
            <div>Product</div>
            <div>Colors</div>
            <div>Size</div>
            <div>Source</div>
            <div></div>
          </div>

          {/* Product List */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50"
          >
            {filteredFamilies.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-3">
                  <Search className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No products match your filters
                </p>
              </div>
            ) : (
              filteredFamilies.map((family) => (
                <ProductSelectorRow
                  key={family.id}
                  family={family}
                  familyDetails={familyDetailsCache[family.id]}
                  isLoadingDetails={loadingFamilies.has(family.id)}
                  selectedColorIndex={productColorIndexes[family.id] || 0}
                  onColorSelect={(idx) => handleColorSelect(family.id, idx)}
                  onAdd={handleAddToCart}
                  cartCount={getCartCountForFamily(family.id)}
                />
              ))
            )}
          </div>

          {/* Cart Preview Section */}
          {cart.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
              {/* Cart Header - Clickable to expand/collapse */}
              <button
                type="button"
                onClick={() => setCartExpanded(!cartExpanded)}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {cart.length}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {cart.length === 1 ? "1 product selected" : `${cart.length} products selected`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearCart();
                    }}
                    className="text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition underline"
                  >
                    Clear all
                  </button>
                  {cartExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Cart Items List */}
              {cartExpanded && (
                <div className="max-h-40 overflow-y-auto px-4 pb-3 space-y-2">
                  {cart.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-2 px-3 bg-white dark:bg-slate-700 rounded-lg shadow-sm"
                    >
                      {/* Color Swatch */}
                      <div
                        className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-600 shrink-0"
                        style={{ backgroundColor: item.colorHex || "#ccc" }}
                        title={item.colorName}
                      />

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {item.productName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.colorName}
                          {item.sizeScope === "all"
                            ? " · All sizes"
                            : item.size
                            ? ` · ${item.size}`
                            : " · Size pending"}
                        </div>
                      </div>

                      {/* Allocation Status */}
                      <AllocationStatusBadge allocation={item.allocation} />

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(index)}
                        className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Remove from selection"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {cart.length === 0 && "No products selected"}
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={cart.length === 0}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Shot ({cart.length})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Create Product Modal */}
      {createModalOpen && canCreateProduct && onCreateProduct && (
        <NewProductModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={handleProductCreated}
        />
      )}

    </>
  );
}
