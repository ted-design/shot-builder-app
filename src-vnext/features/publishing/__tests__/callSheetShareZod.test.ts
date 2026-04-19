import { describe, it, expect } from "vitest"
import { Timestamp } from "firebase/firestore"
import {
  callSheetShareSchema,
  callSheetShareRecipientSchema,
  callSheetShareSnapshotSchema,
  publishCallSheetRequestSchema,
  recordCallSheetShareViewRequestSchema,
  confirmCallSheetShareRequestSchema,
} from "../lib/callSheetShareZod"

const ts = (seconds = 1_700_000_000) => Timestamp.fromMillis(seconds * 1000)

const validSnapshot = {
  title: "Day 3 — 1st Unit — Sep 22",
  date: ts(),
  sections: [],
  dayDetails: null,
  schedule: null,
  talentCalls: [],
  crewCalls: [],
  clientCalls: [],
  locations: [],
  projectName: "Fall 2026 Campaign",
  clientName: "Immediate Group",
  brand: { logoUrl: null, primaryColor: null },
}

const validShare = {
  id: "share-1",
  clientId: "client-1",
  projectId: "project-1",
  scheduleId: "schedule-1",
  callSheetConfigId: "config-1",
  createdAt: ts(),
  createdBy: "user-1",
  enabled: true,
  expiresAt: ts(1_800_000_000),
  shootDate: ts(1_750_000_000),
  snapshot: validSnapshot,
  emailSubject: "Day 3 call sheet",
  emailMessage: null,
  requireConfirm: true,
  recipientCount: 3,
  viewedCount: 0,
  confirmedCount: 0,
}

const validRecipient = {
  id: "token-abc",
  shareGroupId: "share-1",
  personId: "talent-1",
  personKind: "talent" as const,
  name: "Jane Doe",
  roleLabel: "Lead Talent",
  email: "jane@example.com",
  phone: null,
  callTime: "07:30",
  precallTime: null,
  channel: "email" as const,
  emailSentAt: ts(),
  emailSendError: null,
  emailSendAttempts: 1,
  viewCount: 0,
  firstViewedAt: null,
  lastViewedAt: null,
  isConfirmed: false,
  confirmedAt: null,
  confirmIpHash: null,
  createdAt: ts(),
  revokedAt: null,
}

describe("callSheetShareSnapshotSchema", () => {
  it("accepts a minimal valid snapshot", () => {
    expect(() => callSheetShareSnapshotSchema.parse(validSnapshot)).not.toThrow()
  })

  it("rejects a snapshot missing projectName", () => {
    const bad = { ...validSnapshot, projectName: undefined }
    expect(() => callSheetShareSnapshotSchema.parse(bad)).toThrow()
  })

  it("allows null date, dayDetails, schedule", () => {
    const shape = {
      ...validSnapshot,
      date: null,
      dayDetails: null,
      schedule: null,
    }
    expect(() => callSheetShareSnapshotSchema.parse(shape)).not.toThrow()
  })
})

describe("callSheetShareSchema", () => {
  it("accepts a valid share doc", () => {
    expect(() => callSheetShareSchema.parse(validShare)).not.toThrow()
  })

  it("allows expiresAt: null (no-expiry shares)", () => {
    const share = { ...validShare, expiresAt: null }
    expect(() => callSheetShareSchema.parse(share)).not.toThrow()
  })

  it("rejects a share with non-boolean enabled", () => {
    const bad = { ...validShare, enabled: "yes" }
    expect(() => callSheetShareSchema.parse(bad)).toThrow()
  })

  it("rejects a share with missing clientId", () => {
    const { clientId: _clientId, ...rest } = validShare
    expect(() => callSheetShareSchema.parse(rest)).toThrow()
  })

  it("rejects negative counters", () => {
    const bad = { ...validShare, recipientCount: -1 }
    expect(() => callSheetShareSchema.parse(bad)).toThrow()
  })

  it("rejects an emailSubject that is too long", () => {
    const bad = { ...validShare, emailSubject: "x".repeat(501) }
    expect(() => callSheetShareSchema.parse(bad)).toThrow()
  })
})

