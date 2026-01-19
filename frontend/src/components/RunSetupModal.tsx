'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface RunSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (runId: string, params: Record<string, unknown>) => void;
}

export function RunSetupModal({ isOpen, onClose, onStart }: RunSetupModalProps) {
    const [difficulty, setDifficulty] = useState(50);
    const [percentMin, setPercentMin] = useState(5);
    const [percentMax, setPercentMax] = useState(25);
    const [curveMode, setCurveMode] = useState<'static' | 'proportional' | 'disproportional'>('proportional');
    const [lockedBankroll, setLockedBankroll] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [balance, setBalance] = useState<bigint>(BigInt(0));

    useEffect(() => {
        if (isOpen) {
            api.getWalletInfo().then(info => {
                setBalance(BigInt(info.balance));
            }).catch(console.error);
        }
    }, [isOpen]);

    const maxBankroll = Number(balance) / 1_000_000;
    const formattedBalance = maxBankroll.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    const handleStart = async () => {
        if (!lockedBankroll) return;

        const bankrollValue = parseFloat(lockedBankroll);
        if (bankrollValue <= 0 || bankrollValue > maxBankroll) {
            setError('Invalid bankroll amount');
            return;
        }

        if (percentMin >= percentMax) {
            setError('Min percent must be less than max');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await api.startRun({
                lockedBankroll: (BigInt(Math.floor(bankrollValue * 1_000_000))).toString(),
                difficulty,
                percentMin,
                percentMax,
                curveMode,
                clientSeed: crypto.randomUUID(),
            });

            // Save run data for client-side simulation
            localStorage.setItem(`run_${response.runId}`, JSON.stringify(response));

            onStart(response.runId, response.params);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl border border-gray-700 max-w-md w-full space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">🎮 Start New Run</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
                </div>

                {/* Available Balance */}
                <div className="bg-black/30 p-4 rounded-xl">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400">Available Balance</span>
                        <span className="text-xl font-bold text-green-400">{formattedBalance}</span>
                    </div>
                </div>

                {/* Bankroll Input */}
                <div className="space-y-2">
                    <label className="text-gray-400 text-sm">Lock Bankroll ($)</label>
                    <input
                        type="number"
                        value={lockedBankroll}
                        onChange={(e) => setLockedBankroll(e.target.value)}
                        placeholder={`Max: ${formattedBalance}`}
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-lg focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-500">This amount will be at risk during your run</p>
                </div>

                {/* Difficulty Slider */}
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <label className="text-gray-400 text-sm">Difficulty</label>
                        <span className="text-white font-mono">{difficulty}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={difficulty}
                        onChange={(e) => setDifficulty(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Easy</span>
                        <span>Hard</span>
                    </div>
                </div>

                {/* Percent Range */}
                <div className="space-y-2">
                    <label className="text-gray-400 text-sm">Percent Range per Event</label>
                    <div className="flex gap-4 items-center">
                        <div className="flex-1">
                            <input
                                type="number"
                                value={percentMin}
                                onChange={(e) => setPercentMin(parseInt(e.target.value) || 0)}
                                min="0"
                                max="99"
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-center"
                            />
                            <p className="text-xs text-center text-gray-500 mt-1">Min %</p>
                        </div>
                        <span className="text-gray-500">to</span>
                        <div className="flex-1">
                            <input
                                type="number"
                                value={percentMax}
                                onChange={(e) => setPercentMax(parseInt(e.target.value) || 0)}
                                min="1"
                                max="100"
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-center"
                            />
                            <p className="text-xs text-center text-gray-500 mt-1">Max %</p>
                        </div>
                    </div>
                </div>

                {/* Curve Mode */}
                <div className="space-y-2">
                    <label className="text-gray-400 text-sm">Curve Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['static', 'proportional', 'disproportional'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setCurveMode(mode)}
                                className={`py-2 px-3 rounded-lg font-medium text-sm transition-all ${curveMode === mode
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <p className="text-red-400 text-sm text-center">{error}</p>
                )}

                {/* Start Button */}
                <button
                    onClick={handleStart}
                    disabled={isLoading || !lockedBankroll || parseFloat(lockedBankroll) <= 0}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                >
                    {isLoading ? '⏳ Starting...' : '🚀 Start Run'}
                </button>

                {/* Risk Warning */}
                <p className="text-xs text-center text-yellow-500">
                    ⚠️ If you disconnect mid-run (not at checkpoint), you will lose your locked bankroll!
                </p>
            </div>
        </div>
    );
}
