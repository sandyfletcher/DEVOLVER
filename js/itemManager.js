// -----------------------------------------------------------------------------
// itemManager.js - Manages Items in the World
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js';

// --- Internal Item Class ---
class Item {
    constructor(x, y, type, config) { // Config is passed in
        this.x = x;
        this.y = y;
        this.type = type;

        // Use passed config directly
        this.width = config?.width ?? Math.floor(Config.BLOCK_WIDTH);
        this.height = config?.height ?? Math.floor(Config.BLOCK_HEIGHT);
        this.color = config?.color ?? 'magenta';
        this.bobbleAmount = config?.bobbleAmount ?? Config.ITEM_BOBBLE_AMOUNT;
        this.bobbleSpeed = config?.bobbleSpeed ?? Config.ITEM_BOBBLE_SPEED;

        // Physics and state
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.bobbleOffset = Math.random() * Math.PI * 2;
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
            // Use item's specific bobble speed
            this.bobbleOffset += this.bobbleSpeed * dt;
        }

        // --- Calculate Potential Movement This Frame ---
        const potentialMoveX = this.vx * dt; // Usually 0 for items
        const potentialMoveY = this.vy * dt;

        // --- Physics Step 2: Grid Collision Detection & Resolution ---
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround;

        // --- Despawn/Remove if falls out of world ---
        if (this.y > Config.CANVAS_HEIGHT + 100) {
             // console.warn(`Item ${this.type} fell out of bounds.`);
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
        // Apply bobble effect only when on ground, using item's specific amount
        if (this.isOnGround) {
             drawY += Math.sin(this.bobbleOffset) * this.bobbleAmount * this.height;
        }

        ctx.fillStyle = this.color;
        ctx.fillRect(Math.floor(this.x), Math.floor(drawY), this.width, this.height);
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
let items = []; // Array containing active Item instances

// --- Public Functions ---
// Initializes the Item Manager, clearing existing items and spawning the initial sword.
export function init() {
    items = [];
// Spawn initial weapons (adjust positions as needed)
    const startY = (Config.WORLD_GROUND_LEVEL_MEAN * Config.BLOCK_HEIGHT) - Config.SWORD_HEIGHT - (8 * Config.BLOCK_HEIGHT);
    const startY2 = startY - Config.BLOCK_HEIGHT * 5; // Place spear slightly higher/different spot
// Spawn Sword
    spawnItem(
        Config.CANVAS_WIDTH * 0.4 - Config.SWORD_WIDTH / 2, // Spawn left of center
        startY,
        Config.WEAPON_TYPE_SWORD // Use constant
    );
// Spawn Spear
    spawnItem(
        Config.CANVAS_WIDTH * 0.6 - Config.SPEAR_WIDTH / 2, // Spawn right of center
        startY2,
        Config.WEAPON_TYPE_SPEAR // Use constant
    );
    console.log("Item Manager initialized with Sword and Spear.");
}

// Spawn a new item based on parameters passed in from ITEM_CONFIG.
export function spawnItem(x, y, type) {
// Use the centralized ITEM_CONFIG from Config
    const itemConfig = Config.ITEM_CONFIG[type];
// Validate type and find configuration
    if (!itemConfig) {
        console.warn(`ItemManager: Attempted to spawn unknown item type "${type}". Spawning skipped.`);
        return;
    }
// Determining location? uncertain 
    const spawnX = typeof x === 'number' && !isNaN(x) ? x : Config.CANVAS_WIDTH / 2;
    const spawnY = typeof y === 'number' && !isNaN(y) ? y : 50;
// Pass the config
    const newItem = new Item(spawnX, spawnY, type, itemConfig); 
// Item spawns
    if (newItem) {
        items.push(newItem);
    }
}

/**
 * Updates all active items' physics and state.
 * Removes items marked as inactive (e.g., fell out of world).
 * @param {number} dt - Delta time.
 */
export function update(dt) {
    // Iterate backwards for safe removal during the loop
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.update(dt); // Update physics and check internal state

        // Remove inactive items
        if (!item.isActive) {
            items.splice(i, 1); // Remove item from array
        }
    }
}

/**
 * Draws all active items onto the canvas.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 */
export function draw(ctx) {
    items.forEach(item => {
        // The item's draw method already checks isActive
        item.draw(ctx);
    });
}

/**
 * Returns the array of all current item instances.
 * Used by CollisionManager.
 * @returns {Array<Item>}
 */
export function getItems() {
    return items;
}

/**
 * Removes a specific item instance from the manager.
 * Typically called by CollisionManager after a player picks up an item.
 * @param {Item} itemToRemove - The specific item instance to remove.
 */
export function removeItem(itemToRemove) {
    // Filter creates a new array excluding the itemToRemove
    items = items.filter(item => item !== itemToRemove);
    // console.log(`Removed item: ${itemToRemove.type}`);
}