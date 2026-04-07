export type CarrierKey = "dhl" | "ups" | "fedex" | "usps" | "canada_post" | "unknown"

export interface CarrierInfo {
  readonly key: CarrierKey
  readonly name: string
  readonly trackingUrl: string | null
  readonly confidence: "high" | "medium" | "low"
}

/** Known carrier display names. */
export const CARRIER_NAMES: Readonly<Record<string, string>> = {
  dhl: "DHL",
  ups: "UPS",
  fedex: "FedEx",
  usps: "USPS",
  canada_post: "Canada Post",
  unknown: "Unknown",
}

const CARRIER_URL_TEMPLATES: Readonly<Record<string, string>> = {
  dhl: "https://www.dhl.com/ca-en/home/tracking.html?tracking-id={number}",
  ups: "https://www.ups.com/track?tracknum={number}",
  fedex: "https://www.fedex.com/fedextrack/?trknbr={number}",
  usps: "https://tools.usps.com/go/TrackConfirmAction?tLabels={number}",
  canada_post: "https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor={number}",
}

/** Normalize a free-text carrier name to a CarrierKey. */
export function normalizeCarrierName(name: string): CarrierKey {
  const lower = name.trim().toLowerCase().replace(/[^a-z\s]/g, "")
  if (lower.startsWith("dhl")) return "dhl"
  if (lower === "ups") return "ups"
  if (lower === "fedex" || lower === "federal express") return "fedex"
  if (lower === "usps" || lower === "us postal" || lower === "us postal service") return "usps"
  if (lower === "canada post" || lower === "canadapost" || lower === "postes canada") return "canada_post"
  return "unknown"
}

/** Generate a tracking URL for a carrier key + tracking number. Returns null for unknown carriers. */
export function getTrackingUrl(carrier: string, tracking: string): string | null {
  const trimmed = tracking.trim()
  if (!trimmed) return null
  const template = CARRIER_URL_TEMPLATES[carrier]
  if (!template) return null
  return template.replace("{number}", encodeURIComponent(trimmed))
}

/**
 * Auto-detect carrier from tracking number format.
 * If a carrier name is provided (from user input), it takes priority over auto-detection.
 */
export function detectCarrier(tracking: string, carrierHint?: string): CarrierInfo {
  const trimmed = tracking.trim()

  // If user specified a carrier, use that first
  if (carrierHint) {
    const key = normalizeCarrierName(carrierHint)
    if (key !== "unknown") {
      const name = CARRIER_NAMES[key] ?? key
      return {
        key,
        name,
        trackingUrl: getTrackingUrl(key, trimmed),
        confidence: "high",
      }
    }
  }

  if (!trimmed) {
    return { key: "unknown", name: "Unknown", trackingUrl: null, confidence: "low" }
  }

  // UPS: starts with "1Z", 16-18 alphanumeric chars total
  if (/^1Z[A-Z0-9]{14,16}$/i.test(trimmed)) {
    return { key: "ups", name: "UPS", trackingUrl: getTrackingUrl("ups", trimmed), confidence: "high" }
  }

  // DHL eCommerce: starts with JD, JVGL, or GM followed by digits
  if (/^(JD|JVGL|GM)\d+$/i.test(trimmed)) {
    return { key: "dhl", name: "DHL", trackingUrl: getTrackingUrl("dhl", trimmed), confidence: "high" }
  }

  // DHL Express: exactly 10 digits
  if (/^\d{10}$/.test(trimmed)) {
    return { key: "dhl", name: "DHL", trackingUrl: getTrackingUrl("dhl", trimmed), confidence: "medium" }
  }

  // FedEx: 12 or 15 digits
  if (/^\d{12}$/.test(trimmed) || /^\d{15}$/.test(trimmed)) {
    return { key: "fedex", name: "FedEx", trackingUrl: getTrackingUrl("fedex", trimmed), confidence: "medium" }
  }

  // USPS: 20-22 digits, or starts with specific prefixes (e.g., 94, 92, 93)
  if (/^\d{20,22}$/.test(trimmed)) {
    return { key: "usps", name: "USPS", trackingUrl: getTrackingUrl("usps", trimmed), confidence: "medium" }
  }

  // Canada Post: 13-16 alphanumeric characters (letters + digits mix)
  if (/^[A-Z0-9]{13,16}$/i.test(trimmed) && /[A-Z]/i.test(trimmed) && /\d/.test(trimmed)) {
    return { key: "canada_post", name: "Canada Post", trackingUrl: getTrackingUrl("canada_post", trimmed), confidence: "low" }
  }

  return { key: "unknown", name: "Unknown", trackingUrl: null, confidence: "low" }
}
