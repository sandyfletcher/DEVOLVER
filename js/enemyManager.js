// -----------------------------------------------------------------------------
// root/js/enemyManager.js - Manages Enemy Instances
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import { Enemy } from './utils/enemy.js';
import * as GridCollision from './utils/gridCollision.js';

let enemies = [];

export function init() {
    enemies = [];
}

// --- Attempts to spawn enemy of a specific type,  and  ---
export function trySpawnEnemy(enemyType) {
// check MAX_ENEMIES limit
    if (enemies.length >= Config.MAX_ENEMIES) {
        console.error("trySpawnEnemy: Max enemy limit reached.");
        return false;
    }
// validate spawn location
    let spawnX = NaN, spawnY = NaN;
    let foundValidSpawnPoint = false;
    const maxSpawnAttempts = 15;
    // get enemy size for validation (default if type unknown)
    const stats = Config.ENEMY_STATS[enemyType];
    // Read dimensions in BLOCK units from stats, then scale to pixels.
    // Use default BLOCK units if stats are missing, then scale.
    const enemyWidthBlocks = stats?.width_BLOCKS ?? Config.DEFAULT_ENEMY_WIDTH;
    const enemyHeightBlocks = stats?.height_BLOCKS ?? Config.DEFAULT_ENEMY_HEIGHT;
    const enemyWidth = enemyWidthBlocks * Config.BLOCK_WIDTH;   // Scale to pixels
    const enemyHeight = enemyHeightBlocks * Config.BLOCK_HEIGHT; // Scale to pixels
    for (let attempt = 0; attempt < maxSpawnAttempts && !foundValidSpawnPoint; attempt++) {
// --- Simplified Off-Screen Spawning Logic ---
        const spawnSide = Math.random() < 0.5 ? 'left' : 'right';
        const margin = Config.ENEMY_SPAWN_EDGE_MARGIN;
        let tempX = (spawnSide === 'left')
            ? -margin - enemyWidth // Start fully off-screen left
            : Config.CANVAS_WIDTH + margin; // Start off-screen right
// --- Basic Ground Finding ---
// Find ground near the edge (can be improved with spawn zones later)
// Check a column slightly inwards from the edge
        const checkCol = (spawnSide === 'left')
             ? Math.floor(margin / Config.BLOCK_WIDTH)
             : Math.floor((Config.CANVAS_WIDTH - margin) / Config.BLOCK_WIDTH);
        const clampedCheckCol = Math.max(0, Math.min(Config.GRID_COLS - 1, checkCol));
        let groundY = Config.CANVAS_HEIGHT; // Default to bottom if no ground found
        for (let r = 0; r < Config.GRID_ROWS; r++) {
// isSolid check is more robust than just checking for AIR
            if (GridCollision.isSolid(clampedCheckCol, r)) {
                groundY = r * Config.BLOCK_HEIGHT; // Top edge of the solid block
                break;
            }
        }
// Spawn slightly above the found ground level
        let tempY = groundY - enemyHeight - (Math.random() * 10 + 5); // 5-15px buffer above ground
        tempY = Math.max(10, tempY); // Ensure not spawning too high up or negative

        // --- Spawn Point Validation ---
        if (!isNaN(tempX) && !isNaN(tempY)) {
            // Calculate grid cell for the potential spawn location (top-left corner)
            const { col: spawnCol, row: spawnRow } = GridCollision.worldToGridCoords(tempX + enemyWidth / 2, tempY + enemyHeight / 2); // Check center approx
            // Check if the target spawn cell (and maybe below?) is clear of solid blocks
            let isLocationClear = !GridCollision.isSolid(spawnCol, spawnRow);
             // Optional: More thorough check around the enemy's bounding box
             if (isLocationClear) {
                  const checkCols = [
                      Math.floor(tempX / Config.BLOCK_WIDTH),
                      Math.floor((tempX + enemyWidth - 1) / Config.BLOCK_WIDTH) // Check right edge too
                  ];
                  const checkRows = [
                      Math.floor(tempY / Config.BLOCK_HEIGHT),
                      Math.floor((tempY + enemyHeight - 1) / Config.BLOCK_HEIGHT) // Check bottom edge
                  ];
                  for (let c = checkCols[0]; c <= checkCols[1]; c++) {
                      for (let r = checkRows[0]; r <= checkRows[1]; r++) {
                          if (GridCollision.isSolid(c, r)) {
                              isLocationClear = false;
                              // console.log(`Spawn validation failed: Solid block at [${c}, ${r}] for attempt at ${tempX.toFixed(1)}, ${tempY.toFixed(1)}`);
                              break;
                          }
                      }
                      if (!isLocationClear) break;
                  }
             }
            if (isLocationClear) {
                spawnX = tempX;
                spawnY = tempY;
                foundValidSpawnPoint = true;
                // console.log(`Found valid spawn: ${enemyType} at ${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}`);
            } else {
                 // console.log(`Invalid spawn point attempt ${attempt+1}/${maxSpawnAttempts}: (${tempX.toFixed(1)}, ${tempY.toFixed(1)}) collision detected.`);
            }
        }
    }

    if (!foundValidSpawnPoint) {
        console.error(`>>> trySpawnEnemy FAILED after ${maxSpawnAttempts} attempts for type "${enemyType}". Max enemies? No valid points found?`);
        return false;
    }

    // --- Create Enemy Instance ---
    try {
        const newEnemy = new Enemy(spawnX, spawnY, enemyType);
        enemies.push(newEnemy);
        return true;
    } catch (error) {
         console.error(`>>> Error creating enemy instance of type "${enemyType}":`, error);
         return false;
    }
}

