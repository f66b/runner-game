import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { generateServerSeed, hashSeed, combineSeeds } from './game/rng.js';
import { GameSimulation, RunParams, InputEvent, TICK_RATE, GameState } from './game/simulation.js';

// ============ Config ============

const PORT = parseInt(process.env.PORT || '3001');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';

// ============ Initialize ============

const prisma = new PrismaClient();
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/run' });

// Active game sessions
const activeSessions = new Map<string, GameSession>();

interface GameSession {
    runId: string;
    userId: string;
    username: string;
    simulation: GameSimulation;
    ws: WebSocket;
    tickInterval: NodeJS.Timeout | null;
    serverSeed: string;
    clientSeed: string;
    params: RunParams;
    lockedBankroll: bigint;
    startWalletBalance: bigint;
    runNonce: number;
}

// ============ Middleware ============

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

// Auth middleware
interface AuthRequest extends Request {
    userId?: string;
    username?: string;
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
        req.userId = decoded.userId;
        req.username = decoded.username; // changed from userWallet to username
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// ============ Auth Routes ============

app.post('/auth/login', async (req: Request, res: Response) => {
    const { username } = req.body;
    if (!username) {
        res.status(400).json({ error: 'Username required' });
        return;
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
        // Give new users a default balance of $10,000 for fun
        user = await prisma.user.create({
            data: {
                username,
                balance: BigInt(10000 * 1000000) // $10,000 * 10^6
            }
        });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            runCount: user.runCount
        }
    });
});

// ============ Wallet Routes ============

app.get('/wallet/balance', authMiddleware, async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }

    res.json({
        username: user.username,
        balance: user.balance.toString(),
        incentiveClaimed: user.incentiveClaimed,
        hasPlayedOnce: user.hasPlayedOnce,
        runCount: user.runCount,
    });
});

app.post('/wallet/set-balance', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { amount } = req.body;
    if (!amount) {
        res.status(400).json({ error: 'Amount required' });
        return;
    }

    try {
        const newBalance = BigInt(amount);
        const user = await prisma.user.update({
            where: { id: req.userId },
            data: { balance: newBalance }
        });

        res.json({
            username: user.username,
            balance: user.balance.toString()
        });
    } catch (e) {
        res.status(400).json({ error: 'Invalid amount' });
    }
});

// ============ Run Routes ============

app.post('/run/start', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { lockedBankroll, difficulty, percentMin, percentMax, curveMode, clientSeed } = req.body;

    // Validate parameters
    if (difficulty < 0 || difficulty > 100) {
        res.status(400).json({ error: 'Difficulty must be 0-100' });
        return;
    }
    if (percentMin < 0 || percentMax > 100 || percentMin >= percentMax) {
        res.status(400).json({ error: 'Invalid percent range' });
        return;
    }
    if (!['static', 'proportional', 'disproportional'].includes(curveMode)) {
        res.status(400).json({ error: 'Invalid curve mode' });
        return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }

    const lockedAmount = BigInt(lockedBankroll);
    if (user.balance < lockedAmount) {
        res.status(400).json({ error: 'Insufficient balance' });
        return;
    }

    // Deduct locked bankroll immediately
    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { balance: { decrement: lockedAmount } }
    });

    // Generate server seed
    const serverSeed = generateServerSeed();
    const seedCommit = hashSeed(serverSeed);

    // Get next run nonce
    const lastRun = await prisma.run.findFirst({
        where: { userId: user.id },
        orderBy: { runNonce: 'desc' },
    });
    const runNonce = (lastRun?.runNonce || 0) + 1;

    // Create run record
    const run = await prisma.run.create({
        data: {
            userId: user.id,
            difficulty,
            percentMin,
            percentMax,
            curveMode,
            serverSeed,
            seedCommit,
            clientSeed: clientSeed || uuidv4(),
            startWalletBalance: user.balance, // Balance *before* deduction, or current? Let's trace it. Usually visual. Let's use current balance.
            lockedBankroll: lockedAmount,
            currentBankroll: lockedAmount,
            runNonce,
        },
    });

    // Update user run count
    await prisma.user.update({
        where: { id: user.id },
        data: { runCount: { increment: 1 } },
    });

    res.json({
        runId: run.id,
        serverCommit: seedCommit,
        runNonce,
        params: { difficulty, percentMin, percentMax, curveMode },
    });
});

