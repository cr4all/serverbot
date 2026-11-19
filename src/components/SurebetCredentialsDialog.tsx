'use client';

import { useEffect, useId, useState } from 'react';
import type { IBotInstance } from '@/types';

type SiteKey = 'BETONLINE' | 'PS3838';

type Template = {
  _id: string;
  name?: string;
  type?: string;
};

type VpsOption = {
  _id: string;
  name: string;
  role: SiteKey;
  address: string;
  username: string;
  enabled: boolean;
};

type SiteAccount = {
  username: string;
  password: string;
};

const EMPTY_ACCOUNTS: Record<SiteKey, SiteAccount> = {
  BETONLINE: { username: '', password: '' },
  PS3838: { username: '', password: '' },
};

function siteLabel(site: SiteKey) {
  return site === 'BETONLINE' ? 'BetOnline' : 'PS3838';
}

function vpsIdOf(instance: IBotInstance | null): string {
  const raw = instance?.vpsId;
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw !== null && '_id' in raw) {
    return String((raw as { _id: unknown })._id ?? '');
  }
  return String(raw);
}

function maskedAccountOf(instance: IBotInstance | null): string {
  const account = instance?.config?.account as { username?: string; usernameMasked?: string } | undefined;
  return String(account?.usernameMasked || account?.username || '').trim();
}

