// js/itemManager.js
// -----------------------------------------------------------------------------
// itemManager.js - Manages Items in the World
// -----------------------------------------------------------------------------
console.log("itemManager.js loaded");

import * as Config from './config.js';
// Remove the direct import of WorldManager if only used for collision check
// import * as World from './worldManager.js';
// Import the new GridCollision module
import * as GridCollision from './utils/gridCollision.js'; // Adjust path if needed

// --- Internal Item Class ---
class Item {
    constructor(x, y, type, width, height, color) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = width;
        this.height = height;
        this.color = color;

        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.bobbleOffset = Math.random() * Math.PI * 2;
        this.gravity = Config.ITEM_GRAVITY ?? Config.GRAVITY;

        // Add an isActive flag for potential despawning/removal
        this.isActive = true;
    }

    /**
     * Updates the item's physics and state using grid collision.
     * @param {number} dt - Delta time.
     */
    update(dt) {
        if (!this.isActive) return; // Don't update inactive items

        // --- Physics Step 1: Apply Forces (Gravity) ---
        if (!this.isOnGround) {
            this.vy += this.gravity;
        } else {
             this.bobbleOffset += Config.ITEM_BOBBLE_SPEED;
        }

        // --- Physics Step 3: Grid Collision Detection & Resolution ---
        // Use the refactored GridCollision module and the discrete check (for now)
        const collisionResult = GridCollision.collideAndResolve(this);
        this.isOnGround = collisionResult.isOnGround;

        // --- Optional: Screen Boundary Checks (If needed) ---
        // Items typically just fall out, but this prevents going off sides
        // if (this.x < 0) { this.x = 0; if (this.vx < 0) this.vx = 0; }
        // if (this.x + this.width > Config.CANVAS_WIDTH) { this.x = Config.CANVAS_WIDTH - this.width; if (this.vx > 0) this.vx = 0; }

        // --- Despawn/Remove if falls out of world ---
        if (this.y > Config.CANVAS_HEIGHT + 100) {
             console.warn(`Item ${this.type} fell out of bounds.`);
             this.isActive = false; // Mark for removal
        }

    }


    draw(ctx) {
        if (!this.isActive || !ctx) return; // Don't draw inactive items
        // Check for NaN before drawing
        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Item DRAW ERROR: Preventing draw due to NaN coordinates! type: ${this.type}, x: ${this.x}, y: ${this.y}`);
             return;
        }

        let drawY = this.y;
        if (this.isOnGround) {
             drawY += Math.sin(this.bobbleOffset) * Config.ITEM_BOBBLE_AMOUNT * this.height;
        }

        ctx.fillStyle = this.color;
        // Use floor for potentially crisper rendering on pixel grid
        ctx.fillRect(Math.floor(this.x), Math.floor(drawY), this.width, this.height);
    }

    getRect() {
        // Add NaN checks here too for safety before collision checks use this rect
         const safeX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
         const safeY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
        return {
            x: safeX,
            y: safeY, // Use non-bobbing Y for collision
            width: this.width,
            height: this.height
        };
    }
} // --- End of Item Class ---


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
    // No need to check isActive here, draw method handles it
    items.forEach(item => { item.draw(ctx); });
}

export function getItems() { return items; }

// This function is typically called by the collisionManager after player pickup
export function removeItem(itemToRemove) {
    // Filter keeps items that are NOT the one to remove
    items = items.filter(item => item !== itemToRemove);
}