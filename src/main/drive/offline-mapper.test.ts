import { describe, expect, it } from 'vitest';
import { normalize115OfflineTaskList } from './offline-mapper';

describe('115 offline task normalization', () => {
  it('maps task progress, status and pagination', () => {
    const result = normalize115OfflineTaskList(
      {
        page: 1,
        page_count: 2,
        count: 31,
        tasks: [
          {
            info_hash: 'finished-hash',
            name: '<b>Finished</b> file',
            size: 1024,
            percentDone: 100,
            display_percent: 100,
            status: 2,
            display_status: 'finished',
            status_text: '下载成功',
            rateDownload: 0,
            add_time: 1729500000,
            wp_path_id: '10',
          },
          {
            info_hash: 'downloading-hash',
            name: 'Downloading file',
            size: 2048,
            percentDone: 42.6,
            rateDownload: 1024,
            status: 1,
            display_status: 'downloading',
            add_time: 1729500100,
            wp_path_id: '20',
          },
        ],
      },
      1,
    );

    expect(result.page).toBe(1);
    expect(result.pageCount).toBe(2);
    expect(result.total).toBe(31);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0]).toMatchObject({
      name: 'Finished file',
      progress: 100,
      status: 'finished',
      statusText: '下载成功',
      targetFolderId: '10',
    });
    expect(result.tasks[1]).toMatchObject({
      progress: 43,
      rate: 1024,
      status: 'downloading',
      targetFolderId: '20',
    });
  });
});
