const EMBED_ALLOWLIST = [
  "docs.google.com",
  "forms.gle",
  "typeform.com",
  "notion.so",
  "canva.com",
  "youtube.com",
  "youtu.be",
  "www.youtube.com",
  "handify.com.br",
];

export function isAllowedEmbedUrl(url: string): boolean {
  if (url.startsWith("/")) return true;
  try {
    const { hostname } = new URL(url);
    return EMBED_ALLOWLIST.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}
