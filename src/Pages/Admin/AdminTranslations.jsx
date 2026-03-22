import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { DEFAULT_TRANSLATIONS } from "../../Components/shared/LanguageContext";
import CODE_TRANSLATION_SEED from "../../Components/shared/translationSeedFromCode.json";
import { useLanguage } from "../../Components/shared/LanguageContext";

import { Button } from "../../Components/ui/button";
import { Input } from "../../Components/ui/input";
import { Textarea } from "../../Components/ui/textarea";
import { Label } from "../../Components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../Components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../Components/ui/dialog";
import { Loader2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const LANGS = ["es", "en", "fr", "ht"];
const REVIEWABLE_CODE_UPDATE_KEYS = new Set([
  "surplusExplanation",
  "economic_conditions_inline_cta",
  "economic_conditions_professor_body",
  "economic_conditions_referrals_intro",
  "economic_conditions_referrals_rule_paid",
  "economic_conditions_referrals_rule_surplus",
  "economic_conditions_referrals_rule_release",
  "economic_conditions_referrals_rule_fallback",
  "economics_note",
  "payment_deferred_note",
  "support_faq_payment_a",
  "support_faq_referrals_a",
  "wallet_held_referrals",
  "wallet_held_referrals_help",
  "complete_seminar_payment_window_open_error",
]);

function normalizeTranslationValue(value) {
  return String(value || "").trim();
}

function isRowComplete(row) {
  return LANGS.every((lang) => String(row?.[lang] || "").trim().length > 0);
}

function escapeCsvValue(value) {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

function buildCsvContent(rows) {
  const headers = ["key", "es", "en", "fr", "ht"];
  const lines = (rows || []).map((row) =>
    headers.map((h) => escapeCsvValue(row?.[h] ?? "")).join(",")
  );
  return `\uFEFF${[headers.join(","), ...lines].join("\n")}`;
}

function downloadCsv(rows, filename) {
  const csv = buildCsvContent(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildSeedRows() {
  const keys = new Set();
  LANGS.forEach((lang) => {
    const map = DEFAULT_TRANSLATIONS?.[lang] || {};
    Object.keys(map).forEach((k) => keys.add(k));
  });

  return Array.from(keys).map((key) => ({
    key,
    es: DEFAULT_TRANSLATIONS?.es?.[key] ?? null,
    en: DEFAULT_TRANSLATIONS?.en?.[key] ?? null,
    fr: DEFAULT_TRANSLATIONS?.fr?.[key] ?? null,
    ht: DEFAULT_TRANSLATIONS?.ht?.[key] ?? null,
  }));
}

function buildSeedRowsFromCode() {
  const keys = new Set();
  LANGS.forEach((lang) => {
    const map = DEFAULT_TRANSLATIONS?.[lang] || {};
    Object.keys(map).forEach((k) => keys.add(k));
  });
  Object.keys(CODE_TRANSLATION_SEED || {}).forEach((k) => keys.add(k));

  return Array.from(keys).map((key) => ({
    key,
    es: CODE_TRANSLATION_SEED?.[key] ?? DEFAULT_TRANSLATIONS?.es?.[key] ?? null,
    en: DEFAULT_TRANSLATIONS?.en?.[key] ?? null,
    fr: DEFAULT_TRANSLATIONS?.fr?.[key] ?? null,
    ht: DEFAULT_TRANSLATIONS?.ht?.[key] ?? null,
  }));
}

function mergeSeedWithExisting(existingRows, seedRows) {
  const existingMap = new Map((existingRows || []).map((row) => [row.key, row]));
  return (seedRows || []).map((seed) => {
    const existing = existingMap.get(seed.key);
    if (!existing) return seed;
    const merged = { ...seed };
    LANGS.forEach((lang) => {
      if (existing?.[lang]) merged[lang] = existing[lang];
    });
    return merged;
  });
}

function getCodeBaseSpanish(row, codeSeedMap) {
  return normalizeTranslationValue(codeSeedMap.get(row?.key)?.es);
}

function hasTrustedCodeBaseSpanish(row, codeSeedMap) {
  const codeEs = getCodeBaseSpanish(row, codeSeedMap);
  const currentEs = normalizeTranslationValue(row?.es);
  const currentEn = normalizeTranslationValue(row?.en);

  if (!codeEs.length) return false;

  // Some legacy seed entries stored the English fallback as the Spanish base.
  // If the supposed code-base ES matches EN while BO already has a different ES,
  // treat it as an untrusted source instead of a real pending update.
  if (currentEn.length > 0 && codeEs === currentEn && currentEs !== currentEn) {
    return false;
  }

  return true;
}

function isRowOutdated(row, codeSeedMap) {
  if (!REVIEWABLE_CODE_UPDATE_KEYS.has(row?.key)) return false;
  const currentEs = normalizeTranslationValue(row?.es);
  const codeEs = getCodeBaseSpanish(row, codeSeedMap);
  return hasTrustedCodeBaseSpanish(row, codeSeedMap) && currentEs.length > 0 && currentEs !== codeEs;
}

function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const sample = lines[0] || "";
  const commaCount = (sample.match(/,/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  if (tabCount > commaCount && tabCount > semiCount) return "\t";
  if (semiCount > commaCount) return ";";
  return ",";
}

function parseCsv(text, delimiter) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.length > 1 || row[0]?.trim()) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    if (row.length > 1 || row[0]?.trim()) {
      rows.push(row);
    }
  }

  return rows;
}

function csvRowsFromText(text) {
  const cleanText = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(cleanText);
  const rows = parseCsv(cleanText, delimiter);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || "").trim().toLowerCase());
  const headerIndex = (name) => headers.indexOf(name);

  const idxKey = headerIndex("key");
  const idxEs = headerIndex("es");
  const idxEn = headerIndex("en");
  const idxFr = headerIndex("fr");
  const idxHt = headerIndex("ht");
  if (idxKey === -1) {
    throw new Error("CSV sin columna key");
  }

  const map = new Map();
  for (let i = 1; i < rows.length; i += 1) {
    const line = rows[i] || [];
    const key = String(line[idxKey] || "").trim();
    if (!key) continue;
    const row = {
      key,
      es: String(line[idxEs] || "").trim() || null,
      en: String(line[idxEn] || "").trim() || null,
      fr: String(line[idxFr] || "").trim() || null,
      ht: String(line[idxHt] || "").trim() || null,
    };
    map.set(key, row);
  }

  return Array.from(map.values());
}

