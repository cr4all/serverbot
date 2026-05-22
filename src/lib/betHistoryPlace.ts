/**
 * BetHistory place/submit helpers (PR1). Readers use placeStatus with legacy status fallback.
 */

export type PlaceStatus = 'SUCCESS' | 'FAILED';

export function getPlaceStatus(doc: { placeStatus?: string; status?: string } | null | undefined): PlaceStatus {
    if (!doc) return 'FAILED';
    const ps = doc.placeStatus ?? doc.status;
    return ps === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
}

export function normalizePlaceStatus(data: { status?: string }): PlaceStatus {
    return data?.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
}

export function initialSettlement(placeStatus: PlaceStatus) {
    if (placeStatus !== 'SUCCESS') return undefined;
    return {
        status: 'PENDING' as const,
        result: null,
        grossReturn: null,
        profit: null,
        settledAt: null,
        checkedAt: null,
        source: null,
        error: null,
    };
}
