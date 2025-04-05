// js/player.js
// -----------------------------------------------------------------------------
// player.js - Player Character Class
// -----------------------------------------------------------------------------
console.log("player.js loaded");

import * as Config from './config.js';
import * as World from './worldManager.js'; // <<< --- IMPORT WORLD ---
import * as GridCollision from './utils/gridCollision.js';

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
     * @param {function} _getSurfaceCollisionY_IGNORED - Old function, no longer needed.
     */
    // --- Remove the getSurfaceCollisionY parameter ---
    update(dt, inputState /*, getSurfaceCollisionY - REMOVED */) {

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
        if (inputState.jump && this.isOnGround) { this.vy = -this.jumpForce; this.isOnGround = false; }
        // Attack Triggering
        if (inputState.attack && this.hasSword && this.attackCooldown <= 0 && !this.isAttacking) {
             this.isAttacking = true; this.attackTimer = Config.PLAYER_ATTACK_DURATION;
             this.attackCooldown = Config.PLAYER_ATTACK_COOLDOWN; this.hitEnemiesThisSwing = [];
             inputState.attack = false;
        } else if (inputState.attack) { inputState.attack = false; }


        // --- Physics Step 1: Apply Forces (Gravity) ---
        if (!this.isOnGround) { // Only apply gravity if potentially airborne
            this.vy += this.gravity;
            // Optional: Clamp fall speed
            // if (this.vy > MAX_FALL_SPEED) { this.vy = MAX_FALL_SPEED; }
        }

        // --- Physics Step 2: Grid Collision Detection & Resolution ---
        // The checkGridCollision function modifies this.x, this.y, this.vx, this.vy directly
        const collisionResult = GridCollision.collideAndResolve(this);
        this.isOnGround = collisionResult.isOnGround;
        // Note: checkGridCollision already zeroed out vx/vy upon collision.

        // --- Optional: Screen Boundary Checks (If grid doesn't cover full screen edges) ---
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
        if (this.y > Config.CANVAS_HEIGHT + 200) {
           this.resetPosition();
           // Consider full reset or just position based on gameplay needs
           // this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
           // this.hasSword = false;
           // this.inventory = {};
        }
    } // --- End of update method ---


    draw(ctx) {
        if (!ctx) { console.error("Player.draw: Rendering context not provided!"); return; }

        let shouldDraw = true;
        if (this.isInvulnerable) {
            shouldDraw = Math.floor(performance.now() / 100) % 2 === 0;
        }

        if (shouldDraw) {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            if (this.hasSword && !this.isAttacking) {
                ctx.fillStyle = Config.SWORD_COLOR;
                const iW = 4; const iH = 10; const iY = this.y + this.height * 0.3;
                const iX = this.lastDirection > 0 ? this.x + this.width - iW / 2 : this.x - iW / 2;
                ctx.fillRect(iX, iY, iW, iH);
            }
        }

        if (this.isAttacking) {
            const hitbox = this.getAttackHitbox();
            if (hitbox) {
                ctx.fillStyle = Config.PLAYER_ATTACK_COLOR;
                ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
            }
        }

        // Draw Inventory
        ctx.fillStyle = Config.UI_TEXT_COLOR;
        ctx.font = '14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        let invY = Config.UI_AREA_HEIGHT + 10; const invX = 10;
        ctx.fillText("Inventory:", invX, invY); invY += 18;
        let itemCount = 0;
        for (const itemType in this.inventory) {
            if (this.inventory[itemType] > 0) {
                 ctx.fillText(`${itemType}: ${this.inventory[itemType]}`, invX, invY);
                 invY += 16; itemCount++;
            }
        }
    }

    takeDamage(amount) {
        if (this.isInvulnerable || this.currentHealth <= 0) return;
        this.currentHealth -= amount;
        if (this.currentHealth <= 0) {
            this.currentHealth = 0; this.die();
        } else {
            this.isInvulnerable = true; this.invulnerabilityTimer = Config.PLAYER_INVULNERABILITY_DURATION;
        }
    }

    die() { console.error("PLAYER DIED!"); }

    reset() {
        console.log("Resetting player state...");
        this.x = Config.PLAYER_START_X; this.y = Config.PLAYER_START_Y;
        this.vx = 0; this.vy = 0; this.isOnGround = false;
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
        this.isInvulnerable = false; this.invulnerabilityTimer = 0;
        this.isAttacking = false; this.attackTimer = 0; this.attackCooldown = 0;
        this.hasSword = false; this.inventory = {}; this.lastDirection = 1;
        this.hitEnemiesThisSwing = [];
    }

    resetPosition() {
         console.log("Player position reset (fell out).");
         this.x = Config.PLAYER_START_X; this.y = Config.PLAYER_START_Y;
         this.vx = 0; this.vy = 0; this.isOnGround = false;
         this.isInvulnerable = false; this.invulnerabilityTimer = 0;
    }

    getAttackHitbox() {
        if (!this.isAttacking) { return null; }
        const vC = this.y + this.height / 2;
        const hY = vC - (Config.PLAYER_ATTACK_HEIGHT / 2) + Config.PLAYER_ATTACK_REACH_Y;
        let hX;
        if (this.lastDirection > 0) { hX = this.x + this.width + Config.PLAYER_ATTACK_REACH_X - (Config.PLAYER_ATTACK_WIDTH / 2); }
        else { hX = this.x - Config.PLAYER_ATTACK_REACH_X - (Config.PLAYER_ATTACK_WIDTH / 2); }
        return { x: hX, y: hY, width: Config.PLAYER_ATTACK_WIDTH, height: Config.PLAYER_ATTACK_HEIGHT };
    }

    pickupItem(item) {
        if (item.type === 'sword') {
            if (!this.hasSword) { this.hasSword = true; console.log("Player picked up the sword!"); return true; }
            else { return false; }
        }
        // Use config drop type key for pickup check
        else if (Config.ENEMY_DROP_TYPE && item.type === Config.ENEMY_DROP_TYPE) {
             this.inventory[item.type] = (this.inventory[item.type] || 0) + 1;
             // console.log(`Picked up ${item.type}! Total: ${this.inventory[item.type]}`);
             return true;
        }
        return false;
    }

    hasHitEnemyThisSwing(enemy) { return this.hitEnemiesThisSwing.includes(enemy); }
    registerHitEnemy(enemy) { if (!this.hasHitEnemyThisSwing(enemy)) { this.hitEnemiesThisSwing.push(enemy); } }
    getRect() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
    getPosition() { return { x: this.x, y: this.y }; }
    getCurrentHealth() { return this.currentHealth; }
    getMaxHealth() { return Config.PLAYER_MAX_HEALTH; }

} // End of Player Class