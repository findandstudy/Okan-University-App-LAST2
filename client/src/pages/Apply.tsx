import { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  ArrowLeft,
  ArrowRight,
  User,
  GraduationCap,
  FileText,
  CheckCircle,
  Upload,
  Loader2,
  Phone,
  Mail,
  Home,
} from 'lucide-react';
import type { Program } from '@shared/schema';
import { Link } from 'wouter';

const COUNTRY_CODES = [
  { code: '+1', country: 'US/CA' },
  { code: '+44', country: 'UK' },
  { code: '+90', country: 'Turkey' },
  { code: '+971', country: 'UAE' },
  { code: '+966', country: 'Saudi Arabia' },
  { code: '+20', country: 'Egypt' },
  { code: '+33', country: 'France' },
  { code: '+7', country: 'Russia' },
  { code: '+98', country: 'Iran' },
  { code: '+234', country: 'Nigeria' },
  { code: '+91', country: 'India' },
  { code: '+86', country: 'China' },
  { code: '+55', country: 'Brazil' },
];

const steps = [
  { id: 1, key: 'apply.step1', icon: User },
  { id: 2, key: 'apply.step2', icon: GraduationCap },
  { id: 3, key: 'apply.step3', icon: FileText },
  { id: 4, key: 'apply.step4', icon: CheckCircle },
];

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  countryCode: string;
  programId: string;
  documents: {
    passport?: File;
    diploma?: File;
    transcript?: File;
    photo?: File;
  };
}

