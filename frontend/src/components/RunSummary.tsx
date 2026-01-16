'use client';

import { formatUnits } from 'viem';

interface RunSummaryProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        exitType: string;
        startBankroll: string;
        endBankroll: string;
        netDelta: string;
        serverSeed: string;
        receipt: Record<string, unknown>;
    } | null;
}

export function RunSummary({ isOpen, onClose, data }: RunSummaryProps) {
    if (!isOpen || !data) return null;

    const startBankroll = Number(BigInt(data.startBankroll || '0')) / 1_000_000;
    const endBankroll = Number(BigInt(data.endBankroll)) / 1_000_000;
    const netDelta = Number(BigInt(data.netDelta)) / 1_000_000;
    const isProfit = netDelta > 0;
    const isLoss = netDelta < 0;

    const exitTypeLabels: Record<string, { label: string; color: string; emoji: string }> = {
        safe: { label: 'Safe Exit', color: 'text-green-400', emoji: '✅' },
        pause: { label: 'Paused', color: 'text-blue-400', emoji: '⏸️' },
        forfeit: { label: 'Forfeited', color: 'text-red-400', emoji: '❌' },
        loss: { label: 'Bankroll Depleted', color: 'text-red-400', emoji: '💀' },
    };

    const exitInfo = exitTypeLabels[data.exitType] || { label: data.exitType, color: 'text-white', emoji: '❓' };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl border border-gray-700 max-w-lg w-full space-y-6">
                <div className="text-center">
                    <span className="text-5xl">{exitInfo.emoji}</span>
                    <h2 className={`text-3xl font-bold mt-2 ${exitInfo.color}`}>{exitInfo.label}</h2>
                </div>

                {/* Results Card */}
                <div className="bg-black/30 p-6 rounded-xl space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400">Start Bankroll</span>
                        <span className="text-white font-mono">${startBankroll.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-gray-400">End Bankroll</span>
                        <span className="text-white font-mono">${endBankroll.toFixed(2)}</span>
                    </div>

                    <hr className="border-gray-700" />

                    <div className="flex justify-between items-center text-lg">
                        <span className="text-white font-semibold">Net Result</span>
                        <span className={`font-bold font-mono ${isProfit ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-white'}`}>
                            {isProfit ? '+' : ''}{netDelta.toFixed(2)} USDC
                        </span>
                    </div>

                    {isProfit && (
                        <p className="text-xs text-gray-500 text-center">
                            Note: 10% platform fee applied on profit
                        </p>
                    )}
                </div>

                {/* Verification Section */}
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-400">🔐 Verification</h3>
                    <div className="bg-black/30 p-4 rounded-xl space-y-2">
                        <div>
                            <span className="text-xs text-gray-500">Server Seed (revealed)</span>
                            <p className="text-xs font-mono text-gray-300 break-all">{data.serverSeed}</p>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        The server seed was committed before your run started. You can verify the fairness of this run using the seed and signature.
                    </p>
                </div>

                {/* Continue Button */}
                <button
                    onClick={onClose}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-[1.02]"
                >
                    Continue
                </button>
            </div>
        </div>
    );
}
