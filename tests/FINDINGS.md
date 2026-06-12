# Smoke Test Findings — Real Bugs & Risks

These findings were identified during code analysis while writing the smoke tests.
**No production code was changed.** Each finding is documented with its location and severity.
Fixes require deliberate decisions from the team.

---

## FINDING-001 — IDOR: Image endpoint has no tenant ownership check

**Severity:** Medium  
**File:** `server/routes.ts:217` (`GET /api/img/:id`)  
**Also affected:** `GET /objects/{*objectPath}` (line 195)

### Description
The `/api/img/:id` endpoint reads files by UUID from `uploads/` without verifying that the requested image UUID belongs to the current tenant (resolved from the `Host` header).

```ts
// routes.ts:235 — no tenant check before serving the file
buffer = readUpload(`/objects/uploads/${id}`);
```

### Impact
Any client that learns (or guesses) the UUID of an image uploaded by **Tenant A** can retrieve it by making a request to **Tenant B's domain**. UUIDs are not easily guessable, but:
- They may appear in exported ZIPs, API responses, or HTML source
- They are logged by web servers and monitoring tools

### Verified by test
`tests/tenantIsolation.test.ts` — `[IDOR-DOC]` test (passes, documenting current behavior)

### Suggested fix
Add a `mediaAssets` table lookup before serving: verify the UUID belongs to `req.tenantId`. For the `/objects/` route, apply the same lookup before streaming the file.

---

## FINDING-002 — IDOR: updateSection does not verify tenant ownership at the DB level

**Severity:** Medium  
**File:** `server/storage.ts:236` (`updateSection`)

### Description
The `updateSection` storage method takes only `(id, data)` — it does **not** filter by `tenantId` in the SQL `WHERE` clause:

```ts
async updateSection(id: string, data: Partial<InsertSection>) {
  const [updated] = await db.update(sections)
    .set(data as any)
    .where(eq(sections.id, id))   // ← no tenantId filter
    .returning();
  return updated;
}
```

The corresponding route (`PATCH /api/sections/:id`) relies solely on `requireAdminTenantAccess` middleware for isolation. If that middleware is ever bypassed (e.g., superadmin acting on behalf of another tenant via `?_tid=`), a section from any tenant can be modified.

By contrast, `deleteSection` correctly includes `tenantId` in the WHERE clause.

### Suggested fix
Add a `tenantId: string` parameter to `updateSection` and include `eq(sections.tenantId, tenantId)` in the WHERE clause, matching the pattern used by `deleteSection`.

---

## FINDING-003 — In-memory bootstrap cache is not multi-instance safe

**Severity:** Low (current deployment) / High (future scale)  
**File:** `server/routes.ts:48` (`bootstrapCache`)

### Description
```ts
const bootstrapCache = new Map<string, { data: any; timestamp: number }>();
```

This cache lives in the Node.js process memory. If the app runs behind a load balancer with multiple instances, each instance has its own cache. Cache invalidation (e.g., after `PATCH /api/tenant`) only clears the cache on the instance that handled the write.

### Impact
After an admin updates tenant settings, some users may continue seeing stale data for up to 60 seconds on instances whose cache was not invalidated.

### Suggested fix
Replace with Redis (`ioredis`/`@upstash/redis`) or use a shorter TTL.

---

## FINDING-004 — No CAPTCHA or rate limit on the public application form

**Severity:** Medium  
**File:** `/api/leads` (application intake endpoint)

### Description
The public `/api/leads` route (student application form) has no CAPTCHA challenge and no IP-level rate limiting. The existing rate limiters only cover `/api/admin/login` and `/api/upload`.

### Impact
The leads database can be flooded with synthetic submissions, degrading CRM quality and potentially exhausting storage.

### Suggested fix
Add `express-rate-limit` to the leads endpoint (e.g., 5 submissions/minute per IP) and optionally integrate hCaptcha or Cloudflare Turnstile on the frontend form.

---

## FINDING-005 — Superadmin session compromise = full breach of all tenants

**Severity:** High  
**File:** `server/routes.ts` — session-based auth, no MFA

### Description
The `super_admin` role bypasses all tenant isolation checks. If a superadmin session cookie is stolen (XSS, network sniff, leaked logs), the attacker gains full read/write access to every tenant's content, leads, blog posts, and settings.

### Current mitigations
- `httpOnly` cookie flag (blocks JS access in modern browsers)
- `sameSite: 'lax'` (limits CSRF)
- Login rate limiting (20/15 min)

### Missing mitigations
- No MFA (TOTP / email OTP)
- No IP allowlisting for superadmin
- No session activity logging / anomaly detection

### Suggested fix
Add TOTP-based MFA for `super_admin` accounts as a minimum. Consider IP allowlisting for superadmin login.

---

## Summary Table

| # | Finding | Severity | Fix effort |
|---|---------|----------|------------|
| 001 | `/api/img/:id` no tenant check (IDOR) | Medium | Low — add mediaAssets lookup |
| 002 | `updateSection` no tenant filter in SQL | Medium | Low — add WHERE clause |
| 003 | In-memory cache not multi-instance safe | Low/High | Medium — Redis migration |
| 004 | No CAPTCHA / rate limit on leads endpoint | Medium | Low — rate limiter |
| 005 | Superadmin MFA missing | High | Medium — TOTP integration |
