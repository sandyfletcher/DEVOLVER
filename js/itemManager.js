// -----------------------------------------------------------------------------
// itemManager.js - Manages Items in the World
// -----------------------------------------------------------------------------
console.log("itemManager.js loaded");

import * as Config from './config.js';
import * as World from './world.js'; // Need getSurfaceY

// --- Internal Item Class ---
class Item {
    constructor(x, y, type, width, height, color) {
        this.x = x;
        this.y = y;
        this.type = type; // e.g., 'sword', 'wood', 'stone'
        this.width = width;
        this.height = height;
        this.color = color;

        this.vy = 0;
        this.isOnGround = false;
        this.bobbleOffset = Math.random() * Math.PI * 2; // Random start for bobble
    }

    update(dt, getSurfaceY) {
        // --- Physics ---
        if (!this.isOnGround) {
            this.vy += Config.ITEM_GRAVITY;
            this.y += this.vy;

            // --- Ground Collision ---
            const surfaceY = getSurfaceY(this.x + this.width / 2); // Check below center
            if (this.y + this.height >= surfaceY) {
                this.y = surfaceY - this.height;
                this.vy = 0;
                this.isOnGround = true;
            }
        } else {
             // Simple bobbing effect when on ground
             this.bobbleOffset += Config.ITEM_BOBBLE_SPEED;
             // We calculate the bob in the draw method based on offset
        }

        // Optional: World bounds check (prevent falling out)
        if (this.y > Config.CANVAS_HEIGHT + 100) {
            // Mark for removal? Or just reset? For now, let it fall.
            // In a real game, might despawn it.
        }
    }

    draw(ctx) {
        let drawY = this.y;
        if (this.isOnGround) {
            // Apply bobbing using sine wave
             drawY += Math.sin(this.bobbleOffset) * Config.ITEM_BOBBLE_AMOUNT * this.height;
        }

        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, drawY, this.width, this.height);

        // Could add fancier drawing based on type later
    }
}


// --- Module State ---
let items = []; // Array to hold all Item instances

// --- Public Functions ---

/**
 * Initializes the item manager.
 */
export function init() {
    items = [];
    // Spawn the initial sword for testing
    spawnItem(Config.HILL_CENTER_X - Config.SWORD_WIDTH / 2, 50, 'sword'); // Start near top-center
    console.log("Item Manager initialized.");
}

/**
 * Spawns a new item in the world.
 * @param {number} x - Initial X position.
 * @param {number} y - Initial Y position.
 * @param {string} type - The type of item (e.g., 'sword').
 */
export function spawnItem(x, y, type) {
    // Add more item types later
    if (type === 'sword') {
        const newItem = new Item(x, y, type, Config.SWORD_WIDTH, Config.SWORD_HEIGHT, Config.SWORD_COLOR);
        items.push(newItem);
    } else {
        console.warn(`Attempted to spawn unknown item type: ${type}`);
    }
}

/**
 * Updates all active items (physics, state).
 * @param {number} dt - Delta time.
 * @param {function} getSurfaceY - Function to get terrain height.
 */
export function update(dt, getSurfaceY) {
    items.forEach(item => {
        item.update(dt, getSurfaceY);
        // Add logic here later for item despawning if needed
    });
}

/**
 * Draws all active items.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 */
export function draw(ctx) {
    items.forEach(item => {
        item.draw(ctx);
    });
}

/**
 * Returns the array of active items.
 * @returns {Item[]} The array of item instances.
 */
export function getItems() {
    return items;
}

/**
 * Removes a specific item instance from the manager.
 * @param {Item} itemToRemove - The specific item instance to remove.
 */
export function removeItem(itemToRemove) {
    items = items.filter(item => item !== itemToRemove);
    // console.log("Removed item:", itemToRemove.type);
}