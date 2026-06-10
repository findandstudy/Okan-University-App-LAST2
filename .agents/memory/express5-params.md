---
name: Express 5 params typing
description: req.params values are typed as string | string[] in Express 5 — always cast
---

## Rule
In Express 5 (used in this project), `req.params.id` has type `string | string[]`, not just `string`. Passing it directly to functions expecting `string` causes TypeScript error TS2345.

**Fix:** Always destructure or cast at the top of the route handler:
```typescript
app.get('/api/resource/:id', async (req, res) => {
  const id = req.params.id as string;
  // now use `id` throughout
});
```

**Why:** Express 5 broadened the params type. The `as string` cast is safe because Express route param matching always gives a single string value in practice.

**How to apply:** Apply to every new route handler with `:param` segments before passing to storage methods.
