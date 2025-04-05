// js/player.js
// -----------------------------------------------------------------------------
// player.js - Player Character Class
// -----------------------------------------------------------------------------
console.log("player.js loaded");

import * as Config from './config.js';
import * as World from './worldManager.js'; // Used for potential future interactions, not directly in collision now
import * as GridCollision from './utils/gridCollision.js'; // Correctly imports the collision utility

export class Player {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;

        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;

        this.moveSpeed = Config.PLAYER_MOVE_SPEED;
        this.jumpForce = Config.PLAYER_JUMP_FORCE;
        this.gravity = Config.GRAVITY;

        this.hasSword = false;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.lastDirection = 1;
        this.hitEnemiesThisSwing = [];
        this.inventory = {};

        this.maxHealth = Config.PLAYER_MAX_HEALTH;
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;

        console.log(`Player object created at ${x?.toFixed(1)}, ${y?.toFixed(1)}`);
    }

    /**
     * Updates the player's state based on input, physics, and grid collisions.
     * @param {number} dt - Delta time (time since last frame in seconds).
     * @param {object} inputState - Object containing input flags { left, right, jump, attack }.
     */
    update(dt, inputState) {

        // --- Update Timers (Attack, Invulnerability) ---
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.isAttacking = false; this.hitEnemiesThisSwing = [];
            }
        }
        if (this.invulnerabilityTimer > 0) {
            this.invulnerabilityTimer -= dt;
            if (this.invulnerabilityTimer <= 0) { this.isInvulnerable = false; }
        }

        // --- Input Handling ---
        // Horizontal Movement
        if (inputState.left && !inputState.right) { this.vx = -this.moveSpeed; this.lastDirection = -1; }
        else if (inputState.right && !inputState.left) { this.vx = this.moveSpeed; this.lastDirection = 1; }
        else { this.vx = 0; }
        // Jumping
        // Only allow jump if currently on ground (prevents double jump unless intended)
        if (inputState.jump && this.isOnGround) {
             this.vy = -this.jumpForce;
             this.isOnGround = false; // Player is now airborne after jumping
             // Optional: Consume jump input if needed, depends on input system
             // inputState.jump = false;
        }
        // Attack Triggering
        if (inputState.attack && this.hasSword && this.attackCooldown <= 0 && !this.isAttacking) {
             this.isAttacking = true; this.attackTimer = Config.PLAYER_ATTACK_DURATION;
             this.attackCooldown = Config.PLAYER_ATTACK_COOLDOWN; this.hitEnemiesThisSwing = [];
             // Consume attack input flag after triggering
             inputState.attack = false;
        } else if (inputState.attack) {
             // Consume attack input even if it couldn't be performed (e.g., on cooldown)
             inputState.attack = false;
        }


        // --- Physics Step 1: Apply Forces (Gravity) ---
        // Apply gravity *before* collision checks if the player is not on the ground.
        // Note: `isOnGround` here is from the *previous* frame's collision result.
        if (!this.isOnGround) {
            this.vy += this.gravity;
            // Optional: Clamp fall speed to prevent excessive velocity
            // if (this.vy > Config.MAX_FALL_SPEED) { this.vy = Config.MAX_FALL_SPEED; }
        } else {
             // Optional: If on ground and not jumping, ensure vertical velocity is exactly 0
             // This can help prevent slight bouncing or sinking due to floating point inaccuracies
             // if (this.vy > 0) {
             //    this.vy = 0;
             // }
        }


        // --- Physics Step 2: Grid Collision Detection & Resolution ---
        // This function modifies this.x, this.y, this.vx, this.vy directly based on collisions.
        // It also returns information about the collision state.
        const collisionResult = GridCollision.collideAndResolve(this);

        // Update the player's ground status based on the *current* frame's collision result.
        this.isOnGround = collisionResult.isOnGround;

        // Optional: Log step-up events if needed for debugging
        // if (collisionResult.didStepUp) {
        //    console.log("Player stepped up!");
        // }

        // --- Optional: Screen Boundary Checks (If needed beyond grid world bounds) ---
        // Prevent moving beyond the absolute canvas edges
        if (this.x < 0) {
             this.x = 0;
             if (this.vx < 0) this.vx = 0; // Stop velocity if hitting edge
        }
        if (this.x + this.width > Config.CANVAS_WIDTH) {
             this.x = Config.CANVAS_WIDTH - this.width;
             if (this.vx > 0) this.vx = 0; // Stop velocity if hitting edge
        }
        // --- End Optional Boundary Checks ---


        // --- Reset if falling out of world ---
        if (this.y > Config.CANVAS_HEIGHT + 200) { // Check well below canvas bottom
           console.warn("Player fell out of world!");
           this.resetPosition(); // Reset position and basic state
           // Consider applying damage or other penalties for falling out
           // this.takeDamage(1); // Example: take 1 damage
        }
    } // --- End of update method ---


    draw(ctx) {
        if (!ctx) { console.error("Player.draw: Rendering context not provided!"); return; }

        // Handle invulnerability flashing
        let shouldDraw = true;
        if (this.isInvulnerable) {
            // Blink roughly 5 times per second (100ms on, 100ms off)
            shouldDraw = Math.floor(performance.now() / 100) % 2 === 0;
        }

        // Draw Player Sprite
        if (shouldDraw) {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Draw Sword visual cue if held and not attacking
            if (this.hasSword && !this.isAttacking) {
                ctx.fillStyle = Config.SWORD_COLOR;
                // Simple visual representation of the sword at the side
                const swordVisualWidth = 4;
                const swordVisualHeight = 10;
                const swordVisualY = this.y + this.height * 0.3; // Position vertically
                // Position horizontally based on last facing direction
                const swordVisualX = this.lastDirection > 0
                    ? this.x + this.width - swordVisualWidth / 2 // Right side
                    : this.x - swordVisualWidth / 2;            // Left side
                ctx.fillRect(swordVisualX, swordVisualY, swordVisualWidth, swordVisualHeight);
            }
        }

        // Draw Attack Hitbox visual (for debugging/visual feedback)
        if (this.isAttacking) {
            const hitbox = this.getAttackHitbox();
            if (hitbox) {
                ctx.fillStyle = Config.PLAYER_ATTACK_COLOR; // Semi-transparent white
                ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
            }
        }

        // Draw Inventory UI (consider moving to UI module if it gets complex)
        ctx.fillStyle = Config.UI_TEXT_COLOR;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let invY = Config.UI_AREA_HEIGHT + 10; // Position below main UI area
        const invX = 10;
        ctx.fillText("Inventory:", invX, invY);
        invY += 18; // Line spacing
        let itemCount = 0;
        for (const itemType in this.inventory) {
            if (this.inventory[itemType] > 0) {
                 ctx.fillText(`${itemType}: ${this.inventory[itemType]}`, invX, invY);
                 invY += 16; // Smaller line spacing for items
                 itemCount++;
            }
        }
        // Optional: Indicate if inventory is empty
        // if (itemCount === 0) {
        //    ctx.fillText("(Empty)", invX + 5, invY);
        // }
    }

    takeDamage(amount) {
        if (this.isInvulnerable || this.currentHealth <= 0) return; // Cannot take damage if invulnerable or already dead

        this.currentHealth -= amount;
        console.log(`Player took ${amount} damage. Health: ${this.currentHealth}/${this.maxHealth}`);

        if (this.currentHealth <= 0) {
            this.currentHealth = 0; // Don't go below zero
            this.die(); // Handle player death
        } else {
            // Become invulnerable for a duration
            this.isInvulnerable = true;
            this.invulnerabilityTimer = Config.PLAYER_INVULNERABILITY_DURATION;
            // Optional: Add knockback or other effects on taking damage
        }
    }

    die() {
        // This function is called when health drops to 0 or below.
        // Currently, it just logs. Game over logic is handled in main.js loop.
        console.error("PLAYER DIED!");
        // Stop movement immediately
        this.vx = 0;
        this.vy = 0;
        // Could trigger death animation, sound effects, etc. here
    }

    reset() {
        // Resets the player to initial state, typically called on game restart.
        console.log("Resetting player state...");
        this.x = Config.PLAYER_START_X;
        this.y = Config.PLAYER_START_Y;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false; // Assume starting airborne, gravity/collision will correct
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.hasSword = false;
        this.inventory = {}; // Clear inventory
        this.lastDirection = 1; // Reset facing direction
        this.hitEnemiesThisSwing = []; // Clear hit list
    }

    resetPosition() {
         // Resets only the player's position and velocity, e.g., after falling out.
         console.log("Player position reset (fell out).");
         this.x = Config.PLAYER_START_X;
         this.y = Config.PLAYER_START_Y;
         this.vx = 0;
         this.vy = 0;
         this.isOnGround = false; // Recalculate ground state
         // Keep health, inventory, etc. as they were
         // Reset invulnerability briefly? Optional.
         // this.isInvulnerable = true;
         // this.invulnerabilityTimer = 0.5;
    }

    getAttackHitbox() {
        // Calculates the position and size of the attack hitbox based on player state.
        if (!this.isAttacking) { return null; } // No hitbox if not attacking

        const verticalCenter = this.y + this.height / 2;
        // Calculate hitbox top-left Y, adjusting for reach and centering vertically
        const hitboxY = verticalCenter - (Config.PLAYER_ATTACK_HEIGHT / 2) + Config.PLAYER_ATTACK_REACH_Y;

        // Calculate hitbox top-left X based on facing direction and reach
        let hitboxX;
        if (this.lastDirection > 0) { // Facing right
            // Position hitbox to the right of the player
            hitboxX = this.x + this.width + Config.PLAYER_ATTACK_REACH_X - (Config.PLAYER_ATTACK_WIDTH / 2);
        } else { // Facing left
            // Position hitbox to the left of the player
            hitboxX = this.x - Config.PLAYER_ATTACK_REACH_X - (Config.PLAYER_ATTACK_WIDTH / 2);
        }
        // Return the calculated rectangle
        return {
            x: hitboxX,
            y: hitboxY,
            width: Config.PLAYER_ATTACK_WIDTH,
            height: Config.PLAYER_ATTACK_HEIGHT
        };
    }

    pickupItem(item) {
        // Handles logic when the player collides with an item.
        if (!item || !item.type) return false; // Safety check

        if (item.type === 'sword') {
            if (!this.hasSword) { // Only pick up if doesn't already have one
                 this.hasSword = true;
                 console.log("Player picked up the sword!");
                 return true; // Successfully picked up
            } else {
                 console.log("Player already has a sword.");
                 return false; // Did not pick up (already have it)
            }
        }
        // Check for resource items (using the configured enemy drop type as an example)
        else if (Config.ENEMY_DROP_TYPE && item.type === Config.ENEMY_DROP_TYPE) {
             // Add to inventory, initializing if necessary
             this.inventory[item.type] = (this.inventory[item.type] || 0) + 1;
             console.log(`Picked up ${item.type}! Total: ${this.inventory[item.type]}`);
             return true; // Successfully picked up
        }
        // Add conditions for other item types here
        // else if (item.type === 'health_potion') { ... }

        // If item type is not recognized or cannot be picked up
        return false;
    }

    // --- Helper methods for attack collision ---
    hasHitEnemyThisSwing(enemy) {
        // Checks if a specific enemy instance has already been hit during the current attack swing.
        return this.hitEnemiesThisSwing.includes(enemy);
    }
    registerHitEnemy(enemy) {
        // Adds an enemy to the list of those hit during the current swing, preventing multiple hits per swing.
        if (!this.hasHitEnemyThisSwing(enemy)) {
            this.hitEnemiesThisSwing.push(enemy);
        }
    }

    // --- Simple Getters ---
    getRect() {
        // Returns the player's bounding box.
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
    getPosition() {
        // Returns the player's top-left position.
        return { x: this.x, y: this.y };
    }
    getCurrentHealth() {
        return this.currentHealth;
    }
    getMaxHealth() {
        return this.maxHealth;
    }

} // End of Player Class