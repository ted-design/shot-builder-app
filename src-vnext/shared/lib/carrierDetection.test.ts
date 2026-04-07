import { describe, it, expect } from "vitest"
import {
  detectCarrier,
  getTrackingUrl,
  normalizeCarrierName,
  CARRIER_NAMES,
} from "./carrierDetection"

describe("normalizeCarrierName", () => {
  it("normalizes DHL variants", () => {
    expect(normalizeCarrierName("DHL")).toBe("dhl")
    expect(normalizeCarrierName("dhl")).toBe("dhl")
    expect(normalizeCarrierName("DHL Express")).toBe("dhl")
    expect(normalizeCarrierName("  DHL  ")).toBe("dhl")
  })

  it("normalizes UPS", () => {
    expect(normalizeCarrierName("UPS")).toBe("ups")
    expect(normalizeCarrierName("ups")).toBe("ups")
  })

  it("normalizes FedEx variants", () => {
    expect(normalizeCarrierName("FedEx")).toBe("fedex")
    expect(normalizeCarrierName("FEDEX")).toBe("fedex")
    expect(normalizeCarrierName("Federal Express")).toBe("fedex")
  })

  it("normalizes USPS", () => {
    expect(normalizeCarrierName("USPS")).toBe("usps")
    expect(normalizeCarrierName("usps")).toBe("usps")
  })

  it("normalizes Canada Post variants", () => {
    expect(normalizeCarrierName("Canada Post")).toBe("canada_post")
    expect(normalizeCarrierName("CanadaPost")).toBe("canada_post")
    expect(normalizeCarrierName("Postes Canada")).toBe("canada_post")
  })

  it("returns unknown for unrecognized carriers", () => {
    expect(normalizeCarrierName("Purolator")).toBe("unknown")
    expect(normalizeCarrierName("")).toBe("unknown")
    expect(normalizeCarrierName("Some Random Carrier")).toBe("unknown")
  })
})

