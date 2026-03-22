import React from "react";
import { Link } from "react-router-dom";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../ui/drawer";
import { Button } from "../ui/button";
import { useLanguage } from "../shared/LanguageContext";

export default function EconomicConditionsDrawer({
  open,
  onOpenChange,
  professorBonusPercent = 0,
}) {
  const { t } = useLanguage();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>
            {t("economic_conditions_title", "Condiciones de excedente y bonos")}
          </DrawerTitle>
          <DrawerDescription>
            {t(
              "economic_conditions_subtitle",
              "Resumen claro de cómo Okalab liquida el excedente y cuándo se liberan los bonos."
            )}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2 space-y-4 overflow-y-auto">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">
              {t("economic_conditions_professor_title", "Para el profesor")}
            </p>
            <p className="mt-2 text-sm text-emerald-950">
              {t(
                "economic_conditions_professor_body",
                "Si el seminario supera el objetivo, recibes {percent}% del excedente neto como bonus. La liquidación económica final se confirma al cerrar la ventana de pago."
              ).replace("{percent}", professorBonusPercent)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              {t("economic_conditions_referrals_title", "Para referidos")}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {t(
                "economic_conditions_referrals_intro",
                "Comparte tu enlace de invitacion. Si tus invitados pagan y el seminario supera el objetivo, puedes recibir bonos. Condiciones aplican."
              )}
            </p>
            <ul className="mt-3 space-y-2 pl-5 text-sm text-slate-700 list-disc">
              <li>
                {t(
                  "economic_conditions_referrals_rule_paid",
                  "Solo cuentan las inscripciones pagadas cuando cierra la ventana de pago."
                )}
              </li>
              <li>
                {t(
                  "economic_conditions_referrals_rule_surplus",
                  "Solo generan bono los estudiantes que quedaron realmente en excedente y son atribuibles a tu enlace."
                )}
              </li>
              <li>
                {t(
                  "economic_conditions_referrals_rule_release",
                  "El bono se libera si tu tambien pagaste tu propia inscripcion dentro de la ventana y el seminario finaliza correctamente."
                )}
              </li>
              <li>
                {t(
                  "economic_conditions_referrals_rule_fallback",
                  "Si no cumples esas condiciones o no hay un referido valido atribuible, ese valor vuelve a profesor y plataforma."
                )}
              </li>
            </ul>
          </div>

          <p className="text-xs text-slate-500">
            {t(
              "economic_conditions_legal_note",
              "También puedes revisar Soporte y Términos para el detalle completo de estas reglas."
            )}
          </p>
        </div>

        <DrawerFooter className="sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/support">{t("support", "Soporte")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/terms">{t("auth_terms", "Términos de servicio")}</Link>
            </Button>
          </div>
          <DrawerClose asChild>
            <Button>{t("common_close", "Cerrar")}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
