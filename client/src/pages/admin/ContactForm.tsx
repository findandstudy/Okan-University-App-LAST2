import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, Code, Eye, EyeOff, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import AdminLayout from './AdminLayout';
import type { Tenant } from '@shared/schema';

export default function ContactForm() {
  const { toast } = useToast();
  const [embedCode, setEmbedCode] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  useEffect(() => {
    if (tenant?.contactFormEmbed) {
      setEmbedCode(tenant.contactFormEmbed);
    }
  }, [tenant]);

  const updateMutation = useMutation({
    mutationFn: async (data: { contactFormEmbed: string | null }) => {
      const response = await apiRequest('PATCH', '/api/tenant', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
      toast({
        title: 'Saved',
        description: 'Contact form embed code has been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to save',
        description: 'Could not update contact form embed code.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      contactFormEmbed: embedCode.trim() || null,
    });
  };

  const handleClear = () => {
    setEmbedCode('');
    updateMutation.mutate({ contactFormEmbed: null });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Contact Form</h1>
          <p className="text-muted-foreground">
            Manage the external form embed code for the contact section
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You can paste an external form embed code (HTML) here. This will replace the default contact form on the landing page. 
            Leave empty to use the default form.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Embed Code
              </CardTitle>
              <CardDescription>
                Paste your external form HTML code here (e.g., from portal.findandstudy.com)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              data-testid="button-toggle-preview"
            >
              {showPreview ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide Preview
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show Preview
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="embedCode">Form HTML Code</Label>
              <Textarea
                id="embedCode"
                value={embedCode}
                onChange={(e) => setEmbedCode(e.target.value)}
                placeholder="<form action='https://...' method='POST'>...</form>"
                rows={15}
                className="mt-1.5 font-mono text-sm"
                data-testid="textarea-embed-code"
              />
            </div>

            {showPreview && embedCode && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <Label className="mb-2 block">Preview</Label>
                <div 
                  className="bg-background rounded p-4 overflow-auto max-h-[400px]"
                  dangerouslySetInnerHTML={{ __html: embedCode }}
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                data-testid="button-save-embed"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Embed Code
              </Button>
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={updateMutation.isPending || !embedCode}
                data-testid="button-clear-embed"
              >
                Clear & Use Default Form
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>1.</strong> Copy your external form embed code from your lead management system.
            </p>
            <p>
              <strong>2.</strong> Paste the complete HTML code in the textarea above.
            </p>
            <p>
              <strong>3.</strong> Click "Show Preview" to verify the form renders correctly.
            </p>
            <p>
              <strong>4.</strong> Click "Save Embed Code" to apply changes to the landing page.
            </p>
            <p className="text-xs mt-4">
              Note: The embed code should be a complete HTML form. Scripts and styles included in the code will be executed.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
