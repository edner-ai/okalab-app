import { useEffect, useState } from "react";
import { RefreshCw, Wifi } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { useLanguage } from "./LanguageContext";

export default function PwaUpdatePrompt() {
  const { t } = useLanguage();
  const [registration, setRegistration] = useState(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, swRegistration) {
      setRegistration(swRegistration ?? null);
    },
    onRegisterError(error) {
      console.warn("service worker registration error", error);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    toast.success(t("pwa_offline_ready", "La app ya esta lista para uso mas rapido y sin conexion parcial."));
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady, t]);

  useEffect(() => {
    if (!registration) return undefined;

    const checkForUpdate = () => {
      registration.update().catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    checkForUpdate();
    const intervalId = window.setInterval(checkForUpdate, 60 * 1000);
    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkForUpdate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [registration]);

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[80] md:inset-x-auto md:right-4 md:bottom-4 md:w-[28rem]">
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-emerald-100 p-2 text-emerald-700">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">
              {t("pwa_update_ready_title", "Nueva version disponible")}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {t(
                "pwa_update_ready_body",
                "Hay una actualizacion lista para esta app. Pulsa actualizar para cargar la version nueva y evitar ver cambios viejos."
              )}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button className="bg-slate-900 hover:bg-slate-800" onClick={() => updateServiceWorker(true)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("pwa_update_now", "Actualizar ahora")}
              </Button>
              <Button variant="outline" onClick={() => setNeedRefresh(false)}>
                <Wifi className="mr-2 h-4 w-4" />
                {t("pwa_update_later", "Mas tarde")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
