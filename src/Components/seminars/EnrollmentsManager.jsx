import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Users, Search, Mail, Calendar, DollarSign, Award, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLanguage } from '../shared/LanguageContext';

export default function EnrollmentsManager({ seminar, enrollments = [], onStatusUpdate }) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filtrage dynamique des étudiants
  const filteredEnrollments = enrollments.filter(enrollment => 
    enrollment.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    enrollment.student_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calcul des statistiques de l'onglet gestion
  const stats = {
    total: enrollments.length,
    confirmed: enrollments.filter(e => e.status === 'confirmed').length,
    pending: enrollments.filter(e => e.status === 'pending').length,
    cancelled: enrollments.filter(e => e.status === 'cancelled').length
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: t('pending', 'Pendiente'), color: 'bg-yellow-100 text-yellow-700' },
      confirmed: { label: t('confirmed', 'Confirmado'), color: 'bg-green-100 text-green-700' },
      completed: { label: t('completed', 'Completado'), color: 'bg-blue-100 text-blue-700' },
      cancelled: { label: t('cancelled', 'Cancelado'), color: 'bg-red-100 text-red-700' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge className={`${config.color} border-0`}>{config.label}</Badge>;
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-slate-400" />
            {t('enrolled_students', 'Estudiantes inscritos')} ({stats.total})
          </CardTitle>
        </div>
        
        {/* Grille de statistiques rapides */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label={t('total', 'Total')} value={stats.total} bg="bg-slate-50" text="text-slate-900" />
          <StatBox label={t('confirmed', 'Confirmados')} value={stats.confirmed} bg="bg-emerald-50" text="text-emerald-700" />
          <StatBox label={t('pending', 'Pendientes')} value={stats.pending} bg="bg-amber-50" text="text-amber-700" />
          <StatBox label={t('cancelled', 'Cancelados')} value={stats.cancelled} bg="bg-red-50" text="text-red-700" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t('enrollments_search', 'Buscar por nombre o email...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all"
          />
        </div>

        {filteredEnrollments.length === 0 ? (
          <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Users className="h-8 w-8 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              {searchQuery
                ? t('enrollments_no_matches', 'No se encontraron coincidencias')
                : t('enrollments_empty', 'Aún no hay estudiantes inscritos')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEnrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="p-4 bg-white border border-slate-100 rounded-2xl hover:shadow-sm transition-all"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-600">
                      {enrollment.student_name?.[0]?.toUpperCase() || 'E'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">{enrollment.student_name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" />
                        {enrollment.student_email}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {t('payment', 'Pago')}:
                        </span>
                        <span className="text-sm font-bold text-slate-900">${enrollment.amount_paid || 0}</span>
                      </div>
                      {getStatusBadge(enrollment.status)}
                    </div>

                    {/* Actions de validation pour le professeur */}
                    {enrollment.status === 'pending' && onStatusUpdate && (
                      <div className="flex gap-1 bg-slate-50 p-1 rounded-lg">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700"
                          onClick={() => onStatusUpdate(enrollment.id, 'confirmed')}
                        >
                          <CheckCircle className="h-5 w-5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-600 hover:bg-red-100 hover:text-red-700"
                          onClick={() => onStatusUpdate(enrollment.id, 'cancelled')}
                        >
                          <XCircle className="h-5 w-5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Sous-composant pour les petites boîtes de stats
function StatBox({ label, value, bg, text }) {
  return (
    <div className={`p-3 ${bg} rounded-xl border border-white/50 shadow-sm`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider opacity-70 ${text}`}>{label}</p>
      <p className={`text-xl font-black ${text}`}>{value}</p>
    </div>
  );
}
