export type FileKind =
  | 'archive'
  | 'audio'
  | 'code'
  | 'image'
  | 'package'
  | 'pdf'
  | 'sheet'
  | 'slides'
  | 'text'
  | 'unknown'
  | 'video';

const FILE_KIND_BY_EXTENSION: Readonly<Record<string, FileKind>> = {
  '7z': 'archive',
  aac: 'audio',
  apk: 'package',
  appimage: 'package',
  ass: 'text',
  avi: 'video',
  avif: 'image',
  bmp: 'image',
  bz2: 'archive',
  c: 'code',
  cpp: 'code',
  css: 'code',
  csv: 'sheet',
  deb: 'package',
  dmg: 'package',
  doc: 'text',
  docx: 'text',
  epub: 'text',
  exe: 'package',
  flac: 'audio',
  flv: 'video',
  gif: 'image',
  go: 'code',
  gz: 'archive',
  h: 'code',
  heic: 'image',
  html: 'code',
  iso: 'package',
  java: 'code',
  jpeg: 'image',
  jpg: 'image',
  js: 'code',
  json: 'code',
  jsx: 'code',
  key: 'slides',
  m4a: 'audio',
  m4v: 'video',
  md: 'text',
  mkv: 'video',
  mov: 'video',
  mp3: 'audio',
  mp4: 'video',
  msi: 'package',
  ogg: 'audio',
  odp: 'slides',
  ods: 'sheet',
  opus: 'audio',
  pdf: 'pdf',
  pkg: 'package',
  png: 'image',
  ppt: 'slides',
  pptx: 'slides',
  py: 'code',
  rar: 'archive',
  rs: 'code',
  rtf: 'text',
  sh: 'code',
  srt: 'text',
  svg: 'image',
  tar: 'archive',
  ts: 'code',
  tsx: 'code',
  txt: 'text',
  wav: 'audio',
  webm: 'video',
  webp: 'image',
  wmv: 'video',
  xls: 'sheet',
  xlsx: 'sheet',
  xz: 'archive',
  yaml: 'code',
  yml: 'code',
  zip: 'archive',
};

export function getFileKind(extension: string | null): FileKind {
  if (!extension) {
    return 'unknown';
  }

  return FILE_KIND_BY_EXTENSION[extension.toLowerCase()] ?? 'unknown';
}
