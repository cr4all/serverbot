import type { StatsPeriodType } from '@/types';

export type PeriodPreset = 'today' | 'week' | 'month' | 'year' | 'all';

export const PERIOD_PRESETS: { id: PeriodPreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: '1 week' },
    { id: 'month', label: '1 month' },
    { id: 'year', label: '1 year' },
    { id: 'all', label: 'All' },
];

export function presetToApiQuery(preset: PeriodPreset): { period: StatsPeriodType; offset: number } {
    switch (preset) {
        case 'today':
            return { period: 'day', offset: 0 };
        case 'week':
            return { period: 'days7', offset: 0 };
        case 'month':
            return { period: 'days30', offset: 0 };
        case 'year':
            return { period: 'year', offset: 0 };
        case 'all':
            return { period: 'all', offset: 0 };
        default:
            return { period: 'days30', offset: 0 };
    }
}
