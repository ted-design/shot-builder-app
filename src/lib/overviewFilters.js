export const defaultOverviewFilters = {
  locationId: "",
  talentIds: [],
  productFamilyIds: [],
  tagIds: [],
  showArchived: false,
};

export function buildActiveFilterPills(filters, { locations = [], talentOptions = [], productOptions = [], tagOptions = [] }) {
  const pills = [];

  if (filters.locationId) {
    const location = locations.find((loc) => loc.id === filters.locationId);
    if (location) {
      pills.push({
        key: `location-${filters.locationId}`,
        label: "Location",
        value: location.name || "Unknown",
      });
    }
  }

  if (Array.isArray(filters.talentIds)) {
    filters.talentIds.forEach((talentId) => {
      const option = talentOptions.find((entry) => entry.value === talentId);
      if (option) {
        pills.push({
          key: `talent-${talentId}`,
          label: "Talent",
          value: option.label,
        });
      }
    });
  }

  if (Array.isArray(filters.productFamilyIds)) {
    filters.productFamilyIds.forEach((productId) => {
      const option = productOptions.find((entry) => entry.value === productId);
      if (option) {
        pills.push({
          key: `product-${productId}`,
          label: "Product",
          value: option.label,
        });
      }
    });
  }

  if (Array.isArray(filters.tagIds)) {
    filters.tagIds.forEach((tagId) => {
      const option = tagOptions.find((entry) => entry.value === tagId || entry.id === tagId);
      if (option) {
        const label = option.label || option.name || "Unknown";
        pills.push({
          key: `tag-${tagId}`,
          label: "Tag",
          value: label,
        });
      }
    });
  }

  if (filters.showArchived) {
    pills.push({ key: "showArchived", label: "Status", value: "Including archived" });
  }

  return pills;
}

export function removeFilterKey(filters, filterKey) {
  if (!filters || typeof filters !== "object") {
    return { ...defaultOverviewFilters };
  }

  if (filterKey.startsWith("location-")) {
    return { ...filters, locationId: "" };
  }

  if (filterKey.startsWith("talent-")) {
    const talentId = filterKey.slice("talent-".length);
    return {
      ...filters,
      talentIds: Array.isArray(filters.talentIds)
        ? filters.talentIds.filter((id) => id !== talentId)
        : [],
    };
  }

  if (filterKey.startsWith("product-")) {
    const productId = filterKey.slice("product-".length);
    return {
      ...filters,
      productFamilyIds: Array.isArray(filters.productFamilyIds)
        ? filters.productFamilyIds.filter((id) => id !== productId)
        : [],
    };
  }

  if (filterKey.startsWith("tag-")) {
    const tagId = filterKey.slice("tag-".length);
    return {
      ...filters,
      tagIds: Array.isArray(filters.tagIds) ? filters.tagIds.filter((id) => id !== tagId) : [],
    };
  }

  if (filterKey === "showArchived") {
    return { ...filters, showArchived: false };
  }

  return { ...filters };
}
