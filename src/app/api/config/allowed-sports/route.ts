import { NextResponse } from 'next/server';
import { ALLOWED_SPORTS } from '@/lib/botInstanceFilters';

export async function GET() {
    return NextResponse.json({ sports: [...ALLOWED_SPORTS] });
}