describe("getTrackingUrl", () => {
  it("generates DHL tracking URL", () => {
    expect(getTrackingUrl("dhl", "2243289123")).toBe(
      "https://www.dhl.com/ca-en/home/tracking.html?tracking-id=2243289123",
    )
  })

  it("generates UPS tracking URL", () => {
    expect(getTrackingUrl("ups", "1Z999AA10123456784")).toBe(
      "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    )
  })

  it("generates FedEx tracking URL", () => {
    expect(getTrackingUrl("fedex", "123456789012")).toBe(
      "https://www.fedex.com/fedextrack/?trknbr=123456789012",
    )
  })

  it("generates USPS tracking URL", () => {
    expect(getTrackingUrl("usps", "92345678901234567890")).toBe(
      "https://tools.usps.com/go/TrackConfirmAction?tLabels=92345678901234567890",
    )
  })

  it("generates Canada Post tracking URL", () => {
    expect(getTrackingUrl("canada_post", "ABC1234567890")).toBe(
      "https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=ABC1234567890",
    )
  })

  it("returns null for unknown carrier", () => {
    expect(getTrackingUrl("unknown", "12345")).toBeNull()
  })

  it("returns null for empty tracking number", () => {
    expect(getTrackingUrl("dhl", "")).toBeNull()
    expect(getTrackingUrl("dhl", "   ")).toBeNull()
  })

  it("encodes special characters in tracking number", () => {
    const url = getTrackingUrl("dhl", "123 456")
    expect(url).toContain("123%20456")
  })
})

describe("detectCarrier", () => {
  describe("DHL Express (10 digits)", () => {
    it("detects 10-digit tracking numbers", () => {
      const result = detectCarrier("2243289123")
      expect(result.key).toBe("dhl")
      expect(result.name).toBe("DHL")
      expect(result.confidence).toBe("low")
      expect(result.trackingUrl).toContain("2243289123")
    })
  })

  describe("DHL eCommerce", () => {
    it("detects JD prefix", () => {
      const result = detectCarrier("JD123456789")
      expect(result.key).toBe("dhl")
      expect(result.confidence).toBe("high")
    })

    it("detects JVGL prefix", () => {
      const result = detectCarrier("JVGL987654321")
      expect(result.key).toBe("dhl")
      expect(result.confidence).toBe("high")
    })

    it("detects GM prefix", () => {
      const result = detectCarrier("GM123456789012")
      expect(result.key).toBe("dhl")
      expect(result.confidence).toBe("high")
    })
  })

  describe("UPS (1Z pattern)", () => {
    it("detects 1Z tracking numbers", () => {
      const result = detectCarrier("1Z999AA10123456784")
      expect(result.key).toBe("ups")
      expect(result.name).toBe("UPS")
      expect(result.confidence).toBe("high")
      expect(result.trackingUrl).toContain("1Z999AA10123456784")
    })

    it("is case-insensitive", () => {
      const result = detectCarrier("1z999aa10123456784")
      expect(result.key).toBe("ups")
    })
  })

  describe("FedEx (12 or 15 digits)", () => {
    it("detects 12-digit tracking numbers", () => {
      const result = detectCarrier("123456789012")
      expect(result.key).toBe("fedex")
      expect(result.confidence).toBe("medium")
    })

    it("detects 15-digit tracking numbers", () => {
      const result = detectCarrier("123456789012345")
      expect(result.key).toBe("fedex")
      expect(result.confidence).toBe("medium")
    })
  })

  describe("USPS (20-22 digits)", () => {
    it("detects 20-digit tracking numbers", () => {
      const result = detectCarrier("92345678901234567890")
      expect(result.key).toBe("usps")
      expect(result.confidence).toBe("medium")
    })

    it("detects 22-digit tracking numbers", () => {
      const result = detectCarrier("9234567890123456789012")
      expect(result.key).toBe("usps")
      expect(result.confidence).toBe("medium")
    })
  })

  describe("Canada Post (13-16 alphanumeric)", () => {
    it("detects alphanumeric tracking numbers", () => {
      const result = detectCarrier("ABC1234567890")
      expect(result.key).toBe("canada_post")
      expect(result.confidence).toBe("low")
    })
  })

  describe("carrier hint override", () => {
    it("uses carrier hint when provided", () => {
      const result = detectCarrier("12345", "DHL")
      expect(result.key).toBe("dhl")
      expect(result.confidence).toBe("high")
      expect(result.trackingUrl).toContain("12345")
    })

    it("ignores unknown carrier hints and falls through to detection", () => {
      const result = detectCarrier("1Z999AA10123456784", "Purolator")
      expect(result.key).toBe("ups")
    })
  })

  describe("edge cases", () => {
    it("returns unknown for empty string", () => {
      const result = detectCarrier("")
      expect(result.key).toBe("unknown")
      expect(result.trackingUrl).toBeNull()
    })

    it("returns unknown for whitespace-only string", () => {
      const result = detectCarrier("   ")
      expect(result.key).toBe("unknown")
      expect(result.trackingUrl).toBeNull()
    })

    it("returns unknown for short numbers", () => {
      const result = detectCarrier("12345")
      expect(result.key).toBe("unknown")
    })

    it("trims whitespace before detection", () => {
      const result = detectCarrier("  2243289123  ")
      expect(result.key).toBe("dhl")
    })
  })
})

describe("CARRIER_NAMES", () => {
  it("has display names for all known carriers", () => {
    expect(CARRIER_NAMES.dhl).toBe("DHL")
    expect(CARRIER_NAMES.ups).toBe("UPS")
    expect(CARRIER_NAMES.fedex).toBe("FedEx")
    expect(CARRIER_NAMES.usps).toBe("USPS")
    expect(CARRIER_NAMES.canada_post).toBe("Canada Post")
    expect(CARRIER_NAMES.unknown).toBe("Unknown")
  })
})
