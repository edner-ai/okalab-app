import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";

const sections = [
  {
    title: "1. Responsable del tratamiento",
    body:
      "ZEPHIRMATIQUE SRL (RNC 1-31-45774-6), con sede en Republica Dominicana, es responsable del tratamiento de los datos personales recopilados a traves de Okalab.",
  },
  {
    title: "2. Datos que recopilamos",
    list: [
      "Datos de cuenta: email, identificadores de acceso y metadatos basicos de autenticacion.",
      "Datos de perfil: nombre, foto, bio, idioma preferido, pais de residencia, ubicacion, telefono, WhatsApp y permisos de contacto.",
      "Datos de pagos y billetera: inscripciones, estados de pago, saldo interno, bonos por referidos, retiros y transacciones asociadas.",
      "Datos de retiro: email PayPal, datos bancarios o datos dedicados para MonCash y NatCash, incluyendo nombre del titular y telefono de la cuenta de retiro.",
      "Datos tecnicos: IP, navegador, dispositivo, logs de seguridad y datos minimos para operar el sitio.",
    ],
  },
  {
    title: "3. Para que usamos los datos",
    list: [
      "Crear y gestionar cuentas, perfiles, seminarios e inscripciones.",
      "Determinar moneda local de referencia y metodos de pago o retiro segun el pais de residencia.",
      "Procesar pagos, saldo interno, bonos por referidos y solicitudes de retiro.",
      "Prevenir fraude, errores operativos, retiros a terceros y usos no autorizados.",
      "Enviar notificaciones operativas, legales y de soporte.",
      "Cumplir obligaciones legales, contables y de seguridad.",
    ],
  },
  {
    title: "4. Idioma y pais de residencia",
    body:
      "El idioma preferido y el pais de residencia son datos distintos. El idioma personaliza la interfaz. El pais de residencia se usa para mostrar metodos de pago habilitados, moneda local de referencia y metodos de retiro compatibles con la ubicacion actual del usuario.",
  },
  {
    title: "5. Datos de billetera, saldo y referidos",
    body:
      "Cuando usas la billetera de Okalab, registramos movimientos de saldo, pagos internos, bonos retenidos o liberados, solicitudes de retiro, aprobaciones y rechazos. Esta informacion se conserva para operar el servicio, auditar movimientos y resolver incidencias.",
  },
  {
    title: "6. Datos de retiro y titularidad",
    body:
      "Para determinados metodos, incluidos MonCash y NatCash, solicitamos datos especificos del metodo de retiro. Estos datos pueden ser distintos a los del perfil general del usuario. Se usan para validar el destino del retiro y reducir errores o transferencias no autorizadas. Okalab no procesa retiros a terceros.",
  },
  {
    title: "7. Base legal",
    body:
      "Tratamos tus datos para ejecutar la relacion contractual contigo, por consentimiento cuando aplique, por interes legitimo en operar y asegurar el servicio y para cumplir obligaciones legales.",
  },
  {
    title: "8. Con quien compartimos datos",
    body:
      "Compartimos datos solo con proveedores y terceros necesarios para operar el servicio, como alojamiento, autenticacion, almacenamiento, correo y procesos de pago. No vendemos datos personales. Los profesores y administradores solo pueden acceder a la informacion estrictamente necesaria segun los permisos y flujos habilitados por la plataforma.",
  },
  {
    title: "9. Transferencias internacionales",
    body:
      "Algunos proveedores de infraestructura o servicios pueden procesar datos fuera de Republica Dominicana. Aplicamos medidas razonables para proteger esa informacion.",
  },
  {
    title: "10. Conservacion de datos",
    body:
      "Conservamos los datos durante el tiempo necesario para prestar el servicio, gestionar pagos, atender retiros, mantener historiales financieros, resolver disputas y cumplir obligaciones legales o regulatorias. Cuando ya no sean necesarios, podremos eliminarlos o anonimizaros.",
  },
  {
    title: "11. Seguridad",
    body:
      "Aplicamos medidas tecnicas y organizativas razonables para proteger datos personales, credenciales, pagos y billeteras. Aun asi, ningun sistema es completamente infalible.",
  },
  {
    title: "12. Tus derechos",
    body:
      "Puedes solicitar acceso, rectificacion, actualizacion o eliminacion de tus datos, sujeto a las limitaciones legales y a la necesidad de conservar informacion financiera o de seguridad.",
  },
  {
    title: "13. Cookies y tecnologias similares",
    body:
      "Usamos cookies o mecanismos equivalentes necesarios para el funcionamiento del sitio y, cuando aplique, para recordar preferencias tecnicas y mejorar el rendimiento.",
  },
  {
    title: "14. Cambios en esta politica",
    body:
      "Podemos actualizar esta politica para reflejar cambios legales, operativos o funcionales. Cuando el cambio sea relevante, lo notificaremos dentro de la plataforma o por medios razonables.",
  },
  {
    title: "15. Contacto",
    body:
      "Para consultas sobre privacidad o tratamiento de datos, escribe a legal@oukaap.com.",
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Politica de privacidad</p>
            <h1 className="text-2xl font-bold text-slate-900">Privacidad y datos personales</h1>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Politica de privacidad de Okalab</CardTitle>
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
          <Link to="/terms" className="text-slate-900 underline">
            Ver terminos de servicio
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
