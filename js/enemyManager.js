// js/enemyManager.js
// -----------------------------------------------------------------------------
// enemyManager.js - Manages Enemy Instances (Spawning controlled externally)
// -----------------------------------------------------------------------------
console.log("enemyManager.js loaded");

import * as Config from './config.js';
import { Enemy } from './enemy.js';  // Import the Enemy class

// --- Module State ---
let enemies = []; // Array to hold all active Enemy instances
// No spawn timer needed here anymore

// --- Public Functions ---

/**
 * Initializes the enemy manager (clears existing enemies).
 */
export function init() {
    enemies = [];
    console.log("Enemy Manager initialized (Wave Controlled).");
}

/**
 * Attempts to spawn a single enemy at a random side just outside the water.
 * Usually called by an external system (like the wave manager in main.js).
 * Checks against MAX_ENEMIES limit.
 * @returns {boolean} True if an enemy was successfully spawned, false otherwise.
 */
export function trySpawnEnemy() {
    if (enemies.length >= Config.MAX_ENEMIES) {
        return false;
    }

    // Determine island boundaries to spawn outside them
    const islandWidth = Math.floor(Config.GRID_COLS * Config.WORLD_ISLAND_WIDTH_PERCENT);
    const islandStartCol = Math.floor((Config.GRID_COLS - islandWidth) / 2);
    const islandEndCol = islandStartCol + islandWidth;

    let spawnCol;
    const spawnSide = Math.random() < 0.5 ? 'left' : 'right';

    if (spawnSide === 'left') {
        // Pick a random column in the left water area
        spawnCol = Math.floor(Math.random() * islandStartCol);
    } else { // Right side
        // Pick a random column in the right water area
        spawnCol = islandEndCol + Math.floor(Math.random() * (Config.GRID_COLS - islandEndCol));
    }
     // Ensure spawnCol is within valid grid bounds (safety)
     spawnCol = Math.max(0, Math.min(Config.GRID_COLS - 1, spawnCol));


    // Calculate pixel X position (center of the chosen column)
    const spawnX = (spawnCol + 0.5) * Config.BLOCK_WIDTH - (Config.ENEMY_WIDTH / 2); // Center enemy in block

    // Spawn just above the defined water level row
    const spawnY = (Config.WORLD_WATER_LEVEL_ROW - 1) * Config.BLOCK_HEIGHT;

    // Optional: Add small random Y variation?
    // const spawnY = (Config.WORLD_WATER_LEVEL_ROW - 1 + (Math.random() - 0.5)) * Config.BLOCK_HEIGHT;


    console.log(`>>> trySpawnEnemy: Spawning in col ${spawnCol} at x=${spawnX.toFixed(1)}, y=${spawnY.toFixed(1)}`);

    // Check if calculated spawnX is valid before creating enemy
    if (isNaN(spawnX) || isNaN(spawnY)) {
        console.error(">>> trySpawnEnemy ERROR: Calculated NaN spawn coordinates!", spawnX, spawnY);
        return false; // Prevent spawning with NaN
    }

    const newEnemy = new Enemy(spawnX, spawnY);
    enemies.push(newEnemy);
    return true;
}

/**
 * Updates all active enemies (calls their update method) and removes inactive (dead) enemies.
 * @param {number} dt - Delta time.
 * @param {function} getSurfaceY - Function to get terrain height (passed to enemy.update).
 */
export function update(dt, getSurfaceY) {
    // Spawning logic is handled in main.js now via updateWaveSystem calling trySpawnEnemy

    // Iterate backwards for safe removal of inactive enemies during the loop
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (enemy.isActive) {
            // Pass dt and getSurfaceY to the enemy's own update method
            enemy.update(dt, getSurfaceY);
        } else {
            // Remove inactive (dead) enemies from the array
            enemies.splice(i, 1);
            // console.log(`Removed inactive enemy. Total living: ${getLivingEnemyCount()}`); // Optional log
        }
    }
}

/**
 * Draws all active enemies onto the canvas.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 */
export function draw(ctx) {
    // Loop through all enemies and call their draw method
    // The Enemy.draw method itself checks the 'isActive' flag.
    enemies.forEach(enemy => {
        enemy.draw(ctx);
    });
}

/**
 * Returns the array containing all current enemy instances (active and potentially inactive before cleanup).
 * Primarily used for collision checks where iterating through all is needed.
 * @returns {Enemy[]} The array of enemy instances.
 */
export function getEnemies() {
    return enemies;
}

/**
 * Calculates and returns the count of currently active (alive) enemies.
 * Useful for wave progression logic.
 * @returns {number} The number of active enemies.
 */
export function getLivingEnemyCount() {
    // Filter the array for active enemies and return the length
    // This is more reliable than just `enemies.length` if removal hasn't happened yet this frame.
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

// --- Future functions ---
// function getNearestEnemy(pos) { ... }