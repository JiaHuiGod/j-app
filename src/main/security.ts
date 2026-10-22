import { app, session } from 'electron';

function buildContentSecurityPolicy(): string {
  const isDevelopment = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  const developmentOrigin = isDevelopment
    ? new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin
    : null;
  const developmentSocketOrigin = developmentOrigin?.replace(/^http/, 'ws');

  const connectSources = [
    "'self'",
    'http://127.0.0.1:*',
    ...(developmentOrigin ? [developmentOrigin] : []),
    ...(developmentSocketOrigin ? [developmentSocketOrigin] : []),
  ];

  return [
    "default-src 'self'",
    isDevelopment ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: japp-local:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "media-src 'self' blob: http://127.0.0.1:* japp-local:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function installSecurityPolicies(): void {
  const contentSecurityPolicy = buildContentSecurityPolicy();

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...(details.responseHeaders ?? {}),
        'Content-Security-Policy': [contentSecurityPolicy],
      },
    });
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });
  });
}
