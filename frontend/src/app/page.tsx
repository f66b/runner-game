'use client';

import { useState, useEffect } from 'react';
import { WalletPanel } from '@/components/WalletPanel';
import { RunSetupModal } from '@/components/RunSetupModal';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  // Check for existing auth on mount
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getWalletInfo().then((info) => {
        setIsAuthenticated(true);
        setUsername(info.username);
      }).catch(() => {
        api.clearToken();
        setIsAuthenticated(false);
      });
    }
  }, []);

  const handleLogin = async () => {
    if (!loginUsername) return;
    try {
      const response = await api.login(loginUsername);
      api.setToken(response.token);
      setIsAuthenticated(true);
      setUsername(response.user.username);
      setLoginUsername('');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleRunStart = (runId: string) => {
    setCurrentRunId(runId);
    setShowSetup(false);
  };

  const handleLogout = () => {
    api.clearToken();
    setIsAuthenticated(false);
    setUsername('');
    setCurrentRunId(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏃</span>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Crypto Runner
            </h1>
          </div>
          {isAuthenticated && (
            <div className="flex items-center gap-4">
              <span className="text-gray-300">Player: <strong className="text-white">{username}</strong></span>
              <button
                onClick={handleLogout}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Game Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Card */}
            <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 p-8 rounded-3xl border border-purple-500/30">
              <h2 className="text-4xl font-bold mb-4">
                🎮 Play. Run. Earn.
              </h2>
              <p className="text-gray-300 text-lg mb-6">
                An endless runner game where you play with virtual money.
                Set your simulated supply, lock your bankroll, dodge obstacles, and collect rewards.
              </p>

              {!isAuthenticated ? (
                <div className="space-y-4 max-w-md mx-auto py-8">
                  <p className="text-center text-gray-400">Enter a username to start playing</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      placeholder="Username"
                      className="flex-1 px-4 py-3 bg-gray-900 border border-purple-500/50 rounded-xl text-white focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={handleLogin}
                      disabled={!loginUsername}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      Generic Login
                    </button>
                  </div>
                </div>
              ) : currentRunId ? (
                <Link
                  href={`/game?runId=${currentRunId}`}
                  className="block w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-lg rounded-xl text-center transition-all transform hover:scale-[1.02]"
                >
                  ▶️ Continue Your Run
                </Link>
              ) : (
                <button
                  onClick={() => setShowSetup(true)}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-[1.02]"
                >
                  🚀 Start New Run
                </button>
              )}
            </div>

            {/* How It Works */}
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
              <h3 className="text-xl font-bold mb-4">📖 How It Works</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-black/30 p-4 rounded-xl">
                  <span className="text-2xl">1️⃣</span>
                  <h4 className="font-semibold mt-2">Set Balance</h4>
                  <p className="text-sm text-gray-400">Give yourself as much fake money as you want</p>
                </div>
                <div className="bg-black/30 p-4 rounded-xl">
                  <span className="text-2xl">2️⃣</span>
                  <h4 className="font-semibold mt-2">Lock Bankroll</h4>
                  <p className="text-sm text-gray-400">Choose how much to risk for this run</p>
                </div>
                <div className="bg-black/30 p-4 rounded-xl">
                  <span className="text-2xl">3️⃣</span>
                  <h4 className="font-semibold mt-2">Run & Collect</h4>
                  <p className="text-sm text-gray-400">Avoid obstacles, collect rewards for gains</p>
                </div>
                <div className="bg-black/30 p-4 rounded-xl">
                  <span className="text-2xl">4️⃣</span>
                  <h4 className="font-semibold mt-2">Checkpoints</h4>
                  <p className="text-sm text-gray-400">Every 60s, exit safely or continue running</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800/50 p-4 rounded-xl text-center border border-gray-700">
                <p className="text-3xl font-bold text-green-400">∞ Link</p>
                <p className="text-sm text-gray-400">Unlimited Fun</p>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-xl text-center border border-gray-700">
                <p className="text-3xl font-bold text-purple-400">10%</p>
                <p className="text-sm text-gray-400">Virtual Fee</p>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-xl text-center border border-gray-700">
                <p className="text-3xl font-bold text-blue-400">60fps</p>
                <p className="text-sm text-gray-400">Smooth Play</p>
              </div>
            </div>
          </div>

          {/* Wallet Section */}
          <div className="space-y-6">
            {isAuthenticated ? (
              <WalletPanel />
            ) : (
              <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 text-center">
                <p className="text-gray-400">Login to view wallet</p>
              </div>
            )}

            {/* Network Info */}
            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <h4 className="font-semibold mb-2">🔗 Network</h4>
              <p className="text-sm text-gray-400">Mock Economy (Simulated)</p>
              <p className="text-xs text-gray-500 mt-1">No real funds involved</p>
            </div>
          </div>
        </div>
      </main>

      {/* Run Setup Modal */}
      <RunSetupModal
        isOpen={showSetup}
        onClose={() => setShowSetup(false)}
        onStart={handleRunStart}
      />
    </div>
  );
}
