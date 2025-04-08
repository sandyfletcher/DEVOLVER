// -----------------------------------------------------------------------------
// root/js/enemyManager.js - Manages Enemy Instances
// -----------------------------------------------------------------------------

// console.log("enemyManager loaded");

import * as Config from './config.js';
import { Enemy } from './enemy.js'; // Enemy class now handles config reading and AI setup
import * as World from './worldManager.js';
// No ItemManager needed here directly (Enemy class handles drops)
import * as GridCollision from './utils/gridCollision.js'; // Needed for spawn validation

let enemies = [];

export function init() {
    enemies = [];
    // console.log("Enemy Manager initialized (Wave Controlled).");
}

/**
 * Attempts to spawn a single enemy of a specific type.
 * Checks against MAX_ENEMIES limit and validates spawn location.
 * @param {string} enemyType - The type key (e.g., Config.ENEMY_TYPE_PLAYER_CHASER) from Config.ENEMY_STATS.
 * @returns {boolean} True if an enemy was successfully spawned, false otherwise.
 */
export function trySpawnEnemy(enemyType) {
    if (enemies.length >= Config.MAX_ENEMIES) {
        // console.warn("trySpawnEnemy: Max enemy limit reached.");
        return false;
    }

    let spawnX = NaN, spawnY = NaN;
    let foundValidSpawnPoint = false;
    const maxSpawnAttempts = 15; // Increased attempts slightly

    // Get potential enemy size for validation (use default if specific type unknown, though shouldn't happen)
    const stats = Config.ENEMY_STATS[enemyType];
    const enemyWidth = stats?.width ?? Config.DEFAULT_ENEMY_WIDTH;
    const enemyHeight = stats?.height ?? Config.DEFAULT_ENEMY_HEIGHT;

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
    } // End spawn attempt loop

    if (!foundValidSpawnPoint) {
        console.error(`>>> trySpawnEnemy FAILED after ${maxSpawnAttempts} attempts for type "${enemyType}". Max enemies? No valid points found?`);
        return false;
    }

    // --- Create Enemy Instance ---
    // Enemy constructor now handles reading config and setting up AI
    try {
        const newEnemy = new Enemy(spawnX, spawnY, enemyType);
        enemies.push(newEnemy);
        return true;
    } catch (error) {
         console.error(`>>> Error creating enemy instance of type "${enemyType}":`, error);
         return false;
    }
}

/**
 * Updates all active enemies and removes inactive ones.
 * Passes necessary context (player position, all enemies) to each enemy's update.
 * @param {number} dt - Delta time.
 * @param {object | null} playerPosition - The player's current {x, y} position, or null.
 */
export function update(dt, playerPosition) {
    // Filter active enemies ONCE to pass to individual updates for separation checks
    const activeEnemies = enemies.filter(enemy => enemy.isActive);

    // Update loop (iterate backwards for safe removal)
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (enemy.isActive) {
            // Enemy's update method now uses its internal AI strategy
            enemy.update(dt, playerPosition, activeEnemies);
        }

        // Remove if inactive AFTER update (could become inactive during update)
        if (!enemies[i].isActive) {
            // console.log(`Removing inactive enemy: ${enemies[i].displayName} (Index ${i})`);
            enemies.splice(i, 1);
        }
    }
}

/**
 * Draws all active enemies onto the canvas.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 */
export function draw(ctx) {
    // Simple iteration, Enemy.draw handles isActive check
    enemies.forEach(enemy => {
        enemy.draw(ctx);
    });
}

/**
 * Returns the array containing all current enemy instances (active and inactive).
 * Primarily for collision checks.
 * @returns {Enemy[]} The array of enemy instances.
 */
export function getEnemies() {
    return enemies;
}

/**
 * Calculates and returns the count of currently active (alive) enemies.
 * Used by WaveManager.
 * @returns {number} The number of active enemies.
 */
export function getLivingEnemyCount() {
    // Could optimize slightly by maintaining a count, but filter is clear
    return enemies.filter(enemy => enemy.isActive).length;
}

/**
 * Removes all enemies from the manager immediately.
 * Useful for resetting the game state.
 */
export function clearAllEnemies() {
    enemies = [];
    // console.log("All enemies cleared by manager.");
}