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
    held: "Retenido",
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
    viewAll: "Ver todos",
    login_chip: "Plataforma de seminarios colaborativos",
    login_hero_learn: "Aprende,",
    login_hero_collaborate: "Colabora",
    login_hero_and: "y",
    login_hero_earn: "Gana",
    login_hero_subtitle: "Okalab conecta profesores y estudiantes en experiencias practicas donde todos ganan.",
    login_social_soon: "Proximamente: Facebook.",
    auth_create_account: "Crear una cuenta",
    auth_welcome_back: "Bienvenido de nuevo",
    auth_signup_subtitle: "Registrate para empezar a aprender y colaborar.",
    auth_login_subtitle: "Inicia sesion para acceder a tu cuenta.",
    auth_login: "Iniciar sesion",
    auth_signup: "Registrarse",
    auth_continue_google: "Continuar con Google",
    auth_continue_facebook: "Continuar con Facebook",
    auth_or_email: "o con email",
    auth_email: "Email",
    auth_password: "Contrasena",
    auth_create_account_btn: "Crear cuenta",
    auth_login_btn: "Entrar",
    auth_legal_prefix: "Al continuar aceptas nuestros",
    auth_terms: "Terminos de servicio",
    auth_legal_and: "y",
    auth_privacy: "Politica de privacidad",
    auth_show_password: "Mostrar contrasena",
    auth_hide_password: "Ocultar contrasena",
    auth_invalid_login: "Email o contrasena incorrectos.",
    auth_email_not_confirmed: "Debes confirmar tu correo antes de iniciar sesion.",
    auth_signup_disabled: "El registro esta deshabilitado en este momento.",
    auth_rate_limit: "Demasiados intentos. Espera un momento antes de volver a intentar.",
    auth_error: "Error de autenticacion",
    auth_signup_success: "Registro exitoso. Revisa tu email si pide confirmacion."
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
    held: "Held",
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
    viewAll: "View all",
    login_chip: "Collaborative seminar platform",
    login_hero_learn: "Learn,",
    login_hero_collaborate: "Collaborate",
    login_hero_and: "and",
    login_hero_earn: "Earn",
    login_hero_subtitle: "Okalab connects teachers and students through practical experiences where everyone wins.",
    login_social_soon: "Coming soon: Facebook.",
    auth_create_account: "Create an account",
    auth_welcome_back: "Welcome back",
    auth_signup_subtitle: "Sign up to start learning and collaborating.",
    auth_login_subtitle: "Sign in to access your account.",
    auth_login: "Sign in",
    auth_signup: "Register",
    auth_continue_google: "Continue with Google",
    auth_continue_facebook: "Continue with Facebook",
    auth_or_email: "or with email",
    auth_email: "Email",
    auth_password: "Password",
    auth_create_account_btn: "Create account",
    auth_login_btn: "Enter",
    auth_legal_prefix: "By continuing you accept our",
    auth_terms: "Terms of Service",
    auth_legal_and: "and",
    auth_privacy: "Privacy Policy",
    auth_show_password: "Show password",
    auth_hide_password: "Hide password",
    auth_invalid_login: "Incorrect email or password.",
    auth_email_not_confirmed: "You must confirm your email before signing in.",
    auth_signup_disabled: "Sign up is currently disabled.",
    auth_rate_limit: "Too many attempts. Please wait a moment before trying again.",
    auth_error: "Authentication error",
    auth_signup_success: "Registration successful. Check your email if confirmation is required."
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
    held: "Retenu",
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
    viewAll: "Voir tout",
    login_chip: "Plateforme de seminaires collaboratifs",
    login_hero_learn: "Apprenez,",
    login_hero_collaborate: "Collaborez",
    login_hero_and: "et",
    login_hero_earn: "Gagnez",
    login_hero_subtitle: "Okalab relie professeurs et etudiants dans des experiences pratiques ou tout le monde gagne.",
    login_social_soon: "Bientot : Facebook.",
    auth_create_account: "Creer un compte",
    auth_welcome_back: "Bon retour",
    auth_signup_subtitle: "Inscrivez-vous pour commencer a apprendre et collaborer.",
    auth_login_subtitle: "Connectez-vous pour acceder a votre compte.",
    auth_login: "Se connecter",
    auth_signup: "S'inscrire",
    auth_continue_google: "Continuer avec Google",
    auth_continue_facebook: "Continuer avec Facebook",
    auth_or_email: "ou avec email",
    auth_email: "Email",
    auth_password: "Mot de passe",
    auth_create_account_btn: "Creer un compte",
    auth_login_btn: "Entrer",
    auth_legal_prefix: "En continuant, vous acceptez nos",
    auth_terms: "Conditions d'utilisation",
    auth_legal_and: "et",
    auth_privacy: "Politique de confidentialite",
    auth_show_password: "Afficher le mot de passe",
    auth_hide_password: "Masquer le mot de passe",
    auth_invalid_login: "Email ou mot de passe incorrect.",
    auth_email_not_confirmed: "Vous devez confirmer votre email avant de vous connecter.",
    auth_signup_disabled: "L'inscription est desactivee pour le moment.",
    auth_rate_limit: "Trop de tentatives. Attendez un instant avant de recommencer.",
    auth_error: "Erreur d'authentification",
    auth_signup_success: "Inscription reussie. Verifiez votre email si une confirmation est requise."
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
    held: "Kenbe",
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
    viewAll: "Gade tout",
    login_chip: "Platfom semin kolaboratif",
    login_hero_learn: "Aprann,",
    login_hero_collaborate: "Kolabore",
    login_hero_and: "epi",
    login_hero_earn: "Touche",
    login_hero_subtitle: "Okalab konekte pwofese ak etidyan nan eksperyans pratik kote tout moun genyen.",
    login_social_soon: "Talè konsa: Facebook.",
    auth_create_account: "Kreye yon kont",
    auth_welcome_back: "Byenvini anko",
    auth_signup_subtitle: "Enskri pou komanse aprann ak kolabore.",
    auth_login_subtitle: "Konekte pou jwenn akse ak kont ou.",
    auth_login: "Konekte",
    auth_signup: "Enskri",
    auth_continue_google: "Kontinye ak Google",
    auth_continue_facebook: "Kontinye ak Facebook",
    auth_or_email: "oswa ak imel",
    auth_email: "Email",
    auth_password: "Modpas",
    auth_create_account_btn: "Kreye kont",
    auth_login_btn: "Antre",
    auth_legal_prefix: "Le w kontinye, ou aksepte",
    auth_terms: "Kondisyon itilizasyon",
    auth_legal_and: "ak",
    auth_privacy: "Politik konfidansyalite",
    auth_show_password: "Montre modpas",
    auth_hide_password: "Kache modpas",
    auth_invalid_login: "Email oswa modpas pa korek.",
    auth_email_not_confirmed: "Ou dwe konfime email ou anvan ou konekte.",
    auth_signup_disabled: "Enskripsyon an dezaktive kounye a.",
    auth_rate_limit: "Twop tantativ. Tann yon ti moman anvan ou eseye anko.",
    auth_error: "Ere otantifikasyon",
    auth_signup_success: "Enskripsyon reyisi. Tcheke email ou si konfimasyon obligatwa."
  }
};

