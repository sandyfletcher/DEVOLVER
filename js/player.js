// -----------------------------------------------------------------------------
// root/js/player.js - Player Character Class
// -----------------------------------------------------------------------------


import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js';

export class Player {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        // Physics state (velocity)
        this.vx = 0; // Velocity in pixels per second
        this.vy = 0; // Velocity in pixels per second
        this.isOnGround = false;
        // Combat / Interaction State
        this.hasSword = false;
        this.selectedWeapon = 'unarmed';  // why didn't we use null here?
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.lastDirection = 1; // 1 for right, -1 for left
        this.hitEnemiesThisSwing = [];
        this.inventory = {};
        // Health State
        this.maxHealth = Config.PLAYER_MAX_HEALTH_DISPLAY;
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        // console.log(`Player object created at ${x?.toFixed(1)}, ${y?.toFixed(1)}`);
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
                this.isAttacking = false;
                this.hitEnemiesThisSwing = [];
            }
        }
        if (this.invulnerabilityTimer > 0) {
            this.invulnerabilityTimer -= dt;
            if (this.invulnerabilityTimer <= 0) {
                this.isInvulnerable = false;
            }
        }

        // --- Input Handling & Acceleration ---
        let targetVx = 0;
        if (inputState.left && !inputState.right) {
            targetVx = -Config.PLAYER_MAX_SPEED_X;
            this.lastDirection = -1;
        } else if (inputState.right && !inputState.left) {
            targetVx = Config.PLAYER_MAX_SPEED_X;
            this.lastDirection = 1;
        }

        // Apply acceleration towards target velocity
        if (targetVx !== 0) {
            // Accelerate
            this.vx += Math.sign(targetVx) * Config.PLAYER_MOVE_ACCELERATION * dt;
            // Clamp to max speed, preserving direction
            if (Math.abs(this.vx) > Config.PLAYER_MAX_SPEED_X) {
                this.vx = Math.sign(this.vx) * Config.PLAYER_MAX_SPEED_X;
            }
        } else {
            // Apply friction when no movement input
            const frictionFactor = Math.pow(Config.PLAYER_FRICTION_BASE, dt);
            this.vx *= frictionFactor;
            // Stop completely if velocity is very small
            if (Math.abs(this.vx) < 1) {
                this.vx = 0;
            }
        }

        // Jumping (Apply initial velocity impulse)
        if (inputState.jump && this.isOnGround) {
            this.vy = -Config.PLAYER_JUMP_VELOCITY; // Use jump velocity directly
            this.isOnGround = false; // Instantly airborne after jump press
            // Optional: Add variable jump height logic here if desired
        }

