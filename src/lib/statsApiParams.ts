import type { StatsPeriodType } from './bettingStats';

export interface ParsedStatsQuery {
    period: StatsPeriodType;
    offset: number;
    excludeMock?: boolean;
}

export function parseStatsQuery(searchParams: URLSearchParams): ParsedStatsQuery | { error: string } {
    const periodRaw = (searchParams.get('period') || 'month').toLowerCase();
    const allowed = ['day', 'days7', 'days30', 'year', 'all', 'week', 'month'] as const;
    if (!allowed.includes(periodRaw as (typeof allowed)[number])) {
        return { error: `Invalid period (expected one of: ${allowed.join(', ')})` };
    }

    const offsetRaw = searchParams.get('offset');
    let offset = 0;
    if (offsetRaw != null && offsetRaw !== '') {
        const n = Number(offsetRaw);
        if (!Number.isFinite(n) || !Number.isInteger(n)) {
            return { error: 'Invalid offset (expected integer)' };
        }
        offset = n;
    }

    const excludeMockParam = searchParams.get('excludeMock');
    let excludeMock: boolean | undefined;
    if (excludeMockParam != null && excludeMockParam !== '') {
        excludeMock = excludeMockParam === 'true' || excludeMockParam === '1';
    }

    return { period: periodRaw as ParsedStatsQuery['period'], offset, excludeMock };
}
