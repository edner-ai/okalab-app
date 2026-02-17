import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../Components/shared/LanguageContext';
import { useAuth } from '../context/AuthContext';
import SeminarCard from '../Components/seminars/SeminarCard';
import CategoryFilter from '../Components/seminars/CategoryFilter';
import { Input } from "../Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Components/ui/select";
import { Search, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function SeminarsContent() {
  const { t, language: uiLanguage } = useLanguage();
  const { user, profile } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category') || 'all';
  
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('preferred');
  const preferredLanguage = profile?.preferred_language || localStorage.getItem("preferred_language") || "";
  
  const { data: seminars = [], isLoading, error: seminarsError } = useQuery({
    queryKey: ['seminars', uiLanguage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seminars')
        .select('id,title,description,image_url,category,modality,start_date,total_hours,target_income,status,created_at,language')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5
  });

  const seminarIds = useMemo(() => seminars.map((s) => s.id).filter(Boolean), [seminars]);
  const { data: enrollmentStats = [] } = useQuery({
    queryKey: ["seminar-enrollment-counts", seminarIds],
    enabled: seminarIds.length > 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_seminar_enrollment_counts", {
          seminar_ids: seminarIds,
        });
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("enrollment count error", err?.message || err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const enrollmentBySeminar = useMemo(() => {
    const map = {};
    (enrollmentStats || []).forEach((row) => {
      if (!row?.seminar_id) return;
      map[row.seminar_id] = Number(row.enrolled_count || 0);
    });
    return map;
  }, [enrollmentStats]);

  const getEnrollmentCount = (seminarId) => enrollmentBySeminar[seminarId] ?? 0;

  const filteredSeminars = seminars.filter(seminar => {
    const categoryMatch = selectedCategory === 'all' || seminar.category === selectedCategory;
    const modalityMatch = modalityFilter === 'all' || seminar.modality === modalityFilter;
    const searchMatch = !searchQuery || 
      seminar.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const languageMatch =
      languageFilter === 'all' || !preferredLanguage || seminar.language === preferredLanguage;
    return categoryMatch && modalityMatch && searchMatch && languageMatch;
  });

  const { data: seminarReviews = [] } = useQuery({
    queryKey: ["seminar-reviews", seminarIds],
    enabled: seminarIds.length > 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("seminar_reviews")
          .select("seminar_id,rating")
          .in("seminar_id", seminarIds);
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("seminar reviews error", err?.message || err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const ratingBySeminar = useMemo(() => {
    const map = {};
    (seminarReviews || []).forEach((row) => {
      if (!row?.seminar_id) return;
      if (!map[row.seminar_id]) map[row.seminar_id] = { sum: 0, count: 0 };
      map[row.seminar_id].sum += Number(row.rating || 0);
      map[row.seminar_id].count += 1;
    });
    return map;
  }, [seminarReviews]);

  const getRating = (id) => {
    const data = ratingBySeminar[id];
    if (!data || !data.count) return { avg: 0, count: 0 };
    return { avg: data.sum / data.count, count: data.count };
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Interne : Titre et Filtres alignés sur l'image 2.jpg */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <h1 className="text-3xl font-bold text-slate-900">
                {t('seminars', 'Seminarios')}
              </h1>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto lg:justify-end">
                {/* Barre de recherche grise selon le visuel */}
                <div className="relative flex-1 sm:max-w-[360px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder={t('seminars_search', 'Buscar seminarios...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-100 border-none h-11 focus-visible:ring-1 focus-visible:ring-slate-200"
                  />
                </div>
                
                {/* Sélecteur de modalité */}
                <Select value={modalityFilter} onValueChange={setModalityFilter}>
                  <SelectTrigger className="w-full sm:w-40 bg-slate-100 border-none h-11 text-slate-600">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      <SelectValue placeholder={t('all', 'Todas')} />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">{t('all', 'Todas')}</SelectItem>
                    <SelectItem value="online">{t('online', 'En Línea')}</SelectItem>
                    <SelectItem value="presential">{t('presential', 'Presencial')}</SelectItem>
                    <SelectItem value="hybrid">{t('hybrid', 'Híbrido')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
              {/* Composant de filtres par catégories (Tous, Empleabilidad, etc.) */}
              <CategoryFilter 
                selected={selectedCategory} 
                onSelect={setSelectedCategory} 
              />

              {/* Toggle idioma */}
              <div className="flex items-center bg-slate-100 rounded-xl p-1 h-11">
                <button
                  type="button"
                  onClick={() => setLanguageFilter('preferred')}
                  className={`px-3 h-9 rounded-lg text-sm font-medium transition ${
                    languageFilter === 'preferred'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {t('seminars_language_preferred', 'Solo mi idioma')}
                </button>
                <button
                  type="button"
                  onClick={() => setLanguageFilter('all')}
                  className={`px-3 h-9 rounded-lg text-sm font-medium transition ${
                    languageFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {t('seminars_language_all', 'Todos')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Grid de Séminaires : Alignement image 2.jpg */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {seminarsError && !/AbortError/i.test(seminarsError?.message || "") ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 text-red-700 p-4">
            {t('seminars_load_error', 'No se pudieron cargar los seminarios')}: {seminarsError.message}
          </div>
        ) : null}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1,2,3].map(i => (
              <div key={i} className="h-[400px] bg-white rounded-3xl animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
                  {filteredSeminars.map((seminar, index) => {
                    const rating = getRating(seminar.id);
                    return (
                    <motion.div
                      key={seminar.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <SeminarCard 
                        seminar={seminar}
                        enrollmentCount={getEnrollmentCount(seminar.id)}
                        ratingAvg={rating.avg}
                        ratingCount={rating.count}
                      />
                    </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
        )}
      </div>
    </div>
  );
}

export default function Seminars() {
  return <SeminarsContent />;
}