// Attack Triggering
// CHANGED: Check selectedWeapon for attack capability
        if (inputState.attack && this.canAttack() && this.attackCooldown <= 0 && !this.isAttacking) {
            this.isAttacking = true;
            this.attackTimer = Config.PLAYER_ATTACK_DURATION;
            this.attackCooldown = Config.PLAYER_ATTACK_COOLDOWN;
            this.hitEnemiesThisSwing = [];
            inputState.attack = false; // Consume attack input
        } else if (inputState.attack) {
            inputState.attack = false; // Consume attack input even if on cooldown
        }


        // --- Physics Step 1: Apply Forces (Gravity) ---
        // Apply gravity acceleration if airborne
        if (!this.isOnGround) {
            this.vy += Config.GRAVITY_ACCELERATION * dt;
            // Clamp fall speed
            if (this.vy > Config.MAX_FALL_SPEED) {
                this.vy = Config.MAX_FALL_SPEED;
            }
        } else {
            // If on ground and somehow moving down slightly (e.g., landed on slope), clamp vy
            if (this.vy > 0) {
                 this.vy = 0;
            }
        }

        // --- Calculate maximum distance the player *would* move this frame if no collisions occurred  ---
        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;

        // --- Physics Step 2: Grid Collision ---
        // Pass the *potential* movement distances for THIS FRAME to the collision function.
        // The collision function MUST be updated to use these values.
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);

        // Update ground status based on the collision result for the *next* frame's logic
        this.isOnGround = collisionResult.isOnGround;
        // console.log(`AFTER Col -> x: ${this.x.toFixed(2)}, y: ${this.y.toFixed(2)}, vx: ${this.vx.toFixed(2)}, vy: ${this.vy.toFixed(2)}, collidedY: ${collisionResult.collidedY}, onGround: ${this.isOnGround}`);

        // --- Screen Boundary Checks ---
        if (this.x < 0) {
            this.x = 0;
            if (this.vx < 0) this.vx = 0;
        }
        if (this.x + this.width > Config.CANVAS_WIDTH) {
            this.x = Config.CANVAS_WIDTH - this.width;
            if (this.vx > 0) this.vx = 0;
        }

        // --- Reset if falling out of world ---
        if (this.y > Config.CANVAS_HEIGHT + 200) {
           console.warn("Player fell out of world!");
           this.resetPosition();
        }
    } 
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

            // Draw Sword visual cue if selected and not attacking
            if (this.selectedWeapon === 'sword' && !this.isAttacking) {
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

        // Only Draw Attack Hitbox visual if attacking with a weapon (for debugging/visual feedback)
            if (this.isAttacking && this.selectedWeapon !== 'unarmed') {
            const hitbox = this.getAttackHitbox();
            if (hitbox) {
                ctx.fillStyle = Config.PLAYER_ATTACK_COLOR; // Semi-transparent white
                ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
            }
        }
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
        console.log("PLAYER DIED!");
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
        this.currentHealth = Config.PLAYER_MAX_HEALTH_DISPLAY;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.hasSword = false;
        this.selectedWeapon = 'unarmed'; // Reset weapon
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
    getAttackHitbox() { // Calculates the position and size of the attack hitbox based on player state and selected weapon.
        if (!this.isAttacking || this.selectedWeapon === 'unarmed') {
             return null;
        }
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
        // Return the calculated rectangle based on weapon type (only sword for now)
        if (this.selectedWeapon === 'sword') {
            return {
                x: hitboxX,
                y: hitboxY,
                width: Config.PLAYER_ATTACK_WIDTH,
                height: Config.PLAYER_ATTACK_HEIGHT
            };
        }
        // Fallback or other weapons later
        return null;
    }
    
    /**
     * Handles logic when the player collides with an item.
     * Checks item type and updates inventory or player state accordingly.
     * @param {Item} item - The item object the player collided with.
     * @returns {boolean} True if the item was successfully picked up, false otherwise.
     */
    pickupItem(item) {
        if (!item || !item.type) return false; // Safety check

        // --- Sword Pickup Logic ---
        if (item.type === 'sword') {
            if (!this.hasSword) { // Only pick up if doesn't already have one
                this.hasSword = true; // Mark that we possess a sword
                this.equipWeapon('sword'); // Equip it immediately
// console.log("Player picked up the sword!");
                return true; // Successfully picked up
            } else {
                 // console.log("Player already has a sword.");
                 return false; // Did not pick up (already have it)
            }
        }
        // --- Resource Pickup Logic (FIXED) ---
        // Check for specific known resource types directly by their string identifier.
        // Add more 'else if' blocks here for other resources you add (e.g., stone, metal).
        else if (item.type === 'wood') {
             // Add to inventory, initializing count if it's the first one
             this.inventory[item.type] = (this.inventory[item.type] || 0) + 1;
             console.log(`Picked up ${item.type}! Total: ${this.inventory[item.type]}`);
             return true; // Successfully picked up
        }
        /*
        else if (item.type === 'enemy_part') { // Example for another resource
             this.inventory[item.type] = (this.inventory[item.type] || 0) + 1;
             console.log(`Picked up ${item.type}! Total: ${this.inventory[item.type]}`);
             return true;
        }
        else if (item.type === 'health_potion') { // Example for a consumable
             // Maybe heal the player instead of adding to inventory, or add limited stack
             // const healed = this.heal(2); // Assuming a heal method exists
             // console.log(`Used health potion!`);
             // return healed; // Return true only if successfully used/picked up
             console.log("Picked up health potion (logic TBD)"); // Placeholder
             return true; // For now, just remove it from ground
        }
        */

        // --- Fallback ---
        // If item type is not recognized or cannot be picked up
        // console.log(`Collision with unhandled item type: ${item.type}`);
        return false;
    }

    /** Equips a weapon if the player possesses it */
    equipWeapon(weaponType) {
        // Check if player actually has the weapon (e.g., `this.hasSword`)
        // Add checks for other weapons here later
        let canEquip = false;
        if (weaponType === 'sword' && this.hasSword) {
            canEquip = true;
        } else if (weaponType === 'unarmed') {
             canEquip = true; // Can always equip unarmed
        }

        if (canEquip && this.selectedWeapon !== weaponType) {
            this.selectedWeapon = weaponType;
            console.log(`Player equipped ${weaponType}`);
        }
    }
    
    // --- Helper methods for attack collision ---
    hasHitEnemyThisSwing(enemy) { // Checks if a specific enemy has already been hit during the current attack
        return this.hitEnemiesThisSwing.includes(enemy);
    }
    registerHitEnemy(enemy) { // Adds enemy to list of hit, preventing multiple per swing
        if (!this.hasHitEnemyThisSwing(enemy)) {
            this.hitEnemiesThisSwing.push(enemy);
        }
    }
    // --- Simple Getters ---
    getRect() { // Returns player's bounding box
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
    getPosition() { // Returns player's top-left position
        return { x: this.x, y: this.y };
    }
    getCurrentHealth() {
        return this.currentHealth;
    }
    getMaxHealth() {
        return this.maxHealth;
    }
    getInventory() {
        return this.inventory;
    }
     getSwordStatus() {
         return this.hasSword;
    }
    //  Can the player currently attack? (Based on selected weapon)
    canAttack() {
        return this.selectedWeapon !== 'unarmed'; // For now, only unarmed cannot attack
    }
}