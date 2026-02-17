import React from 'react';
import { Check } from 'lucide-react';
// Vérifie bien que ton dossier est "components/ui" ou simplement "ui" comme on l'a vu
import { Badge } from "../ui/badge"; 
import { useLanguage } from "../shared/LanguageContext";

export default function VerificationBadge({ isVerified, size = "sm" }) {
  const { t } = useLanguage();
  if (!isVerified) return null;
  
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
  };
  
  return (
    <div className="inline-flex items-center gap-1.5">
      <div className={`${sizeClasses[size]} bg-green-500 rounded-full flex items-center justify-center`}>
        <Check className="h-3 w-3 text-white" strokeWidth={3} />
      </div>
      {size !== "sm" && (
        <span className="text-xs text-green-600 font-medium">{t("verified", "Verificado")}</span>
      )}
    </div>
  );
}
