import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BOTMANAGER_URL || 'http://localhost:4000';
        const res = await fetch(`${baseUrl}/admin/proxies/status`);
        if (!res.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch proxy status' },
                { status: res.status }
            );
        }
        const data = await res.json();
        return NextResponse.json(data);
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            { error: 'Failed to fetch proxy status' },
            { status: 500 }
        );
    }
}
