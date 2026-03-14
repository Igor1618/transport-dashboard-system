// All dates displayed in Moscow time
const TZ = "Europe/Moscow";

export const fmtDateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtDateShort = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit" }) : "—";

export const fmtDateFull = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const fmtTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtTimeNow = () =>
  new Date().toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });
