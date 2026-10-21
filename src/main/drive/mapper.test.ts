import { describe, expect, it } from 'vitest';
import { is115Connection } from './detection';
import {
  normalize115Breadcrumbs,
  normalize115Entry,
  normalize115Listing,
  normalize115SearchResult,
} from './mapper';

describe('115 connection detection', () => {
  it('accepts 115 login URLs and rejects other hosts', () => {
    expect(
      is115Connection({
        loginUrl: 'https://115.com/storage/allfiles?cid=0&mode=wangpan',
      }),
    ).toBe(true);
    expect(
      is115Connection({
        loginUrl: 'https://webapi.115.com/files',
      }),
    ).toBe(true);
    expect(
      is115Connection({
        loginUrl: 'https://example.com/115.com',
      }),
    ).toBe(false);
  });
});

describe('115 file normalization', () => {
  it('normalizes folders and files and strips search highlighting', () => {
    expect(
      normalize115Entry({
        cid: '10',
        pid: '0',
        fc: 0,
        n: '<b>电影</b> &amp; 剧集',
        te: '1729500000',
      }),
    ).toEqual({
      id: '10',
      parentId: '0',
      name: '电影 & 剧集',
      kind: 'folder',
      size: null,
      modifiedAt: '2024-10-21T08:40:00.000Z',
      extension: null,
      durationSeconds: null,
    });

    expect(
      normalize115Entry({
        fid: '20',
        cid: '10',
        fc: 1,
        n: 'readme.txt',
        s: '1024',
        te: '1729500000',
        ico: 'TXT',
      }),
    ).toEqual({
      id: '20',
      parentId: '10',
      name: 'readme.txt',
      kind: 'file',
      size: 1024,
      modifiedAt: '2024-10-21T08:40:00.000Z',
      extension: 'txt',
      durationSeconds: null,
    });
  });

  it('normalizes video duration from play_long', () => {
    expect(
      normalize115Entry({
        fid: '40',
        cid: '10',
        fc: 1,
        n: 'movie.mp4',
        s: '1048576',
        ico: 'mp4',
        play_long: '1870',
      }),
    ).toMatchObject({
      kind: 'file',
      extension: 'mp4',
      durationSeconds: 1870,
    });
  });

  it('drops malformed entries and puts folders first', () => {
    const listing = normalize115Listing(
      {
        count: 4,
        data: [
          { fid: '20', cid: '10', fc: 1, n: 'file.txt', s: '12' },
          { cid: '10', pid: '0', fc: 0, n: '文件夹' },
          { fc: 1, n: 'missing id' },
        ],
      },
      {
        accountId: 'account',
        folderId: '0',
        offset: 0,
        limit: 100,
      },
    );

    expect(listing.entries.map((entry) => entry.name)).toEqual([
      '文件夹',
      'file.txt',
    ]);
    expect(listing.total).toBe(4);
    expect(listing.hasMore).toBe(true);
  });
});

describe('115 breadcrumbs and search', () => {
  it('builds a root breadcrumb without duplicating the current folder', () => {
    expect(
      normalize115Breadcrumbs(
        [
          { cid: '0', name: '根目录' },
          { cid: '10', name: '电影' },
          { cid: '10', name: '电影' },
        ],
        '10',
      ),
    ).toEqual([
      { id: '0', name: '根目录' },
      { id: '10', name: '电影' },
    ]);
  });

  it('normalizes search results and pagination', () => {
    const result = normalize115SearchResult(
      {
        count: 1,
        data: [
          {
            fid: '30',
            cid: '0',
            fc: 1,
            n: '季度总结.md',
            s: 4096,
            te: '1729500000',
            ico: 'md',
          },
        ],
      },
      { query: '季度', offset: 0, limit: 100 },
    );

    expect(result.query).toBe('季度');
    expect(result.entries[0]?.name).toBe('季度总结.md');
    expect(result.hasMore).toBe(false);
  });
});
