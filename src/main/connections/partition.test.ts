import { describe, expect, it } from 'vitest';
import {
  findOrphanSitePartitionNames,
  getSitePartitionDirectoryName,
  getSitePartitionName,
  isSitePartitionDirectoryName,
} from './partition';

const FIRST_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';
const THIRD_ID = '33333333-3333-4333-8333-333333333333';

describe('site partition names', () => {
  it('builds persistent session and directory names from a connection id', () => {
    expect(getSitePartitionName(FIRST_ID)).toBe(
      `persist:japp-site-${FIRST_ID}`,
    );
    expect(getSitePartitionDirectoryName(FIRST_ID)).toBe(
      `japp-site-${FIRST_ID}`,
    );
  });

  it('only accepts well-formed site partition directory names', () => {
    expect(isSitePartitionDirectoryName(`japp-site-${FIRST_ID}`)).toBe(true);
    expect(isSitePartitionDirectoryName('japp-site-not-a-uuid')).toBe(false);
    expect(isSitePartitionDirectoryName(`other-${FIRST_ID}`)).toBe(false);
  });

  it('finds only unreferenced well-formed site partitions', () => {
    const orphanNames = findOrphanSitePartitionNames(
      [
        `japp-site-${FIRST_ID}`,
        `japp-site-${SECOND_ID}`,
        `japp-site-${THIRD_ID}`,
        'japp-site-not-a-uuid',
        'Default',
        'other-partition',
      ],
      [FIRST_ID],
    );

    expect(orphanNames).toEqual([
      `japp-site-${SECOND_ID}`,
      `japp-site-${THIRD_ID}`,
    ]);
  });
});
