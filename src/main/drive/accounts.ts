import type { DriveAccount } from '@shared/drive';
import { listSiteConnections } from '../connections/session-manager';
import { is115Connection } from './detection';

export async function listDriveAccounts(): Promise<readonly DriveAccount[]> {
  const connections = await listSiteConnections();

  return connections
    .filter((connection) => is115Connection(connection))
    .map((connection) => ({
      connectionId: connection.id,
      name: connection.name,
      loginUrl: connection.loginUrl,
      provider: '115' as const,
      status: connection.status,
      cookieCount: connection.cookieCount,
    }));
}
