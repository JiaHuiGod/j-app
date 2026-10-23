import { describe, expect, it } from 'vitest';
import { buildUpdateFeedUrl, isAutoUpdateSupported } from './feed';

describe('auto update feed', () => {
  it('builds the update.electronjs.org feed for a Windows release', () => {
    expect(
      buildUpdateFeedUrl('Nantoforget/j-app', '0.2.0', 'win32', 'x64'),
    ).toBe('https://update.electronjs.org/Nantoforget/j-app/win32-x64/0.2.0');
  });

  it('only enables updates for the packaged Windows x64 build', () => {
    expect(isAutoUpdateSupported(true, 'win32', 'x64')).toBe(true);
    expect(isAutoUpdateSupported(false, 'win32', 'x64')).toBe(false);
    expect(isAutoUpdateSupported(true, 'darwin', 'arm64')).toBe(false);
    expect(isAutoUpdateSupported(true, 'win32', 'arm64')).toBe(false);
  });
});
