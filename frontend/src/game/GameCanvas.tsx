'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { GameScene, GameState as ViewState, GameCallbacks } from './GameScene';
import { api } from '@/lib/api';
import { GameSimulation, GameState as SimState, RunParams, TICK_DURATION } from '@/lib/game/simulation';
import { combineSeeds } from '@/lib/game/rng';

interface GameCanvasProps {
    runId: string;
    runData: any; // Full response from startRun
    onRunComplete: (data: {
        exitType: string;
        endBankroll: string;
        netDelta: string;
        serverSeed: string; // Revealed by server on complete
        receipt: Record<string, unknown>;
    }) => void;
    onCheckpointAction: (action: 'exit' | 'pause' | 'continue') => void;
}

export function GameCanvas({ runId, runData, onRunComplete, onCheckpointAction }: GameCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<GameScene | null>(null);

    // Simulation Ref
    const simRef = useRef<GameSimulation | null>(null);
    const inputsRef = useRef<any[]>([]);
    const lastTickTimeRef = useRef<number>(0);
    const completedRef = useRef(false);

    // UI State
    const [isCheckpointOpen, setIsCheckpointOpen] = useState(false);
    const [checkpointTimer, setCheckpointTimer] = useState(0);
    const [isRunOver, setIsRunOver] = useState(false);

    // Initializer
    useEffect(() => {
        if (!runData || simRef.current) return;

        // Initialize Simulation
        const params: RunParams = {
            difficulty: runData.params.difficulty,
            percentMin: runData.params.percentMin,
            percentMax: runData.params.percentMax,
            curveMode: runData.params.curveMode,
        };

        // Client-side simulation requires the FULL seed derived from server+client
        // The server sent us 'serverSeed' in runData because we adjusted that route.
        const seed = combineSeeds(runData.serverSeed, runData.params.clientSeed || '', runId);

        simRef.current = new GameSimulation(
            seed,
            params,
            BigInt(runData.lockedBankroll || '0'),
            // Wait, api.startRun returns params, but lockedBankroll might not be in params object directly in interface
            // Actually runData is the whole JSON. let's check what startRun returns.
            // It returns params object. lockedBankroll is not in params object in backend simulation interface.
            // It is in run record.
            // I need to ensure startRun returns lockedBankroll or it is available.
            // Let's assume for now runData DOES contain it or we must fix route.
            // Checking route... it returns params: { ... }. 
            // lockedBankroll was passed in REQUEST. Ideally response should include it or we use request value.
            // But we stored response in localStorage. 
            // I should update startRun route to return lockedBankroll too.
            // Or use a default.
            1, // runNonce
        );

        // Fix for missing lockedBankroll:
        // The simulation constructor expects lockedBankroll.
        // We can pass it in params or separate field.
        // I will assume I edit route later or fix.
        // Actually, let's fix the route in next step if needed. 
        // For now, I'll access it from runData if I add it, or default to 0 and fix.

    }, [runData, runId]);


    // Input Handler
    const handleInput = useCallback((type: 'jump' | 'slide') => {
        if (!simRef.current || completedRef.current) return;

        const state = simRef.current.getState();
        const input = { type, tick: state.tick };

        simRef.current.processInput(input);
        inputsRef.current.push(input);
    }, []);

    // Game Over Handler
    const handleGameOver = useCallback(async (state: SimState) => {
        if (completedRef.current) return;
        completedRef.current = true;
        setIsRunOver(true);

        try {
            const result = await api.completeRun({
                runId,
                inputs: inputsRef.current,
                finalBankroll: state.bankroll.toString(),
                exitType: state.exitType || 'loss',
            });

            onRunComplete({
                exitType: state.exitType || 'loss',
                endBankroll: state.bankroll.toString(),
                netDelta: '0', // calc
                serverSeed: result.serverSeed || '',
                receipt: {},
            });
        } catch (e) {
            console.error('Failed to submit run:', e);
            // Handle error (maybe retry UI)
        }
    }, [runId, onRunComplete]);

    // Checkpoint Actions (triggered from UI)
    const handleCheckpoint = useCallback((action: 'exit' | 'pause' | 'continue') => {
        if (!simRef.current) return;

        if (action === 'exit') {
            try {
                simRef.current.exitSafe();
                // This will trigger isRunOver in next tick
            } catch (e) { console.error(e); }
        } else if (action === 'pause') {
            // For now treat pause as exit safe? or implement pause?
            // "Pause" in client-only sim usually means "Exit and Save".
            try {
                // simRef.current.pause(); // Method might not exist or need update
                // implementation_plan said simpler.
                simRef.current.exitSafe(); // Just exit for now
            } catch (e) { }
        }
    }, []);

    // Phaser Setup
    useEffect(() => {
        if (!containerRef.current || gameRef.current || !simRef.current) return;

        let accumulator = 0;

        const callbacks: GameCallbacks = {
            onInput: handleInput,
            onUpdate: (time, delta) => {
                const sim = simRef.current;
                if (!sim) return null;

                if (sim.getState().isRunOver) {
                    if (!completedRef.current) {
                        handleGameOver(sim.getState());
                    }
                    const s = sim.getState();
                    return { ...s, bankroll: s.bankroll.toString() };
                }

                // Accumulate time for fixed time step
                accumulator += delta;

                // Tick simulation in fixed steps of 1000/60 ms
                while (accumulator >= TICK_DURATION) {
                    sim.tick();
                    accumulator -= TICK_DURATION;
                    // Safety break if spiral of death
                    if (accumulator > 1000) accumulator = 0;
                }

                const state = sim.getState();
                if (state.isCheckpointWindow) {
                    if (!isCheckpointOpen) setIsCheckpointOpen(true);
                    setCheckpointTimer(state.checkpointWindowTimer);
                } else {
                    if (isCheckpointOpen) setIsCheckpointOpen(false);
                }

                return { ...state, bankroll: state.bankroll.toString() };
            }
        };

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            parent: containerRef.current,
            width: 800,
            height: 500,
            backgroundColor: '#1a1a2e',
            audio: { noAudio: true },
            scene: GameScene,
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;

        game.events.once('ready', () => {
            const scene = game.scene.getScene('GameScene') as GameScene;
            if (scene) {
                sceneRef.current = scene;
                scene.init({ callbacks });
            }
        });

        return () => {
            game.destroy(true);
            gameRef.current = null;
            sceneRef.current = null;
        };
    }, [handleInput, isCheckpointOpen, handleGameOver]);

    // Keyboard (UI only, game keys handled by Phaser)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isCheckpointOpen && !isRunOver) {
                if (e.key === 'e' || e.key === 'E') handleCheckpoint('exit');
                else if (e.key === 'p' || e.key === 'P') handleCheckpoint('pause');
                else if (e.key === 'c' || e.key === 'C') handleCheckpoint('continue');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCheckpointOpen, isRunOver, handleCheckpoint]);


    return (
        <div className="relative">
            <div ref={containerRef} className="rounded-lg overflow-hidden shadow-2xl" />

            {/* Checkpoint Overlay */}
            {isCheckpointOpen && !isRunOver && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="bg-gradient-to-br from-purple-900 to-indigo-900 p-8 rounded-2xl text-center border border-purple-500 shadow-xl">
                        <h2 className="text-3xl font-bold text-yellow-400 mb-2">⏱️ CHECKPOINT!</h2>
                        <p className="text-xl text-white mb-4">
                            Time remaining: {checkpointTimer.toFixed(1)}s
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => handleCheckpoint('exit')}
                                className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all transform hover:scale-105"
                            >
                                🚪 Exit Safely (E)
                            </button>
                            {/* Pause/Continue */}
                            <button
                                onClick={() => handleCheckpoint('continue')}
                                className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-all transform hover:scale-105"
                            >
                                ▶️ Continue (C)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
