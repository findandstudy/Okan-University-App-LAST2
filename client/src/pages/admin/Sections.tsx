import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import AdminLayout from './AdminLayout';

interface Section {
  key: string;
  label: string;
  enabled: boolean;
}

const defaultSections: Section[] = [
  { key: 'hero', label: 'Hero Section', enabled: true },
  { key: 'trust_badges', label: 'Trust Badges', enabled: true },
  { key: 'program_finder', label: 'Program Finder', enabled: true },
  { key: 'steps', label: 'Application Steps', enabled: true },
  { key: 'testimonials', label: 'Testimonials', enabled: true },
  { key: 'faq', label: 'FAQ', enabled: true },
  { key: 'contact', label: 'Contact Form', enabled: true },
];

export default function Sections() {
  const { toast } = useToast();
  const [sections, setSections] = useState<Section[]>(defaultSections);

  const toggleSection = (key: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.key === key ? { ...section, enabled: !section.enabled } : section
      )
    );
  };

  const handleSave = () => {
    toast({
      title: 'Sections saved',
      description: 'Section visibility has been updated.',
    });
  };

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
              {sections.map((section) => (
                <div
                  key={section.key}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                    section.enabled ? 'bg-card' : 'bg-muted/50'
                  }`}
                  data-testid={`section-item-${section.key}`}
                >
                  <div className="cursor-grab text-muted-foreground">
                    <GripVertical className="h-5 w-5" />
                  </div>

                  <div className="flex-1">
                    <p className={`font-medium ${!section.enabled && 'text-muted-foreground'}`}>
                      {section.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {section.enabled ? 'Visible on landing page' : 'Hidden from landing page'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {section.enabled ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Switch
                      checked={section.enabled}
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
          <Button onClick={handleSave} data-testid="button-save-sections">
            Save Changes
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
