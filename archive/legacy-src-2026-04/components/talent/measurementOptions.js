export const MEASUREMENT_GROUPS = {
  men: [
    { key: "height", label: "Height" },
    { key: "waist", label: "Waist" },
    { key: "inseam", label: "Inseam" },
    { key: "shoes", label: "Shoes" },
    { key: "suit", label: "Suit" },
    { key: "collar", label: "Collar" },
    { key: "sleeve", label: "Sleeve" },
  ],
  women: [
    { key: "height", label: "Height" },
    { key: "waist", label: "Waist" },
    { key: "hips", label: "Hips" },
    { key: "shoes", label: "Shoes" },
    { key: "bust", label: "Bust" },
    { key: "dress", label: "Dress" },
  ],
};

const uniqueLabels = new Map();
Object.values(MEASUREMENT_GROUPS).forEach((group) => {
  group.forEach((entry) => {
    if (!uniqueLabels.has(entry.key)) {
      uniqueLabels.set(entry.key, entry.label);
    }
  });
});

export const ALL_MEASUREMENT_OPTIONS = Array.from(uniqueLabels.entries()).map(([key, label]) => ({
  key,
  label,
}));

export const MEASUREMENT_LABEL_MAP = ALL_MEASUREMENT_OPTIONS.reduce((acc, entry) => {
  acc[entry.key] = entry.label;
  return acc;
}, {});

const normaliseGender = (gender) => {
  const value = (gender || "").toLowerCase();
  if (value.startsWith("men")) return "men";
  if (value.startsWith("women")) return "women";
  return "other";
};

export const getMeasurementOptionsForGender = (gender) => {
  const key = normaliseGender(gender);
  if (key === "men") return MEASUREMENT_GROUPS.men;
  if (key === "women") return MEASUREMENT_GROUPS.women;
  return ALL_MEASUREMENT_OPTIONS;
};

export const orderMeasurementKeys = (measurements = {}, gender) => {
  const options = getMeasurementOptionsForGender(gender);
  const preferredOrder = options.map((option) => option.key);
  const existingKeys = Object.keys(measurements).filter((value) => measurements[value] !== undefined);

  const ordered = preferredOrder.filter((key) => existingKeys.includes(key));
  const remaining = existingKeys.filter((key) => !ordered.includes(key));
  return [...ordered, ...remaining];
};
