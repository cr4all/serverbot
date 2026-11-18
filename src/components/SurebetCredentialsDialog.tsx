'use client';

import { useEffect, useId, useState } from 'react';
import type { IBotInstance } from '@/types';

type SiteKey = 'BETONLINE' | 'PS3838';

type SiteForm = {
  username: string;
  password: string;
};

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

function siteLabel(site: SiteKey) {
  return site === 'BETONLINE' ? 'BetOnline' : 'PS3838';
}

function maskUsername(value: string | undefined) {
  const v = String(value ?? '').trim();
  if (!v) return 'Not set';
  const at = v.indexOf('@');
  if (at > 1) return `${v[0]}•••${v.slice(at)}`;
  return v.length <= 2 ? '•••' : `${v[0]}•••`;
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
  const [forms, setForms] = useState<Record<SiteKey, SiteForm>>({
    BETONLINE: { username: '', password: '' },
    PS3838: { username: '', password: '' },
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(deskName || defaultName);
    setVpsIds({
      BETONLINE: vpsIdOf(betonline),
      PS3838: vpsIdOf(ps3838),
    });
    setForms({
      BETONLINE: {
        username: String((betonline?.config as { account?: { username?: string } } | undefined)?.account?.username ?? ''),
        password: '',
      },
      PS3838: {
        username: String((ps3838?.config as { account?: { username?: string } } | undefined)?.account?.username ?? ''),
        password: '',
      },
    });

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

  const saveSite = async (site: SiteKey, instance: IBotInstance | null, groupId: string, botName: string) => {
    const username = forms[site].username.trim();
    const password = forms[site].password;
    const vpsId = vpsIds[site].trim();
    if (!vpsId) throw new Error(`${siteLabel(site)} VPS is required`);
    if (!username && !password && mode === 'edit' && instance) {
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
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to update ${siteLabel(site)}`);
      }
      return;
    }
    if (!username) throw new Error(`${siteLabel(site)} login ID is required`);
    if (!instance && !password) throw new Error(`${siteLabel(site)} password is required for first save`);

    if (instance && mode === 'edit') {
      const body: Record<string, unknown> = {
        name: `${botName} · ${siteLabel(site)}`,
        vpsId,
        config: {
          ...(instance.config ?? {}),
          deskId: groupId,
          deskName: botName,
        },
        account: { username, password },
      };
      const res = await fetch(`/api/bot-instances/${instance._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
        account: { username, password },
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
        mode === 'create' ? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `desk-${Date.now()}`) : deskId || `desk-${Date.now()}`;
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
      setError((err as Error)?.message || 'Could not save credentials');
    } finally {
      setLoading(false);
    }
  };

  const SiteFields = ({ site }: { site: SiteKey }) => {
    const instance = site === 'BETONLINE' ? betonline : ps3838;
    const stored = String((instance?.config as { account?: { username?: string } } | undefined)?.account?.username ?? '');
    const options = optionsFor(site);
    return (
      <section className="sb-credential-pane">
        <div className="sb-credential-pane__head">
          <h3>{siteLabel(site)}</h3>
          {mode === 'edit' && (
            <span className={stored ? 'sb-pill sb-pill--ready' : 'sb-pill sb-pill--missing'}>
              {stored ? `Saved · ${maskUsername(stored)}` : 'Missing'}
            </span>
          )}
        </div>
        <label className="sb-field">
          <span>VPS</span>
          <select
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
        </label>
        <label className="sb-field">
          <span>Login ID</span>
          <input
            type="text"
            autoComplete="username"
            value={forms[site].username}
            disabled={loading}
            onChange={(e) => setForms((prev) => ({ ...prev, [site]: { ...prev[site], username: e.target.value } }))}
            placeholder="Username, email, or login ID"
          />
        </label>
        <label className="sb-field">
          <span>Password {mode === 'edit' && instance ? <em>(leave blank to keep current)</em> : null}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={forms[site].password}
            disabled={loading}
            onChange={(e) => setForms((prev) => ({ ...prev, [site]: { ...prev[site], password: e.target.value } }))}
            placeholder="Account password"
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
          <p className="sb-kicker">Surebet bot</p>
          <h2 id={titleId}>{mode === 'create' ? 'Create surebet bot' : 'Bot credentials'}</h2>
          <p>Pick a separate VPS for each bookmaker, then enter both logins. Bets only run as a paired trade.</p>
        </header>

        <div style={{ padding: '0.2rem 1.4rem 0' }}>
          <label className="sb-field">
            <span>Bot name</span>
            <input
              type="text"
              value={name}
              disabled={loading}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main surebet desk"
            />
          </label>
        </div>

        <div className="sb-credential-grid">
          <SiteFields site="BETONLINE" />
          <SiteFields site="PS3838" />
        </div>

        {error && <p className="sb-form-error">{error}</p>}

        <footer className="sb-modal__footer">
          <button type="button" className="sb-btn sb-btn--ghost" disabled={loading} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="sb-btn sb-btn--primary" disabled={loading}>
            {loading ? 'Saving…' : mode === 'create' ? 'Create bot' : 'Save credentials'}
          </button>
        </footer>
      </form>
    </div>
  );
}
