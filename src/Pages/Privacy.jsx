import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Política de privacidad</p>
            <h1 className="text-2xl font-bold text-slate-900">Privacidad y datos personales</h1>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Política de privacidad de Okalab</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-slate-600 leading-6">
            <div>
              <p className="font-semibold text-slate-900">1. Responsable del tratamiento</p>
              <p>
                ZEPHIRMATIQUE SRL (RNC 1-31-45774-6), República Dominicana, es responsable del tratamiento
                de los datos personales recopilados en Okalab.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">2. Datos que recopilamos</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Datos de cuenta: email, nombre y credenciales de acceso.</li>
                <li>Perfil: foto, biografía, idioma preferido, verificación.</li>
                <li>Actividad: inscripciones, pagos, reseñas, invitaciones.</li>
                <li>Datos técnicos: IP, navegador, dispositivo, logs básicos de seguridad.</li>
                <li>Cookies y tecnologías similares para funcionamiento del sitio.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-900">3. Cómo usamos los datos</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Crear y gestionar cuentas, inscripciones y pagos.</li>
                <li>Enviar notificaciones relacionadas con el servicio.</li>
                <li>Mejorar la experiencia y la seguridad de la plataforma.</li>
                <li>Cumplir obligaciones legales y resolver disputas.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-900">4. Base legal</p>
              <p>
                Tratamos los datos para ejecutar el contrato contigo, por consentimiento (cuando aplica)
                y por interés legítimo en operar y asegurar el servicio.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">5. Con quién compartimos datos</p>
              <p>
                Solo con proveedores necesarios para operar el servicio (alojamiento, emails, pagos y
                almacenamiento). No vendemos datos personales.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">6. Transferencias internacionales</p>
              <p>
                Algunos proveedores pueden procesar datos fuera de República Dominicana. Tomamos medidas
                para proteger la información.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">7. Conservación de datos</p>
              <p>
                Conservamos los datos el tiempo necesario para prestar el servicio y cumplir obligaciones
                legales. Luego los eliminamos o anonimizamos.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">8. Tus derechos</p>
              <p>
                Puedes solicitar acceso, corrección, eliminación u oposición al tratamiento de tus datos.
                Escríbenos si necesitas ayuda.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">9. Seguridad</p>
              <p>
                Aplicamos medidas técnicas y organizativas razonables para proteger la información
                personal.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">10. Cookies</p>
              <p>
                Usamos cookies esenciales para el funcionamiento y cookies de rendimiento para mejorar la
                experiencia. Puedes gestionarlas desde tu navegador.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">11. Cambios en esta política</p>
              <p>
                Podemos actualizar esta política. Notificaremos cambios relevantes dentro de la
                plataforma.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">12. Contacto</p>
              <p>
                Para consultas sobre privacidad, escribe a{" "}
                <span className="font-semibold text-slate-900">legal@oukaap.com</span>.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-sm text-slate-500">
          Última actualización: 22 de febrero de 2026.{" "}
          <Link to="/terms" className="text-slate-900 underline">
            Ver términos de servicio
          </Link>
        </div>
      </div>
    </div>
  );
}