export default function Apply() {
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const preselectedProgramId = searchParams.get('program') || '';

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    countryCode: '+90',
    programId: preselectedProgramId,
    documents: {},
  });

  const { data: programs = [], isLoading: programsLoading } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const selectedProgram = programs.find((p) => p.id === formData.programId);

  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const leadResponse = await apiRequest('POST', '/api/leads', {
        fullName: data.fullName.toUpperCase(),
        email: data.email,
        phone: data.phone,
        countryCode: data.countryCode,
        tenantId: 'default',
      });
      
      const lead = await leadResponse.json();

      const applicationResponse = await apiRequest('POST', '/api/applications', {
        leadId: lead.id,
        programId: data.programId,
        tenantId: 'default',
        applicantData: {
          fullName: data.fullName.toUpperCase(),
          email: data.email,
          phone: data.phone,
          countryCode: data.countryCode,
        },
        status: 'submitted',
      });

      const application = await applicationResponse.json();

      // Upload documents
      const documentTypes = ['passport', 'diploma', 'transcript', 'photo'] as const;
      for (const docType of documentTypes) {
        const file = data.documents[docType];
        if (file) {
          const formData = new globalThis.FormData();
          formData.append('file', file);
          
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            const fileUrl = `/api/object-storage${uploadResult.objectPath}`;
            
            // Create document record linked to application
            await apiRequest('POST', '/api/documents', {
              applicationId: application.id,
              documentType: docType,
              fileUrl: fileUrl,
              fileName: file.name,
            });
          }
        }
      }

      return application;
    },
    onSuccess: () => {
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to submit application. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.fullName && formData.email && formData.phone && formData.countryCode);
      case 2:
        return !!formData.programId;
      case 3:
        return !!(formData.documents.passport && formData.documents.diploma && formData.documents.transcript && formData.documents.photo);
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    submitMutation.mutate(formData);
  };

  const handleFileChange = (type: keyof FormData['documents'], file: File | null) => {
    setFormData((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [type]: file || undefined,
      },
    }));
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(num);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-6">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-6 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{t('apply.success')}</h2>
              <p className="text-muted-foreground mb-6">{t('apply.success_message')}</p>
              <Link href="/">
                <Button className="gap-2">
                  <Home className="h-4 w-4" />
                  Return to Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-home">
              <ArrowLeft className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
              {t('nav.home')}
            </Button>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 flex flex-col items-center ${index < steps.length - 1 ? 'relative' : ''}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    currentStep >= step.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <step.icon className="h-5 w-5" />
                </div>
                <span
                  className={`text-xs mt-2 text-center hidden sm:block ${
                    currentStep >= step.id ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {t(step.key)}
                </span>
                {index < steps.length - 1 && (
                  <div
                    className={`absolute top-5 left-1/2 w-full h-0.5 ${
                      currentStep > step.id ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <Progress value={(currentStep / 4) * 100} className="h-2" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t(steps[currentStep - 1].key)}</CardTitle>
            <CardDescription>
              Step {currentStep} of 4
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                transition={{ duration: 0.2 }}
              >
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="fullName">{t('apply.fullname')} *</Label>
                      <Input
                        id="fullName"
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({ ...formData, fullName: e.target.value.toUpperCase() })
                        }
                        placeholder="JOHN DOE"
                        className="mt-1.5 uppercase"
                        data-testid="input-fullname"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email">{t('apply.email')} *</Label>
                      <div className="relative mt-1.5">
                        <Mail className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          placeholder="your@email.com"
                          className={isRTL ? 'pr-10' : 'pl-10'}
                          data-testid="input-email"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>{t('apply.country_code')} *</Label>
                        <Select
                          value={formData.countryCode}
                          onValueChange={(value) =>
                            setFormData({ ...formData, countryCode: value })
                          }
                        >
                          <SelectTrigger className="mt-1.5" data-testid="select-country-code">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRY_CODES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.code} ({c.country})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="phone">{t('apply.phone')} *</Label>
                        <div className="relative mt-1.5">
                          <Phone className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) =>
                              setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })
                            }
                            placeholder="5551234567"
                            className={isRTL ? 'pr-10' : 'pl-10'}
                            data-testid="input-phone"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <Label>{t('apply.select_program')} *</Label>
                      <Select
                        value={formData.programId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, programId: value })
                        }
                      >
                        <SelectTrigger className="mt-1.5" data-testid="select-program">
                          <SelectValue placeholder="Select a program" />
                        </SelectTrigger>
                        <SelectContent>
                          {programs.map((program) => (
                            <SelectItem key={program.id} value={program.id}>
                              {program.programName} - {program.degree}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedProgram && (
                      <Card className="bg-muted/50 border-dashed">
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2">{selectedProgram.programName}</h4>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge variant="secondary">{selectedProgram.degree}</Badge>
                            <Badge variant="outline">{selectedProgram.language}</Badge>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Regular Fee:</span>
                              <span className="line-through text-muted-foreground">
                                {formatCurrency(selectedProgram.tuitionFee)}
                              </span>
                            </div>
                            {selectedProgram.discountedFee && (
                              <div className="flex justify-between">
                                <span className="text-primary font-medium">Your Price:</span>
                                <span className="font-bold text-primary">
                                  {formatCurrency(selectedProgram.discountedFee)}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Please upload all required documents to proceed with your application.
                    </p>

                    {[
                      { key: 'passport' as const, label: t('apply.passport') },
                      { key: 'diploma' as const, label: t('apply.diploma') },
                      { key: 'transcript' as const, label: t('apply.transcript') },
                      { key: 'photo' as const, label: t('apply.photo') },
                    ].map((doc) => (
                      <div key={doc.key} className={`flex items-center gap-4 p-3 border rounded-lg bg-card ${!formData.documents[doc.key] ? 'border-destructive/50' : 'border-green-500/50'}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${formData.documents[doc.key] ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                          <FileText className={`h-5 w-5 ${formData.documents[doc.key] ? 'text-green-600' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{doc.label} <span className="text-destructive">*</span></p>
                          {formData.documents[doc.key] ? (
                            <p className="text-xs text-green-600 truncate">
                              {formData.documents[doc.key]?.name}
                            </p>
                          ) : (
                            <p className="text-xs text-destructive">Required - Not uploaded</p>
                          )}
                        </div>
                        <label>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileChange(doc.key, e.target.files?.[0] || null)}
                            data-testid={`input-file-${doc.key}`}
                          />
                          <Button variant="outline" size="sm" asChild className="cursor-pointer">
                            <span className="gap-1">
                              <Upload className="h-3 w-3" />
                              Upload
                            </span>
                          </Button>
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" /> Personal Information
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-muted-foreground">Name:</div>
                        <div className="font-medium">{formData.fullName}</div>
                        <div className="text-muted-foreground">Email:</div>
                        <div className="font-medium">{formData.email}</div>
                        <div className="text-muted-foreground">Phone:</div>
                        <div className="font-medium">{formData.countryCode} {formData.phone}</div>
                      </div>
                    </div>

                    {selectedProgram && (
                      <div className="p-4 border rounded-lg bg-muted/50">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" /> Selected Program
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="text-muted-foreground">Program:</div>
                          <div className="font-medium">{selectedProgram.programName}</div>
                          <div className="text-muted-foreground">Degree:</div>
                          <div className="font-medium">{selectedProgram.degree}</div>
                          <div className="text-muted-foreground">Language:</div>
                          <div className="font-medium">{selectedProgram.language}</div>
                          <div className="text-muted-foreground">Fee:</div>
                          <div className="font-medium text-primary">
                            {selectedProgram.discountedFee
                              ? formatCurrency(selectedProgram.discountedFee)
                              : formatCurrency(selectedProgram.tuitionFee)}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-4 border rounded-lg bg-muted/50">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Documents
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(formData.documents).map(([key, file]) =>
                          file ? (
                            <Badge key={key} variant="secondary" className="gap-1">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              {key}
                            </Badge>
                          ) : null
                        )}
                        {Object.values(formData.documents).every((f) => !f) && (
                          <span className="text-sm text-muted-foreground">
                            No documents uploaded (optional)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-between mt-8 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="gap-2"
                data-testid="button-back"
              >
                <ArrowLeft className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                {t('apply.back')}
              </Button>

              {currentStep < 4 ? (
                <Button onClick={handleNext} className="gap-2" data-testid="button-next">
                  {t('apply.next')}
                  <ArrowRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  className="gap-2"
                  data-testid="button-submit"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      {t('apply.submit')}
                      <CheckCircle className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
