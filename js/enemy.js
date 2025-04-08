// -----------------------------------------------------------------------------
// root/js/enemy.js - Enemy Class
// -----------------------------------------------------------------------------
// console.log("enemy loaded");

import * as Config from './config.js';
import * as ItemManager from './itemManager.js'; // Needed for drops on death
import * as World from './worldManager.js';   // Potentially needed for more complex AI later
import * as GridCollision from './utils/gridCollision.js'; // Correctly imports the collision utility

export class Enemy {
    // Accept enemyType in constructor
    constructor(x, y, enemyType = Config.ENEMY_TYPE_CENTER_SEEKER) { // Default to center seeker
        this.x = x;
        this.y = y;
        this.type = enemyType; // Store the type

        // --- Assign stats based on type ---
        const stats = Config.ENEMY_STATS[this.type];
        if (!stats) {
            console.error(`>>> Enemy CONSTRUCTOR: Unknown enemy type "${enemyType}". Using fallback stats.`);
            this.color = 'purple'; // Fallback color
            this.maxSpeedX = 30;
            this.health = 1;
        } else {
            this.color = stats.color;
            this.maxSpeedX = stats.maxSpeedX; // Use speed from config stats
            this.health = stats.health;
            // Assign other stats like contact damage if they differ by type later
        }
        // --- Assign general properties ---
        this.width = Config.ENEMY_WIDTH;
        this.height = Config.ENEMY_HEIGHT;
        this.vx = 0; // Velocity pixels/sec
        this.vy = 0; // Velocity pixels/sec
        this.isOnGround = false;
        this.isActive = true;
        // --- Visual Feedback State ---
        this.isFlashing = false;
        this.flashTimer = 0;
        this.flashDuration = 0.15; // How long to flash (in seconds)

        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Enemy CONSTRUCTOR ERROR: NaN coordinates detected! x: ${this.x}, y: ${this.y}. Resetting to spawn location.`);
            // Attempt a reset, though the values might still be problematic if passed incorrectly
            this.x = 0; // Or a safe default like Config.CANVAS_WIDTH / 2
            this.y = 0; // Or a safe default
        }
    }

    // Update now accepts allEnemies array
    update(dt, playerPosition, allEnemies) { // Added allEnemies parameter
        if (!this.isActive) return;
        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Enemy UPDATE ERROR: Skipping update due to NaN coordinates! x: ${this.x}, y: ${this.y}`);
             return; // Skip update if position is invalid
        }

        // --- Update Flash Timer ---
        if (this.isFlashing) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                this.isFlashing = false;
            }
        }

        // --- Determine Target X based on AI Type ---
        let dynamicTargetX;
        if (this.type === Config.ENEMY_TYPE_PLAYER_CHASER && playerPosition) {
            dynamicTargetX = playerPosition.x + (Config.PLAYER_WIDTH / 2);
        } else {
            dynamicTargetX = Config.CANVAS_WIDTH / 2;
        }

        // --- Simple AI: Calculate Base Velocity ---
        const currentCenterX = this.x + this.width / 2;
        let targetDirection = 0;
        // Check distance to target - use the enemy's specific maxSpeedX
        if (Math.abs(currentCenterX - dynamicTargetX) > this.maxSpeedX * dt * 1.5) { // Adjust threshold slightly
            targetDirection = Math.sign(dynamicTargetX - currentCenterX);
        }
        // Set base velocity from AI *before* separation adjustment
        let baseVx = targetDirection * this.maxSpeedX; // Use maxSpeedX from constructor
        let baseVy = this.vy; // Keep current vertical velocity as base


        // --- NEW: Separation Calculation ---
        let separationForceX = 0;
        let separationForceY = 0; // Using Y might make them jumpy, consider adjusting strength or omitting
        let neighborsCount = 0;
        const separationRadius = this.width * Config.ENEMY_SEPARATION_RADIUS_FACTOR; // Use factor from config
        const separationRadiusSq = separationRadius * separationRadius; // Use squared distance for efficiency

        if (allEnemies) { // Ensure the list was passed
            for (const otherEnemy of allEnemies) {
                if (otherEnemy === this || !otherEnemy.isActive) {
                    continue; // Skip self and inactive enemies
                }

                // Calculate vector *from* other enemy *to* this enemy
                const dx = this.x - otherEnemy.x;
                const dy = this.y - otherEnemy.y;
                const distSq = dx * dx + dy * dy;

                // Check if within separation radius (and not exactly overlapping - distSq > 0)
                if (distSq > 0 && distSq < separationRadiusSq) {
                    const dist = Math.sqrt(distSq);
                    // Calculate repulsion force: stronger when closer
                    // Inverse square or linear falloff are common choices. Linear is simpler:
                    const repelStrength = (1.0 - (dist / separationRadius)); // 1=touching, 0=at edge
                    separationForceX += (dx / dist) * repelStrength;
                    separationForceY += (dy / dist) * repelStrength; // Include vertical separation force
                    neighborsCount++;
                }
            }
        }

        // --- Apply Separation Velocity Adjustment ---
        if (neighborsCount > 0) {
            // Average the force (optional, can smooth behavior)
            // separationForceX /= neighborsCount;
            // separationForceY /= neighborsCount;

            // Convert force to a velocity adjustment, scaled by strength and dt
            // Note: Applying directly to velocity can feel more immediate than acceleration
            const separationBoostX = separationForceX * Config.ENEMY_SEPARATION_STRENGTH; // dt is applied later
            const separationBoostY = separationForceY * Config.ENEMY_SEPARATION_STRENGTH; // dt is applied later

            // Add separation boost to base velocity
            // Limit the total speed? Or just let separation potentially exceed maxSpeedX briefly? Let's add for now.
            this.vx = baseVx + separationBoostX;

            // Decide how to handle vertical separation.
            // Option 1: Add directly (might cause jumps/floating)
            // this.vy = baseVy + separationBoostY;
            // Option 2: Only apply if on ground (prevents flying up)
            if (this.isOnGround) {
                 // Apply a small upward boost if needed, but prioritize horizontal separation
                 // Maybe only apply if separationForceY is significantly positive?
                 if (separationForceY > 0.1) { // If being pushed upwards
                    this.vy = baseVy + separationBoostY; // Add vertical boost
                 } else {
                    this.vx = baseVx + separationBoostX; // Prioritize horizontal push if not pushed up
                 }
            } else {
                 // If airborne, primarily focus on horizontal separation
                 this.vx = baseVx + separationBoostX;
            }
             // Option 3: Ignore vertical separation completely (simplest)
             // this.vx = baseVx + separationBoostX;
             // this.vy = baseVy; // Keep original vertical

        } else {
            // No neighbors close, use the base AI velocity
            this.vx = baseVx;
            this.vy = baseVy;
        }

        // --- Physics Step 1: Apply Gravity (AFTER velocity calculation) ---
        if (!this.isOnGround) {
            this.vy += Config.GRAVITY_ACCELERATION * dt;
            this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED); // Clamp fall speed
        } else {
            // If on ground and moving down, stop vertical velocity (unless pushed by separation)
            if(this.vy > 0 && separationForceY <= 0.1) { // Don't zero out if separation is pushing up
                 this.vy = 0;
             }
        }

        // --- Calculate Potential Movement (using potentially modified vx/vy) ---
        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;

        // --- Physics Step 2: Grid Collision ---
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround; // Update ground status based on collision result

        // --- Basic AI Reaction to Collision ---
        if (collisionResult.collidedX) {
            // If hit a wall horizontally, zero out horizontal velocity AFTER collision resolution.
            // The separation logic might try to push it again next frame if still crowded.
            this.vx = 0;
            // Consider adding jump logic for chasers hitting walls later.
        }
        if (collisionResult.collidedY && this.vy > 0){
            // If landed on ground, ensure vertical velocity is zeroed unless separation is active upward
            if (separationForceY <= 0.1) {
                 this.vy = 0;
            }
        }


        // --- Screen Boundary Checks (apply after collision) ---
         if (this.x < 0) { this.x = 0; if (this.vx < 0) this.vx = 0; }
         if (this.x + this.width > Config.CANVAS_WIDTH) { this.x = Config.CANVAS_WIDTH - this.width; if (this.vx > 0) this.vx = 0; }

        // --- Deactivation if falling out of world ---
        if (this.y > Config.CANVAS_HEIGHT + 200) {
            console.warn(`Enemy (${this.type}) fell out of bounds at y=${this.y.toFixed(1)}. Deactivating.`);
            this.die(); // Use die() to handle cleanup and potential drops correctly
        }

    } // End of update method

    takeDamage(amount) {
        if (!this.isActive || this.isFlashing) return; // Don't take damage if already flashing from a hit

        const healthBefore = this.health;
        this.health -= amount;
        console.log(`>>> DAMAGE APPLIED to Enemy Type: ${this.type}. Amount: ${amount}. Health: ${healthBefore} -> ${this.health}`); // Keep log for now

        // --- Trigger Flash ---
        this.isFlashing = true;
        this.flashTimer = this.flashDuration;
        // ---

        if (this.health <= 0) {
             console.log(`>>> Enemy Type: ${this.type} DIED.`);
             this.die();
        }
    } // End takeDamage


    die() {
        if (!this.isActive) return; // Prevent multiple death triggers

        // console.log("Enemy died at:", this.x?.toFixed(1), this.y?.toFixed(1));
        this.isActive = false; // Mark as inactive for removal and stop updates/drawing
        this.vx = 0; // Stop movement
        this.vy = 0;

        // --- Trigger Item Drops ---
        if (Math.random() < Config.ENEMY_DROP_CHANCE) {
            for (let i = 0; i < Config.ENEMY_DROP_AMOUNT; i++) {
                 if (typeof this.x === 'number' && typeof this.y === 'number' && !isNaN(this.x) && !isNaN(this.y)) {
                     let dropX = this.x + (this.width / 2) + (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.5;
                     let dropY = this.y - Config.BLOCK_HEIGHT + (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.25;
                     // Ensure drop coordinates are valid before spawning
                     dropX = Math.max(0, Math.min(Config.CANVAS_WIDTH - Config.WOOD_ITEM_WIDTH, dropX));
                     dropY = Math.max(0, dropY); // Prevent negative Y?
                     ItemManager.spawnItem(dropX, dropY, Config.ENEMY_DROP_TYPE);
                 } else {
                      console.warn("Enemy died with invalid coordinates, skipping drop spawn.");
                 }
            }
        }
    }

    // --- Simple Getters ---
    getPosition() {
         // Returns the enemy's top-left position.
         return { x: this.x, y: this.y };
    }

    getRect() {
         // Returns the enemy's bounding box.
         // Includes safety check for NaN coordinates, returning a default rect if invalid.
         const safeX = (typeof this.x === 'number' && !isNaN(this.x)) ? this.x : 0;
         const safeY = (typeof this.y === 'number' && !isNaN(this.y)) ? this.y : 0;
         return { x: safeX, y: safeY, width: this.width, height: this.height };
    }

    draw(ctx) {
        if (!this.isActive || !ctx) return; // Don't draw if inactive or no context

        // Safety Check: Prevent drawing if position is invalid
        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Enemy DRAW ERROR: Preventing draw due to NaN coordinates! x: ${this.x}, y: ${this.y}`);
             return;
        }
        
        let drawColor = this.color; // Get base color

        // --- Apply Flash Effect ---
        if (this.isFlashing) {
            // Simple flash: draw white instead of normal color
            drawColor = 'white';
        }
        // Simple rectangle drawing
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // --- DEBUGGING: Draw Separation Radius ---
        /*
        const debugSeparation = false; // Set to true to see radius
        if (debugSeparation) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            const radius = this.width * Config.ENEMY_SEPARATION_RADIUS_FACTOR;
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)'; // Yellow, semi-transparent
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        */
        // Optional: Add health bar or other visual indicators
    }

} // End of Enemy Class