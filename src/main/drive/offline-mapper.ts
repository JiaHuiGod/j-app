import type {
  DriveOfflineTask,
  DriveOfflineTaskList,
  DriveOfflineTaskStatus,
} from '@shared/drive';
import { stripHtmlTags } from './mapper';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
}

function asNumber(value: unknown): number | null {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function normalizeTimestamp(value: unknown): string | null {
  const timestamp = asNumber(value);

  if (timestamp === null || timestamp <= 0) {
    return null;
  }

  const milliseconds =
    timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  const date = new Date(milliseconds);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeStatus(
  rawStatus: unknown,
  displayStatus: string,
  progress: number,
): DriveOfflineTaskStatus {
  const status = displayStatus.toLowerCase();

  if (
    status.includes('finished') ||
    status.includes('success') ||
    status.includes('完成') ||
    Number(rawStatus) === 2
  ) {
    return 'finished';
  }

  if (
    status.includes('fail') ||
    status.includes('error') ||
    status.includes('失败')
  ) {
    return 'failed';
  }

  if (status.includes('pause') || status.includes('暂停')) {
    return 'paused';
  }

  if (
    status.includes('wait') ||
    status.includes('pending') ||
    status.includes('queue') ||
    status.includes('等待') ||
    status.includes('排队')
  ) {
    return 'pending';
  }

  if (status.includes('download') || status.includes('下载') || progress > 0) {
    return 'downloading';
  }

  return 'unknown';
}

function statusLabel(status: DriveOfflineTaskStatus): string {
  switch (status) {
    case 'downloading':
      return '下载中';
    case 'failed':
      return '失败';
    case 'finished':
      return '已完成';
    case 'paused':
      return '已暂停';
    case 'pending':
      return '等待中';
    default:
      return '未知状态';
  }
}

function normalizeTask(value: unknown, index: number): DriveOfflineTask | null {
  const item = asRecord(value);

  if (!item) {
    return null;
  }

  const name = stripHtmlTags(asText(item.name));

  if (!name) {
    return null;
  }

  const progress = Math.min(
    100,
    Math.max(0, asNumber(item.display_percent ?? item.percentDone) ?? 0),
  );
  const status = normalizeStatus(
    item.status,
    asText(item.display_status) || asText(item.status_text),
    progress,
  );
  const targetFolderId = asText(item.wp_path_id);
  const infoHash = asText(item.info_hash);
  const fileId = asText(item.file_id);

  return {
    id: infoHash || fileId || `${asText(item.add_time) || 'task'}-${index}`,
    name,
    size: asNumber(item.size),
    progress: status === 'finished' ? 100 : Math.round(progress),
    rate: Math.max(0, asNumber(item.rateDownload) ?? 0),
    status,
    statusText: asText(item.status_text) || statusLabel(status),
    targetFolderId: targetFolderId || null,
    addedAt: normalizeTimestamp(item.add_time),
    sourceUrl: asText(item.url),
  };
}

export function normalize115OfflineTasks(value: unknown): DriveOfflineTask[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => normalizeTask(item, index))
    .filter((task): task is DriveOfflineTask => task !== null);
}

export function normalize115OfflineTaskList(
  value: unknown,
  requestedPage: number,
): DriveOfflineTaskList {
  const response = asRecord(value) ?? {};
  const tasks = normalize115OfflineTasks(response.tasks);
  const page = Math.max(
    1,
    Math.round(asNumber(response.page) ?? requestedPage),
  );
  const pageCount = Math.max(1, Math.round(asNumber(response.page_count) ?? 1));
  const total = Math.max(
    tasks.length,
    Math.round(asNumber(response.count) ?? tasks.length),
  );

  return {
    tasks,
    page,
    pageCount,
    total,
  };
}
