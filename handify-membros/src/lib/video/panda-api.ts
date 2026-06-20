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

export interface PandaVideo {
  id: string;
  video_external_id: string; // este é o ID usado no player (= video_panda_id nas lições)
  title: string;
  length: number;            // segundos
  storage_size: number;      // bytes
  thumbnail: string;
  preview: string;
  status: string;
  created_at: string;
}

export async function getVideos(
  limit = 200
): Promise<{ videos: PandaVideo[]; total: number } | null> {
  return pandaFetch<{ videos: PandaVideo[]; pages: number; total: number }>(
    `/videos?limit=${limit}`
  );
}

/** Formata segundos como "2h 30min" ou "45min" */
export function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m > 0 ? `${m}min` : ""}`.trim();
  if (m > 0) return `${m}min ${s > 0 ? `${s}s` : ""}`.trim();
  return `${s}s`;
}

/** Formata bytes como "1.2 GB" / "340 MB" */
export function formatStorage(bytes: number): string {
  if (!bytes) return "—";
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
