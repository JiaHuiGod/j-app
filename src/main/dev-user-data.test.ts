import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEV_USER_DATA_DIRECTORY,
  getDevUserDataPaths,
  migrateDevUserData,
} from './dev-user-data';

let roots: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'japp-dev-user-data-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('development user data', () => {
  it('uses a dedicated directory next to the shared profile', () => {
    const appData = path.join(tmpdir(), 'japp-test-appdata');

    expect(getDevUserDataPaths(appData)).toEqual({
      legacyDirectory: path.join(appData, 'J App'),
      devDirectory: path.join(appData, 'J App Dev'),
    });
    expect(DEV_USER_DATA_DIRECTORY).toBe('J App Dev');
  });

  it('copies configuration, sessions and storage without caches', () => {
    const root = createRoot();
    const legacy = path.join(root, 'J App');
    const dev = path.join(root, 'J App Dev');

    mkdirSync(path.join(legacy, 'Partitions', 'japp-site-test', 'Cache'), {
      recursive: true,
    });
    mkdirSync(path.join(legacy, 'Partitions', 'japp-site-test', 'Network'), {
      recursive: true,
    });
    mkdirSync(path.join(legacy, 'Local Storage', 'leveldb'), {
      recursive: true,
    });
    mkdirSync(path.join(legacy, 'Cache'), { recursive: true });
    mkdirSync(path.join(legacy, 'GPUCache'), { recursive: true });

    writeFileSync(path.join(legacy, 'settings.json'), '{"schemaVersion":3}\n');
    writeFileSync(path.join(legacy, 'Local State'), '{"os_crypt":{}}\n');
    writeFileSync(
      path.join(legacy, 'Partitions', 'japp-site-test', 'Network', 'Cookies'),
      'cookies',
    );
    writeFileSync(
      path.join(legacy, 'Partitions', 'japp-site-test', 'Cache', 'data'),
      'cache',
    );
    writeFileSync(
      path.join(legacy, 'Local Storage', 'leveldb', '000001.log'),
      'storage',
    );
    writeFileSync(path.join(legacy, 'Cache', 'data'), 'cache');
    writeFileSync(path.join(legacy, 'GPUCache', 'data'), 'cache');
    writeFileSync(path.join(legacy, 'SingletonLock'), '');

    const result = migrateDevUserData(legacy, dev);

    expect(result.migrated).toBe(true);
    expect(result.failedEntries).toEqual([]);
    expect(readFileSync(path.join(dev, 'settings.json'), 'utf8')).toContain(
      '"schemaVersion":3',
    );
    expect(readFileSync(path.join(dev, 'Local State'), 'utf8')).toContain(
      'os_crypt',
    );
    expect(
      readFileSync(
        path.join(dev, 'Partitions', 'japp-site-test', 'Network', 'Cookies'),
        'utf8',
      ),
    ).toBe('cookies');
    expect(
      readFileSync(
        path.join(dev, 'Local Storage', 'leveldb', '000001.log'),
        'utf8',
      ),
    ).toBe('storage');
    expect(
      existsSync(path.join(dev, 'Partitions', 'japp-site-test', 'Cache')),
    ).toBe(false);
    expect(existsSync(path.join(dev, 'Cache'))).toBe(false);
    expect(existsSync(path.join(dev, 'GPUCache'))).toBe(false);
    expect(existsSync(path.join(dev, 'SingletonLock'))).toBe(false);
    expect(existsSync(path.join(dev, '.japp-dev-migration-v1'))).toBe(true);
  });

  it('does not overwrite existing dev files or migrate twice', () => {
    const root = createRoot();
    const legacy = path.join(root, 'J App');
    const dev = path.join(root, 'J App Dev');

    mkdirSync(legacy, { recursive: true });
    mkdirSync(dev, { recursive: true });
    writeFileSync(path.join(legacy, 'settings.json'), 'legacy');
    writeFileSync(path.join(dev, 'settings.json'), 'existing');

    const first = migrateDevUserData(legacy, dev);
    const second = migrateDevUserData(legacy, dev);

    expect(first.failedEntries).toEqual([]);
    expect(second.alreadyMigrated).toBe(true);
    expect(readFileSync(path.join(dev, 'settings.json'), 'utf8')).toBe(
      'existing',
    );
  });

  it('creates the dev directory when the shared profile does not exist', () => {
    const root = createRoot();
    const legacy = path.join(root, 'missing');
    const dev = path.join(root, 'J App Dev');

    const result = migrateDevUserData(legacy, dev);

    expect(result.migrated).toBe(false);
    expect(result.alreadyMigrated).toBe(false);
    expect(existsSync(dev)).toBe(true);
  });
});
