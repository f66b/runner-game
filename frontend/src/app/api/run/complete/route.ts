import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { GameSimulation, RunParams, TICK_RATE } from '@/lib/game/simulation';
import { combineSeeds } from '@/lib/game/rng';

export async function POST(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    try {
        const body = await request.json();
        const { runId, inputs, finalBankroll, exitType } = body;

        const run = await prisma.run.findUnique({
            where: { id: runId }
        });

        if (!run || run.userId !== user.id) {
            return NextResponse.json({ error: 'Run not found' }, { status: 404 });
        }

        if (run.exitType) {
            return NextResponse.json({ error: 'Run already completed' }, { status: 400 });
        }

        // --- VERIFICATION START ---

        // 1. Reconstruct Simulation
        const params: RunParams = {
            difficulty: run.difficulty,
            percentMin: run.percentMin,
            percentMax: run.percentMax,
            curveMode: run.curveMode as any
        };

        const finalSeed = combineSeeds(run.serverSeed, run.clientSeed || '', run.id);
        const sim = new GameSimulation(
            finalSeed,
            params,
            run.lockedBankroll,
            run.runNonce
        );

        // 2. Replay Inputs
        // Sort inputs by tick to be safe
        inputs.sort((a: any, b: any) => a.tick - b.tick);

        const maxTick = 10 * 60 * 60; // Max 10 minutes run safety cap (36000 ticks)
        let currentInputIdx = 0;

        // Run loop until simulation ends or max ticks
        while (!sim.getState().isRunOver && sim.getState().tick < maxTick) {
            const state = sim.getState();

            // Apply inputs for this tick
            while (currentInputIdx < inputs.length && inputs[currentInputIdx].tick === state.tick) {
                sim.processInput(inputs[currentInputIdx]);
                currentInputIdx++;
            }

            // Simulate tick
            sim.tick();

            // Optimization: If user claims an early exit (e.g. forfeit/loss), 
            // the simulation might run longer if we don't catch it. 
            // In a strict verify, we run untill sim says run over.
            // If sim.isRunOver becomes true, loop breaks.
        }

        const finalState = sim.getState();
        const calculatedBankroll = finalState.bankroll;

        // 3. Compare Results
        // Allow tiny variance if float math issues (though using BigInt, so should be exact simulation)
        // Since we share exact code, it should be EXACT match.
        // We will trust the server calculation over the client claim.

        // --- VERIFICATION END ---

        // DB Transaction: Settle run
        await prisma.$transaction(async (tx) => {
            // Update Run
            await tx.run.update({
                where: { id: runId },
                data: {
                    endBankroll: calculatedBankroll,
                    exitType: finalState.exitType || 'forced_end',
                    eventsDigest: JSON.stringify(finalState.exitType), // Simple digest
                    endedAt: new Date()
                }
            });

            // Credit user balance from end bankroll
            if (calculatedBankroll > 0n) {
                await tx.user.update({
                    where: { id: user.id },
                    data: { balance: { increment: calculatedBankroll } }
                });
            }
        });

        return NextResponse.json({
            success: true,
            verifiedBankroll: calculatedBankroll.toString(),
            serverSeed: run.serverSeed, // Reveal seed
        });

    } catch (e) {
        console.error('Complete Run error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
