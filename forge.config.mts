import { fileURLToPath } from 'node:url';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const iconBase = fileURLToPath(new URL('./resources/icon', import.meta.url));

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // Packager picks icon.ico on Windows, icon.icns on macOS and icon.png on Linux.
    icon: iconBase,
    extraResource: [`${iconBase}.png`],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      setupIcon: `${iconBase}.ico`,
      remoteReleases: process.env.JAPP_UPDATE_BASE_URL,
      noDelta: false,
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({ options: { icon: `${iconBase}.png` } }),
    new MakerDeb({ options: { icon: `${iconBase}.png` } }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // Main and preload bundles are rebuilt when their source changes.
      hotRestart: true,
      build: [
        {
          // Named entries keep stable main.cjs / preload.cjs output filenames.
          entry: { main: 'src/main/index.ts' },
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: { preload: 'src/preload/index.ts' },
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses harden the packaged app. Keep them enabled for every release.
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
