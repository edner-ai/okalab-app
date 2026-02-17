import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export const DEFAULT_TRANSLATIONS = {
  es: {
    home: "Inicio",
    seminars: "Seminarios",
    mySeminars: "Mis Seminarios",
    wallet: "Billetera",
    profile: "Perfil",
    logout: "Cerrar Sesión",
    employability: "Empleabilidad",
    entrepreneurship: "Emprendimiento",
    digital_skills: "Habilidades Digitales",
    categoriesSectionTitle: "Categorías para jóvenes",
    categoriesSectionSubtitle: "Seminarios diseñados para impulsar tu carrera y desarrollo profesional",
    online: "En Línea",
    presential: "Presencial",
    hybrid: "Híbrido",
    hours: "horas",
    students: "estudiantes",
    enrolled: "inscrito(s)",
    startDate: "Fecha de inicio",
    endDate: "Fecha de fin",
    targetIncome: "Ingreso objetivo",
    currentPrice: "Precio actual",
    perStudent: "por estudiante",
    enroll: "Inscribirse",
    invite: "Invitar amigos",
    createSeminar: "Crear Seminario",
    viewDetails: "Ver detalles",
    download: "Descargar",
    materials: "Materiales",
    availableBalance: "Balance Disponible",
    pendingBalance: "Balance Pendiente",
    totalEarned: "Total Ganado",
    totalWithdrawn: "Total Retirado",
    requestWithdrawal: "Solicitar Retiro",
    transactions: "Transacciones",
    draft: "Borrador",
    published: "Publicado",
    in_progress: "En Progreso",
    completed: "Completado",
    cancelled: "Cancelado",
    pending: "Pendiente",
    confirmed: "Confirmado",
    paid: "Pagado",
    seminar_income: "Ingreso de seminario",
    referral_bonus: "Bonus por referido",
    platform_fee: "Comisión plataforma",
    withdrawal: "Retiro",
    surplus_distribution: "Distribución de excedente",
    priceExplanation: "Mientras más estudiantes se inscriban, menor será el precio para cada uno.",
    surplusExplanation: "Si el total recaudado supera el objetivo, el excedente se reparte entre quienes invitaron nuevos estudiantes.",
    referralSuccess: "¡Comparte tu enlace para reducir tu precio y ganar bonos!",
    title: "Título",
    description: "Descripción",
    category: "Categoría",
    modality: "Modalidad",
    selectCategory: "Seleccionar categoría",
    selectModality: "Seleccionar modalidad",
    save: "Guardar",
    cancel: "Cancelar",
    publish: "Publicar",
    heroTitle: "Aprende, Colabora y Gana",
    heroSubtitle: "Seminarios donde todos ganan: profesores reciben su ingreso objetivo y estudiantes pagan menos invitando amigos",
    exploreSeminars: "Explorar Seminarios",
    becomeProfessor: "Ser Profesor",
    howItWorks: "¿Cómo funciona?",
    step1Title: "El profesor define su objetivo",
    step1Desc: "Cada seminario tiene un ingreso objetivo que el profesor siempre recibirá",
    step2Title: "Estudiantes se inscriben",
    step2Desc: "El precio se divide entre todos los participantes",
    step3Title: "Invita y gana",
    step3Desc: "Los excedentes se reparten entre quienes trajeron nuevos estudiantes",
    location: "Ubicación",
    getDirections: "Cómo llegar",
    openInMaps: "Abrir en mapas",
    videoConference: "Videoconferencia",
    meetingLink: "Enlace de reunión",
    meetingId: "ID de reunión",
    password: "Contraseña",
    certificate: "Certificado",
    hasCertificate: "Ofrece certificado",
    downloadCertificate: "Descargar certificado",
    platformFee: "Comisión plataforma",
    professorBonus: "Bonus profesor",
    surplus: "Excedente",
    maxStudents: "Máximo de estudiantes",
    featuredSeminars: "Seminarios destacados", 
    featuredSeminarsSubtitle: "Los seminarios más populares de nuestra comunidad",
    readyToShare: "¿Listo para compartir tu conocimiento?",
    readyToShareSub: "Crea tu primer seminario y recibe el ingreso que mereces, mientras ayudas a otros a aprender.",
    createSeminar: "Crear mi seminario",
    allRightsReserved: "Todos los derechos reservados.",
    // Hero Stats & Badges
    students: "estudiantes",
    seminarsCount: "Seminarios",
    satisfaction: "Satisfacción",
    groupLearning: "Aprendizaje grupal",
    collaborative: "Colaborativo",
    exploreSeminars: "Explorar Seminarios",
    beTeacher: "Ser Profesor",
    viewAll: "Ver todos"
  },
  en: {
    home: "Home",
    seminars: "Seminars",
    mySeminars: "My Seminars",
    wallet: "Wallet",
    profile: "Profile",
    logout: "Logout",
    employability: "Employability",
    entrepreneurship: "Entrepreneurship",
    digital_skills: "Digital Skills",
    categoriesSectionTitle: "Categories for Youth",
    categoriesSectionSubtitle: "Seminars designed to boost your career and professional development",
    online: "Online",
    presential: "In-Person",
    hybrid: "Hybrid",
    hours: "hours",
    students: "students",
    enrolled: "enrolled",
    startDate: "Start date",
    endDate: "End date",
    targetIncome: "Target income",
    currentPrice: "Current price",
    perStudent: "per student",
    enroll: "Enroll",
    invite: "Invite friends",
    createSeminar: "Create Seminar",
    viewDetails: "View details",
    download: "Download",
    materials: "Materials",
    availableBalance: "Available Balance",
    pendingBalance: "Pending Balance",
    totalEarned: "Total Earned",
    totalWithdrawn: "Total Withdrawn",
    requestWithdrawal: "Request Withdrawal",
    transactions: "Transactions",
    draft: "Draft",
    published: "Published",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
    pending: "Pending",
    confirmed: "Confirmed",
    paid: "Paid",
    seminar_income: "Seminar income",
    referral_bonus: "Referral bonus",
    platform_fee: "Platform fee",
    withdrawal: "Withdrawal",
    surplus_distribution: "Surplus distribution",
    priceExplanation: "The more students enroll, the lower the price for everyone.",
    surplusExplanation: "If the total collected exceeds the target, the surplus is shared among those who invited new students.",
    referralSuccess: "Share your link to reduce your price and earn bonuses!",
    title: "Title",
    description: "Description",
    category: "Category",
    modality: "Modality",
    selectCategory: "Select category",
    selectModality: "Select modality",
    save: "Save",
    cancel: "Cancel",
    publish: "Publish",
    heroTitle: "Learn, Collaborate and Earn",
    heroSubtitle: "Seminars where everyone wins: professors receive their target income and students pay less by inviting friends",
    exploreSeminars: "Explore Seminars",
    becomeProfessor: "Become Professor",
    howItWorks: "How it works?",
    step1Title: "Professor sets the target",
    step1Desc: "Each seminar has a target income the professor will always receive",
    step2Title: "Students enroll",
    step2Desc: "The price is divided among all participants",
    step3Title: "Invite and earn",
    step3Desc: "Surplus is shared among those who brought new students",
    location: "Location",
    getDirections: "Get directions",
    openInMaps: "Open in maps",
    videoConference: "Video Conference",
    meetingLink: "Meeting link",
    meetingId: "Meeting ID",
    password: "Password",
    certificate: "Certificate",
    hasCertificate: "Offers certificate",
    downloadCertificate: "Download certificate",
    platformFee: "Platform fee",
    professorBonus: "Professor bonus",
    surplus: "Surplus",
    maxStudents: "Maximum students",
    featuredSeminars: "Featured Seminars",
    featuredSeminarsSubtitle: "The most popular seminars in our community",
    readyToShare: "Ready to share your knowledge?",
    readyToShareSub: "Create your first seminar and get the income you deserve while helping others learn.",
    createSeminar: "Create my seminar",
    allRightsReserved: "All rights reserved.",
    // Hero Stats & Badges
    students: "students",
    seminarsCount: "Seminars",
    satisfaction: "Satisfaction",
    groupLearning: "Group learning",
    collaborative: "Collaborative",
    exploreSeminars: "Explore Seminars",
    beTeacher: "Become a Teacher",
    viewAll: "View all"
  },
  fr: {
    home: "Accueil",
    seminars: "Séminaires",
    mySeminars: "Mes Séminaires",
    wallet: "Portefeuille",
    profile: "Profil",
    logout: "Déconnexion",
    employability: "Employabilité",
    entrepreneurship: "Entrepreneuriat",
    digital_skills: "Compétences Numériques",
    categoriesSectionTitle: "Catégories pour les jeunes",
    categoriesSectionSubtitle: "Séminaires conçus pour booster votre carrière et développement professionnel",
    online: "En ligne",
    presential: "Présentiel",
    hybrid: "Hybride",
    hours: "heures",
    students: "étudiants",
    enrolled: "inscrit(s)",
    startDate: "Date de début",
    endDate: "Date de fin",
    targetIncome: "Revenu cible",
    currentPrice: "Prix actuel",
    perStudent: "par étudiant",
    enroll: "S'inscrire",
    invite: "Inviter des amis",
    createSeminar: "Créer un Séminaire",
    viewDetails: "Voir les détails",
    download: "Télécharger",
    materials: "Matériaux",
    availableBalance: "Solde Disponible",
    pendingBalance: "Solde en Attente",
    totalEarned: "Total Gagné",
    totalWithdrawn: "Total Retiré",
    requestWithdrawal: "Demander un Retrait",
    transactions: "Transactions",
    draft: "Brouillon",
    published: "Publié",
    in_progress: "En Cours",
    completed: "Terminé",
    cancelled: "Annulé",
    pending: "En Attente",
    confirmed: "Confirmé",
    paid: "Payé",
    seminar_income: "Revenu du séminaire",
    referral_bonus: "Bonus de parrainage",
    platform_fee: "Frais de plateforme",
    withdrawal: "Retrait",
    surplus_distribution: "Distribution de surplus",
    priceExplanation: "Plus il y a d'étudiants inscrits, plus le prix est bas pour tous.",
    surplusExplanation: "Si le total collecté dépasse l'objectif, le surplus est partagé entre ceux qui ont invité de nouveaux étudiants.",
    referralSuccess: "Partagez votre lien pour réduire votre prix et gagner des bonus!",
    title: "Titre",
    description: "Description",
    category: "Catégorie",
    modality: "Modalité",
    selectCategory: "Sélectionner la catégorie",
    selectModality: "Sélectionner la modalité",
    save: "Enregistrer",
    cancel: "Annuler",
    publish: "Publier",
    heroTitle: "Apprenez, Collaborez et Gagnez",
    heroSubtitle: "Séminaires où tout le monde gagne: les professeurs reçoivent leur revenu cible et les étudiants paient moins en invitant des amis",
    exploreSeminars: "Explorer les Séminaires",
    becomeProfessor: "Devenir Professeur",
    howItWorks: "Comment ça marche?",
    step1Title: "Le professeur définit l'objectif",
    step1Desc: "Chaque séminaire a un revenu cible que le professeur recevra toujours",
    step2Title: "Les étudiants s'inscrivent",
    step2Desc: "Le prix est divisé entre tous les participants",
    step3Title: "Invitez et gagnez",
    step3Desc: "Le surplus est partagé entre ceux qui ont amené de nouveaux étudiants",
    location: "Emplacement",
    getDirections: "Obtenir l'itinéraire",
    openInMaps: "Ouvrir dans les cartes",
    videoConference: "Vidéoconférence",
    meetingLink: "Lien de réunion",
    meetingId: "ID de réunion",
    password: "Mot de passe",
    certificate: "Certificat",
    hasCertificate: "Offre un certificat",
    downloadCertificate: "Télécharger le certificat",
    platformFee: "Frais de plateforme",
    professorBonus: "Bonus professeur",
    surplus: "Surplus",
    maxStudents: "Maximum d'étudiants",
    featuredSeminars: "Séminaires à la une",
    featuredSeminarsSubtitle: "Les séminaires les plus populaires de notre communauté",
    readyToShare: "Prêt à partager votre savoir ?",
    readyToShareSub: "Créez votre premier séminaire et recevez les revenus que vous méritez, tout en aidant les autres à apprendre.",
    createSeminar: "Créer mon séminaire",
    allRightsReserved: "Tous droits réservés.",
    // Hero Stats & Badges
    students: "étudiants",
    seminarsCount: "Séminaires",
    satisfaction: "Satisfaction",
    groupLearning: "Apprentissage groupé",
    collaborative: "Collaboratif",
    exploreSeminars: "Explorer les Séminaires",
    beTeacher: "Devenir Professeur",
    viewAll: "Voir tout"
  },
  ht: {
    home: "Akèy",
    seminars: "Seminè",
    mySeminars: "Seminè Mwen",
    wallet: "Pòtfèy",
    profile: "Pwofil",
    logout: "Dekonekte",
    employability: "Anplwayabilite",
    entrepreneurship: "Antreprenè",
    digital_skills: "Konpetans Dijital",
    categoriesSectionTitle: "Kategori pou jèn yo",
    categoriesSectionSubtitle: "Seminè ki fèt pou ranfòse karyè ou ak devlopman pwofesyonèl ou",
    online: "Sou Entènèt",
    presential: "An Pèsòn",
    hybrid: "Melanje",
    hours: "èdtan",
    students: "elèv",
    enrolled: "enskri",
    startDate: "Dat kòmansman",
    endDate: "Dat fen",
    targetIncome: "Objektif revni",
    currentPrice: "Pri kounye a",
    perStudent: "pou chak elèv",
    enroll: "Enskri",
    invite: "Envite zanmi",
    createSeminar: "Kreye yon Seminè",
    viewDetails: "Gade detay",
    download: "Telechaje",
    materials: "Materyèl",
    availableBalance: "Balans Disponib",
    pendingBalance: "Balans an Atant",
    totalEarned: "Total Touche",
    totalWithdrawn: "Total Retire",
    requestWithdrawal: "Mande Retrè",
    transactions: "Tranzaksyon",
    draft: "Bouyon",
    published: "Pibliye",
    in_progress: "An Kou",
    completed: "Konplete",
    cancelled: "Anile",
    pending: "An Atant",
    confirmed: "Konfime",
    paid: "Peye",
    seminar_income: "Revni seminè",
    referral_bonus: "Bonifikasyon referans",
    platform_fee: "Frè platfòm",
    withdrawal: "Retrè",
    surplus_distribution: "Distribisyon siplis",
    priceExplanation: "Plis elèv ki enskri, pi ba pri a pou tout moun.",
    surplusExplanation: "Si total la depase objektif la, siplis la pataje ant moun ki te envite nouvo elèv yo.",
    referralSuccess: "Pataje lyen ou pou redui pri ou epi jwenn bonifikasyon!",
    title: "Tit",
    description: "Deskripsyon",
    category: "Kategori",
    modality: "Modalite",
    selectCategory: "Chwazi kategori",
    selectModality: "Chwazi modalite",
    save: "Anrejistre",
    cancel: "Anile",
    publish: "Pibliye",
    heroTitle: "Aprann, Kolabore epi Touche",
    heroSubtitle: "Seminè kote tout moun genyen: pwofesè yo resevwa objektif revni yo epi elèv yo peye mwens lè yo envite zanmi",
    exploreSeminars: "Eksplore Seminè",
    becomeProfessor: "Vin yon Pwofesè",
    howItWorks: "Kijan sa fonksyone?",
    step1Title: "Pwofesè a defini objektif",
    step1Desc: "Chak seminè gen yon objektif revni pwofesè a ap toujou resevwa",
    step2Title: "Elèv yo enskri",
    step2Desc: "Pri a divize ant tout patisipan yo",
    step3Title: "Envite epi touche",
    step3Desc: "Siplis la pataje ant moun ki te mennen nouvo elèv yo",
    location: "Kote",
    getDirections: "Jwenn direksyon",
    openInMaps: "Louvri nan kat",
    videoConference: "Videokonferans",
    meetingLink: "Lyen reyinyon",
    meetingId: "ID reyinyon",
    password: "Modpas",
    certificate: "Sètifika",
    hasCertificate: "Ofri sètifika",
    downloadCertificate: "Telechaje sètifika",
    platformFee: "Frè platfòm",
    professorBonus: "Bonifikasyon pwofesè",
    surplus: "Siplis",
    maxStudents: "Maksimòm elèv",
    featuredSeminars: "Seminè yo prezante",
    featuredSeminarsSubtitle: "Seminè ki pi popilè nan kominote nou an",
    readyToShare: "Èske ou prè pou pataje konesans ou?",
    readyToShareSub: "Kreye premye seminè ou jodi a epi resevwa revni ou merite a, pandan w ap ede lòt moun aprann.",
    createSeminar: "Kreye seminè mwen",
    allRightsReserved: "Tout dwa rezève.",
    students: "etidyan",
    seminarsCount: "Seminè",
    satisfaction: "Satisfaksyon",
    groupLearning: "Aprantisaj an gwoup",
    collaborative: "Kolaboratif",
    exploreSeminars: "Eksplore Seminè yo",
    beTeacher: "Vin Pwofesè",
    viewAll: "Gade tout"
  }
};

