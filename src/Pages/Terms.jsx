import React from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Términos de servicio</p>
            <h1 className="text-2xl font-bold text-slate-900">Condiciones de uso</h1>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Condiciones de uso de Okalab</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-slate-600 leading-6">
            <div>
              <p className="font-semibold text-slate-900">1. Identificación del responsable</p>
              <p>
                Okalab es operado por ZEPHIRMATIQUE SRL (RNC 1-31-45774-6), empresa constituida en
                República Dominicana.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">2. Aceptación de los términos</p>
              <p>
                Al acceder o usar Okalab confirmas que has leído, entendido y aceptado estos términos.
                Si no estás de acuerdo, no utilices la plataforma.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">3. Cuenta y seguridad</p>
              <p>
                Eres responsable de mantener tu acceso seguro, de la veracidad de tu información y de
                toda actividad realizada desde tu cuenta.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">4. Uso permitido y prohibido</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Usar la plataforma con fines educativos y profesionales legítimos.</li>
                <li>No publicar contenido ilegal, ofensivo o que infrinja derechos de terceros.</li>
                <li>No intentar acceder sin autorización ni interferir con la seguridad del servicio.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-900">5. Contenido y propiedad intelectual</p>
              <p>
                Los profesores publican contenido propio. Conservan sus derechos, pero otorgan a Okalab
                una licencia no exclusiva para mostrarlo dentro de la plataforma. Okalab puede moderar o
                retirar material que incumpla normas.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">6. Pagos, comisiones y precios</p>
              <p>
                Las comisiones de la plataforma y el reparto de excedentes se aplican según la
                configuración vigente en Backoffice. El precio puede variar según el número de
                inscripciones y las reglas del seminario.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">7. Inscripciones, cancelaciones y reembolsos</p>
              <p>
                Las cancelaciones y reembolsos se gestionan según la política definida por la plataforma
                y el estado del seminario. Okalab no garantiza devoluciones automáticas.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">8. Disponibilidad del servicio</p>
              <p>
                Podemos modificar, suspender o descontinuar partes del servicio temporal o permanentemente.
                Haremos esfuerzos razonables para mantener la disponibilidad.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">9. Limitación de responsabilidad</p>
              <p>
                Okalab no es responsable por pérdidas indirectas, interrupciones o daños derivados del uso
                de la plataforma, salvo lo establecido por ley aplicable.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">10. Terminación y suspensión</p>
              <p>
                Podemos suspender o cerrar cuentas que incumplan estos términos o representen riesgo para
                la comunidad.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">11. Ley aplicable</p>
              <p>
                Estos términos se rigen por las leyes de la República Dominicana. Cualquier disputa será
                resuelta ante los tribunales competentes de dicha jurisdicción.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">12. Contacto</p>
              <p>
                Para consultas legales o soporte, escríbenos a{" "}
                <span className="font-semibold text-slate-900">legal@oukaap.com</span>.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-sm text-slate-500">
          Última actualización: 22 de febrero de 2026.{" "}
          <Link to="/privacy" className="text-slate-900 underline">
            Ver política de privacidad
          </Link>
        </div>
      </div>
    </div>
  );
}
