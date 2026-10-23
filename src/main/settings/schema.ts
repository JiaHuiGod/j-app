import { z } from 'zod';
import { THEME_PREFERENCES, type ThemePreference } from '@shared/appearance';
import type {
  CreateSiteConnectionInput,
  SiteConnection,
} from '@shared/connections';
import {
  DEFAULT_WINDOW_STATE,
  PROXY_PROTOCOLS,
  type AppSettings,
  type ProxySettings,
  type WindowStateSettings,
} from '@shared/settings';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isAllowedLoginUrl(value: string): boolean {
  try {
    const url = new URL(value);

    if (url.protocol === 'https:') {
      return !url.username && !url.password;
    }

    return (
      url.protocol === 'http:' &&
      LOOPBACK_HOSTS.has(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function normalizeLoginUrl(value: string): string {
  const trimmed = value.trim();

  if (!isAllowedLoginUrl(trimmed)) {
    throw new Error(
      '登录地址必须是以 https:// 开头的有效地址，本地开发地址可以使用 http://localhost。',
    );
  }

  return new URL(trimmed).toString();
}

const proxySettingsSchema = z
  .object({
    enabled: z.boolean(),
    protocol: z.enum(PROXY_PROTOCOLS),
    host: z.string().trim().max(255),
    port: z.number().int().min(0).max(65535),
  })
  .superRefine((proxy, context) => {
    if (!proxy.enabled) {
      return;
    }

    if (!proxy.host) {
      context.addIssue({
        code: 'custom',
        message: '请输入代理主机地址。',
        path: ['host'],
      });
    } else if (/[\s/?#@]/.test(proxy.host)) {
      context.addIssue({
        code: 'custom',
        message: '代理主机地址格式不正确。',
        path: ['host'],
      });
    }

    if (proxy.port < 1) {
      context.addIssue({
        code: 'custom',
        message: '请输入 1 到 65535 之间的端口。',
        path: ['port'],
      });
    }
  });

const siteConnectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  loginUrl: z.string().refine(isAllowedLoginUrl, {
    message: '站点登录地址必须是有效的 HTTPS 地址。',
  }),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
  pinned: z.boolean().default(false),
});

const connectionsSchema = z
  .object({
    sites: z.array(siteConnectionSchema),
  })
  .superRefine(({ sites }, context) => {
    const ids = new Set<string>();

    for (const site of sites) {
      if (ids.has(site.id)) {
        context.addIssue({
          code: 'custom',
          message: '站点连接 ID 重复。',
        });
        return;
      }

      ids.add(site.id);
    }
  });

const legacyAppSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  network: z.object({
    proxy: proxySettingsSchema,
  }),
});

const versionTwoAppSettingsSchema = z.object({
  schemaVersion: z.literal(2),
  network: z.object({
    proxy: proxySettingsSchema,
  }),
  connections: connectionsSchema,
});

const appearanceSchema = z.object({
  theme: z.enum(THEME_PREFERENCES),
});

const downloadsSchema = z
  .object({
    directory: z.string().trim().max(4096).nullable(),
  })
  .default({ directory: null });

const subtitlesSchema = z
  .object({
    directory: z.string().trim().max(4096).nullable(),
  })
  .default({ directory: null });

const localVideoSchema = z
  .preprocess(
    (value) => {
      if (
        typeof value === 'object' &&
        value !== null &&
        !('directories' in value) &&
        'directory' in value
      ) {
        const legacy = (value as Record<string, unknown>).directory;

        return {
          directories:
            typeof legacy === 'string' && legacy.trim() ? [legacy] : [],
        };
      }

      return value;
    },
    z.object({
      directories: z.array(z.string().trim().max(4096)).max(50),
    }),
  )
  .default({ directories: [] });

const windowStateSchema = z
  .object({
    x: z.number().int().min(-100_000).max(100_000).nullable(),
    y: z.number().int().min(-100_000).max(100_000).nullable(),
    width: z.number().int().min(900).max(10_000),
    height: z.number().int().min(620).max(10_000),
    maximized: z.boolean(),
  })
  .default(DEFAULT_WINDOW_STATE);

const appSettingsSchema = z.object({
  schemaVersion: z.literal(3),
  network: z.object({
    proxy: proxySettingsSchema,
  }),
  connections: connectionsSchema,
  appearance: appearanceSchema,
  downloads: downloadsSchema,
  subtitles: subtitlesSchema,
  localVideo: localVideoSchema,
  windowState: windowStateSchema,
});

const createSiteConnectionInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  loginUrl: z.string().trim().min(1),
});

