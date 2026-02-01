import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Plus, Trash2, Loader2, GraduationCap, Languages } from 'lucide-react';
import AdminLayout from './AdminLayout';

interface Section {
  id: string;
  sectionKey: string;
  settings: {
    degreeOptions?: string[];
    languageOptions?: string[];
  } | null;
}

const DEFAULT_DEGREES = ['Bachelor', 'Master', 'PhD', 'Associate', 'Certificate'];
const DEFAULT_LANGUAGES = ['English', 'Turkish', 'Arabic', 'French', 'German'];

export default function ProgramFilters() {
  const { toast } = useToast();
  const [degreeOptions, setDegreeOptions] = useState<string[]>(DEFAULT_DEGREES);
  const [languageOptions, setLanguageOptions] = useState<string[]>(DEFAULT_LANGUAGES);
  const [newDegree, setNewDegree] = useState('');
  const [newLanguage, setNewLanguage] = useState('');

  const { data: sections = [] } = useQuery<Section[]>({
    queryKey: ['/api/sections'],
  });

  const programFinderSection = sections.find(s => s.sectionKey === 'program_finder');

  useEffect(() => {
    if (programFinderSection?.settings) {
      if (programFinderSection.settings.degreeOptions) {
        setDegreeOptions(programFinderSection.settings.degreeOptions);
      }
      if (programFinderSection.settings.languageOptions) {
        setLanguageOptions(programFinderSection.settings.languageOptions);
      }
    }
  }, [programFinderSection]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!programFinderSection) {
        throw new Error('Program finder section not found');
      }
      await apiRequest('PATCH', `/api/sections/${programFinderSection.id}`, {
        settings: {
          ...programFinderSection.settings,
          degreeOptions,
          languageOptions,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections'] });
      toast({ title: 'Filter options saved successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to save filter options', variant: 'destructive' });
    },
  });

  const addDegree = () => {
    if (newDegree.trim() && !degreeOptions.includes(newDegree.trim())) {
      setDegreeOptions([...degreeOptions, newDegree.trim()]);
      setNewDegree('');
    }
  };

  const removeDegree = (degree: string) => {
    setDegreeOptions(degreeOptions.filter(d => d !== degree));
  };

  const addLanguage = () => {
    if (newLanguage.trim() && !languageOptions.includes(newLanguage.trim())) {
      setLanguageOptions([...languageOptions, newLanguage.trim()]);
      setNewLanguage('');
    }
  };

  const removeLanguage = (language: string) => {
    setLanguageOptions(languageOptions.filter(l => l !== language));
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Program Filters</h1>
            <p className="text-muted-foreground">
              Manage degree and language filter options for the program finder
            </p>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Degree Options
              </CardTitle>
              <CardDescription>
                These options appear in the education level filter dropdown
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add new degree..."
                  value={newDegree}
                  onChange={(e) => setNewDegree(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDegree()}
                />
                <Button onClick={addDegree} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {degreeOptions.map((degree) => (
                  <div
                    key={degree}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <span>{degree}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDegree(degree)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {degreeOptions.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    No degree options. Add some above.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5" />
                Language Options
              </CardTitle>
              <CardDescription>
                These options appear in the language filter dropdown
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add new language..."
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addLanguage()}
                />
                <Button onClick={addLanguage} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {languageOptions.map((language) => (
                  <div
                    key={language}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <span>{language}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLanguage(language)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {languageOptions.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    No language options. Add some above.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
