# Cloud Functions

Firebase Cloud Functions for Production Hub, deployed to region
`northamerica-northeast1`. Runtime: Node 20.

## Layout

```
functions/
├── index.js                            # Entry point: exports + queue dispatcher
├── email.js                            # Invitation + shot-request Resend integration
├── src/
│   ├── callSheetShares.js              # Phase 3 publishing handlers (5)
│   ├── callSheetShareSnapshot.js       # Pure snapshot builder for callSheetShares
│   └── callSheetEmails/
│       ├── index.js                    # sendCallSheetShareEmail / Receipt / Resend
│       ├── render.js                   # @react-email/render wrappers
│       └── templates/
│           ├── CallSheetShareEmail.js
│           ├── CallSheetConfirmationReceipt.js
│           └── shared/
│               ├── EmailLayout.js
│               ├── EmailHeader.js
│               ├── EmailButton.js
│               ├── EmailFooter.js
│               └── tokens.js           # Email-safe design tokens
└── scripts/                            # Admin + user-management scripts
```

## Phase 3 publishing API — `callSheetShares`

The five handlers below live in `src/callSheetShares.js` and are wired in
`index.js`. Plan reference: `/Users/tedghanime/.claude/plans/phase-3-publishing.md` §4.

### `publishCallSheet` (queue)

Queue doc at `/_functionQueue/{docId}` with:

```js
{
  action: "publishCallSheet",
  createdBy: "<uid>",
  data: {
    projectId, scheduleId, callSheetConfigId,
    emailSubject, emailMessage, requireConfirm,
    recipients: [{ personKind, name, email, personId?, roleLabel?, callTime?, precallTime?, phone? }],
    publishAttemptId,   // client-generated idempotency key
  }
}
```

**Auth:** producer or admin on the project (`clientId` scoped).

**Returns:** `{ shareGroupId, recipientCount, failedSends, deduped }`.

**Idempotency:** re-submitting the same `publishAttemptId` returns the original
`shareGroupId` without creating or re-sending (plan §4.5).

**Side effects:**
1. Reads upstream schedule / callSheet config / dayDetails / tracks / entries /
   talent/crew/client calls / locations / rosters / project / client docs.
2. Builds an immutable snapshot (`buildCallSheetShareSnapshot`).
3. Writes `callSheetShares/{shareGroupId}` + N `recipients/{token}` docs in a
   single batched write.
4. Computes `expiresAt = shootDate + 14 days` (Q2 = B).
5. Sends the initial email to each recipient via Resend. Send failures are
   recorded on the recipient row as `emailSendError` and do NOT fail the publish.

### `recordCallSheetShareView` (https onRequest)

POST to the function URL with:

```json
{ "token": "{shareGroupId}.{recipientToken}" }
```

**Auth:** none — anonymous reader. CORS open.

**Returns:** `{ ok: true, throttled: boolean }`.

**Rate limit:** 10-second window per recipient (plan §4.3). Throttled responses
still return 200.

### `confirmCallSheetShare` (https onRequest)

POST with:

```json
{ "token": "{shareGroupId}.{recipientToken}", "confirm": true }
```

**Auth:** none — anonymous reader.

**Returns:** `{ ok: true, alreadyConfirmed: boolean }`.

**Side effects:**
- Transactional: flips `recipients.{token}.isConfirmed=true` + increments
  `callSheetShares.{id}.confirmedCount`.
- Writes `confirmIpHash` (SHA-256(`CALLSHEET_IP_HASH_SALT:ip`)).
- Sends a confirmation-receipt email to the publisher via Resend (fail-open).
- Q6 = A: duplicate confirms are no-ops (`alreadyConfirmed: true`).

### `resendCallSheetShare` (queue)

Queue doc with:

```js
{
  action: "resendCallSheetShare",
  createdBy: "<uid>",
  data: { shareGroupId, tokens: ["r1", "r2", ...], reason? }
}
```

**Auth:** producer or admin, must match `share.clientId`.

**Returns:** `{ shareGroupId, attempted, failedSends, results: [{ token, ok, error }] }`.

Email uses the same template as the initial send with `resend: true` which
renders a "This is a resend" banner. Subject is prefixed `[Resend]`.

### `revokeCallSheetShare` (queue)

```js
{
  action: "revokeCallSheetShare",
  createdBy: "<uid>",
  data: { shareGroupId, tokens?: [] }   // empty/absent = whole-share revoke
}
```

**Auth:** producer or admin, must match `share.clientId`.

**Behavior:**
- `tokens` absent/empty → flips `share.enabled=false`. Idempotent.
- `tokens` present → sets `revokedAt` on each listed recipient.

## Environment

Required (set via `firebase functions:config:set`):

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Email delivery (Resend). Missing = logs warning, send skipped (fail-open). |
| `CALLSHEET_IP_HASH_SALT` | Salt for the `confirmIpHash` digest. Missing = uses a dev-only fallback (log warning). |
| `APP_URL` | Base URL for `/s/:token` reader links. Defaults to `https://um-shotbuilder.web.app`. |
| `SUPER_ADMIN_EMAIL` | Fallback super-admin when `systemAdmins` collection is unreachable. |

## Tests

Functions code is exercised by vitest via the main repo's test harness
(`CI=1 npm test -- --run`). Test files live in
`src-vnext/features/publishing/__tests__/` and require the functions modules
directly through `node:module.createRequire`.

Integration tests gated on `FIRESTORE_EMULATOR_HOST`:
- `callSheetSharesHandlers.integration.test.ts` — emulator-backed coverage
  for view/confirm/resend/revoke handlers.
- `callSheetShare.rules.test.ts` (sub-phase 3.0) — firestore.rules surface.

Both auto-skip locally without the emulator. CI (`ui-checks.yml`) starts the
emulator on port 8080 and runs them.

## React Email templates

Templates in `src/callSheetEmails/templates/` use `@react-email/components`
with `React.createElement` (no JSX syntax) so they deploy without a build
step. Tokens live in `templates/shared/tokens.js` and are duplicated from
the app's design system — email HTML requires table-safe inline styles that
don't benefit from the app's token pipeline.

## Deploy

```bash
npm run deploy          # all functions
firebase deploy --only functions:publishCallSheet  # targeted
```

The predeploy lint runs automatically.
