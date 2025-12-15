const NUMERIC_IN_KEYS = new Set([
  "waist",
  "inseam",
  "hips",
  "bust",
  "collar",
  "sleeve",
]);

const NUMERIC_US_KEYS = new Set([
  "shoes",
  "dress",
]);

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const parseLooseNumber = (input) => {
  if (isFiniteNumber(input)) return input;
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const trimOrNull = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const formatNumber = (value, { maxDecimals = 2 } = {}) => {
  if (!isFiniteNumber(value)) return "";
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(value * factor) / factor;
  return String(rounded).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
};

export const inchesToFeetInches = (inches) => {
  if (!isFiniteNumber(inches)) return { feet: null, inches: null };
  const rounded = Math.round(inches);
  const feet = Math.floor(rounded / 12);
  const remainder = rounded - feet * 12;
  return { feet, inches: remainder };
};

export const formatHeightInches = (inches) => {
  const { feet, inches: remainder } = inchesToFeetInches(inches);
  if (feet === null || remainder === null) return "";
  return `${feet}'${remainder}"`;
};

const parseHeightFeetInches = (input) => {
  const text = trimOrNull(input);
  if (!text) return null;

  const match = text.match(/^\s*(\d{1,2})\s*(?:'|ft|feet)\s*(\d{1,2})?\s*(?:\"|in|inches)?\s*$/i);
  if (!match) return null;

  const feet = parseLooseNumber(match[1]);
  const inches = match[2] ? parseLooseNumber(match[2]) : 0;
  if (!isFiniteNumber(feet) || !isFiniteNumber(inches)) return null;
  if (feet <= 0 || inches < 0 || inches >= 12) return null;

  return feet * 12 + inches;
};

const parseLengthToInches = (input) => {
  const text = trimOrNull(input);
  if (!text) return null;

  const cmMatch = text.match(/^\s*([\d.,]+)\s*cm\s*$/i);
  if (cmMatch) {
    const cm = parseLooseNumber(cmMatch[1]);
    if (!isFiniteNumber(cm) || cm <= 0) return null;
    return cm / 2.54;
  }

  const inMatch = text.match(/^\s*([\d.,]+)\s*(?:in|\"|inches)?\s*$/i);
  if (inMatch) {
    const inches = parseLooseNumber(inMatch[1]);
    if (!isFiniteNumber(inches) || inches <= 0) return null;
    return inches;
  }

  return null;
};

export const parseHeightToInches = (input) => {
  const text = trimOrNull(input);
  if (!text) return null;

  const ftIn = parseHeightFeetInches(text);
  if (isFiniteNumber(ftIn)) return ftIn;

  const cmMatch = text.match(/^\s*([\d.,]+)\s*cm\s*$/i);
  if (cmMatch) {
    const cm = parseLooseNumber(cmMatch[1]);
    if (!isFiniteNumber(cm) || cm <= 0) return null;
    return cm / 2.54;
  }

  const mMatch = text.match(/^\s*([\d.,]+)\s*m\s*$/i);
  if (mMatch) {
    const meters = parseLooseNumber(mMatch[1]);
    if (!isFiniteNumber(meters) || meters <= 0) return null;
    return (meters * 100) / 2.54;
  }

  const numeric = parseLooseNumber(text);
  if (!isFiniteNumber(numeric)) return null;

  if (numeric > 100) {
    return numeric / 2.54;
  }
  if (numeric < 10) {
    return numeric * 12;
  }

  return numeric;
};

export const coerceMeasurementNumber = (key, value) => {
  if (!key) return null;
  if (isFiniteNumber(value)) return value;

  if (value && typeof value === "object" && "value" in value) {
    const nested = value.value;
    if (isFiniteNumber(nested)) return nested;
    const nestedParsed = parseLooseNumber(String(nested ?? ""));
    return isFiniteNumber(nestedParsed) ? nestedParsed : null;
  }

  if (typeof value === "string") {
    if (key === "height") return parseHeightToInches(value);
    if (NUMERIC_IN_KEYS.has(key)) return parseLengthToInches(value);
    if (NUMERIC_US_KEYS.has(key)) return parseLooseNumber(value);
  }

  return null;
};

export const normalizeMeasurementValue = (key, value) => {
  if (!key) return null;
  if (value === undefined || value === null) return null;

  if (typeof value === "object") {
    const unit = typeof value.unit === "string" && value.unit ? value.unit : null;
    if (unit && Object.prototype.hasOwnProperty.call(value, "value")) {
      const parsed = coerceMeasurementNumber(key, value);
      return isFiniteNumber(parsed) ? { unit, value: parsed } : null;
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (key === "height") {
      const inches = parseHeightToInches(trimmed);
      return isFiniteNumber(inches) ? { unit: "in", value: inches } : trimmed;
    }

    if (NUMERIC_IN_KEYS.has(key)) {
      const inches = parseLengthToInches(trimmed);
      return isFiniteNumber(inches) ? { unit: "in", value: inches } : trimmed;
    }

    if (NUMERIC_US_KEYS.has(key)) {
      const numeric = parseLooseNumber(trimmed);
      return isFiniteNumber(numeric) ? { unit: "us", value: numeric } : trimmed;
    }

    return trimmed;
  }

  if (isFiniteNumber(value)) {
    if (key === "height") return { unit: "in", value };
    if (NUMERIC_IN_KEYS.has(key)) return { unit: "in", value };
    if (NUMERIC_US_KEYS.has(key)) return { unit: "us", value };
  }

  return String(value).trim() || null;
};

export const normalizeMeasurementsMap = (input) => {
  if (!input || typeof input !== "object") return {};
  const result = {};
  Object.entries(input).forEach(([key, value]) => {
    const normalized = normalizeMeasurementValue(key, value);
    if (normalized === null) return;
    result[key] = normalized;
  });
  return result;
};

export const getMeasurementDisplayValue = (key, value) => {
  if (value === undefined || value === null) return "";

  if (typeof value === "string") return value;

  if (typeof value === "object" && value && Object.prototype.hasOwnProperty.call(value, "value")) {
    const numeric = coerceMeasurementNumber(key, value);
    if (!isFiniteNumber(numeric)) return "";

    if (key === "height") return formatHeightInches(numeric);
    if (NUMERIC_IN_KEYS.has(key)) return `${formatNumber(numeric)} in`;
    if (NUMERIC_US_KEYS.has(key)) return formatNumber(numeric);

    return formatNumber(numeric);
  }

  if (isFiniteNumber(value)) {
    if (key === "height") return formatHeightInches(value);
    if (NUMERIC_IN_KEYS.has(key)) return `${formatNumber(value)} in`;
    if (NUMERIC_US_KEYS.has(key)) return formatNumber(value);
    return formatNumber(value);
  }

  return String(value);
};

export const getMeasurementInputKind = (key) => {
  if (key === "height") return "height";
  if (NUMERIC_IN_KEYS.has(key)) return "inches";
  if (NUMERIC_US_KEYS.has(key)) return "us";
  return "text";
};

