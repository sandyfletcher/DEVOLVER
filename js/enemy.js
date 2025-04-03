// js/enemy.js
// -----------------------------------------------------------------------------
// enemy.js - Enemy Class
// -----------------------------------------------------------------------------
console.log("enemy.js loaded");

import * as Config from './config.js';
// World import might be needed if getSurfaceY is used directly, but it's passed in now.
// import * as World from './world.js';
import * as ItemManager from './itemManager.js';

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

        this.isOnGround = false;
        this.isActive = true;
        this.targetX = Config.ENEMY_TARGET_X;

        // Log construction (Keep this)
        console.log(`>>> Enemy CONSTRUCTED at x: ${this.x?.toFixed(1)}, y: ${this.y?.toFixed(1)}`);
    }

    /**
     * Updates the enemy's state (AI, physics, collisions).
     * @param {number} dt - Delta time.
     * @param {function} getSurfaceY - Function to get terrain height (passed from main).
     */
    update(dt, getSurfaceY) {
        // *** Add log to confirm update is called ***
        // console.log(`>>> Enemy Update called for enemy at x: ${this.x?.toFixed(1)}`); // Optional: enable if needed

        if (!this.isActive) return;

        // --- Simple AI ---
        const currentCenterX = this.x + this.width / 2;
        if (Math.abs(currentCenterX - this.targetX) > this.speed) {
            const direction = Math.sign(this.targetX - currentCenterX);
            this.vx = direction * this.speed;
        } else {
            this.vx = 0;
        }

        // --- Physics ---
        if (!this.isOnGround) {
            this.vy += this.gravity;
        }

        // --- Update Position ---
        this.x += this.vx;
        this.y += this.vy;

        // --- Collision Detection & Resolution ---
        // Horizontal
        if (this.x < Config.WATER_WIDTH) { this.x = Config.WATER_WIDTH; this.vx = 0; }
        if (this.x + this.width > Config.CANVAS_WIDTH - Config.WATER_WIDTH) { this.x = Config.CANVAS_WIDTH - Config.WATER_WIDTH - this.width; this.vx = 0; }

        // --- Vertical Collision ---
        const checkX = this.x + this.width / 2;

        // *** Log BEFORE calling getSurfaceY ***
        console.log(`>>> Enemy Update Check: About to call getSurfaceY for checkX = ${checkX?.toFixed(1)}`);
        const surfaceY = getSurfaceY(checkX); // Get the surface height
        // *** Log AFTER calling getSurfaceY ***
        console.log(`>>> Enemy Update Check: getSurfaceY returned surfaceY = ${surfaceY}`);

        // Check if surfaceY is invalid
        if (typeof surfaceY !== 'number' || isNaN(surfaceY)) {
            console.error(`>>> Enemy Update ERROR: surfaceY is invalid (${surfaceY}) for checkX ${checkX}. Skipping vertical collision this frame.`);
            // We skip the rest of the vertical collision logic if surfaceY is bad
            // this.y might still be NaN if it became NaN from this.vy += this.gravity (if vy was already NaN)
            // Let's check if vy is NaN too
            if (isNaN(this.vy)) {
                 console.error(`>>> Enemy Update ERROR: this.vy is also NaN! Resetting vy to 0.`);
                 this.vy = 0; // Attempt recovery
            }
             // If y is already NaN, maybe try resetting it high up? Risky.
             // if (isNaN(this.y)) { this.y = 50; } // Avoid this unless necessary
            return;
        }

        // --- Process Valid Vertical Collision ---
        this.isOnGround = false;
        if (this.y + this.height >= surfaceY) {
            if (this.vy >= 0) {
                 const prevFeetY = (this.y - this.vy) + this.height;
                 if (prevFeetY <= surfaceY + 1) {
                    this.y = surfaceY - this.height; // Assign based on valid surfaceY
                    // console.log(`>>> Enemy Update: Snapped Y to ${this.y?.toFixed(1)} based on surfaceY ${surfaceY.toFixed(1)}`);
                    this.vy = 0;
                    this.isOnGround = true;
                 }
                 else if (this.y + this.height > surfaceY + this.height / 2) {
                    this.y = surfaceY - this.height;
                    // console.log(`>>> Enemy Update (Safety): Snapped Y to ${this.y?.toFixed(1)} based on surfaceY ${surfaceY.toFixed(1)}`);
                    this.vy = 0;
                    this.isOnGround = true;
                 }
            }
        }
    } // --- End of update method ---


    draw(ctx) {
        // Keep this log active
        // console.log(`>>> Attempting to draw Enemy. isActive: ${this.isActive}, x: ${this.x?.toFixed(1)}, y: ${this.y?.toFixed(1)}, color: ${this.color}`);

        if (!this.isActive) return;
        if (!ctx) return;

        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Enemy DRAW ERROR: Preventing draw due to NaN coordinates! x: ${this.x}, y: ${this.y}`);
             return;
        }

        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    takeDamage(amount) {
        if (!this.isActive) return;
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        if (!this.isActive) return;
        console.log("Enemy died at:", this.x?.toFixed(1), this.y?.toFixed(1));
        this.isActive = false;

        if (Math.random() < Config.ENEMY_DROP_CHANCE) {
            for (let i = 0; i < Config.ENEMY_DROP_AMOUNT; i++) {
                 if (typeof this.x === 'number' && typeof this.y === 'number' && !isNaN(this.x) && !isNaN(this.y)) {
                     let dropX = this.x + (this.width / 2) + (Math.random() - 0.5) * 10;
                     let dropY = this.y + (this.height / 2);
                     ItemManager.spawnItem(dropX, dropY, Config.ENEMY_DROP_TYPE);
                 } else {
                      console.warn("Enemy died with invalid coordinates, skipping drop spawn.");
                 }
            }
        }
    }

    getPosition() { return { x: this.x, y: this.y }; }

    getRect() {
         const safeX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
         const safeY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
         return { x: safeX, y: safeY, width: this.width, height: this.height };
    }
} // --- END CLASS ---