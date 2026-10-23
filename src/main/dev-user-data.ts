import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export const DEV_USER_DATA_DIRECTORY = 'J App Dev';

const LEGACY_USER_DATA_DIRECTORY = 'J App';
const MIGRATION_MARKER = '.japp-dev-migration-v1';
const EXCLUDED_NAMES = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'GrShaderCache',
  'ShaderCache',
  'Crashpad',
  'logs',
  'SingletonLock',
  'SingletonCookie',
  'SingletonSocket',
  'lockfile',
  'DevToolsActivePort',
]);

export interface DevUserDataPaths {
  readonly legacyDirectory: string;
  readonly devDirectory: string;
}

export interface DevUserDataMigrationResult {
  readonly migrated: boolean;
  readonly alreadyMigrated: boolean;
  readonly copiedEntries: readonly string[];
  readonly failedEntries: readonly string[];
}

export function getDevUserDataPaths(
  appDataDirectory: string,
): DevUserDataPaths {
  return {
    legacyDirectory: path.join(appDataDirectory, LEGACY_USER_DATA_DIRECTORY),
    devDirectory: path.join(appDataDirectory, DEV_USER_DATA_DIRECTORY),
  };
}

/**
 * Copy the shared development profile into its dedicated directory without
 * touching the original. The original remains available to packaged builds.
 *
 * Existing files in the development directory are never overwritten, so a
 * partially completed copy can be retried on the next launch without destroying
 * changes made after the first attempt.
 */
export function migrateDevUserData(
  legacyDirectory: string,
  devDirectory: string,
): DevUserDataMigrationResult {
  mkdirSync(devDirectory, { recursive: true });

  const markerPath = path.join(devDirectory, MIGRATION_MARKER);

  if (existsSync(markerPath)) {
    return {
      migrated: false,
      alreadyMigrated: true,
      copiedEntries: [],
      failedEntries: [],
    };
  }

  if (!existsSync(legacyDirectory)) {
    return {
      migrated: false,
      alreadyMigrated: false,
      copiedEntries: [],
      failedEntries: [],
    };
  }

  if (path.resolve(legacyDirectory) === path.resolve(devDirectory)) {
    return {
      migrated: false,
      alreadyMigrated: true,
      copiedEntries: [],
      failedEntries: [],
    };
  }

  const copiedEntries: string[] = [];
  const failedEntries: string[] = [];

  for (const entry of readdirSync(legacyDirectory, { withFileTypes: true })) {
    if (EXCLUDED_NAMES.has(entry.name) || entry.name === MIGRATION_MARKER) {
      continue;
    }

    const source = path.join(legacyDirectory, entry.name);
    const destination = path.join(devDirectory, entry.name);

    try {
      cpSync(source, destination, {
        recursive: true,
        force: false,
        errorOnExist: false,
        filter: (sourcePath) => !EXCLUDED_NAMES.has(path.basename(sourcePath)),
      });
      copiedEntries.push(entry.name);
    } catch (error) {
      console.error(`Failed to migrate ${entry.name}:`, error);
      failedEntries.push(entry.name);
    }
  }

  if (failedEntries.length === 0) {
    writeFileSync(
      markerPath,
      `${JSON.stringify(
        {
          source: legacyDirectory,
          migratedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  return {
    migrated: copiedEntries.length > 0,
    alreadyMigrated: false,
    copiedEntries,
    failedEntries,
  };
}

export function configureDevUserData(): void {
  if (app.isPackaged || app.commandLine.hasSwitch('user-data-dir')) {
    return;
  }

  const { legacyDirectory, devDirectory } = getDevUserDataPaths(
    app.getPath('appData'),
  );

  try {
    const result = migrateDevUserData(legacyDirectory, devDirectory);

    if (result.copiedEntries.length > 0) {
      console.info(
        `[dev] Copied ${result.copiedEntries.length} entries from ${legacyDirectory} to ${devDirectory}`,
      );
    }

    if (result.failedEntries.length > 0) {
      console.warn(
        `[dev] Some profile entries could not be copied and will be retried: ${result.failedEntries.join(', ')}`,
      );
    }
  } catch (error) {
    console.error('Failed to migrate development user data:', error);
  }

  app.setPath('userData', devDirectory);
}
