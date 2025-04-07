// -----------------------------------------------------------------------------
// itemManager.js - Manages Items in the World
// -----------------------------------------------------------------------------
console.log("itemManager.js loaded");

import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js';

// --- Internal Item Class ---
class Item {
    constructor(x, y, type, width, height, color) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = width;
        this.height = height;
        this.color = color;
        this.vx = 0; // Items generally don't move horizontally unless pushed
        this.vy = 0; // Velocity pixels/sec
        this.isOnGround = false;
        this.bobbleOffset = Math.random() * Math.PI * 2; // Start bobble at random point
        this.isActive = true;
    }

    /**
     * Updates the item's physics and state using grid collision.
     * @param {number} dt - Delta time.
     */
    update(dt) {
        if (!this.isActive) return;

        // --- Physics Step 1: Apply Gravity ---
        if (!this.isOnGround) {
            this.vy += Config.GRAVITY_ACCELERATION * dt;
            // Clamp fall speed (using general max fall speed)
             this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED);
        } else {
            // If on ground, stop vertical velocity and apply bobbing
            if (this.vy > 0) this.vy = 0;
            this.bobbleOffset += Config.ITEM_BOBBLE_SPEED * dt; // Bobbing speed scaled by dt
        }

        // --- Calculate Potential Movement This Frame ---
        const potentialMoveX = this.vx * dt; // Usually 0 for items
        const potentialMoveY = this.vy * dt;

        // --- Physics Step 2: Grid Collision Detection & Resolution ---
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround;

        // --- Despawn/Remove if falls out of world ---
        if (this.y > Config.CANVAS_HEIGHT + 100) {
             console.warn(`Item ${this.type} fell out of bounds.`);
             this.isActive = false;
        }
    }

    draw(ctx) {
        if (!this.isActive || !ctx) return;
        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Item DRAW ERROR: NaN coordinates! type: ${this.type}, x: ${this.x}, y: ${this.y}`);
             return;
        }

        let drawY = this.y;
        // Apply bobble effect only when on ground
        if (this.isOnGround) {
             drawY += Math.sin(this.bobbleOffset) * Config.ITEM_BOBBLE_AMOUNT * this.height;
        }

        ctx.fillStyle = this.color;
        ctx.fillRect(Math.floor(this.x), Math.floor(drawY), this.width, this.height);
    }

    getRect() { // No change needed
         const safeX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
         const safeY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
        return {
            x: safeX,
            y: safeY, // Use non-bobbing Y for collision
            width: this.width,
            height: this.height
        };
    }
}

// --- Module State ---
let items = [];

// --- Public Functions ---

export function init() {
    items = [];
    const startY = (Config.WORLD_GROUND_LEVEL_MEAN - 10) * Config.BLOCK_HEIGHT;
    spawnItem(
        Config.CANVAS_WIDTH / 2 - Config.SWORD_WIDTH / 2,
        startY,
        'sword'
    );
    console.log("Item Manager initialized.");
}

export function spawnItem(x, y, type) {
    let newItem = null;
    // Make sure initial coordinates are numbers
    const spawnX = typeof x === 'number' && !isNaN(x) ? x : 0;
    const spawnY = typeof y === 'number' && !isNaN(y) ? y : 0;

    if (type === 'sword') {
        newItem = new Item(spawnX, spawnY, type, Config.SWORD_WIDTH, Config.SWORD_HEIGHT, Config.SWORD_COLOR);
    }
    else if (Config.ENEMY_DROP_TYPE && type === Config.ENEMY_DROP_TYPE) { // Check drop type exists
         newItem = new Item(spawnX, spawnY, type, Config.WOOD_ITEM_WIDTH, Config.WOOD_ITEM_HEIGHT, Config.WOOD_ITEM_COLOR);
    }
    // Add other item types here

    if (newItem) { items.push(newItem); }
    else { console.warn(`ItemManager: Attempted to spawn unknown item type: ${type}`); }
}

/**
 * Updates all active items using grid collision.
 * Removes items that fall out of the world.
 * @param {number} dt - Delta time.
 */
export function update(dt) {
    // Iterate backwards if we might remove items during the loop
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.update(dt); // Update physics and check for falling out

        // Remove inactive items (e.g., fell out of world)
        if (!item.isActive) {
            items.splice(i, 1); // Remove item from array
        }
        // TODO: Add other removal conditions (e.g., lifetime timer)
    }
}

export function draw(ctx) {
    items.forEach(item => { item.draw(ctx); });
}

export function getItems() { return items; }

// This function is typically called by the collisionManager after player pickup
export function removeItem(itemToRemove) {
    // Filter keeps items that are NOT the one to remove
    items = items.filter(item => item !== itemToRemove);
}