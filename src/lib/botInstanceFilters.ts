export const ALLOWED_SPORTS = [
    'Soccer',
    'Basketball',
    'Tennis',
    'Table Tennis',
    'Hockey',
    'Baseball',
    'Volleyball',
    'Handball',
    'Cricket',
    'Esports',
] as const;

export type AllowedSport = (typeof ALLOWED_SPORTS)[number];

export interface IBotTemplateRef {
    type?: string;
    subtype?: number;
    supportsTipFilters?: boolean;
}

/** Autonomous / non–tip-driven templates (e.g. Polymarket Crypto) skip sports/odds/edge filters. */
export function templateSupportsTipFilters(template: IBotTemplateRef | null | undefined): boolean {
    if (!template) return true;
    if (template.supportsTipFilters === false) return false;
    if (template.supportsTipFilters === true) return true;
    const type = String(template.type ?? '').toUpperCase();
    if (type === 'POLYMARKET' && Number(template.subtype) === 1) return false;
    return true;
}

/** Bookie login, locale, stake, and tip filters — hidden for autonomous bots. */
export function templateUsesBookieConfig(template: IBotTemplateRef | null | undefined): boolean {
    return templateSupportsTipFilters(template);
}

export const BOOKIE_TIP_FILTER_CONFIG_KEYS = [
    'minEdge',
    'maxEdge',
    'minOdds',
    'maxOdds',
    'sports',
    'username',
    'password',
    'locale',
    'stake',
] as const;

export function stripBookieAndTipFilterConfig(config: Record<string, unknown>): void {
    for (const key of BOOKIE_TIP_FILTER_CONFIG_KEYS) {
        delete config[key];
    }
}

const FILTER_NUMBER_KEYS = ['minEdge', 'maxEdge', 'minOdds', 'maxOdds'] as const;
const ALLOWED_SPORT_SET = new Set<string>(ALLOWED_SPORTS);

function parseOptionalNumber(value: unknown): number | undefined {
    if (value === '' || value === undefined || value === null) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
}

export function normalizeFilterConfig(config: Record<string, unknown>): Record<string, unknown> {
    const out = { ...config };

    for (const key of FILTER_NUMBER_KEYS) {
        const parsed = parseOptionalNumber(out[key]);
        if (parsed === undefined) {
            delete out[key];
        } else if (Number.isNaN(parsed)) {
            out[key] = NaN;
        } else {
            out[key] = parsed;
        }
    }

    if ('sports' in out) {
        const raw = out.sports;
        if (!Array.isArray(raw)) {
            delete out.sports;
        } else {
            const sports = [...new Set(raw.map(String).filter((s) => ALLOWED_SPORT_SET.has(s)))];
            if (sports.length === 0) {
                delete out.sports;
            } else {
                out.sports = sports;
            }
        }
    }

    return out;
}

export function validateFilterConfig(
    config: Record<string, unknown>
): { ok: true } | { ok: false; error: string } {
    for (const key of FILTER_NUMBER_KEYS) {
        const v = config[key];
        if (v === undefined) continue;
        if (typeof v !== 'number' || Number.isNaN(v)) {
            return { ok: false, error: `Invalid ${key}: must be a number` };
        }
    }

    const minEdge = config.minEdge as number | undefined;
    const maxEdge = config.maxEdge as number | undefined;
    if (minEdge !== undefined && minEdge < 0) {
        return { ok: false, error: 'minEdge must be >= 0' };
    }
    if (maxEdge !== undefined && maxEdge < 0) {
        return { ok: false, error: 'maxEdge must be >= 0' };
    }
    if (minEdge !== undefined && maxEdge !== undefined && maxEdge < minEdge) {
        return { ok: false, error: 'maxEdge must be >= minEdge' };
    }

    const minOdds = config.minOdds as number | undefined;
    const maxOdds = config.maxOdds as number | undefined;
    if (minOdds !== undefined && minOdds < 1) {
        return { ok: false, error: 'minOdds must be >= 1.0' };
    }
    if (maxOdds !== undefined && maxOdds < 1) {
        return { ok: false, error: 'maxOdds must be >= 1.0' };
    }
    if (minOdds !== undefined && maxOdds !== undefined && maxOdds < minOdds) {
        return { ok: false, error: 'maxOdds must be >= minOdds' };
    }

    if (config.sports !== undefined) {
        if (!Array.isArray(config.sports)) {
            return { ok: false, error: 'sports must be an array' };
        }
        for (const s of config.sports) {
            if (!ALLOWED_SPORT_SET.has(String(s))) {
                return { ok: false, error: `Invalid sport: ${s}` };
            }
        }
    }

    return { ok: true };
}

