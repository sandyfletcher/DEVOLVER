// root/js/itemManager.js - Manages Items in the World

import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js';

// --- Internal Item Class ---
class Item {
    constructor(x, y, type, config) { // pass config in
        this.x = x;
        this.y = y;
        this.type = type;
        // Dimensions are defined in blocks in config, scale them here to pixels
        const itemConfig = Config.ITEM_CONFIG[this.type] || {}; // Get item config, handle if type is unknown
        this.width = itemConfig.width ?? Math.floor(Config.BLOCK_WIDTH);
        this.height = itemConfig.height ?? Math.floor(Config.BLOCK_HEIGHT);

        this.color = itemConfig.color ?? 'magenta';
        this.bobbleAmount = itemConfig.bobbleAmount ?? Config.ITEM_BOBBLE_AMOUNT; // Relative factor, no pixel scaling needed here
        this.bobbleSpeed = itemConfig.bobbleSpeed ?? Config.ITEM_BOBBLE_SPEED; // Time-based, no scaling needed here

        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.bobbleOffset = Math.random() * Math.PI * 2;
        this.isActive = true;
        this.isInWater = false;
        this.isAttracted = false; // Flag set when player is nearby enough
    }

    update(dt, player) {
        if (!this.isActive) return;
        if (typeof dt !== 'number' || isNaN(dt) || dt < 0) {
            console.warn("Item Update: Invalid delta time.", dt);
            return;
        }

        // --- Environment State ---
        // Check water status first as it affects physics params
        this.isInWater = GridCollision.isEntityInWater(this); // isEntityInWater handles scaling implicitly

        // --- Check for Player Attraction ---
        // Reset attraction flag and assume no attraction until checks pass below
        this.isAttracted = false;
        let dx = 0, dy = 0; // Variables to store direction vector
        let distSq = Infinity; // Store squared distance

        if (player && player.getCurrentHealth() > 0) { // only calculate attraction if player is alive
            const playerRect = player.getRect();
            const itemCenterX = this.x + this.width / 2;
            const itemCenterY = this.y + this.height / 2;
            const playerCenterX = playerRect.x + playerRect.width / 2;
            const playerCenterY = playerRect.y + playerRect.height / 2;

            dx = playerCenterX - itemCenterX; // Vector FROM item TO player
            dy = playerCenterY - itemCenterY; // Vector FROM item TO player
            distSq = dx * dx + dy * dy; // squared distance

            // Use scaled attraction radius and pickup range from config
            const attractRadiusSq = Config.PLAYER_ITEM_ATTRACT_RADIUS_SQ; // Using the pre-calculated squared value
            const pickupRangeSq = Config.PLAYER_INTERACTION_RANGE_SQ; // Using the pre-calculated squared value

            // Attract if within radius but outside immediate pickup range
            // Use a small epsilon for distance comparison to avoid floating point issues near the boundary
             if (distSq < attractRadiusSq && distSq > pickupRangeSq + GridCollision.E_EPSILON) {
                 this.isAttracted = true;
             } else if (distSq <= pickupRangeSq + GridCollision.E_EPSILON) {
                 // If item is very close or inside pickup range, stop attraction movement
                 // The collision check in CollisionManager will handle actual pickup.
                 this.isAttracted = false; // Stop physics movement once very close
             }
        }

        // --- PHYSICS MODES: Attracted (Phase through blocks) vs. Standard (Collide with blocks) ---

        if (this.isAttracted) {
            // --- Attracted Physics (Phasing) ---
            this.isOnGround = false; // Not considered on ground when phasing
            const dist = Math.sqrt(distSq); // dist, dx, dy already calculated above

            if (dist > GridCollision.E_EPSILON) { // Avoid division by zero
                 const normX = dx / dist; // Normalized vector towards player
                 const normY = dy / dist;
                 // Set velocity directly towards the player with a fixed speed (using scaled speed from config)
                 this.vx = normX * Config.PLAYER_ITEM_ATTRACT_SPEED;
                 this.vy = normY * Config.PLAYER_ITEM_ATTRACT_SPEED;
            } else {
                // If dist is tiny, snap velocity to zero
                 this.vx = 0;
                 this.vy = 0;
            }

            // Apply movement based on the velocity set above
            this.x += this.vx * dt;
            this.y += this.vy * dt;

        } else {
            // --- Standard Physics (Collision) ---
            // Apply Gravity if NOT on ground (using scaled gravity from config)
            // GRAVITY_ACCELERATION and WATER_GRAVITY_FACTOR are scaled/defined in config
            const effectiveGravity = Config.GRAVITY_ACCELERATION * (this.isInWater ? Config.WATER_GRAVITY_FACTOR : 1.0);
            if (!this.isOnGround) { // Only apply gravity if not on ground from previous step
                 this.vy += effectiveGravity * dt; // Add gravity acceleration
            } else {
                 // If player is on ground but has slight downward velocity (e.g., from previous frame), reset it
                // Use a small threshold to avoid micro-adjustments
                if (this.vy > 0.1) this.vy = 0;
            }
            // Apply standard water damping if in water AND not attracted
            if (this.isInWater) {
                 // WATER_HORIZONTAL_DAMPING and WATER_VERTICAL_DAMPING are factors, no scaling needed
                 const horizontalDampingFactor = Math.pow(Config.WATER_HORIZONTAL_Damping, dt);
                 const verticalDampingFactor = Math.pow(Config.WATER_VERTICAL_Damping, dt);
                 this.vx *= horizontalDampingFactor;
                 this.vy *= verticalDampingFactor;
            }
            // Apply Standard Speed Clamping (Air fall, Water sink/swim limits)
            // MAX_FALL_SPEED, WATER_MAX_SINK_SPEED, WATER_MAX_SWIM_UP_SPEED are scaled in config
            if (this.isInWater) {
                 this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED);
                 this.vy = Math.max(this.vy, -Config.WATER_MAX_SWIM_UP_SPEED);
                 // Optional: Clamp horizontal speed in water if not attracted?
                 // This isn't defined in config with a specific item speed, so keep it simple for now.
            } else {
                 // Clamp fall speed in air
                 this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED);
                 // Optional: Clamp horizontal speed in air if not attracted?
             }

