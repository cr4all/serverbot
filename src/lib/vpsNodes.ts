import connectDB from '@/lib/db';
import VpsNode from '@/models/VpsNode';
import BotInstance from '@/models/BotInstance';
import { decryptSecret, encryptSecret, credentialsKeyFromEnv } from '@/lib/credentialsCrypto';
import { isValidVpsAddress, readVpsConnection, type VpsConnection, type VpsRole } from '@/lib/vpsConfig';

export type VpsNodePublic = {
  _id: string;
  name: string;
  role: VpsRole;
  address: string;
  username: string;
  enabled: boolean;
};

export function toPublicVpsNode(doc: {
  _id: unknown;
  name?: string;
  role?: string;
  address?: string;
  username?: string;
  enabled?: boolean;
}): VpsNodePublic {
  return {
    _id: String(doc._id),
    name: String(doc.name ?? ''),
    role: String(doc.role ?? '').toUpperCase() as VpsRole,
    address: String(doc.address ?? ''),
    username: String(doc.username ?? ''),
    enabled: doc.enabled !== false,
  };
}

export async function listEnabledVpsNodes(role?: VpsRole): Promise<VpsNodePublic[]> {
  await connectDB();
  const filter: Record<string, unknown> = { enabled: true };
  if (role) filter.role = role;
  const rows = await VpsNode.find(filter).sort({ role: 1, name: 1 }).lean();
  return rows.map((r) => toPublicVpsNode(r as never));
}

export async function loadVpsConnectionById(vpsId: string): Promise<VpsConnection | null> {
  if (!vpsId) return null;
  await connectDB();
  const node = await VpsNode.findById(vpsId).lean<{
    address?: string;
    username?: string;
    passwordSecret?: string;
    enabled?: boolean;
  } | null>();
  if (!node || node.enabled === false) return null;
  const address = String(node.address ?? '').trim();
  const username = String(node.username ?? '').trim();
  if (!isValidVpsAddress(address) || !username || !node.passwordSecret) return null;
  const password = decryptSecret(String(node.passwordSecret), credentialsKeyFromEnv());
  return { address, username, password };
}

/**
 * Resolve BETONLINE / PS3838 connections for a dashboard user.
 * Prefers RUNNING surebet instances' vpsId; falls back to any instance with vpsId; then env.
 */
export async function resolveClientVpsConnections(
  clientId: string
): Promise<Partial<Record<VpsRole, VpsConnection>>> {
  await connectDB();
  const rows = await BotInstance.find({ userId: clientId })
    .populate('botId', 'type')
    .select('status vpsId botId')
    .lean();

  type Row = {
    status?: string;
    vpsId?: unknown;
    botId?: { type?: string } | null;
  };

  const byRole: Partial<Record<VpsRole, { vpsId: string; running: boolean }>> = {};
  for (const row of rows as Row[]) {
    const type = String(row.botId?.type ?? '').toUpperCase();
    if (type !== 'BETONLINE' && type !== 'PS3838') continue;
    const vpsId = row.vpsId ? String(row.vpsId) : '';
    if (!vpsId) continue;
    const running = String(row.status ?? '').toUpperCase() === 'RUNNING';
    const prev = byRole[type as VpsRole];
    if (!prev || (running && !prev.running)) {
      byRole[type as VpsRole] = { vpsId, running };
    }
  }

  const out: Partial<Record<VpsRole, VpsConnection>> = {};
  for (const role of ['BETONLINE', 'PS3838'] as VpsRole[]) {
    const picked = byRole[role];
    if (picked) {
      const conn = await loadVpsConnectionById(picked.vpsId);
      if (conn) {
        out[role] = conn;
        continue;
      }
    }
    const fromEnv = readVpsConnection(role);
    if (fromEnv) out[role] = fromEnv;
  }
  return out;
}

export function encryptVpsPassword(plain: string): string {
  return encryptSecret(plain, credentialsKeyFromEnv());
}
