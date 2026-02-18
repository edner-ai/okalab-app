import React, { useMemo } from 'react';
import { ArrowRight, Users, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { useLanguage } from '../shared/LanguageContext';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';

export default function HeroSection({ professorCtaHref }) {
  const { t } = useLanguage();
  const ctaHref = professorCtaHref || createPageUrl('CreateSeminar');
  const assetBase = import.meta.env.BASE_URL || "/";
  const heroImageSrc = `${assetBase}assets/hero.webp`;
  const statsCacheKey = "home_stats_cache";
  const cachedStats = useMemo(() => {
    try {
      const raw = localStorage.getItem(statsCacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (err) {
      console.warn("home stats cache parse error", err?.message || err);
      return null;
    }
  }, []);

  const { data: stats, isLoading: statsLoading, isFetching: statsFetching } = useQuery({
    queryKey: ['home-stats'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_home_stats');
        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        const students = Number(row?.students_count);
        const seminars = Number(row?.seminars_count);
        const satisfactionPct = Number(row?.satisfaction_pct);

        const normalized = {
          students: Number.isFinite(students) ? students : null,
          seminars: Number.isFinite(seminars) ? seminars : null,
          satisfactionPct: Number.isFinite(satisfactionPct) ? satisfactionPct : null,
        };
        try {
          localStorage.setItem(
            statsCacheKey,
            JSON.stringify({ data: normalized, updatedAt: Date.now() })
          );
        } catch {
          // ignore caching errors
        }
        return normalized;
      } catch (err) {
        console.warn('home stats error', err?.message || err);
        return { students: null, seminars: null, satisfactionPct: null };
      }
    },
    staleTime: 1000 * 60 * 5,
    initialData: cachedStats?.data ?? undefined,
    initialDataUpdatedAt: cachedStats?.updatedAt || 0,
  });

  const statsReady = !statsLoading && !statsFetching;
  const formatCount = (value) => {
    if (typeof value !== 'number') return '—';
    return value.toLocaleString();
  };
  
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 opacity-20" 
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-full text-white/80 text-sm w-fit border border-white/10">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              {t('hero_badge', 'Plataforma de seminarios colaborativos')}
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
              {(t('heroTitle', 'Aprende, Colabora y Gana') || '').split(',').map((part, i) => (
                <span key={i}>
                  {i === 1 ? (
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                      {part}
                    </span>
                  ) : part}
                  {i === 0 && ','}
                </span>
              ))}
            </h1>
            
            <p className="text-xl text-white/70 max-w-xl leading-relaxed">
              {t('heroSubtitle', 'Seminarios donde todos ganan: profesores reciben su ingreso objetivo y estudiantes pagan menos invitando amigos')}
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Link to={createPageUrl('Seminars')}>
                <Button
                  size="lg"
                  className="bg-white text-slate-900 hover:bg-white/90 px-8 h-14 text-base font-medium rounded-xl"
                >
                  {t('exploreSeminars', 'Explorar seminarios')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to={ctaHref}>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 px-8 h-14 text-base font-medium rounded-xl"
                >
                  {t('becomeProfessor', 'Ser Profesor')}
                </Button>
              </Link>
            </div>
            
            <div className="flex gap-8 pt-8 border-t border-white/10">
              <div>
                <p className={`text-3xl font-bold text-white tabular-nums ${statsReady ? "" : "opacity-70"}`}>
                  {statsReady ? formatCount(stats?.students) : "—"}
                </p>
                <p className="text-white/60 text-sm">{t('students', 'Estudiantes')}</p>
              </div>
              <div>
                <p className={`text-3xl font-bold text-white tabular-nums ${statsReady ? "" : "opacity-70"}`}>
                  {statsReady ? formatCount(stats?.seminars) : "—"}
                </p>
                <p className="text-white/60 text-sm">{t('seminars', 'Seminarios')}</p>
              </div>
              <div>
                <p className={`text-3xl font-bold text-white tabular-nums ${statsReady ? "" : "opacity-70"}`}>
                  {statsReady && typeof stats?.satisfactionPct === 'number' ? `${stats.satisfactionPct}%` : "—"}
                </p>
                <p className="text-white/60 text-sm">{t('satisfaction', 'Satisfacción')}</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-20" />
              <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20">
                <img 
                  src={heroImageSrc}
                  alt={t('hero_image_alt', 'Students learning')}
                  className="rounded-2xl shadow-2xl"
                  loading="eager"
                  decoding="async"
                />
                
                {/* Badge Ahorro */}
                <motion.div 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="absolute -right-6 top-1/4 bg-white rounded-xl p-4 shadow-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{t('hero_savings_label', 'Ahorro promedio')}</p>
                      <p className="font-bold text-slate-900">-45%</p>
                    </div>
                  </div>
                </motion.div>
                
                {/* Badge Colaborativo */}
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="absolute -left-6 bottom-1/4 bg-white rounded-xl p-4 shadow-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{t('groupLearning', 'Aprendizaje grupal')}</p>
                      <p className="font-bold text-slate-900">{t('collaborative', 'Colaborativo')}</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
