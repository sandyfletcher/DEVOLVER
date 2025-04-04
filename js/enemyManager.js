// js/enemyManager.js
// -----------------------------------------------------------------------------
// enemyManager.js - Manages Enemy Instances (Spawning controlled externally)
// -----------------------------------------------------------------------------
console.log("enemyManager.js loaded");

import * as Config from './config.js';
import { Enemy } from './enemy.js';
import * as World from './world.js'; // *** Import World to query grid ***
import * as ItemManager from './itemManager.js'; // Needed for enemy drop logic

// --- Module State ---
let enemies = [];

// --- Public Functions ---

/**
 * Initializes the enemy manager (clears existing enemies).
 */
export function init() {
    enemies = [];
    console.log("Enemy Manager initialized (Wave Controlled).");
}

/**
 * Attempts to spawn a single enemy based on type (currently only default 'tetrapod').
 * Usually called by an external system (like the wave manager in main.js).
 * Checks against MAX_ENEMIES limit.
 * @param {string} [enemyType='default'] - The type of enemy to spawn (for future use).
 * @returns {boolean} True if an enemy was successfully spawned, false otherwise.
 */
export function trySpawnEnemy(enemyType = 'default') { // Added type parameter
    if (enemies.length >= Config.MAX_ENEMIES) {
        console.warn("trySpawnEnemy: Max enemy limit reached.");
        return false;
    }

    let spawnX = NaN;
    let spawnY = NaN;
    let spawnCol = -1;
    let foundSpawnPoint = false;
    const maxSpawnAttempts = 10; // Try a few times to find a valid spot

    // --- Spawning Logic (can be switched based on enemyType later) ---
    if (enemyType === 'default') { // Tetrapod spawning logic
        for (let attempt = 0; attempt < maxSpawnAttempts && !foundSpawnPoint; attempt++) {
            // 1. Choose Corner Area
            const cornerWidth = Math.floor(Config.GRID_COLS * 0.15); // Spawn in outer 15%
            const spawnSide = Math.random() < 0.5 ? 'left' : 'right';

            if (spawnSide === 'left') {
                spawnCol = Math.floor(Math.random() * cornerWidth); // Cols 0 to cornerWidth-1
            } else { // Right side
                spawnCol = (Config.GRID_COLS - 1) - Math.floor(Math.random() * cornerWidth); // Cols near right edge
            }
            // Ensure spawnCol is within valid grid bounds (safety)
            spawnCol = Math.max(0, Math.min(Config.GRID_COLS - 1, spawnCol));

// 2. Find Water Surface in that Column (Revised Scan Logic)
let waterSurfaceRow = -1;
// Scan upwards from the bottom up to a reasonable point above the expected water level.
const scanStartRow = Config.GRID_ROWS - 1; // Start from the very bottom
// Scan up to where the ground level typically starts, or a bit higher than water level
const scanEndRow = Math.max(0, Config.WORLD_WATER_LEVEL_ROW_TARGET - 20);

for (let r = scanStartRow; r >= scanEndRow; r--) {
    const currentBlockType = World.getBlockType(spawnCol, r);

    if (currentBlockType === Config.BLOCK_WATER) {
        // Now check the block ABOVE the current one.
        const blockTypeAbove = World.getBlockType(spawnCol, r - 1);

        // If the block above is AIR, then 'r' is the surface row.
        // Also handle the case where water reaches the very top row (r=0).
        if (r === 0 || blockTypeAbove === Config.BLOCK_AIR) {
            waterSurfaceRow = r; // Found the surface!
            // Optional: Add a debug log here if needed
            // console.log(`Found water surface at [${spawnCol}, ${r}]`);
            break; // Exit this inner scan loop, we found our target row.
        }
        // If it's water but the block above isn't air, it's submerged water. Continue scanning upwards.
    }
    // If currentBlockType is not water (it's land or air below the surface),
    // just continue scanning upwards without breaking.
}

// 3. Calculate Coordinates if Water Found (Keep this part the same)
if (waterSurfaceRow !== -1) {
    // Center X in the column
    spawnX = spawnCol * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2) - (Config.ENEMY_WIDTH / 2);
    // Position Y so the enemy is roughly half-submerged at the surface
    // Use the found waterSurfaceRow
    spawnY = waterSurfaceRow * Config.BLOCK_HEIGHT - (Config.ENEMY_HEIGHT / 2);
    foundSpawnPoint = true; // Mark success
    // console.log(`Attempt ${attempt + 1}: Found water surface at [${spawnCol}, ${waterSurfaceRow}]. Spawn Y: ${spawnY.toFixed(1)}`);
} else {
     // console.log(`Attempt ${attempt + 1}: No suitable water surface found in col ${spawnCol}. Retrying...`);
}
        } // End spawn attempt loop

    } else {
        console.warn(`trySpawnEnemy: Unknown enemyType "${enemyType}"`);
        return false;
    }
    // --- End Spawning Logic ---


    // 4. Validate Coordinates and Spawn
    if (!foundSpawnPoint || isNaN(spawnX) || isNaN(spawnY)) {
        console.error(`>>> trySpawnEnemy FAILED after ${maxSpawnAttempts} attempts. Last tried col: ${spawnCol}. Could not find valid water surface point or coords NaN.`);
        return false; // Prevent spawning
    }

    // console.log(`>>> trySpawnEnemy SUCCESS: Spawning 'tetrapod' in col ${spawnCol} at x=${spawnX.toFixed(1)}, y=${spawnY.toFixed(1)}`);
    const newEnemy = new Enemy(spawnX, spawnY); // Pass coords to constructor
    enemies.push(newEnemy);
    return true;
}

/**
 * Updates all active enemies and removes inactive ones.
 * @param {number} dt - Delta time.
 * // Removed getSurfaceY parameter - enemy should use World.checkGridCollision now
 */
export function update(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (enemy.isActive) {
            enemy.update(dt); // Enemy update logic now likely uses World directly or via collision check
        } else {
            // Handle drops before removing (assuming enemy sets drop info on death)
            if (enemy.shouldDropItem) { // Check a flag the enemy might set
                 ItemManager.spawnItem(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.dropType || Config.ENEMY_DROP_TYPE);
            }
            enemies.splice(i, 1);
        }
    }
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