app.post('/run/checkpoint/exit', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { runId } = req.body;

    const session = activeSessions.get(runId);
    if (!session || session.userId !== req.userId) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }

    try {
        session.simulation.exitSafe();
        await finalizeRun(session, 'safe');
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
});

app.post('/run/checkpoint/pause', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { runId } = req.body;

    const session = activeSessions.get(runId);
    if (!session || session.userId !== req.userId) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }

    try {
        session.simulation.pause();
        const snapshot = session.simulation.getSnapshot();

        await prisma.run.update({
            where: { id: runId },
            data: { snapshot, pausedAt: new Date() },
        });

        await finalizeRun(session, 'pause');
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
});

app.post('/run/resume', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { runId } = req.body;

    const run = await prisma.run.findFirst({
        where: { id: runId, userId: req.userId, exitType: 'pause' },
    });

    if (!run || !run.snapshot) {
        res.status(404).json({ error: 'Paused run not found' });
        return;
    }

    // Clear pause state
    await prisma.run.update({
        where: { id: runId },
        data: { exitType: null, pausedAt: null },
    });

    // Note: When resuming, we don't re-deduct balance because it was "refunded" on pause?
    // Wait, let's look at finalizeRun. 
    // If we pause, we should probably credit user back their *current* bankroll so they can't double spend,
    // AND we must ensure they lock it again when resuming.
    // Simplifying for mock economy: 
    // When pausing, we finalize and give them their money. 
    // When resuming, we should DEDUCT the money again from their balance.

    // Check balance for resume
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }

    // The amount to lock is the current bankroll from the run state
    const currentBankroll = run.endBankroll || BigInt(0); // This was saved on pause

    if (user.balance < currentBankroll) {
        res.status(400).json({ error: 'Insufficient balance to resume' });
        return;
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { balance: { decrement: currentBankroll } }
    });

    res.json({
        runId: run.id,
        snapshot: run.snapshot,
        params: {
            difficulty: run.difficulty,
            percentMin: run.percentMin,
            percentMax: run.percentMax,
            curveMode: run.curveMode,
        },
    });
});

// ============ WebSocket Handler ============

