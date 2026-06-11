import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import AdminLayout from './AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles, Upload, Trash2, CheckCircle, Calendar, Plus,
  ChevronLeft, ChevronRight, LayoutList, Image, Star,
  Search, ArrowUpDown, X,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useLocation } from 'wouter';

interface BlogPostWithTranslations {
  id: string;
  tenantId: string;
  status: string;
  publishAt: string | null;
  createdAt: string;
  keyword: string | null;
  backlinkSites: string[];
  isAiGenerated: boolean;
  featuredImageUrl: string | null;
  translations: Array<{
    id: string;
    lang: string;
    title: string;
    slug: string;
    content: string;
    metaTitle: string | null;
    metaDesc: string | null;
  }>;
}

interface BlogPostImage {
  id: string;
  postId: string;
  url: string;
  altByLang: Record<string, string> | null;
  attribution: string | null;
  source: string;
  position: number;
}

// ── Image Management Dialog ───────────────────────────────────────────────
function BlogImagesDialog({ post, onClose }: { post: BlogPostWithTranslations; onClose: () => void }) {
  const { toast } = useToast();
  const imgFileRef = useRef<HTMLInputElement>(null);
  const [generatingImage, setGeneratingImage] = useState(false);

  const { data: images = [], isLoading } = useQuery<BlogPostImage[]>({
    queryKey: ['/api/admin/blog', post.id, 'images'],
    queryFn: () => fetch(`/api/admin/blog/${post.id}/images`, { credentials: 'include' }).then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (imgId: string) => apiRequest('DELETE', `/api/admin/blog/${post.id}/images/${imgId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog', post.id, 'images'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog'] });
      toast({ title: 'Image deleted' });
    },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const setFeaturedMutation = useMutation({
    mutationFn: (img: BlogPostImage) => apiRequest('PATCH', `/api/admin/blog/${post.id}/featured-image`, {
      url: img.url,
      altByLang: img.altByLang || {},
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog'] });
      toast({ title: 'Featured image updated' });
    },
    onError: () => toast({ title: 'Failed to set featured image', variant: 'destructive' }),
  });

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    try {
      const res = await apiRequest('POST', `/api/admin/blog/${post.id}/generate-images`, {});
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Generation failed');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog', post.id, 'images'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog'] });
      toast({ title: 'Image generated!' });
    } catch (e: any) {
      toast({ title: 'Image generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/admin/blog/${post.id}/images/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog', post.id, 'images'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog'] });
      toast({ title: 'Image uploaded' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      if (imgFileRef.current) imgFileRef.current.value = '';
    }
  };

  const enTitle = post.translations.find(t => t.lang === 'en')?.title || post.keyword || '—';

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground line-clamp-1">{enTitle}</div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleGenerateImage} disabled={generatingImage} data-testid="button-generate-image">
          {generatingImage
            ? <><span className="w-3.5 h-3.5 mr-1.5 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" />Generating…</>
            : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate with AI / Stock</>
          }
        </Button>
        <input ref={imgFileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} data-testid="input-image-upload" />
        <Button size="sm" variant="outline" onClick={() => imgFileRef.current?.click()} data-testid="button-upload-image">
          <Upload className="w-3.5 h-3.5 mr-1.5" />Upload Image
        </Button>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading images…</div>
      ) : images.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
          No images yet. Generate one or upload manually.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {images.map(img => {
            const isFeatured = post.featuredImageUrl === img.url;
            return (
              <div key={img.id} data-testid={`blog-image-${img.id}`}
                className={`relative group rounded-lg overflow-hidden border-2 ${isFeatured ? 'border-primary' : 'border-border'}`}>
                <img src={img.url} alt={img.altByLang?.en || ''} className="w-full aspect-video object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!isFeatured && (
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setFeaturedMutation.mutate(img)} data-testid={`button-set-featured-${img.id}`}>
                      <Star className="w-3 h-3 mr-1" />Featured
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteMutation.mutate(img.id)} data-testid={`button-delete-image-${img.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {isFeatured && (
                  <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded">Featured</div>
                )}
                {img.source !== 'media_library' && img.source !== 'ai_openai' && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1.5 py-0.5 truncate">{img.attribution}</div>
                )}
                <div className="absolute top-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">
                  {img.source === 'ai_openai' ? 'AI' : img.source === 'stock_unsplash' ? 'Unsplash' : img.source === 'stock_pexels' ? 'Pexels' : 'Upload'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface BlogSchedule {
  id: string;
  dailyLimit: number;
  weekdays: string[];
  mode: string;
  isEnabled: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  taslak: 'bg-gray-100 text-gray-700',
  zamanli: 'bg-blue-100 text-blue-700',
  yayinda: 'bg-green-100 text-green-700',
  generating: 'bg-yellow-100 text-yellow-800 animate-pulse',
  failed: 'bg-red-100 text-red-700',
};

const WEEKDAY_LABELS: Record<string, string> = {
  '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat',
};

const STATUS_TABS = [
  { key: 'all',        label: 'All' },
  { key: 'yayinda',   label: 'Published' },
  { key: 'taslak',    label: 'Draft' },
  { key: 'zamanli',   label: 'Scheduled' },
  { key: 'generating',label: 'Generating' },
  { key: 'failed',    label: 'Failed' },
];

// ---- Calendar View Helper ----
function BlogCalendar({ posts }: { posts: BlogPostWithTranslations[] }) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const postsByDate: Record<string, BlogPostWithTranslations[]> = {};
  for (const post of posts) {
    if (!post.publishAt) continue;
    const d = new Date(post.publishAt);
    if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
      const key = d.toISOString().slice(0, 10);
      if (!postsByDate[key]) postsByDate[key] = [];
      postsByDate[key].push(post);
    }
  }

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); };
  const monthName = new Date(calYear, calMonth, 1).toLocaleString('en', { month: 'long', year: 'numeric' });
  const enTitle = (post: BlogPostWithTranslations) => post.translations.find(t => t.lang === 'en')?.title || post.keyword || '—';

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`blank-${i}`} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayPosts = postsByDate[key] || [];
    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    cells.push(
      <div key={key} data-testid={`calendar-day-${key}`}
        className={`min-h-[72px] border rounded-lg p-1.5 flex flex-col gap-1 ${isToday ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}>
        <span className={`text-xs font-semibold self-start px-1 rounded ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{day}</span>
        {dayPosts.map(post => (
          <div key={post.id} title={enTitle(post)}
            className={`text-[10px] leading-tight truncate px-1.5 py-0.5 rounded font-medium ${
              post.status === 'yayinda' ? 'bg-green-100 text-green-700' :
              post.status === 'zamanli' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
            {enTitle(post)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" /> Publish Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={prevMonth} data-testid="button-cal-prev"><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-sm font-medium w-36 text-center">{monthName}</span>
            <Button size="sm" variant="ghost" onClick={nextMonth} data-testid="button-cal-next"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-200 inline-block" />Published</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-200 inline-block" />Scheduled</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-gray-200 inline-block" />Draft</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">{cells}</div>
      </CardContent>
    </Card>
  );
}

export default function Blog() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [imagesPost, setImagesPost] = useState<BlogPostWithTranslations | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New post form
  const [newKeyword, setNewKeyword] = useState('');
  const [newBacklinks, setNewBacklinks] = useState('');
  const [newPublishAt, setNewPublishAt] = useState('');
  const [newStatus, setNewStatus] = useState('taslak');

  // Schedule form
  const [schedMode, setSchedMode] = useState('onay');
  const [schedLimit, setSchedLimit] = useState(1);
  const [schedWeekdays, setSchedWeekdays] = useState(['1','2','3','4','5']);
  const [schedEnabled, setSchedEnabled] = useState(false);

  // ── List management state ─────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'status'>('date_desc');
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const { data: posts = [], isLoading } = useQuery<BlogPostWithTranslations[]>({
    queryKey: ['/api/admin/blog'],
    refetchInterval: (query) => {
      const data = query.state.data as BlogPostWithTranslations[] | undefined;
      return data?.some(p => p.status === 'generating') ? 3000 : false;
    },
  });

  const { data: schedule } = useQuery<BlogSchedule | null>({
    queryKey: ['/api/admin/blog/schedule'],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/admin/blog', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog'] });
      setAddDialogOpen(false);
      setNewKeyword(''); setNewBacklinks(''); setNewPublishAt(''); setNewStatus('taslak');
      toast({ title: 'Post created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/admin/blog/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/blog'] }); toast({ title: 'Post deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/admin/blog/${id}/approve`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/blog'] }); toast({ title: 'Post published!' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const scheduleMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/admin/blog/schedule', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/blog/schedule'] }); setScheduleDialogOpen(false); toast({ title: 'Schedule saved' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── Bulk mutations ────────────────────────────────────────────────────────
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => apiRequest('POST', '/api/admin/blog/bulk-delete', { ids }).then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog'] });
      setSelectedIds(new Set());
      toast({ title: `${data.deleted ?? 0} posts deleted` });
    },
    onError: () => toast({ title: 'Bulk delete failed', variant: 'destructive' }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      apiRequest('POST', '/api/admin/blog/bulk-status', { ids, status }).then(r => r.json()),
    onSuccess: (data: any, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog'] });
      setSelectedIds(new Set());
      toast({ title: `${data.updated ?? 0} posts set to ${status === 'yayinda' ? 'Published' : 'Draft'}` });
    },
    onError: () => toast({ title: 'Bulk status update failed', variant: 'destructive' }),
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const enTitle = (post: BlogPostWithTranslations) =>
    post.translations.find(t => t.lang === 'en')?.title || post.keyword || '—';

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: posts.length };
    for (const p of posts) counts[p.status] = (counts[p.status] || 0) + 1;
    return counts;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    let result = [...posts];
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        enTitle(p).toLowerCase().includes(q) || (p.keyword || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'date_asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return result;
  }, [posts, statusFilter, searchQuery, sortBy]);

  const allFilteredSelected = filteredPosts.length > 0 && filteredPosts.every(p => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => { const next = new Set(prev); filteredPosts.forEach(p => next.delete(p.id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); filteredPosts.forEach(p => next.add(p.id)); return next; });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleGenerateAI = async (post: BlogPostWithTranslations) => {
    setGeneratingId(post.id);
    try {
      const res = await apiRequest('POST', `/api/admin/blog/${post.id}/generate`, {});
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog'] });
      if (data.backgroundTranslating) {
        toast({ title: 'English article ready!', description: 'Translating to 9 languages in the background — the status badge will update automatically.' });
      } else {
        toast({ title: `AI generated ${data.translations?.length || 0} translations` });
      }
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/admin/blog/import', { method: 'POST', body: formData, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog'] });
      toast({ title: `Imported ${data.imported} posts from Excel` });
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleWeekday = (day: string) =>
    setSchedWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Blog Management</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create, generate with AI, and schedule blog posts in 10 languages.
            </p>
          </div>
          <div className="flex gap-2">
            {/* View toggle */}
            <div className="flex rounded-md border overflow-hidden">
              <Button size="sm" variant={view === 'list' ? 'default' : 'ghost'} className="rounded-none border-0" onClick={() => setView('list')} data-testid="button-view-list">
                <LayoutList className="w-4 h-4 mr-1" />List
              </Button>
              <Button size="sm" variant={view === 'calendar' ? 'default' : 'ghost'} className="rounded-none border-0" onClick={() => setView('calendar')} data-testid="button-view-calendar">
                <Calendar className="w-4 h-4 mr-1" />Calendar
              </Button>
            </div>

            {/* Schedule dialog */}
            <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-blog-schedule">
                  <Calendar className="w-4 h-4 mr-2" />Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Publish Schedule</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-between">
                    <Label>Scheduler Enabled</Label>
                    <Switch checked={schedEnabled} onCheckedChange={setSchedEnabled} data-testid="switch-schedule-enabled" />
                  </div>
                  <div>
                    <Label>Mode</Label>
                    <Select value={schedMode} onValueChange={setSchedMode}>
                      <SelectTrigger data-testid="select-schedule-mode"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="otomatik">Automatic (publish when due)</SelectItem>
                        <SelectItem value="onay">Approval Queue (admin approves)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Daily Limit</Label>
                    <Input type="number" min={1} max={20} value={schedLimit} onChange={e => setSchedLimit(Number(e.target.value))} data-testid="input-schedule-limit" />
                  </div>
                  <div>
                    <Label>Active Days</Label>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {Object.entries(WEEKDAY_LABELS).map(([day, label]) => (
                        <button key={day} type="button" onClick={() => toggleWeekday(day)} data-testid={`day-${day}`}
                          className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${schedWeekdays.includes(day) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full"
                    onClick={() => scheduleMutation.mutate({ mode: schedMode, dailyLimit: schedLimit, weekdays: schedWeekdays, isEnabled: schedEnabled })}
                    disabled={scheduleMutation.isPending} data-testid="button-save-schedule">
                    Save Schedule
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Excel Import */}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} data-testid="input-excel-import" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-import-excel">
              <Upload className="w-4 h-4 mr-2" />Import Excel
            </Button>

            {/* Add post dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-post"><Plus className="w-4 h-4 mr-2" />New Post</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>New Blog Post</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Keyword *</Label>
                    <Input placeholder="e.g. study in Turkey 2025" value={newKeyword} onChange={e => setNewKeyword(e.target.value)} data-testid="input-post-keyword" />
                  </div>
                  <div>
                    <Label>Backlink Sites (comma-separated)</Label>
                    <Input placeholder="e.g. example.edu, partner.org" value={newBacklinks} onChange={e => setNewBacklinks(e.target.value)} data-testid="input-post-backlinks" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger data-testid="select-post-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="taslak">Draft (taslak)</SelectItem>
                        <SelectItem value="zamanli">Scheduled (zamanli)</SelectItem>
                        <SelectItem value="yayinda">Published (yayinda)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Publish At (optional)</Label>
                    <Input type="datetime-local" value={newPublishAt} onChange={e => setNewPublishAt(e.target.value)} data-testid="input-post-publish-at" />
                  </div>
                  <Button className="w-full" disabled={!newKeyword || createMutation.isPending}
                    onClick={() => createMutation.mutate({ keyword: newKeyword, backlinkSites: newBacklinks.split(',').map(s => s.trim()).filter(Boolean), status: newStatus, publishAt: newPublishAt || null })}
                    data-testid="button-create-post">
                    Create Post
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Excel import hint */}
        {view === 'list' && (
          <Card className="border-dashed border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-sm text-blue-700">
                <strong>Excel Import:</strong> Upload an .xlsx file with columns: <code>title</code>, <code>keyword</code> (or <code>anahtar_kelime</code>), <code>backlink_siteleri</code>. Each row becomes a draft post.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Calendar view */}
        {view === 'calendar' && <BlogCalendar posts={posts} />}

        {/* ── List view ─────────────────────────────────────────────────── */}
        {view === 'list' && (
          <Card>
            <CardHeader className="pb-3">
              {/* Status filter tabs */}
              <div className="flex flex-wrap gap-1 mb-3">
                {STATUS_TABS.map(tab => {
                  const count = statusCounts[tab.key] ?? 0;
                  if (tab.key !== 'all' && count === 0) return null;
                  return (
                    <button key={tab.key} onClick={() => { setStatusFilter(tab.key); setSelectedIds(new Set()); }}
                      data-testid={`tab-status-${tab.key}`}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                        statusFilter === tab.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-muted text-muted-foreground'
                      }`}>
                      {tab.label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === tab.key ? 'bg-white/20' : 'bg-muted'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search + sort row */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by title or keyword…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                    data-testid="input-blog-search"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="button-clear-search">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="h-8 text-sm w-44 gap-1.5" data-testid="select-sort-by">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Newest first</SelectItem>
                    <SelectItem value="date_asc">Oldest first</SelectItem>
                    <SelectItem value="status">By status</SelectItem>
                  </SelectContent>
                </Select>

                <span className="text-sm text-muted-foreground ml-auto">
                  {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Bulk action bar */}
              {someSelected && (
                <div className="flex items-center gap-2 pt-2 border-t mt-2" data-testid="bulk-action-bar">
                  <span className="text-sm font-medium text-primary" data-testid="text-selected-count">
                    {selectedIds.size} selected
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: 'yayinda' })}
                    disabled={bulkStatusMutation.isPending}
                    data-testid="button-bulk-publish">
                    <CheckCircle className="h-3 w-3" />Publish
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: 'taslak' })}
                    disabled={bulkStatusMutation.isPending}
                    data-testid="button-bulk-unpublish">
                    <X className="h-3 w-3" />Unpublish
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-xs gap-1"
                    onClick={() => setBulkDeleteConfirm(true)}
                    disabled={bulkDeleteMutation.isPending}
                    data-testid="button-bulk-delete">
                    <Trash2 className="h-3 w-3" />Delete
                  </Button>
                  <button onClick={() => setSelectedIds(new Set())} className="ml-1 text-muted-foreground hover:text-foreground" data-testid="button-clear-selection">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading…</div>
              ) : filteredPosts.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  {posts.length === 0
                    ? <><p>No blog posts yet.</p><p className="text-sm mt-1">Import an Excel file or create posts manually.</p></>
                    : <p>No posts match your filter.</p>
                  }
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>Title / Keyword</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Langs</TableHead>
                      <TableHead>Publish At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPosts.map(post => (
                      <TableRow key={post.id} data-testid={`blog-row-${post.id}`}
                        className={selectedIds.has(post.id) ? 'bg-primary/5' : ''}>
                        <TableCell className="pl-4">
                          <Checkbox
                            checked={selectedIds.has(post.id)}
                            onCheckedChange={() => toggleSelect(post.id)}
                            aria-label={`Select ${enTitle(post)}`}
                            data-testid={`checkbox-post-${post.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm line-clamp-1">{enTitle(post)}</div>
                          {post.keyword && post.translations.length > 0 && (
                            <div className="text-xs text-muted-foreground">{post.keyword}</div>
                          )}
                          {post.isAiGenerated && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              <Sparkles className="w-3 h-3 mr-1" />AI
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[post.status] || ''}`}>
                            {post.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {post.translations.map(t => (
                              <span key={t.lang}
                                className={`text-xs px-1.5 py-0.5 rounded font-mono ${t.content ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {t.lang}
                              </span>
                            ))}
                            {post.translations.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {post.publishAt ? formatDate(post.publishAt) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => handleGenerateAI(post)}
                              disabled={generatingId === post.id} data-testid={`button-generate-${post.id}`} title="Generate with AI">
                              <Sparkles className="w-3.5 h-3.5 mr-1" />
                              {generatingId === post.id ? 'Generating…' : 'AI Generate'}
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => setImagesPost(post)}
                              data-testid={`button-images-${post.id}`} title="Manage images"
                              className={post.featuredImageUrl ? 'text-primary border-primary/40' : ''}>
                              <Image className="w-3.5 h-3.5 mr-1" />Images{post.featuredImageUrl ? ' ✓' : ''}
                            </Button>

                            {post.status !== 'yayinda' && (
                              <Button size="sm" variant="outline" className="text-green-700 border-green-200 hover:bg-green-50"
                                onClick={() => approveMutation.mutate(post.id)} disabled={approveMutation.isPending}
                                data-testid={`button-approve-${post.id}`} title="Publish now">
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />Publish
                              </Button>
                            )}

                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                              onClick={() => deleteMutation.mutate(post.id)} disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${post.id}`} title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Approval queue (onay mode) */}
        {schedule?.mode === 'onay' && schedule?.isEnabled && (
          <Card>
            <CardHeader><CardTitle className="text-base">Approval Queue</CardTitle></CardHeader>
            <CardContent>
              {posts.filter(p => p.status === 'zamanli').length === 0 ? (
                <p className="text-sm text-muted-foreground">No posts waiting for approval.</p>
              ) : (
                <div className="space-y-2">
                  {posts.filter(p => p.status === 'zamanli').map(post => (
                    <div key={post.id} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">{enTitle(post)}</span>
                      <Button size="sm" onClick={() => approveMutation.mutate(post.id)} disabled={approveMutation.isPending} data-testid={`button-queue-approve-${post.id}`}>
                        <CheckCircle className="w-4 h-4 mr-1" />Approve & Publish
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Images management dialog */}
      <Dialog open={!!imagesPost} onOpenChange={open => { if (!open) setImagesPost(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Image className="w-4 h-4" />Blog Post Images</DialogTitle>
          </DialogHeader>
          {imagesPost && <BlogImagesDialog post={imagesPost} onClose={() => setImagesPost(null)} />}
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} post{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.size} selected post{selectedIds.size !== 1 ? 's' : ''} and all their translations and images. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-bulk-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setBulkDeleteConfirm(false); bulkDeleteMutation.mutate(Array.from(selectedIds)); }}
              data-testid="button-bulk-delete-confirm"
            >
              Delete {selectedIds.size} post{selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
