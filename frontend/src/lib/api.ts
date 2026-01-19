const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface AuthResponse {
    token: string;
    user: {
        id: string;
        username: string;
        runCount: number;
    };
}

export interface WalletInfo {
    username: string;
    balance: string; // BigInt string
    incentiveClaimed: boolean;
    hasPlayedOnce: boolean;
    runCount: number;
}

export interface RunStartResponse {
    runId: string;
    serverCommit: string;
    runNonce: number;
    params: {
        difficulty: number;
        percentMin: number;
        percentMax: number;
        curveMode: string;
    };
}

export interface RunReceipt {
    exitType: string;
    endBankroll: string;
    netDelta: string;
    serverSeed: string;
}

export interface RunCompleteParams {
    runId: string;
    inputs: any[];
    finalBankroll: string;
    exitType: string;
}

class ApiClient {
    private token: string | null = null;

    setToken(token: string) {
        this.token = token;
        if (typeof window !== 'undefined') {
            localStorage.setItem('auth_token', token);
        }
    }

    getToken(): string | null {
        if (this.token) return this.token;
        if (typeof window !== 'undefined') {
            return localStorage.getItem('auth_token');
        }
        return null;
    }

    clearToken() {
        this.token = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
        }
    }

    private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>),
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    }

    // Auth
    async login(username: string): Promise<AuthResponse> {
        return this.fetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username }),
        });
    }

    // Wallet
    async getWalletInfo(): Promise<WalletInfo> {
        return this.fetch('/wallet/balance');
    }

    async setBalance(amount: string): Promise<WalletInfo> {
        return this.fetch('/wallet/set-balance', {
            method: 'POST',
            body: JSON.stringify({ amount }),
        });
    }

    // Run
    async startRun(params: {
        lockedBankroll: string;
        difficulty: number;
        percentMin: number;
        percentMax: number;
        curveMode: string;
        clientSeed: string;
    }): Promise<RunStartResponse> {
        return this.fetch('/run/start', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    async completeRun(params: RunCompleteParams): Promise<{ success: boolean; verifiedBankroll: string; serverSeed: string }> {
        return this.fetch('/run/complete', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
}

export const api = new ApiClient();
