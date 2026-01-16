'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { GameScene, GameState, GameCallbacks } from './GameScene';
import { api } from '@/lib/api';

interface GameCanvasProps {
    runId: string;
    onRunComplete: (data: {
        exitType: string;
        endBankroll: string;
        netDelta: string;
        serverSeed: string;
        receipt: Record<string, unknown>;
    }) => void;
    onCheckpointAction: (action: 'exit' | 'pause' | 'continue') => void;
}

export function GameCanvas({ runId, onRunComplete, onCheckpointAction }: GameCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const sceneRef = useRef<GameScene | null>(null);
    const [isCheckpointOpen, setIsCheckpointOpen] = useState(false);
    const [checkpointTimer, setCheckpointTimer] = useState(0);
    const [isRunOver, setIsRunOver] = useState(false);

    const handleInput = useCallback((type: 'jump' | 'slide') => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input', action: type }));
        }
    }, []);

    const callbacks: GameCallbacks = {
        onInput: handleInput,
        onCheckpointExit: () => onCheckpointAction('exit'),
        onCheckpointPause: () => onCheckpointAction('pause'),
        onCheckpointContinue: () => onCheckpointAction('continue'),
    };

    useEffect(() => {
        if (!containerRef.current || gameRef.current) return;

        if (gameRef.current) return;

        // Create Phaser game
        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            parent: containerRef.current,
            width: 800,
            height: 500,
            backgroundColor: '#1a1a2e',
            audio: { noAudio: true },
            scene: GameScene,
            callbacks: {
                preBoot: (game) => {
                    // Keep empty or minimal preBoot
                },
            },
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;

        // Get scene reference
        game.events.once('ready', () => {
            const scene = game.scene.getScene('GameScene') as GameScene;
            if (scene) {
                sceneRef.current = scene;
                scene.init({ callbacks });
            }
        });

        // Setup WebSocket
        const ws = api.createGameConnection(runId);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
                case 'init':
                case 'state':
                    if (sceneRef.current && sceneRef.current.scene.settings.active) {
                        sceneRef.current.updateGameState(msg.state as GameState);
                    }
                    if (msg.state.isCheckpointWindow) {
                        setIsCheckpointOpen(true);
                        setCheckpointTimer(msg.state.checkpointWindowTimer);
                    } else {
                        setIsCheckpointOpen(false);
                    }
                    if (msg.state.isRunOver) {
                        setIsRunOver(true);
                    }
                    break;

                case 'checkpoint':
                    setIsCheckpointOpen(true);
                    setCheckpointTimer(msg.timeRemaining);
                    break;

                case 'run_complete':
                    setIsRunOver(true);
                    onRunComplete({
                        exitType: msg.exitType,
                        endBankroll: msg.endBankroll,
                        netDelta: msg.netDelta,
                        serverSeed: msg.serverSeed,
                        receipt: msg.receipt,
                    });
                    break;
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('WebSocket closed');
        };

        return () => {
            ws.close();
            game.destroy(true);
            gameRef.current = null;
            sceneRef.current = null;
            wsRef.current = null;
        };
    }, [runId, onRunComplete, handleInput]);

    // Keyboard handler for checkpoint actions
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isCheckpointOpen && !isRunOver) {
                if (e.key === 'e' || e.key === 'E') {
                    onCheckpointAction('exit');
                } else if (e.key === 'p' || e.key === 'P') {
                    onCheckpointAction('pause');
                } else if (e.key === 'c' || e.key === 'C') {
                    onCheckpointAction('continue');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCheckpointOpen, isRunOver, onCheckpointAction]);

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
                                onClick={() => onCheckpointAction('exit')}
                                className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all transform hover:scale-105"
                            >
                                🚪 Exit Safely (E)
                            </button>
                            <button
                                onClick={() => onCheckpointAction('pause')}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all transform hover:scale-105"
                            >
                                ⏸️ Pause (P)
                            </button>
                            <button
                                onClick={() => onCheckpointAction('continue')}
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
