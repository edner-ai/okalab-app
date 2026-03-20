import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, CreditCard, HandCoins, Landmark, Link2, Loader2, Lock, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Button } from "../../Components/ui/button";
import { Collapsible, CollapsibleContent } from "../../Components/ui/collapsible";
import { Input } from "../../Components/ui/input";
import { Label } from "../../Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../Components/ui/select";
import { Switch } from "../../Components/ui/switch";
import { Textarea } from "../../Components/ui/textarea";
import { useLanguage } from "../../Components/shared/LanguageContext";
import { COUNTRY_CODE_SET, getCountryOptions, normalizeCountryCode } from "../../utils/countries";
import { getIntlLocale } from "../../utils/dateLocale";
import { toast } from "sonner";

const SUPPORTED_LANGUAGES = [
  { code: "es", label: "Espanol" },
  { code: "en", label: "English" },
  { code: "fr", label: "Francais" },
  { code: "ht", label: "Kreyol" },
];

const SYSTEM_METHOD_CODES = new Set(["transfer", "paypal", "cash", "card"]);
const LEGACY_SYNC_PROVIDERS = new Set(["bank_transfer", "paypal", "cash", "card"]);
const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Texto" },
  { value: "textarea", label: "Texto largo" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "number", label: "Numero" },
];

const METHOD_FILTER_KEYS = ["all", "enabled", "manual", "gateway", "system", "custom"];
const COUNTRY_PICKER_EMPTY_VALUE = "__add_country__";

