// -----------------------------------------------------------------------------
// root/js/collisionManager.js - Collision handling
// -----------------------------------------------------------------------------

import * as Config from './config.js'; // Might need config values later (e.g., damage amounts, though currently they are passed in via method calls)

console.log("collisionManager loaded");

// --- Private Utility Function ---
// Renamed for clarity, logic remains the same
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
 * If a collision occurs, attempts to pick up the item.
 * @param {Player} player - The player object.
 * @param {Array<Item>} items - An array of item objects.
 * @param {ItemManager} itemManager - The ItemManager instance (to remove picked up items).
 */
export function checkPlayerItemCollisions(player, items, itemManager) {
    if (!player || !items || !itemManager) return;

    const playerRect = player.getRect();
    // Loop backwards for safe removal
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (!item) continue; // Safety check

        const itemRect = item.getRect();
        if (checkRectOverlap(playerRect, itemRect)) {
            // Collision detected, attempt pickup
            const pickedUp = player.pickupItem(item);
            if (pickedUp) {
                // console.log(`CollisionManager: Player picked up ${item.type}`);
                itemManager.removeItem(item); // Tell ItemManager to remove it
            }
        }
    }
}

/**
 * Checks for collisions between the player's attack hitbox and enemies.
 * If a collision occurs, damages the enemy.
 * @param {Player} player - The player object.
 * @param {Array<Enemy>} enemies - An array of active enemy objects.
 */
export function checkPlayerAttackEnemyCollisions(player, enemies) {
    if (!player || !enemies || !player.isAttacking) { return; }

    const attackHitbox = player.getAttackHitbox();
    if (!attackHitbox) return; // No hitbox active

    for (const enemy of enemies) {
        if (!enemy || !enemy.isActive) continue; // Skip inactive/invalid enemies

        if (checkRectOverlap(attackHitbox, enemy.getRect())) {
            // Collision detected, check if already hit this swing
            if (!player.hasHitEnemyThisSwing(enemy)) {
                // console.log("CollisionManager: Player attack hit enemy");
                enemy.takeDamage(Config.PLAYER_ATTACK_DAMAGE); // Apply damage
                player.registerHitEnemy(enemy); // Mark enemy as hit for this swing
            }
        }
    }
}

/**
 * Checks for collisions between the player and enemies (contact damage).
 * If a collision occurs, damages the player if not invulnerable.
 * @param {Player} player - The player object.
 * @param {Array<Enemy>} enemies - An array of active enemy objects.
 */
export function checkPlayerEnemyCollisions(player, enemies) {
    // Check player state *before* iterating
    if (!player || !enemies || player.isInvulnerable) { return; }

    const playerRect = player.getRect();
    for (const enemy of enemies) {
        if (!enemy || !enemy.isActive) continue; // Skip inactive/invalid enemies

        if (checkRectOverlap(playerRect, enemy.getRect())) {
            // Collision detected, apply damage to player
            // console.log("CollisionManager: Player collided with enemy");
            player.takeDamage(Config.ENEMY_CONTACT_DAMAGE);
            // Important: Break after first hit to prevent multiple damage instances in one frame
            // Player's takeDamage method should handle setting invulnerability.
            break;
        }
    }
}