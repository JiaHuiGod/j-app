import type { LocalVideoLibrary } from '@shared/local-video';

export interface LocalVideoRecord {
  readonly library: LocalVideoLibrary;
  readonly rootPath: string;
  readonly videos: ReadonlyMap<string, string>;
  readonly posters: ReadonlyMap<string, string>;
}

const records = new Map<string, LocalVideoRecord>();

export function storeLocalVideoRecord(record: LocalVideoRecord): void {
  records.set(record.library.id, record);

  while (records.size > 50) {
    const oldestId = records.keys().next().value;

    if (!oldestId) {
      break;
    }

    records.delete(oldestId);
  }
}

export function getLocalVideoRecord(
  libraryId: string,
): LocalVideoRecord | null {
  return records.get(libraryId) ?? null;
}

export function removeLocalVideoRecord(libraryId: string): void {
  records.delete(libraryId);
}

export function clearLocalVideoRecords(): void {
  records.clear();
}
