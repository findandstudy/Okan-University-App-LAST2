import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { GripVertical, Eye, EyeOff, Loader2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import type { Section } from '@shared/schema';

const DEFAULT_SECTIONS = [
  { key: 'hero', label: 'Hero Section' },
  { key: 'trust_badges', label: 'Trust Badges' },
  { key: 'program_finder', label: 'Program Finder' },
  { key: 'steps', label: 'Application Steps' },
  { key: 'testimonials', label: 'Testimonials' },
  { key: 'faq', label: 'FAQ' },
  { key: 'contact', label: 'Contact Form' },
];

interface SectionState {
  id: string;
  key: string;
  label: string;
  isEnabled: boolean;
}

export default function Sections() {
  const { toast } = useToast();
  const [sectionStates, setSectionStates] = useState<SectionState[]>([]);

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ['/api/sections'],
  });

  useEffect(() => {
    if (sections.length > 0) {
      setSectionStates(
        sections.map((section) => ({
          id: section.id,
          key: section.sectionKey,
          label: DEFAULT_SECTIONS.find((s) => s.key === section.sectionKey)?.label || section.sectionKey,
          isEnabled: section.isEnabled ?? true,
        }))
      );
    } else {
      setSectionStates(
        DEFAULT_SECTIONS.map((s, index) => ({
          id: `temp-${index}`,
          key: s.key,
          label: s.label,
          isEnabled: true,
        }))
      );
    }
  }, [sections]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; isEnabled: boolean }>) => {
      const response = await apiRequest('PATCH', '/api/sections', { sections: updates });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections'] });
      toast({
        title: 'Sections saved',
        description: 'Section visibility has been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to save sections',
        variant: 'destructive',
      });
    },
  });

  const toggleSection = (key: string) => {
    setSectionStates((prev) =>
      prev.map((section) =>
        section.key === key ? { ...section, isEnabled: !section.isEnabled } : section
      )
    );
  };

  const handleSave = () => {
    const updates = sectionStates
      .filter((s) => !s.id.startsWith('temp-'))
      .map((s) => ({ id: s.id, isEnabled: s.isEnabled }));
    
    if (updates.length > 0) {
      updateMutation.mutate(updates);
    } else {
      toast({
        title: 'No sections to update',
        description: 'Sections have not been initialized in the database yet.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Sections</h1>
          <p className="text-muted-foreground">Toggle and reorder landing page sections</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Landing Page Sections</CardTitle>
            <CardDescription>
              Enable or disable sections that appear on the public landing page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sectionStates.map((section) => (
                <div
                  key={section.key}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                    section.isEnabled ? 'bg-card' : 'bg-muted/50'
                  }`}
                  data-testid={`section-item-${section.key}`}
                >
                  <div className="cursor-grab text-muted-foreground">
                    <GripVertical className="h-5 w-5" />
                  </div>

                  <div className="flex-1">
                    <p className={`font-medium ${!section.isEnabled && 'text-muted-foreground'}`}>
                      {section.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {section.isEnabled ? 'Visible on landing page' : 'Hidden from landing page'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {section.isEnabled ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Switch
                      checked={section.isEnabled}
                      onCheckedChange={() => toggleSection(section.key)}
                      data-testid={`switch-section-${section.key}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            data-testid="button-save-sections"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
