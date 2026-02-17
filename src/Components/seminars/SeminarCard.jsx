

import React from 'react';
import { Card, CardContent, CardFooter } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Calendar, Clock, Users, MapPin, Monitor, Laptop } from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { useLanguage } from '../shared/LanguageContext';
import { motion } from 'framer-motion';
import StarRating from '../reviews/StarRating';

const categoryColors = {
  employability: "bg-blue-100 text-blue-700 border-blue-200",
  entrepreneurship: "bg-emerald-100 text-emerald-700 border-emerald-200",
  digital_skills: "bg-purple-100 text-purple-700 border-purple-200"
};

const modalityIcons = {
  online: Monitor,
  presential: MapPin,
  hybrid: Laptop
};

export default function SeminarCard({
  seminar,
  enrollmentCount = 0,
  ratingAvg = 0,
  ratingCount = 0,
}) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : enUS;
  
  const basePrice = Number(seminar?.target_income || 0);
  const currentStudents = Math.max(1, enrollmentCount || 0);
  const pricePerStudent = basePrice > 0 ? basePrice / currentStudents : 0;
  
  const ModalityIcon = modalityIcons[seminar.modality] || Monitor;
  const fallbackImage = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800";

  const normalizeImageUrl = (url) => {
    if (!url) return fallbackImage;
    const clean = String(url).split("?")[0];
    if (clean.includes("/storage/v1/object/sign/")) {
      return clean.replace("/storage/v1/object/sign/", "/storage/v1/object/public/");
    }
    return url;
  };

  const imageSrc = normalizeImageUrl(seminar?.image_url);
  
  const savings = basePrice > 0 ? Math.round((1 - pricePerStudent / basePrice) * 100) : 0;
  const hasReviews = (ratingCount || 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 border-0 bg-white group">
        <div className="relative h-48 overflow-hidden">
          <img
            src={imageSrc}
            alt={seminar.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => {
              if (e.currentTarget.src !== fallbackImage) {
                e.currentTarget.src = fallbackImage;
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <Badge
            variant="outline"
            className={`absolute top-4 left-4 ${categoryColors[seminar.category] || "bg-slate-100"} border`}
          >
            {t(seminar.category, seminar.category)}
          </Badge>
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-white font-bold text-lg line-clamp-2">{seminar.title}</h3>
          </div>
        </div>
        
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>
                {seminar.start_date
                  ? format(new Date(seminar.start_date), 'MMM d', { locale: dateLocale })
                  : t('tbd', 'Por definir')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>{seminar.total_hours || 0} {t('hours', 'horas')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ModalityIcon className="h-4 w-4" />
              <span>{t(seminar.modality, seminar.modality)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-600">{enrollmentCount} {t('enrolled', 'inscrito(s)')}</span>
          </div>

          <div className="flex items-center gap-2">
            <StarRating value={ratingAvg} readOnly size={14} />
            {hasReviews ? (
              <span className="text-xs text-slate-500">
                {ratingAvg.toFixed(1)} · {ratingCount} {t("reviews", "reseñas")}
              </span>
            ) : (
              <span className="text-xs text-slate-400">{t("review_no_reviews", "Sin reseñas")}</span>
            )}
          </div>
          
          <div className="pt-3 border-t">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{t('currentPrice', 'Precio actual')}</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${pricePerStudent.toFixed(2)}
                  <span className="text-sm font-normal text-slate-500 ml-1">{t('perStudent', 'por estudiante')}</span>
                </p>
              </div>
              {savings > 0 && (
                <div className="text-right">
                  <p className="text-xs text-emerald-600 font-medium">
                    {savings}% {t('less', 'menos')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="p-5 pt-0">
          <Link to={createPageUrl(`SeminarDetails?id=${seminar.id}`)} className="w-full">
            <Button className="w-full bg-slate-900 hover:bg-slate-800">
              {t('viewDetails', 'Ver detalles')}
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
