// -----------------------------------------------------------------------------
// root/js/collisionManager.js - Collision handling
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as WorldManager from './worldManager.js'; // Needed to damage blocks
import * as GridCollision from './utils/gridCollision.js'; // Needed for coordinate conversion

// --- Private Utility Function ---
function checkRectOverlap(rect1, rect2) {
    if (!rect1 || !rect2) {
        console.warn("Collision check skipped: Invalid rect provided.", rect1, rect2);
        return false;
    }
    // Ensure rect properties are numbers before checking
     if (typeof rect1.x !== 'number' || typeof rect1.y !== 'number' || typeof rect1.width !== 'number' || typeof rect1.height !== 'number' ||
         typeof rect2.x !== 'number' || typeof rect2.y !== 'number' || typeof rect2.width !== 'number' || typeof rect2.height !== 'number' ||
         isNaN(rect1.x) || isNaN(rect1.y) || isNaN(rect1.width) || isNaN(rect1.height) ||
         isNaN(rect2.x) || isNaN(rect2.y) || isNaN(rect2.width) || isNaN(rect2.height)) {
         console.warn("Collision check skipped: Rect properties are not valid numbers.", rect1, rect2);
         return false;
     }
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y; // Corrected rect1.height here
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
    // Player must be active (not removed) and NOT currently in the dying animation to pick up items
    // player.isActive is true during the dying animation.
    if (!player || !player.isActive || player.isDying || !items || !itemManager) return;

    const playerRect = player.getRect();
    // Loop backwards for safe removal
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        // Item must be active
        if (!item || !item.isActive) continue;

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
       // Check if player is active, attacking, capable of damaging enemies, and NOT dying
       const currentEnemyDamage = player?.getCurrentAttackDamage() ?? 0; // Get damage (handle null player)
       // Add check for !player.isActive and !player.isDying
       if (!player || !player.isActive || player.isDying || !enemies || !player.isAttacking || currentEnemyDamage <= 0) {
           return; // Exit if player isn't capable of attacking/damaging, or is dying
       }
    const attackHitbox = player.getAttackHitbox();
    if (!attackHitbox) return; // Exit if player doesn't have a valid attack hitbox (e.g., unarmed)

    for (const enemy of enemies) {
        // Enemy must be active and NOT dying to take damage
        if (!enemy || !enemy.isActive || enemy.isDying) continue;

        if (checkRectOverlap(attackHitbox, enemy.getRect())) {
            // Collision detected! Apply damage to enemy.
            // Check if this enemy has already been hit by this specific attack swing
            if (!player.hasHitEnemyThisSwing(enemy)) {
                               // Use the enemy-specific damage amount
                               enemy.takeDamage(currentEnemyDamage); // Enemy's takeDamage handles flashing/death transition
                player.registerHitEnemy(enemy); // Register the hit
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
    // Check if player is active, attacking, capable of damaging blocks, and NOT dying
    const currentBlockDamage = player?.getCurrentBlockDamage() ?? 0; // Damage vs blocks (handle null player)
     // Add check for !player.isActive and !player.isDying
    if (!player || !player.isActive || player.isDying || !player.isAttacking || currentBlockDamage <= 0) {
        return; // Exit if player isn't capable of attacking/damaging, or is dying
    }

    const attackHitbox = player.getAttackHitbox();
    if (!attackHitbox) return; // Exit if player doesn't have a valid attack hitbox

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
    // Player must be active, not invulnerable, and NOT dying to take damage
    if (!player || !player.isActive || player.isDying || player.isInvulnerable || !enemies) {
        return;
    }

    const playerRect = player.getRect();
    for (const enemy of enemies) {
        // Enemy must be active and NOT dying to deal damage
        if (!enemy || !enemy.isActive || enemy.isDying || enemy.isBeingAbsorbed) {
            continue;
        }
        if (checkRectOverlap(playerRect, enemy.getRect())) {
            // Collision detected!
            // Get the current contact damage by calling the enemy's method
            const damageAmount = enemy.getCurrentContactDamage();

            // Only apply damage if the determined amount is greater than 0
            if (damageAmount > 0) {
                // console.log(`CollisionManager: Player collided with ${enemy.displayName}. Applying ${damageAmount} damage.`);
                player.takeDamage(damageAmount); // Player's takeDamage handles invulnerability and death transition

                // Important: Break after first hit in a frame to prevent multiple damage instances.
                // Player's takeDamage handles invulnerability timer.
                break;
            }
        }
    }
}
export function checkEnemyPortalCollisions(enemies, portal) {
    if (!portal || !portal.isAlive() || !enemies) {
        return;
    }
    const portalRect = portal.getRect();

    for (const enemy of enemies) {
        // Check if enemy is valid, active, NOT dying, AND NOT ALREADY BEING ABSORBED
        if (!enemy || !enemy.isActive || enemy.isDying || enemy.isBeingAbsorbed) {
            continue;
        }

        if (checkRectOverlap(enemy.getRect(), portalRect)) {
            const damageAmount = enemy.stats?.contactDamage ?? 1;

            if (damageAmount > 0) {
                portal.takeDamage(damageAmount); // Portal takes damage ONCE
            }

            // Start absorption process regardless of whether it dealt damage (e.g. 0 contact damage enemies)
            // as long as it's a living, active enemy making contact.
            portal.startAbsorbing(enemy); // Portal initiates absorption

            // Since startAbsorbing sets enemy.isBeingAbsorbed = true, this enemy
            // will be skipped in subsequent checks within the same frame if multiple enemies hit,
            // and in subsequent frames until it's fully absorbed and made inactive.
        }
    }
}