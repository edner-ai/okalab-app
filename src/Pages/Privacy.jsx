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
            <CardTitle className="text-lg">Resumen para usuarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-slate-600 leading-6">
            <div>
              <p className="font-semibold text-slate-900">Qué datos recopilamos</p>
              <p>
                Email, nombre, preferencias de idioma y datos operativos necesarios para el uso de la
                plataforma, como inscripciones y transacciones.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Cómo los usamos</p>
              <p>
                Para autenticarte, habilitar funciones de la plataforma, procesar pagos y mejorar la
                experiencia de aprendizaje.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Con quién se comparten</p>
              <p>
                Solo con proveedores necesarios para operar el servicio (por ejemplo, pagos o almacenamiento).
                No vendemos datos personales.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Tus derechos</p>
              <p>
                Puedes solicitar acceso, corrección o eliminación de datos. Escríbenos si necesitas ayuda.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-sm text-slate-500">
          Última actualización: Feb 8, 2026.{" "}
          <Link to="/terms" className="text-slate-900 underline">
            Ver términos de servicio
          </Link>
        </div>
      </div>
    </div>
  );
}
