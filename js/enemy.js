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
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = Config.ENEMY_WIDTH;
        this.height = Config.ENEMY_HEIGHT;
        this.color = Config.ENEMY_COLOR;

        this.vx = 0;
        this.vy = 0;
        this.speed = Config.ENEMY_SPEED;
        this.gravity = Config.ENEMY_GRAVITY;
        this.health = Config.ENEMY_HEALTH;
        this.isOnGround = false; // Assume airborne initially, collision check will correct
        this.isActive = true;    // Enemies start active
        this.targetX = Config.ENEMY_TARGET_X; // Simple target for AI

        // Initial position sanity check
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Enemy CONSTRUCTED with NaN coordinates! x: ${x}, y: ${y}. Resetting to default.`);
            this.x = Config.ENEMY_TARGET_X; // Fallback position
            this.y = 50; // Arbitrary fallback Y
        }
        // console.log(`>>> Enemy CONSTRUCTED at x: ${this.x?.toFixed(1)}, y: ${this.y?.toFixed(1)}`);
    }


    update(dt) {
        if (!this.isActive) return; // Don't update inactive enemies

        // Safety Check: Prevent updates if position is invalid
        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Enemy Update ERROR: Skipping update due to NaN coordinates! x=${this.x}, y=${this.y}`);
             this.isActive = false; // Mark as inactive to prevent further issues
             return;
        }

        // --- Simple AI: Move towards target X ---
        const currentCenterX = this.x + this.width / 2;
        let direction = 0;
        // Check distance to target to avoid jittering when close
        if (Math.abs(currentCenterX - this.targetX) > this.speed) { // Use speed as threshold
            direction = Math.sign(this.targetX - currentCenterX);
        }
        this.vx = direction * this.speed;


        // --- Physics Step 1: Apply Gravity ---
        // Apply gravity if not on the ground (based on *last* frame's collision result)
        if (!this.isOnGround) {
            this.vy += this.gravity;
             // Optional: Clamp fall speed
             // if (this.vy > Config.MAX_FALL_SPEED) { this.vy = Config.MAX_FALL_SPEED; }
        } else {
             // Optional: Zero out small positive vertical velocity when grounded
             // if(this.vy > 0) {
             //    this.vy = 0;
             // }
        }


        // --- Physics Step 2: Grid Collision Detection & Resolution ---
        // This function handles all wall, floor, ceiling collisions and step-up logic.
        // It directly modifies this.x, this.y, this.vx, this.vy.
        const collisionResult = GridCollision.collideAndResolve(this);

        // Update the enemy's ground status based on the *current* frame's result.
        this.isOnGround = collisionResult.isOnGround;

        // --- Optional: AI adjustments based on collision ---
        // Example: If collided horizontally, maybe change target or behavior?
        // if (collisionResult.collidedX) {
        //     console.log("Enemy hit a wall horizontally.");
             // Reverse direction? Choose a new target? Jump?
             // this.targetX = currentCenterX - direction * 100; // Move away briefly
        // }
        // Example: If stepped up, maybe trigger a sound?
        // if (collisionResult.didStepUp) {
        //     console.log("Enemy stepped up.");
        // }


        // --- Screen Boundary Checks (simple prevention) ---
        // Prevent moving beyond canvas edges (redundant if world grid fills canvas)
         if (this.x < 0) {
              this.x = 0;
              if (this.vx < 0) this.vx = 0;
         }
         if (this.x + this.width > Config.CANVAS_WIDTH) {
              this.x = Config.CANVAS_WIDTH - this.width;
              if (this.vx > 0) this.vx = 0;
         }


        // --- Deactivation if falling out of world ---
        if (this.y > Config.CANVAS_HEIGHT + 200) { // Check well below canvas bottom
            console.warn("Enemy fell out of world, marking inactive.");
            this.isActive = false; // Mark for removal by enemyManager
        }

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
        // Check drop chance
        if (Math.random() < Config.ENEMY_DROP_CHANCE) {
            // Spawn configured number of items
            for (let i = 0; i < Config.ENEMY_DROP_AMOUNT; i++) {
                 // Ensure coordinates are valid before spawning
                 if (typeof this.x === 'number' && typeof this.y === 'number') {
                     // Calculate spawn position: center X, slightly above enemy's original position
                     let dropX = this.x + (this.width / 2);
                     let dropY = this.y - Config.BLOCK_HEIGHT; // Start one block height above enemy 'y'

                     // Add slight randomness to prevent perfect stacking
                     dropX += (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.5;
                     dropY += (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.25;

                     // Call ItemManager to spawn the item
                     ItemManager.spawnItem(dropX, dropY, Config.ENEMY_DROP_TYPE);
                 } else {
                      console.warn("Enemy died with invalid coordinates, skipping drop spawn.");
                 }
            }
            // console.log(`Enemy dropped ${Config.ENEMY_DROP_AMOUNT} ${Config.ENEMY_DROP_TYPE}`);
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