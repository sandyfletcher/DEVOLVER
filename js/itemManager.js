// js/itemManager.js
// -----------------------------------------------------------------------------
// itemManager.js - Manages Items in the World
// -----------------------------------------------------------------------------
console.log("itemManager.js loaded");

import * as Config from './config.js';
// Removed direct import of World, as getSurfaceY is passed into update now.

// --- Internal Item Class ---
class Item {
    constructor(x, y, type, width, height, color) {
        this.x = x;
        this.y = y;
        this.type = type; // e.g., 'sword', 'wood', 'stone'
        this.width = width;
        this.height = height;
        this.color = color;

        this.vx = 0; // Items could have horizontal velocity from drops later
        this.vy = 0;
        this.isOnGround = false;
        this.bobbleOffset = Math.random() * Math.PI * 2; // Random start for bobble animation

        this.gravity = Config.ITEM_GRAVITY;
    }

    update(dt, getSurfaceY) {
        // --- Physics ---
        if (!this.isOnGround) {
            this.vy += this.gravity; // Apply item-specific gravity
            this.y += this.vy; // Update vertical position

            // --- Ground Collision ---
            // Check surface level below the center of the item
            const checkX = this.x + this.width / 2;
            const surfaceY = getSurfaceY(checkX);

            if (this.y + this.height >= surfaceY) {
                 // Simple snap, similar to player/enemy
                 const prevFeetY = (this.y - this.vy) + this.height;
                 if (prevFeetY <= surfaceY + 1) { // Check if we were above last frame
                    this.y = surfaceY - this.height; // Snap feet to surface
                    this.vy = 0; // Stop vertical movement
                    this.isOnGround = true;
                 }
                 // Safety snap if somehow embedded
                 else if (this.y + this.height > surfaceY + this.height / 2) {
                    this.y = surfaceY - this.height;
                    this.vy = 0;
                    this.isOnGround = true;
                 }
            }
        } else {
             // Simple bobbing effect when on ground
             this.bobbleOffset += Config.ITEM_BOBBLE_SPEED; // Increase phase angle
             // Calculation happens in draw()
        }

        // Optional: Add horizontal movement decay/friction if vx is used later
        // this.vx *= 0.95; // Example friction
        // this.x += this.vx;

        // Optional: World bounds check (prevent falling out, although they should hit ground)
        if (this.y > Config.CANVAS_HEIGHT + 100) {
            // Mark for removal? Or just let it fall?
            // For now, let it fall. Could be removed by manager later if needed.
            // console.log(`Item ${this.type} fell out of bounds.`);
        }
    }

    draw(ctx) {
        let drawY = this.y;
        if (this.isOnGround) {
            // Apply bobbing using sine wave, based on the offset calculated in update
             drawY += Math.sin(this.bobbleOffset) * Config.ITEM_BOBBLE_AMOUNT * this.height;
        }

        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, drawY, this.width, this.height);

        // Could add fancier drawing based on type later (e.g., simple sprites)
    }

    // Getter for collision box
    getRect() {
        return {
            x: this.x,
            y: this.y, // Use actual position for collision, not bobbing position
            width: this.width,
            height: this.height
        };
    }
}


// --- Module State ---
let items = []; // Array to hold all active Item instances

// --- Public Functions ---

/**
 * Initializes the item manager. Spawns initial items if needed.
 */
export function init() {
    items = [];
    // Spawn the initial sword for testing
    spawnItem(
        Config.HILL_CENTER_X - Config.SWORD_WIDTH / 2, // Center horizontally
        50,                                            // Start high up
        'sword'
    );
    console.log("Item Manager initialized.");
}

/**
 * Spawns a new item in the world based on its type.
 * @param {number} x - Initial X position.
 * @param {number} y - Initial Y position.
 * @param {string} type - The type of item (e.g., 'sword', 'wood').
 */
export function spawnItem(x, y, type) {
    let newItem = null;

    if (type === 'sword') {
        newItem = new Item(
            x, y, type,
            Config.SWORD_WIDTH,
            Config.SWORD_HEIGHT,
            Config.SWORD_COLOR
        );
    }
    // --- HANDLE WOOD ITEM SPAWNING ---
    else if (type === Config.ENEMY_DROP_TYPE) { // Use config constant 'wood'
         newItem = new Item(
             x, y, type,
             Config.WOOD_ITEM_WIDTH,
             Config.WOOD_ITEM_HEIGHT,
             Config.WOOD_ITEM_COLOR
         );
    }
    // --- Add 'else if' for other future item types (stone, etc.) ---
    // else if (type === 'stone') {
    //     newItem = new Item(x, y, type, Config.STONE_ITEM_WIDTH, ...);
    // }


    // Add the newly created item to the list if it's valid
    if (newItem) {
        items.push(newItem);
        // console.log(`Spawned item: ${type} at (${x.toFixed(1)}, ${y.toFixed(1)})`); // Optional logging
    } else {
        console.warn(`Attempted to spawn unknown or unhandled item type: ${type}`);
    }
}

/**
 * Updates all active items (physics, state).
 * @param {number} dt - Delta time.
 * @param {function} getSurfaceY - Function to get terrain height (passed from main loop).
 */
export function update(dt, getSurfaceY) {
    // Update all items. Could optimize later if many items exist.
    items.forEach(item => {
        item.update(dt, getSurfaceY);
        // Add logic here later for item despawning after a certain time?
        // item.lifetime -= dt; if (item.lifetime <= 0) removeItem(item);
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
 * Returns the array of active items (for collision checks, etc.).
 * @returns {Item[]} The array of item instances.
 */
export function getItems() {
    return items;
}

/**
 * Removes a specific item instance from the manager.
 * Usually called after the player picks it up.
 * @param {Item} itemToRemove - The specific item instance to remove.
 */
export function removeItem(itemToRemove) {
    // Filter out the item to remove, creating a new array
    items = items.filter(item => item !== itemToRemove);
    // console.log(`Removed item: ${itemToRemove.type}`); // Optional logging
}

// --- Future functions ---
// function removeItemsInRect(rect) { ... }
// function getNearestItem(pos, type) { ... }