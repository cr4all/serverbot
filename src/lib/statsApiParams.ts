import type { StatsPeriodType } from './bettingStats';

export interface ParsedStatsQuery {
    period: StatsPeriodType;
    offset: number;
    excludeMock?: boolean;
}

export function parseStatsQuery(searchParams: URLSearchParams): ParsedStatsQuery | { error: string } {
    const periodRaw = (searchParams.get('period') || 'month').toLowerCase();
    if (periodRaw !== 'week' && periodRaw !== 'month') {
        return { error: 'Invalid period (expected week or month)' };
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

    return { period: periodRaw, offset, excludeMock };
}
