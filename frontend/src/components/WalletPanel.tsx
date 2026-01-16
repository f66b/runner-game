'use client';

import { useState, useEffect } from 'react';
import { api, WalletInfo } from '@/lib/api';

interface WalletPanelProps {
    onBalanceChange?: () => void;
}

export function WalletPanel({ onBalanceChange }: WalletPanelProps) {
    const [balance, setBalance] = useState<string>('0');
    const [depositAmount, setDepositAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [username, setUsername] = useState('');

    const fetchBalance = async () => {
        try {
            const info = await api.getWalletInfo();
            setBalance(info.balance);
            setUsername(info.username);
            if (onBalanceChange) onBalanceChange();
        } catch (error) {
            console.error('Failed to fetch balance', error);
        }
    };

    useEffect(() => {
        fetchBalance();
        // Poll every 5 seconds
        const interval = setInterval(fetchBalance, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleSetBalance = async () => {
        if (!depositAmount) return;
        setIsLoading(true);
        try {
            await api.setBalance(depositAmount);
            setDepositAmount('');
            await fetchBalance();
        } catch (error) {
            console.error('Failed to set balance', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Format balance nicely
    const formattedBalance = (BigInt(balance) / BigInt(1_000_000)).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
    });

    return (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl border border-gray-700 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    💰 {username}'s Bank
                </h2>
                <button
                    onClick={fetchBalance}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    🔄
                </button>
            </div>

            {/* Balance Display */}
            <div className="bg-black/30 p-4 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">Total Balance</span>
                    <span className="text-2xl font-bold text-green-400">{formattedBalance}</span>
                </div>
                <p className="text-xs text-gray-500">Virtual Funds (USDC equivalent)</p>
            </div>

            {/* Set Balance (Deposit/Withdraw Simulation) */}
            <div className="space-y-2">
                <label className="text-gray-400 text-sm">Set Balance ($)</label>
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Enter simulated amount"
                        className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                    <button
                        onClick={handleSetBalance}
                        disabled={isLoading || !depositAmount}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors"
                    >
                        {isLoading ? 'Setting...' : 'Set'}
                    </button>
                </div>
                <p className="text-xs text-gray-500">
                    Use this to simulate any amount of money you want to play with.
                </p>
            </div>
        </div>
    );
}
