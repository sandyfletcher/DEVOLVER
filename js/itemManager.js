// -----------------------------------------------------------------------------
// itemManager.js - Manages Items in the World
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js'; // Make sure this is imported

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
        this.isInWater = false; // Initialize water state flag
    }

// --- Physics and state ---

// Updates the item's physics and state using grid collision
    update(dt) {
        if (!this.isActive) return;
        this.isInWater = GridCollision.isEntityInWater(this); // Detect water status first
// --- Get Current Physics Params ---
        const currentGravity = this.isInWater ? Config.GRAVITY_ACCELERATION * Config.WATER_GRAVITY_FACTOR : Config.GRAVITY_ACCELERATION;
        const horizontalDampingFactor = this.isInWater ? Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt) : 1;
        const verticalDampingFactor = this.isInWater ? Math.pow(Config.WATER_VERTICAL_DAMPING, dt) : 1;
// --- Apply Horizontal Damping (if item ever gets vx) ---
        if (this.isInWater && Math.abs(this.vx) > 0.1) {
            this.vx *= horizontalDampingFactor;
            if (Math.abs(this.vx) < 1) this.vx = 0;
        }
// --- Physics Step 1: Apply Gravity & Handle Bobbing ---
        if (!this.isOnGround) {
// Apply potentially reduced gravity if not on ground
            this.vy += currentGravity * dt;
        } else {
// On ground logic: reset vy and handle bobbing
            if (this.vy > 0) this.vy = 0;
// Only bob if NOT in water
            if (!this.isInWater) {
                this.bobbleOffset += this.bobbleSpeed * dt;
            } else {
// Optionally reset or freeze bobble offset if you want it static in water
                 // this.bobbleOffset = 0; // Freeze bobble
            }
        }

// --- Apply Vertical Damping & Clamp Speed ---
        if (this.isInWater) {
            this.vy *= verticalDampingFactor;
            this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED); // Clamp sink speed
        } else {
             // Clamp fall speed in air
             this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED);
        }

// --- Calculate Potential Movement ---
        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;

// --- Physics Step 2: Grid Collision Detection & Resolution ---
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround;

// Zero out velocity if collision occurred
        if (collisionResult.collidedX) this.vx = 0;
        if (collisionResult.collidedY) {
            if (Math.abs(this.vy) > 0.1) {
                this.vy = 0;
            }
         }

// --- Despawn/Remove if falls out of world ---
        if (this.y > Config.CANVAS_HEIGHT + 100) {
             this.isActive = false;
        }
    }

    draw(ctx) {
        if (!this.isActive || !ctx) return;
        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Item DRAW ERROR: NaN coordinates! type: ${this.type}`);
             return;
        }

        let drawY = this.y;
// Apply bobble effect only when on ground AND not in water
        if (this.isOnGround && !this.isInWater) {
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
export function init() {
    items = [];
    const startY = (Config.WORLD_GROUND_LEVEL_MEAN * Config.BLOCK_HEIGHT) - Config.SWORD_HEIGHT - (8 * Config.BLOCK_HEIGHT);
    const startY2 = startY - Config.BLOCK_HEIGHT * 5;
    const startY3 = startY - Config.BLOCK_HEIGHT * 10; // Adjust Y for shovel spawn
    spawnItem(Config.CANVAS_WIDTH * 0.4 - Config.SWORD_WIDTH / 2, startY, Config.WEAPON_TYPE_SWORD);
    spawnItem(Config.CANVAS_WIDTH * 0.6 - Config.SPEAR_WIDTH / 2, startY2, Config.WEAPON_TYPE_SPEAR);
    spawnItem(Config.CANVAS_WIDTH * 0.5 - Config.SHOVEL_WIDTH / 2, startY3, Config.WEAPON_TYPE_SHOVEL);
}

export function spawnItem(x, y, type) {
    const itemConfig = Config.ITEM_CONFIG[type];
    if (!itemConfig) {
        console.warn(`ItemManager: Attempted to spawn unknown item type "${type}".`);
        return;
    }
    const spawnX = typeof x === 'number' && !isNaN(x) ? x : Config.CANVAS_WIDTH / 2;
    const spawnY = typeof y === 'number' && !isNaN(y) ? y : 50;
    const newItem = new Item(spawnX, spawnY, type, itemConfig);
    if (newItem) {
        items.push(newItem);
    }
}


// Updates all active items' physics and state, removes items marked as inactive
export function update(dt) {
    // The main update loop now just calls item.update()
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.update(dt); // Item's own update handles water physics
        if (!item.isActive) {
            items.splice(i, 1);
        }
    }
}
// Draws all active items onto the canvas.
export function draw(ctx) {
    items.forEach(item => {
        item.draw(ctx); // Item's own draw method checks isActive
    });
}

// Returns the array of all current item instances
export function getItems() {
    return items;
}

// Removes a specific item instance from the manager
export function removeItem(itemToRemove) {
    items = items.filter(item => item !== itemToRemove);
}

// Clears all items outside a given radius from a center point
export function clearItemsOutsideRadius(centerX, centerY, radius) {
    const radiusSq = radius * radius; // Compare squared distances for efficiency
    const initialCount = items.length;
    items = items.filter(item => {
        if (!item || typeof item.x !== 'number' || typeof item.y !== 'number' || isNaN(item.x) || isNaN(item.y)) {
            // Remove invalid items defensively
            console.warn("ItemManager: Found invalid item data during cleanup, removing.", item);
            return false;
        }
        // Check distance from item's center to the center point
        const itemCenterX = item.x + item.width / 2;
        const itemCenterY = item.y + item.height / 2;
        const dx = itemCenterX - centerX;
        const dy = itemCenterY - centerY;
        const distSq = dx * dx + dy * dy;
        // Keep the item ONLY if its center is INSIDE or EXACTLY ON the radius boundary
        return distSq <= radiusSq;
    });
    const removedCount = initialCount - items.length;
    // console.log(`ItemManager: Cleared ${removedCount} items outside radius ${radius}.`);
}