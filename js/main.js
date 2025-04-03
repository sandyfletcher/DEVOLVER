// -----------------------------------------------------------------------------
// main.js - Game Entry Point and Main Loop
// -----------------------------------------------------------------------------
console.log("main.js loaded");

// --- Module Imports ---
// Configuration (constants)
import * as Config from './config.js'; // Import everything as 'Config' namespace

// Core Systems
import * as Input from './input.js'; // Handles user input
import * as Renderer from './renderer.js'; // Handles drawing to canvas

// Game Logic Modules
import * as World from './world.js'; // Handles terrain generation and properties
import { Player } from './player.js'; // The player character class/logic

import * as ItemManager from './itemManager.js';

// --- Future Module Imports (Placeholders) ---
// import * as EnemyManager from './enemyManager.js'; // Handles enemy spawning, updates, drawing
// import * as ItemManager from './itemManager.js';   // Handles dropped items, pickup logic
// import * as BuildSystem from './buildSystem.js';   // Handles placing/removing blocks
// import * as Crafting from './crafting.js';     // Handles crafting recipes and logic
// import * as UI from './ui.js';               // Handles drawing UI elements (health, resources, etc.)
// import * as WaveManager from './waveManager.js'; // Handles wave progression and difficulty

// --- Global Game Variables ---
let player = null; // Will hold the player instance
let gameRunning = true; // Simple flag for pausing later maybe
let lastTime = 0; // For delta time calculation

// --- Future Global Variables ---
// let currentWave = 0;
// let resources = { wood: 0, stone: 0 }; // Example resource tracking

// -----------------------------------------------------------------------------
// Collision Detection Helper
// -----------------------------------------------------------------------------
/**
 * Simple AABB collision check.
 * @param {object} rect1 - {x, y, width, height}
 * @param {object} rect2 - {x, y, width, height}
 * @returns {boolean} True if rectangles overlap.
 */
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

/**
 * Checks for and handles collisions between the player and items.
 */
function checkPlayerItemCollisions() {
    if (!player) return;

    const items = ItemManager.getItems();
    const playerRect = {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height
    };

    // Iterate backwards to allow safe removal while looping
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        const itemRect = {
            x: item.x,
            y: item.y, // Use the actual item y, not drawY with bobble for collision
            width: item.width,
            height: item.height
        };

        if (checkCollision(playerRect, itemRect)) {
            // Attempt to pick up the item
            const pickedUp = player.pickupItem(item);
            if (pickedUp) {
                // If pickup was successful, remove item from the world
                ItemManager.removeItem(item);
            }
            // Optional: Add a small delay before picking up another item?
        }
    }
}

// -----------------------------------------------------------------------------
// Game Loop
// -----------------------------------------------------------------------------
function gameLoop(timestamp) {
    if (!gameRunning) return; // Allow pausing

    // Calculate Delta Time (time elapsed since last frame in seconds)
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    // Clamp delta time to prevent large jumps (e.g., if tab loses focus)
    const dt = Math.min(deltaTime, Config.MAX_DELTA_TIME); // Use a constant from config

    // --- Input Phase ---
    // Input state is usually updated by event listeners in input.js directly
    const inputState = Input.getState(); // Get the current state

    // --- Update Phase ---
    // 1. Player Update
    if (player) {
        // Pass deltaTime, input state, and world collision info
        player.update(dt, inputState, World.getSurfaceY);
    }

    ItemManager.update(dt, World.getSurfaceY);

    // 2. Future Updates (Placeholders)
    // EnemyManager.update(dt, player.getPosition()); // Enemies might need player pos
    // ItemManager.update(dt);
    // WaveManager.update(dt); // Check if next wave should start
    // BuildSystem.update(dt, inputState, player.getPosition()); // Handle build actions
    // Crafting.update(inputState); // Handle crafting actions

    // 3. Collision Checks (Future - more complex interactions)
    // checkCollisions(player, EnemyManager.getEnemies(), ItemManager.getItems());
    checkPlayerItemCollisions();

    // 4. Game State Checks (Future)
    // checkWinLossConditions();

    // --- Render Phase ---
    Renderer.clear(); // Clear the canvas

    // 1. World Rendering
    World.draw(Renderer.getContext()); // Pass context if needed by draw functions

    ItemManager.draw(Renderer.getContext());

    // 2. Future Rendering (Placeholders)
    // ItemManager.draw(Renderer.getContext());
    // EnemyManager.draw(Renderer.getContext());
    // BuildSystem.draw(Renderer.getContext()); // Draw placed blocks

    // 3. Player Rendering
    if (player) {
        player.draw(Renderer.getContext());
    }

    // 5. UI Rendering (incl. touch controls)
    Input.drawControls(Renderer.getContext()); // <-- DRAW TOUCH CONTROLS
    // UI.draw(...)


    // 4. UI Rendering (Future - drawn last to be on top)
    // UI.draw(Renderer.getContext(), player.getHealth(), resources, currentWave);

    // --- Loop Continuation ---
    requestAnimationFrame(gameLoop);
}

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------
function init() {
    console.log("Initializing game...");

    // Initialize core systems
    try {
        Renderer.init(); // Get canvas, context
        Input.init();    // Start listening for keyboard/mouse events
        World.init();    // Could pre-calculate things if needed
        ItemManager.init();
    } catch (error) {
        console.error("Error initializing core systems:", error);
        gameRunning = false; // Stop game if core setup fails
        return;
    }


    // Create game objects
    try {
        // Create the player instance
        // Pass necessary initial config or references if the constructor needs them
        player = new Player(
            Config.PLAYER_START_X, // Use constants for starting pos
            Config.PLAYER_START_Y,
            Config.PLAYER_WIDTH,
            Config.PLAYER_HEIGHT,
            Config.PLAYER_COLOR
        );
    } catch (error) {
        console.error("Error creating game objects:", error);
        gameRunning = false;
        return;
    }


    // --- Future Initialization (Placeholders) ---
    // EnemyManager.init();
    // ItemManager.init();
    // BuildSystem.init(World); // May need reference to world for block data
    // Crafting.init();
    // UI.init();
    // WaveManager.init();

    // Set initial timestamp and start the loop
    lastTime = performance.now();
    gameRunning = true;
    requestAnimationFrame(gameLoop);
    console.log("Game initialization complete. Starting loop.");
}

// --- Start the Game ---
// Ensure the DOM is ready, although with 'defer' it usually is.
// Using DOMContentLoaded is safer if initialization relies on DOM elements beyond the canvas.
window.addEventListener('DOMContentLoaded', init);

// --- Future Helper Functions ---
// function checkCollisions(player, enemies, items) { ... }
// function checkWinLossConditions() { ... }