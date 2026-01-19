import Phaser from 'phaser';

// ============ Constants ============
const PLAYER_X = 150;
const GROUND_Y = 400;
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 80;
const PLAYER_SLIDE_HEIGHT = 40;
const JUMP_VELOCITY = -600;
const GRAVITY = 1800;

// ============ Types ============
export interface GameState {
    tick: number;
    elapsedTime: number;
    playerY: number;
    playerVelocityY: number;
    isJumping: boolean;
    isSliding: boolean;
    slideCooldown: number;
    bankroll: string;
    scrollSpeed: number;
    checkpointIndex: number;
    obstacles: Array<{
        id: string;
        x: number;
        y: number;
        type: 'ground' | 'overhead';
        width: number;
        height: number;
        pctBp: number;
        hit: boolean;
    }>;
    rewards: Array<{
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        pctBp: number;
        collected: boolean;
    }>;
    rngIndex: number;
    isCheckpointWindow: boolean;
    checkpointWindowTimer: number;
    isRunOver: boolean;
    exitType: string | null;
}

export interface GameCallbacks {
    onInput: (type: 'jump' | 'slide') => void;
    onUpdate: (time: number, delta: number) => GameState | null; // Called every frame to tick simulation
}

// ============ Game Scene ============
export class GameScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Sprite;
    private ground!: Phaser.GameObjects.Rectangle;
    private obstacles: Map<string, Phaser.GameObjects.Sprite> = new Map();
    private rewards: Map<string, Phaser.GameObjects.Sprite> = new Map();
    private bankrollText!: Phaser.GameObjects.Text;
    private speedText!: Phaser.GameObjects.Text;
    private timeText!: Phaser.GameObjects.Text;
    private checkpointText!: Phaser.GameObjects.Text;
    private background!: Phaser.GameObjects.TileSprite;

    private currentState: GameState | null = null;
    private callbacks: GameCallbacks | null = null;
    private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;
    private jumpPressed = false;
    private slidePressed = false;

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { callbacks: GameCallbacks }) {
        this.callbacks = data.callbacks;
    }

    preload() {
        // Load assets from public/assets folder
        this.load.image('background', '/assets/background.png');
        this.load.image('rock', '/assets/rock.png');
        this.load.image('cloud', '/assets/cloud.png');
        this.load.image('burger', '/assets/burger.png');

        // Load player frames
        for (let i = 1; i <= 6; i++) {
            this.load.image(`player${i}`, `/assets/player${i}.png`);
        }
    }

    create() {
        const { width, height } = this.scale;

        // Create animations
        if (!this.anims.exists('player_run')) {
            this.anims.create({
                key: 'player_run',
                frames: [
                    { key: 'player1' },
                    { key: 'player2' },
                    { key: 'player3' },
                    { key: 'player4' },
                    { key: 'player5' },
                    { key: 'player6' }
                ],
                frameRate: 10,
                repeat: -1
            });
        }

        // Background
        // Use 'background' image if available, fallback to grid if not
        const bgKey = this.textures.exists('background') ? 'background' : 'grid';
        this.background = this.add.tileSprite(0, 0, width, height, bgKey);
        this.background.setOrigin(0, 0);

        if (bgKey === 'grid') {
            this.background.setAlpha(0.3);
            // Background gradient backing for grid
            const bg = this.add.graphics();
            bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
            bg.fillRect(0, 0, width, height);
            bg.setDepth(-1);
        }

        // Ground (invisible or simple rect for now, physics handles collision)
        this.ground = this.add.rectangle(width / 2, GROUND_Y + 25, width, 50, 0x4a4e69);
        this.ground.setStrokeStyle(2, 0x9a8c98);
        this.ground.setVisible(bgKey === 'grid'); // Hide ground rect if using image background typically

        // Player
        this.player = this.add.sprite(PLAYER_X, GROUND_Y - PLAYER_HEIGHT / 2, 'player1');
        this.player.play('player_run');
        // Scale player to fit dimensions roughly if needed, or assume assets are correct size
        // For now, let's keep original size or update based on feedback. 
        // Assuming user assets might need scaling:
        this.player.setDisplaySize(PLAYER_WIDTH, PLAYER_HEIGHT);

        // HUD Background
        const hudBg = this.add.rectangle(width / 2, 35, width - 40, 50, 0x000000, 0.6);
        hudBg.setStrokeStyle(2, 0x4a4e69);

        // HUD Text
        this.bankrollText = this.add.text(30, 20, 'BANKROLL: $0.00', {
            fontSize: '18px',
            fontFamily: 'monospace',
            color: '#00ff88',
        });

        this.speedText = this.add.text(280, 20, 'SPEED: 280 px/s', {
            fontSize: '16px',
            fontFamily: 'monospace',
            color: '#88ccff',
        });

        this.timeText = this.add.text(500, 20, 'TIME: 0:00', {
            fontSize: '16px',
            fontFamily: 'monospace',
            color: '#ffffff',
        });

        this.checkpointText = this.add.text(width / 2, 80, '', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffcc00',
            align: 'center',
        });
        this.checkpointText.setOrigin(0.5);
        this.checkpointText.setVisible(false);

        // Input
        if (this.input.keyboard) {
            this.keys = this.input.keyboard.createCursorKeys();
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            this.downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        }

        // Touch controls
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.y < height / 2) {
                this.handleJump();
            } else {
                this.handleSlide();
            }
        });

        // Mobile buttons
        this.createMobileControls(width, height);
    }

    private createMobileControls(width: number, height: number) {
        // Jump button
        const jumpBtn = this.add.rectangle(100, height - 80, 120, 60, 0x4a9eff, 0.8);
        jumpBtn.setInteractive();
        jumpBtn.on('pointerdown', () => this.handleJump());

        const jumpText = this.add.text(100, height - 80, 'JUMP', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffffff',
        });
        jumpText.setOrigin(0.5);

        // Slide button
        const slideBtn = this.add.rectangle(width - 100, height - 80, 120, 60, 0xff6b6b, 0.8);
        slideBtn.setInteractive();
        slideBtn.on('pointerdown', () => this.handleSlide());

        const slideText = this.add.text(width - 100, height - 80, 'SLIDE', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffffff',
        });
        slideText.setOrigin(0.5);
    }

    private handleJump() {
        if (!this.jumpPressed && this.callbacks) {
            this.jumpPressed = true;
            this.callbacks.onInput('jump');
            this.time.delayedCall(100, () => { this.jumpPressed = false; });
        }
    }

    private handleSlide() {
        if (!this.slidePressed && this.callbacks) {
            this.slidePressed = true;
            this.callbacks.onInput('slide');
            this.time.delayedCall(100, () => { this.slidePressed = false; });
        }
    }

    update(time: number, delta: number) {
        // Keyboard input
        if (this.keys) {
            if (Phaser.Input.Keyboard.JustDown(this.spaceKey) || Phaser.Input.Keyboard.JustDown(this.keys.up)) {
                this.handleJump();
            }
            if (Phaser.Input.Keyboard.JustDown(this.downKey) || Phaser.Input.Keyboard.JustDown(this.keys.down)) {
                this.handleSlide();
            }
        }

        // Tick simulation via callback
        if (this.callbacks && this.callbacks.onUpdate) {
            const newState = this.callbacks.onUpdate(time, delta);
            if (newState) {
                this.updateGameState(newState);
            }
        }

        // Scroll background
        if (this.currentState) {
            this.background.tilePositionX += this.currentState.scrollSpeed * 0.016 * 0.1;
        }
    }

    updateGameState(state: GameState) {
        this.currentState = state;

        // Update player position and size
        const playerHeight = state.isSliding ? PLAYER_SLIDE_HEIGHT : PLAYER_HEIGHT;
        // const playerY = state.isSliding ? GROUND_Y - PLAYER_SLIDE_HEIGHT / 2 : GROUND_Y - state.playerY - PLAYER_HEIGHT / 2 + GROUND_Y;

        // Sprite positioning
        // Center x is PLAYER_X
        // Center y should be calculated based on ground and player height
        // Phaser Rect: y is center.

        this.player.setPosition(PLAYER_X, GROUND_Y - playerHeight / 2 - (GROUND_Y - state.playerY));
        this.player.setDisplaySize(PLAYER_WIDTH, playerHeight);

        // Update player animation/color based on state
        // If sliding, maybe rotate or change frame? For now just squash (via setDisplaySize above)
        // If we had a slide animation we would play it here.

        if (state.isSliding) {
            this.player.setTint(0x4a9eff); // Blue-ish tint for slide
        } else if (state.isJumping) {
            this.player.clearTint();
        } else {
            this.player.clearTint();
        }

        // Update obstacles
        const currentObstacleIds = new Set(state.obstacles.map(o => o.id));

        // Remove old obstacles
        for (const [id, ob] of this.obstacles) {
            if (!currentObstacleIds.has(id)) {
                ob.destroy();
                this.obstacles.delete(id);
            }
        }

        // Add/update obstacles
        for (const ob of state.obstacles) {
            let sprite = this.obstacles.get(ob.id);
            if (!sprite) {
                const key = ob.type === 'ground' ? 'rock' : 'cloud';
                // Fallback to geometric if texture missing (handled by Phaser showing placeholder usually, but let's be safe if we want)
                // Actually if key doesn't exist, Phaser shows missing texture.

                sprite = this.add.sprite(ob.x, ob.y - ob.height / 2, key);
                sprite.setDisplaySize(ob.width, ob.height);
                this.obstacles.set(ob.id, sprite);
            }
            sprite.setPosition(ob.x + ob.width / 2, ob.y - ob.height / 2);
            if (ob.hit) {
                sprite.setAlpha(0.5);
                sprite.setTint(0xff0000);
            }
        }

        // Update rewards
        const currentRewardIds = new Set(state.rewards.map(r => r.id));

        for (const [id, rw] of this.rewards) {
            if (!currentRewardIds.has(id)) {
                rw.destroy();
                this.rewards.delete(id);
            }
        }

        for (const rw of state.rewards) {
            let sprite = this.rewards.get(rw.id);
            if (!sprite) {
                sprite = this.add.sprite(rw.x, rw.y - rw.height / 2, 'burger');
                sprite.setDisplaySize(rw.width, rw.height);
                this.rewards.set(rw.id, sprite);
            }
            sprite.setPosition(rw.x + rw.width / 2, rw.y - rw.height / 2);
            if (rw.collected) {
                sprite.setAlpha(0);
            }
        }

        // Update HUD
        const bankrollUsd = (Number(BigInt(state.bankroll)) / 1_000_000).toFixed(2);
        this.bankrollText.setText(`BANKROLL: $${bankrollUsd}`);
        this.speedText.setText(`SPEED: ${Math.round(state.scrollSpeed)} px/s`);

        const minutes = Math.floor(state.elapsedTime / 60);
        const seconds = Math.floor(state.elapsedTime % 60);
        this.timeText.setText(`TIME: ${minutes}:${seconds.toString().padStart(2, '0')}`);

        // Checkpoint notification
        if (state.isCheckpointWindow) {
            this.checkpointText.setVisible(true);
            this.checkpointText.setText(`CHECKPOINT! ${state.checkpointWindowTimer.toFixed(1)}s remaining\nPress E to Exit | P to Pause | C to Continue`);
        } else {
            this.checkpointText.setVisible(false);
        }

        // Run over notification
        if (state.isRunOver) {
            this.checkpointText.setVisible(true);
            this.checkpointText.setText(`RUN ENDED: ${state.exitType?.toUpperCase()}`);
        }
    }
}

// ============ Game Config ============
export function createGameConfig(container: HTMLElement, callbacks: GameCallbacks): Phaser.Types.Core.GameConfig {
    return {
        type: Phaser.AUTO,
        parent: container,
        width: 800,
        height: 500,
        backgroundColor: '#1a1a2e',
        scene: [GameScene],
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { x: 0, y: GRAVITY },
                debug: false,
            },
        },
        callbacks: {
            preBoot: (game) => {
                // Generate grid texture programmatically
                game.textures.addBase64('grid', createGridTexture());
            },
        },
    };
}

function createGridTexture(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.strokeStyle = '#4a4e69';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x < 64; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 64);
        ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < 64; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(64, y);
        ctx.stroke();
    }

    return canvas.toDataURL();
}
