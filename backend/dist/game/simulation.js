import { SeededRNG } from './rng.js';
// ============ Constants ============
export const TICK_RATE = 60; // ticks per second
export const TICK_DURATION = 1000 / TICK_RATE; // ms per tick
// Player physics
export const PLAYER_X = 150; // fixed screen position
export const PLAYER_WIDTH = 50;
export const PLAYER_HEIGHT = 80;
export const PLAYER_SLIDE_HEIGHT = 40;
export const GROUND_Y = 400; // ground level
export const JUMP_VELOCITY = -600; // px/s
export const GRAVITY = 1800; // px/s^2
export const SLIDE_DURATION = 0.5; // seconds
// Scroll speed
export const BASE_SCROLL_SPEED = 280; // v0
export const CHECKPOINT_INTERVAL = 60; // seconds
export const CHECKPOINT_WINDOW = 5; // seconds
// Spawn rates
export const LAMBDA_OB_BASE = 0.55;
export const LAMBDA_RW_BASE = 0.35;
export const MIN_SPAWN_GAP = 0.8; // seconds between spawns
// Difficulty bias
export const A_OB_BASE = 2.0;
export const A_RW_BASE = 2.0;
// ============ GameSimulation ============
export class GameSimulation {
    state;
    rng;
    params;
    runCount;
    events = [];
    lastObstacleSpawnTime = 0;
    lastRewardSpawnTime = 0;
    nextEntityId = 0;
    constructor(seed, params, lockedBankroll, runCount, rngIndex = 0) {
        this.rng = new SeededRNG(seed);
        if (rngIndex > 0) {
            this.rng.advanceTo(rngIndex);
        }
        this.params = params;
        this.runCount = runCount;
        this.state = {
            tick: 0,
            elapsedTime: 0,
            playerY: GROUND_Y,
            playerVelocityY: 0,
            isJumping: false,
            isSliding: false,
            slideCooldown: 0,
            bankroll: lockedBankroll,
            scrollSpeed: this.calculateScrollSpeed(0),
            checkpointIndex: 0,
            obstacles: [],
            rewards: [],
            rngIndex: this.rng.getIndex(),
            isCheckpointWindow: false,
            checkpointWindowTimer: 0,
            isRunOver: false,
            exitType: null,
        };
    }
    /**
     * Check if this is an incentive run
     */
    isIncentiveRun() {
        const n = this.runCount;
        return n === 1 || n === 5 || (n > 5 && (n - 5) % 7 === 0);
    }
    /**
     * Calculate scroll speed based on checkpoint index
     */
    calculateScrollSpeed(checkpointIndex) {
        const d = this.params.difficulty / 100;
        let step;
        if (this.params.curveMode === 'disproportional') {
            step = 18 + 60 * d * d;
        }
        else {
            step = 18 + 45 * d;
        }
        return BASE_SCROLL_SPEED + step * checkpointIndex;
    }
    /**
     * Calculate spawn rates based on difficulty
     */
    getSpawnRates() {
        const d = this.params.difficulty / 100;
        let lambdaOb;
        let lambdaRw;
        if (this.params.curveMode === 'disproportional') {
            lambdaOb = LAMBDA_OB_BASE + 1.1 * d * d;
            lambdaRw = LAMBDA_RW_BASE + 0.45 * d * d;
        }
        else {
            lambdaOb = LAMBDA_OB_BASE + 0.9 * d;
            lambdaRw = LAMBDA_RW_BASE + 0.35 * d;
        }
        // Apply incentive multipliers
        if (this.isIncentiveRun()) {
            lambdaOb *= 0.80;
            lambdaRw *= 1.25;
        }
        return { lambdaOb, lambdaRw };
    }
    /**
     * Calculate bias exponents for percent sampling
     */
    getBiasExponents() {
        const d = this.params.difficulty / 100;
        let aOb;
        let aRw;
        switch (this.params.curveMode) {
            case 'static':
                aOb = A_OB_BASE;
                aRw = A_RW_BASE;
                break;
            case 'proportional':
                aOb = A_OB_BASE + 2.0 * d;
                aRw = A_RW_BASE + 1.5 * d;
                break;
            case 'disproportional':
                const d2 = d * d;
                aOb = A_OB_BASE + 3.5 * d2;
                aRw = A_RW_BASE + 2.5 * d2;
                break;
        }
        // Apply incentive multipliers
        if (this.isIncentiveRun()) {
            aOb *= 0.75;
            aRw *= 0.75;
        }
        return { aOb, aRw };
    }
    /**
     * Sample percent for obstacle (biased high)
     */
    sampleObstaclePct() {
        const { aOb } = this.getBiasExponents();
        const u = this.rng.next();
        const x = 1 - Math.pow(1 - u, aOb);
        return this.params.percentMin + (this.params.percentMax - this.params.percentMin) * x;
    }
    /**
     * Sample percent for reward (biased low)
     */
    sampleRewardPct() {
        const { aRw } = this.getBiasExponents();
        const u = this.rng.next();
        const x = Math.pow(u, aRw);
        return this.params.percentMin + (this.params.percentMax - this.params.percentMin) * x;
    }
    /**
     * Spawn obstacles based on Poisson-like process
     */
    maybeSpawnObstacle() {
        const { lambdaOb } = this.getSpawnRates();
        const timeSinceLastSpawn = this.state.elapsedTime - this.lastObstacleSpawnTime;
        if (timeSinceLastSpawn < MIN_SPAWN_GAP)
            return;
        // Poisson probability per tick
        const p = lambdaOb / TICK_RATE;
        if (this.rng.next() < p) {
            const isOverhead = this.rng.next() < 0.4; // 40% overhead
            const pct = this.sampleObstaclePct();
            const pctBp = Math.round(pct * 100);
            const obstacle = {
                id: `ob_${this.nextEntityId++}`,
                x: 900, // spawn off-screen right
                y: isOverhead ? GROUND_Y - 120 : GROUND_Y,
                type: isOverhead ? 'overhead' : 'ground',
                width: isOverhead ? 100 : 60,
                height: isOverhead ? 40 : 60,
                pctBp,
                hit: false,
            };
            this.state.obstacles.push(obstacle);
            this.lastObstacleSpawnTime = this.state.elapsedTime;
        }
    }
    /**
     * Spawn rewards based on Poisson-like process
     */
    maybeSpawnReward() {
        const { lambdaRw } = this.getSpawnRates();
        const timeSinceLastSpawn = this.state.elapsedTime - this.lastRewardSpawnTime;
        if (timeSinceLastSpawn < MIN_SPAWN_GAP)
            return;
        const p = lambdaRw / TICK_RATE;
        if (this.rng.next() < p) {
            const pct = this.sampleRewardPct();
            const pctBp = Math.round(pct * 100);
            // Random height
            const y = GROUND_Y - 20 - this.rng.nextInt(0, 100);
            const reward = {
                id: `rw_${this.nextEntityId++}`,
                x: 900,
                y,
                width: 30,
                height: 30,
                pctBp,
                collected: false,
            };
            this.state.rewards.push(reward);
            this.lastRewardSpawnTime = this.state.elapsedTime;
        }
    }
    /**
     * Process a single input event
     */
    processInput(input) {
        if (this.state.isRunOver)
            return;
        if (input.type === 'jump' && !this.state.isJumping && !this.state.isSliding) {
            this.state.isJumping = true;
            this.state.playerVelocityY = JUMP_VELOCITY;
        }
        else if (input.type === 'slide' && !this.state.isSliding && !this.state.isJumping && this.state.slideCooldown <= 0) {
            this.state.isSliding = true;
            this.state.slideCooldown = SLIDE_DURATION * 2; // Cooldown after slide
        }
    }
    /**
     * Simulate one tick
     */
    tick() {
        if (this.state.isRunOver) {
            return this.state;
        }
        const dt = 1 / TICK_RATE;
        this.state.tick++;
        this.state.elapsedTime = this.state.tick / TICK_RATE;
        // Update player physics
        if (this.state.isJumping) {
            this.state.playerVelocityY += GRAVITY * dt;
            this.state.playerY += this.state.playerVelocityY * dt;
            if (this.state.playerY >= GROUND_Y) {
                this.state.playerY = GROUND_Y;
                this.state.playerVelocityY = 0;
                this.state.isJumping = false;
            }
        }
        // Update slide state
        if (this.state.isSliding) {
            this.state.slideCooldown -= dt;
            if (this.state.slideCooldown <= SLIDE_DURATION) {
                this.state.isSliding = false;
            }
        }
        else if (this.state.slideCooldown > 0) {
            this.state.slideCooldown -= dt;
        }
        // Spawn entities
        if (!this.state.isCheckpointWindow) {
            this.maybeSpawnObstacle();
            this.maybeSpawnReward();
        }
        // Move entities
        const moveAmount = this.state.scrollSpeed * dt;
        for (const ob of this.state.obstacles) {
            ob.x -= moveAmount;
        }
        for (const rw of this.state.rewards) {
            rw.x -= moveAmount;
        }
        // Get player hitbox
        const playerHeight = this.state.isSliding ? PLAYER_SLIDE_HEIGHT : PLAYER_HEIGHT;
        const playerY = this.state.isSliding ? GROUND_Y : this.state.playerY;
        const playerBox = {
            x: PLAYER_X,
            y: playerY - playerHeight,
            width: PLAYER_WIDTH,
            height: playerHeight,
        };
        // Check collisions with obstacles
        for (const ob of this.state.obstacles) {
            if (ob.hit)
                continue;
            const obBox = { x: ob.x, y: ob.y - ob.height, width: ob.width, height: ob.height };
            if (this.boxesIntersect(playerBox, obBox)) {
                ob.hit = true;
                // Apply bankroll decrease
                const newBankroll = (this.state.bankroll * BigInt(10000 - ob.pctBp)) / 10000n;
                this.events.push({
                    tick: this.state.tick,
                    type: 'obstacle_hit',
                    data: { obstacleId: ob.id, pctBp: ob.pctBp, oldBankroll: this.state.bankroll.toString(), newBankroll: newBankroll.toString() },
                });
                this.state.bankroll = newBankroll;
                // Check for loss
                if (this.state.bankroll <= 0n) {
                    this.state.bankroll = 0n;
                    this.state.isRunOver = true;
                    this.state.exitType = 'loss';
                    this.events.push({
                        tick: this.state.tick,
                        type: 'loss',
                        data: {},
                    });
                }
            }
        }
        // Check collisions with rewards
        for (const rw of this.state.rewards) {
            if (rw.collected)
                continue;
            const rwBox = { x: rw.x, y: rw.y - rw.height, width: rw.width, height: rw.height };
            if (this.boxesIntersect(playerBox, rwBox)) {
                rw.collected = true;
                // Apply bankroll increase
                const newBankroll = (this.state.bankroll * BigInt(10000 + rw.pctBp)) / 10000n;
                this.events.push({
                    tick: this.state.tick,
                    type: 'reward_collected',
                    data: { rewardId: rw.id, pctBp: rw.pctBp, oldBankroll: this.state.bankroll.toString(), newBankroll: newBankroll.toString() },
                });
                this.state.bankroll = newBankroll;
            }
        }
        // Remove off-screen entities
        this.state.obstacles = this.state.obstacles.filter(ob => ob.x > -100);
        this.state.rewards = this.state.rewards.filter(rw => rw.x > -100);
        // Check for checkpoint
        const newCheckpointIndex = Math.floor(this.state.elapsedTime / CHECKPOINT_INTERVAL);
        if (newCheckpointIndex > this.state.checkpointIndex) {
            this.state.checkpointIndex = newCheckpointIndex;
            this.state.scrollSpeed = this.calculateScrollSpeed(newCheckpointIndex);
            this.state.isCheckpointWindow = true;
            this.state.checkpointWindowTimer = CHECKPOINT_WINDOW;
            this.events.push({
                tick: this.state.tick,
                type: 'checkpoint',
                data: { index: newCheckpointIndex },
            });
        }
        // Update checkpoint window timer
        if (this.state.isCheckpointWindow) {
            this.state.checkpointWindowTimer -= dt;
            if (this.state.checkpointWindowTimer <= 0) {
                this.state.isCheckpointWindow = false;
                this.state.checkpointWindowTimer = 0;
            }
        }
        // Update RNG index
        this.state.rngIndex = this.rng.getIndex();
        return this.state;
    }
    /**
     * AABB intersection test
     */
    boxesIntersect(a, b) {
        return (a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y);
    }
    /**
     * Handle safe exit at checkpoint
     */
    exitSafe() {
        if (!this.state.isCheckpointWindow) {
            throw new Error('Cannot exit outside checkpoint window');
        }
        this.state.isRunOver = true;
        this.state.exitType = 'safe';
        this.events.push({
            tick: this.state.tick,
            type: 'checkpoint_exit',
            data: { bankroll: this.state.bankroll.toString() },
        });
    }
    /**
     * Handle pause at checkpoint
     */
    pause() {
        if (!this.state.isCheckpointWindow) {
            throw new Error('Cannot pause outside checkpoint window');
        }
        this.state.isRunOver = true;
        this.state.exitType = 'pause';
        this.events.push({
            tick: this.state.tick,
            type: 'checkpoint_pause',
            data: { bankroll: this.state.bankroll.toString() },
        });
    }
    /**
     * Handle forfeit (disconnect mid-run)
     */
    forfeit() {
        this.state.isRunOver = true;
        this.state.exitType = 'forfeit';
        this.state.bankroll = 0n;
        this.events.push({
            tick: this.state.tick,
            type: 'forfeit',
            data: {},
        });
    }
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get all events
     */
    getEvents() {
        return [...this.events];
    }
    /**
     * Get snapshot for pause/resume
     */
    getSnapshot() {
        return JSON.stringify({
            state: {
                ...this.state,
                bankroll: this.state.bankroll.toString(),
            },
            lastObstacleSpawnTime: this.lastObstacleSpawnTime,
            lastRewardSpawnTime: this.lastRewardSpawnTime,
            nextEntityId: this.nextEntityId,
        });
    }
    /**
     * Restore from snapshot
     */
    static fromSnapshot(snapshot, seed, params, runCount) {
        const data = JSON.parse(snapshot);
        const sim = new GameSimulation(seed, params, 0n, runCount, data.state.rngIndex);
        sim.state = {
            ...data.state,
            bankroll: BigInt(data.state.bankroll),
        };
        sim.lastObstacleSpawnTime = data.lastObstacleSpawnTime;
        sim.lastRewardSpawnTime = data.lastRewardSpawnTime;
        sim.nextEntityId = data.nextEntityId;
        return sim;
    }
}
//# sourceMappingURL=simulation.js.map