const createLocalId = () => `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const sanitizeSortOrder = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeI18n = (value) => {
  const source = value && typeof value === "object" ? value : {};
  return SUPPORTED_LANGUAGES.reduce((acc, lang) => {
    acc[lang.code] = typeof source[lang.code] === "string" ? source[lang.code] : "";
    return acc;
  }, {});
};

const normalizeVisibleCountries = (value) => {
  const source = Array.isArray(value) ? value : [];
  const unique = new Set();

  source.forEach((item) => {
    const code = normalizeCountryCode(item);
    if (code && COUNTRY_CODE_SET.has(code)) {
      unique.add(code);
    }
  });

  return Array.from(unique);
};

const sortByOrder = (a, b) => {
  const orderDiff = sanitizeSortOrder(a?.sort_order, 0) - sanitizeSortOrder(b?.sort_order, 0);
  if (orderDiff !== 0) return orderDiff;
  return String(a?.field_key || a?.code || a?.id || "").localeCompare(
    String(b?.field_key || b?.code || b?.id || "")
  );
};

const normalizeField = (field, index = 0) => ({
  id: field?.id || null,
  localId: field?.localId || createLocalId(),
  field_key: field?.field_key || "",
  label_i18n: normalizeI18n(field?.label_i18n),
  help_text_i18n: normalizeI18n(field?.help_text_i18n),
  field_value_i18n:
    field?.field_value_i18n && typeof field.field_value_i18n === "object"
      ? normalizeI18n(field.field_value_i18n)
      : normalizeI18n(
          typeof field?.field_value === "string" && field.field_value.trim()
            ? Object.fromEntries(SUPPORTED_LANGUAGES.map((lang) => [lang.code, field.field_value]))
            : {}
        ),
  field_type: field?.field_type || "text",
  field_value: typeof field?.field_value === "string" ? field.field_value : "",
  copyable: !!field?.copyable,
  enabled: field?.enabled ?? true,
  sort_order: sanitizeSortOrder(field?.sort_order, (index + 1) * 10),
});

const normalizeMethod = (method, index = 0) => {
  const fields = Array.isArray(method?.payment_method_fields) ? method.payment_method_fields : method?.fields || [];
  const normalizedFields = fields.map((field, fieldIndex) => normalizeField(field, fieldIndex)).sort(sortByOrder);
  const countryVisibilityMode =
    method?.country_visibility_mode === "restricted"
      ? "restricted"
      : Array.isArray(method?.visible_countries) && method.visible_countries.length
        ? "restricted"
        : "all";
  return {
    id: method?.id || null,
    localId: method?.localId || createLocalId(),
    code: method?.code || "",
    kind: method?.kind || "manual",
    provider: method?.provider || "custom_manual",
    enabled: method?.enabled ?? true,
    visible_languages:
      Array.isArray(method?.visible_languages) && method.visible_languages.length
        ? method.visible_languages.filter((lang) => SUPPORTED_LANGUAGES.some((item) => item.code === lang))
        : SUPPORTED_LANGUAGES.map((lang) => lang.code),
    visible_countries: normalizeVisibleCountries(method?.visible_countries),
    country_visibility_mode: countryVisibilityMode,
    title_i18n: normalizeI18n(method?.title_i18n),
    description_i18n: normalizeI18n(method?.description_i18n),
    instructions_i18n: normalizeI18n(method?.instructions_i18n),
    public_config: method?.public_config && typeof method.public_config === "object" ? method.public_config : {},
    sort_order: sanitizeSortOrder(method?.sort_order, (index + 1) * 10),
    fields: normalizedFields,
    persistedFieldKeys: normalizedFields.map((field) => field.field_key).filter(Boolean),
  };
};

const normalizeProviderForKind = (kind) => (kind === "gateway" ? "custom_gateway" : "custom_manual");

const firstFilledTranslation = (translations) =>
  SUPPORTED_LANGUAGES.map((lang) => translations?.[lang.code]?.trim()).find(Boolean) || "";

const slugify = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

const buildUniqueKey = (base, existingValues, fallbackPrefix) => {
  const fallback = `${fallbackPrefix}_${Date.now().toString().slice(-6)}`;
  const seed = slugify(base) || fallback;
  let candidate = seed;
  let counter = 2;

  while (existingValues.has(candidate)) {
    candidate = `${seed}_${counter}`;
    counter += 1;
  }

  return candidate;
};

const isSystemMethod = (method) => SYSTEM_METHOD_CODES.has(method.code);
const usesLegacySync = (method) => LEGACY_SYNC_PROVIDERS.has(method.provider);

const getMethodIcon = (provider) => {
  switch (provider) {
    case "bank_transfer":
      return Landmark;
    case "cash":
      return HandCoins;
    case "paypal":
      return Link2;
    default:
      return CreditCard;
  }
};

function I18nEditor({ label, value, onChange, multiline = false, placeholder }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid gap-3 sm:grid-cols-2">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const Control = multiline ? Textarea : Input;
          return (
            <div key={lang.code} className="space-y-1">
              <span className="text-xs font-medium text-slate-500">{lang.label}</span>
              <Control
                value={value?.[lang.code] || ""}
                onChange={(event) => onChange(lang.code, event.target.value)}
                placeholder={placeholder ? `${placeholder} (${lang.code})` : lang.label}
                className={multiline ? "min-h-24" : ""}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PaymentMethodsSettings() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [methods, setMethods] = useState([]);
  const [savingKey, setSavingKey] = useState(null);
  const [deletingKey, setDeletingKey] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedMethodKeys, setExpandedMethodKeys] = useState([]);
  const [expandedFieldSections, setExpandedFieldSections] = useState({});
  const [countryPickerValues, setCountryPickerValues] = useState({});
  const countryOptions = useMemo(() => getCountryOptions(getIntlLocale(language || "es")), [language]);
  const countryOptionsByCode = useMemo(
    () => new Map(countryOptions.map((country) => [country.value, country])),
    [countryOptions]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["payment_methods_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*, payment_method_fields(*)")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data) return;
    const next = data.map((method, index) => normalizeMethod(method, index)).sort(sortByOrder);
    setMethods(next);
  }, [data]);

  useEffect(() => {
    const validKeys = new Set(methods.map((method) => method.id || method.localId));
    setExpandedMethodKeys((prev) => prev.filter((key) => validKeys.has(key)));
    setExpandedFieldSections((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => validKeys.has(key)))
    );
    setCountryPickerValues((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => validKeys.has(key)))
    );
  }, [methods]);

  const methodsByKey = useMemo(
    () => methods.reduce((acc, method) => ({ ...acc, [method.id || method.localId]: method }), {}),
    [methods]
  );

  const filterOptions = useMemo(
    () => [
      { key: "all", label: t("common_all", "Todos") },
      { key: "enabled", label: t("common_enabled", "Activos") },
      { key: "manual", label: t("payment_method_kind_manual", "Manual") },
      { key: "gateway", label: t("payment_method_kind_gateway", "Pasarela") },
      { key: "system", label: t("payment_methods_system_badge", "Base del sistema") },
      { key: "custom", label: t("payment_methods_custom_badge", "Personalizado") },
    ],
    [t]
  );

  const methodMetrics = useMemo(
    () => ({
      total: methods.length,
      enabled: methods.filter((method) => method.enabled).length,
      system: methods.filter((method) => isSystemMethod(method)).length,
      custom: methods.filter((method) => !isSystemMethod(method)).length,
    }),
    [methods]
  );

  const visibleMethods = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return methods.filter((method) => {
      const matchesFilter =
        activeFilter === "all"
          ? true
          : activeFilter === "enabled"
            ? method.enabled
            : activeFilter === "manual"
              ? method.kind === "manual"
              : activeFilter === "gateway"
                ? method.kind === "gateway"
                : activeFilter === "system"
                  ? isSystemMethod(method)
                  : !isSystemMethod(method);

      if (!matchesFilter) return false;
      if (!term) return true;

      const haystack = [
        method.code,
        method.provider,
        firstFilledTranslation(method.title_i18n),
        firstFilledTranslation(method.description_i18n),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [activeFilter, methods, searchTerm]);

  const updateMethod = (methodKey, updater) => {
    setMethods((prev) =>
      prev.map((method) => {
        const currentKey = method.id || method.localId;
        if (currentKey !== methodKey) return method;
        const next = typeof updater === "function" ? updater(method) : { ...method, ...updater };
        return normalizeMethod(next);
      })
    );
  };

  const toggleMethodExpanded = (methodKey, nextState) => {
    setExpandedMethodKeys((prev) => {
      const isOpen = prev.includes(methodKey);
      const shouldOpen = typeof nextState === "boolean" ? nextState : !isOpen;
      if (shouldOpen) {
        return isOpen ? prev : [...prev, methodKey];
      }
      return prev.filter((key) => key !== methodKey);
    });
  };

  const toggleFieldsExpanded = (methodKey, nextState) => {
    setExpandedFieldSections((prev) => ({
      ...prev,
      [methodKey]: typeof nextState === "boolean" ? nextState : !prev[methodKey],
    }));
  };

  const addMethod = () => {
    setActiveFilter("all");
    setSearchTerm("");
    const localId = createLocalId();
    setMethods((prev) => [
      ...prev,
      normalizeMethod(
        {
          localId,
          kind: "manual",
          provider: "custom_manual",
          enabled: true,
          visible_languages: SUPPORTED_LANGUAGES.map((lang) => lang.code),
          visible_countries: [],
          country_visibility_mode: "all",
          title_i18n: {},
          description_i18n: {},
          instructions_i18n: {},
          sort_order: (prev.length + 1) * 10,
          fields: [],
        },
        prev.length
      ),
    ]);
    setExpandedMethodKeys((prev) => (prev.includes(localId) ? prev : [...prev, localId]));
    setExpandedFieldSections((prev) => ({ ...prev, [localId]: true }));
  };

  const addField = (methodKey) => {
    toggleFieldsExpanded(methodKey, true);
    updateMethod(methodKey, (method) => ({
      ...method,
      fields: [
        ...method.fields,
        normalizeField(
          {
            localId: createLocalId(),
            field_type: "text",
            enabled: true,
            copyable: false,
            sort_order: (method.fields.length + 1) * 10,
          },
          method.fields.length
        ),
      ],
    }));
  };

  const removeField = (methodKey, fieldLocalId) => {
    updateMethod(methodKey, (method) => ({
      ...method,
      fields: method.fields.filter((field) => field.localId !== fieldLocalId),
    }));
  };

  const toggleLanguage = (methodKey, languageCode) => {
    updateMethod(methodKey, (method) => {
      const exists = method.visible_languages.includes(languageCode);
      const next = exists
        ? method.visible_languages.filter((item) => item !== languageCode)
        : [...method.visible_languages, languageCode];
      return {
        ...method,
        visible_languages: next.length ? next : [languageCode],
      };
    });
  };

  const toggleAllLanguages = (methodKey) => {
    updateMethod(methodKey, (method) => {
      const all = SUPPORTED_LANGUAGES.map((lang) => lang.code);
      const hasAll = all.every((lang) => method.visible_languages.includes(lang));
      return {
        ...method,
        visible_languages: hasAll ? ["es"] : all,
      };
    });
  };

  const setCountryVisibilityMode = (methodKey, nextMode) => {
    updateMethod(methodKey, (method) => ({
      ...method,
      country_visibility_mode: nextMode,
      visible_countries: nextMode === "all" ? [] : method.visible_countries,
    }));
  };

  const addVisibleCountry = (methodKey, countryCode) => {
    const normalized = normalizeCountryCode(countryCode);
    if (!normalized || !COUNTRY_CODE_SET.has(normalized)) return;

    updateMethod(methodKey, (method) => ({
      ...method,
      country_visibility_mode: "restricted",
      visible_countries: method.visible_countries.includes(normalized)
        ? method.visible_countries
        : [...method.visible_countries, normalized],
    }));
    setCountryPickerValues((prev) => ({ ...prev, [methodKey]: COUNTRY_PICKER_EMPTY_VALUE }));
  };

  const removeVisibleCountry = (methodKey, countryCode) => {
    updateMethod(methodKey, (method) => ({
      ...method,
      visible_countries: method.visible_countries.filter((item) => item !== countryCode),
    }));
  };

  const buildMethodPayload = (method) => {
    const existingCodes = new Set(
      methods
        .filter((item) => (item.id || item.localId) !== (method.id || method.localId))
        .map((item) => item.code)
        .filter(Boolean)
    );
    const rawTitle = firstFilledTranslation(method.title_i18n) || method.provider || "payment_method";
    const generatedCode = buildUniqueKey(rawTitle, existingCodes, "payment_method");

    return {
      id: method.id || undefined,
      code: method.code || generatedCode,
      kind: method.kind,
      provider: isSystemMethod(method) ? method.provider : normalizeProviderForKind(method.kind),
      enabled: !!method.enabled,
      visible_languages: method.visible_languages,
      visible_countries:
        method.country_visibility_mode === "restricted" ? normalizeVisibleCountries(method.visible_countries) : [],
      title_i18n: method.title_i18n,
      description_i18n: method.description_i18n,
      instructions_i18n: method.instructions_i18n,
      public_config: method.public_config || {},
      sort_order: sanitizeSortOrder(method.sort_order, 0),
    };
  };

  const buildFieldPayloads = (method) => {
    const existingKeys = new Set();
    return method.fields.reduce((acc, field, index) => {
      const labelSeed = firstFilledTranslation(field.label_i18n) || field.field_key || `field_${index + 1}`;
      const fieldKey = field.field_key || buildUniqueKey(labelSeed, existingKeys, "field");
      existingKeys.add(fieldKey);
      const fieldValueI18n = normalizeI18n(field.field_value_i18n);
      const fallbackFieldValue = firstFilledTranslation(fieldValueI18n) || String(field.field_value || "").trim();

      const hasAnyContent =
        firstFilledTranslation(field.label_i18n) ||
        firstFilledTranslation(field.help_text_i18n) ||
        firstFilledTranslation(fieldValueI18n) ||
        String(field.field_value || "").trim();

      if (!hasAnyContent && !field.field_key) {
        return acc;
      }

      acc.push({
        payment_method_id: method.id,
        field_key: fieldKey,
        label_i18n: field.label_i18n,
        help_text_i18n: field.help_text_i18n,
        field_type: field.field_type,
        field_value_i18n: fieldValueI18n,
        field_value: fallbackFieldValue,
        copyable: !!field.copyable,
        enabled: !!field.enabled,
        sort_order: sanitizeSortOrder(field.sort_order, (index + 1) * 10),
      });
      return acc;
    }, []);
  };

  const invalidateRelatedQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["payment_methods_admin"] });
    await queryClient.invalidateQueries({ queryKey: ["payment_methods_public"] });
    await queryClient.invalidateQueries({ queryKey: ["platform_settings"] });
    await queryClient.invalidateQueries({ queryKey: ["platform_settings_payment"] });
    await queryClient.invalidateQueries({ queryKey: ["platform_settings_public"] });
  };

  const saveMethod = async (methodKey) => {
    const draft = methodsByKey[methodKey];
    if (!draft) return;

    if (!draft.visible_languages.length) {
      toast.error(t("payment_methods_lang_required", "Selecciona al menos un idioma visible."));
      return;
    }

    if (draft.country_visibility_mode === "restricted" && !draft.visible_countries.length) {
      toast.error(t("payment_methods_country_required", "Selecciona al menos un pais visible o usa Todos."));
      return;
    }

    if (!firstFilledTranslation(draft.title_i18n)) {
      toast.error(t("payment_methods_title_required", "Cada metodo debe tener al menos un titulo."));
      return;
    }

    const fieldKeys = new Set();
    for (const field of draft.fields) {
      const hasContent =
        firstFilledTranslation(field.label_i18n) ||
        firstFilledTranslation(field.help_text_i18n) ||
        firstFilledTranslation(field.field_value_i18n) ||
        String(field.field_value || "").trim();

      if (!hasContent && !field.field_key) continue;

      const candidateKey = field.field_key || slugify(firstFilledTranslation(field.label_i18n));
      if (!candidateKey) {
        toast.error(t("payment_methods_field_label_required", "Cada campo necesita al menos una etiqueta."));
        return;
      }
      if (fieldKeys.has(candidateKey)) {
        toast.error(t("payment_methods_field_key_unique", "No repitas campos dentro del mismo metodo."));
        return;
      }
      fieldKeys.add(candidateKey);
    }

    setSavingKey(methodKey);
    try {
      const methodPayload = buildMethodPayload(draft);
      const { data: savedMethod, error: methodError } = await supabase
        .from("payment_methods")
        .upsert(methodPayload)
        .select("*")
        .single();

      if (methodError) throw methodError;

      const payloadForFields = normalizeMethod({ ...draft, ...savedMethod, id: savedMethod.id });
      const nextFields = buildFieldPayloads({ ...payloadForFields, id: savedMethod.id });
      const nextFieldKeys = nextFields.map((field) => field.field_key);
      const keysToDelete = (draft.persistedFieldKeys || []).filter((fieldKey) => !nextFieldKeys.includes(fieldKey));

      if (keysToDelete.length) {
        const { error: deleteError } = await supabase
          .from("payment_method_fields")
          .delete()
          .eq("payment_method_id", savedMethod.id)
          .in("field_key", keysToDelete);
        if (deleteError) throw deleteError;
      }

      if (nextFields.length) {
        const { error: fieldsError } = await supabase
          .from("payment_method_fields")
          .upsert(nextFields, { onConflict: "payment_method_id,field_key" });
        if (fieldsError) throw fieldsError;
      }

      await invalidateRelatedQueries();
      toast.success(t("payment_methods_saved", "Metodo guardado"));
    } catch (error) {
      toast.error(error?.message || t("common_save_error", "No se pudo guardar"));
    } finally {
      setSavingKey(null);
    }
  };

  const deleteMethod = async (methodKey) => {
    const method = methodsByKey[methodKey];
    if (!method) return;

    if (isSystemMethod(method)) {
      toast.error(
        t(
          "payment_methods_system_delete_blocked",
          "Los metodos base no se eliminan: desactivalos si no quieres mostrarlos."
        )
      );
      return;
    }

    if (!window.confirm(t("payment_methods_delete_confirm", "Eliminar este metodo de pago?"))) {
      return;
    }

    if (!method.id) {
      setMethods((prev) => prev.filter((item) => (item.id || item.localId) !== methodKey));
      return;
    }

    setDeletingKey(methodKey);
    try {
      const { error } = await supabase.from("payment_methods").delete().eq("id", method.id);
      if (error) throw error;
      await invalidateRelatedQueries();
      toast.success(t("payment_methods_deleted", "Metodo eliminado"));
    } catch (error) {
      toast.error(error?.message || t("common_delete_error", "No se pudo eliminar"));
    } finally {
      setDeletingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("payment_methods_loading", "Cargando metodos de pago...")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            {t("payment_methods_admin_note_title", "Compatibilidad temporal del checkout")}
          </p>
          <p className="mt-1">
            {t(
              "payment_methods_admin_note_body",
              "Los metodos activos y visibles por idioma y pais ya alimentan el checkout. Los metodos base ademas se sincronizan con platform_settings por compatibilidad."
            )}
          </p>
        </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {t("payment_methods_dynamic_title", "Metodos dinamicos")}
          </p>
          <p className="text-sm text-slate-500">
            {t(
              "payment_methods_dynamic_subtitle",
              "Activa o desactiva metodos, limita idiomas o paises visibles y agrega campos sin depender de codigo."
            )}
          </p>
        </div>

        <Button type="button" variant="outline" className="bg-white" onClick={addMethod}>
          <Plus className="mr-2 h-4 w-4" />
          {t("payment_methods_add", "Agregar metodo")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("payment_methods_metric_total", "Total")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{methodMetrics.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            {t("common_enabled", "Activos")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-800">{methodMetrics.enabled}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
            {t("payment_methods_system_badge", "Base del sistema")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-blue-800">{methodMetrics.system}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
            {t("payment_methods_custom_badge", "Personalizados")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{methodMetrics.custom}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filterOptions
              .filter((option) => METHOD_FILTER_KEYS.includes(option.key))
              .map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActiveFilter(option.key)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    activeFilter === option.key
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
          </div>

          <div className="w-full lg:w-80">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("payment_methods_search", "Buscar por titulo, codigo o proveedor")}
              className="bg-white"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {visibleMethods.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            {t("payment_methods_no_results", "No hay metodos que coincidan con este filtro.")}
          </div>
        ) : null}

        {visibleMethods.map((method, index) => {
          const methodKey = method.id || method.localId;
          const Icon = getMethodIcon(method.provider);
          const systemMethod = isSystemMethod(method);
          const methodExpanded = expandedMethodKeys.includes(methodKey);
          const fieldsExpanded = !!expandedFieldSections[methodKey];
          const allLanguagesSelected = SUPPORTED_LANGUAGES.every((lang) =>
            method.visible_languages.includes(lang.code)
          );
          const allCountriesSelected = method.country_visibility_mode !== "restricted";
          const selectedVisibleCountries = method.visible_countries
            .map((code) => countryOptionsByCode.get(code) || { value: code, label: code })
            .sort((a, b) => a.label.localeCompare(b.label, getIntlLocale(language || "es"), { sensitivity: "base" }));
          const availableCountryOptions = countryOptions.filter(
            (country) => !method.visible_countries.includes(country.value)
          );
          const countryPickerValue = countryPickerValues[methodKey] || COUNTRY_PICKER_EMPTY_VALUE;
          const frameClasses = !method.enabled
            ? "border-slate-200"
            : method.kind === "gateway"
              ? "border-violet-200"
              : "border-emerald-200";
          const iconClasses = !method.enabled
            ? "bg-slate-100 text-slate-500"
            : method.kind === "gateway"
              ? "bg-violet-100 text-violet-700"
              : "bg-emerald-100 text-emerald-700";
          const description =
            firstFilledTranslation(method.description_i18n) ||
            t("payment_methods_no_description", "Sin descripcion corta todavia.");

          return (
            <div key={methodKey} className={`rounded-2xl border bg-white p-5 shadow-sm ${frameClasses}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 flex h-11 w-11 items-center justify-center rounded-2xl ${iconClasses}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {firstFilledTranslation(method.title_i18n) || `${t("payment_method", "Metodo")} ${index + 1}`}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          method.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {method.enabled ? t("common_enabled", "Activo") : t("common_disabled", "Inactivo")}
                      </span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {method.kind === "gateway"
                          ? t("payment_method_kind_gateway", "Pasarela")
                          : t("payment_method_kind_manual", "Manual")}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">{method.provider}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {t("payment_methods_fields_count", "Campos")}: {method.fields.length}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {allLanguagesSelected
                          ? t("payment_methods_all_languages", "Todos los idiomas")
                          : `${method.visible_languages.length} ${t("payment_methods_languages_short", "idiomas")}`}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {allCountriesSelected
                          ? t("payment_methods_all_countries", "Todos los paises")
                          : `${method.visible_countries.length} ${t("payment_methods_countries_short", "paises")}`}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 ${
                          systemMethod ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {systemMethod
                          ? t("payment_methods_system_badge", "Base del sistema")
                          : t("payment_methods_custom_badge", "Personalizado")}
                      </span>
                      {usesLegacySync(method) ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                          {t("payment_methods_legacy_sync_badge", "Sincroniza checkout actual")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white"
                    onClick={() => toggleMethodExpanded(methodKey)}
                  >
                    {methodExpanded ? (
                      <ChevronUp className="mr-2 h-4 w-4" />
                    ) : (
                      <ChevronDown className="mr-2 h-4 w-4" />
                    )}
                    {methodExpanded
                      ? t("payment_methods_hide_config", "Ocultar configuración")
                      : t("payment_methods_show_config", "Mostrar configuración")}
                  </Button>

                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-sm font-medium text-slate-700">
                      {method.enabled ? t("common_enabled", "Activo") : t("common_disabled", "Inactivo")}
                    </span>
                    <Switch
                      checked={!!method.enabled}
                      onCheckedChange={(value) => updateMethod(methodKey, { enabled: value })}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white"
                    onClick={() => saveMethod(methodKey)}
                    disabled={savingKey === methodKey || deletingKey === methodKey}
                  >
                    {savingKey === methodKey ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {t("common_save", "Guardar")}
                  </Button>

                  {systemMethod ? (
                    <div
                      className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700"
                      title={t(
                        "payment_methods_system_delete_hint",
                        "Los metodos base se desactivan, no se eliminan."
                      )}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      {t("payment_methods_system_badge", "Base del sistema")}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => deleteMethod(methodKey)}
                      disabled={savingKey === methodKey || deletingKey === methodKey}
                    >
                      {deletingKey === methodKey ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      {t("common_delete", "Eliminar")}
                    </Button>
                  )}
                </div>
              </div>

              <Collapsible open={methodExpanded} onOpenChange={(open) => toggleMethodExpanded(methodKey, open)}>
                <CollapsibleContent className="mt-5">
	                  <div className="grid gap-5">
	                    <div className="rounded-2xl border border-slate-200 p-4">
	                      <div className="mb-4 grid gap-1">
	                        <p className="text-sm font-semibold text-slate-900">
	                          {t("payment_methods_master_identity_title", "Identidad del metodo")}
	                        </p>
	                        <p className="text-sm text-slate-500">
	                          {t(
	                            "payment_methods_master_identity_help",
	                            "Define el nombre visible del metodo y su configuracion tecnica."
	                          )}
	                        </p>
	                      </div>

	                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
	                        <I18nEditor
	                          label={t("payment_methods_label_title", "Titulo del metodo")}
	                          value={method.title_i18n}
	                          onChange={(langCode, nextValue) =>
	                            updateMethod(methodKey, (current) => ({
	                              ...current,
	                              title_i18n: { ...current.title_i18n, [langCode]: nextValue },
	                            }))
	                          }
	                          placeholder={t("payment_methods_title_placeholder", "Nombre visible del metodo")}
	                        />

	                        <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
	                          <div className="space-y-2">
	                            <Label>{t("payment_methods_kind_label", "Tipo")}</Label>
	                            {systemMethod ? (
	                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
	                                {method.kind === "gateway"
	                                  ? t("payment_method_kind_gateway", "Pasarela")
	                                  : t("payment_method_kind_manual", "Manual")}
	                              </div>
	                            ) : (
	                              <Select
	                                value={method.kind}
	                                onValueChange={(value) =>
	                                  updateMethod(methodKey, (current) => ({
	                                    ...current,
	                                    kind: value,
	                                    provider: normalizeProviderForKind(value),
	                                  }))
	                                }
	                              >
	                                <SelectTrigger className="bg-white">
	                                  <SelectValue />
	                                </SelectTrigger>
	                                <SelectContent className="bg-white">
	                                  <SelectItem value="manual">{t("payment_method_kind_manual", "Manual")}</SelectItem>
	                                  <SelectItem value="gateway">{t("payment_method_kind_gateway", "Pasarela")}</SelectItem>
	                                </SelectContent>
	                              </Select>
	                            )}
	                          </div>

	                          <div className="space-y-2">
	                            <Label>{t("payment_methods_sort_order", "Orden")}</Label>
	                            <Input
	                              type="number"
	                              value={method.sort_order}
	                              onChange={(event) =>
	                                updateMethod(methodKey, { sort_order: sanitizeSortOrder(event.target.value, 0) })
	                              }
	                            />
	                          </div>

	                          <div className="space-y-2">
	                            <Label>{t("payment_methods_visible_languages", "Idiomas visibles")}</Label>
	                            <div className="flex flex-wrap gap-2">
	                              <button
	                                type="button"
	                                className={`rounded-full border px-3 py-1.5 text-sm transition ${
	                                  allLanguagesSelected
	                                    ? "border-slate-900 bg-slate-900 text-white"
	                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
	                                }`}
	                                onClick={() => toggleAllLanguages(methodKey)}
	                              >
	                                {t("seminars_language_all", "Todos")}
	                              </button>

	                              {SUPPORTED_LANGUAGES.map((lang) => {
	                                const selected = method.visible_languages.includes(lang.code);
	                                return (
	                                  <button
	                                    key={lang.code}
	                                    type="button"
	                                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
	                                      selected
	                                        ? "border-blue-600 bg-blue-50 text-blue-700"
	                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
	                                    }`}
	                                    onClick={() => toggleLanguage(methodKey, lang.code)}
	                                  >
	                                    {lang.label}
	                                  </button>
	                                );
	                              })}
	                            </div>
	                          </div>

                              <div className="space-y-3">
                                <Label>{t("payment_methods_visible_countries", "Paises visibles")}</Label>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                                      allCountriesSelected
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                                    onClick={() => setCountryVisibilityMode(methodKey, "all")}
                                  >
                                    {t("payment_methods_all_countries", "Todos los paises")}
                                  </button>
                                  <button
                                    type="button"
                                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                                      !allCountriesSelected
                                        ? "border-blue-600 bg-blue-50 text-blue-700"
                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                                    onClick={() => setCountryVisibilityMode(methodKey, "restricted")}
                                  >
                                    {t("payment_methods_selected_countries", "Solo paises seleccionados")}
                                  </button>
                                </div>

                                {!allCountriesSelected ? (
                                  <div className="space-y-3">
                                    <Select
                                      value={countryPickerValue}
                                      onValueChange={(value) => {
                                        if (value === COUNTRY_PICKER_EMPTY_VALUE) return;
                                        addVisibleCountry(methodKey, value);
                                      }}
                                    >
                                      <SelectTrigger className="bg-white">
                                        <SelectValue
                                          placeholder={t("payment_methods_add_country", "Agregar pais")}
                                        />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-80 bg-white">
                                        <SelectItem value={COUNTRY_PICKER_EMPTY_VALUE}>
                                          {t("payment_methods_add_country", "Agregar pais")}
                                        </SelectItem>
                                        {availableCountryOptions.map((country) => (
                                          <SelectItem key={country.value} value={country.value}>
                                            {country.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    {selectedVisibleCountries.length ? (
                                      <div className="flex flex-wrap gap-2">
                                        {selectedVisibleCountries.map((country) => (
                                          <button
                                            key={country.value}
                                            type="button"
                                            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 transition hover:bg-blue-100"
                                            onClick={() => removeVisibleCountry(methodKey, country.value)}
                                          >
                                            {country.label} x
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                                        {t(
                                          "payment_methods_no_countries_selected",
                                          "Aun no hay paises seleccionados para este metodo."
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500">
                                    {t(
                                      "payment_methods_all_countries_help",
                                      "Este metodo aparecera para cualquier pais de residencia."
                                    )}
                                  </p>
                                )}
                              </div>
	                        </div>
	                      </div>
	                    </div>

	                    <div className="rounded-2xl border border-slate-200 p-4">
	                      <div className="mb-4 grid gap-1">
	                        <p className="text-sm font-semibold text-slate-900">
	                          {t("payment_methods_master_description_title", "Descripcion visible")}
	                        </p>
	                        <p className="text-sm text-slate-500">
	                          {t(
	                            "payment_methods_master_description_help",
	                            "Resume este metodo de pago con un texto corto para el estudiante."
	                          )}
	                        </p>
	                      </div>

	                      <I18nEditor
	                        label={t("payment_methods_label_description", "Descripcion corta")}
	                        value={method.description_i18n}
	                        onChange={(langCode, nextValue) =>
	                          updateMethod(methodKey, (current) => ({
	                            ...current,
	                            description_i18n: { ...current.description_i18n, [langCode]: nextValue },
	                          }))
	                        }
	                        multiline
	                        placeholder={t("payment_methods_description_placeholder", "Resumen del metodo")}
	                      />
	                    </div>

	                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
	                      <div className="mb-4 grid gap-1">
	                        <p className="text-sm font-semibold text-slate-900">
	                          {t("payment_methods_master_instructions_title", "Instrucciones del metodo")}
	                        </p>
	                        <p className="text-sm text-slate-500">
	                          {t(
	                            "payment_methods_master_instructions_help",
	                            "Explica al estudiante que debe hacer para completar este pago."
	                          )}
	                        </p>
	                      </div>

	                      <I18nEditor
	                        label={t("payment_methods_label_instructions", "Instrucciones")}
	                        value={method.instructions_i18n}
	                        onChange={(langCode, nextValue) =>
	                          updateMethod(methodKey, (current) => ({
	                            ...current,
	                            instructions_i18n: { ...current.instructions_i18n, [langCode]: nextValue },
	                          }))
	                        }
	                        multiline
	                        placeholder={t("payment_methods_instructions_placeholder", "Que debe hacer el estudiante")}
	                      />
	                    </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {t("payment_methods_fields_title", "Campos del metodo")}
                      </p>
                      <p className="text-sm text-slate-500">
                        {t(
                          "payment_methods_fields_help",
                          "Define los datos que vera el estudiante: cuenta, enlace, referencia, notas o cualquier otro valor."
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-white"
                        onClick={() => toggleFieldsExpanded(methodKey)}
                      >
                        {fieldsExpanded ? (
                          <ChevronUp className="mr-2 h-4 w-4" />
                        ) : (
                          <ChevronDown className="mr-2 h-4 w-4" />
                        )}
                        {fieldsExpanded
                          ? t("payment_methods_hide_fields", "Ocultar campos")
                          : t("payment_methods_show_fields", "Mostrar campos")}
                      </Button>

                      <Button type="button" variant="outline" className="bg-white" onClick={() => addField(methodKey)}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t("payment_methods_add_field", "Agregar campo")}
                      </Button>
                    </div>
                  </div>

                  <Collapsible open={fieldsExpanded} onOpenChange={(open) => toggleFieldsExpanded(methodKey, open)}>
                    <CollapsibleContent className="mt-4">
                      <div className="space-y-4">
                        {method.fields.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                            {t("payment_methods_no_fields", "Aun no hay campos en este metodo.")}
                          </div>
                        ) : null}

                        {method.fields.map((field) => {
                          const valueIsLong = field.field_type === "textarea";
                          const lockedDelete = systemMethod && !!field.field_key;
                          return (
                            <div key={field.localId} className="rounded-xl border border-slate-200 bg-white p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                  {field.field_key ? (
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1">{field.field_key}</span>
                                  ) : (
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                      {t("payment_methods_key_auto", "Clave interna automatica")}
                                    </span>
                                  )}
                                  {lockedDelete ? (
                                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                                      {t("payment_methods_field_core_badge", "Campo base")}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-600">
                                      {field.enabled ? t("common_enabled", "Activo") : t("common_disabled", "Inactivo")}
                                    </span>
                                    <Switch
                                      checked={!!field.enabled}
                                      onCheckedChange={(value) =>
                                        updateMethod(methodKey, (current) => ({
                                          ...current,
                                          fields: current.fields.map((item) =>
                                            item.localId === field.localId ? { ...item, enabled: value } : item
                                          ),
                                        }))
                                      }
                                    />
                                  </div>

                                  {lockedDelete ? (
                                    <div
                                      className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700"
                                      title={t(
                                        "payment_methods_field_core_hint",
                                        "Los campos base se desactivan, no se eliminan."
                                      )}
                                    >
                                      <Lock className="mr-2 h-4 w-4" />
                                      {t("payment_methods_field_core_badge", "Campo base")}
                                    </div>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                      onClick={() => removeField(methodKey, field.localId)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      {t("common_delete", "Eliminar")}
                                    </Button>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                                  <I18nEditor
                                    label={t("payment_methods_field_label", "Etiqueta del campo")}
                                    value={field.label_i18n}
                                    onChange={(langCode, nextValue) =>
                                      updateMethod(methodKey, (current) => ({
                                        ...current,
                                        fields: current.fields.map((item) =>
                                          item.localId === field.localId
                                            ? {
                                                ...item,
                                                label_i18n: { ...item.label_i18n, [langCode]: nextValue },
                                              }
                                            : item
                                        ),
                                      }))
                                    }
                                    placeholder={t("payment_methods_field_label_placeholder", "Nombre visible del dato")}
                                  />

                                  <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="space-y-2">
                                      <Label>{t("payment_methods_field_type", "Tipo de campo")}</Label>
                                      <Select
                                        value={field.field_type}
                                        onValueChange={(value) =>
                                          updateMethod(methodKey, (current) => ({
                                            ...current,
                                            fields: current.fields.map((item) =>
                                              item.localId === field.localId ? { ...item, field_type: value } : item
                                            ),
                                          }))
                                        }
                                      >
                                        <SelectTrigger className="bg-white">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                          {FIELD_TYPE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-2">
                                      <Label>{t("payment_methods_sort_order", "Orden")}</Label>
                                      <Input
                                        type="number"
                                        value={field.sort_order}
                                        onChange={(event) =>
                                          updateMethod(methodKey, (current) => ({
                                            ...current,
                                            fields: current.fields.map((item) =>
                                              item.localId === field.localId
                                                ? {
                                                    ...item,
                                                    sort_order: sanitizeSortOrder(event.target.value, item.sort_order),
                                                  }
                                                : item
                                            ),
                                          }))
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                                  <I18nEditor
                                    label={t("payment_methods_field_value", "Valor")}
                                    value={field.field_value_i18n}
                                    onChange={(langCode, nextValue) =>
                                      updateMethod(methodKey, (current) => ({
                                        ...current,
                                        fields: current.fields.map((item) =>
                                          item.localId === field.localId
                                            ? {
                                                ...item,
                                                field_value_i18n: { ...item.field_value_i18n, [langCode]: nextValue },
                                                field_value:
                                                  langCode === "es"
                                                    ? nextValue
                                                    : item.field_value,
                                              }
                                            : item
                                        ),
                                      }))
                                    }
                                    multiline={valueIsLong}
                                    placeholder={t("payment_methods_field_value_placeholder", "Dato que vera el estudiante")}
                                  />

                                  <div className="flex h-fit items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 lg:mt-7">
                                    <div>
                                      <p className="text-sm font-medium text-slate-900">
                                        {t("payment_methods_field_copyable", "Copiable")}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {t("payment_methods_field_copyable_help", "Util para cuentas, referencias o enlaces.")}
                                      </p>
                                    </div>
                                    <Switch
                                      checked={!!field.copyable}
                                      onCheckedChange={(value) =>
                                        updateMethod(methodKey, (current) => ({
                                          ...current,
                                          fields: current.fields.map((item) =>
                                            item.localId === field.localId ? { ...item, copyable: value } : item
                                          ),
                                        }))
                                      }
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                <I18nEditor
                                  label={t("payment_methods_field_help_text", "Ayuda opcional")}
                                  value={field.help_text_i18n}
                                  onChange={(langCode, nextValue) =>
                                    updateMethod(methodKey, (current) => ({
                                      ...current,
                                      fields: current.fields.map((item) =>
                                        item.localId === field.localId
                                          ? {
                                              ...item,
                                              help_text_i18n: { ...item.help_text_i18n, [langCode]: nextValue },
                                            }
                                          : item
                                      ),
                                    }))
                                  }
                                  multiline
                                  placeholder={t("payment_methods_field_help_placeholder", "Texto extra bajo el campo")}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
          );
        })}
      </div>
    </div>
  );
}