// --- Update active and remove inactive enemies ... ---
export function update(dt, playerPosition) {
    // Filter active enemies ONCE to pass to individual updates for separation checks
    // Separation should only consider enemies that are *not* dying.
    const activeEnemiesForSeparation = enemies.filter(enemy => enemy && enemy.isActive && !enemy.isDying);

    // Update loop (iterate backwards for safe removal)
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
         // Ensure enemy is valid before accessing properties
         if (!enemy) {
              console.warn(`EnemyManager.update: Found invalid enemy at index ${i}, removing.`);
              enemies.splice(i, 1);
              continue;
         }

        // Update the enemy instance. Its internal update handles isDying state and setting isActive=false.
        enemy.update(dt, playerPosition, activeEnemiesForSeparation); // Pass the filtered list for separation

        // Remove if inactive AFTER update (enemy.update sets isActive=false when death anim finishes)
        if (!enemies[i].isActive) {
            // console.log(`Removing inactive enemy: ${enemies[i].displayName} (Index ${i})`);
            enemies.splice(i, 1);
        }
    }
}

// --- Draws all active enemies onto the canvas ---
export function draw(ctx) {
    // Draw loop now includes enemies in the isDying state because enemy.isActive is true during dying.
    // enemy.draw() handles the isDying state internally.
    enemies.forEach(enemy => {
         // Add defensive check before drawing
        if(enemy && (enemy.isActive || enemy.isDying)){ // Draw if active OR dying
             enemy.draw(ctx);
        }
    });
}

// --- Returns array containing all active and inactive enemy instances, primarily for collision checks ---
// Collision checks should filter for !enemy.isDying internally.
export function getEnemies() {
    return enemies;
}
// --- Calculates and returns count of currently active enemies for WaveManager ---
export function getLivingEnemyCount() {
    // Count enemies that are currently active AND NOT in the dying animation state
    return enemies.filter(enemy => enemy && enemy.isActive && !enemy.isDying).length;
}
// --- Removes all enemies from the manager ---
export function clearAllEnemies() {
    enemies = [];
}
// NEW: Clears all enemies outside a given radius from a center point
export function clearEnemiesOutsideRadius(centerX, centerY, radius) {
    const radiusSq = radius * radius; // Compare squared distances for efficiency
    const initialCount = enemies.length;
    enemies = enemies.filter(enemy => {
        // Keep valid enemies ONLY if their center is INSIDE or EXACTLY ON the radius boundary
        // Do NOT check isActive or isDying here, we want to clear *all* enemies outside the radius, regardless of state
        if (!enemy || typeof enemy.x !== 'number' || typeof enemy.y !== 'number' || isNaN(enemy.x) || isNaN(enemy.y)) {
             // Remove invalid enemies defensively
             console.warn("EnemyManager: Found invalid enemy data during cleanup, removing.", enemy);
            return false;
        }
        const enemyCenterX = enemy.x + enemy.width / 2; // Check distance from enemy's center to the center point
        const enemyCenterY = enemy.y + enemy.height / 2;
        const dx = enemyCenterX - centerX;
        const dy = enemyCenterY - centerY;
        const distSq = dx * dx + dy * dy;
        return distSq <= radiusSq;
    });
    const removedCount = initialCount - enemies.length;
    // console.log(`EnemyManager: Cleared ${removedCount} enemies outside radius ${radius}.`);
}