describe("callSheetShareRecipientSchema", () => {
  it("accepts a valid recipient doc", () => {
    expect(() => callSheetShareRecipientSchema.parse(validRecipient)).not.toThrow()
  })

  it("allows personId: null for ad-hoc recipients", () => {
    const adhoc = {
      ...validRecipient,
      personId: null,
      personKind: "adhoc" as const,
    }
    expect(() => callSheetShareRecipientSchema.parse(adhoc)).not.toThrow()
  })

  it("rejects personKind outside the allowed enum", () => {
    const bad = { ...validRecipient, personKind: "vendor" }
    expect(() => callSheetShareRecipientSchema.parse(bad)).toThrow()
  })

  it("rejects channel other than 'email' (v1 is email-only)", () => {
    const bad = { ...validRecipient, channel: "sms" }
    expect(() => callSheetShareRecipientSchema.parse(bad)).toThrow()
  })

  it("rejects an invalid email address", () => {
    const bad = { ...validRecipient, email: "not-an-email" }
    expect(() => callSheetShareRecipientSchema.parse(bad)).toThrow()
  })

  it("rejects negative viewCount or emailSendAttempts", () => {
    expect(() =>
      callSheetShareRecipientSchema.parse({ ...validRecipient, viewCount: -1 }),
    ).toThrow()
    expect(() =>
      callSheetShareRecipientSchema.parse({
        ...validRecipient,
        emailSendAttempts: -1,
      }),
    ).toThrow()
  })
})

describe("publishCallSheetRequestSchema", () => {
  it("accepts a minimal valid publish request", () => {
    const payload = {
      clientId: "c",
      projectId: "p",
      scheduleId: "s",
      callSheetConfigId: "cfg",
      emailSubject: "Subject line",
      emailMessage: null,
      requireConfirm: true,
      recipients: [
        {
          personId: "t-1",
          personKind: "talent" as const,
          name: "Jane",
          email: "jane@example.com",
        },
      ],
      publishAttemptId: "attempt-123",
    }
    expect(() => publishCallSheetRequestSchema.parse(payload)).not.toThrow()
  })

  it("rejects an empty recipients list", () => {
    const payload = {
      clientId: "c",
      projectId: "p",
      scheduleId: "s",
      callSheetConfigId: "cfg",
      emailSubject: "Subject",
      emailMessage: null,
      requireConfirm: false,
      recipients: [],
      publishAttemptId: "attempt-1",
    }
    expect(() => publishCallSheetRequestSchema.parse(payload)).toThrow()
  })

  it("rejects a recipient with an invalid email", () => {
    const payload = {
      clientId: "c",
      projectId: "p",
      scheduleId: "s",
      callSheetConfigId: "cfg",
      emailSubject: "Subject",
      emailMessage: null,
      requireConfirm: false,
      recipients: [
        {
          personId: null,
          personKind: "adhoc" as const,
          name: "X",
          email: "oops",
        },
      ],
      publishAttemptId: "a1",
    }
    expect(() => publishCallSheetRequestSchema.parse(payload)).toThrow()
  })
})

describe("recordCallSheetShareViewRequestSchema", () => {
  it("accepts a valid compound token", () => {
    expect(() =>
      recordCallSheetShareViewRequestSchema.parse({
        token: "shareGroup123.recipientToken456",
      }),
    ).not.toThrow()
  })

  it("rejects a token that is missing the '.' separator", () => {
    expect(() =>
      recordCallSheetShareViewRequestSchema.parse({ token: "nodotsatall" }),
    ).toThrow()
  })

  it("rejects an empty token", () => {
    expect(() =>
      recordCallSheetShareViewRequestSchema.parse({ token: "" }),
    ).toThrow()
  })
})

describe("confirmCallSheetShareRequestSchema", () => {
  it("accepts confirm=true + a valid token", () => {
    expect(() =>
      confirmCallSheetShareRequestSchema.parse({
        token: "shareGroup123.recipientToken456",
        confirm: true,
      }),
    ).not.toThrow()
  })

  it("rejects confirm=false (Q6 = A, once-confirmed-always-confirmed)", () => {
    expect(() =>
      confirmCallSheetShareRequestSchema.parse({
        token: "shareGroup123.recipientToken456",
        confirm: false,
      }),
    ).toThrow()
  })
})
