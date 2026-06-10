---
name: EmbeddableLayout pattern
description: Admin pages that accept an `embedded` prop must be wrapped in arrow functions when used as wouter Route components
---

## Rule
When an admin page component has a signature like `function Page({ embedded }: { embedded?: boolean } = {})`, it cannot be passed directly as `component={Page}` to wouter's `<Route>`. Wouter expects `ComponentType<RouteComponentProps<...>>` and the custom prop signature is incompatible.

**Fix:** Use an arrow function wrapper in App.tsx:
```tsx
<Route path="/admin/sections" component={() => <Sections />} />
```

**Why:** Wouter's RouteComponentProps passes route params to the component. A component with a custom prop type (even with default) doesn't satisfy `FunctionComponent<RouteComponentProps<...>>` because the parameter types are incompatible.

**How to apply:** Any time you add `embedded` (or any custom prop) to an admin page and register it as a wouter Route, always wrap it: `component={() => <YourPage />}`.
