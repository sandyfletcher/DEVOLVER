// js/player.js
// -----------------------------------------------------------------------------
// player.js - Player Character Class
// -----------------------------------------------------------------------------
console.log("player.js loaded");

import * as Config from './config.js';

export class Player {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;

        this.vx = 0; // Velocity x
        this.vy = 0; // Velocity y
        this.isOnGround = false;

        // Player specific physics/tuning constants
        this.moveSpeed = Config.PLAYER_MOVE_SPEED;
        this.jumpForce = Config.PLAYER_JUMP_FORCE;
        this.gravity = Config.GRAVITY;

        // --- Combat & Inventory ---
        this.hasSword = false;
        this.isAttacking = false;
        this.attackTimer = 0;       // Counts down duration of active attack
        this.attackCooldown = 0;    // Counts down until next attack is allowed
        this.lastDirection = 1;     // 1 for right, -1 for left (for attack direction)
        this.hitEnemiesThisSwing = []; // Stores references of enemies hit in current swing
        this.inventory = {};          // Simple inventory object

        // --- Health & Invulnerability ---
        this.maxHealth = Config.PLAYER_MAX_HEALTH; // Used for UI max boxes
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0; // Countdown timer for invulnerability

        console.log("Player object created at", x, y);
    }

    /**
     * Updates the player's state based on input, physics, and collisions.
     * @param {number} dt - Delta time (time since last frame in seconds).
     * @param {object} inputState - Object containing input flags (e.g., { left, right, jump, attack }).
     * @param {function} getSurfaceCollisionY - Function that returns the Y value of the ground/surface at a given X.
     */
    update(dt, inputState, getSurfaceCollisionY) {

        // --- Update Timers ---
        // Attack Cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }
        // Attack Duration (Swing Timer)
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.isAttacking = false; // Attack duration finished
                this.hitEnemiesThisSwing = []; // Clear hit list after swing ends
            }
        }
        // Invulnerability Timer
        if (this.invulnerabilityTimer > 0) {
            this.invulnerabilityTimer -= dt;
            if (this.invulnerabilityTimer <= 0) {
                this.isInvulnerable = false; // Vulnerability restored
                // console.log("Player vulnerability restored.");
            }
        }

        // --- Input Handling ---
        // Horizontal Movement
        if (inputState.left && !inputState.right) {
            this.vx = -this.moveSpeed;
            this.lastDirection = -1;
        } else if (inputState.right && !inputState.left) {
            this.vx = this.moveSpeed;
            this.lastDirection = 1;
        } else {
            this.vx = 0;
        }
        // Jumping
        if (inputState.jump && this.isOnGround) {
            this.vy = -this.jumpForce;
            this.isOnGround = false;
        }
        // Attack Triggering
        if (inputState.attack && this.hasSword && this.attackCooldown <= 0 && !this.isAttacking) {
             this.isAttacking = true;
             this.attackTimer = Config.PLAYER_ATTACK_DURATION;
             this.attackCooldown = Config.PLAYER_ATTACK_COOLDOWN;
             this.hitEnemiesThisSwing = [];
             inputState.attack = false; // Consume the input trigger
        } else if (inputState.attack) {
             inputState.attack = false; // Consume even if not triggered
        }


        // ############################################# //
        // ##### Physics & Collision Section Start ##### //
        // ############################################# //

        // Apply Gravity
        if (!this.isOnGround) {
            this.vy += this.gravity;
            // Optional: Add terminal velocity clamp here
            // if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
        }

        // Update Position based on Velocity
        // Note: Frame-rate dependent. Multiply by dt * scalar for independence if needed.
        this.x += this.vx;
        this.y += this.vy;

        // Horizontal World Boundaries Collision
        if (this.x < Config.WATER_WIDTH) {
            this.x = Config.WATER_WIDTH;
            this.vx = 0; // Stop horizontal movement
        }
        if (this.x + this.width > Config.CANVAS_WIDTH - Config.WATER_WIDTH) {
            this.x = Config.CANVAS_WIDTH - Config.WATER_WIDTH - this.width;
            this.vx = 0; // Stop horizontal movement
        }

        // Vertical Collision (Ground/Surface)
        const checkX = this.x + this.width / 2; // Check below player center
        const surfaceY = getSurfaceCollisionY(checkX); // Get terrain height at that X

        // Assume not on ground until collision confirmed
        this.isOnGround = false;

        // Check if player's bottom edge is at or below the surface
        if (this.y + this.height >= surfaceY) {
            // Only resolve collision if moving downwards (vy >= 0) or stationary
            // This prevents sticking to ceilings (if any) or jittering up slopes.
            if (this.vy >= 0) {
                 // Check if feet were above surface last frame (approximate)
                 // Helps prevent tunnelling up slopes when moving horizontally fast.
                 const prevFeetY = (this.y - this.vy) + this.height;
                 if (prevFeetY <= surfaceY + 1) { // +1 tolerance for float issues
                    this.y = surfaceY - this.height; // Snap feet exactly to surface
                    this.vy = 0; // Stop vertical movement
                    this.isOnGround = true; // Set ground flag
                 }
                 // Safety check if somehow already embedded (e.g., due to high speed)
                 else if (this.y + this.height > surfaceY + this.height / 2) {
                    this.y = surfaceY - this.height;
                    this.vy = 0;
                    this.isOnGround = true;
                    // console.warn("Corrected deep ground penetration");
                 }
            }
        }

        // Safety Net: Prevent falling through floor if already flagged as on ground but position is wrong
        if (this.isOnGround && this.y + this.height > surfaceY + 1) {
            this.y = surfaceY - this.height;
            // console.warn("Corrected sinking player");
        }

        // ########################################### //
        // ##### Physics & Collision Section End ##### //
        // ########################################### //


        // Reset if falling out of world
        if (this.y > Config.CANVAS_HEIGHT + 200) {
           this.resetPosition();
           this.currentHealth = Config.PLAYER_INITIAL_HEALTH; // Reset health too? Your call.
           this.hasSword = false; // Reset sword on fall?
           this.inventory = {}; // Reset inventory on fall?
        }
    }

    /**
     * Draws the player, inventory, and attack visualization onto the canvas.
     * @param {CanvasRenderingContext2D} ctx - The drawing context.
     */
    draw(ctx) {
        if (!ctx) {
            console.error("Player.draw: Rendering context not provided!");
            return;
        }

        // --- Player Flashing when Invulnerable ---
        let shouldDraw = true;
        if (this.isInvulnerable) {
            // Flash roughly every other frame (adjust multiplier for speed)
            shouldDraw = Math.floor(performance.now() / 100) % 2 === 0; // Time-based flash
            // Or use the timer: shouldDraw = Math.floor(this.invulnerabilityTimer * 10) % 2 === 0;
        }

        if (shouldDraw) {
            // Draw Player Rectangle
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Draw Sword Indicator (only if flashing allows and holding sword)
            if (this.hasSword && !this.isAttacking) {
                ctx.fillStyle = Config.SWORD_COLOR;
                const indicatorWidth = 4; const indicatorHeight = 10; const indicatorY = this.y + this.height * 0.3;
                const indicatorX = this.lastDirection > 0 ? this.x + this.width - indicatorWidth / 2 : this.x - indicatorWidth / 2;
                ctx.fillRect(indicatorX, indicatorY, indicatorWidth, indicatorHeight);
            }
        }
        // --- END Flashing ---

        // Draw Attack Hitbox Visualization (always draw if attacking)
        if (this.isAttacking) {
            const hitbox = this.getAttackHitbox();
            if (hitbox) {
                ctx.fillStyle = Config.PLAYER_ATTACK_COLOR;
                ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
            }
        }

        // Draw Inventory (Simple Text Display)
        ctx.fillStyle = Config.UI_TEXT_COLOR;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let inventoryY = Config.UI_AREA_HEIGHT + 10; // Start below UI reserved area
        const inventoryX = 10;
        ctx.fillText("Inventory:", inventoryX, inventoryY);
        inventoryY += 18;
        let itemCount = 0;
        for (const itemType in this.inventory) {
            if (this.inventory[itemType] > 0) {
                 ctx.fillText(`${itemType}: ${this.inventory[itemType]}`, inventoryX, inventoryY);
                 inventoryY += 16;
                 itemCount++;
            }
        }
        // Optional: Display (Empty) if nothing held
        // if (itemCount === 0) { ctx.fillText("(Empty)", inventoryX, inventoryY); }
    }

    /**
     * Reduces player health and triggers invulnerability.
     * @param {number} amount - The amount of damage to take.
     */
    takeDamage(amount) {
        if (this.isInvulnerable || this.currentHealth <= 0) {
            return; // Already invincible or dead
        }

        this.currentHealth -= amount;
        // console.log(`Player took ${amount} damage. Health: ${this.currentHealth}/${this.maxHealth}`); // Can be noisy

        if (this.currentHealth <= 0) {
            this.currentHealth = 0; // Prevent negative display
            this.die();
        } else {
            // Become invulnerable
            this.isInvulnerable = true;
            this.invulnerabilityTimer = Config.PLAYER_INVULNERABILITY_DURATION;
            // console.log("Player became invulnerable.");
        }
    }

    /** Handles player death */
    die() {
        // This should signal to main.js to change game state
        console.error("PLAYER DIED!");
        // Game over logic will be handled in main.js based on checking health
    }

        // --- NEW Reset Method ---
    /** Resets player to initial state for restarting the game */
    reset() {
        console.log("Resetting player state...");
        this.x = Config.PLAYER_START_X;
        this.y = Config.PLAYER_START_Y;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        this.isAttacking = false; // Stop attacking
        this.attackTimer = 0;
        this.attackCooldown = 0; // Allow immediate attack on restart? Or keep cooldown? Resetting is fine.
        this.hasSword = false; // Player needs to pick up sword again
        this.inventory = {}; // Clear inventory
        this.lastDirection = 1; // Default facing right
        this.hitEnemiesThisSwing = [];
    }
    // --- END Reset Method ---

    /** Resets player position (e.g., after falling out of world) */
    resetPosition() {
         console.log("Player position reset.");
         this.x = Config.PLAYER_START_X;
         this.y = Config.PLAYER_START_Y;
         this.vx = 0;
         this.vy = 0;
         this.isOnGround = false;
         this.isInvulnerable = false; // Reset invulnerability state
         this.invulnerabilityTimer = 0;
        // Optionally reset health/sword/inventory on fall too?
        // this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
        // this.hasSword = false;
        // this.inventory = {};
    }

    /**
     * Calculates the position and size of the attack hitbox.
     * @returns {object | null} An object {x, y, width, height} or null if not attacking.
     */
    getAttackHitbox() {
        if (!this.isAttacking) { return null; }
        const verticalCenter = this.y + this.height / 2;
        const hitboxY = verticalCenter - (Config.PLAYER_ATTACK_HEIGHT / 2) + Config.PLAYER_ATTACK_REACH_Y;
        let hitboxX;
        if (this.lastDirection > 0) { hitboxX = this.x + this.width + Config.PLAYER_ATTACK_REACH_X - (Config.PLAYER_ATTACK_WIDTH / 2); }
        else { hitboxX = this.x - Config.PLAYER_ATTACK_REACH_X - (Config.PLAYER_ATTACK_WIDTH / 2); }
        return { x: hitboxX, y: hitboxY, width: Config.PLAYER_ATTACK_WIDTH, height: Config.PLAYER_ATTACK_HEIGHT };
    }

    /**
     * Handles the player picking up an item.
     * @param {Item} item - The item being picked up.
     * @returns {boolean} True if the item was successfully picked up.
     */
    pickupItem(item) {
        if (item.type === 'sword') {
            if (!this.hasSword) { this.hasSword = true; console.log("Player picked up the sword!"); return true; }
            else { return false; }
        }
        else if (Config.ENEMY_DROP_TYPE && item.type === Config.ENEMY_DROP_TYPE) { // e.g., 'wood'
             this.inventory[item.type] = (this.inventory[item.type] || 0) + 1;
             console.log(`Picked up ${item.type}! Total: ${this.inventory[item.type]}`);
             return true;
        }
        // Add else if for other resource types here
        return false;
    }

    /** Checks if a specific enemy has already been hit during the current attack swing */
    hasHitEnemyThisSwing(enemy) {
        return this.hitEnemiesThisSwing.includes(enemy);
    }

    /** Adds an enemy to the list hit during the current attack swing */
    registerHitEnemy(enemy) {
        if (!this.hasHitEnemyThisSwing(enemy)) {
            this.hitEnemiesThisSwing.push(enemy);
        }
    }

    /** Gets the player's bounding box */
    getRect() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    /** Gets the player's position */
    getPosition() {
        return { x: this.x, y: this.y };
    }

    // --- Getters for Health ---
    getCurrentHealth() {
        return this.currentHealth;
    }
    getMaxHealth() {
        // Use the constant directly for consistency, maxHealth property is mostly for potential future upgrades
        return Config.PLAYER_MAX_HEALTH;
    }
}