// -----------------------------------------------------------------------------
// root/js/itemManager.js - Handles All Items (Weapons/Materials)
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as GridCollision from './utils/gridCollision.js';
import { Item } from './utils/item.js';

// -----------------------------------------------------------------------------
// --- Public Functions ---
// -----------------------------------------------------------------------------

let items = []; // array containing active item instances
export function init() {
    items = [];
    const meanGroundWorldY = Config.MEAN_GROUND_LEVEL * Config.BLOCK_HEIGHT; // get the Y coordinate of the mean ground level in world pixels
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
    // Item constructor now handles looking up its own config from WEAPON_STATS or BLOCK_PROPERTIES
    const spawnX = typeof x === 'number' && !isNaN(x) ? x : Config.CANVAS_WIDTH / 2;
    const spawnY = typeof y === 'number' && !isNaN(y) ? y : 50; // use fallback if x or y are invalid numbers
    const newItem = new Item(spawnX, spawnY, type, null); // Pass null for config, Item constructor will look it up
    if (newItem && newItem.width > 0 && newItem.height > 0) { // Basic validation after creation
        items.push(newItem);
    } else {
        console.error(`Failed to create or validate new Item instance for type "${type}". Item details:`, newItem);
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
            // console.log(`ItemManager.draw: Skipping inactive item of type ${item.type}`);
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
    // console.log(`ItemManager: Cleared ${removedCount} items outside radius ${radius}.`);
}