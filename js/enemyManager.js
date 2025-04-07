// -----------------------------------------------------------------------------
// enemyManager.js - Manages Enemy Instances (UPDATED for types)
// -----------------------------------------------------------------------------
console.log("enemyManager.js loaded");

import * as Config from './config.js';
import { Enemy } from './enemy.js';
import * as World from './worldManager.js';
import * as ItemManager from './itemManager.js';
import * as GridCollision from './utils/gridCollision.js'; // Keep if needed elsewhere

let enemies = [];

export function init() { /* ... no change ... */ }

/**
 * Attempts to spawn a single enemy of a specific type.
 * Checks against MAX_ENEMIES limit.
 * @param {string} enemyType - The type of enemy to spawn (e.g., Config.ENEMY_TYPE_PLAYER_CHASER).
 * @returns {boolean} True if an enemy was successfully spawned, false otherwise.
 */
export function trySpawnEnemy(enemyType) { // Accepts enemyType
    if (enemies.length >= Config.MAX_ENEMIES) {
        // console.warn("trySpawnEnemy: Max enemy limit reached.");
        return false;
    }

    let spawnX = NaN, spawnY = NaN;
    let foundSpawnPoint = false;
    const maxSpawnAttempts = 10;

    // --- Simplified Off-Screen Spawning Logic ---
    // (You can restore your water-finding logic if preferred, just ensure it finds a point)
    for (let attempt = 0; attempt < maxSpawnAttempts && !foundSpawnPoint; attempt++) {
        const spawnSide = Math.random() < 0.5 ? 'left' : 'right';
        const margin = Config.ENEMY_SPAWN_EDGE_MARGIN; // Use config margin
        let tempX = (spawnSide === 'left') ? -margin : Config.CANVAS_WIDTH + margin;

        // Find ground near the edge (very basic)
        const checkCol = (spawnSide === 'left') ? 5 : Config.GRID_COLS - 6;
        let groundY = Config.CANVAS_HEIGHT;
        for (let r = 0; r < Config.GRID_ROWS; r++) {
            // Check if the block is NOT air (simplest solid check)
            if (World.getBlockType(checkCol, r) !== Config.BLOCK_AIR) {
                groundY = r * Config.BLOCK_HEIGHT;
                break;
            }
        }
        // Spawn slightly above the found ground level
        let tempY = groundY - Config.ENEMY_HEIGHT - Math.random() * 50;
        tempY = Math.max(10, tempY); // Ensure not spawning too high up

        // Validate and assign if valid
        if (!isNaN(tempX) && !isNaN(tempY)) {
            spawnX = tempX;
            spawnY = tempY;
            foundSpawnPoint = true;
        }
    }
    // --- End Spawning Logic ---

    if (!foundSpawnPoint) {
        console.error(`>>> trySpawnEnemy FAILED after ${maxSpawnAttempts} attempts to find spawn point.`);
        return false;
    }

    // --- Create Enemy of the specified type ---
    // Validate type before passing, or let constructor handle fallback
    const typeToSpawn = Config.ENEMY_STATS[enemyType] ? enemyType : Config.ENEMY_TYPE_CENTER_SEEKER;

    console.log(`>>> Spawning '${typeToSpawn}' at x=${spawnX.toFixed(1)}, y=${spawnY.toFixed(1)}`);
    const newEnemy = new Enemy(spawnX, spawnY, typeToSpawn); // Pass the type
    enemies.push(newEnemy);
    return true;
}

/**
 * Updates all active enemies and removes inactive ones.
 * Passes the full enemy list to each enemy for separation checks.
 * @param {number} dt - Delta time.
 * @param {object | null} playerPosition - The player's current {x, y} position, or null.
 */
export function update(dt, playerPosition) { // Accept playerPosition
    // Create a filtered list of *active* enemies to pass for separation checks
    // This prevents inactive enemies from influencing separation
    const activeEnemies = enemies.filter(enemy => enemy.isActive);

    // Update loop (iterate backwards for safe removal)
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (enemy.isActive) {
            // Pass dt, playerPosition, and the list of *active* enemies
            enemy.update(dt, playerPosition, activeEnemies); // <-- Pass activeEnemies here
        } else {
            // If enemy became inactive *during* its update (e.g. fell out),
            // or was already inactive, remove it.
            enemies.splice(i, 1);
        }
    }

    // Optional: Second pass for separation? Usually not needed if done within update.
    // Some implementations do separation as a separate pass *after* basic movement update
    // but before physics resolution. Doing it within update is generally fine.
}

/**
 * Draws all active enemies onto the canvas.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 */
export function draw(ctx) {
    enemies.forEach(enemy => {
        enemy.draw(ctx); // Enemy draw handles isActive internally
    });
}

/**
 * Returns the array containing all current enemy instances.
 * @returns {Enemy[]} The array of enemy instances.
 */
export function getEnemies() {
    return enemies;
}

/**
 * Calculates and returns the count of currently active (alive) enemies.
 * @returns {number} The number of active enemies.
 */
export function getLivingEnemyCount() {
    return enemies.filter(enemy => enemy.isActive).length;
}

/**
 * Removes all enemies from the manager immediately.
 * Useful for resetting the game state.
 */
export function clearAllEnemies() {
    enemies = [];
    console.log("All enemies cleared.");
}