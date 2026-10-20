const SITE_PARTITION_NAME_PREFIX = 'persist:japp-site-';
const SITE_PARTITION_DIRECTORY_PREFIX = 'japp-site-';
const SITE_PARTITION_DIRECTORY_PATTERN =
  /^japp-site-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getSitePartitionName(connectionId: string): string {
  return `${SITE_PARTITION_NAME_PREFIX}${connectionId}`;
}

export function getSitePartitionDirectoryName(connectionId: string): string {
  return `${SITE_PARTITION_DIRECTORY_PREFIX}${connectionId}`;
}

export function isSitePartitionDirectoryName(name: string): boolean {
  return SITE_PARTITION_DIRECTORY_PATTERN.test(name);
}

/**
 * Pure helper used by startup cleanup. Only well-formed site partition
 * directories that no longer have connection metadata are considered orphaned.
 */
export function findOrphanSitePartitionNames(
  directoryNames: readonly string[],
  connectionIds: readonly string[],
): string[] {
  const referencedDirectories = new Set(
    connectionIds.map(getSitePartitionDirectoryName),
  );

  return directoryNames
    .filter(
      (name) =>
        isSitePartitionDirectoryName(name) && !referencedDirectories.has(name),
    )
    .sort();
}
