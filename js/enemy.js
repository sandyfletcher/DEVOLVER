// js/enemy.js
// -----------------------------------------------------------------------------
// enemy.js - Enemy Class
// -----------------------------------------------------------------------------
console.log("enemy.js loaded");

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
        // targetX removed, calculated dynamically in update

        if (isNaN(this.x) || isNaN(this.y)) { /* ... NaN check ... */ }
    }

    // Update now accepts playerPosition (can be null if player doesn't exist)
    update(dt, playerPosition) {
        if (!this.isActive) return;
        if (isNaN(this.x) || isNaN(this.y)) { /* ... NaN check ... */ }

        // --- Determine Target X based on AI Type ---
        let dynamicTargetX;
        if (this.type === Config.ENEMY_TYPE_PLAYER_CHASER && playerPosition) {
            // Target the horizontal center of the player
            dynamicTargetX = playerPosition.x + (Config.PLAYER_WIDTH / 2);
        } else {
            // Default or Center Seeker targets the middle of the canvas
            dynamicTargetX = Config.CANVAS_WIDTH / 2;
        }

        // --- Simple AI: Move towards Dynamic Target X ---
        const currentCenterX = this.x + this.width / 2;
        let targetDirection = 0;
        // Check distance to target - use the enemy's specific maxSpeedX
        if (Math.abs(currentCenterX - dynamicTargetX) > this.maxSpeedX * dt * 1.5) { // Adjust threshold slightly
            targetDirection = Math.sign(dynamicTargetX - currentCenterX);
        }
        // Set velocity based on direction and type-specific max speed
        this.vx = targetDirection * this.maxSpeedX; // Use maxSpeedX from constructor


        // --- Physics Step 1: Apply Gravity ---
        if (!this.isOnGround) {
            this.vy += Config.GRAVITY_ACCELERATION * dt;
            this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED);
        } else {
            if(this.vy > 0) this.vy = 0;
        }

        // --- Calculate Potential Movement ---
        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;

        // --- Physics Step 2: Grid Collision ---
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround;

        // --- Basic AI Reaction to Collision ---
        // (Can be expanded later)
        if (collisionResult.collidedX) {
            // If hit a wall, just stop horizontal velocity for this frame.
            // AI logic above will recalculate direction next frame.
            // Or, for simple reversal: this.vx *= -0.5; // Dampen and reverse slightly
            // Consider adding jump logic for chasers later.
        }

        // --- Screen Boundary Checks ---
         if (this.x < 0) { this.x = 0; if (this.vx < 0) this.vx = 0; }
         if (this.x + this.width > Config.CANVAS_WIDTH) { this.x = Config.CANVAS_WIDTH - this.width; if (this.vx > 0) this.vx = 0; }

        // --- Deactivation if falling out of world ---
        if (this.y > Config.CANVAS_HEIGHT + 200) { /* ... */ }

    } // End of update method
        
    takeDamage(amount) {
        if (!this.isActive) return; // Can't damage inactive enemies

        this.health -= amount;
        // console.log(`Enemy took ${amount} damage. Health: ${this.health}`);
        if (this.health <= 0) {
             this.die(); // Trigger death process
        }
        // Optional: Add visual feedback for taking damage (flash color, etc.)
    }

    die() {
        if (!this.isActive) return; // Prevent multiple death triggers

        // console.log("Enemy died at:", this.x?.toFixed(1), this.y?.toFixed(1));
        this.isActive = false; // Mark as inactive for removal and stop updates/drawing
        this.vx = 0; // Stop movement
        this.vy = 0;

        // --- Trigger Item Drops ---
        if (Math.random() < Config.ENEMY_DROP_CHANCE) {
            for (let i = 0; i < Config.ENEMY_DROP_AMOUNT; i++) {
                 if (typeof this.x === 'number' && typeof this.y === 'number') {
                     let dropX = this.x + (this.width / 2) + (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.5;
                     let dropY = this.y - Config.BLOCK_HEIGHT + (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.25;
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

        // Simple rectangle drawing
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Optional: Add health bar or other visual indicators
    }

} // End of Enemy Class