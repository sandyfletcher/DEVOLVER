// -----------------------------------------------------------------------------
// root/js/collisionManager.js - Collision handling
// -----------------------------------------------------------------------------

import * as Config from './config.js'; // Still useful for things like PLAYER_ATTACK_DAMAGE
// Enemy contact damage is now fetched from the enemy instance itself.

// console.log("collisionManager loaded");

// --- Private Utility Function ---
function checkRectOverlap(rect1, rect2) {
    if (!rect1 || !rect2) {
        // console.warn("Collision check skipped: Invalid rect provided.", rect1, rect2);
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
    if (!player || !enemies || !player.isAttacking || player.getCurrentHealth() <= 0) { return; }

    const attackHitbox = player.getAttackHitbox();
    if (!attackHitbox) return; // No hitbox active

    for (const enemy of enemies) {
        if (!enemy || !enemy.isActive) continue; // Skip inactive/invalid enemies

        if (checkRectOverlap(attackHitbox, enemy.getRect())) {
            // Collision detected, check if already hit this swing
            if (!player.hasHitEnemyThisSwing(enemy)) {
                // console.log(`CollisionManager: Player attack hit ${enemy.displayName}`);
                // Use the globally defined player attack damage
                enemy.takeDamage(Config.PLAYER_ATTACK_DAMAGE);
                player.registerHitEnemy(enemy); // Mark enemy as hit for this swing
            }
        }
    }
}

/**
 * Checks for collisions between the player and enemies (contact damage).
 * If a collision occurs, damages the player using the specific enemy's contact damage value.
 * @param {Player} player - The player object.
 * @param {Array<Enemy>} enemies - An array of active enemy objects.
 */
export function checkPlayerEnemyCollisions(player, enemies) {
    // Check player state *before* iterating (invulnerable or dead)
    if (!player || !enemies || player.isInvulnerable || player.getCurrentHealth() <= 0) {
        return;
    }

    const playerRect = player.getRect();
    for (const enemy of enemies) {
        if (!enemy || !enemy.isActive) continue; // Skip inactive/invalid enemies

        if (checkRectOverlap(playerRect, enemy.getRect())) {
            // Collision detected!
            // Get the contact damage from the *specific enemy instance* that collided.
            // The enemy instance should have its stats loaded from Config during construction.
            // Add a fallback (e.g., 1 damage) in case stats or contactDamage is missing.
            const damageAmount = enemy.stats?.contactDamage ?? 1; // Use nullish coalescing for safety

            // console.log(`CollisionManager: Player collided with ${enemy.displayName}. Applying ${damageAmount} damage.`);
            player.takeDamage(damageAmount);

            // Important: Break after first hit in a frame to prevent multiple damage instances
            // from the same or multiple enemies simultaneously. Player's takeDamage handles invulnerability timer.
            break;
        }
    }
}