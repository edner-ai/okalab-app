import React from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";

const sections = [
  {
    title: "1. Identificacion del responsable",
    body:
      "Okalab es operado por ZEPHIRMATIQUE SRL (RNC 1-31-45774-6), empresa constituida en Republica Dominicana.",
  },
  {
    title: "2. Aceptacion de estos terminos",
    body:
      "Al acceder o usar Okalab aceptas estos terminos. Si no estas de acuerdo, no debes utilizar la plataforma.",
  },
  {
    title: "3. Cuenta, perfil y datos obligatorios",
    body:
      "Eres responsable de mantener tu cuenta segura y de que la informacion de tu perfil sea veraz y actualizada. Okalab puede requerir datos obligatorios, incluyendo pais de residencia, idioma preferido y medios de contacto, para habilitar funciones de pago, comunicacion y soporte.",
  },
  {
    title: "4. Pais de residencia, idioma y moneda local",
    body:
      "El idioma del sitio y el pais de residencia son configuraciones distintas. El idioma controla la interfaz. El pais de residencia se usa para mostrar moneda local de referencia y metodos de pago o retiro disponibles para tu ubicacion actual.",
  },
  {
    title: "5. Precios, cotizaciones y pagos",
    body:
      "Los seminarios se crean y administran en USD. Okalab puede mostrar conversiones en moneda local solo como referencia informativa. El monto final a pagar se determina segun las reglas vigentes del seminario, la ventana de pago, la ocupacion y la configuracion activa en la plataforma.",
  },
  {
    title: "6. Ventana de pago e inscripcion",
    body:
      "Inscribirte no siempre significa pagar de inmediato. Algunas inscripciones quedan reservadas hasta que abra la ventana de pago o hasta que el seminario complete su cupo. Si la ventana de pago vence sin pago valido, la reserva puede expirar o cancelarse segun las reglas del sistema.",
  },
  {
    title: "7. Saldo Okalab",
    body:
      "El Saldo Okalab es un saldo interno de la plataforma. Puede usarse para pagar seminarios dentro del checkout cuando la inscripcion ya esta habilitada para pago. No equivale a una cuenta bancaria ni a dinero exigible de forma inmediata fuera de la plataforma hasta que exista una solicitud de retiro aprobada.",
  },
  {
    title: "8. Referidos, bonos y liberacion",
    body:
      "Los bonos por referidos solo nacen cuando Okalab liquida el excedente al cerrar la ventana de pago, toma en cuenta unicamente las inscripciones pagadas y respeta su orden de inscripcion para determinar que estudiantes quedaron realmente en excedente y cuales son atribuibles al enlace del referidor. Okalab solo puede liberarlos si el referidor tambien pago su propia inscripcion dentro de la ventana de pago y si el seminario asociado finaliza correctamente. Si esas condiciones no se cumplen o no hay un referido valido atribuible, ese valor vuelve al profesor y a la plataforma segun las reglas economicas activas.",
  },
  {
    title: "9. Retiros externos y metodos por pais",
    body:
      "Los metodos de retiro disponibles dependen del pais de residencia, de la configuracion activa de Okalab y de los datos proporcionados por el usuario. Los minimos de retiro externo pueden variar por metodo y pais. Okalab puede retener, revisar, aprobar o rechazar solicitudes de retiro por motivos operativos, de seguridad o de cumplimiento.",
  },
  {
    title: "10. MonCash, NatCash y titularidad",
    body:
      "Para retiros por MonCash o NatCash, el usuario debe introducir los datos exactos del metodo de retiro, incluyendo nombre completo del titular y telefono de la cuenta correspondiente. Okalab no procesa retiros hacia terceros y puede rechazar solicitudes con datos incompletos, inconsistentes o sospechosos.",
  },
  {
    title: "11. Uso permitido y prohibido",
    list: [
      "Usar Okalab con fines educativos y profesionales legitimos.",
      "No publicar contenido ilegal, ofensivo o que infrinja derechos de terceros.",
      "No intentar acceder sin autorizacion ni interferir con la seguridad, pagos o billeteras del servicio.",
    ],
  },
  {
    title: "12. Contenido y propiedad intelectual",
    body:
      "Los profesores conservan los derechos sobre el contenido que publican, pero otorgan a Okalab una licencia no exclusiva para alojarlo, mostrarlo y distribuirlo dentro de la plataforma. Okalab puede moderar o retirar material que incumpla estas condiciones.",
  },
  {
    title: "13. Cancelaciones, ajustes y reembolsos",
    body:
      "Las cancelaciones, reprogramaciones y reembolsos se gestionan segun el estado del seminario, el estado del pago y las politicas operativas vigentes. Okalab no garantiza reembolsos automaticos en todos los casos.",
  },
  {
    title: "14. Disponibilidad del servicio",
    body:
      "Podemos modificar, suspender o descontinuar funciones del servicio temporal o permanentemente. Haremos esfuerzos razonables para mantener la disponibilidad, pero no garantizamos operacion ininterrumpida.",
  },
  {
    title: "15. Limitacion de responsabilidad",
    body:
      "Okalab no responde por perdidas indirectas, lucro cesante, interrupciones o danos derivados del uso de la plataforma, salvo cuando la ley aplicable disponga lo contrario.",
  },
  {
    title: "16. Suspension o cierre de cuentas",
    body:
      "Podemos suspender, limitar o cerrar cuentas que incumplan estos terminos o que representen riesgo para la comunidad, los pagos, la seguridad o la integridad operativa del servicio.",
  },
  {
    title: "17. Ley aplicable",
    body:
      "Estos terminos se rigen por las leyes de Republica Dominicana. Cualquier disputa sera conocida por los tribunales competentes de esa jurisdiccion.",
  },
  {
    title: "18. Contacto",
    body:
      "Para consultas legales o de cumplimiento, escribe a legal@oukaap.com.",
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Terminos de servicio</p>
            <h1 className="text-2xl font-bold text-slate-900">Condiciones de uso</h1>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Condiciones de uso de Okalab</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-slate-600 leading-6">
            {sections.map((section) => (
              <div key={section.title}>
                <p className="font-semibold text-slate-900">{section.title}</p>
                {section.body ? <p>{section.body}</p> : null}
                {section.list ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="mt-6 text-sm text-slate-500 space-x-2">
          <span>Ultima actualizacion: 15 de marzo de 2026.</span>
          <Link to="/privacy" className="text-slate-900 underline">
            Ver politica de privacidad
          </Link>
          <span>·</span>
          <Link to="/support" className="text-slate-900 underline">
            Ver soporte y FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}
