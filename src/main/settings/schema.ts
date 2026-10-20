import { z } from 'zod';
import {
  PROXY_PROTOCOLS,
  type AppSettings,
  type ProxySettings,
} from '@shared/settings';

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

export const appSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  network: z.object({
    proxy: proxySettingsSchema,
  }),
});

export function parseProxySettings(input: unknown): ProxySettings {
  const result = proxySettingsSchema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? '代理配置格式不正确。');
  }

  return result.data;
}

export function parseAppSettings(input: unknown): AppSettings {
  const result = appSettingsSchema.safeParse(input);

  if (!result.success) {
    throw new Error(
      result.error.issues.map((issue) => issue.message).join('; ') ||
        '应用配置格式不正确。',
    );
  }

  return result.data;
}
