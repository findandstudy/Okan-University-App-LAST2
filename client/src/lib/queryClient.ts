import { QueryClient, QueryFunction } from "@tanstack/react-query";

// In the admin preview, the public site loads inside an iframe at
// `/<lang>?_tid=<tenant>`. The public SPA's data calls (e.g. /api/sections)
// otherwise carry no tenant and resolve to the host (the default site), so the
// preview showed the default site's content instead of the previewed one.
// Forward the page URL's _tid to our own /api/* requests. Real public sites on
// their own domain have no _tid (host resolution); admin pages use path params
// and pass their own _tid explicitly, so this is a no-op there.
function withTenantScope(url: string): string {
  try {
    if (typeof window === "undefined") return url;
    const pageTid = new URLSearchParams(window.location.search).get("_tid");
    if (!pageTid) return url;
    if (!url.startsWith("/api/")) return url;
    if (/[?&]_tid=/.test(url)) return url;
    return url + (url.includes("?") ? "&" : "?") + "_tid=" + encodeURIComponent(pageTid);
  } catch {
    return url;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(withTenantScope(url), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(withTenantScope(queryKey.join("/") as string), {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
