import React from 'react';
import { Briefcase, Rocket, Code, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { useLanguage } from '../shared/LanguageContext';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../ui/card';

const categories = [
  {
    id: 'employability',
    icon: Briefcase,
    color: 'from-blue-500 to-blue-600',
    bgLight: 'bg-blue-50',
    image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600'
  },
  {
    id: 'entrepreneurship',
    icon: Rocket,
    color: 'from-emerald-500 to-emerald-600',
    bgLight: 'bg-emerald-50',
    image: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600'
  },
  {
    id: 'digital_skills',
    icon: Code,
    color: 'from-purple-500 to-purple-600',
    bgLight: 'bg-purple-50',
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600'
  }
];

export default function CategoriesSection() {
  const { t } = useLanguage();
  
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            {t('categoriesSectionTitle', 'Categorías para jóvenes')}
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            {t('categoriesSectionSubtitle', 'Seminarios diseñados para impulsar tu carrera y desarrollo profesional')}
          </p>
        </motion.div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {categories.map((cat, index) => {
            const Icon = cat.icon;
            
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link to={createPageUrl(`Seminars?category=${cat.id}`)}>
                  <Card className="group overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer">
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={cat.image}
                        alt={t(cat.id, cat.id)}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-t ${cat.color} opacity-80`} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Icon className="h-16 w-16 text-white" />
                      </div>
                    </div>
                    <CardContent className="p-6 pt-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-slate-900">
                          {t(cat.id, cat.id)}
                        </h3>
                        <ArrowRight className="h-5 w-5 text-slate-400 group-hover:translate-x-1 group-hover:text-slate-900 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
