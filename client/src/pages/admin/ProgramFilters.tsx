import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Plus, Trash2, Loader2, GraduationCap, Languages, Pencil, Check, X, AlertCircle } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [editingDegree, setEditingDegree] = useState<string | null>(null);
  const [editingLanguage, setEditingLanguage] = useState<string | null>(null);
  const [editDegreeValue, setEditDegreeValue] = useState('');
  const [editLanguageValue, setEditLanguageValue] = useState('');

  const { data: sections = [], isLoading: sectionsLoading, error: sectionsError } = useQuery<Section[]>({
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
    mutationFn: async (options: { degreeOptions: string[]; languageOptions: string[] }) => {
      if (!programFinderSection) {
        throw new Error('Program finder section not found. Please wait for page to load.');
      }
      const response = await apiRequest('PATCH', `/api/sections/${programFinderSection.id}`, {
        settings: {
          ...programFinderSection.settings,
          degreeOptions: options.degreeOptions,
          languageOptions: options.languageOptions,
        },
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sections'] });
      toast({ title: 'Filter options saved successfully' });
    },
    onError: (error: Error) => {
      console.error('Save error:', error);
      toast({ title: error.message || 'Failed to save filter options', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    if (!programFinderSection) {
      toast({ title: 'Please wait for page to load', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({ degreeOptions, languageOptions });
  };

  const addDegree = () => {
    const trimmed = newDegree.trim();
    if (!trimmed) {
      toast({ title: 'Please enter a degree name', variant: 'destructive' });
      return;
    }
    if (degreeOptions.includes(trimmed)) {
      toast({ title: 'This degree already exists', variant: 'destructive' });
      return;
    }
    if (!programFinderSection) {
      toast({ title: 'Please wait for page to load', variant: 'destructive' });
      return;
    }
    const updated = [...degreeOptions, trimmed];
    setDegreeOptions(updated);
    setNewDegree('');
    saveMutation.mutate({ degreeOptions: updated, languageOptions });
  };

  const removeDegree = (degree: string) => {
    if (!programFinderSection) {
      toast({ title: 'Please wait for page to load', variant: 'destructive' });
      return;
    }
    const updated = degreeOptions.filter(d => d !== degree);
    setDegreeOptions(updated);
    saveMutation.mutate({ degreeOptions: updated, languageOptions });
  };

  const startEditDegree = (degree: string) => {
    setEditingDegree(degree);
    setEditDegreeValue(degree);
  };

  const saveEditDegree = () => {
    const trimmed = editDegreeValue.trim();
    if (!trimmed) {
      toast({ title: 'Please enter a degree name', variant: 'destructive' });
      return;
    }
    if (trimmed !== editingDegree && degreeOptions.includes(trimmed)) {
      toast({ title: 'This degree already exists', variant: 'destructive' });
      return;
    }
    if (!programFinderSection) {
      toast({ title: 'Please wait for page to load', variant: 'destructive' });
      return;
    }
    const updated = degreeOptions.map(d => d === editingDegree ? trimmed : d);
    setDegreeOptions(updated);
    setEditingDegree(null);
    saveMutation.mutate({ degreeOptions: updated, languageOptions });
  };

  const cancelEditDegree = () => {
    setEditingDegree(null);
    setEditDegreeValue('');
  };

  const addLanguage = () => {
    const trimmed = newLanguage.trim();
    if (!trimmed) {
      toast({ title: 'Please enter a language name', variant: 'destructive' });
      return;
    }
    if (languageOptions.includes(trimmed)) {
      toast({ title: 'This language already exists', variant: 'destructive' });
      return;
    }
    if (!programFinderSection) {
      toast({ title: 'Please wait for page to load', variant: 'destructive' });
      return;
    }
    const updated = [...languageOptions, trimmed];
    setLanguageOptions(updated);
    setNewLanguage('');
    saveMutation.mutate({ degreeOptions, languageOptions: updated });
  };

  const removeLanguage = (language: string) => {
    if (!programFinderSection) {
      toast({ title: 'Please wait for page to load', variant: 'destructive' });
      return;
    }
    const updated = languageOptions.filter(l => l !== language);
    setLanguageOptions(updated);
    saveMutation.mutate({ degreeOptions, languageOptions: updated });
  };

  const startEditLanguage = (language: string) => {
    setEditingLanguage(language);
    setEditLanguageValue(language);
  };

  const saveEditLanguage = () => {
    const trimmed = editLanguageValue.trim();
    if (!trimmed) {
      toast({ title: 'Please enter a language name', variant: 'destructive' });
      return;
    }
    if (trimmed !== editingLanguage && languageOptions.includes(trimmed)) {
      toast({ title: 'This language already exists', variant: 'destructive' });
      return;
    }
    if (!programFinderSection) {
      toast({ title: 'Please wait for page to load', variant: 'destructive' });
      return;
    }
    const updated = languageOptions.map(l => l === editingLanguage ? trimmed : l);
    setLanguageOptions(updated);
    setEditingLanguage(null);
    saveMutation.mutate({ degreeOptions, languageOptions: updated });
  };

  const cancelEditLanguage = () => {
    setEditingLanguage(null);
    setEditLanguageValue('');
  };

  const isReady = !sectionsLoading && programFinderSection;

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
            onClick={handleSave}
            disabled={saveMutation.isPending || !isReady}
            data-testid="button-save-filters"
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>

        {sectionsLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        )}

        {sectionsError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load sections. Please refresh the page.
            </AlertDescription>
          </Alert>
        )}

        {!sectionsLoading && !programFinderSection && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Program finder section not found. Please contact support.
            </AlertDescription>
          </Alert>
        )}

        {isReady && (
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
                    data-testid="input-new-degree"
                  />
                  <Button 
                    onClick={addDegree} 
                    size="icon"
                    disabled={saveMutation.isPending || !newDegree.trim()}
                    data-testid="button-add-degree"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="space-y-2">
                  {degreeOptions.map((degree) => (
                    <div
                      key={degree}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      data-testid={`degree-option-${degree}`}
                    >
                      {editingDegree === degree ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <Input
                            value={editDegreeValue}
                            onChange={(e) => setEditDegreeValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditDegree();
                              if (e.key === 'Escape') cancelEditDegree();
                            }}
                            autoFocus
                            data-testid="input-edit-degree"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={saveEditDegree}
                            className="h-8 w-8 text-green-600"
                            data-testid="button-save-edit-degree"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={cancelEditDegree}
                            className="h-8 w-8"
                            data-testid="button-cancel-edit-degree"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span>{degree}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditDegree(degree)}
                              className="h-8 w-8"
                              disabled={saveMutation.isPending}
                              data-testid={`button-edit-degree-${degree}`}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDegree(degree)}
                              className="h-8 w-8"
                              disabled={saveMutation.isPending}
                              data-testid={`button-delete-degree-${degree}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </>
                      )}
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
                    data-testid="input-new-language"
                  />
                  <Button 
                    onClick={addLanguage} 
                    size="icon"
                    disabled={saveMutation.isPending || !newLanguage.trim()}
                    data-testid="button-add-language"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="space-y-2">
                  {languageOptions.map((language) => (
                    <div
                      key={language}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      data-testid={`language-option-${language}`}
                    >
                      {editingLanguage === language ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <Input
                            value={editLanguageValue}
                            onChange={(e) => setEditLanguageValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditLanguage();
                              if (e.key === 'Escape') cancelEditLanguage();
                            }}
                            autoFocus
                            data-testid="input-edit-language"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={saveEditLanguage}
                            className="h-8 w-8 text-green-600"
                            data-testid="button-save-edit-language"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={cancelEditLanguage}
                            className="h-8 w-8"
                            data-testid="button-cancel-edit-language"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span>{language}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditLanguage(language)}
                              className="h-8 w-8"
                              disabled={saveMutation.isPending}
                              data-testid={`button-edit-language-${language}`}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLanguage(language)}
                              className="h-8 w-8"
                              disabled={saveMutation.isPending}
                              data-testid={`button-delete-language-${language}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </>
                      )}
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
        )}
      </div>
    </AdminLayout>
  );
}