wss.on('connection', async (ws: WebSocket, req) => {
    console.log('WS: Connection attempt', req.url);
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const runId = url.searchParams.get('runId');
    const token = url.searchParams.get('token');

    if (!runId || !token) {
        console.log('WS: Missing params');
        ws.close(4000, 'Missing runId or token');
        return;
    }

    // Verify token
    let userId: string;
    let username: string;
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
        userId = decoded.userId;
        username = decoded.username;
        console.log('WS: Authenticated user', username);
    } catch (err) {
        console.log('WS: Invalid token', err);
        ws.close(4001, 'Invalid token');
        return;
    }

    // Get run
    const run = await prisma.run.findFirst({
        where: { id: runId, userId },
        include: { user: true },
    });

    if (!run) {
        ws.close(4004, 'Run not found');
        return;
    }

    // Check if resuming from pause
    let simulation: GameSimulation;
    const params: RunParams = {
        difficulty: run.difficulty,
        percentMin: run.percentMin,
        percentMax: run.percentMax,
        curveMode: run.curveMode as RunParams['curveMode'],
    };

    const combinedSeed = combineSeeds(run.serverSeed, run.clientSeed || '', run.id);

    // If resuming, we need to know the bankroll to start with.
    // If it's a fresh run, it's lockedBankroll.
    // If resume, it's whatever was in the snapshot/saved state.
    // The simulation reconstruction from snapshot handles internal state.

    if (run.snapshot && run.exitType === null) {
        // Resume from snapshot
        simulation = GameSimulation.fromSnapshot(run.snapshot, combinedSeed, params, run.user.runCount);
    } else {
        // New run
        simulation = new GameSimulation(
            combinedSeed,
            params,
            run.lockedBankroll,
            run.user.runCount
        );
    }

    const session: GameSession = {
        runId: run.id,
        userId,
        username,
        simulation,
        ws,
        tickInterval: null,
        serverSeed: run.serverSeed,
        clientSeed: run.clientSeed || '',
        params,
        lockedBankroll: run.lockedBankroll, // Note: For resume this might technically be different but Simulation handles logic
        startWalletBalance: run.startWalletBalance,
        runNonce: run.runNonce,
    };

    activeSessions.set(runId, session);

    // Send initial state
    ws.send(JSON.stringify({
        type: 'init',
        state: serializeState(simulation.getState()),
        params,
    }));

    // Start game loop
    session.tickInterval = setInterval(() => {
        if (simulation.getState().isRunOver) {
            if (session.tickInterval) {
                clearInterval(session.tickInterval);
                session.tickInterval = null;
            }
            return;
        }

        const state = simulation.tick();
        ws.send(JSON.stringify({
            type: 'state',
            state: serializeState(state),
        }));

        // Send checkpoint notification
        if (state.isCheckpointWindow && Math.floor(state.checkpointWindowTimer * 10) % 10 === 0) {
            ws.send(JSON.stringify({
                type: 'checkpoint',
                timeRemaining: state.checkpointWindowTimer,
            }));
        }
    }, 1000 / TICK_RATE);

    // Handle messages
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.type === 'input') {
                const input: InputEvent = {
                    type: msg.action,
                    tick: simulation.getState().tick,
                };
                simulation.processInput(input);
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    // Handle disconnect
    ws.on('close', async () => {
        if (session.tickInterval) {
            clearInterval(session.tickInterval);
        }

        // Grace period for reconnection (handles refresh/strict mode)
        setTimeout(async () => {
            const currentSession = activeSessions.get(runId);

            // Only clean up if this is still the active session (no reconnection happened)
            if (currentSession === session) {
                const state = simulation.getState();

                // If run is not over and not in checkpoint window, forfeit
                if (!state.isRunOver && !state.isCheckpointWindow) {
                    console.log(`Run ${runId} forfeited due to disconnect`);
                    simulation.forfeit();
                    await finalizeRun(session, 'forfeit');
                }

                activeSessions.delete(runId);
            } else {
                console.log(`Run ${runId} reconnected, skipping disconnect cleanup`);
            }
        }, 2000);
    });
});

// ============ Helper Functions ============

function serializeState(state: GameState): Record<string, unknown> {
    return {
        ...state,
        bankroll: state.bankroll.toString(),
    };
}

async function finalizeRun(session: GameSession, exitType: string) {
    const state = session.simulation.getState();
    const endBankroll = state.bankroll;

    // Update run in database
    await prisma.run.update({
        where: { id: session.runId },
        data: {
            endBankroll,
            exitType,
            seedReveal: session.serverSeed,
            endedAt: new Date(),
        },
    });

    // Credit user's wallet with the end bankroll
    // Since we deducted the lockedBankroll at start, we just add the end result.
    // Net result = (Initial - Locked) + End
    await prisma.user.update({
        where: { id: session.userId },
        data: {
            balance: { increment: endBankroll },
            hasPlayedOnce: true
        }
    });

    // Send to client
    if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify({
            type: 'run_complete',
            exitType,
            endBankroll: endBankroll.toString(),
            netDelta: (endBankroll - session.lockedBankroll).toString(),
            serverSeed: session.serverSeed,
        }));
        session.ws.close();
    }

    // Clear interval
    if (session.tickInterval) {
        clearInterval(session.tickInterval);
        session.tickInterval = null;
    }
}

// ============ Start Server ============

server.listen(PORT, () => {
    console.log(`🎮 Runner Game Backend running on port ${PORT}`);
    console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws/run`);
});

export { app, server };
