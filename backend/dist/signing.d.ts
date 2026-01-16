import { Hex, Address } from 'viem';
export interface RunReceipt {
    user: Address;
    runId: Hex;
    startWalletBalance6: bigint;
    lockedBankroll6: bigint;
    endBankroll6: bigint;
    netDelta6: bigint;
    exitType: number;
    eventsDigest: Hex;
    runNonce: bigint;
    timestamp: bigint;
    seedCommit: Hex;
    seedReveal: Hex;
}
export interface SignedReceipt {
    receipt: RunReceipt;
    signature: Hex;
}
export declare class ReceiptSigner {
    private account;
    private chainId;
    private vaultAddress;
    constructor(privateKey: Hex, chainId: number, vaultAddress: Address);
    /**
     * Get the signer's address
     */
    getAddress(): Address;
    /**
     * Sign a run receipt using EIP-712
     */
    signReceipt(receipt: RunReceipt): Promise<SignedReceipt>;
}
/**
 * Create events digest from game events
 */
export declare function createEventsDigest(events: unknown[]): Hex;
/**
 * Create run ID from user and nonce
 */
export declare function createRunId(user: Address, nonce: number): Hex;
/**
 * Map exit type string to number
 */
export declare function exitTypeToNumber(exitType: string): number;
/**
 * Create seed commit hash
 */
export declare function hashServerSeed(seed: string): Hex;
//# sourceMappingURL=signing.d.ts.map