import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id }
    });

    if (!dbUser) return unauthorized();

    return NextResponse.json({
        username: dbUser.username,
        balance: dbUser.balance.toString(),
        incentiveClaimed: dbUser.incentiveClaimed,
        hasPlayedOnce: dbUser.hasPlayedOnce,
        runCount: dbUser.runCount
    });
}