function mergeCsvWithExisting(existingRows, csvRows, overwrite) {
  const existingMap = new Map((existingRows || []).map((row) => [row.key, row]));
  return (csvRows || []).map((row) => {
    const existing = existingMap.get(row.key);
    if (!existing) return row;
    const merged = { key: row.key };
    LANGS.forEach((lang) => {
      const fromCsv = row?.[lang] || null;
      const fromExisting = existing?.[lang] || null;
      if (overwrite) {
        merged[lang] = fromCsv ?? fromExisting;
      } else {
        merged[lang] = fromExisting || fromCsv;
      }
    });
    return merged;
  });
}

function computeCsvStats(csvRows, existingRows, overwrite) {
  const existingMap = new Map((existingRows || []).map((row) => [row.key, row]));
  let newKeys = 0;
  let updatedFields = 0;

  (csvRows || []).forEach((row) => {
    const existing = existingMap.get(row.key);
    if (!existing) {
      newKeys += 1;
      return;
    }
    LANGS.forEach((lang) => {
      const csvVal = row?.[lang];
      const existingVal = existing?.[lang];
      if (!csvVal) return;
      if (overwrite) {
        if (csvVal !== existingVal) updatedFields += 1;
      } else if (!existingVal) {
        updatedFields += 1;
      }
    });
  });

  return {
    total: csvRows?.length || 0,
    newKeys,
    updatedFields,
  };
}

