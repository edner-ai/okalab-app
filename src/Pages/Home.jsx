import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// Imports des composants respectant ton arborescence VS Code
import HeroSection from '../Components/home/HeroSection';
import HowItWorksSection from '../Components/home/HowItWorksSection';
import CategoriesSection from '../Components/home/CategoriesSection';
import SeminarCard from '../Components/seminars/SeminarCard';
import { Button } from '../Components/ui/button';

// Imports des utilitaires respectant ton arborescence VS Code
import { useLanguage } from '../Components/shared/LanguageContext';
import { createPageUrl } from '../utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { t } = useLanguage();
  const { user, canCreateSeminar } = useAuth();

  const professorCtaHref = !user
    ? '/login?next=/profile&intent=become-professor'
    : canCreateSeminar
      ? '/createseminar'
      : '/profile?intent=become-professor';

  const { data: featuredSeminars = [], isLoading: featuredLoading, error: featuredError } = useQuery({
    queryKey: ['home-featured-seminars'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seminars')
        .select('id,title,target_income,category,modality,start_date,total_hours,image_url,created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5
  });

  const featuredIds = useMemo(() => featuredSeminars.map((s) => s.id).filter(Boolean), [featuredSeminars]);
  const { data: featuredReviews = [] } = useQuery({
    queryKey: ["home-featured-reviews", featuredIds],
    enabled: featuredIds.length > 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("seminar_reviews")
          .select("seminar_id,rating")
          .in("seminar_id", featuredIds);
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("featured reviews error", err?.message || err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });
  const { data: enrollmentStats = [] } = useQuery({
    queryKey: ["home-featured-enrollment-counts", featuredIds],
    enabled: featuredIds.length > 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_seminar_enrollment_counts", {
          seminar_ids: featuredIds,
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

  const enrollmentCountBySeminar = useMemo(() => {
    const map = {};
    (enrollmentStats || []).forEach((row) => {
      if (!row?.seminar_id) return;
      map[row.seminar_id] = Number(row.enrolled_count || 0);
    });
    return map;
  }, [enrollmentStats]);

  const getEnrollmentCount = (id) => enrollmentCountBySeminar[id] || 0;

  const ratingBySeminar = useMemo(() => {
    const map = {};
    (featuredReviews || []).forEach((row) => {
      if (!row?.seminar_id) return;
      if (!map[row.seminar_id]) map[row.seminar_id] = { sum: 0, count: 0 };
      map[row.seminar_id].sum += Number(row.rating || 0);
      map[row.seminar_id].count += 1;
    });
    return map;
  }, [featuredReviews]);

  const getRating = (id) => {
    const data = ratingBySeminar[id];
    if (!data || !data.count) return { avg: 0, count: 0 };
    return { avg: data.sum / data.count, count: data.count };
  };

  return (
    <div className="min-h-screen bg-white">
      <HeroSection professorCtaHref={professorCtaHref} />
      <HowItWorksSection />
      <CategoriesSection />
      
      {/* Featured Seminars */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                {t('featuredSeminars', 'Seminarios destacados')}
              </h2>
              <p className="text-slate-600">
                {t('featuredSeminarsSubtitle', 'Los seminarios más populares de nuestra comunidad')}
              </p>
            </div>
            <Link to={createPageUrl('Seminars')}>
              <Button variant="outline" className="hidden sm:flex items-center gap-2 rounded-xl">
                {t('viewAll', 'Ver todos')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {featuredError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 text-red-700 p-4">
              {t('featuredSeminarsError', 'No se pudieron cargar los seminarios destacados.')}
            </div>
          ) : featuredLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[420px] bg-white rounded-3xl animate-pulse border border-slate-100" />
              ))}
            </div>
          ) : featuredSeminars.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
              {t('featuredSeminarsEmpty', 'Aún no hay seminarios publicados.')}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredSeminars.map((seminar) => {
                const rating = getRating(seminar.id);
                return (
                <SeminarCard 
                  key={seminar.id} 
                  seminar={seminar} 
                  enrollmentCount={getEnrollmentCount(seminar.id)} 
                  ratingAvg={rating.avg}
                  ratingCount={rating.count}
                />
                );
              })}
            </div>
          )}

          <div className="text-center mt-12 sm:hidden">
            <Link to={createPageUrl('Seminars')}>
              <Button className="w-full rounded-xl">
                {t('viewAllSeminars', 'Ver todos los seminarios')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">
              {t('readyToShare', '¿Listo para compartir tu conocimiento?')}
            </h2>
            <p className="text-xl text-white/70 mb-8 max-w-2xl mx-auto">
              {t('readyToShareSub', 'Crea tu primer seminario y recibe el ingreso que mereces, mientras ayudas a otros a aprender.')}
            </p>
            <Link to={professorCtaHref}>
              <Button size="lg" className="bg-white text-slate-900 hover:bg-white/90 px-8 h-14 text-lg rounded-xl">
                {t('createSeminar', 'Crear mi seminario')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">O</span>
              </div>
              <span className="text-white font-bold text-xl">Okalab</span>
            </div>

            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} Okalab. {t('allRightsReserved', 'Todos los derechos reservados.')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
