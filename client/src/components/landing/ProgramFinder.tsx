import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Search, GraduationCap, Languages, DollarSign, ArrowRight, LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import type { Program } from '@shared/schema';

const DEGREE_OPTIONS = ['All', 'Bachelor', 'Master', 'PhD', 'Associate', 'Certificate'];
const LANGUAGE_OPTIONS = ['All', 'English', 'Turkish', 'Arabic', 'French'];
const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export function ProgramFinder() {
  const { t, isRTL } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [degreeFilter, setDegreeFilter] = useState('All');
  const [languageFilter, setLanguageFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('default');

  const { data: programs = [], isLoading } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const filteredPrograms = useMemo(() => {
    let result = programs.filter((program) => {
      const matchesSearch =
        !searchQuery ||
        program.programName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        program.universityName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDegree =
        degreeFilter === 'All' ||
        program.degree.toLowerCase() === degreeFilter.toLowerCase();

      const matchesLanguage =
        languageFilter === 'All' ||
        program.language.toLowerCase() === languageFilter.toLowerCase();

      return matchesSearch && matchesDegree && matchesLanguage;
    });

    if (sortBy === 'price_asc') {
      result = [...result].sort((a, b) => {
        const priceA = parseFloat(String(a.discountedFee || a.tuitionFee));
        const priceB = parseFloat(String(b.discountedFee || b.tuitionFee));
        return priceA - priceB;
      });
    } else if (sortBy === 'price_desc') {
      result = [...result].sort((a, b) => {
        const priceA = parseFloat(String(a.discountedFee || a.tuitionFee));
        const priceB = parseFloat(String(b.discountedFee || b.tuitionFee));
        return priceB - priceA;
      });
    }

    return result;
  }, [programs, searchQuery, degreeFilter, languageFilter, sortBy]);

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <section id="programs" className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('programs.title')}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Browse our wide selection of internationally accredited programs
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-card rounded-xl border p-4 mb-8 shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="relative md:col-span-2">
              <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
              <Input
                placeholder={t('programs.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={isRTL ? 'pr-10' : 'pl-10'}
                data-testid="input-program-search"
              />
            </div>

            <Select value={degreeFilter} onValueChange={setDegreeFilter}>
              <SelectTrigger data-testid="select-degree-filter">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder={t('programs.degree')} />
                </div>
              </SelectTrigger>
              <SelectContent>
                {DEGREE_OPTIONS.map((degree) => (
                  <SelectItem key={degree} value={degree}>
                    {degree === 'All' ? t('programs.all') : degree}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger data-testid="select-language-filter">
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder={t('programs.language')} />
                </div>
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang === 'All' ? t('programs.all') : lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger data-testid="select-sort">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
                data-testid="button-view-grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent className="pb-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : filteredPrograms.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No programs found</h3>
            <p className="text-muted-foreground">Try adjusting your search filters</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPrograms.map((program, index) => (
              <motion.div
                key={program.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <Card className="h-full flex flex-col hover-elevate overflow-visible" data-testid={`program-card-${program.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg leading-tight mb-1 line-clamp-2">
                          {program.programName}
                        </h3>
                        <p className="text-sm text-muted-foreground">{program.universityName}</p>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">
                        {program.degree}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 pb-3">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="outline" className="gap-1">
                        <Languages className="h-3 w-3" />
                        {program.language}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{t('programs.tuition')}</span>
                        <span className="font-medium line-through text-muted-foreground">
                          {formatCurrency(program.tuitionFee)}
                        </span>
                      </div>
                      {program.discountedFee && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-primary font-medium">{t('programs.discounted')}</span>
                          <span className="font-bold text-lg text-primary">
                            {formatCurrency(program.discountedFee)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0">
                    <Link href={`/apply?program=${program.id}`} className="w-full">
                      <Button className="w-full gap-2" data-testid={`button-apply-program-${program.id}`}>
                        {t('programs.apply')}
                        <ArrowRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPrograms.map((program, index) => (
              <motion.div
                key={program.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
              >
                <Card className="hover-elevate overflow-visible" data-testid={`program-card-${program.id}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        <h3 className="font-semibold text-lg leading-tight">
                          {program.programName}
                        </h3>
                        <Badge variant="secondary" className="flex-shrink-0">
                          {program.degree}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span>{program.universityName}</span>
                        <Badge variant="outline" className="gap-1">
                          <Languages className="h-3 w-3" />
                          {program.language}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 sm:flex-shrink-0">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground line-through">
                          {formatCurrency(program.tuitionFee)}
                        </div>
                        {program.discountedFee && (
                          <div className="font-bold text-lg text-primary">
                            {formatCurrency(program.discountedFee)}
                          </div>
                        )}
                      </div>
                      <Link href={`/apply?program=${program.id}`}>
                        <Button className="gap-2" data-testid={`button-apply-program-${program.id}`}>
                          {t('programs.apply')}
                          <ArrowRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