const LanguageContext = createContext();
const LANGS = ['es', 'en', 'fr', 'ht'];
const CACHE_KEY = 'i18n_cache_v1';

const normalizeLang = (value) => (LANGS.includes(value) ? value : 'es');

const detectBrowserLanguage = () => {
  if (typeof window === 'undefined') return 'es';

  const stored = localStorage.getItem('preferred_language');
  if (stored) return normalizeLang(stored);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const rawLangs = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
  const langs = rawLangs.filter(Boolean).map((lang) => lang.toLowerCase());

  // Haiti: prefer Kreyòl by location or locale
  if (tz === 'America/Port-au-Prince') return 'ht';
  if (langs.some((lang) => lang.startsWith('ht'))) return 'ht';
  if (langs.some((lang) => lang.includes('-ht'))) return 'ht';

  if (langs.some((lang) => lang.startsWith('fr'))) return 'fr';
  if (langs.some((lang) => lang.startsWith('en'))) return 'en';
  if (langs.some((lang) => lang.startsWith('es'))) return 'es';

  return 'es';
};

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
  const [language, setLanguage] = useState(detectBrowserLanguage);
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

  useEffect(() => {
    if (!profile?.preferred_language) return;
    const preferred = normalizeLang(profile.preferred_language);
    if (preferred !== language) {
      setLanguage(preferred);
      localStorage.setItem('preferred_language', preferred);
    }
  }, [profile?.preferred_language, language]);
  
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
    const { error: authError } = await supabase.auth.updateUser({
      data: { preferred_language: lang, locale: lang },
    });
    if (authError) {
      console.warn('auth preferred_language update error', authError.message);
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
    if (DEFAULT_TRANSLATIONS[language]?.[key]) return DEFAULT_TRANSLATIONS[language][key];
    if (dbTranslations?.es?.[key]) return dbTranslations.es[key];
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
