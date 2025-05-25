// =============================================================================
// root/js/itemManager.js - Handles Weapons / Materials
// =============================================================================

import * as Config from './utils/config.js';
import * as GridCollision from './utils/gridCollision.js';
import { Item } from './utils/item.js';
import * as DebugLogger from './utils/debugLogger.js';

let items = []; // active item instances

export function init() {
    items = [];
    const meanGroundWorldY = Config.MEAN_GROUND_LEVEL * Config.BLOCK_HEIGHT;
    const shovelStats = Config.WEAPON_STATS[Config.WEAPON_TYPE_SHOVEL]; // retrieve shovel dimensions from Config.WEAPON_STATS
    const shovelWidth = shovelStats ? shovelStats.width : Config.BLOCK_WIDTH;
    const shovelHeight = shovelStats ? shovelStats.height : Config.BLOCK_HEIGHT * 2;
    const shovelSpawnX = Config.CANVAS_WIDTH * 0.5 - shovelWidth / 2;
    const shovelSpawnY = meanGroundWorldY - shovelHeight - (15 * Config.BLOCK_HEIGHT);
    if (!Config.DEBUG_MODE) { // only spawn initial shovel if NOT in debug mode
        if (!isNaN(shovelSpawnX) && !isNaN(shovelSpawnY)) {
            spawnItem(shovelSpawnX, shovelSpawnY, Config.WEAPON_TYPE_SHOVEL);
            DebugLogger.log("ItemManager initialized. Shovel spawned (Normal Mode).");
        } else {
            DebugLogger.error("Invalid Shovel spawn coords in Normal Mode!");
        }
    } else {
        DebugLogger.log("ItemManager initialized (Debug Mode - Initial shovel spawn skipped).");
    }
}
export function spawnItem(x, y, type) {
    const spawnX = typeof x === 'number' && !isNaN(x) ? x : Config.CANVAS_WIDTH / 2;
    const spawnY = typeof y === 'number' && !isNaN(y) ? y : 50;
    const newItem = new Item(spawnX, spawnY, type, null);
    if (newItem && newItem.width > 0 && newItem.height > 0) {
        items.push(newItem);
    } else {
        DebugLogger.error(`Failed to create or validate new Item instance for type "${type}". Item details:`, newItem);
    }
}
export function update(dt, player) {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (!item) {
            DebugLogger.warn(`ItemManager.update: Found invalid item at index ${i}, removing.`);
            items.splice(i, 1);
            continue;
        }
        item.update(dt, player);
        if (!item.isActive) {
            items.splice(i, 1);
        }
    }
}
export function draw(ctx) {
    items.forEach(item => {
        if (item && item.isActive) {
            item.draw(ctx);
        } else if (item && Config.DEBUG_MODE) { // only log inactive item skipping in debug mode
            DebugLogger.log(`ItemManager.draw: Skipping inactive item of type ${item.type}`);
        }
    });
}
export function getItems() {
    return items;
}
export function clearAllItems() {
    items = [];
    DebugLogger.log("ItemManager: Cleared all items.");
}
export function removeItem(itemToRemove) {
    items = items.filter(item => item !== itemToRemove);
}
export function clearItemsOutsideRadius(centerX, centerY, radius) {
    const radiusSq = radius * radius;
    const initialCount = items.length;
    items = items.filter(item => {
        if (!item || typeof item.x !== 'number' || typeof item.y !== 'number' || isNaN(item.x) || isNaN(item.y)) {
            DebugLogger.warn("ItemManager: Found invalid item data during cleanup, removing.", item);
            return false;
        }
        const itemCenterX = item.x + item.width / 2;
        const itemCenterY = item.y + item.height / 2;
        const dx = itemCenterX - centerX;
        const dy = itemCenterY - centerY;
        const distSq = dx * dx + dy * dy;
        return distSq <= radiusSq;
    });
    const removedCount = initialCount - items.length;
    DebugLogger.log(`ItemManager: Cleared ${removedCount} items outside radius ${radius}.`);
}