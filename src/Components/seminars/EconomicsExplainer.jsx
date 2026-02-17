import React from 'react';
import { DollarSign, TrendingUp, Users, Award } from 'lucide-center'; // Note: Lucide-react
import { useLanguage } from '../shared/LanguageContext';

// --- COMPOSANTS UI TEMPORAIRES (Migration-friendly) ---
const Card = ({ children, className }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden ${className}`}>
    {children}
  </div>
);

export default function EconomicsExplainer({ seminar, enrollmentCount }) {
  const { t } = useLanguage();
  
  if (!seminar) return null;

  const targetIncome = seminar.target_income || 0;
  const platformFeePercent = seminar.platform_fee_percent || 15;
  const professorBonusPercent = seminar.professor_bonus_percent || 30;
  const maxStudents = seminar.max_students || enrollmentCount + 10;
  
  // Calcul du scénario actuel
  const currentPrice = targetIncome / Math.max(1, enrollmentCount);
  const totalCollected = enrollmentCount * currentPrice;
  const platformFee = totalCollected * (platformFeePercent / 100);
  const professorNet = targetIncome * (1 - platformFeePercent / 100);
  
  // Logique de surplus (si plus d'argent est collecté que l'objectif + frais)
  const surplus = Math.max(0, totalCollected - targetIncome - platformFee);
  const professorBonus = surplus * (professorBonusPercent / 100);
  const studentShare = surplus * (1 - professorBonusPercent / 100);
  
  return (
    <Card className="border-0 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <DollarSign className="h-5 w-5 text-blue-600" />
          </div>
          <h3 className="font-bold text-slate-900">{t('economicsModel', 'Modelo económico')}</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-white">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {t('enrolled', 'Inscritos')}
              </span>
            </div>
            <p className="text-xl font-black text-slate-900">{enrollmentCount}</p>
            <p className="text-[10px] text-slate-400">{t('max', 'limite')}: {maxStudents}</p>
          </div>
          
          <div className="p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-white">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {t('currentPrice', 'Precio')}
              </span>
            </div>
            <p className="text-xl font-black text-emerald-600">
              ${currentPrice.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-400">{t('perStudent', 'por persona')}</p>
          </div>
        </div>

        {surplus > 0 && (
          <div className="p-4 bg-white rounded-xl border-2 border-purple-200 shadow-sm mb-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-1">
               <Award className="h-12 w-12 text-purple-100 absolute -top-2 -right-2" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-5 w-5 text-purple-600" />
              <span className="font-bold text-purple-900">{t('surplus_alert', '¡Hay excedente!')}</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 italic">{t('surplus_total', 'Total a distribuir')}:</span>
                <span className="font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">${surplus.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-50">
                <span className="text-slate-600">{t('professorBonus', 'Bonus profesor')}:</span>
                <span className="font-bold text-emerald-600">+${professorBonus.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">{t('referral_bonus', 'Para referidos')}:</span>
                <span className="font-bold text-blue-600">${studentShare.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5 p-3 bg-slate-900/5 rounded-xl border border-black/5">
          <div className="flex justify-between text-[10px]">
             <span className="text-slate-500">{t('professor_base_income', 'Ingreso base profesor')}:</span>
             <span className="font-mono text-slate-700">${professorNet.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
             <span className="text-slate-500">{t('platformFee', 'Comisión plataforma')} ({platformFeePercent}%):</span>
             <span className="font-mono text-slate-700">${platformFee.toFixed(2)}</span>
          </div>
          <p className="text-[9px] text-slate-400 pt-1 border-t border-black/5 mt-1">
            {t('economics_note', '* Los cálculos se actualizan en tiempo real con cada inscripción.')}
          </p>
        </div>
      </div>
    </Card>
  );
}
