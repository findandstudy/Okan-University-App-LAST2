import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useUpload } from '@/hooks/use-upload';
import { Globe, Upload, Loader2, X, Image as ImageIcon } from 'lucide-react';
import AdminLayout from './AdminLayout';
import type { Tenant } from '@shared/schema';

interface DropZoneProps {
  label: string;
  value: string;
  onUpload: (url: string) => void;
  onClear: () => void;
  accept: string;
  testId: string;
}

function DropZone({ label, value, onUpload, onClear, accept, testId }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const { uploadFile, isUploading, error } = useUpload({
    onSuccess: (response) => {
      onUpload(response.objectPath);
      toast({
        title: 'Upload complete',
        description: `${label} uploaded successfully.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Upload failed',
        description: err.message || 'Failed to upload file.',
        variant: 'destructive',
      });
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await uploadFile(file);
    }
  }, [uploadFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
    e.target.value = '';
  }, [uploadFile]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="relative border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-background border flex items-center justify-center overflow-hidden">
              <img 
                src={value} 
                alt={label} 
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{value.split('/').pop()}</p>
              <p className="text-xs text-muted-foreground">Uploaded file</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClear}
              data-testid={`button-clear-${testId}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <label
          className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-testid={`dropzone-${testId}`}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
            data-testid={`input-file-${testId}`}
          />
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          ) : (
            <>
              <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag and drop or click to upload
              </p>
            </>
          )}
        </label>
      )}
    </div>
  );
}

export default function TenantPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    universityName: '',
    domain: '',
    logoUrl: '',
    faviconUrl: '',
  });

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  useEffect(() => {
    if (tenant) {
      setSettings({
        universityName: tenant.universityName || '',
        domain: tenant.domain || '',
        logoUrl: tenant.logoUrl || '',
        faviconUrl: tenant.faviconUrl || '',
      });
    }
  }, [tenant]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof settings) => {
      const response = await apiRequest('PATCH', '/api/tenant', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
      toast({
        title: 'Settings saved',
        description: 'Tenant settings have been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to save settings',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(settings);
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
          <h1 className="text-2xl font-bold">Tenant Settings</h1>
          <p className="text-muted-foreground">Configure your university identity</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>University Identity</CardTitle>
            <CardDescription>Basic information about your institution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>University Name</Label>
              <Input
                value={settings.universityName}
                onChange={(e) =>
                  setSettings({ ...settings, universityName: e.target.value })
                }
                placeholder="e.g., Okan University"
                className="mt-1.5"
                data-testid="input-university-name"
              />
            </div>

            <div>
              <Label>Domain</Label>
              <div className="relative mt-1.5">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={settings.domain}
                  onChange={(e) =>
                    setSettings({ ...settings, domain: e.target.value })
                  }
                  placeholder="okanuniversity.app"
                  className="pl-10"
                  data-testid="input-domain"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <DropZone
                label="Logo"
                value={settings.logoUrl}
                onUpload={(url) => setSettings({ ...settings, logoUrl: url })}
                onClear={() => setSettings({ ...settings, logoUrl: '' })}
                accept="image/*"
                testId="logo"
              />

              <DropZone
                label="Favicon"
                value={settings.faviconUrl}
                onUpload={(url) => setSettings({ ...settings, faviconUrl: url })}
                onClear={() => setSettings({ ...settings, faviconUrl: '' })}
                accept="image/*,.ico"
                testId="favicon"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            data-testid="button-save-tenant"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
