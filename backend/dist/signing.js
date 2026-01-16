import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked, toHex } from 'viem';
// EIP-712 Domain
const DOMAIN = {
    name: 'RunnerVault',
    version: '1',
    // chainId and verifyingContract will be set from env
};
// EIP-712 Types
const RUN_RESULT_TYPES = {
    RunResult: [
        { name: 'user', type: 'address' },
        { name: 'runId', type: 'bytes32' },
        { name: 'startWalletBalance6', type: 'uint256' },
        { name: 'lockedBankroll6', type: 'uint256' },
        { name: 'endBankroll6', type: 'uint256' },
        { name: 'netDelta6', type: 'int256' },
        { name: 'exitType', type: 'uint8' },
        { name: 'eventsDigest', type: 'bytes32' },
        { name: 'runNonce', type: 'uint64' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'seedCommit', type: 'bytes32' },
        { name: 'seedReveal', type: 'bytes32' },
    ],
};
// ============ Signer Class ============
export class ReceiptSigner {
    account;
    chainId;
    vaultAddress;
    constructor(privateKey, chainId, vaultAddress) {
        this.account = privateKeyToAccount(privateKey);
        this.chainId = chainId;
        this.vaultAddress = vaultAddress;
    }
    /**
     * Get the signer's address
     */
    getAddress() {
        return this.account.address;
    }
    /**
     * Sign a run receipt using EIP-712
     */
    async signReceipt(receipt) {
        const domain = {
            ...DOMAIN,
            chainId: this.chainId,
            verifyingContract: this.vaultAddress,
        };
        const message = {
            user: receipt.user,
            runId: receipt.runId,
            startWalletBalance6: receipt.startWalletBalance6,
            lockedBankroll6: receipt.lockedBankroll6,
            endBankroll6: receipt.endBankroll6,
            netDelta6: receipt.netDelta6,
            exitType: receipt.exitType,
            eventsDigest: receipt.eventsDigest,
            runNonce: receipt.runNonce,
            timestamp: receipt.timestamp,
            seedCommit: receipt.seedCommit,
            seedReveal: receipt.seedReveal,
        };
        const signature = await this.account.signTypedData({
            domain,
            types: RUN_RESULT_TYPES,
            primaryType: 'RunResult',
            message,
        });
        return { receipt, signature };
    }
}
// ============ Utility Functions ============
/**
 * Create events digest from game events
 */
export function createEventsDigest(events) {
    const json = JSON.stringify(events);
    return keccak256(toHex(json));
}
/**
 * Create run ID from user and nonce
 */
export function createRunId(user, nonce) {
    return keccak256(encodePacked(['address', 'uint256'], [user, BigInt(nonce)]));
}
/**
 * Map exit type string to number
 */
export function exitTypeToNumber(exitType) {
    switch (exitType) {
        case 'safe': return 0;
        case 'pause': return 1;
        case 'forfeit': return 2;
        case 'loss': return 3;
        default: throw new Error(`Unknown exit type: ${exitType}`);
    }
}
/**
 * Create seed commit hash
 */
export function hashServerSeed(seed) {
    return keccak256(toHex(seed));
}
//# sourceMappingURL=signing.js.map