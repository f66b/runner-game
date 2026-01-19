import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function POST(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    try {
        const body = await request.json();
        const { amount } = body;

        if (!amount) {
            return NextResponse.json({ error: 'Amount required' }, { status: 400 });
        }

        // Validate amount (allow only positive)
        const newBalance = BigInt(amount);
        if (newBalance < 0n) {
            return NextResponse.json({ error: 'Negative balance not allowed' }, { status: 400 });
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { balance: newBalance }
        });

        return NextResponse.json({
            username: updatedUser.username,
            balance: updatedUser.balance.toString(),
            incentiveClaimed: updatedUser.incentiveClaimed,
            hasPlayedOnce: updatedUser.hasPlayedOnce,
            runCount: updatedUser.runCount
        });
    } catch (e) {
        console.error('Set balance error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
