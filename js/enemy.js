// -----------------------------------------------------------------------------
// root/js/enemy.js - Enemy Class (Refactored for Config & AI Strategy)
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as ItemManager from './itemManager.js'; // Needed for drops on death
import * as World from './worldManager.js';   // Potentially needed by AI strategies later
import * as GridCollision from './utils/gridCollision.js'; // For physics and water detection
import { SeekCenterAI } from './ai/seekCenterAI.js';
import { ChasePlayerAI } from './ai/chasePlayerAI.js';
import { FlopAI } from './ai/flopAI.js';

// Map AI type strings from config to the actual AI Strategy classes
const aiStrategyMap = {
    'seekCenter': SeekCenterAI,
    'chasePlayer': ChasePlayerAI,
    'flopAI': FlopAI,
    // 'flyPatrol': FlyerAI, // Add mappings for new AI types here
    // 'standAndShoot': ShooterAI,
};

export class Enemy {
    constructor(x, y, enemyType) {
        this.type = enemyType; // Store the type key

        // --- Get stats from Config ---
        const stats = Config.ENEMY_STATS[this.type];
        if (!stats) {
            console.error(`>>> Enemy CONSTRUCTOR: Unknown enemy type "${enemyType}". Using fallback stats.`);
            // Define minimal fallback stats or default to a known type
            // For now, default to center_seeker if type is unknown
            const fallbackStats = Config.ENEMY_STATS[Config.ENEMY_TYPE_CENTER_SEEKER] || {};
            this.stats = {
                displayName: "Unknown (Fallback)",
                aiType: Config.ENEMY_TYPE_CENTER_SEEKER,
                color: 'purple',
                width: Config.DEFAULT_ENEMY_WIDTH,
                height: Config.DEFAULT_ENEMY_HEIGHT,
                maxSpeedX: 30,
                health: 1,
                contactDamage: 1,
                applyGravity: true,
                gravityFactor: 1.0,
                canJump: false,
                jumpVelocity: 0,
                separationFactor: Config.DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR,
                separationStrength: Config.DEFAULT_ENEMY_SEPARATION_STRENGTH,
                dropTable: [],
                ...fallbackStats
            };
        } else {
            // Use stats directly from config, providing defaults from Config where applicable
            this.stats = {
                ...stats,
                width: stats.width ?? Config.DEFAULT_ENEMY_WIDTH,
                height: stats.height ?? Config.DEFAULT_ENEMY_HEIGHT,
                separationFactor: stats.separationFactor ?? Config.DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR,
                separationStrength: stats.separationStrength ?? Config.DEFAULT_ENEMY_SEPARATION_STRENGTH,
                applyGravity: stats.applyGravity ?? true,
                gravityFactor: stats.gravityFactor ?? 1.0,
                contactDamage: stats.contactDamage ?? 1,
                dropTable: stats.dropTable ?? [],
            };
        }

        // --- Assign Core Properties from Stats ---
        this.x = x;
        this.y = y;
        this.width = this.stats.width;
        this.height = this.stats.height;
        this.color = this.stats.color;
        this.health = this.stats.health;
        this.maxSpeedX = this.stats.maxSpeedX;
        this.displayName = this.stats.displayName;

        // --- Physics State ---
        this.vx = 0; // Velocity pixels/sec
        this.vy = 0; // Velocity pixels/sec
        this.isOnGround = false;
        this.isActive = true;
        this.isInWater = false; // Initialize water state flag

        // --- Visual Feedback State ---
        this.isFlashing = false;
        this.flashTimer = 0;
        this.flashDuration = Config.ENEMY_FLASH_DURATION;

        // --- Instantiate AI Strategy ---
        const AIStrategyClass = aiStrategyMap[this.stats.aiType];
        if (AIStrategyClass) {
            // Pass 'this' (the enemy instance) to the AI strategy constructor
            // so the strategy can access the enemy's state and properties.
            this.aiStrategy = new AIStrategyClass(this);
        } else {
            // Assign a dummy strategy to prevent errors during update
            console.error(`>>> Enemy CONSTRUCTOR: AI strategy type "${this.stats.aiType}" not found for enemy "${this.displayName}".`);
            this.aiStrategy = {
                decideMovement: () => ({ targetVx: 0, jump: false }),
                reactToCollision: () => {}
            };
        }

        // --- Initial Position Validation ---
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Enemy CONSTRUCTOR ERROR: NaN coordinates! Type: ${this.type}. Resetting.`);
            this.x = Config.CANVAS_WIDTH / 2;
            this.y = 50;
        }
    }

    /**
     * Updates the enemy's state, delegating behavioral decisions to its AI strategy.
     * @param {number} dt - Delta time.
     * @param {object | null} playerPosition - Current player {x, y} or null.
     * @param {Array<Enemy>} allEnemies - List of all active enemies for separation checks.
     */
    update(dt, playerPosition, allEnemies) {
        if (!this.isActive) return;
        this.isInWater = GridCollision.isEntityInWater(this); // Detect water status first

        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Enemy UPDATE ERROR (${this.displayName}): Skipping update due to NaN coordinates!`);
             return; // Skip update if invalid
        }

        // --- Update Flash Timer ---
        if (this.isFlashing) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                this.isFlashing = false;
            }
        }

        // --- Get Current Physics Params (modified if in water) ---
        const baseGravityFactor = this.stats.gravityFactor ?? 1.0;
        const currentGravity = this.isInWater ? Config.GRAVITY_ACCELERATION * baseGravityFactor * Config.WATER_GRAVITY_FACTOR : Config.GRAVITY_ACCELERATION * baseGravityFactor;
        const currentMaxSpeedX = this.isInWater ? this.stats.maxSpeedX * Config.WATER_MAX_SPEED_FACTOR : this.stats.maxSpeedX;
        const horizontalDampingFactor = this.isInWater ? Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt) : 1;
        const verticalDampingFactor = this.isInWater ? Math.pow(Config.WATER_VERTICAL_DAMPING, dt) : 1;

        // --- 1. Get Movement Intent from AI Strategy ---
        // The AI strategy decides the *intended* base velocity or action (like jump)
        const aiDecision = this.aiStrategy.decideMovement(playerPosition, allEnemies, dt);
        // Expecting aiDecision structure like: { targetVx: number, jump: boolean }
        // More complex AI might return target positions, attack commands, etc.

        let baseVx = 0;
        // Apply acceleration towards AI's target velocity (similar to player) - optional refinement
        // For simplicity now, just set vx towards target directly up to max speed
        if (aiDecision && typeof aiDecision.targetVx === 'number') {
             baseVx = Math.max(-currentMaxSpeedX, Math.min(currentMaxSpeedX, aiDecision.targetVx));
        }
         // jumping if in water (can be adjusted later if specific enemies should jump/swim)
         if (aiDecision && aiDecision.jump && this.stats.canJump && this.isOnGround) {
             this.vy = -this.stats.jumpVelocity;
             this.isOnGround = false;
         }

        // Set initial vx for this frame based on AI
        this.vx = baseVx;
        // Apply horizontal water damping to AI's intended movement
        if (this.isInWater) {
            this.vx *= horizontalDampingFactor;
        }

        // --- 2. Separation Behavior ---
        let separationForceX = 0;
        let separationForceY = 0;
        let neighborsCount = 0;
        const separationRadius = this.width * this.stats.separationFactor;
        const separationRadiusSq = separationRadius * separationRadius;

        if (allEnemies) {
            for (const otherEnemy of allEnemies) {
                if (otherEnemy === this || !otherEnemy.isActive) continue;
                const dx = this.x - otherEnemy.x;
                const dy = this.y - otherEnemy.y;
                const distSq = dx * dx + dy * dy;
                if (distSq > 0 && distSq < separationRadiusSq) {
                    const dist = Math.sqrt(distSq);
                    const repelStrength = (1.0 - (dist / separationRadius));
                    separationForceX += (dx / dist) * repelStrength;
                    separationForceY += (dy / dist) * repelStrength * 0.5; // Weaker vertical push
                    neighborsCount++;
                }
            }
        }
        // Apply separation velocity adjustment
        if (neighborsCount > 0) {
            const separationBoostX = separationForceX * this.stats.separationStrength;
            const separationBoostY = separationForceY * this.stats.separationStrength;
            this.vx += separationBoostX; // Apply separation boost
            // Apply vertical boost cautiously (maybe reduce in water?)
             if (this.isOnGround || Math.abs(separationBoostY) > 10 || this.isInWater) {
                 this.vy += separationBoostY; // Add boost directly
             }
        }

        // --- 3. Physics: Apply Gravity ---
        if (this.stats.applyGravity && !this.isOnGround) {
            this.vy += currentGravity * dt; // Apply potentially reduced gravity
        } else if (this.isOnGround && this.vy > 0) {
            this.vy = 0;
        }

        // --- Apply Vertical Damping, Buoyancy & Clamp Speed ---
        if (this.isInWater) {
            // Apply buoyancy FIRST (acts against gravity)
            this.vy -= Config.ENEMY_WATER_BUOYANCY_ACCEL * dt; // Subtract because Y decreases upwards

            // Apply damping to the resulting velocity
            this.vy *= verticalDampingFactor;

            // Clamp vertical speed (both up and down)
            // Prevent buoyancy alone from causing excessive upward speed
            this.vy = Math.max(this.vy, -Config.WATER_MAX_SWIM_UP_SPEED * 0.3); // Limit passive rise speed (e.g., 30% of player swim)
            this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED); // Clamp sink speed
        } else {
            // Clamp fall speed in air
             this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED);
        }

        // --- 4. Physics: Grid Collision ---
        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround; // Update ground status

        // Zero out velocity if collision occurred
        if (collisionResult.collidedX) this.vx = 0;
        if (collisionResult.collidedY) {
           if (Math.abs(this.vy) > 0.1) { // Check magnitude
               this.vy = 0;
           }
        }

        // --- 5. AI Reaction to Collision ---
        this.aiStrategy.reactToCollision(collisionResult);

        // --- 6. Final Checks ---
         if (this.x < 0) { this.x = 0; if (this.vx < 0) this.vx = 0; }
         if (this.x + this.width > Config.CANVAS_WIDTH) { this.x = Config.CANVAS_WIDTH - this.width; if (this.vx > 0) this.vx = 0; }
        if (this.y > Config.CANVAS_HEIGHT + 200) {
            this.die(false); // Fell out
        }
    } // End of update method

    takeDamage(amount) {
        if (!this.isActive || this.isFlashing) return;

        const healthBefore = this.health;
        this.health -= amount;
        this.isFlashing = true;
        this.flashTimer = this.flashDuration;

        if (this.health <= 0) {
             this.die(true);
        }
    }

    /**
     * Handles enemy death, deactivation, and item drops based on dropTable.
     * @param {boolean} killedByPlayer - Indicates if death was from damage (true) or other causes (e.g., falling out). Might affect drop logic later.
     */
    die(killedByPlayer = true) {
        if (!this.isActive) return;
        this.isActive = false;
        this.vx = 0;
        this.vy = 0;

        if (killedByPlayer && this.stats.dropTable && this.stats.dropTable.length > 0) {
            if (typeof this.x !== 'number' || typeof this.y !== 'number' || isNaN(this.x) || isNaN(this.y)) {
                console.error(`>>> ${this.displayName} died with invalid coordinates [${this.x}, ${this.y}], skipping drop spawn.`);
                return;
            }
            this.stats.dropTable.forEach(dropInfo => {
                if (Math.random() < (dropInfo.chance ?? 0)) {
                    const min = dropInfo.minAmount ?? 1;
                    const max = dropInfo.maxAmount ?? 1;
                    const amount = Math.floor(Math.random() * (max - min + 1)) + min;
                    for (let i = 0; i < amount; i++) {
                        const itemConf = Config.ITEM_CONFIG[dropInfo.type] || Config.ITEM_CONFIG['wood'];
                        const itemHeight = itemConf?.height || Config.BLOCK_HEIGHT;
                        let dropXBase = this.x + this.width / 2;
                        let dropYBase = this.y - itemHeight - (Config.BLOCK_HEIGHT * 0.25);
                        let dropX = dropXBase + (Math.random() - 0.5) * (this.width * 0.6);
                        let dropY = dropYBase + (Math.random() - 0.5) * (Config.BLOCK_HEIGHT * 0.5);

                        if (!isNaN(dropX) && !isNaN(dropY)) {
                             ItemManager.spawnItem(dropX, dropY, dropInfo.type);
                        } else {
                            console.error(`>>> ITEM SPAWN FAILED: NaN coords for ${dropInfo.type} from ${this.displayName}.`);
                        }
                    }
                }
            });
        }
    }

    getPosition() {
         return { x: this.x, y: this.y };
    }

    getRect() {
         const safeX = (typeof this.x === 'number' && !isNaN(this.x)) ? this.x : 0;
         const safeY = (typeof this.y === 'number' && !isNaN(this.y)) ? this.y : 0;
         return { x: safeX, y: safeY, width: this.width, height: this.height };
    }

    draw(ctx) {
        if (!this.isActive || !ctx) return;
        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Enemy DRAW ERROR (${this.displayName}): Preventing draw due to NaN coordinates!`);
             return;
        }

        let drawColor = this.color;
        if (this.isFlashing) {
             drawColor = 'white';
        }

        ctx.fillStyle = drawColor;
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
    }
} // End of Enemy Class