export default function SurebetCredentialsDialog({
  open,
  onClose,
  onSuccess,
  mode = 'edit',
  deskId,
  deskName,
  betonline,
  ps3838,
  defaultName = 'Surebet bot',
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode?: 'create' | 'edit';
  deskId?: string;
  deskName?: string;
  betonline: IBotInstance | null;
  ps3838: IBotInstance | null;
  defaultName?: string;
}) {
  const titleId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [vpsNodes, setVpsNodes] = useState<VpsOption[]>([]);
  const [name, setName] = useState(defaultName);
  const [vpsIds, setVpsIds] = useState<Record<SiteKey, string>>({
    BETONLINE: '',
    PS3838: '',
  });
  const [accounts, setAccounts] = useState<Record<SiteKey, SiteAccount>>(EMPTY_ACCOUNTS);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(deskName || defaultName);
    setVpsIds({
      BETONLINE: vpsIdOf(betonline),
      PS3838: vpsIdOf(ps3838),
    });
    // Do not prefill usernames from the API — responses are masked and must not be re-saved as-is.
    setAccounts(EMPTY_ACCOUNTS);

    let cancelled = false;
    (async () => {
      try {
        const [botsRes, vpsRes] = await Promise.all([fetch('/api/bots'), fetch('/api/vps-nodes')]);
        if (botsRes.ok) {
          const data = await botsRes.json();
          if (!cancelled) {
            const list = (Array.isArray(data) ? data : []).filter((t: Template) =>
              ['BETONLINE', 'PS3838'].includes(String(t.type ?? '').toUpperCase())
            );
            setTemplates(list);
          }
        }
        if (vpsRes.ok) {
          const data = await vpsRes.json();
          if (!cancelled) {
            const nodes = Array.isArray(data?.nodes) ? (data.nodes as VpsOption[]) : [];
            setVpsNodes(nodes);
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, betonline, ps3838, deskName, defaultName]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const templateId = (site: SiteKey) =>
    templates.find((t) => String(t.type ?? '').toUpperCase() === site)?._id ?? '';

  const optionsFor = (site: SiteKey) => vpsNodes.filter((n) => n.role === site);

  const instanceFor = (site: SiteKey) => (site === 'BETONLINE' ? betonline : ps3838);

  const setAccountField = (site: SiteKey, field: keyof SiteAccount, value: string) => {
    setAccounts((prev) => ({
      ...prev,
      [site]: { ...prev[site], [field]: value },
    }));
  };

  const saveSite = async (site: SiteKey, instance: IBotInstance | null, groupId: string, botName: string) => {
    const vpsId = vpsIds[site].trim();
    if (!vpsId) throw new Error(`${siteLabel(site)} VPS is required`);

    const username = accounts[site].username.trim();
    const password = accounts[site].password;
    const hasSavedAccount = Boolean(maskedAccountOf(instance));

    if (mode === 'create') {
      if (!username) throw new Error(`${siteLabel(site)} username is required`);
      if (!password) throw new Error(`${siteLabel(site)} password is required`);
    } else if (password && !username) {
      throw new Error(`${siteLabel(site)} username is required when changing the password`);
    } else if (!hasSavedAccount && (!username || !password)) {
      throw new Error(`${siteLabel(site)} username and password are required`);
    }

    const accountPayload =
      username
        ? { account: { username, password } }
        : {};

    if (instance && mode === 'edit') {
      const res = await fetch(`/api/bot-instances/${instance._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${botName} · ${siteLabel(site)}`,
          vpsId,
          config: {
            ...(instance.config ?? {}),
            deskId: groupId,
            deskName: botName,
          },
          ...accountPayload,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to update ${siteLabel(site)}`);
      }
      return;
    }

    const botId = templateId(site);
    if (!botId) {
      throw new Error(`${siteLabel(site)} surebet template is missing. Run: npm run seed:surebet-templates`);
    }
    const res = await fetch('/api/bot-instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botId,
        name: `${botName} · ${siteLabel(site)}`,
        status: 'STOPPED',
        vpsId,
        config: { deskId: groupId, deskName: botName },
        ...accountPayload,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `Failed to create ${siteLabel(site)}`);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!vpsIds.BETONLINE.trim()) throw new Error('Select a BetOnline VPS');
      if (!vpsIds.PS3838.trim()) throw new Error('Select a PS3838 VPS');
      const botName = name.trim() || defaultName;
      const groupId =
        mode === 'create'
          ? typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `desk-${Date.now()}`
          : deskId || `desk-${Date.now()}`;
      if (mode === 'create') {
        await saveSite('BETONLINE', null, groupId, botName);
        await saveSite('PS3838', null, groupId, botName);
      } else {
        await saveSite('BETONLINE', betonline, groupId, botName);
        await saveSite('PS3838', ps3838, groupId, botName);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error)?.message || 'Could not save bot');
    } finally {
      setLoading(false);
    }
  };

  const SitePick = ({ site }: { site: SiteKey }) => {
    const options = optionsFor(site);
    const selected = options.find((n) => n._id === vpsIds[site]);
    const saved = maskedAccountOf(instanceFor(site));
    const account = accounts[site];
    return (
      <section className="sb-vps-pick">
        <div className="sb-vps-pick__label">
          <span className="sb-vps-pick__site">{siteLabel(site)}</span>
          {selected ? <span className="sb-vps-pick__hint">{selected.address}</span> : null}
        </div>
        <select
          className="sb-vps-pick__select"
          value={vpsIds[site]}
          disabled={loading || options.length === 0}
          onChange={(e) => setVpsIds((prev) => ({ ...prev, [site]: e.target.value }))}
          required
        >
          <option value="">{options.length === 0 ? 'No VPS available' : `Select ${siteLabel(site)} VPS`}</option>
          {options.map((n) => (
            <option key={n._id} value={n._id}>
              {n.name} · {n.address}
            </option>
          ))}
        </select>

        {mode === 'edit' && saved ? (
          <p className="sb-vps-pick__hint" style={{ marginTop: '0.55rem' }}>
            Saved account: {saved}
          </p>
        ) : null}

        <label className="sb-field" style={{ marginTop: '0.7rem' }}>
          <span>{siteLabel(site)} username</span>
          <input
            type="text"
            autoComplete="username"
            value={account.username}
            disabled={loading}
            onChange={(e) => setAccountField(site, 'username', e.target.value)}
            placeholder={mode === 'edit' && saved ? 'Leave blank to keep' : 'Bookmaker login'}
            required={mode === 'create'}
          />
        </label>

        <label className="sb-field" style={{ marginTop: '0.55rem' }}>
          <span>{siteLabel(site)} password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={account.password}
            disabled={loading}
            onChange={(e) => setAccountField(site, 'password', e.target.value)}
            placeholder={mode === 'edit' && saved ? 'Leave blank to keep' : 'Bookmaker password'}
            required={mode === 'create'}
          />
        </label>
      </section>
    );
  };

  return (
    <div
      className="sb-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <form className="sb-modal" onSubmit={submit}>
        <header className="sb-modal__header">
          <p className="sb-kicker">Surebet desk</p>
          <h2 id={titleId}>{mode === 'create' ? 'Create bot' : 'Edit bot'}</h2>
          <p>Pick a VPS and bookmaker login for BetOnline and PS3838.</p>
        </header>

        <div className="sb-modal__body">
          <label className="sb-field">
            <span>Bot name</span>
            <input
              type="text"
              value={name}
              disabled={loading}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main desk"
            />
          </label>

          <div className="sb-vps-stack">
            <SitePick site="BETONLINE" />
            <SitePick site="PS3838" />
          </div>
        </div>

        {error && <p className="sb-form-error">{error}</p>}

        <footer className="sb-modal__footer">
          <button type="button" className="sb-btn sb-btn--ghost" disabled={loading} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="sb-btn sb-btn--primary" disabled={loading}>
            {loading ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
          </button>
        </footer>
      </form>
    </div>
  );
}
