export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const totalMin = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (totalMin < 60) {
    return s > 0 ? `${totalMin}min ${s}s` : `${totalMin}min`;
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

export const TZ_BR = "America/Sao_Paulo";

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `${days} dias atrás`;
  return date.toLocaleDateString("pt-BR", { timeZone: TZ_BR });
}

export function formatDateBR(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: TZ_BR, ...opts });
}

export function formatDateTimeBR(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(dateStr).toLocaleString("pt-BR", { timeZone: TZ_BR, ...opts });
}
