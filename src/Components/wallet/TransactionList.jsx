import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { ArrowUpRight, ArrowDownLeft, Gift, Percent, ArrowDownToLine } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '../shared/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

const typeConfig = {
  seminar_income: { icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  referral_bonus: { icon: Gift, color: 'text-purple-600', bg: 'bg-purple-50' },
  platform_fee: { icon: Percent, color: 'text-amber-600', bg: 'bg-amber-50' },
  withdrawal: { icon: ArrowDownToLine, color: 'text-blue-600', bg: 'bg-blue-50' },
  surplus_distribution: { icon: ArrowDownLeft, color: 'text-emerald-600', bg: 'bg-emerald-50' }
};

export default function TransactionList({ transactions = [], loading }) {
  const { t } = useLanguage();
  
  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-white border-b border-slate-50">
        <CardTitle className="text-lg font-bold text-slate-800">{t('transactions', 'Transacciones')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-8 text-center text-slate-400 italic">{t('transactions_loading', 'Cargando historial...')}</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
               <ArrowUpRight className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">{t('noTransactions', 'No hay movimientos aún')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            <AnimatePresence>
              {transactions.map((tx, index) => {
                const config = typeConfig[tx.type] || { icon: ArrowUpRight, color: 'text-slate-600', bg: 'bg-slate-50' };
                const Icon = config.icon;
                const isPositive = ['seminar_income', 'referral_bonus', 'surplus_distribution'].includes(tx.type);

                return (
                  <motion.div
                    key={tx.id || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${config.bg}`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{t(tx.type, tx.type)}</p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {tx.created_at ? format(new Date(tx.created_at), 'MMM d, yyyy • HH:mm') : t('recent', 'Reciente')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black ${isPositive ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {isPositive ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                      </p>
                      <Badge variant="outline" className="text-[10px] py-0 px-2 uppercase font-bold border-slate-100">
                        {t(tx.status, tx.status)}
                      </Badge>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
