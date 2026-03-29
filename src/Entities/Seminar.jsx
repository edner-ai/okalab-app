export const SeminarSchema = {
  status: ["draft", "interest_only", "published", "in_progress", "completed", "cancelled"],
  categories: ["employability", "entrepreneurship", "digital_skills"],
};

export const calculateSeminarPrice = (seminar, studentCount) => {
  if (!seminar || studentCount === 0) return 0;

  const platformFee = seminar.target_income * (seminar.platform_fee_percent / 100);
  const totalRequired = seminar.target_income + platformFee;
  const pricePerStudent = totalRequired / studentCount;

  return Math.round(pricePerStudent * 100) / 100;
};

export const getStatusLabel = (status, lang = 'es') => {
  const labels = {
    es: {
      draft: 'Borrador',
      interest_only: 'Captando interesados',
      published: 'Publicado',
      in_progress: 'En curso',
      completed: 'Completado',
      cancelled: 'Cancelado',
    },
    fr: {
      draft: 'Brouillon',
      interest_only: 'Collecte d\'interesses',
      published: 'Publie',
      in_progress: 'En cours',
      completed: 'Termine',
      cancelled: 'Annule',
    },
  };
  return labels[lang]?.[status] || status;
};
