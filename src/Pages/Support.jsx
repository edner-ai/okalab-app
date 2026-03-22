import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../Components/shared/LanguageContext";

import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../Components/ui/accordion";
import {
  ArrowLeft,
  MessageCircle,
  Users,
  Megaphone,
  Mail,
  Plus,
  Minus,
} from "lucide-react";

const normalizeWhatsAppLink = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}`;
};

const withWhatsAppMessage = (base, message) => {
  if (!base) return "";
  const msg = String(message || "").trim();
  if (!msg) return base;
  if (base.includes("text=")) return base;
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}text=${encodeURIComponent(msg)}`;
};

export default function Support() {
  const { t, language } = useLanguage();

  const { data: settings } = useQuery({
    queryKey: ["platform_settings_support"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select(
          "support_whatsapp_feedback_link,support_whatsapp_message,support_facebook_forum_link,support_whatsapp_channel_link,support_email,support_whatsapp_feedback_link_i18n,support_whatsapp_message_i18n,support_facebook_forum_link_i18n,support_whatsapp_channel_link_i18n,support_email_i18n"
        )
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const getLocalizedSupportValue = (i18nField, legacyField) => {
    const localized = settings?.[i18nField];
    if (localized && typeof localized === "object" && !Array.isArray(localized)) {
      const preferred = String(localized?.[language] || "").trim();
      if (preferred) return preferred;
      const fallbackOrder = ["es", "en", "fr", "ht"];
      for (const lang of fallbackOrder) {
        const candidate = String(localized?.[lang] || "").trim();
        if (candidate) return candidate;
      }
    }
    return String(settings?.[legacyField] || "").trim();
  };

  const feedbackLink = useMemo(() => {
    const base = normalizeWhatsAppLink(
      getLocalizedSupportValue(
        "support_whatsapp_feedback_link_i18n",
        "support_whatsapp_feedback_link"
      )
    );
    return withWhatsAppMessage(
      base,
      getLocalizedSupportValue("support_whatsapp_message_i18n", "support_whatsapp_message")
    );
  }, [settings, language]);

  const forumLink = getLocalizedSupportValue(
    "support_facebook_forum_link_i18n",
    "support_facebook_forum_link"
  );
  const channelLink = getLocalizedSupportValue(
    "support_whatsapp_channel_link_i18n",
    "support_whatsapp_channel_link"
  );
  const supportEmail = getLocalizedSupportValue("support_email_i18n", "support_email");

  const supportCards = [
    {
      key: "feedback",
      title: t("support_feedback_title", "Feedback rapido"),
      description: t(
        "support_feedback_desc",
        "Cuentanos tu idea o problema y te respondemos lo antes posible."
      ),
      cta: t("support_feedback_cta", "Enviar feedback"),
      link: feedbackLink,
      icon: MessageCircle,
      iconBg: "bg-green-500 hover:bg-green-600",
      button: "bg-green-500 hover:bg-green-600 text-white",
    },
    {
      key: "forum",
      title: t("support_forum_title", "Foro de Facebook"),
      description: t(
        "support_forum_desc",
        "Pregunta a la comunidad, comparte tips y encuentra soluciones rapidas."
      ),
      cta: t("support_forum_cta", "Ir al foro"),
      link: forumLink,
      icon: Users,
      iconBg: "bg-blue-600 hover:bg-blue-700",
      button: "bg-blue-600 hover:bg-blue-700 text-white",
    },
    {
      key: "channel",
      title: t("support_channel_title", "Canal de WhatsApp"),
      description: t(
        "support_channel_desc",
        "Recibe anuncios, novedades y mejoras de la plataforma."
      ),
      cta: t("support_channel_cta", "Unirme al canal"),
      link: channelLink,
      icon: Megaphone,
      iconBg: "bg-purple-500 hover:bg-purple-600",
      button: "bg-purple-500 hover:bg-purple-600 text-white",
    },
  ];

  const faqItems = [
    {
      key: "create",
      question: t("support_faq_create_q", "Como creo un seminario?"),
      answer: t(
        "support_faq_create_a",
        "Ve a Crear seminario, completa los datos, guarda como borrador y publicalo cuando este listo."
      ),
    },
    {
      key: "country",
      question: t(
        "support_faq_country_q",
        "Por que me piden pais de residencia si ya elegi idioma?"
      ),
      answer: t(
        "support_faq_country_a",
        "Porque el idioma y el pais de residencia no significan lo mismo. El idioma cambia la interfaz. El pais de residencia se usa para mostrar moneda local de referencia y los metodos de pago o retiro correctos para tu ubicacion actual."
      ),
    },
    {
      key: "pricing",
      question: t("support_faq_pricing_q", "Como funcionan el precio en USD y la moneda local?"),
      answer: t(
        "support_faq_pricing_a",
        "Los seminarios se crean en USD. Okalab puede mostrar una conversion en tu moneda local como referencia. El monto final del seminario se confirma al pagar segun el estado del seminario y las reglas activas."
      ),
    },
    {
      key: "payment",
      question: t("support_faq_payment_q", "Cuando y como tengo que pagar?"),
      answer: t(
        "support_faq_payment_a",
        "Primero te inscribes y reservas tu cupo. El pago se hace cuando la ventana de pago esta abierta o cuando el seminario llena su cupo y el sistema habilita el pago anticipado."
      ),
    },
    {
      key: "wallet",
      question: t("support_faq_wallet_q", "Como funciona el Saldo Okalab?"),
      answer: t(
        "support_faq_wallet_a",
        "El Saldo Okalab se usa dentro del checkout del seminario cuando tu inscripcion ya puede pagarse. Si cubre todo, no necesitas metodo externo. Si cubre solo una parte, pagas el resto con un metodo externo."
      ),
    },
    {
      key: "wallet_shortcut",
      question: t(
        "support_faq_wallet_shortcut_q",
        "Para que sirve el atajo de saldo en la billetera?"
      ),
      answer: t(
        "support_faq_wallet_shortcut_a",
        "Ese atajo te lleva a Mis seminarios. Si tienes una inscripcion pendiente que ya puede pagarse, Okalab te dirige al checkout con tu saldo preparado para usarlo alli."
      ),
    },
    {
      key: "referrals",
      question: t(
        "support_faq_referrals_q",
        "Como invito, gano bonos y retiro mis ganancias?"
      ),
      answer: t(
        "support_faq_referrals_a",
        "Comparte tu enlace de invitacion. Al cerrar la ventana de pago, Okalab toma las inscripciones pagadas, respeta su orden de inscripcion y calcula cuales quedaron en el excedente y cuales son realmente atribuibles a tu enlace. Solo esos generan bono retenido a tu nombre. Ese bono solo se libera si tu tambien pagaste tu propia inscripcion dentro de la ventana de pago y cuando el seminario finaliza correctamente. Si no cumples esa condicion o no hay un referido valido atribuible, ese valor vuelve a profesor y plataforma segun las reglas activas. Luego puedes usarlo dentro de Okalab o solicitar retiro externo si cumples el minimo del metodo."
      ),
    },
    {
      key: "haiti_payout",
      question: t("support_faq_haiti_payout_q", "Que pasa con MonCash y NatCash en Haiti?"),
      answer: t(
        "support_faq_haiti_payout_a",
        "Si tu pais de residencia es Haiti, Okalab puede mostrar MonCash y NatCash como metodos de retiro disponibles. Para usarlos debes introducir el nombre completo del titular y el telefono exacto de esa cuenta de retiro."
      ),
    },
    {
      key: "no_third_party",
      question: t("support_faq_no_third_party_q", "Puedo retirar a nombre de otra persona?"),
      answer: t(
        "support_faq_no_third_party_a",
        "No. Okalab no procesa retiros a terceros. Si los datos del metodo de retiro son incompletos, inconsistentes o sospechosos, la solicitud puede ser rechazada."
      ),
    },
    {
      key: "cancel",
      question: t("support_faq_cancel_q", "Que pasa si un seminario se cancela?"),
      answer: t(
        "support_faq_cancel_a",
        "Te notificamos y se gestiona el reembolso, la reprogramacion o la anulacion de bonos retenidos segun el estado real del seminario y del pago."
      ),
    },
    {
      key: "reviews",
      question: t("support_faq_reviews_q", "Como funcionan las resenas?"),
      answer: t(
        "support_faq_reviews_a",
        "Al finalizar el seminario te pediremos calificar al profesor para ayudar a la comunidad."
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link to="/" className="inline-flex items-center text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("support_back", "Volver")}
        </Link>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">{t("support_title", "Centro de ayuda")}</CardTitle>
            <p className="text-slate-500 text-sm">
              {t("support_subtitle", "Estamos aqui para ayudarte. Elige el canal que prefieras.")}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-3 gap-6">
              {supportCards.map((card) => {
                const Icon = card.icon;
                const disabled = !card.link;
                return (
                  <div
                    key={card.key}
                    className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-150 bg-white flex flex-col"
                  >
                    <div className="flex items-center mb-4">
                      <div className={`p-3 rounded-lg text-white transition-colors ${card.iconBg}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">{card.title}</h3>
                    <p className="text-sm text-slate-600 mb-4 flex-1">{card.description}</p>
                    {disabled ? (
                      <Button variant="outline" disabled className="w-full">
                        {t("support_not_configured", "No configurado")}
                      </Button>
                    ) : (
                      <Button asChild className={`w-full ${card.button}`}>
                        <a href={card.link} target="_blank" rel="noopener noreferrer">
                          {card.cta}
                        </a>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">
                {t("support_other_contacts", "Otros medios de contacto")}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition-all duration-150">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{t("support_email", "Email")}</p>
                    {supportEmail ? (
                      <a href={`mailto:${supportEmail}`} className="text-sm text-blue-600">
                        {supportEmail}
                      </a>
                    ) : (
                      <span className="text-sm text-slate-400">
                        {t("support_not_configured", "No configurado")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition-all duration-150">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {t("support_whatsapp_chat", "Chat WhatsApp")}
                    </p>
                    {feedbackLink ? (
                      <a
                        href={feedbackLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600"
                      >
                        {t("support_whatsapp_cta", "Abrir chat")}
                      </a>
                    ) : (
                      <span className="text-sm text-slate-400">
                        {t("support_not_configured", "No configurado")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {t("support_faq_title", "Preguntas frecuentes")}
              </h3>
              <Accordion type="single" collapsible className="space-y-3">
                {faqItems.map((item) => (
                  <AccordionItem
                    key={item.key}
                    value={item.key}
                    className="border border-slate-200 rounded-lg bg-white px-4 shadow-sm transition-all duration-200 hover:shadow-md"
                  >
                    <AccordionTrigger className="py-3 text-base font-semibold text-slate-900 no-underline hover:no-underline [&>svg]:hidden [&[data-state=open]_.icon-plus]:hidden [&[data-state=open]_.icon-minus]:block">
                      <div className="flex w-full items-center justify-between gap-4">
                        <span>{item.question}</span>
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition">
                          <Plus className="icon-plus h-4 w-4" />
                          <Minus className="icon-minus hidden h-4 w-4" />
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 leading-relaxed">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
