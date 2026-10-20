import { session, type ProxyConfig, type Session } from 'electron';
import type {
  ProxySettings,
  ProxyTestResult,
  ProxyTestTargetResult,
} from '@shared/settings';
import { parseProxySettings } from '../settings/schema';

const PROXY_TEST_PARTITION = 'j-app-proxy-test';
const PROXY_TEST_TIMEOUT_MS = 8_000;
const PROXY_BYPASS_RULES = '<local>,localhost,127.0.0.1,::1';
const PROXY_TEST_TARGETS = [
  {
    id: 'google',
    label: 'Google',
    url: 'https://www.google.com/generate_204',
  },
  {
    id: 'github',
    label: 'GitHub',
    url: 'https://github.com/',
  },
] as const;

let activeTest: Promise<ProxyTestResult> | null = null;
let testSession: Session | null = null;

function formatProxyHost(host: string): string {
  if (host.startsWith('[') && host.endsWith(']')) {
    return host;
  }

  return host.includes(':') ? `[${host}]` : host;
}

export function createProxyConfig(proxy: ProxySettings): ProxyConfig {
  if (!proxy.enabled) {
    return { mode: 'system' };
  }

  const address = `${formatProxyHost(proxy.host)}:${proxy.port}`;

  return {
    mode: 'fixed_servers',
    proxyRules: `${proxy.protocol}://${address}`,
    proxyBypassRules: PROXY_BYPASS_RULES,
  };
}

export async function applyProxyToSession(
  targetSession: Session,
  proxy: ProxySettings,
): Promise<void> {
  await targetSession.setProxy(createProxyConfig(proxy));
  // Prevent pooled sockets from using the proxy configuration from before.
  await targetSession.closeAllConnections();
}

export async function applyProxySettings(proxy: ProxySettings): Promise<void> {
  await applyProxyToSession(session.defaultSession, proxy);
}

function getTestSession(): Session {
  testSession ??= session.fromPartition(PROXY_TEST_PARTITION, {
    cache: false,
  });

  return testSession;
}

function getFailureMessage(error: unknown): string {
  if (error instanceof Error) {
    if (
      error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      /timeout|timed out/i.test(error.message)
    ) {
      return '连接超时';
    }
  }

  return '连接失败';
}

async function testTarget(
  target: (typeof PROXY_TEST_TARGETS)[number],
  proxySession: Session,
): Promise<ProxyTestTargetResult> {
  const startedAt = performance.now();

  try {
    const response = await proxySession.fetch(target.url, {
      method: 'HEAD',
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(PROXY_TEST_TIMEOUT_MS),
    });
    const latencyMs = Math.round(performance.now() - startedAt);

    return {
      id: target.id,
      label: target.label,
      url: target.url,
      ok: response.ok,
      status: response.status,
      latencyMs,
      message: response.ok ? '连接成功' : `HTTP ${response.status}`,
    };
  } catch (error) {
    console.warn(`Proxy test failed for ${target.label}:`, error);

    return {
      id: target.id,
      label: target.label,
      url: target.url,
      ok: false,
      status: null,
      latencyMs: null,
      message: getFailureMessage(error),
    };
  }
}

async function runProxyTest(proxy: ProxySettings): Promise<ProxyTestResult> {
  const proxySession = getTestSession();

  await proxySession.setProxy(createProxyConfig(proxy));
  await proxySession.closeAllConnections();

  try {
    const results = await Promise.all(
      PROXY_TEST_TARGETS.map((target) => testTarget(target, proxySession)),
    );

    return {
      ok: results.every((result) => result.ok),
      testedAt: new Date().toISOString(),
      results,
    };
  } finally {
    await proxySession.closeAllConnections();
  }
}

export async function testProxySettings(
  input: unknown,
): Promise<ProxyTestResult> {
  const proxy = parseProxySettings(input);

  if (!proxy.enabled) {
    throw new Error('请先启用自定义代理。');
  }

  if (activeTest) {
    throw new Error('网络测试正在进行，请稍候。');
  }

  activeTest = runProxyTest(proxy).finally(() => {
    activeTest = null;
  });

  return activeTest;
}
