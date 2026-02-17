import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Wallet, TrendingUp, ArrowDownToLine, Clock } from 'lucide-react';
import { useLanguage } from '../shared/LanguageContext';
import { motion } from 'framer-motion';

export default function WalletCard({ wallet, onRequestWithdrawal }) {
  const { t } = useLanguage();
  
  if (!wallet) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-3 text-white/90">
            <div className="p-2 bg-white/10 rounded-xl">
              <Wallet className="h-5 w-5" />
            </div>
            {t('wallet', 'Billetera')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center py-4">
            <p className="text-sm text-white/60 mb-1">{t('availableBalance', 'Saldo disponible')}</p>
            <p className="text-5xl font-black tracking-tight">
              ${(wallet.balance || 0).toFixed(2)}
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-white/5 rounded-xl">
              <Clock className="h-4 w-4 mx-auto mb-1 text-amber-400" />
              <p className="text-[10px] text-white/60 uppercase">{t('pendingBalance', 'Pendiente')}</p>
              <p className="font-semibold text-sm">${(wallet.pending_balance || 0).toFixed(2)}</p>
            </div>
            <div className="text-center p-3 bg-white/5 rounded-xl">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-emerald-400" />
              <p className="text-[10px] text-white/60 uppercase">{t('totalEarned', 'Ganado')}</p>
              <p className="font-semibold text-sm">${(wallet.total_earned || 0).toFixed(2)}</p>
            </div>
            <div className="text-center p-3 bg-white/5 rounded-xl">
              <ArrowDownToLine className="h-4 w-4 mx-auto mb-1 text-blue-400" />
              <p className="text-[10px] text-white/60 uppercase">{t('totalWithdrawn', 'Retirado')}</p>
              <p className="font-semibold text-sm">${(wallet.total_withdrawn || 0).toFixed(2)}</p>
            </div>
          </div>
          
          {onRequestWithdrawal && (
            <Button 
              onClick={onRequestWithdrawal}
              className="w-full bg-white text-slate-900 hover:bg-white/90 font-bold py-6 rounded-xl shadow-lg"
            >
              {t('requestWithdrawal', 'Solicitar retiro')}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
