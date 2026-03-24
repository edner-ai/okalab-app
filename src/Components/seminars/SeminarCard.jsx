import React from "react";
import { Card, CardContent, CardFooter } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Calendar, Clock, Users, MapPin, Monitor, Laptop, Info, PlayCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { format } from "date-fns";
import { getDateFnsLocale } from "../../utils/dateLocale";
import { parseDateValue } from "../../utils/dateValue";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { useLanguage } from "../shared/LanguageContext";
import { motion } from "framer-motion";
import StarRating from "../reviews/StarRating";
import { normalizeSeminarCover } from "../../utils/seminarMedia";

const categoryColors = {
  employability: "bg-blue-100 text-blue-700 border-blue-200",
  entrepreneurship: "bg-emerald-100 text-emerald-700 border-emerald-200",
  digital_skills: "bg-purple-100 text-purple-700 border-purple-200",
};

const modalityIcons = {
  online: Monitor,
  presential: MapPin,
  hybrid: Laptop,
};

const withVars = (template, vars = {}) =>
  Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\s*${key}\\s*\\}`, "gi"), String(value)),
    template
  );

export default function SeminarCard({
  seminar,
  enrollmentCount = 0,
  ratingAvg = 0,
  ratingCount = 0,
}) {
  const { t, language } = useLanguage();
  const dateLocale = getDateFnsLocale(language);

  const targetIncome = Number(seminar?.target_income || 0);
  const targetStudents = Math.max(1, Number(seminar?.target_students || 15));
  const enrolledCount = Math.max(0, Number(enrollmentCount || 0));
  const currentStudents = Math.max(1, enrolledCount);
  const denominator = Math.min(targetStudents, currentStudents);
  const pricePerStudent = targetIncome > 0 ? targetIncome / denominator : Number(seminar?.price || 0);
  const minimumPrice = targetIncome > 0 ? targetIncome / targetStudents : pricePerStudent;
  const minimumPriceLabel = `$${minimumPrice.toFixed(2)}`;
  const goalAmountLabel = `$${targetIncome.toFixed(2)}`;

  const maxStudentsFromSeminar = Number(seminar?.max_students || 0);
  const computedMaxStudents =
    maxStudentsFromSeminar > 0
      ? maxStudentsFromSeminar
      : Math.max(targetStudents, targetStudents + Number(seminar?.excess_students || 0));
  const excessSlots = Math.max(0, computedMaxStudents - targetStudents);

  const isAtStart = enrolledCount <= 0;
  const isGoalReached = enrolledCount >= targetStudents;
  const priceCopy = isAtStart
    ? {
        primary: withVars(
          t("seminar_card_price_goal_target", "Meta: {amount} entre {goal} estudiantes."),
          { amount: goalAmountLabel, goal: targetStudents }
        ),
        secondary: withVars(
          t("seminar_card_price_goal_start_hint", "Puede bajar hasta {minimum} por estudiante."),
          { minimum: minimumPriceLabel }
        ),
      }
    : isGoalReached
      ? {
          primary: withVars(
            t("seminar_card_price_goal_reached", "Precio minimo alcanzado: {minimum}."),
            { minimum: minimumPriceLabel }
          ),
          secondary: withVars(
            t("seminar_card_price_goal_reached_detail", "{goal} cupos objetivo completados."),
            { goal: targetStudents }
          ),
        }
      : {
          primary: withVars(
            t("seminar_card_price_goal_progress", "Si llegan a {goal} inscritos, baja a {minimum}."),
            { goal: targetStudents, minimum: minimumPriceLabel }
          ),
          secondary: withVars(
            t("seminar_card_price_goal_progress_detail", "Avance: {enrolled}/{goal} inscritos."),
            { enrolled: enrolledCount, goal: targetStudents }
          ),
        };

  const ModalityIcon = modalityIcons[seminar.modality] || Monitor;
  const assetBase = import.meta.env.BASE_URL || "/";
  const fallbackImage = `${assetBase}assets/hero.webp`;

  const cover = normalizeSeminarCover(seminar, fallbackImage);
  const imageSrc = cover.imageSrc;
  const savings = targetIncome > 0 ? Math.round((1 - pricePerStudent / targetIncome) * 100) : 0;
  const hasReviews = (ratingCount || 0) > 0;
  const excessPopoverTitle = t("seminar_card_excess_title", "Cupos extra para ganar");
  const excessTooltipText = withVars(
    t(
      "seminar_card_excess_tooltip",
      "Si, no es un error: {excess} cupos mas para que tu tambien puedas ganar. Inscribete e invita a tus amigos."
    ),
    { excess: excessSlots }
  );
  const isCompleted = String(seminar?.status || "").toLowerCase() === "completed";
  const isFull = computedMaxStudents > 0 && enrolledCount >= computedMaxStudents;
  const statusBadge = isCompleted
    ? {
        label: t("completed", "Completado"),
        className: "bg-purple-100 text-purple-700 border-purple-200",
      }
    : isFull
      ? {
          label: t("seminar_full_button", "Cupos llenos"),
          className: "bg-amber-100 text-amber-800 border-amber-200",
        }
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group overflow-hidden border-0 bg-white transition-all duration-300 hover:shadow-xl">
        <div className="relative h-48 overflow-hidden">
          <img
            src={imageSrc}
            alt={seminar.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              if (e.currentTarget.src !== fallbackImage) {
                e.currentTarget.src = fallbackImage;
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {cover.type === "youtube" ? (
            <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <PlayCircle className="h-3.5 w-3.5" />
              <span>{t("seminar_cover_youtube", "Video YouTube")}</span>
            </div>
          ) : null}
          <Badge
            variant="outline"
            className={`absolute left-4 top-4 border ${categoryColors[seminar.category] || "bg-slate-100"}`}
          >
            {t(seminar.category, seminar.category)}
          </Badge>
          {statusBadge ? (
            <Badge
              variant="outline"
              className={`absolute right-4 top-4 border ${statusBadge.className}`}
            >
              {statusBadge.label}
            </Badge>
          ) : null}
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="line-clamp-2 text-lg font-bold text-white">{seminar.title}</h3>
          </div>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>
                {seminar.start_date
                  ? format(parseDateValue(seminar.start_date), "MMM d", { locale: dateLocale })
                  : t("tbd", "Por definir")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>
                {seminar.total_hours || 0} {t("hours", "horas")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ModalityIcon className="h-4 w-4" />
              <span>{t(seminar.modality, seminar.modality)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-600">
              {enrolledCount} {t("enrolled", "inscritos")} {t("of_max", "de")} {computedMaxStudents}{" "}
              {t("max", "max")}
            </span>
            {excessSlots > 0 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label={excessTooltipText}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="start"
                  sideOffset={10}
                  className="w-72 overflow-visible border-slate-200 bg-white p-0"
                >
                  <div className="relative">
                    <div className="rounded-t-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                      {excessPopoverTitle}
                    </div>
                    <div className="px-3 py-3 text-xs leading-relaxed text-slate-600">{excessTooltipText}</div>
                    <span className="absolute -bottom-1.5 left-5 h-3 w-3 rotate-45 border-b border-r border-slate-200 bg-white" />
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <StarRating value={ratingAvg} readOnly size={14} />
            {hasReviews ? (
              <span className="text-xs text-slate-500">
                {ratingAvg.toFixed(1)} · {ratingCount} {t("reviews", "resenas")}
              </span>
            ) : (
              <span className="text-xs text-slate-400">{t("review_no_reviews", "Sin resenas")}</span>
            )}
          </div>

          <div className="border-t pt-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{t("currentPrice", "Precio actual")}</p>
                <p className="text-2xl font-bold text-slate-900">${pricePerStudent.toFixed(2)}</p>
                <p className="text-xs font-medium text-slate-600">{priceCopy.primary}</p>
                <p className="text-xs text-slate-500">{priceCopy.secondary}</p>
              </div>
              {savings > 0 && (
                <div className="text-right">
                  <p className="text-xs font-medium text-emerald-600">
                    {savings}% {t("less", "menos")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-5 pt-0">
          <Link to={createPageUrl(`SeminarDetails?id=${seminar.id}`)} className="w-full">
            <Button className="w-full bg-slate-900 hover:bg-slate-800">{t("viewDetails", "Ver detalles")}</Button>
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