export function formatFilterSummary(config: Record<string, unknown>): string | null {
    const parts: string[] = [];

    const minEdge = config.minEdge as number | undefined;
    const maxEdge = config.maxEdge as number | undefined;
    if (minEdge !== undefined && maxEdge !== undefined) {
        parts.push(`Edge ${minEdge}–${maxEdge}%`);
    } else if (minEdge !== undefined) {
        parts.push(`Edge ≥${minEdge}%`);
    } else if (maxEdge !== undefined) {
        parts.push(`Edge ≤${maxEdge}%`);
    }

    const minOdds = config.minOdds as number | undefined;
    const maxOdds = config.maxOdds as number | undefined;
    if (minOdds !== undefined && maxOdds !== undefined) {
        parts.push(`Odds ${minOdds}–${maxOdds}`);
    } else if (minOdds !== undefined) {
        parts.push(`Odds ≥${minOdds}`);
    } else if (maxOdds !== undefined) {
        parts.push(`Odds ≤${maxOdds}`);
    }

    const sports = config.sports as string[] | undefined;
    if (sports?.length) {
        parts.push(sports.join(', '));
    }

    return parts.length > 0 ? parts.join(' · ') : null;
}

/** Map tip fields (percent, odds, sport) to instance filter config. Used at runtime in mainbot. */
export function getTipFilterSkipReason(
    tip: { percent?: number; edge?: number; odds?: unknown; sport?: string; opbookmaker?: string; payload?: { kind?: string } },
    config: Record<string, unknown>
): string | null {
    const hasEdgeFilter = config.minEdge != null || config.maxEdge != null;
    const hasOddsFilter = config.minOdds != null || config.maxOdds != null;
    const hasSportsFilter = Array.isArray(config.sports) && config.sports.length > 0;

    if (!hasEdgeFilter && !hasOddsFilter && !hasSportsFilter) {
        return null;
    }

    if (
        String(tip?.opbookmaker ?? '').toLowerCase() === 'copybot' &&
        String(tip?.payload?.kind ?? '').toUpperCase() === 'OPENBETS'
    ) {
        return null;
    }

    const edgeRaw = tip?.percent ?? tip?.edge;
    const edge = edgeRaw != null ? Number(edgeRaw) : NaN;

    if (hasEdgeFilter) {
        if (!Number.isFinite(edge)) {
            return 'Tip skipped: edge (percent) missing for instance filter';
        }
        const minEdge = config.minEdge as number | undefined;
        const maxEdge = config.maxEdge as number | undefined;
        if (minEdge != null && edge < minEdge) {
            return `Tip skipped: edge ${edge}% < minEdge ${minEdge}%`;
        }
        if (maxEdge != null && edge > maxEdge) {
            return `Tip skipped: edge ${edge}% > maxEdge ${maxEdge}%`;
        }
    }

    if (hasOddsFilter) {
        const rawOdds = tip?.odds;
        let odds: number | null = null;
        if (Array.isArray(rawOdds)) {
            const nums = rawOdds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
            odds = nums.length ? nums.reduce((acc, n) => acc * n, 1) : null;
        } else if (rawOdds != null) {
            const n = Number(rawOdds);
            odds = Number.isFinite(n) && n > 0 ? n : null;
        }
        if (odds == null) {
            return 'Tip skipped: odds missing for instance filter';
        }
        const minOdds = config.minOdds as number | undefined;
        const maxOdds = config.maxOdds as number | undefined;
        if (minOdds != null && odds < minOdds) {
            return `Tip skipped: odds ${odds} < minOdds ${minOdds}`;
        }
        if (maxOdds != null && odds > maxOdds) {
            return `Tip skipped: odds ${odds} > maxOdds ${maxOdds}`;
        }
    }

    if (hasSportsFilter) {
        const tipSport = tip?.sport;
        if (!tipSport) {
            return 'Tip skipped: sport missing for instance filter';
        }
        const allowed = (config.sports as string[]).map((s) => String(s).toLowerCase());
        const tipNorm = String(tipSport).toLowerCase();
        const esportsTips = new Set([
            'counter-strike', 'dota 2', 'league of legends', 'valorant', 'esports', 'e-sports',
        ]);
        const matches = allowed.some((a) => {
            if (a === tipNorm) return true;
            if ((a === 'soccer' || a === 'football') && (tipNorm === 'soccer' || tipNorm === 'football')) return true;
            if (a === 'esports' && esportsTips.has(tipNorm)) return true;
            return false;
        });
        if (!matches) {
            return `Tip skipped: sport "${tipSport}" not in allowed list`;
        }
    }

    return null;
}

export function tipMatchesInstanceFilters(
    tip: Parameters<typeof getTipFilterSkipReason>[0],
    config: Record<string, unknown>
): boolean {
    return getTipFilterSkipReason(tip, config) == null;
}
