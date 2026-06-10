---
name: SiteEditor _tid pattern
description: How multi-tenant admin editing works via SiteProvider + ?_tid= query override
---

## Rule
The Sites Hub uses `SiteProvider tenantId={id}` (from `client/src/lib/siteContext.tsx`) to wrap SiteEditor children. All embedded admin components call `useSiteContext()` to get `apiSuffix = '?_tid=tenantId'` and append it to all API query keys and mutation URLs.

On the backend, `resolveTenant` middleware checks `req.session?.adminId && req.query._tid` to allow authenticated admins to target any tenant.

**Why:** This avoids a separate admin API namespace per tenant — existing admin routes work for any tenant by appending `?_tid=<tenantId>` when called from SiteEditor context.

**How to apply:** Any new admin page that should be embeddable in SiteEditor must:
1. Accept `{ embedded?: boolean }` prop
2. Call `const { apiSuffix } = useSiteContext()` 
3. Append `apiSuffix` to all query keys and mutation URLs
4. Use `EmbeddableLayout` to skip AdminLayout when embedded
