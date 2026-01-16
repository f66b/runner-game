/**
 * Deterministic RNG implementation using xorshift128+
 * Used for reproducible game events that can be verified.
 */
export declare class SeededRNG {
    private s0;
    private s1;
    private index;
    constructor(seed: string);
    private hashToBytes;
    private bytesToBigInt;
    /**
     * Get next random number [0, 1)
     */
    next(): number;
    /**
     * Get random integer in range [min, max]
     */
    nextInt(min: number, max: number): number;
    /**
     * Get current RNG index (for snapshots)
     */
    getIndex(): number;
    /**
     * Advance RNG to specific index
     */
    advanceTo(targetIndex: number): void;
}
/**
 * Generate a cryptographically secure random seed
 */
export declare function generateServerSeed(): string;
/**
 * Create commitment hash for a seed
 */
export declare function hashSeed(seed: string): string;
/**
 * Combine server seed, client seed, and run ID into final RNG seed
 */
export declare function combineSeeds(serverSeed: string, clientSeed: string, runId: string): string;
//# sourceMappingURL=rng.d.ts.map