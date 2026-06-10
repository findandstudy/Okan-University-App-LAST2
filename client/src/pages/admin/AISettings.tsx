import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import AdminLayout from './AdminLayout';
import { useSiteContext } from '@/lib/siteContext';

function EmbeddableLayout({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}

const ANTHROPIC_MODELS = [
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (fast, affordable)' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (balanced)' },
  { value: 'claude-opus-4-5', label: 'Claude Opus 4 (most capable)' },
];

const OPENAI_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (fast, affordable)' },
  { value: 'gpt-4o', label: 'GPT-4o (balanced)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (most capable)' },
];

interface AISettingsData {
  provider: string;
  model: string;
  hasApiKey: boolean;
}

export default function AISettings({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { apiSuffix, tenantId } = useSiteContext();
  const [, navigate] = useLocation();
  useEffect(() => { if (!embedded && !tenantId) navigate('/admin/sites'); }, [embedded, tenantId]);

  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [model, setModel] = useState('claude-3-5-haiku-20241022');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

  const { data: settings, isLoading } = useQuery<AISettingsData>({
    queryKey: ['/api/admin/ai-settings' + apiSuffix],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ai-settings${apiSuffix}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (settings) {
      setProvider((settings.provider as any) || 'anthropic');
      setModel(settings.model || 'claude-3-5-haiku-20241022');
    }
  }, [settings]);

  useEffect(() => {
    if (provider === 'anthropic') setModel('claude-3-5-haiku-20241022');
    else setModel('gpt-4o-mini');
  }, [provider]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: any = { provider, model };
      if (apiKey) body.apiKey = apiKey;
      const res = await apiRequest('POST', `/api/admin/ai-settings${apiSuffix}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-settings' + apiSuffix] });
      toast({ title: 'AI settings saved' });
      setApiKey('');
    },
    onError: () => toast({ title: 'Failed to save', variant: 'destructive' }),
  });

  const handleTest = async () => {
    setTestStatus('testing');
    try {
      const body: any = { provider, model };
      if (apiKey) body.apiKey = apiKey;
      const res = await apiRequest('POST', `/api/admin/ai/test${apiSuffix}`, body);
      const data = await res.json();
      setTestStatus(data.success ? 'ok' : 'fail');
      if (data.success) toast({ title: 'Connection successful!', description: 'AI is responding correctly.' });
      else toast({ title: 'Connection failed', description: data.error || 'Check your API key.', variant: 'destructive' });
    } catch {
      setTestStatus('fail');
      toast({ title: 'Connection failed', variant: 'destructive' });
    }
  };

  const models = provider === 'anthropic' ? ANTHROPIC_MODELS : OPENAI_MODELS;

  return (
    <EmbeddableLayout embedded={embedded}>
      <div className="p-6 space-y-6" data-testid="page-ai-settings">
        <div>
          <h1 className="text-2xl font-bold">AI Settings</h1>
          <p className="text-muted-foreground">Configure your AI provider for automatic translation and content generation.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>AI Provider Configuration</CardTitle>
            <CardDescription>Connect Claude (Anthropic) or GPT (OpenAI) to enable AI features.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
            ) : (
              <>
                {settings?.hasApiKey && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700 dark:text-green-300">
                      API key configured for <strong>{settings.provider}</strong> ({settings.model})
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                    <SelectTrigger data-testid="select-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                      <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger data-testid="select-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>API Key {settings?.hasApiKey && <Badge variant="secondary" className="ml-1 text-xs">Already set — leave blank to keep</Badge>}</Label>
                  <div className="relative">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder={settings?.hasApiKey ? '••••••••••••••••••••••• (leave blank to keep)' : 'sk-ant-... or sk-...'}
                      className="pr-10"
                      data-testid="input-api-key"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={testStatus === 'testing' || (!apiKey && !settings?.hasApiKey)}
                    data-testid="button-test-connection"
                  >
                    {testStatus === 'testing' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : testStatus === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    ) : testStatus === 'fail' ? (
                      <XCircle className="h-4 w-4 mr-2 text-destructive" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>

                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || (!apiKey && !settings?.hasApiKey)}
                    data-testid="button-save-ai-settings"
                  >
                    {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Settings
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How AI Features Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <span className="text-lg">🌐</span>
              <div><strong className="text-foreground">Auto Translate</strong> — In the Sections editor, click "Auto Translate" to fill all 9 languages from English content.</div>
            </div>
            <div className="flex gap-3">
              <span className="text-lg">✨</span>
              <div><strong className="text-foreground">Content Generator</strong> — Upload a PDF, Word doc, or URL to auto-generate hero, about, FAQ, and SEO content.</div>
            </div>
            <div className="flex gap-3">
              <span className="text-lg">🔒</span>
              <div><strong className="text-foreground">Security</strong> — Your API key is encrypted with AES-256 and never returned in API responses.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </EmbeddableLayout>
  );
}
