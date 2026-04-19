// @vitest-environment node
/**
 * Unit tests for the `functions/src/callSheetEmails` module (Phase 3
 * publishing). These run against the main repo's vitest harness but exercise
 * the CommonJS modules inside `functions/` via `require` — same pattern used
 * for the rules emulator suite.
 *
 * Covers:
 *   - HTML + text render happy path.
 *   - XSS safety: user-supplied strings with `<script>` land as text, never
 *     as live DOM.
 *   - Subject formatting for the default + confirmation + resend variants.
 *   - Compound token URL construction.
 */

import { describe, expect, it } from "vitest"
import { createRequire } from "node:module"
import { resolve } from "node:path"

const require = createRequire(import.meta.url)
const emailsModule = require(
  resolve(__dirname, "../../../../functions/src/callSheetEmails/index.js"),
) as {
  sendCallSheetShareEmail: (args: unknown) => Promise<{ ok: boolean; error?: string }>
  buildShareUrl: (shareGroupId: string, recipientToken: string, appUrl?: string) => string
  buildRecipientsPanelUrl: (args: {
    clientId: string
    projectId: string
    scheduleId: string
    appUrl?: string
  }) => string
  buildDefaultSubject: (args: { projectName: string; formattedShootDate: string }) => string
  renderHtml: (tpl: unknown, props: unknown) => Promise<string>
  renderText: (tpl: unknown, props: unknown) => Promise<string>
  CallSheetShareEmail: unknown
  CallSheetConfirmationReceipt: unknown
}

const baseShareProps = {
  recipientName: "Alex Rivera",
  projectName: "Unboundmerino FW26",
  formattedShootDate: "Thu, Sep 22, 2026",
  recipientCallTime: "6:30 AM",
  defaultCallTime: "7:00 AM",
  primaryLocationLabel: "Studio A",
  publisherName: "Ted Ghanime",
  publisherEmail: "ted@immediategroup.ca",
  emailMessage: null as string | null,
  shareUrl: "https://example.test/s/share.recipient",
  projectLogoUrl: null,
  requireConfirm: true,
  resend: false,
  resendReason: null,
  originalSentAtLabel: null,
  expiryLabel: null,
}

describe("buildShareUrl", () => {
  it("produces the compound-token URL for the reader route", () => {
    expect(
      emailsModule.buildShareUrl("shareAbc", "recipientXyz", "https://app.test"),
    ).toBe("https://app.test/s/shareAbc.recipientXyz")
  })

  it("strips a trailing slash on the base URL", () => {
    expect(
      emailsModule.buildShareUrl("s1", "r1", "https://app.test/"),
    ).toBe("https://app.test/s/s1.r1")
  })

  it("falls back to APP_URL env var when no appUrl is supplied", () => {
    const prev = process.env.APP_URL
    process.env.APP_URL = "https://env.test"
    try {
      expect(emailsModule.buildShareUrl("s", "r")).toBe("https://env.test/s/s.r")
    } finally {
      if (prev === undefined) delete process.env.APP_URL
      else process.env.APP_URL = prev
    }
  })
})

describe("buildRecipientsPanelUrl", () => {
  it("deep-links to the builder's recipients anchor", () => {
    expect(
      emailsModule.buildRecipientsPanelUrl({
        clientId: "c1",
        projectId: "p1",
        scheduleId: "sched1",
        appUrl: "https://app.test",
      }),
    ).toBe("https://app.test/clients/c1/projects/p1/schedules/sched1/callsheet#recipients")
  })
})

describe("buildDefaultSubject", () => {
  it("matches plan §7.3 Email 1 format", () => {
    expect(
      emailsModule.buildDefaultSubject({
        projectName: "Unboundmerino FW26",
        formattedShootDate: "Thu, Sep 22, 2026",
      }),
    ).toBe("Unboundmerino FW26 — Call Sheet for Thu, Sep 22, 2026")
  })
})

