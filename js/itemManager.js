// -----------------------------------------------------------------------------
// itemManager.js - Manages Items in the World
// -----------------------------------------------------------------------------

// console.log("itemManager loaded");

import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js';

// --- Item Configuration Lookup ---
// Centralizes item properties based on type string.
// This makes adding new item types easier.
const ITEM_CONFIG = {
    'sword': {
        width: Config.SWORD_WIDTH,
        height: Config.SWORD_HEIGHT,
        color: Config.SWORD_COLOR,
        // Add other sword-specific properties if needed later (e.g., bobble amount modifier?)
    },
    'wood': {
        width: Config.WOOD_ITEM_WIDTH,
        height: Config.WOOD_ITEM_HEIGHT,
        color: Config.WOOD_ITEM_COLOR,
    },
    // --- Add configurations for new item types here ---
    /*
    'enemy_part': {
        width: Math.floor(0.8 * Config.BLOCK_WIDTH),
        height: Math.floor(0.8 * Config.BLOCK_HEIGHT),
        color: 'rgb(100, 50, 120)', // Example color
    },
    'health_potion': {
        width: Math.floor(1.2 * Config.BLOCK_WIDTH),
        height: Math.floor(1.2 * Config.BLOCK_HEIGHT),
        color: 'rgb(255, 100, 100)',
        // Maybe different bobble?
        // bobbleAmount: Config.ITEM_BOBBLE_AMOUNT * 1.2,
    }
    */
};


// --- Internal Item Class ---
// (No significant changes needed in the class itself, it uses properties passed to it)
class Item {
    constructor(x, y, type, config) { // Takes type and resolved config object
        this.x = x;
        this.y = y;
        this.type = type; // Store the type identifier (e.g., 'sword', 'wood')

        // Assign properties from the resolved config
        this.width = config.width ?? Math.floor(Config.BLOCK_WIDTH); // Fallback size
        this.height = config.height ?? Math.floor(Config.BLOCK_HEIGHT);
        this.color = config.color ?? 'magenta'; // Fallback color
        // Use specific bobble settings from config if provided, else use defaults
        this.bobbleAmount = config.bobbleAmount ?? Config.ITEM_BOBBLE_AMOUNT;
        this.bobbleSpeed = config.bobbleSpeed ?? Config.ITEM_BOBBLE_SPEED;

        // Physics and state
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
} // --- End of Item Class ---


// --- Module State ---
let items = []; // Array containing active Item instances


// --- Public Functions ---

/**
 * Initializes the Item Manager, clearing existing items and spawning the initial sword.
 */
export function init() {
    items = [];
    // Spawn initial sword (adjust Y position as needed based on world gen)
    const startY = (Config.WORLD_GROUND_LEVEL_MEAN * Config.BLOCK_HEIGHT) - Config.SWORD_HEIGHT - (8 * Config.BLOCK_HEIGHT); // Place slightly higher
    spawnItem(
        Config.CANVAS_WIDTH / 2 - Config.SWORD_WIDTH / 2,
        startY,
        'sword' // Spawn using the type string
    );
    // console.log("Item Manager initialized.");
}

/**
 * Spawns a new item in the world based on its type string.
 * Looks up configuration (size, color) from ITEM_CONFIG.
 * @param {number} x - Initial X position (pixels).
 * @param {number} y - Initial Y position (pixels).
 * @param {string} type - The type identifier string (e.g., 'sword', 'wood').
 */
export function spawnItem(x, y, type) {
    // Validate type and find configuration
    const itemConfig = ITEM_CONFIG[type];

    if (!itemConfig) {
        console.warn(`ItemManager: Attempted to spawn unknown item type "${type}". Spawning skipped.`);
        return; // Don't spawn if type is unknown
    }

    // Make sure initial coordinates are numbers
    const spawnX = typeof x === 'number' && !isNaN(x) ? x : Config.CANVAS_WIDTH / 2; // Default fallback position
    const spawnY = typeof y === 'number' && !isNaN(y) ? y : 50;

    // Create the new item instance using the resolved configuration
    const newItem = new Item(spawnX, spawnY, type, itemConfig);

    if (newItem) {
        items.push(newItem);
        // console.log(`Spawned item: ${type} at ${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}`);
    }
     // No else needed here because we check itemConfig at the start
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