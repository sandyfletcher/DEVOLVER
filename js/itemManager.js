// root/js/itemManager.js - Manages Items in the World

import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js';
import * as WorldData from './utils/worldData.js';

// --- Internal Item Class ---
class Item {
    constructor(x, y, type, config) { // pass config in
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = config?.width ?? Math.floor(Config.BLOCK_WIDTH);
        this.height = config?.height ?? Math.floor(Config.BLOCK_HEIGHT);
        this.color = config?.color ?? 'magenta';
        this.bobbleAmount = config?.bobbleAmount ?? Config.ITEM_BOBBLE_AMOUNT;
        this.bobbleSpeed = config?.bobbleSpeed ?? Config.ITEM_BOBBLE_SPEED;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.bobbleOffset = Math.random() * Math.PI * 2;
        this.isActive = true;
        this.isInWater = false;
        this.isAttracted = false;
    }
    update(dt, player) {
        if (!this.isActive) return;
        if (typeof dt !== 'number' || isNaN(dt) || dt < 0) return; // dt validation
        this.isInWater = GridCollision.isEntityInWater(this); // detect water status first
        this.isAttracted = false;
        if (player && player.getCurrentHealth() > 0) { // only attract if player is alive
            const playerRect = player.getRect();
            const itemCenterX = this.x + this.width / 2;
            const itemCenterY = this.y + this.height / 2;
            const playerCenterX = playerRect.x + playerRect.width / 2;
            const playerCenterY = playerRect.y + playerRect.height / 2;
            const dx = playerCenterX - itemCenterX;
            const dy = playerCenterY - itemCenterY;
            const distSq = dx * dx + dy * dy; // squared distance for faster comparison
            const attractRadiusSq = Config.PLAYER_ITEM_ATTRACT_RADIUS * Config.PLAYER_ITEM_ATTRACT_RADIUS;
            const pickupRangeSq = Config.PLAYER_INTERACTION_RANGE_SQ; // use player pickup range
            if (distSq < attractRadiusSq && distSq > pickupRangeSq) { // attract if within radius
                this.isAttracted = true;
                const dist = Math.sqrt(distSq);
                const normX = dx / dist; // normalize direction vector
                const normY = dy / dist;
                this.vx += normX * Config.PLAYER_ITEM_ATTRACT_STRENGTH * dt; // apply acceleration force from attraction
                this.vy += normY * Config.PLAYER_ITEM_ATTRACT_STRENGTH * dt;
                this.vx *= Math.pow(0.8, dt); // apply stronger friction while attracted to feel less floaty once attracted
                this.vy *= Math.pow(0.8, dt);
            }
        }
        // --- Get Current Physics Params ---
        const currentGravity = this.isInWater ? Config.GRAVITY_ACCELERATION * Config.WATER_GRAVITY_FACTOR : Config.GRAVITY_ACCELERATION;
        const horizontalDampingFactor = this.isInWater ? Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt) : 1;
        const verticalDampingFactor = this.isInWater ? Math.pow(Config.WATER_VERTICAL_DAMPING, dt) : 1;
        // --- Apply Horizontal Damping (if item ever gets vx) ---
        if (this.isInWater && Math.abs(this.vx) > GridCollision.E_EPSILON) { // EPSILON here for small velocities
            this.vx *= horizontalDampingFactor;
            if (Math.abs(this.vx) < GridCollision.E_EPSILON) this.vx = 0;
        }
        // --- Physics Step 1: Apply Gravity ---
        if (!this.isOnGround) {
             this.vy += currentGravity * dt;
        } else {
             // On ground logic: reset vy
            if (this.vy > GridCollision.E_EPSILON) this.vy = 0;
        }
        // --- Apply Vertical Damping & Clamp Speed ---
        if (this.isInWater) {
            this.vy *= verticalDampingFactor;
            this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED); // Clamp sink speed
            this.vy = Math.max(this.vy, -Config.WATER_MAX_SWIM_UP_SPEED); // Clamp upwards speed in water
        } else {
             // Clamp fall speed in air
             this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED);
        }
        // --- Calculate Potential Movement ---
        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;
        // --- Physics Step 2: Grid Collision Detection & Resolution ---
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround; // Update ground status based on collision resolution
        // Zero out velocity if collision occurred (unless step up, but items don't step up)
        if (collisionResult.collidedX) this.vx = 0;
        if (collisionResult.collidedY) {
            // Use a small threshold (could be E_EPSILON or a slightly larger value like 0.1)
             if (Math.abs(this.vy) > 0.1) { // Keeping 0.1 seems fine for this check
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
        if (this.isOnGround && !this.isInWater) { // Apply bobble effect only when on ground AND not in water
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
// --- Public Functions ---
let items = []; // Array containing active Item instances
export function init() {
    items = [];
    // Get the Y coordinate of the mean ground level in world pixels
    const meanGroundWorldY = Config.WORLD_GROUND_LEVEL_MEAN * Config.BLOCK_HEIGHT;
    // Calculate spawn positions relative to the mean ground, adjusting for item height
    const swordSpawnX = Config.CANVAS_WIDTH * 0.4 - Config.SWORD_WIDTH / 2; // Spawn Sword slightly to the left of center
    const swordSpawnY = meanGroundWorldY - Config.SWORD_HEIGHT - (5 * Config.BLOCK_HEIGHT); // Example: 5 blocks above mean ground
    const spearSpawnX = Config.CANVAS_WIDTH * 0.6 - Config.SPEAR_WIDTH / 2; // Spawn Spear slightly to the right of center, higher up
    const spearSpawnY = meanGroundWorldY - Config.SPEAR_HEIGHT - (10 * Config.BLOCK_HEIGHT); // Example: 10 blocks above mean ground
    const shovelSpawnX = Config.CANVAS_WIDTH * 0.5 - Config.SHOVEL_WIDTH / 2; // Spawn Shovel at center, even higher up
    const shovelSpawnY = meanGroundWorldY - Config.SHOVEL_HEIGHT - (15 * Config.BLOCK_HEIGHT); // Example: 15 blocks above mean ground
    spawnItem(swordSpawnX, swordSpawnY, Config.WEAPON_TYPE_SWORD);
    spawnItem(spearSpawnX, spearSpawnY, Config.WEAPON_TYPE_SPEAR);
    spawnItem(shovelSpawnX, shovelSpawnY, Config.WEAPON_TYPE_SHOVEL);
}
// --- Spawn a new item ---
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
export function update(dt, player) { 
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.update(dt, player);
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
    const radiusSq = radius * radius; // compare squared distances for efficiency
    const initialCount = items.length;
    items = items.filter(item => {
        if (!item || typeof item.x !== 'number' || typeof item.y !== 'number' || isNaN(item.x) || isNaN(item.y)) { // Remove invalid items defensively
            console.warn("ItemManager: Found invalid item data during cleanup, removing.", item);
            return false;
        }
        const itemCenterX = item.x + item.width / 2; // Check distance from item's center to the center point
        const itemCenterY = item.y + item.height / 2;
        const dx = itemCenterX - centerX;
        const dy = itemCenterY - centerY;
        const distSq = dx * dx + dy * dy;
        return distSq <= radiusSq; // Keep the item ONLY if its center is INSIDE or EXACTLY ON the radius boundary
    });
    const removedCount = initialCount - items.length;
    // console.log(`ItemManager: Cleared ${removedCount} items outside radius ${radius}.`);
}