describe("CallSheetShareEmail template", () => {
  it("renders HTML containing recipient name and share URL", async () => {
    const html = await emailsModule.renderHtml(
      emailsModule.CallSheetShareEmail,
      baseShareProps,
    )
    expect(html).toContain("Alex Rivera")
    expect(html).toContain("Unboundmerino FW26")
    expect(html).toContain("https://example.test/s/share.recipient")
    expect(html).toContain("View Call Sheet")
  })

  it("renders plain text without HTML tags", async () => {
    const text = await emailsModule.renderText(
      emailsModule.CallSheetShareEmail,
      baseShareProps,
    )
    expect(text).not.toMatch(/<[a-z][^>]*>/i)
    expect(text).toContain("Alex Rivera")
    expect(text).toContain("https://example.test/s/share.recipient")
  })

  it("escapes <script> in the producer-supplied message (XSS)", async () => {
    const html = await emailsModule.renderHtml(emailsModule.CallSheetShareEmail, {
      ...baseShareProps,
      emailMessage: "<script>alert('xss')</script>",
    })
    // Must NOT contain a live <script> tag:
    expect(html).not.toMatch(/<script[^>]*>alert/)
    // But the escaped text must still be visible to the recipient:
    expect(html).toContain("&lt;script&gt;")
  })

  it("escapes <script> in the recipient name (XSS)", async () => {
    const html = await emailsModule.renderHtml(emailsModule.CallSheetShareEmail, {
      ...baseShareProps,
      recipientName: "<script>alert(1)</script>",
    })
    expect(html).not.toMatch(/<script[^>]*>alert/)
  })

  it("escapes <script> in the project name (XSS)", async () => {
    const html = await emailsModule.renderHtml(emailsModule.CallSheetShareEmail, {
      ...baseShareProps,
      projectName: "<script>alert(1)</script>",
    })
    expect(html).not.toMatch(/<script[^>]*>alert/)
  })

  it("renders the resend banner and [Resend] prefix-ready copy when resend=true", async () => {
    const html = await emailsModule.renderHtml(emailsModule.CallSheetShareEmail, {
      ...baseShareProps,
      resend: true,
      resendReason: "Weather update",
      originalSentAtLabel: "Oct 4 at 9:15 AM",
    })
    expect(html).toContain("resend of the call sheet")
    expect(html).toContain("Weather update")
    expect(html).toContain("Oct 4 at 9:15 AM")
  })

  it("omits the confirm hint when requireConfirm=false", async () => {
    const html = await emailsModule.renderHtml(emailsModule.CallSheetShareEmail, {
      ...baseShareProps,
      requireConfirm: false,
    })
    expect(html).not.toContain("asked you to confirm")
  })

  it("includes the expiry label when provided", async () => {
    const html = await emailsModule.renderHtml(emailsModule.CallSheetShareEmail, {
      ...baseShareProps,
      expiryLabel: "Link expires Oct 6, 2026",
    })
    expect(html).toContain("Link expires Oct 6, 2026")
  })
})

describe("CallSheetConfirmationReceipt template", () => {
  const props = {
    recipientName: "Alex Rivera",
    recipientRoleLabel: "1st AD",
    projectName: "Unboundmerino FW26",
    formattedShootDate: "Thu, Sep 22, 2026",
    confirmedAtLabel: "Sep 18 at 3:47 PM",
    confirmedCount: 3,
    recipientCount: 12,
    recipientsUrl:
      "https://app.test/clients/c1/projects/p1/schedules/s1/callsheet#recipients",
    publisherEmail: "ted@immediategroup.ca",
  }

  it("renders HTML with the confirm summary", async () => {
    const html = await emailsModule.renderHtml(
      emailsModule.CallSheetConfirmationReceipt,
      props,
    )
    expect(html).toContain("Alex Rivera")
    expect(html).toContain("1st AD")
    expect(html).toContain("3 of 12 recipients")
    expect(html).toContain(props.recipientsUrl)
  })

  it("renders plain text without HTML tags", async () => {
    const text = await emailsModule.renderText(
      emailsModule.CallSheetConfirmationReceipt,
      props,
    )
    expect(text).not.toMatch(/<[a-z][^>]*>/i)
    expect(text).toContain("Alex Rivera")
    expect(text).toContain("3 of 12 recipients")
  })

  it("escapes <script> in the recipient name (XSS)", async () => {
    const html = await emailsModule.renderHtml(
      emailsModule.CallSheetConfirmationReceipt,
      { ...props, recipientName: "<script>alert('x')</script>" },
    )
    expect(html).not.toMatch(/<script[^>]*>alert/)
  })
})

describe("sendCallSheetShareEmail (fail-open posture)", () => {
  it("returns ok:false with resend_not_configured when RESEND_API_KEY is missing", async () => {
    const prev = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    try {
      const result = await emailsModule.sendCallSheetShareEmail({
        recipient: {
          name: "Alex",
          email: "alex@example.test",
          callTime: null,
          roleLabel: null,
          token: "tok",
          shareGroupId: "grp",
        },
        share: {
          projectName: "P",
          formattedShootDate: "Thu",
          primaryLocationLabel: "Loc",
          defaultCallTime: null,
          projectLogoUrl: null,
          emailSubject: "S",
          emailMessage: null,
          requireConfirm: true,
          expiryLabel: null,
        },
        publisher: { name: "Ted", email: "ted@example.test" },
        appUrl: "https://app.test",
      })
      expect(result.ok).toBe(false)
      expect(result.error).toBe("resend_not_configured")
    } finally {
      if (prev !== undefined) process.env.RESEND_API_KEY = prev
    }
  })
})
