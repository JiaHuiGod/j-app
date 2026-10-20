import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { SiteConnection } from '@shared/connections';
import { findOrphanSitePartitionNames } from './partition';

/**
 * Sessions are persisted by Chromium under userData/Partitions. Remove only
 * directories that match our site partition naming scheme and no longer have
 * connection metadata. This runs before any site session is created.
 */
export async function cleanupOrphanSitePartitions(
  connections: readonly SiteConnection[],
): Promise<number> {
  const partitionsRoot = path.join(app.getPath('userData'), 'Partitions');
  let entries;

  try {
    entries = await readdir(partitionsRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0;
    }

    throw error;
  }

  const directoryNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const orphanNames = findOrphanSitePartitionNames(
    directoryNames,
    connections.map((connection) => connection.id),
  );
  let removedCount = 0;

  for (const name of orphanNames) {
    const targetPath = path.join(partitionsRoot, name);

    try {
      await rm(targetPath, { recursive: true, force: true });
      removedCount += 1;
    } catch (error) {
      console.error(`Failed to remove orphan site partition ${name}:`, error);
    }
  }

  if (removedCount > 0) {
    console.info(`Removed ${removedCount} orphan site partition(s).`);
  }

  return removedCount;
}
