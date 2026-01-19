/**
 * Deterministic RNG implementation using xorshift128+
 * Used for reproducible game events that can be verified.
 */
export class SeededRNG {
    private s0: bigint;
    private s1: bigint;
    private index: number = 0;

    constructor(seed: string) {
        // Use first 32 bytes of seed hash for initial state
        const seedBytes = this.hashToBytes(seed);
        this.s0 = this.bytesToBigInt(seedBytes.slice(0, 8));
        this.s1 = this.bytesToBigInt(seedBytes.slice(8, 16));

        // Ensure non-zero state
        if (this.s0 === 0n) this.s0 = 0x853c49e6748fea9bn;
        if (this.s1 === 0n) this.s1 = 0xda3e39cb94b95bdbn;
    }

    private hashToBytes(input: string): Uint8Array {
        // Simple hash function for seeding (not cryptographic)
        const bytes = new Uint8Array(16);
        for (let i = 0; i < input.length; i++) {
            bytes[i % 16] ^= input.charCodeAt(i);
            bytes[(i + 7) % 16] ^= (input.charCodeAt(i) * 31) & 0xff;
        }
        // Mix
        for (let i = 0; i < 16; i++) {
            bytes[i] = (bytes[i] * 17 + bytes[(i + 5) % 16]) & 0xff;
        }
        return bytes;
    }

    private bytesToBigInt(bytes: Uint8Array): bigint {
        let result = 0n;
        for (let i = 0; i < bytes.length; i++) {
            result |= BigInt(bytes[i]) << BigInt(i * 8);
        }
        return result;
    }

    /**
     * Get next random number [0, 1)
     */
    next(): number {
        this.index++;

        let s1 = this.s0;
        const s0 = this.s1;
        this.s0 = s0;

        s1 ^= s1 << 23n;
        s1 ^= s1 >> 17n;
        s1 ^= s0;
        s1 ^= s0 >> 26n;
        this.s1 = s1;

        // Convert to [0, 1)
        const combined = (this.s0 + this.s1) & 0xffffffffffffffffn;
        return Number(combined) / Number(0xffffffffffffffffn);
    }

    /**
     * Get random integer in range [min, max]
     */
    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /**
     * Get current RNG index (for snapshots)
     */
    getIndex(): number {
        return this.index;
    }

    /**
     * Advance RNG to specific index
     */
    advanceTo(targetIndex: number): void {
        while (this.index < targetIndex) {
            this.next();
        }
    }
}

/**
 * Generate a cryptographically secure random seed
 */
export function generateServerSeed(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create commitment hash for a seed
 */
export function hashSeed(seed: string): string {
    // Use Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(seed);

    // Simple hash for commitment (in production use keccak256)
    let hash = 0n;
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5n) - hash + BigInt(data[i])) & 0xffffffffffffffffn;
    }
    return hash.toString(16).padStart(16, '0');
}

/**
 * Combine server seed, client seed, and run ID into final RNG seed
 */
export function combineSeeds(serverSeed: string, clientSeed: string, runId: string): string {
    return `${serverSeed}:${clientSeed}:${runId}`;
}
