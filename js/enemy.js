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
                canSwim: stats.canSwim ?? false,
                canFly: stats.canFly ?? false,
// Optionally read maxSpeedY if needed for flyers/swimmers
                maxSpeedY: stats.maxSpeedY ?? 50,
// Ensure applyGravity defaults correctly based on canFly
                applyGravity: stats.applyGravity ?? ! (stats.canFly ?? false),
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

        // --- Store Movement Capabilities ---
        this.canSwim = this.stats.canSwim;
        this.canFly = this.stats.canFly;
        this.applyGravityDefault = this.stats.applyGravity; // Store the default gravity setting

        // --- Physics State ---
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.isActive = true;
        this.isInWater = false;
        this.waterJumpCooldown = 0; // Keep for non-swimming jumpers


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
        // --- Determine Current Environment State ---
        this.isInWater = GridCollision.isEntityInWater(this);
        // Note: isOnGround is updated by collideAndResolve later,
        // but we might need its state *from the previous frame* here.
        // Let's assume collisionResult.isOnGround is the most up-to-date check.

        // --- Reset water jump cooldown if just exited water (for non-swimmers) ---
        if (!this.isInWater && this.waterJumpCooldown > 0) {
            this.waterJumpCooldown = 0;
        }
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
        if (this.waterJumpCooldown > 0) this.waterJumpCooldown -= dt;

        // --- 1. Get Movement Intent from AI Strategy ---
        // AI now potentially returns { targetVx, targetVy, jump }
        const aiDecision = this.aiStrategy.decideMovement(playerPosition, allEnemies, dt);
        let targetVx = aiDecision?.targetVx ?? 0;
        let targetVy = aiDecision?.targetVy ?? 0; // AI controls vertical for swim/fly
        let wantsJump = aiDecision?.jump ?? false; // For ground/water jumps

        // --- 2. Apply Physics & Movement Based on Mode ---

        let currentGravity = Config.GRAVITY_ACCELERATION * (this.stats.gravityFactor ?? 1.0);
        let useStandardGravity = this.applyGravityDefault; // Start with default
        let applyWaterEffects = false; // Flag for standard water physics (damping, buoyancy)

        // --- Mode Switching ---
        if (this.canFly && !this.isOnGround) { // FLYING MODE (if not landed)
            useStandardGravity = false; // Override gravity for flyers
            // Apply AI's vertical target directly (potentially with limits/smoothing)
            this.vy = targetVy; // Simplest: Directly set velocity based on AI
            // Could add acceleration: this.vy += (targetVy - this.vy) * flyAccel * dt;
            this.vy = Math.max(-this.stats.maxSpeedY, Math.min(this.stats.maxSpeedY, this.vy)); // Clamp vertical speed

            // Horizontal movement
            this.vx = targetVx; // Directly set based on AI
            // Apply some air friction/damping? (Optional)
            // this.vx *= Math.pow(AIR_DAMPING, dt);

        } else if (this.canSwim && this.isInWater) { // SWIMMING MODE
            useStandardGravity = false; // Override gravity/buoyancy for smooth swimmers
            // Apply AI's vertical target directly
            this.vy = targetVy;
            this.vy = Math.max(-this.stats.maxSpeedY, Math.min(this.stats.maxSpeedY, this.vy)); // Clamp vertical speed

            // Apply AI's horizontal target
            this.vx = targetVx;
            // Apply strong water damping to horizontal movement
            this.vx *= Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt);
            // Apply some vertical damping too?
            this.vy *= Math.pow(Config.WATER_VERTICAL_DAMPING, dt); // Less aggressive damping maybe?


        } else { // STANDARD MODE (Ground or Non-Flyer Airborne or Non-Swimmer in Water)
            applyWaterEffects = this.isInWater; // Standard water physics apply if submerged

            // Apply Buoyancy (only for non-swimmers in water)
            if (applyWaterEffects) { // Implicitly !this.canSwim here
                this.vy -= Config.ENEMY_WATER_BUOYANCY_ACCEL * dt;
            }

            // Apply Gravity (potentially reduced in water)
            if (useStandardGravity && !this.isOnGround) {
                const gravityMultiplier = applyWaterEffects ? Config.WATER_GRAVITY_FACTOR : 1.0;
                this.vy += currentGravity * gravityMultiplier * dt;
            } else if (this.isOnGround && this.vy > 0) {
                this.vy = 0; // Clamp on ground
            }

            // Apply Standard Vertical Damping (only for non-swimmers in water)
            if (applyWaterEffects) { // Implicitly !this.canSwim here
                 this.vy *= Math.pow(Config.WATER_VERTICAL_DAMPING, dt);
            }

            // Handle Jumps (Ground or Water Strokes for non-swimmers)
            if (wantsJump && this.stats.canJump) {
                if (applyWaterEffects) { // Water Stroke (for non-swimmer)
                    if (this.waterJumpCooldown <= 0) {
                        this.vy = -(this.stats.jumpVelocity * 0.8); // Impulse
                        this.waterJumpCooldown = Config.WATER_JUMP_COOLDOWN_DURATION;
                        this.isOnGround = false;
                    }
                } else if (this.isOnGround) { // Ground Jump
                    this.vy = -this.stats.jumpVelocity;
                    this.isOnGround = false;
                }
            }

            // Apply Horizontal Movement & Damping
            this.vx = targetVx; // Base horizontal speed from AI
            if (applyWaterEffects) {
                this.vx *= Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt);
            }
            // Add ground friction here if desired (if !applyWaterEffects && this.isOnGround)
        }


        // --- Clamp Speeds (After potential jumps/mode changes) ---
        const currentMaxSpeedX = this.isInWater && !this.canSwim ? this.stats.maxSpeedX * Config.WATER_MAX_SPEED_FACTOR : this.stats.maxSpeedX;
        this.vx = Math.max(-currentMaxSpeedX, Math.min(currentMaxSpeedX, this.vx));

        if (applyWaterEffects) { // Non-swimmer in water
             this.vy = Math.max(this.vy, -Config.WATER_MAX_SWIM_UP_SPEED); // Limit stroke upward speed
             this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED);
        } else if (!this.canFly && !this.isInWater) { // Standard air fall
             this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED);
        }
        // Flyers/Swimmers already had vy clamped in their blocks

        // --- 3. Separation Behavior (Apply after primary movement/physics) ---
        let separationForceX = 0;
        let separationForceY = 0;
        let neighborsCount = 0; // <<< DECLARE AND INITIALIZE HERE
        const separationRadius = this.width * this.stats.separationFactor;
        const separationRadiusSq = separationRadius * separationRadius;

        if (allEnemies) { // Check if the list was provided
            for (const otherEnemy of allEnemies) {
                if (otherEnemy === this || !otherEnemy.isActive) continue;
                const dx = this.x - otherEnemy.x;
                const dy = this.y - otherEnemy.y;
                const distSq = dx * dx + dy * dy;

                // Check distance and avoid self-collision check edge case
                if (distSq > 0 && distSq < separationRadiusSq) {
                    const dist = Math.sqrt(distSq);
                    // Avoid division by zero if dist is somehow extremely small
                    if (dist > 1e-5) {
                         const repelStrength = (1.0 - (dist / separationRadius));
                         separationForceX += (dx / dist) * repelStrength;
                         separationForceY += (dy / dist) * repelStrength * 0.5; // Weaker vertical push
                         neighborsCount++; // <<< INCREMENT HERE
                    }
                }
            }
        }
        // Calculate the actual boost vectors AFTER iterating through all enemies
        const separationBoostX = (neighborsCount > 0) ? separationForceX * this.stats.separationStrength : 0;
        const separationBoostY = (neighborsCount > 0) ? separationForceY * this.stats.separationStrength : 0;
        
        // Apply separation velocity adjustment
        if (neighborsCount > 0) {
            // Be careful applying separation in fly/swim modes - might need adjustment
            if (!this.canFly && !(this.canSwim && this.isInWater)) {
                this.vx += separationBoostX;
                if (this.isOnGround || Math.abs(separationBoostY) > 10 || this.isInWater) {
                    this.vy += separationBoostY;
                }
            } else {
                 // How flyers/swimmers handle separation? Maybe only horizontal? Or ignore?
                 this.vx += separationBoostX;
                 // this.vy += separationBoostY * 0.5; // Weaker vertical push for flyers/swimmers?
            }
        }

        // --- 4. Physics: Grid Collision ---
        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;

        // Modify collision checks based on mode?
        // Flyers might ignore ground unless Y is close to ground level?
        // Swimmers ignore water blocks.
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround; // Update ground status

        // Flyers shouldn't get stuck on ground if they are trying to fly up
        if (this.canFly && targetVy < 0 && collisionResult.collidedY && this.vy >= 0) {
            // If flyer wants up, hit head/ground, and is now moving down/stopped, clear vy?
            // This needs careful thought - maybe just let collision handle it.
        } else {
             if (collisionResult.collidedX) this.vx = 0;
             if (collisionResult.collidedY) this.vy = 0;
        }


        // --- 5. AI Reaction to Collision ---
        this.aiStrategy.reactToCollision(collisionResult); // Pass result to AI

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