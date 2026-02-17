import React, { useState } from 'react';
import { Video, Copy, Check, ExternalLink } from 'lucide-react';
import { useLanguage } from '../shared/LanguageContext';
import { toast } from 'sonner';

// --- COMPOSANTS UI TEMPORAIRES (Migration-friendly) ---
const Card = ({ children, className }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-md overflow-visible ${className}`}>
    {children}
  </div>
);

const Button = ({ children, className, variant, size, onClick, ...props }) => {
  const baseClass = "flex items-center justify-center rounded-lg font-medium transition-all text-sm";
  const variants = {
    outline: "border border-slate-200 hover:bg-slate-50 text-slate-700",
    default: "bg-purple-600 text-white hover:bg-purple-700 shadow-md"
  };
  const sizes = {
    icon: "p-2",
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

const Input = ({ value, readOnly, className }) => (
  <input 
    type="text" 
    value={value} 
    readOnly={readOnly} 
    className={`w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 focus:outline-none ${className}`}
  />
);

const platformIcons = {
  zoom: '📹',
  meet: '🎥',
  teams: '👥',
  other: '💻'
};

export default function VideoConferenceInfo({ seminar, isEnrolled }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(null);
  
  // Sécurité si les données sont absentes
  if (!seminar || (!seminar.video_conference_link && seminar.modality !== 'online' && seminar.modality !== 'hybrid')) {
    return null;
  }

  // État "Non inscrit" : On masque les liens sensibles
  if (!isEnrolled) {
    return (
      <Card className="bg-slate-50 border-dashed border-2 border-slate-200">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Video className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-slate-600 text-sm font-medium">
            {t('enrollToAccessVideo', 'Inscríbete para acceder a los datos de videoconferencia')}
          </p>
        </div>
      </Card>
    );
  }

  const copyToClipboard = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
    toast.success(t('copied', 'Copiado'));
  };

  const platformName = {
    zoom: 'Zoom',
    meet: 'Google Meet',
    teams: 'Microsoft Teams',
    other: t('videoConference', 'Videoconferencia')
  }[seminar.video_conference_platform] || t('videoConference', 'Videoconferencia');

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Video className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-0.5">{t('videoConference', 'Videoconferencia')}</h3>
            <p className="text-slate-500 text-xs flex items-center gap-1">
              <span className="text-base">{platformIcons[seminar.video_conference_platform] || '💻'}</span>
              {platformName}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {seminar.video_conference_link && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5 ml-1">
                {t('meetingLink', 'Link de la reunión')}
              </label>
              <div className="flex gap-2">
                <Input value={seminar.video_conference_link} readOnly className="text-xs" />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(seminar.video_conference_link, 'link')}
                  className="shrink-0"
                >
                  {copied === 'link' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => window.open(seminar.video_conference_link, '_blank')}
                  className="shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {seminar.video_conference_id && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5 ml-1">
                {t('meetingId', 'ID de reunión')}
              </label>
              <div className="flex gap-2">
                <Input value={seminar.video_conference_id} readOnly className="font-mono text-xs" />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(seminar.video_conference_id, 'id')}
                  className="shrink-0"
                >
                  {copied === 'id' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {seminar.video_conference_password && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5 ml-1">
                {t('password', 'Contraseña')}
              </label>
              <div className="flex gap-2">
                <Input value={seminar.video_conference_password} readOnly className="font-mono text-xs" />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(seminar.video_conference_password, 'password')}
                  className="shrink-0"
                >
                  {copied === 'password' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {seminar.video_conference_link && (
            <Button 
              onClick={() => window.open(seminar.video_conference_link, '_blank')}
              className="w-full mt-2 py-3"
            >
              <Video className="h-4 w-4 mr-2" />
              {t('joinMeeting', 'Unirse a la reunión')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
