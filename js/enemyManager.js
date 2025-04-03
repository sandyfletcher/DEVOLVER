// js/enemyManager.js
// -----------------------------------------------------------------------------
// enemyManager.js - Manages Enemy Instances (Spawning controlled externally)
// -----------------------------------------------------------------------------
console.log("enemyManager.js loaded");

import * as Config from './config.js';
// World import might not be strictly needed if spawn calculation is simple,
// but kept for potential future use (e.g., spawning near surface).
import * as World from './world.js';
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
    // Limit the total number of enemies allowed on screen
    if (enemies.length >= Config.MAX_ENEMIES) {
        // console.log("Max enemies reached, spawn failed."); // Optional log
        return false; // Cannot spawn more
    }

    // Determine spawn side (left or right)
    let spawnX;
    const spawnSide = Math.random() < 0.5 ? 'left' : 'right';

    // Calculate spawn position just outside the water zone, with slight randomness
    if (spawnSide === 'left') {
        spawnX = Config.WATER_WIDTH - Config.ENEMY_WIDTH - (Math.random() * 20 + 5); // Spawn left
    } else { // Right side
        spawnX = Config.CANVAS_WIDTH - Config.WATER_WIDTH + (Math.random() * 20 + 5); // Spawn right
    }

    // Spawn relatively high up, let gravity handle the drop
    // Could use World.getSurfaceY(spawnX) here if we wanted them to spawn
    // closer to the ground, but spawning high is simpler for now.
    const spawnY = 50 + (Math.random() - 0.5) * 20; // Slight vertical variation

    // Create and add the new enemy
    const newEnemy = new Enemy(spawnX, spawnY);
    enemies.push(newEnemy);
    // console.log(`Spawned enemy on ${spawnSide}. Total: ${enemies.length}`); // Can be noisy
    return true; // Spawn was successful
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