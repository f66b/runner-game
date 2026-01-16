'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { RunSummary } from '@/components/RunSummary';
import { api } from '@/lib/api';
import Link from 'next/link';

// Dynamically import game canvas to avoid SSR issues with Phaser
const GameCanvas = dynamic(
    () => import('@/game/GameCanvas').then(mod => mod.GameCanvas),
    { ssr: false, loading: () => <GameLoading /> }
);

function GameLoading() {
    return (
        <div className="w-[800px] h-[500px] bg-gray-800 rounded-lg flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin text-4xl mb-4">🎮</div>
                <p className="text-gray-400">Loading game...</p>
            </div>
        </div>
    );
}

function GamePageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const runId = searchParams.get('runId');

    const [showSummary, setShowSummary] = useState(false);
    const [runResult, setRunResult] = useState<{
        exitType: string;
        startBankroll: string;
        endBankroll: string;
        netDelta: string;
        serverSeed: string;
        receipt: Record<string, unknown>;
    } | null>(null);

    // Check auth on mount
    useEffect(() => {
        if (!api.getToken()) {
            router.push('/');
        }
    }, [router]);

    const handleRunComplete = useCallback((data: {
        exitType: string;
        endBankroll: string;
        netDelta: string;
        serverSeed: string;
        receipt: Record<string, unknown>;
    }) => {
        setRunResult({
            ...data,
            startBankroll: (data.receipt as Record<string, string>).lockedBankroll6 || '0',
        });
        setShowSummary(true);
    }, []);

    const handleCheckpointAction = useCallback(async (action: 'exit' | 'pause' | 'continue') => {
        if (!runId) return;

        if (action === 'exit') {
            try {
                await api.checkpointExit(runId);
            } catch (error) {
                console.error('Exit failed:', error);
            }
        } else if (action === 'pause') {
            try {
                await api.checkpointPause(runId);
            } catch (error) {
                console.error('Pause failed:', error);
            }
        }
        // Continue just closes the overlay
    }, [runId]);

    const handleSummaryClose = () => {
        setShowSummary(false);
        router.push('/');
    };

    if (!runId) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-400 mb-4">No run ID provided</p>
                    <Link href="/" className="text-purple-400 hover:text-purple-300">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
            {/* Header */}
            <header className="border-b border-gray-800 bg-black/30 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white">
                        <span>←</span>
                        <span>Back to Lobby</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🏃</span>
                        <h1 className="text-xl font-bold text-white">Crypto Runner</h1>
                    </div>
                    <div className="text-sm text-gray-500">
                        Run: {runId.slice(0, 8)}...
                    </div>
                </div>
            </header>

            {/* Game Area */}
            <main className="container mx-auto px-4 py-8">
                <div className="flex flex-col items-center gap-6">
                    {/* Game Canvas */}
                    <GameCanvas
                        runId={runId}
                        onRunComplete={handleRunComplete}
                        onCheckpointAction={handleCheckpointAction}
                    />

                    {/* Controls Guide */}
                    <div className="flex gap-8 text-gray-400">
                        <div className="flex items-center gap-2">
                            <kbd className="px-3 py-1 bg-gray-800 rounded border border-gray-600">SPACE</kbd>
                            <span>or</span>
                            <kbd className="px-3 py-1 bg-gray-800 rounded border border-gray-600">↑</kbd>
                            <span>Jump</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <kbd className="px-3 py-1 bg-gray-800 rounded border border-gray-600">↓</kbd>
                            <span>Slide</span>
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="bg-gray-800/50 p-4 rounded-xl max-w-2xl text-center">
                        <p className="text-gray-400 text-sm">
                            💡 <strong className="text-white">Tip:</strong> Checkpoints occur every 60 seconds.
                            Exit safely to keep your earnings, or risk it for more rewards!
                        </p>
                    </div>
                </div>
            </main>

            {/* Run Summary Modal */}
            <RunSummary
                isOpen={showSummary}
                onClose={handleSummaryClose}
                data={runResult}
            />
        </div>
    );
}

export default function GamePage() {
    return (
        <Suspense fallback={<GameLoading />}>
            <GamePageContent />
        </Suspense>
    );
}
