const SUBTITLE_EXTENSIONS = new Set(['ass', 'srt', 'ssa', 'vtt']);

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(index + 1).toLowerCase() : '';
}

function stemOf(name: string): string {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(0, index) : name;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\[[^\]]*]|\([^)]*\)|\{[^}]*}/g, ' ')
    .replace(/[._]+/g, ' ')
    .replace(
      /(?:^|\s)(?:chs|cht|zh|zh-cn|zh-tw|sc|tc|简体|繁体|中字|双语|字幕)(?=\s|$)/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function commonPrefixLength(left: string, right: string): number {
  let index = 0;

  while (
    index < left.length &&
    index < right.length &&
    left[index] === right[index]
  ) {
    index += 1;
  }

  return index;
}

function episodeKey(value: string): string | null {
  const seasonEpisode = value.match(/s(\d{1,2})[\s._-]*e(\d{1,3})/i);

  if (seasonEpisode) {
    return `s${Number(seasonEpisode[1])}e${Number(seasonEpisode[2])}`;
  }

  const chineseEpisode = value.match(/第\s*(\d{1,3})\s*[集话]/);

  if (chineseEpisode) {
    return `e${Number(chineseEpisode[1])}`;
  }

  const englishEpisode = value.match(
    /(?:^|[\s._-])(?:ep|e)[\s._-]*(\d{1,3})(?=$|[\s._-])/i,
  );

  return englishEpisode ? `e${Number(englishEpisode[1])}` : null;
}

function catalogKey(value: string): string | null {
  const matches = [...value.matchAll(/\b([a-z]{2,})[\s._-]?(\d{2,})\b/gi)]
    .map((match) => `${match[1]!.toLowerCase()}-${Number(match[2])}`)
    .filter(
      (code) =>
        !/^(?:www|com|net|org|la)-\d+$/.test(code) &&
        !/^(?:h|x|avc|hevc)-\d+$/.test(code),
    );

  return matches.at(-1) ?? null;
}

function scoreSubtitle(videoName: string, subtitleName: string): number {
  const videoStem = stemOf(videoName).toLowerCase();
  const subtitleStem = stemOf(subtitleName).toLowerCase();
  const videoEpisode = episodeKey(videoStem);
  const subtitleEpisode = episodeKey(subtitleStem);

  if (videoEpisode && subtitleEpisode && videoEpisode !== subtitleEpisode) {
    return 0;
  }

  const videoCatalog = catalogKey(videoStem);
  const subtitleCatalog = catalogKey(subtitleStem);

  if (videoCatalog && subtitleCatalog && videoCatalog !== subtitleCatalog) {
    return 0;
  }

  if (videoStem === subtitleStem) {
    return 1000;
  }

  const videoKey = normalizeName(videoStem);
  const subtitleKey = normalizeName(subtitleStem);

  if (!videoKey || !subtitleKey) {
    return 0;
  }

  if (videoKey === subtitleKey) {
    return 950;
  }

  if (videoCatalog && subtitleCatalog && videoCatalog === subtitleCatalog) {
    return 900;
  }

  if (
    subtitleKey.startsWith(`${videoKey} `) ||
    videoKey.startsWith(`${subtitleKey} `)
  ) {
    return 850;
  }

  const shorterLength = Math.min(videoKey.length, subtitleKey.length);
  const prefix = commonPrefixLength(videoKey, subtitleKey);

  if (
    prefix >= 6 &&
    prefix >= shorterLength * 0.65 &&
    videoKey.includes(subtitleKey.slice(0, Math.min(prefix, 12))) &&
    subtitleKey.includes(videoKey.slice(0, Math.min(prefix, 12)))
  ) {
    return 500 + prefix;
  }

  return 0;
}

export function matchSubtitleNames(
  videoName: string,
  subtitleNames: readonly string[],
): string[] {
  return subtitleNames
    .filter((name) => SUBTITLE_EXTENSIONS.has(extensionOf(name)))
    .map((name) => ({ name, score: scoreSubtitle(videoName, name) }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.name.localeCompare(right.name),
    )
    .slice(0, 10)
    .map((item) => item.name);
}

export function isSubtitleFile(name: string): boolean {
  return SUBTITLE_EXTENSIONS.has(extensionOf(name));
}
