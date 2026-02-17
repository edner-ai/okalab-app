import React from 'react';
import { Button } from "../ui/button"; // Adapté pour ton dossier local
import { Briefcase, Rocket, Code, LayoutGrid } from 'lucide-react';
import { useLanguage } from '../shared/LanguageContext'; // Adapté pour ton dossier local
import { motion } from 'framer-motion';

const categories = [
  { id: 'all', icon: LayoutGrid },
  { id: 'employability', icon: Briefcase },
  { id: 'entrepreneurship', icon: Rocket },
  { id: 'digital_skills', icon: Code }
];

export default function CategoryFilter({ selected, onSelect }) {
  const { t } = useLanguage();
  
  return (
    <div className="flex flex-wrap gap-3">
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isSelected = selected === cat.id;
        
        return (
          <motion.div key={cat.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant={isSelected ? "default" : "outline"}
              onClick={() => onSelect(cat.id)}
              className={`
                flex items-center gap-2 rounded-full px-5 py-2.5 transition-all
                ${isSelected 
                  ? 'bg-slate-900 text-white shadow-lg' 
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">
                {cat.id === 'all' ? t('all', 'Todos') : t(cat.id)}
              </span>
            </Button>
          </motion.div>
        );
      })}
    </div>
  );
}
