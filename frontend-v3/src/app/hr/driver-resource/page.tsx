"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  Megaphone,
  PauseCircle,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  Route,
  ShieldAlert,
  Sparkles,
  Truck,
  UserMinus,
  Users,
} from "lucide-react";

type Horizon = {
  required: number;
  available: number;
  raw_deficit: number;
  confirmed_transfer_in: number;
  to_hire: number;
  data_quality: "high" | "medium" | "low";
};

type AvitoLiveAd = {
  item_id: string;
  title: string;
  status: string;
  views: number;
  contacts: number;
  favorites?: number;
  conversion_pct: number;
  url?: string;
  address?: string;
  updated_at?: string | null;
  ai_audit?: {
    score: number;
    headline_quality?: number;
    headline_issues: string[];
    body_quality?: number | null;
    body_issues: string[];
    missing_facts: string[];
    recommended_action: "keep" | "rewrite" | "promote" | "unpublish" | "duplicate";
    rationale: string;
    suggested_title: string | null;
    suggested_first_screen: string | null;
    suggested_full_text: string | null;
    audited_at: string;
    model: string;
    provider?: string;
  } | null;
};

type RouteNeed = {
  id: number;
  route_code: string;
  route_label: string;
  calculation_state: string;
  workflow_status: string;
  priority: "none" | "low" | "medium" | "high" | "critical";
  today: Horizon;
  d7: Horizon;
  d14: Horizon;
  d30: Horizon;
  next_critical_date: string | null;
  manager_comment: string | null;
  last_snapshot_key: string | null;
  last_calculated_at: string | null;
  last_calculation_duration_ms: number | null;
  avito: {
    ads_count: number;
    contacts: number;
    views: number;
    favorites?: number;
    conversion_pct?: number;
    active_ads?: number;
    live_ads_count?: number;
    candidates: number;
    call_now: number;
    vacancy_stats?: AvitoLiveAd[];
    live_ads?: AvitoLiveAd[];
    snapshot_generated_at?: string | null;
  };
};

type DashboardResponse = {
  ok: boolean;
  cache_used: boolean;
  cache_ttl_seconds: number;
  generated_at: string;
  routes: RouteNeed[];
};

type HiringRecommendation = {
  route_code: string;
  route_label: string;
  action: "none" | "create_ads" | "create_or_promote_ads" | "sync_ads";
  command_type: string | null;
  request_type: string | null;
  requested_driver_count: number;
  urgency: string;
  severity: string;
  reason: string;
  can_apply: boolean;
  skip_reason: string | null;
  existing_command?: Record<string, any> | null;
  avito: {
    ads_count: number;
    contacts: number;
    candidates: number;
    call_now: number;
    views: number;
  };
};

type Detail = {
  ok: boolean;
  route_code: string;
  route_label: string;
  need: RouteNeed;
  active_vehicles: Array<Record<string, any>>;
  blocked_vehicles: Array<Record<string, any>>;
  available_drivers: Array<Record<string, any>>;
  exclusions: Array<Record<string, any>>;
  data_quality_issues: Array<Record<string, any>>;
  transfer_proposals: Array<Record<string, any>>;
  manual_exits: Array<Record<string, any>>;
  hiring_requests: Array<Record<string, any>>;
  avito_commands: Array<Record<string, any>>;
  hiring_ai_runs: Array<Record<string, any>>;
  avito: RouteNeed["avito"];
};

type QuickAction = "need" | "quality_problem" | "stop";
type AuditState = "idle" | "loading" | "error";
type AuditCommandType = "update_ad" | "promote_ads" | "unpublish_ads" | "duplicate_ad";
type TextCheck = {
  label: string;
  ok: boolean;
};

const priorityLabel: Record<string, string> = {
  critical: "критично",
  high: "высоко",
  medium: "средне",
  low: "наблюдать",
  none: "норма",
};

const reasonLabel: Record<string, string> = {
  vacation: "отпуск",
  sick_leave: "больничный",
  submitted_resignation: "заявление",
  no_show: "не вышел",
  documents_blocked: "документы",
  no_c: "нет C",
  no_ce: "нет CE",
  no_skzi: "нет СКЗИ",
  wb_blocked: "WB-допуск",
  driver_status: "статус",
  manual_block: "ручной блок",
  unknown: "неизвестно",
};

const exitReasons = [
  ["pay", "Деньги"],
  ["route", "Маршрут"],
  ["schedule", "График"],
  ["changeover", "Пересменка"],
  ["vehicle_condition", "Состояние машины"],
  ["mechanic_conflict", "Конфликт с механиком"],
  ["documents", "Документы"],
  ["wb_access", "WB-допуск"],
  ["health", "Здоровье"],
  ["family", "Семья"],
  ["discipline", "Дисциплина"],
  ["no_show", "Не вышел / пропал"],
  ["better_offer", "Лучшее предложение"],
  ["company_decision", "Решение компании"],
  ["other", "Другое"],
];

const hiringRequestTypeLabel: Record<string, string> = {
  need_drivers: "Нужны водители",
  stop_hiring: "Стоп набор",
  reduce_hiring: "Снизить набор",
};

const commandTypeLabel: Record<string, string> = {
  create_ads: "создать объявления",
  promote_ads: "продвинуть объявления",
  create_or_promote_ads: "создать/усилить объявления",
  pause_ads: "поставить объявления на паузу",
  unpublish_ads: "снять объявления",
  sync_ads: "синхронизировать объявления",
  update_ad: "переписать объявление",
  duplicate_ad: "подготовить дубль",
};

const recommendationActionLabel: Record<string, string> = {
  none: "действий не нужно",
  create_ads: "создать объявления",
  create_or_promote_ads: "усилить объявления",
  sync_ads: "проверить лишние объявления",
};

const commandStatusLabel: Record<string, string> = {
  queued: "готово к проверке",
  needs_review: "на проверке",
  executed: "выполнено",
  failed: "ошибка",
  cancelled: "отменено",
  sent: "отправлено",
  skipped: "пропущено",
};

const requestStatusLabel: Record<string, string> = {
  open: "открыта",
  in_progress: "в работе",
  closed: "закрыта",
  cancelled: "отменена",
};

const aiStatusLabel: Record<string, string> = {
  completed: "готово",
  failed: "ошибка",
  processing: "в работе",
  queued: "в очереди",
};

const dataQualityLabel: Record<string, string> = {
  high: "данные хорошие",
  medium: "проверить",
  low: "мало данных",
};

const horizonCodeLabel: Record<string, string> = {
  today: "сегодня",
  d7: "7 дней",
  d14: "14 дней",
  d30: "30 дней",
};

const quickActionLabel: Record<QuickAction, string> = {
  need: "Нужны водители",
  quality_problem: "Мало звонков",
  stop: "Стоп набор",
};

const quickActionHint: Record<QuickAction, string> = {
  need: "Запустить или усилить набор",
  quality_problem: "Проверить и усилить объявления",
  stop: "Остановить лишний набор",
};

const workGroups = [
  {
    code: "wb",
    title: "Маршруты WB",
    subtitle: "Рязань, Уфа-Сарапул-Уфа, Екатеринбург и Киров. Сейчас основной фокус - Рязань.",
    routeCodes: ["ryazan_wb", "sarapul_ufa", "ekaterinburg", "kirov"],
  },
];

function routeWorkLabel(routeCode: string) {
  if (routeCode === "ryazan_wb") return "WB · Рязань / Рыбное";
  if (routeCode === "sarapul_ufa") return "WB · Уфа-Сарапул-Уфа";
  if (routeCode === "ekaterinburg") return "WB · Екатеринбург";
  if (routeCode === "kirov") return "WB · Киров";
  return "направление";
}

function routesForGroup(routes: RouteNeed[], group: typeof workGroups[number]) {
  const byCode = new Map(routes.map(route => [route.route_code, route]));
  return group.routeCodes
    .map(code => byCode.get(code))
    .filter((route): route is RouteNeed => Boolean(route));
}

