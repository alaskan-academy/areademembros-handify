const BASE = "https://api-v2.pandavideo.com.br";

async function pandaFetch<T>(path: string): Promise<T | null> {
  const key = process.env.PANDA_VIDEO_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: key },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export interface PandaAccountAnalytics {
  views: number;
  plays: number;
  watch_time: number;
  unique_viewers: number;
}

export interface PandaVideoRankItem {
  video_id: string;
  title: string;
  views: number;
  plays: number;
  watch_time: number;
  unique_viewers: number;
}

export interface PandaRetentionPoint {
  second: number;
  percentage: number;
}

export interface PandaVideoAnalytics {
  views: number;
  plays: number;
  watch_time: number;
  unique_viewers: number;
}

export async function getAccountAnalytics(
  startDate?: string,
  endDate?: string
): Promise<PandaAccountAnalytics | null> {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.size ? `?${params}` : "";
  return pandaFetch<PandaAccountAnalytics>(`/analytics${qs}`);
}

export async function getVideoRanking(
  limit = 20
): Promise<{ data: PandaVideoRankItem[] } | null> {
  return pandaFetch<{ data: PandaVideoRankItem[] }>(
    `/analytics/ranking?page_size=${limit}`
  );
}

export async function getVideoAnalytics(
  videoId: string
): Promise<PandaVideoAnalytics | null> {
  return pandaFetch<PandaVideoAnalytics>(`/analytics/${videoId}`);
}

export async function getVideoRetention(
  videoId: string
): Promise<{ data: PandaRetentionPoint[] } | null> {
  return pandaFetch<{ data: PandaRetentionPoint[] }>(
    `/analytics/${videoId}/retention`
  );
}

/** Formata segundos como "2h 30min" ou "45min" */
export function formatWatchTime(seconds: number): string {
  if (!seconds) return "0min";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m > 0 ? `${m}min` : ""}`.trim();
  return `${m}min`;
}