const LanguageContext = createContext();
const LANGS = ['es', 'en', 'fr', 'ht'];
const CACHE_KEY = 'i18n_cache_v1';

function buildMap(rows = []) {
  const map = { es: {}, en: {}, fr: {}, ht: {} };
  rows.forEach((row) => {
    if (!row?.key) return;
    LANGS.forEach((lang) => {
      if (row[lang]) map[lang][row.key] = row[lang];
    });
  });
  return map;
}

export function LanguageProvider({ children }) {
  const { user, profile } = useAuth();
  const [language, setLanguage] = useState(localStorage.getItem('preferred_language') || 'es');
  const [dbTranslations, setDbTranslations] = useState(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  
  useEffect(() => {
    localStorage.setItem('preferred_language', language);
  }, [language]);
  
  const persistPreferredLanguage = async (lang) => {
    if (!user) return;
    if (profile?.preferred_language === lang) return;
    const { error } = await supabase
      .from('profiles')
      .update({ preferred_language: lang, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      console.warn('preferred_language update error', error.message);
    }
  };

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('preferred_language', lang);
    void persistPreferredLanguage(lang);
  };
  
  const refreshTranslations = async () => {
    const { data, error } = await supabase.from('i18n').select('*');
    if (error) {
      console.warn('i18n load error', error.message);
      return;
    }
    const map = buildMap(data || []);
    setDbTranslations(map);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(map));
    } catch {}
  };

  useEffect(() => {
    refreshTranslations();
  }, []);
  
  const t = (key, fallback) => {
    if (dbTranslations?.[language]?.[key]) return dbTranslations[language][key];
    if (dbTranslations?.es?.[key]) return dbTranslations.es[key];
    if (DEFAULT_TRANSLATIONS[language]?.[key]) return DEFAULT_TRANSLATIONS[language][key];
    if (DEFAULT_TRANSLATIONS.es?.[key]) return DEFAULT_TRANSLATIONS.es[key];
    return fallback ?? key;
  };
  
  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t, refreshTranslations }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return { language: 'es', changeLanguage: () => {}, t: (key) => key, refreshTranslations: () => {} };
  }
  return context;
}
