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
            <CardTitle className="text-lg">Resumen principal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-slate-600 leading-6">
            <div>
              <p className="font-semibold text-slate-900">Cuenta y acceso</p>
              <p>
                Eres responsable de mantener tu acceso seguro y de la veracidad de tu información.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Contenido</p>
              <p>
                Los profesores publican contenido propio. Okalab puede moderar material que incumpla normas.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Pagos y comisiones</p>
              <p>
                Las comisiones de la plataforma y el reparto de excedentes se aplican según la configuración
                vigente en Backoffice.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Cancelaciones</p>
              <p>
                Las cancelaciones y reembolsos se gestionan según la política definida por la plataforma.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-sm text-slate-500">
          Última actualización: Feb 8, 2026.{" "}
          <Link to="/privacy" className="text-slate-900 underline">
            Ver política de privacidad
          </Link>
        </div>
      </div>
    </div>
  );
}
