// -----------------------------------------------------------------------------
// root/js/itemManager.js - Handles All Items (Weapons/Materials)
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js';

class Item {
    constructor(x, y, type, config) { // pass config in
        this.x = x;
        this.y = y;
        this.type = type;
        const itemConfig = Config.ITEM_CONFIG[this.type] || {};
        this.width = itemConfig.width ?? Math.floor(Config.BLOCK_WIDTH);
        this.height = itemConfig.height ?? Math.floor(Config.BLOCK_HEIGHT);
        this.color = itemConfig.color ?? 'magenta';
        this.bobbleAmount = itemConfig.bobbleAmount ?? Config.ITEM_BOBBLE_AMOUNT;
        this.bobbleSpeed = itemConfig.bobbleSpeed ?? Config.ITEM_BOBBLE_SPEED;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.bobbleOffset = Math.random() * Math.PI * 2;
        this.isActive = true;
        this.isInWater = false;
        this.isAttracted = false; // flag set when player nearby enough
    }
    update(dt, player) {
        if (!this.isActive) return;
        if (typeof dt !== 'number' || isNaN(dt) || dt < 0) {
            console.warn("Item Update: Invalid delta time.", dt);
            return;
        }
        this.isInWater = GridCollision.isEntityInWater(this); // flag water status as it affects physics
        this.isAttracted = false; // flag attraction status - same reason
        let dx = 0, dy = 0; // store direction vector
        let distSq = Infinity; // store squared distance
        if (player && player.getCurrentHealth() > 0) { // only calculate attraction if player alive
            const playerRect = player.getRect();
            const itemCenterX = this.x + this.width / 2;
            const itemCenterY = this.y + this.height / 2;
            const playerCenterX = playerRect.x + playerRect.width / 2;
            const playerCenterY = playerRect.y + playerRect.height / 2;
            dx = playerCenterX - itemCenterX; // vector from item to player
            dy = playerCenterY - itemCenterY;
            distSq = dx * dx + dy * dy; // squared distance
            const attractRadiusSq = Config.PLAYER_ITEM_ATTRACT_RADIUS_SQ; // use parameters set in config
            const pickupRangeSq = Config.PLAYER_INTERACTION_RANGE_SQ;
            if (distSq < attractRadiusSq && distSq > pickupRangeSq + GridCollision.E_EPSILON) { // attract if within radius but outside immediate pickup range
                this.isAttracted = true;
            } else if (distSq <= pickupRangeSq + GridCollision.E_EPSILON) {
                this.isAttracted = false; // stop attraction inside pickup range
            }
        }
        if (this.isAttracted) { // physics IF ATTRACTED (phase through solids)
            this.isOnGround = false; // not considered on ground when phasing
            const dist = Math.sqrt(distSq); // dist, dx, dy already calculated above
            if (dist > GridCollision.E_EPSILON) { // avoid division by zero
                const normX = dx / dist; // normalized vector towards player
                const normY = dy / dist;
                this.vx = normX * Config.PLAYER_ITEM_ATTRACT_SPEED; // set velocity directly towards player with fixed speed
                this.vy = normY * Config.PLAYER_ITEM_ATTRACT_SPEED;
            } else {
                this.vx = 0; // if distance is tiny, snap velocity to zero
                this.vy = 0;
            }
            this.x += this.vx * dt; // apply movement based on the velocity set above
            this.y += this.vy * dt;
        } else { // STANDARD physics (collide with solids)
            const effectiveGravity = Config.GRAVITY_ACCELERATION * (this.isInWater ? Config.WATER_GRAVITY_FACTOR : 1.0); // apply gravity if NOT on ground
            if (!this.isOnGround) { // only apply gravity if not on ground from previous step
                this.vy += effectiveGravity * dt; // add gravity acceleration
            } else {
                if (this.vy > 0.1) this.vy = 0; // if player is on ground but has slight downward velocity, reset it
            }
            if (this.isInWater) { // apply standard water damping if in water AND not attracted
                const horizontalDampingFactor = Math.pow(Config.WATER_HORIZONTAL_Damping, dt);
                const verticalDampingFactor = Math.pow(Config.WATER_VERTICAL_Damping, dt);
                this.vx *= horizontalDampingFactor;
                this.vy *= verticalDampingFactor;
            }
            if (this.isInWater) { // apply standard speed clamping (air fall, water sink/swim limits)
                this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED);
                this.vy = Math.max(this.vy, -Config.WATER_MAX_SWIM_UP_SPEED);
            } else {
                this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED); // clamp fall speed in air
            }
            const potentialMoveX = this.vx * dt; // calculate potential movement after applying physics and clamping
            const potentialMoveY = this.vy * dt;
            const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY); // resolve collision with grid - update this.x and this.y
            this.isOnGround = collisionResult.isOnGround; // update ground status from collision result
            if (collisionResult.collidedX) {
                this.vx = 0; // zero out velocity component if collideAndResolve indicated a collision
            }
            if (collisionResult.collidedY) {
                if (Math.abs(this.vy) > 0.1) {
                    this.vy = 0; // zero vertical velocity after collision if significant
                }
            }
        }
        if (!this.isAttracted) { // snap small velocities to zero when not attracted to prevent jittering
            if (Math.abs(this.vx) < GridCollision.E_EPSILON) this.vx = 0;
            if (Math.abs(this.vy) < GridCollision.E_EPSILON) this.vy = 0;
        }
        if (this.y > Config.CANVAS_HEIGHT + 100 || this.x < -200 || this.x > Config.CANVAS_WIDTH + 200) {
            this.isActive = false; //  despawn if out of world boundaries
        }
    }
    draw(ctx) {
        if (!this.isActive || !ctx) return;
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Item DRAW ERROR: NaN coordinates! type: ${this.type}`);
            return;
        }
        let drawY = this.y;
        if (this.isOnGround && !this.isInWater && !this.isAttracted) { // only bobble when on ground, not in water, not attracted
            this.bobbleOffset = (this.bobbleOffset + this.bobbleSpeed * (1/60)) % (Math.PI * 2); // bobbleSpeed is time-based
            drawY += Math.sin(this.bobbleOffset) * this.bobbleAmount * this.height;
        } else if (this.isAttracted) {
            const attractedBobbleSpeed = this.bobbleSpeed * 3; // apply a faster, smaller bobble when attracted for visual flair
            const attractedBobbleAmount = this.bobbleAmount * 0.5;
            this.bobbleOffset = (this.bobbleOffset + attractedBobbleSpeed * (1/60)) % (Math.PI * 2);
            drawY += Math.sin(this.bobbleOffset) * attractedBobbleAmount * this.height;
        }
        ctx.fillStyle = this.color;
        ctx.fillRect(Math.floor(this.x), Math.floor(drawY), this.width, this.height);
    }
    getRect() {
        const safeX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
        const safeY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
        return {
            x: safeX,
            y: safeY, // use non-bobbing Y for collision logic (even though collision is skipped when attracted)
            width: this.width,
            height: this.height
        };
    }
}

// -----------------------------------------------------------------------------
// --- Public Functions ---
// -----------------------------------------------------------------------------

let items = []; // array containing active item instances
export function init() {
    items = [];
    const meanGroundWorldY = Config.WORLD_GROUND_LEVEL_MEAN_ROW * Config.BLOCK_HEIGHT; // get the Y coordinate of the mean ground level in world pixels
    const shovelSpawnX = Config.CANVAS_WIDTH * 0.5 - Config.SHOVEL_WIDTH / 2; // spawn shovel at center
    const shovelSpawnY = meanGroundWorldY - Config.SHOVEL_HEIGHT - (15 * Config.BLOCK_HEIGHT); // TODO: calibrate to portal - currently 15 blocks above mean ground
    if (!isNaN(shovelSpawnX) && !isNaN(shovelSpawnY)) { // ensure spawn points are valid numbers after calculation
        spawnItem(shovelSpawnX, shovelSpawnY, Config.WEAPON_TYPE_SHOVEL);
    } else {
        console.error("Invalid Shovel spawn coords!");
    }
    console.log("ItemManager initialized. Shovel spawned.");
}
export function spawnItem(x, y, type) {
    const itemConfig = Config.ITEM_CONFIG[type];
    if (!itemConfig) {
        console.warn(`ItemManager: Attempted to spawn item type "${type}" with no config.`);
        const newItem = new Item(x, y, type, null); // create with default fallback
        if (newItem) items.push(newItem);
        else console.error(`Failed to create new Item instance for unknown type "${type}".`);
        return;
    }
    const spawnX = typeof x === 'number' && !isNaN(x) ? x : Config.CANVAS_WIDTH / 2;
    const spawnY = typeof y === 'number' && !isNaN(y) ? y : 50; // use fallback if x or y are invalid numbers
    const newItem = new Item(spawnX, spawnY, type, itemConfig);
    if (newItem) {
        items.push(newItem);
    } else {
        console.error(`Failed to create new Item instance for type "${type}".`);
    }
}
export function update(dt, player) {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (!item) { // check for null/undefined item
            console.warn(`ItemManager.update: Found invalid item at index ${i}, removing.`);
            items.splice(i, 1);
            continue; // skip to next item
        }
        item.update(dt, player);
        if (!item.isActive) {
            items.splice(i, 1);
        }
    }
}
export function draw(ctx) {
    items.forEach(item => {
        if(item && item.isActive){ // defensive check before drawing

            item.draw(ctx);
        } else if (item) {
            console.log(`ItemManager.draw: Skipping inactive item of type ${item.type}`);
        }
    });
}
export function getItems() {
    return items;
}
export function clearAllItems() { // remove all items from manager
    items = []; // re-initialize internal array
    console.log("ItemManager: Cleared all items.");
}
export function removeItem(itemToRemove) {
    items = items.filter(item => item !== itemToRemove);
}
export function clearItemsOutsideRadius(centerX, centerY, radius) {
    const radiusSq = radius * radius; // compare squared distances
    const initialCount = items.length;
    items = items.filter(item => {
        if (!item || typeof item.x !== 'number' || typeof item.y !== 'number' || isNaN(item.x) || isNaN(item.y)) {
            console.warn("ItemManager: Found invalid item data during cleanup, removing.", item);
            return false;
        }
        const itemCenterX = item.x + item.width / 2; // check distance from item center to center point
        const itemCenterY = item.y + item.height / 2;
        const dx = itemCenterX - centerX;
        const dy = itemCenterY - centerY;
        const distSq = dx * dx + dy * dy;
        return distSq <= radiusSq; // keep item only if its center is inside or on radius boundary
    });
    const removedCount = initialCount - items.length;
    console.log(`ItemManager: Cleared ${removedCount} items outside radius ${radius}.`);
}