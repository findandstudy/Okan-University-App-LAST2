---
name: EmbeddableLayout pattern
description: How admin pages support both standalone (/admin/hero) and embedded (SiteEditor tab) rendering
---

Each embeddable admin page defines a local `EmbeddableLayout` component:
```tsx
function EmbeddableLayout({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}
```

**Function signature** uses default destructuring so the page works with and without props:
```tsx
export default function HeroContent({ embedded }: { embedded?: boolean } = {}) {
```

**App.tsx** wraps these pages in arrow functions to satisfy wouter's RouteComponentProps typing:
```tsx
<Route path="/admin/hero" component={() => <HeroContent />} />
```

**apiSuffix** from `useSiteContext()` is appended to ALL queryKeys and mutation URLs so each tenant's data is isolated when embedded in SiteEditor.

**Why:** Without EmbeddableLayout, embedding inside SiteEditor would show double AdminLayout chrome. Without apiSuffix, all tenant editors would share the same React Query cache key and mutate the wrong tenant.

**How to apply:** Any new admin page that should appear as a SiteEditor tab must follow this exact pattern. Add it to SiteEditor's `<Tabs>` section with `embedded` prop.
