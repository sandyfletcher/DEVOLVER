// -----------------------------------------------------------------------------
// root/js/enemy.js - Enemy Class (Refactored for Config & AI Strategy)
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as ItemManager from '../itemManager.js';
import * as GridCollision from './gridCollision.js';
import { E_EPSILON } from './gridCollision.js';
import { SeekCenterAI } from './ai/seekCenterAI.js';
import { ChasePlayerAI } from './ai/chasePlayerAI.js';
import { FlopAI } from './ai/flopAI.js';
import { FishAI } from './ai/fishAI.js';
import * as AudioManager from '../audioManager.js';

const aiStrategyMap = { // Map AI type strings from config to the actual AI Strategy classes
    'seekCenter': SeekCenterAI,
    'chasePlayer': ChasePlayerAI,
    'flopAI': FlopAI,
    'fishAI': FishAI,
    // 'flyPatrol': FlyerAI, // Add mappings for new AI types here
    // 'standAndShoot': ShooterAI,
};
export class Enemy {
    constructor(x, y, enemyType) {
        this.type = enemyType; // Store the type key
        const stats = Config.ENEMY_STATS[this.type]; // --- Get and Scale Stats from Config ---
        let rawStats; // Store the original stats for reference if needed
        if (!stats) {
            console.error(`>>> Enemy CONSTRUCTOR: Unknown enemy type "${enemyType}". Using fallback stats.`);
            const fallbackStats = Config.ENEMY_STATS[Config.ENEMY_TYPE_CENTER_SEEKER] || {}; // Define minimal fallback stats or default to center_seeker if type is unknown
            rawStats = { // Use a basic fallback if center_seeker is also missing (unlikely)
                displayName: "Unknown (Fallback)",
                aiType: 'seekCenter',
                color: 'purple',
                width_BLOCKS: Config.DEFAULT_ENEMY_WIDTH, // Use block dimensions for fallback
                height_BLOCKS: Config.DEFAULT_ENEMY_HEIGHT,
                maxSpeedX_BLOCKS_PER_SEC: 30, 
                maxSpeedY_BLOCKS_PER_SEC: 50,
                swimSpeed_BLOCKS_PER_SEC: 50,
                health: 1,
                contactDamage: 1,
                applyGravity: true,
                gravityFactor: 1.0,
                canJump: false,
                jumpVelocity_BLOCKS_PER_SEC: 0,
                canSwim: false,
                canFly: false,
                separationFactor: Config.DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR, // Added for fallback
                separationStrength_BLOCKS_PER_SEC: Config.DEFAULT_ENEMY_SEPARATION_STRENGTH / Config.BLOCK_WIDTH,
                landHopHorizontalVelocity_BLOCKS_PER_SEC: 0,
                dropTable: [],
                ...fallbackStats // Merge fallback stats if available
            };
        } else {
            rawStats = { ...stats }; // Copy stats from config
        }
        this.stats = rawStats;
        
        this.width = this.stats.width_BLOCKS * Config.BLOCK_WIDTH;
        this.height = this.stats.height_BLOCKS * Config.BLOCK_HEIGHT;
        this.x = x;
        this.y = y;
        this.color = this.stats.color;
        this.health = this.stats.health;
        this.displayName = this.stats.displayName;
        this.maxSpeedX = this.stats.maxSpeedX_BLOCKS_PER_SEC * Config.BLOCK_WIDTH;
        this.maxSpeedY = this.stats.maxSpeedY_BLOCKS_PER_SEC * Config.BLOCK_HEIGHT;
        this.swimSpeed = this.stats.swimSpeed_BLOCKS_PER_SEC * Config.BLOCK_HEIGHT;
        this.jumpVelocity = this.stats.jumpVelocity_BLOCKS_PER_SEC * Config.BLOCK_HEIGHT;
        this.separationStrength = this.stats.separationStrength_BLOCKS_PER_SEC * Config.BLOCK_WIDTH; 
        this.landHopHorizontalVelocity = this.stats.landHopHorizontalVelocity_BLOCKS_PER_SEC * Config.BLOCK_WIDTH;
        this.canSwim = this.stats.canSwim ?? false;
        this.canFly = this.stats.canFly ?? false;
        this.applyGravityDefault = this.stats.applyGravity ?? !(this.canFly);
        this.canJump = this.stats.canJump ?? false;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.isActive = true;
        this.isInWater = false;
        this.waterJumpCooldown = 0;
        this.isFlopAttacking = false;
        this.isFlashing = false;
        this.flashTimer = 0;
        this.flashDuration = Config.ENEMY_FLASH_DURATION;
        this.isDying = false;
        this.deathAnimationTimer = 0;
        this.isBeingAbsorbed = false;
        this.absorptionProgress = 0;
        const AIStrategyClass = aiStrategyMap[this.stats.aiType];
        if (AIStrategyClass) {
            this.aiStrategy = new AIStrategyClass(this);
        } else {
            console.error(`>>> Enemy CONSTRUCTOR: AI strategy type "${this.stats.aiType}" not found for enemy "${this.displayName}".`);
            this.aiStrategy = {
                decideMovement: () => ({ targetVx: 0, jump: false, targetVy: 0 }),
                reactToCollision: () => {},
            };
        }
        
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Enemy CONSTRUCTOR ERROR: NaN coordinates! Type: ${this.type}. Resetting.`);
            this.x = Config.CANVAS_WIDTH / 2;
            this.y = 50;
        }
    }

    update(dt, playerPosition, allEnemies) { // allEnemies parameter is now passed by EnemyManager
        if (!this.isActive && !this.isDying) return;
        if (this.isBeingAbsorbed) {
            return;
        }
        
        if (typeof dt !== 'number' || isNaN(dt) || dt < 0) {
            console.warn(`Enemy(${this.displayName}) Update: Invalid delta time.`, dt);
            if (this.isDying && this.deathAnimationTimer <= 0) {
                this.isActive = false;
                this.isDying = false;
            }
            if (!this.isActive && !this.isDying) return;
        }
        
        if (this.isDying) {
            this.deathAnimationTimer -= dt;
            if (this.deathAnimationTimer <= 0) {
                this.isActive = false;
                this.isDying = false;
            }
            return;
        }
        
        if (this.isFlashing) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                this.isFlashing = false;
            }
        }
        if (this.waterJumpCooldown > 0) this.waterJumpCooldown -= dt;
        
        this.isInWater = GridCollision.isEntityInWater(this);
        
        if (this.type === Config.ENEMY_TYPE_DUNKLEOSTEUS && !this.isInWater && this.health > 0) {
            const damagePerSecond = this.stats.outOfWaterDamagePerSecond ?? 0;
            if (damagePerSecond > 0) {
                const damageThisFrame = damagePerSecond * dt;
                this.takeDamage(damageThisFrame);
            }
        }
        
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Enemy UPDATE ERROR (${this.displayName}): Skipping update due to NaN coordinates!`);
            return;
        }
        
        const aiDecision = this.aiStrategy.decideMovement(playerPosition, allEnemies, dt);
        let targetVx = aiDecision?.targetVx ?? 0;
        let targetVy = aiDecision?.targetVy ?? 0;
        let wantsJump = aiDecision?.jump ?? false;

        // --- Separation Behavior (Apply after primary movement/physics) ---
        // Calculate separation force from other enemies
        let separationForceX = 0;
        let separationForceY = 0;
        let neighborsCount = 0;
        // Separation radius scales with entity width (which already scales with BLOCK_WIDTH) and separationFactor (remains factor)
        const separationRadius = this.width * (this.stats.separationFactor ?? Config.DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR); 
        const separationRadiusSq = separationRadius * separationRadius;

        if (allEnemies) { // Ensure allEnemies list is provided
            for (const otherEnemy of allEnemies) {
                // Exclude self, inactive, dying, or being absorbed enemies
                if (otherEnemy === this || !otherEnemy.isActive || otherEnemy.isDying || otherEnemy.isBeingAbsorbed) continue; 

                const dx = this.x - otherEnemy.x;
                const dy = this.y - otherEnemy.y;
                const distSq = dx * dx + dy * dy;

                if (distSq > 0 && distSq < separationRadiusSq) { // Only repel if within radius and not at exact same spot
                    const dist = Math.sqrt(distSq);
                    if (dist > E_EPSILON) { // Avoid division by zero for very small distances
                        const repelStrength = (1.0 - (dist / separationRadius)); // Stronger repulsion when closer
                        separationForceX += (dx / dist) * repelStrength;
                        separationForceY += (dy / dist) * repelStrength * 0.5; // Weaker vertical push
                        neighborsCount++;
                    }
                }
            }
        }

        // Apply separation velocity adjustment
        if (neighborsCount > 0) {
            // Use scaled separation strength from constructor
            const separationBoostX = separationForceX * this.separationStrength * dt; // Apply as acceleration
            const separationBoostY = separationForceY * this.separationStrength * dt; // Apply as acceleration

            // Apply separation. May need different application based on enemy type (e.g. flying, swimming)
            // For simplicity, apply directly to vx/vy for all types. This influences the target velocity.
            this.vx += separationBoostX;
            this.vy += separationBoostY;
        }
        
        // ... (rest of the _applyPhysics logic as it was, unchanged) ...
        let currentGravity = Config.GRAVITY_ACCELERATION * (this.stats.gravityFactor ?? 1.0);
        let useStandardGravity = this.applyGravityDefault;
        let applyWaterEffects = false;

        if (this.canFly && !this.isOnGround) {
            useStandardGravity = false;
            this.vy = targetVy;
            this.vy = Math.max(-this.maxSpeedY, Math.min(this.maxSpeedY, this.vy));
            this.vx = targetVx;
        } else if (this.canSwim && this.isInWater) {
            useStandardGravity = false;
            this.vy = targetVy;
            this.vy = Math.max(-this.swimSpeed, Math.min(this.swimSpeed, this.vy));
            this.vx = targetVx;
            this.vx *= Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt);
            this.vy *= Math.pow(Config.WATER_VERTICAL_DAMPING, dt);
        } else {
            applyWaterEffects = this.isInWater;
            
            if (applyWaterEffects) {
                this.vy -= Config.ENEMY_WATER_BUOYANCY_ACCEL * dt;
            }
            
            if (useStandardGravity && !this.isOnGround) {
                const gravityMultiplier = applyWaterEffects ? Config.WATER_GRAVITY_FACTOR : 1.0;
                this.vy += currentGravity * gravityMultiplier * dt;
            } else if (this.isOnGround && this.vy > E_EPSILON) {
                this.vy = 0;
            }
            
            if (applyWaterEffects) {
                this.vy *= Math.pow(Config.WATER_VERTICAL_DAMPING, dt);
            }
            
            if (wantsJump && this.canJump) {
                if (applyWaterEffects) {
                    if (this.waterJumpCooldown <= 0) {
                        this.vy = -(this.jumpVelocity * 0.8);
                        this.waterJumpCooldown = Config.WATER_JUMP_COOLDOWN_DURATION;
                        this.isOnGround = false;
                    }
                } else if (this.isOnGround) {
                    this.vy = -this.jumpVelocity;
                    this.isOnGround = false;
                }
            }
            
            this.vx = targetVx;
            if (applyWaterEffects) {
                this.vx *= Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt);
            }
        }
        
        const currentMaxSpeedX = this.isInWater && !this.canSwim ? this.maxSpeedX * Config.WATER_MAX_SPEED_FACTOR : this.maxSpeedX;
        this.vx = Math.max(-currentMaxSpeedX, Math.min(currentMaxSpeedX, this.vx));
        
        if (applyWaterEffects) {
            this.vy = Math.max(this.vy, -Config.WATER_MAX_SWIM_UP_SPEED);
            this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED);
        } else if (!this.canFly && !this.isInWater) {
            this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED);
        }

        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;
        
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround;
        
        if (this.canFly && targetVy < 0 && collisionResult.collidedY && this.vy >= 0) {
            // Keep existing logic for flyers, if any specific handling is desired.
        } else {
            if (collisionResult.collidedX) this.vx = 0;
            if (collisionResult.collidedY) this.vy = 0;
        }
        
        this.aiStrategy.reactToCollision(collisionResult);
        
        if (this.x < 0) { this.x = 0; if (this.vx < 0) this.vx = 0; }
        if (this.x + this.width > Config.CANVAS_WIDTH) { this.x = Config.CANVAS_WIDTH - this.width; if (this.vx > 0) this.vx = 0; }
        if (this.y > Config.CANVAS_HEIGHT + 200) {
            this.die(false);
        }
    }
       takeDamage(amount) {
        // Do not take damage if already inactive, getting absorbed OR currently in the dying animation state
        if (this.isBeingAbsorbed || !this.isActive || this.isDying || this.isFlashing) return;
        const healthBefore = this.health;
        this.health -= amount;
        this.isFlashing = true;
        this.flashTimer = this.flashDuration;
        if (this.health <= 0) {
            // This will now transition to the dying state instead of immediate isActive = false
            this.die(true); // Pass true as it was killed by player attack
        }
    }
    // Handles enemy death, deactivation, and item drops based on dropTable
    die(killedByPlayer = true) {
        // Prevent dying animation from starting multiple times
        if (!this.isActive || this.isDying) return;
        // console.log(`[Enemy] Starting death animation for ${this.displayName}. Killed by player: ${killedByPlayer}`);
        // Stop movement immediately
        this.vx = 0;
        this.vy = 0;
        this.isFlopAttacking = false; // Ensure this is off
        // Set dying state and timer
        this.isDying = true;
        this.deathAnimationTimer = Config.ENEMY_DEATH_ANIMATION_DURATION; // Time-based, no scaling needed
        // Keep isActive = true *during* the animation so it's updated and drawn.
        // It will be set to false in update() when the timer expires.
        // Handle item drops immediately when the enemy *starts* dying
        if (killedByPlayer && !this.isBeingAbsorbed && this.stats.dropTable && this.stats.dropTable.length > 0) {
            if (typeof this.x !== 'number' || typeof this.y !== 'number' || isNaN(this.x) || isNaN(this.y)) {
                console.error(`>>> ${this.displayName} died with invalid coordinates [${this.x}, ${this.y}], skipping drop spawn.`);
            } else {
                this.stats.dropTable.forEach(dropInfo => {
                    if (Math.random() < (dropInfo.chance ?? 0)) {
                        const min = dropInfo.minAmount ?? 1;
                        const max = dropInfo.maxAmount ?? 1;
                        const amount = Math.floor(Math.random() * (max - min + 1)) + min;
                        for (let i = 0; i < amount; i++) {
                            // Use the center of the enemy's bounding box for drop spawn location
                            let dropXBase = this.x + this.width / 2;
                            let dropYBase = this.y + this.height / 2;
                            // Add some random scatter scaled by enemy size
                            let dropX = dropXBase + (Math.random() - 0.5) * this.width * 0.5; // Scatter within 50% of enemy width
                            let dropY = dropYBase + (Math.random() - 0.5) * this.height * 0.5; // Scatter within 50% of enemy height

                            if (!isNaN(dropX) && !isNaN(dropY) && typeof dropX === 'number' && typeof dropY === 'number') { // ensure coordinates are valid
                                ItemManager.spawnItem(dropX, dropY, dropInfo.type);
                            } else {
                                console.error(`>>> ITEM SPAWN FAILED: Invalid drop coordinates [${dropX}, ${dropY}] for ${dropInfo.type} from ${this.displayName} death.`);
                            }
                        }
                    }
                });
            }
        }
        // Optional: Play enemy death/pop sound effect here
        // AudioManager.playSound(Config.AUDIO_TRACKS.enemy_pop);
    }
    getPosition() {
        return { x: this.x, y: this.y };
    }
    getRect() { // No change needed, the rect is the base size, transformation happens in draw
        const safeX = (typeof this.x === 'number' && !isNaN(this.x)) ? this.x : 0;
        const safeY = (typeof this.y === 'number' && !isNaN(this.y)) ? this.y : 0;
        return { x: safeX, y: safeY, width: this.width, height: this.height };
    }
    // Modify draw() to handle the dying animation visual
    draw(ctx) {
        // Only draw if the enemy is active OR currently dying
        if (!this.isActive && !this.isDying || !ctx) return;
        if (this.isBeingAbsorbed) { return; }
        // Ensure coordinates are valid before drawing
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Enemy DRAW ERROR (${this.displayName}): Preventing draw due to NaN coordinates!`);
            return;
        }

        // --- Handle Dying Animation Drawing ---
        if (this.isDying) {
            ctx.save(); // Save context before transformations
            const totalAnimationDuration = Config.ENEMY_DEATH_ANIMATION_DURATION;
            const swellDuration = Config.ENEMY_SWELL_DURATION;
            const timeElapsed = totalAnimationDuration - this.deathAnimationTimer; // Time passed since animation started
            let currentScale = 1.0; // Default scale
            // Swell phase: Scale up during the first Config.ENEMY_SWELL_DURATION
            if (timeElapsed >= 0 && timeElapsed < swellDuration) { // Check elapsed time against swell duration
                const swellProgress = timeElapsed / swellDuration; // 0 to <1
                currentScale = 1.0 + (Config.ENEMY_SWELL_SCALE - 1.0) * swellProgress; // Lerp scale
            } else {
                // After swell duration, animation is effectively over.
                // The update loop should set isActive=false when deathAnimationTimer <= 0.
                // If we reach here with isDying=true but timeElapsed >= totalAnimationDuration, it's a fallback.
                ctx.restore(); // Restore context if saved
                return; // Do not draw after animation duration
            }
            // Calculate pivot point (center of the entity)
            const pivotX = this.x + this.width / 2;
            const pivotY = this.y + this.height / 2;
            // Translate to pivot, scale, translate back
            ctx.translate(pivotX, pivotY);
            ctx.scale(currentScale, currentScale);
            ctx.translate(-pivotX, -pivotY);
            // Draw the entity rectangle at the potentially scaled position
            // Use original color for death animation, not flashing
            ctx.fillStyle = this.color;
            // Note: fillRect needs the original x, y, width, height. Transformations handle the rest.
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
            ctx.restore(); // Restore context
            return; // Drawing handled, exit
        }
        // --- Normal Active Drawing Logic (Only if NOT dying) ---
        // The following code is only reached if `!this.isDying`
        let drawColor = this.color;
        if (this.isFlashing) {
            drawColor = 'white';
        }
        ctx.fillStyle = drawColor;
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
        ctx.strokeStyle = 'white'; // Bright color
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
    }
    // Method to determine current contact damage based on state
    getCurrentContactDamage() {
        if (this.isDying) return 0; // If dying, enemy deals no damage
        let damage = 0; // Default to 0 if this method is called on a type that doesn't have contact damage logic defined here
        // --- Specific Logic for Tetrapod ---
        if (this.type === Config.ENEMY_TYPE_TETRAPOD) {
            if (this.isInWater) {
                // Damage when in water (uses fixed damage value)
                damage = Config.TETRAPOD_WATER_CONTACT_DAMAGE;
            } else if (this.isOnGround) {
                // Damage when on land (only during flop attack state) (uses fixed damage value)
                damage = this.isFlopAttacking ? Config.TETRAPOD_LAND_FLOP_DAMAGE : Config.TETRAPOD_LAND_STILL_DAMAGE;
            } else {
                // Damage when airborne over land (e.g., falling between hops)
                // Maybe still 0 damage if not actively flopping? Let's say 0 unless isFlopAttacking
                damage = this.isFlopAttacking ? Config.TETRAPOD_LAND_FLOP_DAMAGE : Config.TETRAPOD_LAND_STILL_DAMAGE; // Same as land logic
            }
        }
        // NEW: Specific Logic for Dunkleosteus
        else if (this.type === Config.ENEMY_TYPE_DUNKLEOSTEUS) {
            // Dunkleosteus deals its configured contactDamage when in water, 0 otherwise
            damage = this.isInWater ? (this.stats?.contactDamage ?? 0) : 0;
        }
        // --- Add Specific Logic for Other Enemy Types Here If Needed ---
        // else if (this.type === Config.ENEMY_TYPE_SPIKE_BALL) {
        //      return Config.SPIKE_BALL_DAMAGE; // Example: Always deals damage
        // }
        // else if (this.type === Config.ENEMY_TYPE_SLEEPER) {
        //      return this.isAwake ? Config.SLEEPER_AWAKE_DAMAGE : 0; // Example: Deals damage only when awake
        // }
        // --- Default for Other Types ---
        else {
            // For any enemy type not handled above, fall back to their base contactDamage stat (fixed value)
            damage = this.stats?.contactDamage ?? 0;
        }
        return damage;
    }
}