const siteConnectionIdSchema = z.string().uuid();

function formatSchemaError(error: z.ZodError): string {
  return (
    error.issues.map((issue) => issue.message).join('; ') || '配置格式不正确。'
  );
}

export function parseProxySettings(input: unknown): ProxySettings {
  const result = proxySettingsSchema.safeParse(input);

  if (!result.success) {
    throw new Error(formatSchemaError(result.error));
  }

  return result.data;
}

export function parseWindowState(input: unknown): WindowStateSettings {
  const result = windowStateSchema.safeParse(input);

  if (!result.success) {
    throw new Error(formatSchemaError(result.error));
  }

  return result.data;
}

export function parseAppSettings(input: unknown): AppSettings {
  if (
    typeof input === 'object' &&
    input !== null &&
    'schemaVersion' in input &&
    input.schemaVersion === 1
  ) {
    const legacyResult = legacyAppSettingsSchema.safeParse(input);

    if (!legacyResult.success) {
      throw new Error(formatSchemaError(legacyResult.error));
    }

    return {
      schemaVersion: 3,
      network: legacyResult.data.network,
      connections: {
        sites: [],
      },
      appearance: {
        theme: 'system',
      },
      downloads: {
        directory: null,
      },
      subtitles: {
        directory: null,
      },
      localVideo: {
        directories: [],
      },
      windowState: DEFAULT_WINDOW_STATE,
    };
  }

  if (
    typeof input === 'object' &&
    input !== null &&
    'schemaVersion' in input &&
    input.schemaVersion === 2
  ) {
    const versionTwoResult = versionTwoAppSettingsSchema.safeParse(input);

    if (!versionTwoResult.success) {
      throw new Error(formatSchemaError(versionTwoResult.error));
    }

    return {
      schemaVersion: 3,
      network: versionTwoResult.data.network,
      connections: versionTwoResult.data.connections,
      appearance: {
        theme: 'system',
      },
      downloads: {
        directory: null,
      },
      subtitles: {
        directory: null,
      },
      localVideo: {
        directories: [],
      },
      windowState: DEFAULT_WINDOW_STATE,
    };
  }

  const result = appSettingsSchema.safeParse(input);

  if (!result.success) {
    throw new Error(formatSchemaError(result.error));
  }

  return result.data;
}

export function parseThemePreference(input: unknown): ThemePreference {
  const result = appearanceSchema.shape.theme.safeParse(input);

  if (!result.success) {
    throw new Error('主题设置格式不正确。');
  }

  return result.data;
}

export function parseCreateSiteConnectionInput(
  input: unknown,
): CreateSiteConnectionInput {
  const result = createSiteConnectionInputSchema.safeParse(input);

  if (!result.success) {
    throw new Error(formatSchemaError(result.error));
  }

  return {
    name: result.data.name,
    loginUrl: normalizeLoginUrl(result.data.loginUrl),
  };
}

export function parseSiteConnectionId(input: unknown): string {
  const result = siteConnectionIdSchema.safeParse(input);

  if (!result.success) {
    throw new Error('站点连接 ID 格式不正确。');
  }

  return result.data;
}

export function isSiteConnection(value: unknown): value is SiteConnection {
  return siteConnectionSchema.safeParse(value).success;
}
