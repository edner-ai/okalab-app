import React from 'react';
import { Target, Users, Gift, ArrowRight } from 'lucide-react';
import { useLanguage } from '../shared/LanguageContext';
import { motion } from 'framer-motion';

const steps = [
  { id: 1, icon: Target, color: 'from-blue-500 to-blue-600' },
  { id: 2, icon: Users, color: 'from-purple-500 to-purple-600' },
  { id: 3, icon: Gift, color: 'from-emerald-500 to-emerald-600' }
];

export default function HowItWorksSection() {
  const { t } = useLanguage();
  
  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            {t('howItWorks', '¿Cómo funciona?')}
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            {t('howItWorksSubtitle', 'Un modelo único que beneficia a todos los participantes')}
          </p>
        </motion.div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                <div className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-shadow h-full">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-6`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  
                  <div className="absolute -top-4 -left-2 w-10 h-10 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-lg">
                    {step.id}
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    {t(`step${step.id}Title`, `Paso ${step.id}`)}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {t(`step${step.id}Desc`, '')}
                  </p>
                </div>
                
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 z-10">
                    <ArrowRight className="h-8 w-8 text-slate-300" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 bg-white rounded-3xl p-8 md:p-12 shadow-lg"
        >
          <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">
            {t('howItWorksExampleTitle', 'Ejemplo: Seminario de $500 USD')}
          </h3>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { students: 1, price: 500, savings: 0 },
              { students: 5, price: 100, savings: 80 },
              { students: 10, price: 50, savings: 90 },
              { students: 20, price: 25, savings: 95 }
            ].map((item, i) => (
              <div key={i} className={`p-6 rounded-2xl text-center ${i === 3 ? 'bg-emerald-50 ring-2 ring-emerald-200' : 'bg-slate-50'}`}>
                <p className="text-3xl font-bold text-slate-900 mb-1">{item.students}</p>
                <p className="text-sm text-slate-500 mb-4">{t('students', 'estudiantes')}</p>
                <p className="text-2xl font-bold text-emerald-600">${item.price}</p>
                <p className="text-sm text-slate-500">{t('perStudent', 'por estudiante')}</p>
                {item.savings > 0 && (
                  <p className="mt-2 text-sm font-medium text-emerald-600">
                    -{item.savings}% {t('savings', 'de ahorro')}
                  </p>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-8">
            <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-700 shadow-sm text-center">
              {t('howItWorksExampleNote', '✨ El profesor recibe sus $500 USD. Los estudiantes pagan menos cuantos más sean.')}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
