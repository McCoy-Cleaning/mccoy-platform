/** Allowlisted video hosts — parse user URL into a safe embed URL. */
const YOUTUBE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;
const VIMEO = /(?:vimeo\.com\/)(\d+)/i;
const FACEBOOK_VIDEO =
  /facebook\.com\/(?:[^/?#]+\/)?(?:videos|reel|watch|share\/v)\/|fb\.watch\//i;

export type SafeVideoEmbed =
  | { ok: true; embedUrl: string; provider: "youtube" | "vimeo" | "facebook" }
  | { ok: false; reason: string };

export function resolveSafeVideoEmbed(rawUrl: string): SafeVideoEmbed {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { ok: false, reason: "Lege video-URL" };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Ongeldige URL" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Alleen https-video's zijn toegestaan" };
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    const match = trimmed.match(YOUTUBE);
    const id = match?.[1];
    if (!id) return { ok: false, reason: "YouTube-video-id niet gevonden" };
    return {
      ok: true,
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const match = trimmed.match(VIMEO);
    const id = match?.[1];
    if (!id) return { ok: false, reason: "Vimeo-video-id niet gevonden" };
    return {
      ok: true,
      provider: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${id}`,
    };
  }
  if (host === "facebook.com" || host === "fb.com" || host === "fb.watch") {
    if (host === "fb.watch" || FACEBOOK_VIDEO.test(trimmed) || parsed.searchParams.has("v")) {
      const href = encodeURIComponent(trimmed);
      return {
        ok: true,
        provider: "facebook",
        embedUrl: `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=560&height=315`,
      };
    }
    return { ok: false, reason: "Facebook-videolink niet herkend" };
  }
  if (host.endsWith("mccoy.nl") || host.endsWith("mccoy.cleaning")) {
    if (/\.(mp4|webm)(\?|$)/i.test(parsed.pathname)) {
      return { ok: true, provider: "youtube", embedUrl: trimmed };
    }
  }
  return { ok: false, reason: "Video-host is niet toegestaan" };
}
