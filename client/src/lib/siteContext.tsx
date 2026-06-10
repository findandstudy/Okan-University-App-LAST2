import { createContext, useContext } from 'react';

interface SiteContextValue {
  tenantId: string | null;
  apiSuffix: string;
}

const SiteContext = createContext<SiteContextValue>({ tenantId: null, apiSuffix: '' });

export function SiteProvider({ tenantId, children }: { tenantId: string; children: React.ReactNode }) {
  return (
    <SiteContext.Provider value={{ tenantId, apiSuffix: `?_tid=${tenantId}` }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteContext() {
  return useContext(SiteContext);
}
