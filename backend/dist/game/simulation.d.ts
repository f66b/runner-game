export interface RunParams {
    difficulty: number;
    percentMin: number;
    percentMax: number;
    curveMode: 'static' | 'proportional' | 'disproportional';
}
export interface GameState {
    tick: number;
    elapsedTime: number;
    playerY: number;
    playerVelocityY: number;
    isJumping: boolean;
    isSliding: boolean;
    slideCooldown: number;
    bankroll: bigint;
    scrollSpeed: number;
    checkpointIndex: number;
    obstacles: Obstacle[];
    rewards: Reward[];
    rngIndex: number;
    isCheckpointWindow: boolean;
    checkpointWindowTimer: number;
    isRunOver: boolean;
    exitType: ExitType | null;
}
export interface Obstacle {
    id: string;
    x: number;
    y: number;
    type: 'ground' | 'overhead';
    width: number;
    height: number;
    pctBp: number;
    hit: boolean;
}
export interface Reward {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    pctBp: number;
    collected: boolean;
}
export type ExitType = 'safe' | 'pause' | 'forfeit' | 'loss';
export interface InputEvent {
    type: 'jump' | 'slide';
    tick: number;
}
export interface GameEvent {
    tick: number;
    type: 'obstacle_hit' | 'reward_collected' | 'checkpoint' | 'checkpoint_exit' | 'checkpoint_pause' | 'forfeit' | 'loss';
    data: Record<string, unknown>;
}
export declare const TICK_RATE = 60;
export declare const TICK_DURATION: number;
export declare const PLAYER_X = 150;
export declare const PLAYER_WIDTH = 50;
export declare const PLAYER_HEIGHT = 80;
export declare const PLAYER_SLIDE_HEIGHT = 40;
export declare const GROUND_Y = 400;
export declare const JUMP_VELOCITY = -600;
export declare const GRAVITY = 1800;
export declare const SLIDE_DURATION = 0.5;
export declare const BASE_SCROLL_SPEED = 280;
export declare const CHECKPOINT_INTERVAL = 60;
export declare const CHECKPOINT_WINDOW = 5;
export declare const LAMBDA_OB_BASE = 0.55;
export declare const LAMBDA_RW_BASE = 0.35;
export declare const MIN_SPAWN_GAP = 0.8;
export declare const A_OB_BASE = 2;
export declare const A_RW_BASE = 2;
export declare class GameSimulation {
    private state;
    private rng;
    private params;
    private runCount;
    private events;
    private lastObstacleSpawnTime;
    private lastRewardSpawnTime;
    private nextEntityId;
    constructor(seed: string, params: RunParams, lockedBankroll: bigint, runCount: number, rngIndex?: number);
    /**
     * Check if this is an incentive run
     */
    private isIncentiveRun;
    /**
     * Calculate scroll speed based on checkpoint index
     */
    private calculateScrollSpeed;
    /**
     * Calculate spawn rates based on difficulty
     */
    private getSpawnRates;
    /**
     * Calculate bias exponents for percent sampling
     */
    private getBiasExponents;
    /**
     * Sample percent for obstacle (biased high)
     */
    private sampleObstaclePct;
    /**
     * Sample percent for reward (biased low)
     */
    private sampleRewardPct;
    /**
     * Spawn obstacles based on Poisson-like process
     */
    private maybeSpawnObstacle;
    /**
     * Spawn rewards based on Poisson-like process
     */
    private maybeSpawnReward;
    /**
     * Process a single input event
     */
    processInput(input: InputEvent): void;
    /**
     * Simulate one tick
     */
    tick(): GameState;
    /**
     * AABB intersection test
     */
    private boxesIntersect;
    /**
     * Handle safe exit at checkpoint
     */
    exitSafe(): void;
    /**
     * Handle pause at checkpoint
     */
    pause(): void;
    /**
     * Handle forfeit (disconnect mid-run)
     */
    forfeit(): void;
    /**
     * Get current state
     */
    getState(): GameState;
    /**
     * Get all events
     */
    getEvents(): GameEvent[];
    /**
     * Get snapshot for pause/resume
     */
    getSnapshot(): string;
    /**
     * Restore from snapshot
     */
    static fromSnapshot(snapshot: string, seed: string, params: RunParams, runCount: number): GameSimulation;
}
//# sourceMappingURL=simulation.d.ts.map