function fmt(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("ru-RU");
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function fmtPct(value: number | string | null | undefined) {
  return `${Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`;
}

function avitoStatusLabel(status: string | null | undefined) {
  const value = String(status || "unknown").toLowerCase();
  if (value === "active") return "опубликовано";
  if (["paused", "archive", "archived", "closed"].includes(value)) return "снято";
  if (["blocked", "rejected"].includes(value)) return "проблема";
  if (["moderation", "moderating"].includes(value)) return "модерация";
  return value;
}

function avitoStatusClass(status: string | null | undefined) {
  const value = String(status || "unknown").toLowerCase();
  if (value === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (["blocked", "rejected"].includes(value)) return "border-red-500/30 bg-red-500/10 text-red-100";
  if (["moderation", "moderating"].includes(value)) return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-slate-700 bg-slate-900 text-slate-300";
}

const auditActionLabel: Record<NonNullable<AvitoLiveAd["ai_audit"]>["recommended_action"], string> = {
  keep: "Оставить",
  rewrite: "Переписать",
  promote: "Продвинуть",
  unpublish: "Снять",
  duplicate: "Дублировать",
};

const auditCommandByAction: Partial<Record<NonNullable<AvitoLiveAd["ai_audit"]>["recommended_action"], AuditCommandType>> = {
  rewrite: "update_ad",
  promote: "promote_ads",
  unpublish: "unpublish_ads",
  duplicate: "duplicate_ad",
};

const prepareButtonLabel: Record<AuditCommandType, string> = {
  update_ad: "Подготовить переписывание",
  promote_ads: "Подготовить продвижение",
  unpublish_ads: "Подготовить снятие",
  duplicate_ad: "Подготовить дубль",
};

function commandHumanLabel(commandType: string | null | undefined) {
  return commandTypeLabel[String(commandType || "")] || String(commandType || "команда");
}

function auditActionClass(action: NonNullable<AvitoLiveAd["ai_audit"]>["recommended_action"]) {
  if (action === "rewrite") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  if (action === "promote") return "border-blue-500/30 bg-blue-500/10 text-blue-100";
  if (action === "unpublish") return "border-red-500/30 bg-red-500/10 text-red-100";
  if (action === "duplicate") return "border-violet-500/30 bg-violet-500/10 text-violet-100";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
}

function auditScoreClass(score: number) {
  if (score >= 80) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (score >= 60) return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-red-500/30 bg-red-500/10 text-red-100";
}

function isAuditStale(audit: AvitoLiveAd["ai_audit"]) {
  if (!audit?.audited_at) return false;
  return Date.now() - new Date(audit.audited_at).getTime() > 24 * 60 * 60 * 1000;
}

function AiAuditControl({
  ad,
  state = "idle",
  prepareState = "idle",
  preparedCommand,
  compact = false,
  onAudit,
  onPrepare,
  onOpenQueue,
}: {
  ad: AvitoLiveAd;
  state?: AuditState;
  prepareState?: AuditState;
  preparedCommand?: Record<string, any> | null;
  compact?: boolean;
  onAudit: (itemId: string, force?: boolean) => void;
  onPrepare?: (ad: AvitoLiveAd, commandType: AuditCommandType) => void;
  onOpenQueue?: (routeCode?: string) => void;
}) {
  const audit = ad.ai_audit || null;
  const stale = isAuditStale(audit);
  const loading = state === "loading";
  const preparing = prepareState === "loading";
  const commandType = audit ? auditCommandByAction[audit.recommended_action] : null;

  if (!audit) {
    return (
      <button
        data-testid="ai-audit-btn"
        onClick={(event) => {
          event.stopPropagation();
          onAudit(ad.item_id, false);
        }}
        disabled={loading}
        className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-100 hover:bg-blue-500/20 disabled:opacity-60"
      >
        <Sparkles size={13} />
        {loading ? "Проверяю..." : "Проверить ИИ"}
      </button>
    );
  }

  return (
    <details
      className="group"
      onClick={(event) => event.stopPropagation()}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
        <span data-testid="ai-audit-score" className={`rounded border px-2 py-1 text-xs font-semibold ${auditScoreClass(audit.score)}`}>
          ИИ {audit.score}/100
        </span>
        <span className={`rounded border px-2 py-1 text-xs font-semibold ${auditActionClass(audit.recommended_action)}`}>
          {auditActionLabel[audit.recommended_action]}
        </span>
        {stale && (
          <button
            data-testid="ai-audit-recheck"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAudit(ad.item_id, true);
            }}
            disabled={loading}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Обновляю..." : "Перепроверить"}
          </button>
        )}
        {!compact && (
          <span className="text-xs text-slate-500">
            {fmtDateTime(audit.audited_at)}
          </span>
        )}
      </summary>
      <div className="mt-2 rounded border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
        <div className="font-medium text-slate-100">Почему: {audit.rationale}</div>
        {audit.missing_facts?.length > 0 && (
          <div className="mt-2">
            <span className="text-slate-500">Не хватает: </span>
            {audit.missing_facts.join(", ")}
          </div>
        )}
        {audit.headline_issues?.length > 0 && (
          <div className="mt-2">
            <div className="text-slate-500">Заголовок:</div>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {audit.headline_issues.map(issue => <li key={issue}>{issue}</li>)}
            </ul>
          </div>
        )}
        {audit.body_issues?.length > 0 && (
          <div className="mt-2">
            <div className="text-slate-500">Текст:</div>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {audit.body_issues.map(issue => <li key={issue}>{issue}</li>)}
            </ul>
          </div>
        )}
        {(audit.suggested_title || audit.suggested_first_screen || audit.suggested_full_text) && (
          <details className="mt-2">
            <summary className="cursor-pointer text-blue-200">Показать вариант ИИ</summary>
            {audit.suggested_title && (
              <div className="mt-2 font-semibold text-white">{audit.suggested_title}</div>
            )}
            {audit.suggested_first_screen && (
              <div className="mt-2 whitespace-pre-line text-slate-200">{audit.suggested_first_screen}</div>
            )}
            {audit.suggested_full_text && (
              <div className="mt-2 max-h-52 overflow-auto whitespace-pre-line rounded border border-slate-800 bg-slate-900 p-2 text-slate-300">
                {audit.suggested_full_text}
              </div>
            )}
          </details>
        )}
        <div className="mt-2 text-slate-500">
          Модель: {audit.provider === "fallback" ? "резервный парсер" : audit.model || "ИИ"}
        </div>
        {preparedCommand ? (
          <div data-testid="ai-prepared-command" className="mt-3 flex flex-wrap items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-2 text-emerald-100">
            <CheckCircle2 size={14} />
            <span>Подготовлено: команда #{preparedCommand.id}</span>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenQueue?.(preparedCommand.route_code || preparedCommand.payload?.route_code);
              }}
              className="rounded border border-emerald-400/30 px-2 py-1 text-xs hover:bg-emerald-500/10"
            >
              Открыть очередь
            </button>
          </div>
        ) : commandType ? (
          <button
            type="button"
            data-testid="ai-prepare-command-btn"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onPrepare?.(ad, commandType);
            }}
            disabled={preparing}
            className={`mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-60 ${
              commandType === "unpublish_ads"
                ? "border border-red-500/40 bg-red-500/10 text-red-100 hover:bg-red-500/20"
                : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
            }`}
          >
            <ClipboardList size={14} />
            {preparing ? "Готовлю..." : prepareButtonLabel[commandType]}
          </button>
        ) : (
          <div className="mt-3 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-2 text-emerald-100">
            ИИ предлагает оставить объявление как есть.
          </div>
        )}
      </div>
    </details>
  );
}

