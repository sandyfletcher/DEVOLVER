// -----------------------------------------------------------------------------
// root/js/enemy.js - Enemy Class (Refactored for Config & AI Strategy)
// -----------------------------------------------------------------------------
// console.log("enemy loaded");

import * as Config from './config.js';
import * as ItemManager from './itemManager.js'; // Needed for drops on death
import * as World from './worldManager.js';   // Potentially needed by AI strategies later
import * as GridCollision from './utils/gridCollision.js'; // For physics
import { SeekCenterAI } from './ai/seekCenterAI.js';
import { ChasePlayerAI } from './ai/chasePlayerAI.js';

// Map AI type strings from config to the actual AI Strategy classes
const aiStrategyMap = {
    'seekCenter': SeekCenterAI,
    'chasePlayer': ChasePlayerAI,
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
            this.stats = { // Create a local stats object with defaults
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
                ...fallbackStats // Overwrite defaults with seeker stats if available
            };
        } else {
            // Use stats directly from config, providing defaults from Config where applicable
            this.stats = {
                ...stats, // Spread all stats from config
                // Ensure essential properties have defaults if missing in config (optional, good practice)
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
        this.maxSpeedX = this.stats.maxSpeedX; // Keep for potential direct use or AI reference
        this.displayName = this.stats.displayName; // For debugging/UI

        // --- Physics State ---
        this.vx = 0; // Velocity pixels/sec
        this.vy = 0; // Velocity pixels/sec
        this.isOnGround = false;
        this.isActive = true;

        // --- Visual Feedback State ---
        this.isFlashing = false;
        this.flashTimer = 0;
        // Use flash duration from general config
        this.flashDuration = Config.ENEMY_FLASH_DURATION;

        // --- Instantiate AI Strategy ---
        const AIStrategyClass = aiStrategyMap[this.stats.aiType];
        if (AIStrategyClass) {
            // Pass 'this' (the enemy instance) to the AI strategy constructor
            // so the strategy can access the enemy's state and properties.
            this.aiStrategy = new AIStrategyClass(this);
        } else {
            console.error(`>>> Enemy CONSTRUCTOR: AI strategy type "${this.stats.aiType}" not found in aiStrategyMap for enemy "${this.displayName}". AI will not function.`);
            // Assign a dummy strategy to prevent errors during update
            this.aiStrategy = {
                decideMovement: () => ({ vx: 0, vy: 0, jump: false }), // No movement
                reactToCollision: () => {} // Do nothing
            };
        }

        // --- Initial Position Validation ---
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Enemy CONSTRUCTOR ERROR: NaN coordinates detected! Type: ${this.type}, x: ${this.x}, y: ${this.y}. Resetting to safe location.`);
            this.x = Config.CANVAS_WIDTH / 2; // Reset to center-ish
            this.y = 50;
        }
        // console.log(`Created enemy: ${this.displayName} (${this.type}) at ${this.x.toFixed(1)}, ${this.y.toFixed(1)} with AI: ${this.stats.aiType}`);
    }

    /**
     * Updates the enemy's state, delegating behavioral decisions to its AI strategy.
     * @param {number} dt - Delta time.
     * @param {object | null} playerPosition - Current player {x, y} or null.
     * @param {Array<Enemy>} allEnemies - List of all active enemies for separation checks.
     */
    update(dt, playerPosition, allEnemies) {
        if (!this.isActive) return;
        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Enemy UPDATE ERROR (${this.displayName}): Skipping update due to NaN coordinates! x: ${this.x}, y: ${this.y}`);
             return; // Skip update if position is invalid
        }

        // --- Update Flash Timer ---
        if (this.isFlashing) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                this.isFlashing = false;
            }
        }

        // --- 1. Get Movement Intent from AI Strategy ---
        // The AI strategy decides the *intended* base velocity or action (like jump)
        const aiDecision = this.aiStrategy.decideMovement(playerPosition, allEnemies, dt);
        // Expecting aiDecision structure like: { targetVx: number, jump: boolean }
        // More complex AI might return target positions, attack commands, etc.

        let baseVx = 0;
        // Apply acceleration towards AI's target velocity (similar to player) - optional refinement
        // For simplicity now, just set vx towards target directly up to max speed
        if (aiDecision && typeof aiDecision.targetVx === 'number') {
             // Simple approach: move at max speed towards target direction
             // baseVx = Math.sign(aiDecision.targetVx) * this.maxSpeedX;
             // Smoother approach: Accelerate towards target (like player)
             // This requires storing current vx and accelerating towards aiDecision.targetVx
             // Let's use the simpler approach for now, assuming AI provides the final intended speed for this frame
             baseVx = Math.max(-this.maxSpeedX, Math.min(this.maxSpeedX, aiDecision.targetVx));
        }
         // AI can request a jump (only if capable and on ground)
         if (aiDecision && aiDecision.jump && this.stats.canJump && this.isOnGround) {
             this.vy = -this.stats.jumpVelocity;
             this.isOnGround = false;
             // console.log(`${this.displayName} jumped!`);
         }

        // Initialize velocity for this frame based on AI intent
        this.vx = baseVx;
        // Keep vertical velocity unless changed by jump (gravity/collision handled below)


        // --- 2. Separation Behavior ---
        // Calculate adjustments based on nearby enemies
        let separationForceX = 0;
        let separationForceY = 0; // Using Y can be tricky, tune carefully
        let neighborsCount = 0;
        // Use configured separation factor and strength for this enemy type
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
                    const repelStrength = (1.0 - (dist / separationRadius)); // Linear falloff
                    separationForceX += (dx / dist) * repelStrength;
                    // Optional: Reduced vertical push or only push away horizontally
                    separationForceY += (dy / dist) * repelStrength * 0.5; // Example: Weaker vertical push
                    neighborsCount++;
                }
            }
        }

        // Apply separation velocity adjustment
        if (neighborsCount > 0) {
            const separationBoostX = separationForceX * this.stats.separationStrength;
            const separationBoostY = separationForceY * this.stats.separationStrength; // Apply vertical boost carefully

            // Add separation boost to AI-intended velocity
            this.vx += separationBoostX;

            // Limit final speed? Optional, can allow brief bursts over maxSpeedX
            // this.vx = Math.max(-this.maxSpeedX * 1.5, Math.min(this.maxSpeedX * 1.5, this.vx));

            // Apply vertical boost cautiously
            // Only apply if on ground OR if the push is significant?
             if (this.isOnGround || Math.abs(separationBoostY) > 10) { // Threshold example
                 this.vy += separationBoostY;
             }
        }

        // --- 3. Physics: Apply Gravity ---
        // Use configured gravity settings for this enemy type
        if (this.stats.applyGravity && !this.isOnGround) {
            this.vy += Config.GRAVITY_ACCELERATION * (this.stats.gravityFactor || 1.0) * dt;
            this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED); // Clamp fall speed
        } else if (this.isOnGround && this.vy > 0) {
            // If landed or on ground and moving down, stop vertical velocity (unless pushed up by separation?)
             // Add check here if separationForceY logic is complex
             this.vy = 0;
        }

        // --- 4. Physics: Grid Collision ---
        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);

        // Update ground status AFTER collision resolution for the next frame
        this.isOnGround = collisionResult.isOnGround;

        // Zero out velocity *if* collision occurred in that axis
        if (collisionResult.collidedX) {
             this.vx = 0;
        }
         // Ensure vy is zeroed if landed, unless actively jumping/pushed
        if (collisionResult.collidedY && this.vy > 0) {
             this.vy = 0;
        } else if (collisionResult.collidedY && this.vy < 0) {
             // Bumped head, stop upward movement
             this.vy = 0;
        }


        // --- 5. AI Reaction to Collision ---
        // Let the AI strategy react to the outcome of the physics step
        this.aiStrategy.reactToCollision(collisionResult); // Pass collision results

        // --- 6. Final Checks ---
        // Screen Boundary Checks
         if (this.x < 0) { this.x = 0; if (this.vx < 0) this.vx = 0; }
         if (this.x + this.width > Config.CANVAS_WIDTH) { this.x = Config.CANVAS_WIDTH - this.width; if (this.vx > 0) this.vx = 0; }

        // Deactivation if falling out of world
        if (this.y > Config.CANVAS_HEIGHT + 200) {
            console.warn(`Enemy (${this.displayName}) fell out of bounds at y=${this.y.toFixed(1)}. Deactivating.`);
            this.die(false); // Pass false to indicate not killed by player (might affect drops later)
        }

    } // End of update method

    /**
     * Applies damage to the enemy and handles death.
     * @param {number} amount - The amount of damage to take.
     */
    takeDamage(amount) {
        if (!this.isActive || this.isFlashing) return; // Don't take damage if dead or already flashing

        const healthBefore = this.health;
        this.health -= amount;
        // console.log(`>>> DAMAGE APPLIED to ${this.displayName}. Amount: ${amount}. Health: ${healthBefore} -> ${this.health}`);

        // Trigger Flash
        this.isFlashing = true;
        this.flashTimer = this.flashDuration; // Use configured duration

        if (this.health <= 0) {
             // console.log(`>>> ${this.displayName} DIED.`);
             this.die(true); // Pass true to indicate killed by player/damage
        }
    } // End takeDamage

    /**
     * Handles enemy death, deactivation, and item drops based on dropTable.
     * @param {boolean} killedByPlayer - Indicates if death was from damage (true) or other causes (e.g., falling out). Might affect drop logic later.
     */
    die(killedByPlayer = true) {
        if (!this.isActive) return; // Prevent multiple death triggers

        // console.log(`${this.displayName} died at:`, this.x?.toFixed(1), this.y?.toFixed(1));
        this.isActive = false; // Mark as inactive
        this.vx = 0; // Stop movement
        this.vy = 0;

        // --- Trigger Item Drops based on dropTable ---
        if (killedByPlayer && this.stats.dropTable && this.stats.dropTable.length > 0) {
            if (typeof this.x !== 'number' || typeof this.y !== 'number' || isNaN(this.x) || isNaN(this.y)) {
                 console.warn(`${this.displayName} died with invalid coordinates, skipping drop spawn.`);
                 return;
            }

            this.stats.dropTable.forEach(dropInfo => {
                if (Math.random() < (dropInfo.chance ?? 0)) { // Check drop chance (default 0 if undefined)
                    // Calculate amount to drop within min/max range
                    const min = dropInfo.minAmount ?? 1;
                    const max = dropInfo.maxAmount ?? 1;
                    const amount = Math.floor(Math.random() * (max - min + 1)) + min;

                    // console.log(`Dropping ${amount} of ${dropInfo.type} from ${this.displayName}`);

                    for (let i = 0; i < amount; i++) {
                        // Slightly randomized spawn position around enemy center/top
                        let dropX = this.x + (this.width / 2) + (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.5;
                        let dropY = this.y + (this.height * 0.25) + (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.25; // Drop near vertical center/slightly above

                        // Clamp drop position within canvas bounds (ItemManager might do this too, but good safety)
                        // Need item dimensions - assume generic small size for clamping if specific item config isn't easily available here
                        const approxItemWidth = Config.WOOD_ITEM_WIDTH; // Use a common item size
                        dropX = Math.max(0, Math.min(Config.CANVAS_WIDTH - approxItemWidth, dropX));
                        dropY = Math.max(0, dropY);

                        ItemManager.spawnItem(dropX, dropY, dropInfo.type);
                    }
                }
            });
        }
    } // End die

    // --- Simple Getters ---
    getPosition() {
         return { x: this.x, y: this.y };
    }

    getRect() {
         // Use configured width/height
         const safeX = (typeof this.x === 'number' && !isNaN(this.x)) ? this.x : 0;
         const safeY = (typeof this.y === 'number' && !isNaN(this.y)) ? this.y : 0;
         return { x: safeX, y: safeY, width: this.width, height: this.height };
    }

    // --- Drawing ---
    draw(ctx) {
        if (!this.isActive || !ctx) return; // Don't draw if inactive or no context

        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Enemy DRAW ERROR (${this.displayName}): Preventing draw due to NaN coordinates! x: ${this.x}, y: ${this.y}`);
             return;
        }

        let drawColor = this.color; // Base color from config

        // Apply Flash Effect
        if (this.isFlashing) {
            // Simple flash: Use white or toggle visibility
            // Let's use white for consistency
             drawColor = 'white';
             // // Alternative: Blinking based on timer (more complex)
             // const flashCycle = Math.floor(this.flashTimer / 0.05); // Change color every 50ms
             // if (flashCycle % 2 === 0) {
             //     drawColor = 'white';
             // }
        }

        // Simple rectangle drawing using configured size and color
        ctx.fillStyle = drawColor;
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);

        // --- DEBUGGING: Draw Separation Radius ---
        /*
        const debugSeparation = false; // Set to true to see radius
        if (debugSeparation) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            const radius = this.width * this.stats.separationFactor; // Use configured factor
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)'; // Yellow, semi-transparent
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'yellow';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.displayName.substring(0,3), centerX, centerY - this.height * 0.6);
        }
        */
        // Optional: Draw health bar, status effects, etc.
    }

} // End of Enemy Class