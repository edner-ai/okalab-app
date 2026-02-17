export const SeminarSchema = {
  // C'est votre structure que vous avez collée
  status: ["draft", "published", "in_progress", "completed", "cancelled"],
  categories: ["employability", "entrepreneurship", "digital_skills"],
};

// Logique de calcul du prix dynamique (Le cœur d'Okalab)
export const calculateSeminarPrice = (seminar, studentCount) => {
  if (!seminar || studentCount === 0) return 0;

  // 1. On calcule le total nécessaire (Revenu prof + frais plateforme)
  const platformFee = seminar.target_income * (seminar.platform_fee_percent / 100);
  const totalRequired = seminar.target_income + platformFee;

  // 2. Le prix par étudiant est le total divisé par le nombre d'inscrits
  const pricePerStudent = totalRequired / studentCount;

  return Math.round(pricePerStudent * 100) / 100; // Arrondi à 2 décimales
};

export const getStatusLabel = (status, lang = 'es') => {
  const labels = {
    es: { draft: 'Borrador', published: 'Publicado', in_progress: 'En curso' },
    fr: { draft: 'Brouillon', published: 'Publié', in_progress: 'En cours' }
    // On pourra ajouter les autres langues ici
  };
  return labels[lang][status] || status;
};