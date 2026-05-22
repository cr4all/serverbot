import type { StatsPeriodType } from '@/types';

export type PeriodPreset = '7d' | '30d' | 'week' | 'last-week' | 'month' | 'last-month';

export const PERIOD_PRESETS: { id: PeriodPreset; label: string }[] = [
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
    { id: 'week', label: 'This week' },
    { id: 'last-week', label: 'Last week' },
    { id: 'month', label: 'This month' },
    { id: 'last-month', label: 'Last month' },
];

export function presetToApiQuery(preset: PeriodPreset): { period: StatsPeriodType; offset: number } {
    switch (preset) {
        case '7d':
        case 'week':
            return { period: 'week', offset: 0 };
        case 'last-week':
            return { period: 'week', offset: -1 };
        case '30d':
        case 'month':
            return { period: 'month', offset: 0 };
        case 'last-month':
            return { period: 'month', offset: -1 };
        default:
            return { period: 'month', offset: 0 };
    }
}
