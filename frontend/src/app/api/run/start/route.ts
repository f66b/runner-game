import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { generateServerSeed, hashSeed } from '@/lib/game/rng';

export async function POST(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    try {
        const body = await request.json();
        const { lockedBankroll, difficulty, percentMin, percentMax, curveMode, clientSeed } = body;

        const amount = BigInt(lockedBankroll || '0');

        // Transaction: check balance, debit wallet, create run
        const run = await prisma.$transaction(async (tx) => {
            const dbUser = await tx.user.findUnique({
                where: { id: user.id }
            });

            if (!dbUser || dbUser.balance < amount) {
                throw new Error('Insufficient funds');
            }

            // Debit wallet
            await tx.user.update({
                where: { id: user.id },
                data: { balance: dbUser.balance - amount }
            });

            // Generate seeds
            const serverSeed = generateServerSeed();
            const seedCommit = hashSeed(serverSeed);
            const runNonce = dbUser.runCount + 1;

            // Create Run
            const newRun = await tx.run.create({
                data: {
                    userId: user.id,
                    difficulty: Number(difficulty),
                    percentMin: Number(percentMin),
                    percentMax: Number(percentMax),
                    curveMode: curveMode,
                    serverSeed,
                    seedCommit,
                    clientSeed: clientSeed || '',
                    startWalletBalance: dbUser.balance,
                    lockedBankroll: amount,
                    currentBankroll: amount, // Start with locked amount
                    runNonce,
                    exitType: null
                }
            });

            // Increment run count
            await tx.user.update({
                where: { id: user.id },
                data: { runCount: { increment: 1 } }
            });

            return newRun;
        });

        // Return run data (including server seed for client-side simulation)
        return NextResponse.json({
            runId: run.id,
            serverSeed: run.serverSeed,
            serverCommit: run.seedCommit,
            runNonce: run.runNonce,
            lockedBankroll: run.lockedBankroll.toString(),
            params: {
                difficulty: run.difficulty,
                percentMin: run.percentMin,
                percentMax: run.percentMax,
                curveMode: run.curveMode
            }
        });

    } catch (e: any) {
        if (e.message === 'Insufficient funds') {
            return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
        }
        console.error('Start Run error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