export default function AdminTranslations() {
  const qc = useQueryClient();
  const { t, refreshTranslations } = useLanguage();
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState({ key: "", es: "", en: "", fr: "", ht: "" });
  const [isNew, setIsNew] = useState(false);
  const [editMeta, setEditMeta] = useState({ mode: "edit", currentEs: "", codeEs: "" });
  const [csvRows, setCsvRows] = useState([]);
  const [overwriteCsv, setOverwriteCsv] = useState(false);
  const csvInputRef = useRef(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [translationFilter, setTranslationFilter] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["i18n"],
    queryFn: async () => {
      const { data, error } = await supabase.from("i18n").select("*").order("key");
      if (error) throw error;
      return data ?? [];
    },
  });

  const codeSeedRows = useMemo(() => buildSeedRowsFromCode(), []);
  const codeSeedMap = useMemo(
    () => new Map(codeSeedRows.map((row) => [row.key, row])),
    [codeSeedRows]
  );
  const outdatedRows = useMemo(
    () => rows.filter((row) => isRowOutdated(row, codeSeedMap)),
    [rows, codeSeedMap]
  );
  const outdatedKeySet = useMemo(
    () => new Set(outdatedRows.map((row) => row.key)),
    [outdatedRows]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesTerm =
        !term ||
        [row.key, row.es, row.en, row.fr, row.ht].some((value) =>
          String(value || "").toLowerCase().includes(term)
        );
      if (!matchesTerm) return false;
      if (translationFilter === "missing") return !isRowComplete(row);
      if (translationFilter === "complete") return isRowComplete(row);
      if (translationFilter === "outdated") return isRowOutdated(row, codeSeedMap);
      return true;
    });
  }, [rows, search, translationFilter, codeSeedMap]);

  const incompleteRows = useMemo(() => rows.filter((row) => !isRowComplete(row)), [rows]);
  const missingCount = useMemo(() => {
    const dbSet = new Set(rows.map((row) => row.key));
    return codeSeedRows.filter((row) => !dbSet.has(row.key)).length;
  }, [rows, codeSeedRows]);

  const csvStats = useMemo(() => {
    if (!csvRows.length) return null;
    return computeCsvStats(csvRows, rows, overwriteCsv);
  }, [csvRows, rows, overwriteCsv]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from("i18n").upsert(payload, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("i18n_saved", "Traducción guardada"));
      qc.invalidateQueries({ queryKey: ["i18n"] });
      refreshTranslations?.();
      setEditOpen(false);
      setEditMeta({ mode: "edit", currentEs: "", codeEs: "" });
    },
    onError: (err) => toast.error(err?.message || t("common_save_error", "No se pudo guardar")),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const rowsToSeed = mergeSeedWithExisting(rows, buildSeedRows());
      const { error } = await supabase.from("i18n").upsert(rowsToSeed, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("i18n_seeded", "Traducciones base cargadas"));
      qc.invalidateQueries({ queryKey: ["i18n"] });
      refreshTranslations?.();
    },
    onError: (err) => toast.error(err?.message || t("common_load_error", "No se pudo cargar")),
  });

  const seedFromCodeMutation = useMutation({
    mutationFn: async () => {
      const rowsToSeed = mergeSeedWithExisting(rows, buildSeedRowsFromCode());
      const { error } = await supabase.from("i18n").upsert(rowsToSeed, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("i18n_seeded", "Traducciones base cargadas"));
      qc.invalidateQueries({ queryKey: ["i18n"] });
      refreshTranslations?.();
    },
    onError: (err) => toast.error(err?.message || t("common_load_error", "No se pudo cargar")),
  });

  const importCsvMutation = useMutation({
    mutationFn: async () => {
      if (!csvRows.length) return;
      const rowsToUpsert = mergeCsvWithExisting(rows, csvRows, overwriteCsv);
      const { error } = await supabase.from("i18n").upsert(rowsToUpsert, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("i18n_import_success", "Traducciones importadas"));
      qc.invalidateQueries({ queryKey: ["i18n"] });
      refreshTranslations?.();
    },
    onError: (err) => toast.error(err?.message || t("common_load_error", "No se pudo cargar")),
  });

  const handleCsvFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setCsvRows([]);
      setCsvFileName("");
      return;
    }
    setCsvFileName(file.name);
    try {
      const text = await file.text();
      const parsed = csvRowsFromText(text);
      if (!parsed.length) {
        toast.error(t("i18n_csv_empty", "CSV vacío o sin filas válidas"));
      }
      setCsvRows(parsed);
    } catch (err) {
      setCsvRows([]);
      toast.error(err?.message || t("i18n_csv_parse_error", "No se pudo leer el CSV"));
    } finally {
      if (event.target) event.target.value = "";
    }
  };

  const handleImportClick = () => {
    if (!csvRows.length) {
      if (csvInputRef.current) {
        csvInputRef.current.click();
        return;
      }
      toast.error(t("i18n_no_csv", "Selecciona un CSV primero"));
      return;
    }
    importCsvMutation.mutate();
  };

  const handleExport = (rowsToExport, filename) => {
    if (!rowsToExport?.length) {
      toast.error(t("i18n_export_empty", "No hay filas para exportar"));
      return;
    }
    downloadCsv(rowsToExport, filename);
  };

  const openNew = () => {
    setDraft({ key: "", es: "", en: "", fr: "", ht: "" });
    setIsNew(true);
    setEditMeta({ mode: "new", currentEs: "", codeEs: "" });
    setEditOpen(true);
  };

  const openEdit = (row, options = {}) => {
    const codeEs = getCodeBaseSpanish(row, codeSeedMap);
    const currentEs = normalizeTranslationValue(row?.es);
    const useCodeSeedEs = options.useCodeSeedEs && codeEs;
    setDraft({
      key: row.key || "",
      es: useCodeSeedEs ? codeEs : row.es || "",
      en: row.en || "",
      fr: row.fr || "",
      ht: row.ht || "",
    });
    setIsNew(false);
    setEditMeta({
      mode: useCodeSeedEs ? "outdated" : "edit",
      currentEs,
      codeEs,
    });
    setEditOpen(true);
  };

  const openPendingUpdate = (row) => {
    openEdit(row, { useCodeSeedEs: true });
  };

  const openFirstPendingUpdate = () => {
    if (!outdatedRows.length) {
      toast(t("i18n_no_pending_updates", "No hay cadenas pendientes de actualizar."));
      return;
    }
    openPendingUpdate(outdatedRows[0]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("i18n_title", "Translations")}</h1>
          <p className="text-slate-500 text-sm">{t("i18n_subtitle", "Gestiona los textos del sistema sin tocar código.")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="border-slate-200 bg-white shadow-sm hover:bg-slate-50"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {t("i18n_seed_defaults", "Seed defaults")}
          </Button>
          <Button
            variant="outline"
            className="border-slate-200 bg-white shadow-sm hover:bg-slate-50"
            onClick={() => seedFromCodeMutation.mutate()}
            disabled={seedFromCodeMutation.isPending}
          >
            {seedFromCodeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {t("i18n_seed_from_code", "Seed desde código")}
          </Button>
          <Button
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-900 shadow-sm hover:bg-amber-100"
            onClick={openFirstPendingUpdate}
            disabled={!outdatedRows.length}
          >
            <Pencil className="h-4 w-4 mr-2" />
            {t("i18n_update_pending", "Actualizar pendientes")} ({outdatedRows.length})
          </Button>
          <Button className="bg-slate-900 text-white shadow-sm hover:bg-slate-800" onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            {t("i18n_new_key", "Nuevo key")}
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="px-2.5 py-1 rounded-full bg-slate-100">
              {t("i18n_count_db", "En BO")}: {rows.length}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100">
              {t("i18n_count_code", "En código")}: {codeSeedRows.length}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100">
              {t("i18n_count_missing", "Faltan")}: {missingCount}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
              {t("i18n_count_outdated", "Pendientes de actualizar")}: {outdatedRows.length}
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCsvFile}
              />
              <Button
                variant="outline"
                className="border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                onClick={() => csvInputRef.current?.click()}
              >
                {t("i18n_select_csv", "Seleccionar CSV")}
              </Button>
              <span className="text-xs text-slate-500">
                {csvFileName || t("i18n_no_csv", "Sin archivo")}
              </span>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={overwriteCsv}
                onChange={(e) => setOverwriteCsv(e.target.checked)}
              />
              {t("i18n_overwrite_existing", "Sobrescribir existentes")}
            </label>

            <Button
              className="bg-slate-900 text-white shadow-sm hover:bg-slate-800"
              onClick={handleImportClick}
              disabled={importCsvMutation.isPending}
            >
              {importCsvMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("i18n_import_csv", "Importar CSV")}
            </Button>
          </div>

          {csvStats ? (
            <div className="text-xs text-slate-500">
              {t("i18n_csv_rows", "Filas")}: {csvStats.total} · {t("i18n_csv_new", "Nuevas")}: {csvStats.newKeys} · {t("i18n_csv_updates", "Actualizaciones")}: {csvStats.updatedFields}
            </div>
          ) : null}

          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <Input
              className="lg:flex-1"
              placeholder={t("i18n_search_placeholder", "Buscar key o texto...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{t("i18n_filter_label", "Mostrar")}</span>
              <select
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                value={translationFilter}
                onChange={(e) => setTranslationFilter(e.target.value)}
              >
                <option value="all">{t("i18n_filter_all", "Todas")}</option>
                <option value="complete">{t("i18n_filter_complete", "Traducidas")}</option>
                <option value="missing">{t("i18n_filter_missing", "No traducidas")}</option>
                <option value="outdated">{t("i18n_filter_outdated", "Pendientes de actualizar")}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-slate-200 bg-white shadow-sm hover:bg-slate-50"
              onClick={() => handleExport(rows, "i18n-all.csv")}
            >
              {t("i18n_export_all", "Exportar todo")}
            </Button>
            <Button
              variant="outline"
              className="border-slate-200 bg-white shadow-sm hover:bg-slate-50"
              onClick={() => handleExport(incompleteRows, "i18n-missing.csv")}
              disabled={!incompleteRows.length}
            >
              {t("i18n_export_missing", "Exportar no traducidas")}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common_loading", "Cargando...")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500 text-sm py-8 text-center">{t("common_no_results", "Sin resultados")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>ES</TableHead>
                  <TableHead>EN</TableHead>
                  <TableHead>FR</TableHead>
                  <TableHead>HT</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.key} className={outdatedKeySet.has(row.key) ? "bg-amber-50/60" : ""}>
                    <TableCell className="font-medium">{row.key}</TableCell>
                    <TableCell className="truncate max-w-[220px]">{row.es || "—"}</TableCell>
                    <TableCell className="truncate max-w-[220px]">{row.en || "—"}</TableCell>
                    <TableCell className="truncate max-w-[220px]">{row.fr || "—"}</TableCell>
                    <TableCell className="truncate max-w-[220px]">{row.ht || "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (outdatedKeySet.has(row.key) ? openPendingUpdate(row) : openEdit(row))}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        {outdatedKeySet.has(row.key)
                          ? t("i18n_update_translation", "Actualizar")
                          : t("common_edit", "Editar")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditMeta({ mode: "edit", currentEs: "", codeEs: "" });
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNew ? t("i18n_new_key", "Nuevo key") : t("i18n_edit_translation", "Editar traducción")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {editMeta.mode === "outdated" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-medium">
                  {t("i18n_updated_base_label", "Texto base actualizado desde código")}
                </p>
                <p className="mt-1 text-xs text-amber-900">
                  {t(
                    "i18n_updated_base_help",
                    "Se detectó que esta cadena cambió en el código. Revisa el nuevo texto base en español y actualiza las traducciones pendientes."
                  )}
                </p>
                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                      {t("i18n_current_db_value", "Valor actual en BO")}
                    </p>
                    <p>{editMeta.currentEs || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                      {t("i18n_new_code_value", "Nuevo texto base")}
                    </p>
                    <p>{editMeta.codeEs || "—"}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>{t("i18n_key", "Key")}</Label>
              <Input
                value={draft.key}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                disabled={!isNew}
                placeholder={t("i18n_key_placeholder", "home")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("i18n_es", "Español")}</Label>
              <Textarea value={draft.es} onChange={(e) => setDraft({ ...draft, es: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("i18n_en", "English")}</Label>
              <Textarea value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("i18n_fr", "Français")}</Label>
              <Textarea value={draft.fr} onChange={(e) => setDraft({ ...draft, fr: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("i18n_ht", "Kreyòl")}</Label>
              <Textarea value={draft.ht} onChange={(e) => setDraft({ ...draft, ht: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditMeta({ mode: "edit", currentEs: "", codeEs: "" });
              }}
            >
              {t("common_cancel", "Cancelar")}
            </Button>
            <Button
              onClick={() => saveMutation.mutate(draft)}
              disabled={saveMutation.isPending || !draft.key}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("common_save", "Guardar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
