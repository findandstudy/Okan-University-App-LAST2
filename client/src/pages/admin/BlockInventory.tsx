import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import AdminLayout from './AdminLayout';
import AdminErrorState from '@/components/admin/AdminErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, ChevronDown, ChevronRight, ExternalLink, Layers } from 'lucide-react';

const ALL_LANGS = ['en', 'ar', 'tr', 'fr', 'ru', 'fa', 'zh', 'hi', 'es', 'id'];

interface TenantUsage {
  tenantId: string;
  universityName: string;
  domain: string;
  status: string;
  isEnabled: boolean;
  displayOrder: number;
  langsWithContent: string[];
}

interface BlockEntry {
  sectionKey: string;
  totalTenants: number;
  activeCount: number;
  inactiveCount: number;
  tenants: TenantUsage[];
}

interface InventoryResponse {
  inventory: BlockEntry[];
}

export default function BlockInventory() {
  const [search, setSearch] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<InventoryResponse>({
    queryKey: ['/api/admin/blocks/inventory'],
  });

  const inventory = data?.inventory ?? [];

  const filtered = inventory.filter(entry => {
    const q = search.toLowerCase();
    if (!q) return true;
    if (entry.sectionKey.toLowerCase().includes(q)) return true;
    return entry.tenants.some(t =>
      t.universityName.toLowerCase().includes(q) ||
      t.domain.toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6" data-testid="page-block-inventory">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6" />
              Block Inventory
            </h1>
            <p className="text-muted-foreground">
              Cross-site view of which sections are used where (read-only)
            </p>
          </div>
          {data && (
            <Badge variant="secondary" className="text-sm">
              {inventory.length} unique blocks · {inventory.reduce((s, e) => s + e.totalTenants, 0)} total usages
            </Badge>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by section or site name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-block-search"
          />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading inventory…
          </div>
        )}

        {!isLoading && isError && (
          <AdminErrorState error={error} queryKey={['/api/admin/blocks/inventory']} />
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            {search ? 'No blocks match your search.' : 'No section data found.'}
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(entry => {
            const isOpen = expandedKey === entry.sectionKey;
            const tenantRows = search
              ? entry.tenants.filter(t =>
                  t.universityName.toLowerCase().includes(search.toLowerCase()) ||
                  t.domain.toLowerCase().includes(search.toLowerCase()) ||
                  entry.sectionKey.toLowerCase().includes(search.toLowerCase())
                )
              : entry.tenants;

            return (
              <Card key={entry.sectionKey} data-testid={`card-block-${entry.sectionKey}`}>
                <CardHeader
                  className="cursor-pointer select-none py-4"
                  onClick={() => setExpandedKey(isOpen ? null : entry.sectionKey)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <CardTitle className="text-base font-mono">{entry.sectionKey}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{entry.totalTenants} site{entry.totalTenants !== 1 ? 's' : ''}</Badge>
                      {entry.activeCount > 0 && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {entry.activeCount} active
                        </Badge>
                      )}
                      {entry.inactiveCount > 0 && (
                        <Badge variant="secondary">{entry.inactiveCount} inactive</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isOpen && (
                  <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-2 pr-4 font-medium">Site</th>
                            <th className="text-left py-2 pr-4 font-medium">Domain</th>
                            <th className="text-left py-2 pr-4 font-medium">Status</th>
                            <th className="text-left py-2 pr-4 font-medium">Enabled</th>
                            <th className="text-left py-2 pr-4 font-medium">Languages with content</th>
                            <th className="py-2 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {tenantRows.map(t => {
                            const missing = ALL_LANGS.filter(l => !t.langsWithContent.includes(l));
                            return (
                              <tr
                                key={t.tenantId}
                                className="border-b last:border-0"
                                data-testid={`row-block-${entry.sectionKey}-${t.tenantId}`}
                              >
                                <td className="py-2 pr-4 font-medium">{t.universityName}</td>
                                <td className="py-2 pr-4 text-muted-foreground font-mono text-xs">{t.domain}</td>
                                <td className="py-2 pr-4">
                                  <Badge
                                    variant={t.status === 'yayinda' ? 'default' : 'secondary'}
                                    className={t.status === 'yayinda' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}
                                  >
                                    {t.status}
                                  </Badge>
                                </td>
                                <td className="py-2 pr-4">
                                  <Badge variant={t.isEnabled ? 'default' : 'outline'}>
                                    {t.isEnabled ? 'Yes' : 'No'}
                                  </Badge>
                                </td>
                                <td className="py-2 pr-4">
                                  <div className="flex flex-wrap gap-1">
                                    {ALL_LANGS.map(lang => (
                                      <span
                                        key={lang}
                                        title={t.langsWithContent.includes(lang) ? `${lang} — has content` : `${lang} — empty`}
                                        className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono font-medium ${
                                          t.langsWithContent.includes(lang)
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                            : 'bg-muted text-muted-foreground'
                                        }`}
                                        data-testid={`lang-badge-${lang}-${t.tenantId}`}
                                      >
                                        {lang}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-2 text-right">
                                  <Link href={`/admin/sites/${t.tenantId}`}>
                                    <Button variant="ghost" size="sm" data-testid={`link-edit-${t.tenantId}`}>
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      Edit
                                    </Button>
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
