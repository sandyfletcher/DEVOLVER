// -----------------------------------------------------------------------------
// player.js - Player Character Class
// -----------------------------------------------------------------------------
console.log("player.js loaded");

// --- Module Imports ---
import * as Config from './config.js';

// --- Player Class ---
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

        // Player specific physics/tuning constants (could override config if needed)
        this.moveSpeed = Config.PLAYER_MOVE_SPEED;
        this.jumpForce = Config.PLAYER_JUMP_FORCE;
        this.gravity = Config.GRAVITY;

        // sword thing:

         this.hasSword = false;

        // Future properties: health, inventory, selected item, etc.
        // this.health = 100;
        // this.inventory = {};
        // this.selectedItem = null;

        console.log("Player object created at", x, y);
    }

    /**
     * Updates the player's state based on input, physics, and collisions.
     * @param {number} dt - Delta time (time since last frame in seconds).
     * @param {object} inputState - Object containing input flags (e.g., { left, right, jump }).
     * @param {function} getSurfaceCollisionY - Function that returns the Y value of the ground/surface at a given X.
     */
    update(dt, inputState, getSurfaceCollisionY) {
        // --- Input Handling ---
        // Horizontal Movement
        if (inputState.left && !inputState.right) {
            this.vx = -this.moveSpeed;
        } else if (inputState.right && !inputState.left) {
            this.vx = this.moveSpeed;
        } else {
            this.vx = 0; // Stop if both or neither pressed
        }

        // Jumping
        if (inputState.jump && this.isOnGround) {
            this.vy = -this.jumpForce;
            this.isOnGround = false; // Player is now in the air
        }

        // --- Physics ---
        // Apply Gravity (only if in the air)
        if (!this.isOnGround) {
            this.vy += this.gravity;
            // Optional: Terminal Velocity (limit max fall speed)
            // if (this.vy > SomeMaxFallSpeed) this.vy = SomeMaxFallSpeed;
        }

        // --- Update Position ---
        // NOTE: We are currently NOT using dt for physics integration.
        // This makes movement speed frame-rate dependent.
        // To fix later: this.x += this.vx * dt * SOME_SCALAR; etc.
        // For now, keep it simple as before.
        this.x += this.vx;
        this.y += this.vy;

        // --- Collision Detection & Resolution ---

        // Horizontal World Boundaries (Stop at Water Edge defined in Config)
        if (this.x < Config.WATER_WIDTH) {
            this.x = Config.WATER_WIDTH;
            this.vx = 0;
        }
        if (this.x + this.width > Config.CANVAS_WIDTH - Config.WATER_WIDTH) {
            this.x = Config.CANVAS_WIDTH - Config.WATER_WIDTH - this.width;
            this.vx = 0;
        }

        // Vertical Collision (Ground/Surface)
        // Check surface level slightly ahead/below center for stability on slopes
        const checkX = this.x + this.width / 2;
        const surfaceY = getSurfaceCollisionY(checkX);

        // Assume not on ground until proven otherwise
        this.isOnGround = false;

        // Check if player's bottom edge is at or below the surface
        if (this.y + this.height >= surfaceY) {
            // Only resolve collision if moving downwards (vy >= 0)
            // This prevents sticking to ceilings if jumping into them (though we don't have ceilings yet)
            // And prevents getting stuck when moving horizontally into a slope
            if (this.vy >= 0) {
                 // Simple check: Were we above the ground last frame? (Approximate)
                 // Helps prevent tunnelling up slopes when moving horizontally very fast.
                 const prevFeetY = (this.y - this.vy) + this.height;
                 if (prevFeetY <= surfaceY + 1) { // +1 allows for slight float point inaccuracies
                    this.y = surfaceY - this.height; // Snap feet exactly to surface
                    this.vy = 0; // Stop vertical movement
                    this.isOnGround = true;
                 }
                 // Safety check if already embedded somehow
                 else if (this.y + this.height > surfaceY + this.height / 2) {
                    this.y = surfaceY - this.height;
                    this.vy = 0;
                    this.isOnGround = true;
                    // console.warn("Corrected deep ground penetration");
                 }
            }
        }

        // Safety Net: Prevent falling through floor (if somehow below surface while flagged as on ground)
        if (this.isOnGround && this.y + this.height > surfaceY + 1) { // Added tolerance
            this.y = surfaceY - this.height;
            // console.warn("Corrected sinking player");
        }


        // Optional: Reset if falling out of world (e.g., through floor glitch)
        if (this.y > Config.CANVAS_HEIGHT + 200) {
           console.log("Player fell out of world, resetting.");
           this.x = Config.PLAYER_START_X;
           this.y = Config.PLAYER_START_Y;
           this.vx = 0;
           this.vy = 0;
           this.isOnGround = false;
        }
    }

    /**
     * Draws the player onto the canvas.
     * @param {CanvasRenderingContext2D} ctx - The drawing context.
     */
    draw(ctx) {
        if (!ctx) {
            console.error("Player.draw: Rendering context not provided!");
            return;
        }
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        if (this.hasSword) {
            ctx.fillStyle = Config.SWORD_COLOR;
            // Draw a small square on the player's back/side or change player color slightly
            ctx.fillRect(this.x + this.width / 2 - 2, this.y + 5, 4, 10);
            // Or maybe change player color:
            // ctx.fillStyle = 'rgb(255, 80, 80)'; // Slightly brighter red
            // ctx.fillRect(this.x, this.y, this.width, this.height);
       }
   }

        // Future: Draw equipped items, animations, health bar above head, etc.

    // --- Getters (Example) ---
    getPosition() {
        return { x: this.x, y: this.y };
    }

 // --- NEW METHOD ---
    /**
     * Handles the player picking up an item.
     * @param {Item} item - The item being picked up.
     */
    pickupItem(item) {
        console.log(`Player collided with ${item.type}`);
        if (item.type === 'sword') {
            if (!this.hasSword) {
                this.hasSword = true;
                console.log("Player picked up the sword!");
                // Play sound effect? Update UI?
                return true; // Indicate successful pickup
            } else {
                console.log("Player already has a sword.");
                return false; // Indicate pickup failed (already have one)
            }
        }
        // Add logic for other item types later (wood, stone -> add to inventory)
        /*
        else if (item.type === 'wood') {
            // this.inventory.wood = (this.inventory.wood || 0) + 1;
            console.log("Picked up wood!");
            return true;
        }
        */
       return false; // Item type not handled or pickup failed
    }
    // --- END NEW ---

    // --- Future Methods ---
    // takeDamage(amount) { this.health -= amount; if (this.health <= 0) this.die(); }
    // addItem(item) { ... }
    // placeBlock() { ... }
    // attack() { ... }
    // die() { console.log("Player died!"); /* Reset or game over logic */ }
}