export const UPDATE_REPOSITORY = 'Nantoforget/j-app';

export function buildUpdateFeedUrl(
  repository: string,
  version: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  return `https://update.electronjs.org/${repository}/${platform}-${arch}/${encodeURIComponent(version)}`;
}

export function isAutoUpdateSupported(
  isPackaged: boolean,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): boolean {
  return isPackaged && platform === 'win32' && arch === 'x64';
}
