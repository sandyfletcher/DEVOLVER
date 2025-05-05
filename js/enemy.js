// -----------------------------------------------------------------------------
// root/js/enemy.js - Enemy Class (Refactored for Config & AI Strategy)
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as ItemManager from './itemManager.js'; // Needed for drops on death
import * as GridCollision from './utils/gridCollision.js'; // For physics and water detection
import { E_EPSILON } from './utils/gridCollision.js';
import { SeekCenterAI } from './ai/seekCenterAI.js';
import { ChasePlayerAI } from './ai/chasePlayerAI.js';
import { FlopAI } from './ai/flopAI.js';
import * as AudioManager from './audioManager.js'; // Import AudioManager

// Map AI type strings from config to the actual AI Strategy classes
const aiStrategyMap = {
    'seekCenter': SeekCenterAI,
    'chasePlayer': ChasePlayerAI,
    'flopAI': FlopAI, // Ensure FlopAI is mapped
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
// Define minimal fallback stats or default to center_seeker if type is unknown
            const fallbackStats = Config.ENEMY_STATS[Config.ENEMY_TYPE_CENTER_SEEKER] || {};
            this.stats = {
                displayName: "Unknown (Fallback)",
                aiType: Config.ENEMY_TYPE_CENTER_SEEKER,
                color: 'purple',
                width: Config.DEFAULT_ENEMY_WIDTH,
                height: Config.DEFAULT_ENEMY_HEIGHT,
                maxSpeedX: 30,
                health: 1,
                contactDamage: 1, // Fallback gets 1 damage
                applyGravity: true,
                gravityFactor: 1.0,
                canJump: false,
                jumpVelocity: 0,
                canSwim: stats?.canSwim ?? false, // Read from original stats if available
                canFly: stats?.canFly ?? false,   // Read from original stats if available
                maxSpeedY: stats?.maxSpeedY ?? 50, // Read from original stats if available
                swimSpeed: stats?.swimSpeed ?? 50, // NEW: Read swimSpeed
                applyGravity: stats?.applyGravity ?? !(stats?.canFly ?? false),
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
                contactDamage: stats.contactDamage ?? 0, // Default to 0 if missing in config for non-Tetrapod
                maxSpeedY: stats.maxSpeedY ?? 50, // Ensure maxSpeedY has a default
                swimSpeed: stats.swimSpeed ?? 50, // NEW: Ensure swimSpeed has a default
                canJump: stats.canJump ?? false,
                jumpVelocity: stats.jumpVelocity ?? 0,
                canSwim: stats.canSwim ?? false,
                canFly: stats.canFly ?? false,
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
        this.maxSpeedX = this.stats.maxSpeedX; // Max speed for horizontal movement (often on land)
        this.maxSpeedY = this.stats.maxSpeedY; // Max speed for vertical movement (often in air/water)
        this.swimSpeed = this.stats.swimSpeed; // NEW: Max speed specific to swimming (used by AI/physics)
        this.displayName = this.stats.displayName;
// --- Store Movement Capabilities ---
        this.canSwim = this.stats.canSwim;
        this.canFly = this.stats.canFly;
        this.applyGravityDefault = this.stats.applyGravity; // Store the default gravity setting
        this.canJump = this.stats.canJump; // Store canJump capability
// --- Physics State ---
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.isActive = true; // This flag means the enemy exists and participates in game logic/collisions (until death anim ends)
        this.isInWater = false;
        this.waterJumpCooldown = 0; // Keep for non-swimming jumpers
        // NEW: AI-controlled state flag(s) - specific AIs can set these
        this.isFlopAttacking = false; // Specifically for Tetrapod's land hop attack

// --- Visual Feedback State ---
        this.isFlashing = false;
        this.flashTimer = 0;
        this.flashDuration = Config.ENEMY_FLASH_DURATION;

        // --- Animation State ---
        this.isDying = false; // New flag: Is the death animation playing?
        this.deathAnimationTimer = 0; // Timer for the death animation duration


// --- Instantiate AI Strategy ---
        const AIStrategyClass = aiStrategyMap[this.stats.aiType];
        if (AIStrategyClass) {
// Pass 'this' (the enemy instance) to the AI strategy constructor so the strategy can access the enemy's state and properties.
            this.aiStrategy = new AIStrategyClass(this);
        } else {
// Assign a dummy strategy to prevent errors during update
            console.error(`>>> Enemy CONSTRUCTOR: AI strategy type "${this.stats.aiType}" not found for enemy "${this.displayName}".`);
            this.aiStrategy = {
                decideMovement: () => ({ targetVx: 0, jump: false, targetVy: 0 }), // Add targetVy default
                reactToCollision: () => {},
                 // Add dummy methods for any flags AI controls, or ensure AI doesn't try to set them
                 // For now, isFlopAttacking is a public property AI can set.
            };
        }
// --- Initial Position Validation ---
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Enemy CONSTRUCTOR ERROR: NaN coordinates! Type: ${this.type}. Resetting.`);
            this.x = Config.CANVAS_WIDTH / 2;
            this.y = 50;
        }
    }
// --- Updates the enemy's state, delegating behavioral decisions to its AI strategy ---
    update(dt, playerPosition, allEnemies) {
        // Check if the enemy is truly inactive or is currently dying
        if (!this.isActive && !this.isDying) return;

// Ensure dt is valid
         if (typeof dt !== 'number' || isNaN(dt) || dt < 0) {
             console.warn(`Enemy(${this.displayName}) Update: Invalid delta time.`, dt);
             // If dt is invalid during dying, just let the timer slowly decrement or eventually expire.
             // Or, if timer is already <= 0, ensure it's removed.
             if (this.isDying && this.deathAnimationTimer <= 0) {
                 this.isActive = false; // Mark as fully inactive if animation finished but dt was bad
                 this.isDying = false;
             }
             if (!this.isActive && !this.isDying) return; // Exit if now truly inactive
         }


        // --- Handle Dying State ---
        if (this.isDying) {
            this.deathAnimationTimer -= dt; // Decrement death timer
            if (this.deathAnimationTimer <= 0) {
                // Animation is finished, mark as inactive for removal
                this.isActive = false;
                this.isDying = false; // Clear dying flag
                // console.log(`[Enemy] Death animation finished for ${this.displayName}. Marking inactive.`);
            }
            // Stop any other updates while dying
            return; // Stop normal update logic while dying
        }


        // --- Normal Active Update Logic (Only if NOT dying) ---

        // Ensure isFlopAttacking is reset if we are NOT dying but it was somehow stuck true (safety)
        if (this.isFlopAttacking) {
             // Logic to turn off isFlopAttacking is now in FlopAI, tied to flopAttackTimer
             // The Enemy.js update handles the timer check and setting the flag.
             // Let's move the flopAttackTimer handling from FlopAI back to Enemy.update
             // if the Enemy class is meant to manage this state flag internally.
             // Or, ensure the AI explicitly turns it off. FlopAI now manages the flag via `this.enemy.isFlopAttacking`.
             // The timer logic for this flag needs to be in the FlopAI's update method.
             // Let's assume FlopAI correctly sets/unsets `this.enemy.isFlopAttacking`.
        }


        // --- Determine Current Environment State ---
        this.isInWater = GridCollision.isEntityInWater(this);
// Note: isOnGround is updated by collideAndResolve later, but we might need its state *from the previous frame* here.
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
            this.vy = Math.max(-this.maxSpeedY, Math.min(this.maxSpeedY, this.vy)); // Clamp vertical speed (Use maxSpeedY stat)
// Horizontal movement
            this.vx = targetVx; // Directly set based on AI
// Apply some air friction/damping? (Optional)
// this.vx *= Math.pow(AIR_DAMPING, dt);
        } else if (this.canSwim && this.isInWater) { // SWIMMING MODE
            useStandardGravity = false; // Override gravity/buoyancy for smooth swimmers
// Apply AI's vertical target directly
            this.vy = targetVy;
            this.vy = Math.max(-this.swimSpeed, Math.min(this.swimSpeed, this.vy)); // Clamp vertical speed using swimSpeed
// Apply AI's horizontal target
            this.vx = targetVx;
// Apply standard water damping to horizontal movement
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
            } else if (this.isOnGround && this.vy > E_EPSILON) { // Use epsilon for float comparison
                this.vy = 0; // Clamp on ground
            }
// Apply Standard Vertical Damping (only for non-swimmers in water)
            if (applyWaterEffects) { // Implicitly !this.canSwim here
                 this.vy *= Math.pow(Config.WATER_VERTICAL_DAMPING, dt);
            }
// Handle Jumps (Ground or Water Strokes for non-swimmers)
            if (wantsJump && this.canJump) { // Check entity's canJump stat
                if (applyWaterEffects) { // Water Stroke (for non-swimmer)
                    if (this.waterJumpCooldown <= 0) {
                        this.vy = -(this.stats.jumpVelocity * 0.8); // Impulse (Use stat)
                        this.waterJumpCooldown = Config.WATER_JUMP_COOLDOWN_DURATION;
                        this.isOnGround = false;
                    }
                } else if (this.isOnGround) { // Ground Jump
                    this.vy = -this.stats.jumpVelocity; // Use stat
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
        const currentMaxSpeedX = this.isInWater && !this.canSwim ? this.maxSpeedX * Config.WATER_MAX_SPEED_FACTOR : this.maxSpeedX; // Use maxSpeedX stat
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
        let neighborsCount = 0;
        const separationRadius = this.width * this.stats.separationFactor; // Use stat
        const separationRadiusSq = separationRadius * separationRadius;
        if (allEnemies) { // Check if the list was provided
            for (const otherEnemy of allEnemies) {
                // Separation should only happen with *active* enemies that are *not* dying
                if (otherEnemy === this || !otherEnemy.isActive || otherEnemy.isDying) continue;
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
                         neighborsCount++;
                    }
                }
            }
        }
// Calculate the actual boost vectors AFTER iterating through all enemies
        const separationBoostX = (neighborsCount > 0) ? separationForceX * this.stats.separationStrength : 0; // Use stat
        const separationBoostY = (neighborsCount > 0) ? separationForceY * this.stats.separationStrength : 0; // Use stat
// Apply separation velocity adjustment
        if (neighborsCount > 0) {
// Be careful applying separation in fly/swim modes - might need adjustment
            if (!this.canFly && !(this.canSwim && this.isInWater)) { // Only apply full separation on ground/air (non-swim)
                this.vx += separationBoostX;
                // Apply vertical boost only if on ground, or if the boost is significant, or in water
                if (this.isOnGround || Math.abs(separationBoostY) > 10 || this.isInWater) {
                    this.vy += separationBoostY;
                }
            } else if (this.canSwim && this.isInWater) { // Swimming: Apply separation differently?
                // Maybe only apply horizontal separation boost?
                 this.vx += separationBoostX * 0.5; // Reduced horizontal effect in water?
                 // vertical separation might make sense if swimming side-by-side
                 this.vy += separationBoostY * 0.5; // Reduced vertical effect in water?
            } else if (this.canFly) { // Flying: Apply separation differently?
                 this.vx += separationBoostX * 0.5; // Reduced horizontal effect?
                 this.vy += separationBoostY * 0.5; // Apply vertical separation boost
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
            // Falling out of world now triggers the die function to start animation
            this.die(false); // Fell out
        }
    }

    takeDamage(amount) {
        // Do not take damage if already inactive OR currently in the dying animation state
        if (!this.isActive || this.isDying || this.isFlashing) return;

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
        this.deathAnimationTimer = Config.ENEMY_DEATH_ANIMATION_DURATION;

        // Keep isActive = true *during* the animation so it's updated and drawn.
        // It will be set to false in update() when the timer expires.

        // Handle item drops immediately when the enemy *starts* dying
        if (killedByPlayer && this.stats.dropTable && this.stats.dropTable.length > 0) {
            if (typeof this.x !== 'number' || typeof this.y !== 'number' || isNaN(this.x) || isNaN(this.y)) {
                console.error(`>>> ${this.displayName} died with invalid coordinates [${this.x}, ${this.y}], skipping drop spawn.`);
            } else {
                this.stats.dropTable.forEach(dropInfo => {
                    if (Math.random() < (dropInfo.chance ?? 0)) {
                        const min = dropInfo.minAmount ?? 1;
                        const max = dropInfo.maxAmount ?? 1;
                        const amount = Math.floor(Math.random() * (max - min + 1)) + min;
                        for (let i = 0; i < amount; i++) {
                            // Use the center of the block for drop spawn location
                            let dropXBase = this.x + this.width / 2;
                            let dropYBase = this.y + this.height / 2;
                            // Add some random scatter
                            let dropX = dropXBase + (Math.random() - 0.5) * this.width; // Scatter within enemy width
                            let dropY = dropYBase + (Math.random() - 0.5) * this.height; // Scatter within enemy height

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

        // Ensure coordinates are valid before drawing
        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Enemy DRAW ERROR (${this.displayName}): Preventing draw due to NaN coordinates!`);
             return;
        }

        // --- Handle Dying Animation Drawing ---
        if (this.isDying) {
            ctx.save(); // Save context before transformations

            const timeElapsed = Config.ENEMY_DEATH_ANIMATION_DURATION - this.deathAnimationTimer;
            let currentScale = 1.0; // Default scale

            // Swell phase: Scale up during the first Config.ENEMY_SWELL_DURATION
            if (timeElapsed < Config.ENEMY_SWELL_DURATION) { // Using '<' instead of '<=' to make peak exclusive
                const swellProgress = timeElapsed / Config.ENEMY_SWELL_DURATION; // 0 to <1
                currentScale = 1.0 + (Config.ENEMY_SWELL_SCALE - 1.0) * swellProgress; // Lerp scale
            } else {
                 // After swell duration, it pops and is gone.
                 // The update loop should set isActive=false, preventing draw().
                 // If we reach here with isDying=true but timeElapsed >= SWELL_DURATION, it's a fallback.
                 // We should just not draw anything further.
                 ctx.restore(); // Restore context if saved
                 return; // Do not draw after swell phase
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

         // Optional: Add a visual indicator for isFlopAttacking state for debugging
         // if (this.isFlopAttacking) {
         //      ctx.strokeStyle = 'red';
         //      ctx.lineWidth = 1;
         //      ctx.strokeRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
         // }

    }

    // NEW: Method to determine current contact damage based on state
    getCurrentContactDamage() {
        // If dying, enemy deals no damage
        if (this.isDying) return 0;

        // Default to 0 if this method is called on a type that doesn't have contact damage logic defined here
        let damage = 0;

        // --- Specific Logic for Tetrapod ---
        if (this.type === Config.ENEMY_TYPE_TETRAPOD) {
             if (this.isInWater) {
                 // Damage when in water
                 damage = Config.TETRAPOD_WATER_CONTACT_DAMAGE;
             } else if (this.isOnGround) {
                 // Damage when on land (only during flop attack state)
                 damage = this.isFlopAttacking ? Config.TETRAPOD_LAND_FLOP_DAMAGE : Config.TETRAPOD_LAND_STILL_DAMAGE;
             } else {
                 // Damage when airborne over land (e.g., falling between hops)
                 // Maybe still 0 damage if not actively flopping? Let's say 0 unless isFlopAttacking
                 damage = this.isFlopAttacking ? Config.TETRAPOD_LAND_FLOP_DAMAGE : Config.TETRAPOD_LAND_STILL_DAMAGE; // Same as land logic
             }
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
            // For any enemy type not handled above, fall back to their base contactDamage stat
            damage = this.stats?.contactDamage ?? 0;
        }

        return damage;
    }
}
