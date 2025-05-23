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
// --- Triangle-AABB Collision Helper Functions ---
// Helper function to calculate the sign for pointInTriangle
function sign(p1, p2, p3) {
return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}
// Checks if a point is inside a triangle
function pointInTriangle(pt, v1, v2, v3) {
const d1 = sign(pt, v1, v2);
const d2 = sign(pt, v2, v3);
const d3 = sign(pt, v3, v1);
const has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
const has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);

return !(has_neg && has_pos);

}
// Helper to check line segment intersection
function lineLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
if (den === 0) return null; // Parallel or coincident
const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
    };
}
return null;

}
// Checks if a triangle intersects an AABB (Axis-Aligned Bounding Box)
function triangleIntersectsAABB(triangleVertices, aabb) {
if (!triangleVertices || triangleVertices.length !== 3 || !aabb) return false;
// 1. Check if any triangle vertex is inside the AABB
for (const v of triangleVertices) {
    if (v.x >= aabb.x && v.x <= aabb.x + aabb.width &&
        v.y >= aabb.y && v.y <= aabb.y + aabb.height) {
        return true;
    }
}

// 2. Check if any AABB corner is inside the triangle
const aabbCorners = [
    { x: aabb.x, y: aabb.y },
    { x: aabb.x + aabb.width, y: aabb.y },
    { x: aabb.x, y: aabb.y + aabb.height },
    { x: aabb.x + aabb.width, y: aabb.y + aabb.height }
];
for (const corner of aabbCorners) {
    if (pointInTriangle(corner, triangleVertices[0], triangleVertices[1], triangleVertices[2])) {
        return true;
    }
}

// 3. Check for line segment intersections (triangle edges vs AABB edges)
const triEdges = [
    [triangleVertices[0], triangleVertices[1]],
    [triangleVertices[1], triangleVertices[2]],
    [triangleVertices[2], triangleVertices[0]]
];
const aabbEdges = [
    [aabbCorners[0], aabbCorners[1]], // Top
    [aabbCorners[1], aabbCorners[3]], // Right
    [aabbCorners[3], aabbCorners[2]], // Bottom
    [aabbCorners[2], aabbCorners[0]]  // Left
];

for (const triEdge of triEdges) {
    for (const aabbEdge of aabbEdges) {
        if (lineLineIntersection(
            triEdge[0].x, triEdge[0].y, triEdge[1].x, triEdge[1].y,
            aabbEdge[0].x, aabbEdge[0].y, aabbEdge[1].x, aabbEdge[1].y
        )) {
            return true;
        }
    }
}
return false;

}
// Helper to get AABB of a triangle
function getTriangleAABB(vertices) {
if (!vertices || vertices.length !== 3) return null;
const minX = Math.min(vertices[0].x, vertices[1].x, vertices[2].x);
const maxX = Math.max(vertices[0].x, vertices[1].x, vertices[2].x);
const minY = Math.min(vertices[0].y, vertices[1].y, vertices[2].y);
const maxY = Math.max(vertices[0].y, vertices[1].y, vertices[2].y);
return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
// --- Exported Collision Check Functions ---
/**
Checks for collisions between the player and items.
If a collision occurs, attempts to pick up the item via player.pickupItem.
@param {Player} player - The player object.
@param {Array<Item>} items - An array of item objects.
@param {ItemManager} itemManager - The ItemManager instance (to remove picked up items).
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
Checks for collisions between the player's attack hitbox and enemies.
If a collision occurs, damages the enemy using PLAYER_ATTACK_DAMAGE.
@param {Player} player - The player object.
@param {Array<Enemy>} enemies - An array of active enemy objects.
*/
export function checkPlayerAttackEnemyCollisions(player, enemies) {
// Check if player is active, attacking, capable of damaging enemies, and NOT dying
const currentEnemyDamage = player?.getCurrentAttackDamage() ?? 0; // Get damage (handle null player)
// Add check for !player.isActive and !player.isDying
if (!player || !player.isActive || player.isDying || !enemies || !player.isAttacking || currentEnemyDamage <= 0) {
return; // Exit if player isn't capable of attacking/damaging, or is dying
}
const attackHitboxData = player.getAttackHitbox();
if (!attackHitboxData) return; // Exit if player doesn't have a valid attack hitbox
for (const enemy of enemies) {
// Enemy must be active and NOT dying to take damage
if (!enemy || !enemy.isActive || enemy.isDying) continue;
const enemyRect = enemy.getRect();
 let collisionDetected = false;

 if (attackHitboxData.type === 'rect') {
     collisionDetected = checkRectOverlap(attackHitboxData.bounds, enemyRect);
 } else if (attackHitboxData.type === 'triangle') {
     collisionDetected = triangleIntersectsAABB(attackHitboxData.vertices, enemyRect);
 }

 if (collisionDetected) {
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
Checks for collisions between the player's attack hitbox and world blocks.
If a collision occurs and the equipped weapon can damage blocks (e.g., Shovel),
damages the block(s) using the weapon's specific block damage value.
@param {Player} player - The player object.
*/
export function checkPlayerAttackBlockCollisions(player) {
const currentBlockDamage = player?.getCurrentBlockDamage() ?? 0;
if (!player || !player.isActive || player.isDying || !player.isAttacking || currentBlockDamage <= 0) {
return;
}
const attackHitboxData = player.getAttackHitbox();
if (!attackHitboxData) return;
let minCol, maxCol, minRow, maxRow;
if (attackHitboxData.type === 'rect') {
const attackRect = attackHitboxData.bounds;
minCol = Math.max(0, Math.floor(attackRect.x / Config.BLOCK_WIDTH));
maxCol = Math.min(Config.GRID_COLS - 1, Math.floor((attackRect.x + attackRect.width) / Config.BLOCK_WIDTH));
minRow = Math.max(0, Math.floor(attackRect.y / Config.BLOCK_HEIGHT));
maxRow = Math.min(Config.GRID_ROWS - 1, Math.floor((attackRect.y + attackRect.height) / Config.BLOCK_HEIGHT));
} else if (attackHitboxData.type === 'triangle') {
const triangleAABB = getTriangleAABB(attackHitboxData.vertices);
if (!triangleAABB) return;
minCol = Math.max(0, Math.floor(triangleAABB.x / Config.BLOCK_WIDTH));
maxCol = Math.min(Config.GRID_COLS - 1, Math.floor((triangleAABB.x + triangleAABB.width) / Config.BLOCK_WIDTH));
minRow = Math.max(0, Math.floor(triangleAABB.y / Config.BLOCK_HEIGHT));
maxRow = Math.min(Config.GRID_ROWS - 1, Math.floor((triangleAABB.y + triangleAABB.height) / Config.BLOCK_HEIGHT));
} else {
return; // Unknown hitbox type
}
for (let r = minRow; r <= maxRow; r++) {
for (let c = minCol; c <= maxCol; c++) {
if (!player.hasHitBlockThisSwing(c, r)) {
const blockRect = {
x: c * Config.BLOCK_WIDTH,
y: r * Config.BLOCK_HEIGHT,
width: Config.BLOCK_WIDTH,
height: Config.BLOCK_HEIGHT
};
let blockCollisionDetected = false;
         if (attackHitboxData.type === 'rect') {
             // For rect hitbox, WorldManager.damageBlock will check if the block is damageable.
             // The broadphase check (minCol/maxCol etc.) is enough here.
             blockCollisionDetected = true; 
         } else if (attackHitboxData.type === 'triangle') {
             blockCollisionDetected = triangleIntersectsAABB(attackHitboxData.vertices, blockRect);
         }
         if (blockCollisionDetected) {
             const damaged = WorldManager.damageBlock(c, r, currentBlockDamage);
             if (damaged) {
                 player.registerHitBlock(c, r);
             }
         }
     }
 }
}
}
/**
Checks for collisions between the player and enemies (contact damage).
If a collision occurs, damages the player using the enemy's calculated contact damage.
@param {Player} player - The player object.
@param {Array<Enemy>} enemies - An array of active enemy objects.
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
if (!enemy || !enemy.isActive || enemy.isDying || enemy.isBeingAbsorbed) {
continue;
}
    if (checkRectOverlap(enemy.getRect(), portalRect)) {
        const damageAmount = enemy.stats?.contactDamage ?? 1;
        if (damageAmount > 0) {
            portal.takeDamage(damageAmount); // Portal takes damage ONCE
        }
        portal.startAbsorbing(enemy); // Portal initiates absorption
    a }
    }
}