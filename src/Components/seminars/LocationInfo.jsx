import React from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { useLanguage } from '../shared/LanguageContext';

// --- COMPOSANTS UI TEMPORAIRES (Migration-friendly) ---
const Card = ({ children, className }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-md ${className}`}>
    {children}
  </div>
);

const Button = ({ children, className, variant, size, onClick, ...props }) => {
  const baseClass = "flex items-center rounded-lg font-medium transition-all text-sm";
  const variants = {
    outline: "border border-slate-200 hover:bg-slate-50 text-slate-700",
    default: "bg-slate-900 text-white hover:bg-slate-800"
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    default: "px-4 py-2"
  };
  return (
    <button 
      onClick={onClick} 
      className={`${baseClass} ${variants[variant || 'default']} ${sizes[size || 'default']} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

export default function LocationInfo({ seminar }) {
  const { t } = useLanguage();
  
  // Sécurité si les données sont manquantes ou si le séminaire est 100% en ligne
  if (!seminar || (!seminar.location_address && seminar.modality !== 'presential' && seminar.modality !== 'hybrid')) {
    return null;
  }

  const openInMaps = (app) => {
    const { location_lat, location_lng, location_address } = seminar;
    let url = '';
    
    // Correction des URLs (suppression des préfixes erronés du code Base44 original)
    if (location_lat && location_lng) {
      switch(app) {
        case 'google':
          url = `https://www.google.com/maps/search/?api=1&query=${location_lat},${location_lng}`;
          break;
        case 'waze':
          url = `https://waze.com/ul?ll=${location_lat},${location_lng}&navigate=yes`;
          break;
        case 'apple':
          url = `maps://maps.apple.com/?daddr=${location_lat},${location_lng}`;
          break;
        default:
          url = `https://www.google.com/maps/search/?api=1&query=${location_lat},${location_lng}`;
      }
    } else if (location_address) {
      const encoded = encodeURIComponent(location_address);
      switch(app) {
        case 'google':
          url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
          break;
        case 'waze':
          url = `https://waze.com/ul?q=${encoded}&navigate=yes`;
          break;
        default:
          url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
      }
    }
    
    if (url) window.open(url, '_blank');
  };

  return (
    <Card className="border-0 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MapPin className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-1">{t('location', 'Ubicación')}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{seminar.location_address}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
          <Navigation className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('getDirections', 'Cómo llegar')}:</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => openInMaps('google')}
            className="justify-start border-slate-100"
          >
            <ExternalLink className="h-3 w-3 mr-2 text-slate-400" />
            {t('maps_google', 'Google Maps')}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => openInMaps('waze')}
            className="justify-start border-slate-100"
          >
            <ExternalLink className="h-3 w-3 mr-2 text-slate-400" />
            {t('maps_waze', 'Waze')}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => openInMaps('apple')}
            className="justify-start border-slate-100"
          >
            <ExternalLink className="h-3 w-3 mr-2 text-slate-400" />
            {t('maps_apple', 'Apple Maps')}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => openInMaps('default')}
            className="justify-start border-slate-100"
          >
            <ExternalLink className="h-3 w-3 mr-2 text-slate-400" />
            {t('openInMaps', 'Abrir Mapa')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
