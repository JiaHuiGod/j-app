export type SubtitleFormat = 'ass' | 'srt' | 'ssa' | 'vtt';

export interface SubtitleCue {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function parseTimestamp(value: string): number {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})$/);

  if (!match) {
    const shortMatch = normalized.match(/^(\d{1,2}):(\d{2})[.,](\d{1,3})$/);

    if (!shortMatch) {
      return 0;
    }

    return (
      Number(shortMatch[1]) * 60 +
      Number(shortMatch[2]) +
      Number((shortMatch[3] ?? '').padEnd(3, '0')) / 1000
    );
  }

  const milliseconds = Number((match[4] ?? '').padEnd(3, '0'));

  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    milliseconds / 1000
  );
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\N/gi, '\n')
    .trim();
}

function parseTimedText(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];

  for (const block of content.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lines = block.split('\n');
    const timingIndex = lines.findIndex((line) => line.includes('-->'));

    if (timingIndex < 0) {
      continue;
    }

    const timingLine = lines[timingIndex] ?? '';
    const [startText, endText] = timingLine.split('-->');

    if (!startText || !endText) {
      continue;
    }

    const start = parseTimestamp(startText);
    const end = parseTimestamp((endText ?? '').trim().split(/\s+/)[0] ?? '');
    const text = cleanText(lines.slice(timingIndex + 1).join('\n'));

    if (end > start && text) {
      cues.push({ start, end, text });
    }
  }

  return cues;
}

function parseAssTimestamp(value: string): number {
  const match = value.trim().match(/^(\d+):(\d{2}):(\d{2})[.](\d{1,2})$/);

  if (!match) {
    return 0;
  }

  const centiseconds = Number((match[4] ?? '').padEnd(2, '0'));

  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    centiseconds / 100
  );
}

function parseAss(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  let inEvents = false;
  let textIndex = 9;

  for (const rawLine of content.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();

    if (line.startsWith('[')) {
      inEvents = line.toLowerCase() === '[events]';
      continue;
    }

    if (!inEvents) {
      continue;
    }

    if (line.toLowerCase().startsWith('format:')) {
      const fields = line
        .slice(line.indexOf(':') + 1)
        .split(',')
        .map((field) => field.trim().toLowerCase());
      const index = fields.indexOf('text');

      if (index >= 0) {
        textIndex = index;
      }

      continue;
    }

    if (!line.toLowerCase().startsWith('dialogue:')) {
      continue;
    }

    const fields = line.slice(line.indexOf(':') + 1).split(',');
    const start = parseAssTimestamp(fields[1] ?? '');
    const end = parseAssTimestamp(fields[2] ?? '');
    const text = cleanText(
      fields.slice(textIndex).join(',').replace(/\\N/gi, '\n'),
    );

    if (end > start && text) {
      cues.push({ start, end, text });
    }
  }

  return cues;
}

export function parseSubtitle(
  content: string,
  format: SubtitleFormat,
): SubtitleCue[] {
  return format === 'ass' || format === 'ssa'
    ? parseAss(content)
    : parseTimedText(content);
}

export function findActiveSubtitle(
  cues: readonly SubtitleCue[],
  position: number,
): string {
  const matches = cues.filter(
    (cue) => position >= cue.start && position <= cue.end,
  );

  return matches.map((cue) => cue.text).join('\n');
}
