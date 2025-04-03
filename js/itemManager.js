// js/itemManager.js
// -----------------------------------------------------------------------------
// itemManager.js - Manages Items in the World
// -----------------------------------------------------------------------------
console.log("itemManager.js loaded");

import * as Config from './config.js';
import * as World from './world.js'; // <<< --- IMPORT WORLD ---

// --- Internal Item Class ---
class Item {
    constructor(x, y, type, width, height, color) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = width;
        this.height = height;
        this.color = color;

        this.vx = 0; // Can be used for dropping with velocity
        this.vy = 0;
        this.isOnGround = false;
        this.bobbleOffset = Math.random() * Math.PI * 2;

        // Use general GRAVITY or specific ITEM_GRAVITY
        this.gravity = Config.ITEM_GRAVITY ?? Config.GRAVITY;
    }

    /**
     * Updates the item's physics and state using grid collision.
     * @param {number} dt - Delta time.
     * @param {function} _getSurfaceY_IGNORED - Old function, no longer needed.
     */
    // --- Remove the getSurfaceY parameter ---
    update(dt /*, getSurfaceY - REMOVED */) {

        // --- Physics Step 1: Apply Forces (Gravity) ---
        if (!this.isOnGround) {
            this.vy += this.gravity;
            // Optional: Clamp fall speed?
        } else {
             // Apply bobbing offset change only when on ground
             this.bobbleOffset += Config.ITEM_BOBBLE_SPEED;
        }

        // --- Physics Step 2: Update Potential Position ---
        // Apply friction/drag if needed: this.vx *= 0.95;
        this.x += this.vx;
        this.y += this.vy;

        // --- Physics Step 3: Grid Collision Detection & Resolution ---
        // World.checkGridCollision handles snapping and velocity changes
        const collisionResult = World.checkGridCollision(this);
        this.isOnGround = collisionResult.isOnGround;

        // If item hits something horizontally, maybe make it bounce slightly?
        // if (collisionResult.collidedX && this.vx !== 0) {
        //     this.vx *= -0.5; // Reverse and dampen horizontal velocity
        // }

        // --- Optional: Screen Boundary Checks (If needed) ---
        if (this.x < 0) { this.x = 0; if (this.vx < 0) this.vx = 0; }
        if (this.x + this.width > Config.CANVAS_WIDTH) { this.x = Config.CANVAS_WIDTH - this.width; if (this.vx > 0) this.vx = 0; }

        // --- Despawn/Remove if falls out of world ---
        if (this.y > Config.CANVAS_HEIGHT + 100) {
             // Mark for removal? Need ItemManager to handle this.
             // For now, just log and let it fall. A better way is needed.
             console.warn(`Item ${this.type} fell out of bounds and was not removed.`);
             // To properly remove, Item would need a flag like 'isActive'
             // and ItemManager.update would filter inactive items.
        }

    } // --- End of update method ---


    draw(ctx) {
        if (!ctx) return;
        // Check for NaN before drawing
        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Item DRAW ERROR: Preventing draw due to NaN coordinates! type: ${this.type}, x: ${this.x}, y: ${this.y}`);
             return;
        }

        let drawY = this.y;
        if (this.isOnGround) {
            // Apply bobbing only when on ground
             drawY += Math.sin(this.bobbleOffset) * Config.ITEM_BOBBLE_AMOUNT * this.height;
        }

        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, drawY, this.width, this.height); // Use floor? Math.floor(this.x), etc.
    }

    getRect() {
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
    // Spawn initial sword - Adjust starting Y based on new grid/block size
    const startY = (Config.WORLD_GROUND_LEVEL_MEAN - 10) * Config.BLOCK_HEIGHT; // Spawn ~10 blocks above ground mean
    spawnItem(
        Config.CANVAS_WIDTH / 2 - Config.SWORD_WIDTH / 2, // Approx center X
        startY,
        'sword'
    );
    console.log("Item Manager initialized.");
}

export function spawnItem(x, y, type) {
    let newItem = null;
    if (type === 'sword') {
        newItem = new Item(x, y, type, Config.SWORD_WIDTH, Config.SWORD_HEIGHT, Config.SWORD_COLOR);
    }
    else if (type === Config.ENEMY_DROP_TYPE) { // 'wood'
         newItem = new Item(x, y, type, Config.WOOD_ITEM_WIDTH, Config.WOOD_ITEM_HEIGHT, Config.WOOD_ITEM_COLOR);
    }
    // Add other item types here

    if (newItem) { items.push(newItem); }
    else { console.warn(`ItemManager: Attempted to spawn unknown item type: ${type}`); }
}

/**
 * Updates all active items using grid collision.
 * @param {number} dt - Delta time.
 * @param {function} _getSurfaceY_IGNORED - Old function, no longer needed.
 */
// --- Remove getSurfaceY parameter ---
export function update(dt /*, getSurfaceY - REMOVED */) {
    // Update items (consider iterating backwards if removing items within loop)
    items.forEach(item => {
        item.update(dt); // Call item update without getSurfaceY
        // TODO: Implement item despawning logic here if needed
        // (e.g., item.lifetime -= dt; if (item.lifetime <= 0) markForRemoval = true;)
    });
    // TODO: Filter out items marked for removal
    // items = items.filter(item => !item.markForRemoval);
}

export function draw(ctx) {
    items.forEach(item => { item.draw(ctx); });
}

export function getItems() { return items; }

export function removeItem(itemToRemove) {
    items = items.filter(item => item !== itemToRemove);
}