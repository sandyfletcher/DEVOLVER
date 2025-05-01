// -----------------------------------------------------------------------------
// root/js/collisionManager.js - Collision handling
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as WorldManager from './worldManager.js'; // Needed to damage blocks
import * as GridCollision from './utils/gridCollision.js'; // Needed for coordinate conversion

// --- Private Utility Function ---
function checkRectOverlap(rect1, rect2) {
    if (!rect1 || !rect2) {
        console.warn("Collision check skipped: Invalid rect provided.", rect1, rect2);
        return false;
    }
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// --- Exported Collision Check Functions ---
/**
 * Checks for collisions between the player and items.
 * If a collision occurs, attempts to pick up the item via player.pickupItem.
 * @param {Player} player - The player object.
 * @param {Array<Item>} items - An array of item objects.
 * @param {ItemManager} itemManager - The ItemManager instance (to remove picked up items).
 */
export function checkPlayerItemCollisions(player, items, itemManager) {
    if (!player || !items || !itemManager || player.getCurrentHealth() <= 0) return; // Add health check

    const playerRect = player.getRect();
    // Loop backwards for safe removal
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (!item || !item.isActive) continue; // Check if item is active

        const itemRect = item.getRect();
        if (checkRectOverlap(playerRect, itemRect)) {
            // Collision detected, attempt pickup
            const pickedUp = player.pickupItem(item); // Player logic decides if pickup happens
            if (pickedUp) {
                // console.log(`CollisionManager: Player picked up ${item.type}`);
                itemManager.removeItem(item); // Tell ItemManager to remove the instance
            }
        }
    }
}

/**
 * Checks for collisions between the player's attack hitbox and enemies.
 * If a collision occurs, damages the enemy using PLAYER_ATTACK_DAMAGE.
 * @param {Player} player - The player object.
 * @param {Array<Enemy>} enemies - An array of active enemy objects.
 */
export function checkPlayerAttackEnemyCollisions(player, enemies) {
       // Check if player is alive, attacking, and capable of damaging enemies
       const currentEnemyDamage = player.getCurrentAttackDamage(); // Damage vs enemies
       if (!player || !enemies || !player.isAttacking || player.getCurrentHealth() <= 0 || currentEnemyDamage <= 0) {
           return; // Exit if not attacking, dead, or weapon does 0 enemy damage
       }
    const attackHitbox = player.getAttackHitbox();
    if (!attackHitbox) return;

    for (const enemy of enemies) {
        if (!enemy || !enemy.isActive) continue;

        if (checkRectOverlap(attackHitbox, enemy.getRect())) {
            if (!player.hasHitEnemyThisSwing(enemy)) {
                               // Use the enemy-specific damage amount
                               enemy.takeDamage(currentEnemyDamage);
                player.registerHitEnemy(enemy);
            }
        }
    }
}

/**
 * Checks for collisions between the player's attack hitbox and world blocks.
 * If a collision occurs and the equipped weapon can damage blocks (e.g., Shovel),
 * damages the block(s) using the weapon's specific block damage value.
 * @param {Player} player - The player object.
 */
export function checkPlayerAttackBlockCollisions(player) {
    // Check if player is alive, attacking, and capable of damaging blocks
    const currentBlockDamage = player.getCurrentBlockDamage(); // Damage vs blocks
    if (!player || !player.isAttacking || player.getCurrentHealth() <= 0 || currentBlockDamage <= 0) {
        return; // Exit if not attacking, dead, or weapon does 0 block damage (e.g., sword/spear)
    }

    const attackHitbox = player.getAttackHitbox();
    if (!attackHitbox) return;

    // Determine the range of grid cells overlapped by the hitbox
    const minCol = Math.max(0, Math.floor(attackHitbox.x / Config.BLOCK_WIDTH));
    const maxCol = Math.min(Config.GRID_COLS - 1, Math.floor((attackHitbox.x + attackHitbox.width) / Config.BLOCK_WIDTH));
    const minRow = Math.max(0, Math.floor(attackHitbox.y / Config.BLOCK_HEIGHT));
    const maxRow = Math.min(Config.GRID_ROWS - 1, Math.floor((attackHitbox.y + attackHitbox.height) / Config.BLOCK_HEIGHT));

    // Iterate through the overlapped grid cells
    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            // Avoid hitting the same block multiple times in one swing
            if (!player.hasHitBlockThisSwing(c, r)) {
                // Attempt to damage the block using WorldManager
                const damaged = WorldManager.damageBlock(c, r, currentBlockDamage);
                if (damaged) {
                    player.registerHitBlock(c, r); // Register hit only if damage was applied/block broken
                    // Optional: Break here if you only want to damage ONE block per swing?
                    // break; // Uncomment to damage only the first block hit in a column
                }
            }
        }
        // if (/* break condition from inner loop */) break; // Uncomment if breaking inner loop
    }
}

/**
 * Checks for collisions between the player and enemies (contact damage).
 * If a collision occurs, damages the player using the enemy's calculated contact damage.
 * @param {Player} player - The player object.
 * @param {Array<Enemy>} enemies - An array of active enemy objects.
 */
export function checkPlayerEnemyCollisions(player, enemies) {
    if (!player || !enemies || player.isInvulnerable || player.getCurrentHealth() <= 0) {
        return;
    }

    const playerRect = player.getRect();
    for (const enemy of enemies) {
        if (!enemy || !enemy.isActive) continue;

        if (checkRectOverlap(playerRect, enemy.getRect())) {
            // Collision detected!
            // NEW: Get the current contact damage by calling the enemy's method
            const damageAmount = enemy.getCurrentContactDamage();

            // Only apply damage if the determined amount is greater than 0
            if (damageAmount > 0) {
                // console.log(`CollisionManager: Player collided with ${enemy.displayName}. Applying ${damageAmount} damage.`);
                player.takeDamage(damageAmount);

                // Important: Break after first hit in a frame to prevent multiple damage instances.
                // Player's takeDamage handles invulnerability timer.
                break;
            }
        }
    }
}

/**
 * Checks for collisions between active enemies and the portal.
 * If a collision occurs, damages the portal using the enemy's contact damage.
 * @param {Array<Enemy>} enemies - An array of active enemy objects.
 * @param {Portal} portal - The portal object.
 */
export function checkEnemyPortalCollisions(enemies, portal) {
    // Check if portal is valid and alive before checking collisions
    if (!portal || !portal.isAlive() || !enemies) {
        return;
    }

    const portalRect = portal.getRect();

    for (const enemy of enemies) {
        // Check if enemy is valid and active
        if (!enemy || !enemy.isActive) continue;

        // Perform collision check
        if (checkRectOverlap(enemy.getRect(), portalRect)) {
            // Collision detected!
            // Damage the portal using the enemy's *base* contact damage stat, NOT the player-specific one
            // We assume enemies deal their base contact damage to the portal regardless of state.
            // Add a fallback (e.g., 1 damage) in case stats or contactDamage is missing.
            const damageAmount = enemy.stats?.contactDamage ?? 1;

            // Only damage if the enemy actually deals base contact damage
            if (damageAmount > 0) {
                portal.takeDamage(damageAmount);
                // Optional: Add a cooldown or flag to enemy to prevent spamming damage every frame
                // For now, simple continuous contact damage is applied.
                // console.log(`CollisionManager: Enemy (${enemy.displayName}) collided with Portal. Applying ${damageAmount} damage.`);
            }
        }
    }
}