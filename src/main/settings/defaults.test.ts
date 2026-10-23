import { describe, expect, it } from 'vitest';
import { createDefaultAppSettings } from './defaults';

describe('default app settings', () => {
  it('starts new installs in light mode', () => {
    expect(createDefaultAppSettings().appearance.theme).toBe('light');
  });

  it('uses the system download location by default', () => {
    expect(createDefaultAppSettings().downloads.directory).toBeNull();
  });

  it('does not load local subtitles until a directory is configured', () => {
    expect(createDefaultAppSettings().subtitles.directory).toBeNull();
  });

  it('does not load a local video library until a directory is configured', () => {
    expect(createDefaultAppSettings().localVideo.directories).toEqual([]);
  });

  it('uses a centered default window size', () => {
    expect(createDefaultAppSettings().windowState).toEqual({
      x: null,
      y: null,
      width: 1180,
      height: 760,
      maximized: false,
    });
  });
});
