const youtubeHosts = ['youtube.com', 'm.youtube.com', 'youtu.be'];
const vimeoHosts = ['vimeo.com', 'player.vimeo.com'];

/** YouTube, Vimeo or a direct video file. The frontend builds the embed from it. */
export function isSupportedVideoUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const host = url.hostname.replace(/^www\./, '');

  if (youtubeHosts.includes(host)) {
    return host === 'youtu.be'
      ? /^\/[\w-]{6,}/.test(url.pathname)
      : Boolean(url.searchParams.get('v')) ||
          /^\/(shorts|embed|live)\/[\w-]{6,}/.test(url.pathname);
  }

  if (vimeoHosts.includes(host)) {
    return /\/\d+/.test(url.pathname);
  }

  return /\.(mp4|webm|mov)$/i.test(url.pathname);
}