            // Calculate potential movement after applying standard physics and clamping
            const potentialMoveX = this.vx * dt;
            const potentialMoveY = this.vy * dt;

            // Resolve collision with grid - this updates this.x and this.y
            // GridCollision.collideAndResolve handles entity dimensions and movement amounts (both in pixels)
            const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);

            this.isOnGround = collisionResult.isOnGround; // Update ground status from collision result

            // Zero out velocity component if collideAndResolve indicated a collision
            if (collisionResult.collidedX) {
                 this.vx = 0;
                 // collideAndResolve snaps the position, so no need to do it here.
            }
            if (collisionResult.collidedY) {
                // Zero vertical velocity after collision if it was significant
                 if (Math.abs(this.vy) > 0.1) { // Use a small threshold
                     this.vy = 0;
                 }
                 // collideAndResolve snaps the position, so no need to do it here.
            }
        }
        // --- Final velocity snap-to-zero ---
        // Snap small velocities to zero to prevent jittering from float errors
        // Apply this to standard mode.
         if (!this.isAttracted) { // Only snap small velocities to zero in standard mode
              if (Math.abs(this.vx) < GridCollision.E_EPSILON) this.vx = 0;
              if (Math.abs(this.vy) < GridCollision.E_EPSILON) this.vy = 0;
         }
        // --- Despawn/Remove if falls out of world boundaries ---
        // This check should happen regardless of attraction, AFTER position update.
        // Add bounds checks for X axis as well
        if (this.y > Config.CANVAS_HEIGHT + 100 || this.x < -200 || this.x > Config.CANVAS_WIDTH + 200) {
             this.isActive = false;
        }
    }
    // draw method remains the same as the previous correction
    draw(ctx) {
        if (!this.isActive || !ctx) return;
        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Item DRAW ERROR: NaN coordinates! type: ${this.type}`);
             return;
        }
        let drawY = this.y;
        // Apply bobble effect only when on ground AND not in water AND not attracted
        // bobbleAmount is a factor relative to height (which is scaled), so visual bobbing scales
        if (this.isOnGround && !this.isInWater && !this.isAttracted) {
             // Increment offset based on time. Use a fixed time step (like 1/60) for bobble consistency
             this.bobbleOffset = (this.bobbleOffset + this.bobbleSpeed * (1/60)) % (Math.PI * 2); // bobbleSpeed is time-based
             drawY += Math.sin(this.bobbleOffset) * this.bobbleAmount * this.height;
        } else if (this.isAttracted) {
             // Optional: Apply a faster, smaller bobble when attracted for visual flair
             const attractedBobbleSpeed = this.bobbleSpeed * 3; // Time-based
             const attractedBobbleAmount = this.bobbleAmount * 0.5; // Relative factor
             this.bobbleOffset = (this.bobbleOffset + attractedBobbleSpeed * (1/60)) % (Math.PI * 2);
             drawY += Math.sin(this.bobbleOffset) * attractedBobbleAmount * this.height;
        }
        ctx.fillStyle = this.color;
        ctx.fillRect(Math.floor(this.x), Math.floor(drawY), this.width, this.height);
    }
    // getRect method remains the same
    getRect() {
         const safeX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
         const safeY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
        return {
            x: safeX,
            y: safeY, // Use non-bobbing Y for collision logic (even though collision is skipped when attracted)
            width: this.width,
            height: this.height
        };
    }
}
// --- Public Functions ---
let items = []; // Array containing active Item instances

// init function remains the same
export function init() {
    items = [];
    // Get the Y coordinate of the mean ground level in world pixels
    const meanGroundWorldY = Config.WORLD_GROUND_LEVEL_MEAN_ROW * Config.BLOCK_HEIGHT; // Use new mean row constant
    // ONLY SPAWN THE SHOVEL INITIALLY
    const shovelSpawnX = Config.CANVAS_WIDTH * 0.5 - Config.SHOVEL_WIDTH / 2; // Spawn Shovel at center, even higher up
    const shovelSpawnY = meanGroundWorldY - Config.SHOVEL_HEIGHT - (15 * Config.BLOCK_HEIGHT); // Example: 15 blocks above mean ground (pixel offset)
    // Ensure spawn points are valid numbers after calculation
    if (!isNaN(shovelSpawnX) && !isNaN(shovelSpawnY)) {
        spawnItem(shovelSpawnX, shovelSpawnY, Config.WEAPON_TYPE_SHOVEL);
    } else {
        console.error("Invalid Shovel spawn coords!");
    }
    // console.log("ItemManager initialized. Shovel spawned.");
}

export function spawnItem(x, y, type) {
    const itemConfig = Config.ITEM_CONFIG[type];
    // Allow spawning materials or the shovel, but maybe warn/prevent crafting-only items?
    // Any other spawn call for sword/spear should be reviewed if it happens.
    // Let's allow spawning any type for now, just logging a warning for craftable ones if needed.
    if (!itemConfig) {
        console.warn(`ItemManager: Attempted to spawn item type "${type}" with no config.`);
        // Decide if you return or create with defaults. Creating with defaults is safer.
        // return; // Option to fail
         const newItem = new Item(x, y, type, null); // Create with default fallback
         if (newItem) items.push(newItem);
         else console.error(`Failed to create new Item instance for unknown type "${type}".`);
         return;
    }
    // Validate and use fallback if x or y are NaN/invalid numbers
    const spawnX = typeof x === 'number' && !isNaN(x) ? x : Config.CANVAS_WIDTH / 2;
    const spawnY = typeof y === 'number' && !isNaN(y) ? y : 50;
    const newItem = new Item(spawnX, spawnY, type, itemConfig);
    if (newItem) {
        items.push(newItem);
    } else {
        console.error(`Failed to create new Item instance for type "${type}".`);
    }
}

// update function remains the same (calls item.update)
export function update(dt, player) {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (!item) { // Defensive check for null/undefined items
             console.warn(`ItemManager.update: Found invalid item at index ${i}, removing.`);
             items.splice(i, 1);
             continue; // Skip to next item
        }
        item.update(dt, player);
        if (!item.isActive) {
            items.splice(i, 1);
        }
    }
}
// draw function remains the same (calls item.draw)
export function draw(ctx) {
    items.forEach(item => {
         // Add defensive check before drawing
        if(item && item.isActive){ // Draw if active
             item.draw(ctx); // Item's own draw method checks isActive and NaN coords internally
        } else if (item) {
             console.log(`ItemManager.draw: Skipping inactive item of type ${item.type}`);
        }
    });
}
// getItems function remains the same
export function getItems() {
    return items;
}
export function clearAllItems() { // removes all items from  manager ---
    items = []; // Simply re-initialize the internal array
    console.log("ItemManager: Cleared all items."); // Optional log
}
// removeItem function remains the same
export function removeItem(itemToRemove) {
    items = items.filter(item => item !== itemToRemove);
}
// clearItemsOutsideRadius function remains the same
export function clearItemsOutsideRadius(centerX, centerY, radius) {
    const radiusSq = radius * radius; // compare squared distances for efficiency
    const initialCount = items.length;
    items = items.filter(item => {
        // Add validation here too
        if (!item || typeof item.x !== 'number' || typeof item.y !== 'number' || isNaN(item.x) || isNaN(item.y)) { // Remove invalid items defensively
            console.warn("ItemManager: Found invalid item data during cleanup, removing.", item);
            return false;
        }
        const itemCenterX = item.x + item.width / 2; // Check distance from item's center to the center point (item.width/height are scaled)
        const itemCenterY = item.y + item.height / 2;
        const dx = itemCenterX - centerX;
        const dy = itemCenterY - centerY;
        const distSq = dx * dx + dy * dy;
        return distSq <= radiusSq; // Keep the item ONLY if its center is INSIDE or EXACTLY ON the radius boundary
    });
    const removedCount = initialCount - items.length;
    // console.log(`ItemManager: Cleared ${removedCount} items outside radius ${radius}.`);
}