function priorityClass(priority: RouteNeed["priority"]) {
  if (priority === "critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (priority === "high") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (priority === "medium") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (priority === "low") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function DeficitCell({ horizon }: { horizon: Horizon }) {
  const value = horizon.to_hire;
  const hasWarning = horizon.data_quality !== "high";
  return (
    <div className="flex items-center justify-end gap-1">
      {hasWarning && (
        <AlertTriangle
          size={14}
          className={horizon.data_quality === "low" ? "text-red-300" : "text-amber-300"}
        />
      )}
      <span className={value > 0 ? "font-semibold text-red-300" : "text-emerald-300"}>
        {value > 0 ? `-${value}` : "0"}
      </span>
    </div>
  );
}

function routeMainLine(route: RouteNeed) {
  if (route.today.to_hire > 0) {
    return `Не хватает ${fmt(route.today.to_hire)} ${route.today.to_hire === 1 ? "водителя" : "водителей"}`;
  }
  if (route.avito?.ads_count > 0) {
    return "Набор можно проверить";
  }
  return "Сейчас спокойно";
}

function routeHelpLine(route: RouteNeed) {
  if (route.today.to_hire > 0) {
    return "Нажмите «Нужны водители» или «Мало звонков».";
  }
  if (route.avito?.ads_count > 0) {
    return "Если люди больше не нужны, нажмите «Стоп набор».";
  }
  return "Действий сейчас не требуется.";
}

function routeRecommendedAction(route: RouteNeed): QuickAction {
  if (route.today.to_hire > 0) return "need";
  if (route.avito?.ads_count > 0) return "stop";
  return "need";
}

function routeRecommendedText(route: RouteNeed) {
  const action = routeRecommendedAction(route);
  if (action === "need") return "ЖМИ: Нужны водители";
  if (action === "stop") return "Если людей хватает: Стоп набор";
  return "ЖМИ: Мало звонков";
}

function routeCardTone(route: RouteNeed, active: boolean) {
  if (active) return "border-blue-400 bg-blue-500/15";
  if (route.today.to_hire > 0) return "border-red-500/40 bg-red-500/10";
  if (route.avito?.ads_count > 0) return "border-amber-500/30 bg-amber-500/10";
  return "border-slate-800 bg-slate-950";
}

function getCommandDraft(command: Record<string, any> | null | undefined) {
  return command?.payload?.ad_draft || command?.result?.plan?.ad_draft || null;
}

function getCommandTargetItems(command: Record<string, any> | null | undefined, liveAds: AvitoLiveAd[] = []) {
  const payload = command?.payload || {};
  const targetIds = (payload.target_item_ids || command?.result?.plan?.target_item_ids || []).map(String);
  const stats = payload.avito_summary?.vacancy_stats || [];
  const statsById = new Map(stats.map((item: any) => [String(item.item_id), item]));
  const liveById = new Map(liveAds.map(item => [String(item.item_id), item]));
  if (targetIds.length > 0) {
    return targetIds.map((id: string) => liveById.get(id) || statsById.get(id) || { item_id: id, title: `Объявление ${id}`, status: "unknown", views: 0, contacts: 0, conversion_pct: 0 });
  }
  if (liveAds.length > 0) return liveAds;
  return stats.slice(0, 3);
}

function getRecommendedBudget(command: Record<string, any> | null | undefined) {
  const items = (command?.result?.api_results || [])
    .flatMap((result: any) => result.response?.data?.items || []);
  const firstItem = items[0];
  if (!firstItem) return null;
  const budget = (firstItem.budgets || []).find((row: any) => row.isRecommended) || firstItem.budgets?.[0];
  if (!budget) return null;
  return {
    price: budget.price,
    days: firstItem.duration?.recommended || firstItem.duration?.from || null,
  };
}

function getTextChecks(draft: Record<string, any> | null | undefined): TextCheck[] {
  const text = `${draft?.title || ""}\n${draft?.first_screen || ""}\n${draft?.text || ""}`;
  return [
    { label: "оплата указана", ok: /(\d[\d\s]*\s*₽|руб|оплат)/i.test(text) },
    { label: "маршрут указан", ok: /(маршрут|WB|Wildberries|Уфа|Сарапул|Рязань|Киров|Екатеринбург)/i.test(text) },
    { label: "график указан", ok: /(график|30\/30|14\/14|вахт)/i.test(text) },
    { label: "лишняя работа снята", ok: /(не груз|не выгруж|не ремонт|без погруз|без разгруз)/i.test(text) },
    { label: "документы понятны", ok: /(СКЗИ|категор|права)/i.test(text) },
  ];
}

function Metric({
  title,
  value,
  hint,
  icon: Icon,
  testId,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon: any;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon size={15} className="text-blue-300" />
        {title}
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function formatRublesFromKopecks(value: number | string | null | undefined) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "—";
  return `${Math.round(number / 100).toLocaleString("ru-RU")} ₽`;
}

function BbipSuggestions({
  command,
  approving,
  onApprove,
}: {
  command: Record<string, any>;
  approving?: boolean;
  onApprove?: (commandId: number) => void;
}) {
  const stats = command.payload?.avito_summary?.vacancy_stats || [];
  const titleByItemId = new Map(stats.map((row: any) => [String(row.item_id), row.title]));
  const items = (command.result?.api_results || []).flatMap((result: any) => result.response?.data?.items || []);
  const approval = command.result?.promotion_approval;

  if (!items.length) return null;

  return (
    <div className="mt-2 rounded border border-blue-500/20 bg-blue-500/10 px-2 py-2 text-xs text-blue-100">
      <div className="font-medium text-blue-50">Варианты продвижения от Авито</div>
      <div className="mt-2 space-y-1">
        {items.slice(0, 4).map((item: any) => {
          const budget = (item.budgets || []).find((row: any) => row.isRecommended) || item.budgets?.[0];
          return (
            <div key={item.itemId} className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-950/70 px-2 py-1">
              <span className="max-w-[260px] truncate text-slate-200">
                {titleByItemId.get(String(item.itemId)) || `Avito ID ${item.itemId}`}
              </span>
              <span className="text-blue-200">
                {formatRublesFromKopecks(budget?.price)} · {item.duration?.recommended || item.duration?.from || "—"} дн.
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-blue-200/80">
        Платное продвижение не запускается автоматически: нужен выбор бюджета и подтверждение руководителя.
      </div>
      {approval ? (
        <div className="mt-2 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-100">
          Бюджет выбран: {formatRublesFromKopecks(approval.estimated_total_kopecks)} ориентир за период. Автосписание выключено.
        </div>
      ) : onApprove ? (
        <button
          onClick={() => onApprove(Number(command.id))}
          disabled={approving}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-blue-400/30 bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-100 hover:bg-blue-400/20 disabled:opacity-60"
        >
          <CheckCircle2 size={13} />
          {approving ? "Сохраняю..." : "Подтвердить рекомендованный бюджет"}
        </button>
      ) : null}
    </div>
  );
}

function AvitoCommandQueue({
  commands,
  states,
  onApprove,
  onDecline,
}: {
  commands: Array<Record<string, any>>;
  states: Record<string, AuditState>;
  onApprove: (commandId: number) => void;
  onDecline: (commandId: number) => void;
}) {
  const active = (commands || []).filter(command => ["needs_review", "queued"].includes(command.status));

  return (
    <section data-testid="avito-command-queue" className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Очередь действий по объявлениям</div>
          <div className="mt-1 text-xs text-slate-500">
            Здесь лежат подготовленные ИИ действия. Авито меняется только после отдельного запуска.
          </div>
        </div>
        <span className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">
          {fmt(active.length)} активн.
        </span>
      </div>

      {active.length === 0 ? (
        <div className="mt-3 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
          Пока нет подготовленных действий. Откройте ИИ-аудит объявления и нажмите «Подготовить...».
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {active.map(command => {
            const payload = command.payload || {};
            const proposed = payload.proposed || {};
            const current = payload.current || {};
            const audit = payload.ai_audit_snapshot || {};
            const busy = states[String(command.id)] === "loading";
            return (
              <article key={command.id} className="rounded border border-slate-800 bg-slate-900 p-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">
                        #{command.id} · {commandHumanLabel(command.command_type)}
                      </span>
                      <span className={`rounded border px-2 py-0.5 text-xs ${
                        command.status === "queued"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-100"
                      }`}>
                        {commandStatusLabel[command.status] || command.status}
                      </span>
                      {audit.score !== undefined && (
                        <span className={`rounded border px-2 py-0.5 text-xs ${auditScoreClass(Number(audit.score || 0))}`}>
                          ИИ {audit.score}/100
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      item_id: {payload.target_item_id || "—"} · создано {fmtDateTime(command.created_at)}
                    </div>
                    {current.title && (
                      <div className="mt-2 text-sm text-slate-300">
                        Сейчас: <span className="text-slate-100">{current.title}</span>
                      </div>
                    )}
                    {proposed.title && (
                      <div className="mt-1 text-sm text-emerald-100">
                        Предлагаем: <span className="font-semibold">{proposed.title}</span>
                      </div>
                    )}
                    {proposed.full_text && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-blue-200">Показать предложенный текст</summary>
                        <div className="mt-2 max-h-56 overflow-auto whitespace-pre-line rounded border border-slate-800 bg-slate-950 p-2 text-xs text-slate-300">
                          {proposed.full_text}
                        </div>
                      </details>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {command.status === "needs_review" ? (
                      <>
                        <button
                          data-testid="avito-command-approve"
                          onClick={() => onApprove(Number(command.id))}
                          disabled={busy}
                          className="inline-flex min-h-9 items-center gap-1 rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                        >
                          <CheckCircle2 size={14} />
                          {busy ? "Сохраняю..." : "Одобрить"}
                        </button>
                        <button
                          data-testid="avito-command-decline"
                          onClick={() => onDecline(Number(command.id))}
                          disabled={busy}
                          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                        >
                          <PauseCircle size={14} />
                          Отклонить
                        </button>
                      </>
                    ) : (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                        Одобрено, ждёт запуска
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CommandReviewPanel({
  detail,
  loading,
  onCopy,
  copiedCommandId,
  auditStates,
  prepareStates,
  preparedCommands,
  commandDecisionStates,
  onAudit,
  onPrepare,
  onOpenQueue,
  onApproveCommand,
  onDeclineCommand,
}: {
  detail: Detail | null;
  loading: boolean;
  onCopy: (commandId: number, title?: string, text?: string) => void;
  copiedCommandId: number | null;
  auditStates: Record<string, AuditState>;
  prepareStates: Record<string, AuditState>;
  preparedCommands: Record<string, Record<string, any>>;
  commandDecisionStates: Record<string, AuditState>;
  onAudit: (itemId: string, force?: boolean) => void;
  onPrepare: (ad: AvitoLiveAd, commandType: AuditCommandType) => void;
  onOpenQueue: (routeCode?: string) => void;
  onApproveCommand: (commandId: number) => void;
  onDeclineCommand: (commandId: number) => void;
}) {
  const command = detail?.avito_commands?.find(item => ["queued", "needs_review"].includes(item.status))
    || detail?.avito_commands?.[0]
    || null;
  const draft = getCommandDraft(command);
  const liveAds = detail?.avito?.live_ads || [];
  const targetItems = getCommandTargetItems(command, liveAds);
  const budget = getRecommendedBudget(command);
  const checks = getTextChecks(draft);

  return (
    <section data-testid="command-review-panel" className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Что на проверке</div>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {detail?.route_label || "Направление"}
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Здесь видно реальные объявления Авито по направлению, свежую статистику и вспомогательный черновик.
          </p>
        </div>
        <span className="w-fit rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100">
          деньги не списаны
        </span>
      </div>

      {loading && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
          Загружаю команду...
        </div>
      )}

      {!loading && !command && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
          По этому направлению пока нет команды на проверке.
        </div>
      )}

      {!loading && command && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-white">Реальные объявления Авито</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Источник: свежий snapshot, обновлён {fmtDateTime(detail?.avito?.snapshot_generated_at)}
                  </div>
                </div>
                <span className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">
                  {fmt(targetItems.length)} шт.
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {targetItems.length === 0 ? (
                  <div className="rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                    По этому направлению в свежем снимке Авито объявлений нет. Черновик ниже нужен только если создаём новое.
                  </div>
                ) : targetItems.map((item: any) => (
                  <div key={String(item.item_id)} className="rounded border border-slate-800 bg-slate-900 px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-white">{item.title || `Объявление ${item.item_id}`}</div>
                        {item.address && <div className="mt-1 text-xs text-slate-500">{item.address}</div>}
                      </div>
                      <span className={`rounded border px-2 py-0.5 text-xs ${avitoStatusClass(item.status)}`}>
                        {avitoStatusLabel(item.status)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                      <span>№ {item.item_id}</span>
                      <span>{fmt(item.views)} просмотров</span>
                      <span>{fmt(item.contacts)} контактов</span>
                      <span>{fmtPct(item.conversion_pct)} конверсия</span>
                      {item.favorites !== undefined && <span>{fmt(item.favorites)} избранное</span>}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-200 hover:text-blue-100"
                        >
                          на Авито <ArrowUpRight size={12} />
                        </a>
                      )}
                    </div>
                    <div className="mt-3">
                      <AiAuditControl
                        ad={item}
                        state={auditStates[String(item.item_id)] || "idle"}
                        prepareState={prepareStates[String(item.item_id)] || "idle"}
                        preparedCommand={preparedCommands[String(item.item_id)] || null}
                        onAudit={onAudit}
                        onPrepare={onPrepare}
                        onOpenQueue={onOpenQueue}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Платное продвижение только после подтверждения бюджета руководителем.
              </div>
              {budget && (
                <div className="mt-2 text-sm text-blue-100">
                  Авито предложил ориентир: {formatRublesFromKopecks(budget.price)}
                  {budget.days ? ` на ${budget.days} дн.` : ""}.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
              <div className="text-sm font-semibold text-white">Проверка текста</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {checks.map(check => (
                  <span
                    key={check.label}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      check.ok
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                        : "border-red-500/30 bg-red-500/10 text-red-100"
                    }`}
                  >
                    {check.ok ? "✓" : "!"} {check.label}
                  </span>
                ))}
              </div>
              <div className="mt-3 text-xs text-slate-400">
                Это быстрая проверка фактов в тексте. Финальное решение всё равно принимает человек.
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Черновик объявления</div>
                <div className="mt-1 text-xs text-slate-400">
                  {draft?.facts_status === "ready_to_publish" ? "Факты заполнены, можно отдавать на проверку руководителю." : "Нужны уточнения перед публикацией."}
                </div>
              </div>
              {draft?.text && command.id && (
                <button
                  onClick={() => onCopy(Number(command.id), draft.title, draft.text)}
                  className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <ClipboardList size={15} />
                  {copiedCommandId === Number(command.id) ? "Скопировано" : "Скопировать"}
                </button>
              )}
            </div>
            {draft ? (
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
                <div className="font-semibold text-white">{draft.title}</div>
                {draft.first_screen && (
                  <div className="mt-3 whitespace-pre-line text-slate-200">{draft.first_screen}</div>
                )}
                {draft.text && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-blue-200">Показать полный текст</summary>
                    <div className="mt-3 max-h-72 overflow-auto whitespace-pre-line rounded border border-slate-800 bg-slate-950 p-3 text-slate-300">
                      {draft.text}
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
                Черновик объявления пока не собран.
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && detail && (
        <AvitoCommandQueue
          commands={detail.avito_commands || []}
          states={commandDecisionStates}
          onApprove={onApproveCommand}
          onDecline={onDeclineCommand}
        />
      )}
    </section>
  );
}

export default function DriverResourcePage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [recommendations, setRecommendations] = useState<HiringRecommendation[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [hireFormOpen, setHireFormOpen] = useState(false);
  const [aiFormOpen, setAiFormOpen] = useState(false);
  const [savingExit, setSavingExit] = useState(false);
  const [savingHiringRequest, setSavingHiringRequest] = useState(false);
  const [savingAiCommand, setSavingAiCommand] = useState(false);
  const [executingCommandId, setExecutingCommandId] = useState<number | null>(null);
  const [approvingCommandId, setApprovingCommandId] = useState<number | null>(null);
  const [copiedCommandId, setCopiedCommandId] = useState<number | null>(null);
  const [applyingRecommendations, setApplyingRecommendations] = useState(false);
  const [quickSubmitting, setQuickSubmitting] = useState<string | null>(null);
  const [quickSuccess, setQuickSuccess] = useState<Record<string, any> | null>(null);
  const [reviewRouteCode, setReviewRouteCode] = useState<string>("");
  const [auditStates, setAuditStates] = useState<Record<string, AuditState>>({});
  const [prepareStates, setPrepareStates] = useState<Record<string, AuditState>>({});
  const [preparedCommands, setPreparedCommands] = useState<Record<string, Record<string, any>>>({});
  const [commandDecisionStates, setCommandDecisionStates] = useState<Record<string, AuditState>>({});
  const [aiCommandText, setAiCommandText] = useState("");
  const [aiResult, setAiResult] = useState<Record<string, any> | null>(null);
  const [exitForm, setExitForm] = useState({
    driver_full_name: "",
    normalized_phone: "",
    left_date: new Date().toISOString().slice(0, 10),
    route_code: "sarapul_ufa",
    vehicle_number: "",
    mechanic_name: "",
    exit_reason: "schedule",
    exit_initiator: "driver",
    days_worked: "",
    eligible_for_return: "",
    return_comment: "",
    comment: "",
  });
  const [hireForm, setHireForm] = useState({
    request_type: "need_drivers",
    route_code: "sarapul_ufa",
    requested_driver_count: "1",
    urgency: "high",
    requested_by_name: "",
    reason: "",
  });

  const selectedRoute = useMemo(
    () => data?.routes?.find(route => route.route_code === selected) || null,
    [data, selected],
  );

  const actionableRecommendations = useMemo(
    () => recommendations.filter(item => item.can_apply && item.request_type === "need_drivers"),
    [recommendations],
  );

  const reduceRecommendations = useMemo(
    () => recommendations.filter(item => item.can_apply && item.request_type === "reduce_hiring"),
    [recommendations],
  );

  const visibleRecommendations = useMemo(
    () => recommendations.filter(item => item.action !== "none" || item.existing_command).slice(0, 5),
    [recommendations],
  );

  const loadRecommendations = async () => {
    setRecommendationsLoading(true);
    try {
      const res = await fetch("/api/hr/driver-resource/recommendations", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка рекомендаций");
      setRecommendations(json.recommendations || []);
    } catch (err: any) {
      setError(err.message || "Ошибка рекомендаций");
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const load = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hr/driver-resource${force ? "?force=1" : ""}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
      setData(json);
      const first = selected || json.routes?.[0]?.route_code || "";
      if (first) {
        setSelected(first);
        await Promise.all([loadDetail(first), loadRecommendations()]);
      } else {
        await loadRecommendations();
      }
    } catch (err: any) {
      setError(err.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (routeCode: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/hr/driver-resource/${routeCode}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка детализации");
      setDetail(json);
      setExitForm(prev => ({ ...prev, route_code: routeCode }));
      setHireForm(prev => ({
        ...prev,
        route_code: routeCode,
        requested_driver_count: String(Math.max(1, json.need?.today?.to_hire || 1)),
      }));
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  const totals = useMemo(() => {
    const routes = data?.routes || [];
    return {
      toHireToday: routes.reduce((sum, row) => sum + row.today.to_hire, 0),
      toHire7: routes.reduce((sum, row) => sum + row.d7.to_hire, 0),
      callNow: routes.reduce((sum, row) => sum + Number(row.avito?.call_now || 0), 0),
      avitoCandidates: routes.reduce((sum, row) => sum + Number(row.avito?.candidates || 0), 0),
    };
  }, [data]);

  const selectRoute = async (routeCode: string) => {
    setSelected(routeCode);
    await loadDetail(routeCode);
  };

  const openCommandReview = async (routeCode: string) => {
    setReviewRouteCode(routeCode);
    await selectRoute(routeCode);
  };

  const updateAdAuditInDashboard = (itemId: string, aiAudit: NonNullable<AvitoLiveAd["ai_audit"]>) => {
    const patchAds = (ads?: AvitoLiveAd[]) => (ads || []).map(ad => (
      String(ad.item_id) === String(itemId) ? { ...ad, ai_audit: aiAudit } : ad
    ));
    const patchRoute = (route: RouteNeed): RouteNeed => ({
      ...route,
      avito: {
        ...route.avito,
        live_ads: patchAds(route.avito?.live_ads),
        vacancy_stats: patchAds(route.avito?.vacancy_stats),
      },
    });

    setData(prev => prev ? {
      ...prev,
      routes: (prev.routes || []).map(patchRoute),
    } : prev);

    setDetail(prev => prev ? {
      ...prev,
      need: patchRoute(prev.need),
      avito: {
        ...prev.avito,
        live_ads: patchAds(prev.avito?.live_ads),
        vacancy_stats: patchAds(prev.avito?.vacancy_stats),
      },
    } : prev);
  };

  const auditAvitoAd = async (itemId: string, force = false) => {
    if (!itemId) return;
    setAuditStates(prev => ({ ...prev, [itemId]: "loading" }));
    setError(null);
    try {
      const res = await fetch("/api/hr/avito/audit-ad", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, force }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось проверить объявление ИИ");
      updateAdAuditInDashboard(itemId, json.ai_audit);
      setAuditStates(prev => ({ ...prev, [itemId]: "idle" }));
    } catch (err: any) {
      setAuditStates(prev => ({ ...prev, [itemId]: "error" }));
      setError(err.message || "Не удалось проверить объявление ИИ");
    }
  };

  const upsertDetailCommand = (command: Record<string, any>) => {
    if (!command?.id) return;
    setDetail(prev => {
      if (!prev) return prev;
      const commands = prev.avito_commands || [];
      const exists = commands.some(item => Number(item.id) === Number(command.id));
      const nextCommands = exists
        ? commands.map(item => Number(item.id) === Number(command.id) ? command : item)
        : [command, ...commands];
      return {
        ...prev,
        avito_commands: nextCommands,
      };
    });
  };

  const prepareCommandFromAudit = async (ad: AvitoLiveAd, commandType: AuditCommandType) => {
    const itemId = String(ad.item_id || "");
    if (!itemId) return;
    setPrepareStates(prev => ({ ...prev, [itemId]: "loading" }));
    setError(null);
    try {
      const res = await fetch("/api/hr/avito/prepare-command-from-audit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: itemId,
          command_type: commandType,
          use_suggested: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось подготовить команду");
      if (json.command) {
        upsertDetailCommand(json.command);
        setPreparedCommands(prev => ({ ...prev, [itemId]: json.command }));
        if (json.command.route_code) setReviewRouteCode(json.command.route_code);
      }
      setPrepareStates(prev => ({ ...prev, [itemId]: "idle" }));
    } catch (err: any) {
      setPrepareStates(prev => ({ ...prev, [itemId]: "error" }));
      setError(err.message || "Не удалось подготовить команду");
    }
  };

  const openQueueForRoute = async (routeCode?: string) => {
    const nextRouteCode = routeCode || reviewRouteCode || selected;
    if (!nextRouteCode) return;
    setReviewRouteCode(nextRouteCode);
    await selectRoute(nextRouteCode);
  };

  const approveAvitoCommand = async (commandId: number) => {
    setCommandDecisionStates(prev => ({ ...prev, [String(commandId)]: "loading" }));
    setError(null);
    try {
      const res = await fetch(`/api/hr/driver-resource/avito-commands/${commandId}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось одобрить команду");
      if (json.command) upsertDetailCommand(json.command);
      setCommandDecisionStates(prev => ({ ...prev, [String(commandId)]: "idle" }));
    } catch (err: any) {
      setCommandDecisionStates(prev => ({ ...prev, [String(commandId)]: "error" }));
      setError(err.message || "Не удалось одобрить команду");
    }
  };

  const declineAvitoCommand = async (commandId: number) => {
    setCommandDecisionStates(prev => ({ ...prev, [String(commandId)]: "loading" }));
    setError(null);
    try {
      const res = await fetch(`/api/hr/driver-resource/avito-commands/${commandId}/decline`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Отклонено из очереди найма" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось отклонить команду");
      if (json.command) upsertDetailCommand(json.command);
      setCommandDecisionStates(prev => ({ ...prev, [String(commandId)]: "idle" }));
    } catch (err: any) {
      setCommandDecisionStates(prev => ({ ...prev, [String(commandId)]: "error" }));
      setError(err.message || "Не удалось отклонить команду");
    }
  };

  const submitQuickRequest = async (route: RouteNeed, action: QuickAction) => {
    const key = `${route.route_code}:${action}`;
    const requestedCount = action === "stop" ? 0 : Math.max(1, Number(route.today?.to_hire || 1));
    setQuickSubmitting(key);
    setQuickSuccess(null);
    setError(null);
    setSelected(route.route_code);
    try {
      const res = await fetch("/api/hr/hiring-request/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route_code: route.route_code,
          action,
          requested_driver_count: requestedCount,
          comment: `${route.route_label}: ${quickActionLabel[action]}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось отправить заявку");
      setQuickSuccess({
        ...json,
        route_code: route.route_code,
        route_label: json.route_label || route.route_label,
        message: "Заявка отправлена. ИИ собрал команду и черновик объявления.",
      });
      setQuickSubmitting(null);
      await load(false);
      await loadDetail(route.route_code);
      await loadRecommendations();
      setReviewRouteCode(route.route_code);
    } catch (err: any) {
      setError(err.message || "Не удалось отправить заявку");
    } finally {
      setQuickSubmitting(null);
    }
  };

  const saveExit = async () => {
    if (!exitForm.driver_full_name || !exitForm.eligible_for_return) {
      setError("Для ухода водителя нужны ФИО и решение, можно ли брать обратно");
      return;
    }
    setSavingExit(true);
    setError(null);
    try {
      const res = await fetch("/api/hr/driver-resource/manual-exits", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exitForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось сохранить уход");
      setFormOpen(false);
      setExitForm(prev => ({ ...prev, driver_full_name: "", normalized_phone: "", vehicle_number: "", comment: "", return_comment: "", eligible_for_return: "" }));
      await loadDetail(selected);
    } catch (err: any) {
      setError(err.message || "Не удалось сохранить уход");
    } finally {
      setSavingExit(false);
    }
  };

  const openHiringRequest = (type: "need_drivers" | "stop_hiring") => {
    const route = detail?.need || data?.routes?.find(row => row.route_code === selected);
    setHireForm(prev => ({
      ...prev,
      request_type: type,
      route_code: selected || prev.route_code,
      requested_driver_count: type === "need_drivers" ? String(Math.max(1, route?.today?.to_hire || 1)) : "0",
      urgency: type === "need_drivers" ? "high" : "normal",
      reason: type === "need_drivers" ? "Нужны водители на направление" : "Набор по направлению нужно остановить",
    }));
    setHireFormOpen(true);
  };

  const openAiCommand = () => {
    const route = detail?.need || selectedRoute;
    const label = route?.route_label || "выбранное направление";
    const need = route?.today?.to_hire || 1;
    setAiCommandText(`Нужно ${Math.max(1, need)} водителя на ${label}, объявления усилить`);
    setAiResult(null);
    setAiFormOpen(true);
  };

  const saveHiringRequest = async () => {
    if (!hireForm.route_code || !hireForm.request_type) {
      setError("Выберите направление и тип заявки");
      return;
    }
    if (hireForm.request_type === "need_drivers" && Number(hireForm.requested_driver_count || 0) <= 0) {
      setError("Укажите количество водителей");
      return;
    }
    setSavingHiringRequest(true);
    setError(null);
    try {
      const res = await fetch("/api/hr/driver-resource/hiring-requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...hireForm,
          requested_driver_count: Number(hireForm.requested_driver_count || 0),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось создать заявку");
      setHireFormOpen(false);
      await loadDetail(selected || hireForm.route_code);
      await load(false);
      await loadRecommendations();
    } catch (err: any) {
      setError(err.message || "Не удалось создать заявку");
    } finally {
      setSavingHiringRequest(false);
    }
  };

  const saveAiCommand = async () => {
    if (!aiCommandText.trim()) {
      setError("Напишите команду для ИИ");
      return;
    }
    setSavingAiCommand(true);
    setError(null);
    try {
      const res = await fetch("/api/hr/driver-resource/ai/hiring-command", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: aiCommandText,
          route_code: selected || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "ИИ не смог обработать команду");
      setAiResult(json);
      if (!json.needs_review) {
        setAiFormOpen(false);
        await loadDetail(selected || json.request?.route_code || "sarapul_ufa");
        await load(false);
        await loadRecommendations();
      }
    } catch (err: any) {
      setError(err.message || "ИИ не смог обработать команду");
    } finally {
      setSavingAiCommand(false);
    }
  };

  const executeAvitoCommand = async (commandId: number) => {
    setExecutingCommandId(commandId);
    setError(null);
    try {
      const res = await fetch(`/api/hr/driver-resource/avito-commands/${commandId}/execute`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось проверить команду Авито");
      if (selected) await loadDetail(selected);
      await loadRecommendations();
    } catch (err: any) {
      setError(err.message || "Не удалось проверить команду Авито");
    } finally {
      setExecutingCommandId(null);
    }
  };

  const approvePromotion = async (commandId: number) => {
    setApprovingCommandId(commandId);
    setError(null);
    try {
      const res = await fetch(`/api/hr/driver-resource/avito-commands/${commandId}/approve-promotion`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_recommended: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось подтвердить бюджет");
      if (selected) await loadDetail(selected);
      await loadRecommendations();
    } catch (err: any) {
      setError(err.message || "Не удалось подтвердить бюджет");
    } finally {
      setApprovingCommandId(null);
    }
  };

  const copyAdText = async (commandId: number, title?: string, text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(`${title ? `${title}\n\n` : ""}${text}`);
      setCopiedCommandId(commandId);
      window.setTimeout(() => setCopiedCommandId(prev => (prev === commandId ? null : prev)), 1800);
    } catch (err: any) {
      setError(err.message || "Не удалось скопировать текст объявления");
    }
  };

  const applySystemRecommendations = async (options: { includeReduce?: boolean; routeCodes?: string[] } = {}) => {
    setApplyingRecommendations(true);
    setError(null);
    try {
      const res = await fetch("/api/hr/driver-resource/recommendations/apply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          execute_readonly: true,
          include_reduce: options.includeReduce === true,
          route_codes: options.routeCodes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось создать команды");
      await loadRecommendations();
      await load(false);
      if (selected) await loadDetail(selected);
    } catch (err: any) {
      setError(err.message || "Не удалось создать команды");
    } finally {
      setApplyingRecommendations(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section data-testid="driver-resource-pult" className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Найм водителей</h1>
            <p className="mt-2 max-w-2xl text-base text-slate-300">
              Не надо разбираться в аналитике. Смотрите на карточку маршрута и нажимайте большую подсказанную кнопку.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Metric testId="metric-needed-today" title="Нужно сегодня" value={fmt(totals.toHireToday)} hint="по всем направлениям" icon={ShieldAlert} />
          <Metric testId="metric-call-now" title="Звонить сейчас" value={fmt(totals.callNow)} hint="кандидаты в срочной очереди" icon={CheckCircle2} />
        </div>

        <div data-testid="what-to-press" className="rounded-lg border border-blue-400/30 bg-blue-500/10 p-4">
          <div className="text-lg font-semibold text-white">Что нажимать</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <div className="text-sm text-slate-300">Машины стоят, людей не хватает</div>
              <div className="mt-1 text-xl font-semibold text-emerald-200">Нужны водители</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <div className="text-sm text-slate-300">Объявления есть, звонков мало</div>
              <div className="mt-1 text-xl font-semibold text-blue-200">Мало звонков</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <div className="text-sm text-slate-300">Люди больше не нужны</div>
              <div className="mt-1 text-xl font-semibold text-amber-200">Стоп набор</div>
            </div>
          </div>
        </div>

        {quickSuccess && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={20} />
              <div className="min-w-0">
                <div className="font-semibold">{quickSuccess.message}</div>
                <div className="mt-1 text-sm text-emerald-200/80">
                  Направление: {quickSuccess.route_label}.
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                  <div className="rounded-lg border border-emerald-400/20 bg-slate-950/50 p-3">
                    <div className="text-xs uppercase tracking-wide text-emerald-200/60">Куда ушло</div>
                    <div className="mt-1 font-semibold text-white">
                      Журнал заявок #{quickSuccess.request?.id || "создан"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-emerald-400/20 bg-slate-950/50 p-3">
                    <div className="text-xs uppercase tracking-wide text-emerald-200/60">Что создано</div>
                    <div className="mt-1 font-semibold text-white">
                      Команда Авито #{quickSuccess.command?.id || "создана"} · на проверке
                    </div>
                  </div>
                  <div className="rounded-lg border border-emerald-400/20 bg-slate-950/50 p-3">
                    <div className="text-xs uppercase tracking-wide text-emerald-200/60">Telegram</div>
                    <div className="mt-1 font-semibold text-white">
                      {quickSuccess.telegram?.skipped
                        ? "не отправлялся"
                        : Number(quickSuccess.telegram?.sent || 0) > 0
                          ? "отправлен в канал"
                          : "не подтвердился"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-blue-400/25 bg-blue-500/10 px-3 py-2 text-sm text-blue-100">
                  Следующий шаг: откройте проверку, посмотрите текст объявления и связанные объявления. В Авито пока ничего не опубликовано, деньги не списаны.
                </div>
                <button
                  onClick={() => openCommandReview(quickSuccess.request?.route_code || quickSuccess.route_code)}
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
                >
                  Открыть проверку этой заявки
                </button>
                {quickSuccess.ad_draft && (
                  <div className="mt-3 max-w-2xl rounded-lg border border-emerald-400/20 bg-slate-950/50 p-3 text-sm">
                    <div className="font-semibold text-white">{quickSuccess.ad_draft.title}</div>
                    {quickSuccess.ad_draft.first_screen && (
                      <div className="mt-2 whitespace-pre-line text-emerald-100/85">
                        {quickSuccess.ad_draft.first_screen}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <section className="space-y-4">
          {workGroups.map(group => {
            const groupRoutes = routesForGroup((data?.routes || []).filter(route => route.route_code !== "reserve_pool"), group);
            if (groupRoutes.length === 0) return null;
            return (
              <div key={group.code} data-testid={`work-group-${group.code}`} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <div className="mb-3">
                  <h2 className="text-lg font-semibold text-white">{group.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{group.subtitle}</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {groupRoutes.map(route => {
                    const active = selected === route.route_code;
                    const command = recommendations.find(item => item.route_code === route.route_code)?.existing_command;
                    return (
                      <article
                        data-testid={`route-card-${route.route_code}`}
                        key={route.route_code}
                        onClick={() => selectRoute(route.route_code)}
                        className={`rounded-lg border p-4 transition hover:border-blue-400/60 ${routeCardTone(route, active)}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="mb-2 inline-flex rounded-md border border-slate-700/80 px-2 py-1 text-xs text-slate-300">
                              {routeWorkLabel(route.route_code)}
                            </div>
                            <h3 className="text-xl font-semibold text-white">{route.route_label}</h3>
                            <div className={`mt-2 text-2xl font-semibold ${route.today.to_hire > 0 ? "text-red-200" : "text-emerald-200"}`}>
                              {routeMainLine(route)}
                            </div>
                            <p className="mt-2 text-sm text-slate-300">{routeHelpLine(route)}</p>
                            <div className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-base font-semibold text-emerald-100">
                              {routeRecommendedText(route)}
                            </div>
                          </div>
                          {command && (
                            <button
                              data-testid={`route-review-${route.route_code}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                openCommandReview(route.route_code);
                              }}
                              className="shrink-0 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-100 hover:bg-blue-500/20"
                              title="Посмотреть объявления и текст"
                            >
                              что на проверке?
                            </button>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-300">
                          <span className="rounded border border-slate-700/80 px-2 py-1">{fmt(route.avito?.ads_count)} объявл.</span>
                          <span className="rounded border border-slate-700/80 px-2 py-1">{fmt(route.avito?.views)} просмотров</span>
                          <span className="rounded border border-slate-700/80 px-2 py-1">{fmt(route.avito?.contacts)} конт.</span>
                          <span className="rounded border border-slate-700/80 px-2 py-1">{fmtPct(route.avito?.conversion_pct)} конв.</span>
                          <span className="rounded border border-slate-700/80 px-2 py-1">звонить {fmt(route.avito?.call_now)}</span>
                        </div>

                        <div className="mt-4 rounded-lg border border-slate-700/70 bg-slate-950/60 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-white">Объявления Авито</div>
                            <div className="text-xs text-slate-500">
                              опубликовано {fmt(route.avito?.active_ads ?? route.avito?.ads_count)}
                            </div>
                          </div>
                          <div className="mt-2 space-y-2">
                            {(route.avito?.live_ads || []).slice(0, 3).map((ad) => (
                              <div
                                data-testid={`route-live-ad-${route.route_code}-${ad.item_id}`}
                                key={ad.item_id}
                                className="rounded border border-slate-800 bg-slate-900/80 px-2 py-2"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium text-slate-100">{ad.title}</div>
                                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                                      <span>№ {ad.item_id}</span>
                                      <span>{fmt(ad.views)} просм.</span>
                                      <span>{fmt(ad.contacts)} конт.</span>
                                      <span>{fmtPct(ad.conversion_pct)}</span>
                                    </div>
                                  </div>
                                  <span className={`rounded border px-2 py-0.5 text-xs ${avitoStatusClass(ad.status)}`}>
                                    {avitoStatusLabel(ad.status)}
                                  </span>
                                </div>
                                {ad.url && (
                                  <a
                                    href={ad.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                    className="mt-2 inline-flex items-center gap-1 text-xs text-blue-200 hover:text-blue-100"
                                  >
                                    открыть на Авито <ArrowUpRight size={12} />
                                  </a>
                                )}
                                <div className="mt-2">
                                  <AiAuditControl
                                    ad={ad}
                                    state={auditStates[String(ad.item_id)] || "idle"}
                                    prepareState={prepareStates[String(ad.item_id)] || "idle"}
                                    preparedCommand={preparedCommands[String(ad.item_id)] || null}
                                    compact
                                    onAudit={auditAvitoAd}
                                    onPrepare={prepareCommandFromAudit}
                                    onOpenQueue={openQueueForRoute}
                                  />
                                </div>
                              </div>
                            ))}
                            {(route.avito?.live_ads || []).length === 0 && (
                              <div className="rounded border border-slate-800 bg-slate-900/80 px-2 py-2 text-sm text-slate-400">
                                В свежем снимке Авито объявлений по этому направлению нет.
                              </div>
                            )}
                          </div>
                          {(route.avito?.live_ads || []).length > 3 && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openCommandReview(route.route_code);
                              }}
                              className="mt-2 text-xs font-medium text-blue-200 hover:text-blue-100"
                            >
                              +{fmt((route.avito?.live_ads || []).length - 3)} ещё, открыть проверку
                            </button>
                          )}
                        </div>

                        <div className="mt-5 grid gap-2 sm:grid-cols-3">
                          {(["need", "quality_problem", "stop"] as QuickAction[]).map(action => {
                            const key = `${route.route_code}:${action}`;
                            const busy = quickSubmitting === key;
                            const Icon = action === "need" ? PlusCircle : action === "quality_problem" ? Megaphone : PauseCircle;
                            const recommended = action === routeRecommendedAction(route);
                            return (
                              <button
                                data-testid={`route-action-${route.route_code}-${action}`}
                                key={action}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  submitQuickRequest(route, action);
                                }}
                                disabled={Boolean(quickSubmitting)}
                                className={`min-h-14 rounded-lg px-3 py-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  action === "need"
                                    ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                                    : action === "quality_problem"
                                      ? "bg-blue-500 text-white hover:bg-blue-400"
                                      : "border border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
                                } ${recommended ? "ring-2 ring-emerald-200" : ""}`}
                                title={quickActionHint[action]}
                              >
                                <span className="flex items-center gap-2">
                                  <Icon size={17} />
                                  {busy ? "Отправляю..." : recommended ? routeRecommendedText(route) : quickActionLabel[action]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        {reviewRouteCode && (
          <CommandReviewPanel
            detail={detail?.route_code === reviewRouteCode ? detail : null}
            loading={detailLoading || detail?.route_code !== reviewRouteCode}
            onCopy={copyAdText}
            copiedCommandId={copiedCommandId}
            auditStates={auditStates}
            prepareStates={prepareStates}
            preparedCommands={preparedCommands}
            commandDecisionStates={commandDecisionStates}
            onAudit={auditAvitoAd}
            onPrepare={prepareCommandFromAudit}
            onOpenQueue={openQueueForRoute}
            onApproveCommand={approveAvitoCommand}
            onDeclineCommand={declineAvitoCommand}
          />
        )}
        </section>

        <details data-testid="hr-details" className="rounded-lg border border-slate-700 bg-slate-900">
          <summary className="cursor-pointer select-none px-4 py-4 text-lg font-semibold text-white">
            Подробности и контроль
          </summary>
          <div className="space-y-6 border-t border-slate-800 p-4">
            <div className="flex justify-end">
              <button
                onClick={() => setFormOpen(true)}
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 hover:bg-slate-800"
              >
                <UserMinus size={17} />
                Зафиксировать уход
              </button>
            </div>

        <section className="rounded-lg border border-slate-700 bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-700 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-white">
                <Lightbulb size={17} className="text-amber-300" />
                Рекомендации системы
              </h2>
	              <p className="text-xs text-slate-500">
	                Система сверяет нехватку людей и объявления Авито, потом предлагает понятное действие.
	              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadRecommendations}
                disabled={recommendationsLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              >
                <RefreshCw size={15} className={recommendationsLoading ? "animate-spin" : ""} />
                Обновить
              </button>
              <button
                onClick={() => applySystemRecommendations({
                  routeCodes: actionableRecommendations.map(item => item.route_code),
                })}
                disabled={applyingRecommendations || actionableRecommendations.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlayCircle size={15} />
                Создать команды: {actionableRecommendations.length}
              </button>
              <button
                onClick={() => applySystemRecommendations({
                  includeReduce: true,
                  routeCodes: reduceRecommendations.map(item => item.route_code),
                })}
                disabled={applyingRecommendations || reduceRecommendations.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PauseCircle size={15} />
                Проверить лишние: {reduceRecommendations.length}
              </button>
            </div>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {visibleRecommendations.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">
                Активных рекомендаций нет: по открытым направлениям нет новых действий для Авито.
              </div>
            )}
            {visibleRecommendations.map(item => (
              <div key={item.route_code} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">{item.route_label}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {recommendationActionLabel[item.action] || item.action} · {fmt(item.requested_driver_count)} вод.
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-md border px-2 py-1 text-xs ${
                    item.can_apply
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                      : "border-slate-700 bg-slate-800 text-slate-300"
                  }`}>
                    {item.can_apply ? "готово" : item.skip_reason === "existing_open_command" ? "есть команда" : "контроль"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-5 text-slate-300">{item.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="rounded border border-slate-800 px-2 py-1">объявл. {fmt(item.avito.ads_count)}</span>
                  <span className="rounded border border-slate-800 px-2 py-1">конт. {fmt(item.avito.contacts)}</span>
                  <span className="rounded border border-slate-800 px-2 py-1">канд. {fmt(item.avito.candidates)}</span>
	                  {item.existing_command && (
	                    <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-blue-200">
	                      команда #{item.existing_command.id} · {commandStatusLabel[item.existing_command.status] || item.existing_command.status}
	                    </span>
	                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-lg border border-slate-700 bg-slate-900">
          <div className="flex flex-col gap-2 border-b border-slate-700 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-white">Дефицит по направлениям</h2>
              <p className="text-xs text-slate-500">
	                Данные {data?.cache_used ? "из быстрого кеша" : "обновлены"} · последний расчёт {fmtDateTime(data?.routes?.[0]?.last_calculated_at)}
              </p>
            </div>
            {loading && <RefreshCw size={16} className="animate-spin text-slate-400" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Направление</th>
	                  <th className="px-4 py-3 text-right">Сегодня</th>
	                  <th className="px-4 py-3 text-right">7 дней</th>
	                  <th className="px-4 py-3 text-right">14 дней</th>
	                  <th className="px-4 py-3 text-right">30 дней</th>
                  <th className="px-4 py-3 text-left">Критичная дата</th>
                  <th className="px-4 py-3 text-right">Авито</th>
                  <th className="px-4 py-3 text-left">Приоритет</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(data?.routes || []).map(route => (
                  <tr
                    key={route.route_code}
                    onClick={() => selectRoute(route.route_code)}
                    className={`cursor-pointer hover:bg-slate-800/60 ${selected === route.route_code ? "bg-slate-800/80" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Route size={15} className="text-blue-300" />
                        <div>
                          <div className="font-medium text-white">{route.route_label}</div>
	                          <div className="text-xs text-slate-500">кликните для деталей</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right"><DeficitCell horizon={route.today} /></td>
                    <td className="px-4 py-3 text-right"><DeficitCell horizon={route.d7} /></td>
                    <td className="px-4 py-3 text-right"><DeficitCell horizon={route.d14} /></td>
                    <td className="px-4 py-3 text-right"><DeficitCell horizon={route.d30} /></td>
                    <td className="px-4 py-3 text-slate-300">{fmtDate(route.next_critical_date)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {fmt(route.avito?.ads_count)} объявл. / {fmt(route.avito?.contacts)} конт.
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md border px-2 py-1 text-xs ${priorityClass(route.priority)}`}>
                        {priorityLabel[route.priority]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {detail && (
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-lg border border-slate-700 bg-slate-900">
              <div className="border-b border-slate-700 px-4 py-3">
                <h2 className="font-semibold text-white">{detail.route_label}: расчёт</h2>
	                <p className="text-xs text-slate-500">
	                  {detailLoading ? "Обновляю детализацию..." : "Сколько нужно людей, сколько есть и сколько реально нанимать"}
	                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Горизонт</th>
                      <th className="px-4 py-3 text-right">Нужно</th>
                      <th className="px-4 py-3 text-right">Доступно</th>
                      <th className="px-4 py-3 text-right">Дефицит</th>
                      <th className="px-4 py-3 text-right">Перевод</th>
                      <th className="px-4 py-3 text-right">К найму</th>
                      <th className="px-4 py-3 text-left">Качество</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {[
                      ["Сегодня", detail.need.today],
                      ["7 дней", detail.need.d7],
                      ["14 дней", detail.need.d14],
                      ["30 дней", detail.need.d30],
                    ].map(([label, h]: any) => (
                      <tr key={label}>
                        <td className="px-4 py-3 text-white">{label}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{h.required}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{h.available}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{h.raw_deficit}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{h.confirmed_transfer_in}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-300">{h.to_hire}</td>
	                        <td className="px-4 py-3 text-slate-300">{dataQualityLabel[h.data_quality] || h.data_quality}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Truck size={17} className="text-blue-300" />
                  Активные машины
                </div>
                <div className="mt-3 space-y-2">
	                  {detail.active_vehicles.length === 0 && <div className="text-sm text-slate-500">На сегодня машины по направлению не найдены.</div>}
                  {detail.active_vehicles.slice(0, 8).map((vehicle, index) => (
                    <div key={`${vehicle.vehicle_id}-${index}`} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                      <span className="font-mono text-blue-200">{vehicle.vehicle_number || vehicle.vehicle_id}</span>
	                      <span className="text-xs text-slate-500">учтена</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Users size={17} className="text-emerald-300" />
                  Доступные водители
                </div>
                <div className="mt-3 space-y-2">
                  {detail.available_drivers.length === 0 && <div className="text-sm text-slate-500">Доступных водителей по направлению пока нет.</div>}
                  {detail.available_drivers.slice(0, 8).map((driver, index) => (
                    <div key={`${driver.driver_id}-${index}`} className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                      <div className="text-white">{driver.driver_name}</div>
	                      <div className="mt-1 text-xs text-slate-500">{driver.vehicle_number || "без машины"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {detail && (
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-slate-700 bg-slate-900">
              <div className="border-b border-slate-700 px-4 py-3">
                <h2 className="font-semibold text-white">Исключённые водители</h2>
              </div>
              <div className="max-h-[420px] overflow-auto">
                {detail.exclusions.length === 0 && <div className="px-4 py-8 text-center text-sm text-slate-500">Исключений нет</div>}
                <table className="w-full min-w-[680px] text-sm">
                  <tbody className="divide-y divide-slate-800">
                    {detail.exclusions.slice(0, 80).map((ex, index) => (
                      <tr key={`${ex.id}-${index}`} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-white">{ex.driver_name_cache}</td>
	                        <td className="px-4 py-3 text-slate-300">{horizonCodeLabel[ex.horizon_code] || ex.horizon_code}</td>
                        <td className="px-4 py-3 text-slate-300">{reasonLabel[ex.reason_code] || ex.reason_code}</td>
                        <td className="px-4 py-3 text-slate-500">{ex.reason_text || ex.blocking_field || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-slate-700 bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                <h2 className="font-semibold text-white">Авито и найм</h2>
                <a
                  href={`/hr/avito?target_route_code=${detail.route_code}`}
                  className="inline-flex items-center gap-1 text-sm text-blue-300 hover:text-blue-200"
                >
                  Открыть Авито-объявления <ArrowUpRight size={14} />
                </a>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                <Metric title="Объявлений" value={fmt(detail.avito.ads_count)} icon={ClipboardList} />
                <Metric title="Контактов" value={fmt(detail.avito.contacts)} icon={Users} />
                <Metric title="Кандидатов" value={fmt(detail.avito.candidates)} icon={CheckCircle2} />
                <Metric title="Звонить сейчас" value={fmt(detail.avito.call_now)} icon={ShieldAlert} />
              </div>
              <div className="border-t border-slate-800 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Заявки на найм</div>
                  <button
                    onClick={() => openHiringRequest("need_drivers")}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
                  >
                    <PlusCircle size={13} />
                    заявка
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {detail.hiring_requests.length === 0 && <div className="text-sm text-slate-500">Механики ещё не оставляли заявок по направлению.</div>}
                  {detail.hiring_requests.slice(0, 5).map(item => (
                    <div key={item.id} className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white">{hiringRequestTypeLabel[item.request_type] || item.request_type}</span>
	                        <span className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
	                          {requestStatusLabel[item.status] || item.status}
	                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {fmtDateTime(item.created_at)} · {item.requested_driver_count ?? 0} вод. · {item.requested_by_name || "без имени"}
                      </div>
                      {item.reason && <div className="mt-2 text-xs text-slate-400">{item.reason}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-800 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Sparkles size={15} className="text-violet-300" />
                    ИИ-разборы механиков
                  </div>
                  <button
                    onClick={openAiCommand}
                    className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/20"
                  >
                    <Sparkles size={13} />
                    команда
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {detail.hiring_ai_runs.length === 0 && <div className="text-sm text-slate-500">ИИ ещё не разбирал заявки по направлению.</div>}
                  {detail.hiring_ai_runs.slice(0, 4).map(item => (
                    <div key={item.id} className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white">{item.parsed_intent?.request_type ? hiringRequestTypeLabel[item.parsed_intent.request_type] || item.parsed_intent.request_type : "разбор"}</span>
	                        <span className={`rounded border px-2 py-0.5 text-xs ${item.status === "completed" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
	                          {aiStatusLabel[item.status] || item.status}
	                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
	                        {fmtDateTime(item.created_at)}
	                        {item.parsed_intent?.confidence ? ` · уверенность ${Math.round(Number(item.parsed_intent.confidence) * 100)}%` : ""}
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs text-slate-400">{item.input_text}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-800 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Megaphone size={15} className="text-blue-300" />
                  Команды Авито
                </div>
                <div className="mt-3 space-y-2">
                  {detail.avito_commands.length === 0 && <div className="text-sm text-slate-500">Команд для Авито пока нет.</div>}
                  {detail.avito_commands.slice(0, 5).map(item => (
                    <div key={item.id} className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-white">{commandTypeLabel[item.command_type] || item.command_type}</div>
                          {item.payload?.ad_draft?.title && (
                            <div className="mt-0.5 truncate text-xs text-slate-400">{item.payload.ad_draft.title}</div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded border px-2 py-0.5 text-xs ${
                            item.status === "queued"
                              ? "border-blue-500/30 bg-blue-500/10 text-blue-200"
                              : item.status === "needs_review"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                                : item.status === "failed"
                                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                                  : "border-slate-600 bg-slate-800 text-slate-200"
	                          }`}>
	                            {commandStatusLabel[item.status] || item.status}
	                          </span>
                          <button
                            onClick={() => executeAvitoCommand(Number(item.id))}
                            disabled={executingCommandId === Number(item.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                          >
                            <PlayCircle size={13} />
                            {executingCommandId === Number(item.id) ? "проверяю" : "проверить"}
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {fmtDateTime(item.created_at)}
                        {item.result?.blocked_reason ? ` · блокер: ${item.result.blocked_reason}` : ""}
                      </div>
                      {item.error_message && (
                        <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-100">
                          {item.error_message}
                        </div>
                      )}
                      <BbipSuggestions
                        command={item}
                        approving={approvingCommandId === Number(item.id)}
                        onApprove={approvePromotion}
                      />
                      {item.payload?.ad_draft?.first_screen && (
                        <div className="mt-2 whitespace-pre-line rounded border border-slate-800 bg-slate-900/80 px-2 py-2 text-xs text-slate-300">
                          {item.payload.ad_draft.first_screen}
                        </div>
                      )}
                      {item.payload?.ad_draft?.text && (
                        <div className="mt-2 rounded border border-slate-800 bg-slate-950/70 px-2 py-2 text-xs text-slate-300">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-slate-200">Полный текст объявления</span>
                            <button
                              onClick={() => copyAdText(Number(item.id), item.payload?.ad_draft?.title, item.payload?.ad_draft?.text)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                            >
                              <ClipboardList size={13} />
                              {copiedCommandId === Number(item.id) ? "Скопировано" : "Скопировать"}
                            </button>
                          </div>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-slate-400">Показать текст</summary>
                            <div className="mt-2 max-h-80 overflow-auto whitespace-pre-line rounded bg-slate-950 px-2 py-2">
                              {item.payload.ad_draft.text}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-800 px-4 py-3">
                <div className="text-sm font-medium text-white">Последние уходы</div>
                <div className="mt-3 space-y-2">
                  {detail.manual_exits.length === 0 && <div className="text-sm text-slate-500">Уходы по направлению ещё не фиксировали.</div>}
                  {detail.manual_exits.slice(0, 5).map(item => (
                    <div key={item.id} className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                      <div className="text-white">{item.driver_full_name}</div>
                      <div className="mt-1 text-xs text-slate-500">{fmtDate(item.left_date)} · {item.exit_reason} · возврат: {item.eligible_for_return}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

          </div>
        </details>

        {aiFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-lg border border-violet-500/30 bg-slate-900 p-5 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Sparkles size={18} className="text-violet-300" />
                    ИИ-команда на найм
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Напишите как механик. ИИ сам определит направление, действие с Авито и создаст заявку.
                  </p>
                </div>
                <button onClick={() => setAiFormOpen(false)} className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800">Закрыть</button>
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                  Примеры: «Нужно 4 водителя на Рязань WB срочно», «По Сарапул-Уфа пока хватит, объявления убрать», «Киров усилить, нужны два водителя».
                </div>
                <textarea
                  className="min-h-36 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-violet-400"
                  value={aiCommandText}
                  onChange={e => setAiCommandText(e.target.value)}
                  placeholder="Напишите команду простыми словами"
                />
                <div className="text-xs text-slate-500">
                  Выбранное направление для подсказки: {selectedRoute?.route_label || detail?.route_label || "не выбрано"}
                </div>
                {aiResult?.needs_review && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                    ИИ не стал создавать команду автоматически: нужно уточнение руководителя.
                    <div className="mt-2 text-xs text-amber-200/80">
                      Риски: {(aiResult.parsed?.risk_flags || []).join(", ") || "низкая уверенность"}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setAiFormOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Отмена</button>
                <button onClick={saveAiCommand} disabled={savingAiCommand} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
                  {savingAiCommand ? "Разбираю..." : "Разобрать и создать"}
                </button>
              </div>
            </div>
          </div>
        )}

        {hireFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Команда на найм</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Механик формулирует потребность, система создаёт заявку и команду для Авито.
                  </p>
                </div>
                <button onClick={() => setHireFormOpen(false)} className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800">Закрыть</button>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <select className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" value={hireForm.request_type} onChange={e => setHireForm({ ...hireForm, request_type: e.target.value })}>
                  <option value="need_drivers">Нужны водители</option>
                  <option value="stop_hiring">Больше не нужны, остановить набор</option>
                  <option value="reduce_hiring">Снизить набор</option>
                </select>
                <select className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" value={hireForm.route_code} onChange={e => setHireForm({ ...hireForm, route_code: e.target.value })}>
                  {(data?.routes || []).map(route => <option key={route.route_code} value={route.route_code}>{route.route_label}</option>)}
                </select>
                <input type="number" min="0" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" placeholder="Сколько водителей нужно" value={hireForm.requested_driver_count} onChange={e => setHireForm({ ...hireForm, requested_driver_count: e.target.value })} />
                <select className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" value={hireForm.urgency} onChange={e => setHireForm({ ...hireForm, urgency: e.target.value })}>
                  <option value="normal">Обычная срочность</option>
                  <option value="high">Срочно</option>
                  <option value="critical">Критично</option>
                  <option value="low">Низкая срочность</option>
                </select>
                <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none md:col-span-2" placeholder="Кто просит: колонный механик / ответственный" value={hireForm.requested_by_name} onChange={e => setHireForm({ ...hireForm, requested_by_name: e.target.value })} />
                <textarea className="min-h-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none md:col-span-2" placeholder="Что нужно простыми словами" value={hireForm.reason} onChange={e => setHireForm({ ...hireForm, reason: e.target.value })} />
              </div>
              <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                После сохранения появится команда Авито: создать/усилить объявления или остановить набор по выбранному направлению.
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setHireFormOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Отмена</button>
                <button onClick={saveHiringRequest} disabled={savingHiringRequest} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                  {savingHiringRequest ? "Создаю..." : "Создать команду"}
                </button>
              </div>
            </div>
          </div>
        )}

        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-3xl rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Зафиксировать уход водителя</h2>
                  <p className="mt-1 text-sm text-slate-400">Это уже собирает причины текучки для будущей аналитики найма.</p>
                </div>
                <button onClick={() => setFormOpen(false)} className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800">Закрыть</button>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" placeholder="ФИО водителя" value={exitForm.driver_full_name} onChange={e => setExitForm({ ...exitForm, driver_full_name: e.target.value })} />
                <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" placeholder="Телефон" value={exitForm.normalized_phone} onChange={e => setExitForm({ ...exitForm, normalized_phone: e.target.value })} />
                <input type="date" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" value={exitForm.left_date} onChange={e => setExitForm({ ...exitForm, left_date: e.target.value })} />
                <select className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" value={exitForm.route_code} onChange={e => setExitForm({ ...exitForm, route_code: e.target.value })}>
                  {(data?.routes || []).map(route => <option key={route.route_code} value={route.route_code}>{route.route_label}</option>)}
                </select>
                <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" placeholder="Машина" value={exitForm.vehicle_number} onChange={e => setExitForm({ ...exitForm, vehicle_number: e.target.value })} />
                <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" placeholder="Механик" value={exitForm.mechanic_name} onChange={e => setExitForm({ ...exitForm, mechanic_name: e.target.value })} />
                <select className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" value={exitForm.exit_reason} onChange={e => setExitForm({ ...exitForm, exit_reason: e.target.value })}>
                  {exitReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" value={exitForm.exit_initiator} onChange={e => setExitForm({ ...exitForm, exit_initiator: e.target.value })}>
                  <option value="driver">Водитель</option>
                  <option value="company">Компания</option>
                  <option value="mutual">Обоюдно</option>
                  <option value="unknown">Неизвестно</option>
                </select>
                <input type="number" min="0" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" placeholder="Сколько дней отработал" value={exitForm.days_worked} onChange={e => setExitForm({ ...exitForm, days_worked: e.target.value })} />
                <select className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" value={exitForm.eligible_for_return} onChange={e => setExitForm({ ...exitForm, eligible_for_return: e.target.value })}>
                  <option value="">Можно брать обратно?</option>
                  <option value="yes">Да</option>
                  <option value="no">Нет</option>
                  <option value="management_review">Проверка руководителя</option>
                </select>
                <textarea className="min-h-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none md:col-span-2" placeholder="Комментарий по возврату" value={exitForm.return_comment} onChange={e => setExitForm({ ...exitForm, return_comment: e.target.value })} />
                <textarea className="min-h-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none md:col-span-2" placeholder="Общий комментарий" value={exitForm.comment} onChange={e => setExitForm({ ...exitForm, comment: e.target.value })} />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Отмена</button>
                <button onClick={saveExit} disabled={savingExit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                  {savingExit ? "Сохраняю..." : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
