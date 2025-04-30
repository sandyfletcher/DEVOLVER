// -----------------------------------------------------------------------------
// root/js/portal.js - The core structure that needs defending
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import { createBlock } from './utils/block.js'; // For potential future interaction

export class Portal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = Config.PORTAL_WIDTH;
        this.height = Config.PORTAL_HEIGHT;
        this.color = Config.PORTAL_COLOR;

        this.maxHealth = Config.PORTAL_INITIAL_HEALTH;
        this.currentHealth = this.maxHealth;

        this.safetyRadius = Config.PORTAL_SAFETY_RADIUS; // Radius for future world aging effect
        this.isActive = true; // Can be set to false if destroyed

        // Initial position validation
         if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Portal CONSTRUCTOR ERROR: NaN initial coordinates! Resetting to center.`);
             this.x = Config.CANVAS_WIDTH / 2 - this.width/2;
             this.y = Config.CANVAS_HEIGHT / 2 - this.height/2;
         }

         console.log(`Portal created at [${this.x.toFixed(1)}, ${this.y.toFixed(1)}] with HP ${this.maxHealth} and safety radius ${this.safetyRadius}`);
    }

    /**
     * Updates the portal's state (minimal for now).
     * @param {number} dt - Delta time.
     */
    update(dt) {
        if (!this.isActive) return;
        // Add any animations, particle effects, etc. here later
    }

    /**
     * Draws the portal onto the canvas.
     * @param {CanvasRenderingContext2D} ctx - The drawing context.
     */
    draw(ctx) {
        if (!this.isActive || !ctx) return;

         if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Portal DRAW ERROR: Preventing draw due to NaN coordinates!`);
             return;
         }

        // Basic rectangular representation for now
        ctx.fillStyle = this.color;
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);

        // Optional: Draw safety radius outline for debugging/visual
        // ctx.save();
        // ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'; // Cyan transparent
        // ctx.lineWidth = 2;
        // const centerX = this.x + this.width / 2;
        // const centerY = this.y + this.height / 2;
        // ctx.beginPath();
        // ctx.arc(centerX, centerY, this.safetyRadius, 0, Math.PI * 2);
        // ctx.stroke();
        // ctx.restore();

         // Optional: Draw simple HP bar above the portal (relative to portal position)
         const hpBarWidth = this.width;
         const hpBarHeight = 5;
         const hpBarYOffset = -10; // Pixels above the portal
         const currentHpWidth = (this.currentHealth / this.maxHealth) * hpBarWidth;

         ctx.fillStyle = 'gray'; // Background
         ctx.fillRect(this.x, this.y + hpBarYOffset, hpBarWidth, hpBarHeight);
         ctx.fillStyle = 'red'; // Health fill
         ctx.fillRect(this.x, this.y + hpBarYOffset, currentHpWidth, hpBarHeight);
         ctx.strokeStyle = 'black'; // Border
         ctx.lineWidth = 1;
         ctx.strokeRect(this.x, this.y + hpBarYOffset, hpBarWidth, hpBarHeight);

    }

    /**
     * Applies damage to the portal.
     * @param {number} amount - The amount of damage to take.
     */
    takeDamage(amount) {
        if (!this.isActive || this.currentHealth <= 0) return;

        const damage = Math.max(0, amount); // Ensure damage is non-negative
        this.currentHealth -= damage;
        // console.log(`Portal took ${damage} damage. Health: ${this.currentHealth}/${this.maxHealth}`);

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die(); // Trigger death sequence
        }
    }

    /** Handles the portal's destruction. */
    die() {
        if (!this.isActive) return;
        console.log("The Portal has been destroyed!");
        this.isActive = false;
        // Add destruction animation, sound, etc. later
        // Game over state transition is handled in the main game loop (main.js)
    }

    /** Resets the portal's state completely for a new game. */
    reset() {
        console.log("Resetting portal state...");
        // Position is set in startGame, no need to reset here
        this.currentHealth = this.maxHealth; // Reset health to full
        this.isActive = true; // Make active again
         if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Portal RESET ERROR: NaN initial coordinates! Resetting to center.`);
             this.x = Config.CANVAS_WIDTH / 2 - this.width/2;
             this.y = Config.CANVAS_HEIGHT / 2 - this.height/2;
         }
    }


    /** Gets the portal's bounding rectangle for collision. */
    getRect() {
        const safeX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
        const safeY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
        return { x: safeX, y: safeY, width: this.width, height: this.height };
    }

    /** Gets the portal's center position. */
    getPosition() {
         const safeX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
         const safeY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
         return { x: safeX + this.width / 2, y: safeY + this.height / 2 };
    }

    /** Gets the portal's safety radius. */
    getSafetyRadius() {
        return this.safetyRadius;
    }

    /** Checks if the portal is currently alive (health > 0). */
    isAlive() {
        return this.isActive && this.currentHealth > 0;
    }
}