import { describe, expect, it } from "vitest"
import { getDynamicVariables, resolveVariables } from "../exportVariables"
import type { ExportVariable } from "../../types/exportBuilder"

describe("getDynamicVariables", () => {
  it("returns 8 dynamic variables", () => {
    const vars = getDynamicVariables({})
    expect(vars).toHaveLength(8)
    for (const v of vars) {
      expect(v.source).toBe("dynamic")
    }
  })

  it("populates projectName and clientName from context", () => {
    const vars = getDynamicVariables({
      projectName: "FW26 Campaign",
      clientName: "Acme Corp",
    })
    const projectVar = vars.find((v) => v.key === "projectName")
    const clientVar = vars.find((v) => v.key === "clientName")
    expect(projectVar?.value).toBe("FW26 Campaign")
    expect(clientVar?.value).toBe("Acme Corp")
  })

  it("defaults missing context values to empty or zero", () => {
    const vars = getDynamicVariables({})
    const projectVar = vars.find((v) => v.key === "projectName")
    const shotCount = vars.find((v) => v.key === "shotCount")
    const productCount = vars.find((v) => v.key === "productCount")
    expect(projectVar?.value).toBe("")
    expect(shotCount?.value).toBe("0")
    expect(productCount?.value).toBe("0")
  })

  it("formats a single shoot date", () => {
    const vars = getDynamicVariables({ shootDates: ["2026-04-15"] })
    const dateVar = vars.find((v) => v.key === "shootDates")
    expect(dateVar?.value).toContain("Apr")
    expect(dateVar?.value).toContain("15")
    expect(dateVar?.value).toContain("2026")
  })

  it("formats a date range for multiple shoot dates", () => {
    const vars = getDynamicVariables({
      shootDates: ["2026-04-15", "2026-04-18", "2026-04-16"],
    })
    const dateVar = vars.find((v) => v.key === "shootDates")
    // Should show first and last sorted date
    expect(dateVar?.value).toContain("Apr 15")
    expect(dateVar?.value).toContain("Apr 18")
    expect(dateVar?.value).toContain("–")
  })

  it("returns empty string for empty shoot dates", () => {
    const vars = getDynamicVariables({ shootDates: [] })
    const dateVar = vars.find((v) => v.key === "shootDates")
    expect(dateVar?.value).toBe("")
  })

  it("preserves pageNumber and pageCount as tokens for PDF render", () => {
    const vars = getDynamicVariables({})
    const pageNum = vars.find((v) => v.key === "pageNumber")
    const pageCount = vars.find((v) => v.key === "pageCount")
    expect(pageNum?.value).toBe("{{pageNumber}}")
    expect(pageCount?.value).toBe("{{pageCount}}")
  })
})

describe("resolveVariables", () => {
  const variables: ExportVariable[] = [
    { key: "projectName", label: "Project Name", value: "FW26 Campaign", source: "dynamic" },
    { key: "clientName", label: "Client", value: "Acme Corp", source: "dynamic" },
    { key: "shotCount", label: "Shot Count", value: "42", source: "dynamic" },
  ]

  it("replaces a single token", () => {
    const result = resolveVariables("Project: {{projectName}}", variables)
    expect(result).toBe("Project: FW26 Campaign")
  })

  it("replaces multiple tokens in one string", () => {
    const result = resolveVariables(
      "{{projectName}} by {{clientName}} — {{shotCount}} shots",
      variables,
    )
    expect(result).toBe("FW26 Campaign by Acme Corp — 42 shots")
  })

  it("replaces repeated tokens", () => {
    const result = resolveVariables(
      "{{projectName}} / {{projectName}}",
      variables,
    )
    expect(result).toBe("FW26 Campaign / FW26 Campaign")
  })

  it("leaves unrecognized tokens untouched", () => {
    const result = resolveVariables("Hello {{unknown}}", variables)
    expect(result).toBe("Hello {{unknown}}")
  })

  it("returns text unchanged when no tokens are present", () => {
    const result = resolveVariables("No tokens here", variables)
    expect(result).toBe("No tokens here")
  })

  it("handles empty text", () => {
    const result = resolveVariables("", variables)
    expect(result).toBe("")
  })

  it("handles empty variables array", () => {
    const result = resolveVariables("{{projectName}} stays", [])
    expect(result).toBe("{{projectName}} stays")
  })
})
