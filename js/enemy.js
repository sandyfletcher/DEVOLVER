// js/enemy.js
// -----------------------------------------------------------------------------
// enemy.js - Enemy Class
// -----------------------------------------------------------------------------
console.log("enemy.js loaded");

import * as Config from './config.js';
import * as ItemManager from './itemManager.js';
import * as World from './world.js';

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
        console.log(`>>> Enemy CONSTRUCTED Init State: x=${x}, y=${y}, speed=${this.speed}`);
        this.x = x; // Ensure assignment happens
        this.y = y;
        this.gravity = Config.ENEMY_GRAVITY;
        this.health = Config.ENEMY_HEALTH;
        this.isOnGround = false;
        this.isActive = true;
        this.targetX = Config.ENEMY_TARGET_X;

        // console.log(`>>> Enemy CONSTRUCTED at x: ${this.x?.toFixed(1)}, y: ${this.y?.toFixed(1)}`);
    }


    update(dt) {
        // *** ADD LOG AT THE VERY START OF UPDATE ***
        console.log(`>>> Enemy Update Start: x=${this.x}, y=${this.y}, vx=${this.vx}, vy=${this.vy}`);
        // *** END LOG ***
        if (!this.isActive) return;

        // --- Simple AI ---
        const currentCenterX = this.x + this.width / 2; // If this.x is NaN here, currentCenterX will be NaN
        let direction = 0;
        // Add safety check for currentCenterX
        if (!isNaN(currentCenterX) && Math.abs(currentCenterX - this.targetX) > this.speed) {
            direction = Math.sign(this.targetX - currentCenterX);
        } else if (isNaN(currentCenterX)) {
            console.error(">>> Enemy Update AI ERROR: currentCenterX is NaN!");
            // Maybe stop moving if center X is invalid?
            direction = 0; // Or handle error case
        }
        // console.log(`>>> Enemy Update AI: Before vx: direction = ${direction}, speed = ${this.speed}`);
        this.vx = direction * this.speed;
        // console.log(`>>> Enemy Update AI: After vx set: vx = ${this.vx}`);


        // --- Physics Step 1: Apply Gravity ---
        if (!this.isOnGround) {
            this.vy += this.gravity;
        }

        // --- Physics Step 2: Update Potential Position ---
        // console.log(`>>> Enemy Update Pos: Before: x=${this.x?.toFixed(1)}, y=${this.y?.toFixed(1)}, vx=${this.vx}, vy=${this.vy}`);
        this.x += this.vx;
        this.y += this.vy;
        // Keep this log active
        console.log(`>>> Enemy Update Pos: After Add: x = ${this.x}, y = ${this.y}`);


        // --- Physics Step 3: Grid Collision Detection & Resolution ---
        // console.log(`>>> Enemy Update Collision: Before Check: x=${this.x?.toFixed(1)}, y=${this.y?.toFixed(1)}`);
        // Add check BEFORE calling collision if x or y is already NaN
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Enemy Update ERROR: Skipping collision check because x or y is NaN before check! x=${this.x}, y=${this.y}`);
            // Don't call collision if state is invalid
        } else {
            const collisionResult = World.checkGridCollision(this); // This modifies x, y, vx, vy
            this.isOnGround = collisionResult.isOnGround;
            // console.log(`>>> Enemy Update Collision: After Check: x=${this.x?.toFixed(1)}, y=${this.y?.toFixed(1)}, vx=${this.vx}, vy=${this.vy}, onGround=${this.isOnGround}`);
        }

        // --- Screen Boundary Checks ---
         // Add NaN check here too
         if (!isNaN(this.x)) {
            if (this.x < 0) {
                 this.x = 0;
                 if (this.vx < 0) this.vx = 0;
            }
            if (this.x + this.width > Config.CANVAS_WIDTH) {
                 this.x = Config.CANVAS_WIDTH - this.width;
                 if (this.vx > 0) this.vx = 0;
            }
        }


        // --- Reset if falling out of world ---
        if (this.y > Config.CANVAS_HEIGHT + 200) {
            console.warn("Enemy fell out of world, marking inactive.");
            this.isActive = false;
        }

    }

    // ... (takeDamage, die, getPosition, getRect) ...
    takeDamage(amount) {
        if (!this.isActive) return;
        this.health -= amount;
        if (this.health <= 0) { this.die(); }
    }
    
    die() {
        if (!this.isActive) return;
        this.isActive = false;
        // Use optional chaining ?. for safety if x/y could be NaN when dying (shouldn't happen now but good practice)
        const deadX = this.x ?? 0;
        const deadY = this.y ?? 0;
        console.log("Enemy died at:", deadX.toFixed(1), deadY.toFixed(1));

        // Trigger Drops
        if (Math.random() < Config.ENEMY_DROP_CHANCE) {
            for (let i = 0; i < Config.ENEMY_DROP_AMOUNT; i++) {
                 if (typeof deadX === 'number' && typeof deadY === 'number') {
                     // --- ADJUST Y POSITION ---
                     // Spawn near the center X, but slightly ABOVE the enemy's top edge
                     let dropX = deadX + (this.width / 2);
                     let dropY = deadY - Config.BLOCK_HEIGHT; // Start one block height above enemy 'y'
                     // Add slight randomness so multiple drops don't stack perfectly
                     dropX += (Math.random() - 0.5) * Config.BLOCK_WIDTH;
                     dropY += (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.5;
                     // --- END ADJUSTMENT ---

                     ItemManager.spawnItem(dropX, dropY, Config.ENEMY_DROP_TYPE);
                 } else {
                      console.warn("Enemy died with invalid coordinates, skipping drop spawn.");
                 }
            }
            // console.log(`Enemy dropped ${Config.ENEMY_DROP_AMOUNT} ${Config.ENEMY_DROP_TYPE}`);
        }
    }

    getPosition() { return { x: this.x, y: this.y }; }
    getRect() {
         const sX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
         const sY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
         return { x: sX, y: sY, width: this.width, height: this.height };
    }

    draw(ctx) {
        if (!this.isActive || !ctx) return;
        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Enemy DRAW ERROR: Preventing draw due to NaN coordinates! x: ${this.x}, y: ${this.y}`);
             return;
        }
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

}