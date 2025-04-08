// -----------------------------------------------------------------------------
// root/js/main.js - Game Entry Point and Main Loop
// -----------------------------------------------------------------------------

// console.log("main loaded");

// --- Module Imports ---
import * as UI from './ui.js';
import { Player } from './player.js';
import * as Input from './input.js';
import * as Config from './config.js';
import * as Renderer from './renderer.js';
import * as CollisionManager from './collisionManager.js';
import * as World from './worldManager.js';
import * as ItemManager from './itemManager.js';
import * as EnemyManager from './enemyManager.js';
import * as WaveManager from './waveManager.js';
import * as WorldData from './utils/worldData.js';

// --- Global Game Variables ---
let player = null;
let gameRunning = true;
let lastTime = 0;
let restartBtnRef = null; // Variable to hold button reference

// --- Function to log the world grid ---
function logWorldGrid() {
    console.log("--- World Grid Debug Output ---");
    console.time("GridLog Generation"); // Optional: time how long it takes

    const blockToChar = {
        [Config.BLOCK_AIR]: ' ', // Use space for air for better visual clarity
        [Config.BLOCK_WATER]: '~', // Tilde often used for water
        [Config.BLOCK_SAND]: '.', // Dot for sand
        [Config.BLOCK_DIRT]: '#', // Hash for dirt
        [Config.BLOCK_GRASS]: '"', // Double quote for grass tufts
        [Config.BLOCK_STONE]: 'R', // R for Rock/Stone
        [Config.BLOCK_WOOD_WALL]: 'P', // P for Plank/Wood Wall
        [Config.BLOCK_METAL]: 'M', // M for Metal
        // Add mappings for any other block types you have
    };
    const defaultChar = '?'; // Character for unknown block types

    let gridString = "";
    const gridHeight = Config.GRID_ROWS;
    const gridWidth = Config.GRID_COLS;

    for (let r = 0; r < gridHeight; r++) {
        let rowString = "";
        for (let c = 0; c < gridWidth; c++) {
            const blockType = WorldData.getBlockType(c, r); // Use the getter
            const char = blockToChar[blockType] ?? defaultChar; // Get char or default
            rowString += char;
        }
        gridString += rowString + "\n"; // Add the completed row and a newline
    }

    console.log(gridString);
    console.timeEnd("GridLog Generation"); // Optional: end timer
    console.log("--- End World Grid Debug Output ---");
}

// --- Restart Game Function ---
function restartGame() {
    console.log(">>> RESTARTING GAME <<<");
    // Reset Player (or create new)
    if (!player) {
        player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
    } else {
        player.reset();
    }
    // Reset Managers
    // Clear world grid and regenerate
    WorldData.initializeGrid();
    World.init();

    ItemManager.init();
    EnemyManager.clearAllEnemies();
    WaveManager.reset();


    // Reset Game Loop State
    lastTime = performance.now();
    gameRunning = true;
    Input.consumeClick();

    // Initial UI Update after reset
    const waveInfo = WaveManager.getWaveInfo();
    const livingEnemies = EnemyManager.getLivingEnemyCount();
    UI.updateWaveInfo(waveInfo, livingEnemies);
    UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus());
    UI.updateGameOverState(false);
    // log grid to console
    logWorldGrid();
    console.log(">>> GAME RESTARTED <<<");
}

// --- Game Loop ---
function gameLoop(timestamp) {
    // --- Delta Time Calc ---
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    const dt = Math.min(deltaTime, Config.MAX_DELTA_TIME);

    // --- Game Over Check ---
    let isGameOver = WaveManager.isGameOver();
    if (!isGameOver && player && player.getCurrentHealth() <= 0) {     // Check player health AFTER potential updates/collisions
        console.log("Game Over detected in loop (Player health <= 0). Setting state.");
        WaveManager.setGameOver();
        isGameOver = true; // Update local flag for this frame
        UI.updateGameOverState(true, WaveManager.getCurrentWaveNumber());     // Check wave manager state as well
    }

    // --- Handle GAME OVER state ---
    if (isGameOver) {
        // Render final scene
        Renderer.clear();
        World.draw(Renderer.getContext());
        ItemManager.draw(Renderer.getContext());
        EnemyManager.draw(Renderer.getContext());
        if (player) player.draw(Renderer.getContext());
        // Update UI (wave info shows game over, player info shows final state)
        const waveInfo = WaveManager.getWaveInfo();
        const livingEnemies = EnemyManager.getLivingEnemyCount();
        UI.updateWaveInfo(waveInfo, livingEnemies);
         if (player) {
            UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus());
         }

        // Draw touch controls
        Input.drawControls(Renderer.getContext());

        requestAnimationFrame(gameLoop);
        return;
    }
    
    // --- When Game is Active, Proceed with Normal Loop ---

    // if (!gameRunning) return; // Keep if you want an explicit pause flag later

    // --- Input Phase ---
    const inputState = Input.getState();

    // --- Get Player Position for AI ---
    let currentPlayerPosition = null;
    if (player && player.getCurrentHealth() > 0) {
        currentPlayerPosition = player.getPosition();
    }

    // --- Update Phase (Game Logic) ---
    if (player) { player.update(dt, inputState); }
    ItemManager.update(dt);
    EnemyManager.update(dt, currentPlayerPosition); // Pass player pos to enemies
    WaveManager.update(dt);
    World.update(dt); // World updates (e.g., block changes) - Placeholder

    // --- Collision Detection Phase ---
    if (player) {
        CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
        CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
        CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies());
    }
    // Other collision checks (e.g., enemy projectiles - future)

    // --- Render Phase (Canvas) ---
    Renderer.clear(); // Clear canvas
    World.draw(Renderer.getContext()); // Draw world background/tiles
    ItemManager.draw(Renderer.getContext()); // Draw items
    EnemyManager.draw(Renderer.getContext()); // Draw enemies
    if (player) { player.draw(Renderer.getContext()); } // Draw player

    // --- Render Phase (HTML UI) ---
    // Update sidebar information
    const waveInfo = WaveManager.getWaveInfo();
    const livingEnemies = EnemyManager.getLivingEnemyCount(); // Get current enemy count
    UI.updateWaveInfo(waveInfo, livingEnemies); // Update left sidebar
    if (player) {
        UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus()); // Update right sidebar
    }
    // Ensure restart button remains hidden during active gameplay
    UI.updateGameOverState(false); // Call this every frame when game is running
    // --- Draw Touch Controls (Still on Canvas) ---
    Input.drawControls(Renderer.getContext());
    // Consume click state (relevant for attack)
    Input.consumeClick();
    // --- Loop Continuation ---
    requestAnimationFrame(gameLoop);
}

// --- Initialization ---
function init() {
    console.log("Resources loaded, initializing game...");
    let initializationOk = true;
    try {
        UI.init(); // Initialize UI element references FIRST
        Renderer.init();
        Renderer.createGridCanvas(); // Create canvas for world render
        Input.init(); // Setup input listeners
        // Initialize WorldData first, then WorldManager which uses it
        WorldData.initializeGrid(); // Ensures grid array is created
        World.init(); // Init world data and static render
        // --- Log the generated grid AFTER generation ---
        logWorldGrid();
        ItemManager.init();
        EnemyManager.init();
        WaveManager.init(); // Init wave manager state
    } catch (error) {
        console.error("FATAL: Module Initialization Error:", error);
        initializationOk = false;
    }

    if (initializationOk) {
        try {
            // Create Player instance
            player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
        } catch (error) {
            console.error("FATAL: Player Creation Error:", error);
            initializationOk = false;
            // Display error
        }
        restartBtnRef = document.getElementById('restart-button');
        if (restartBtnRef) {
            restartBtnRef.addEventListener('click', () => {
                console.log("Restart button clicked!");
                // Only restart if game is actually over
                if (WaveManager.isGameOver()) {
                    restartGame();
                }
            });
        } else {
            console.warn("Restart button element not found during init.");
        }
    }

    if (initializationOk) {
        Input.consumeClick(); // Clear any initial clicks
        lastTime = performance.now(); // Set start time for dt calculation
        // gameRunning = true; // Not strictly needed if relying on game over state
        requestAnimationFrame(gameLoop); // Start the main loop
        UI.updateGameOverState(false); // Ensure button is hidden initially
        // console.log("Game initialization complete. Starting loop.");
    } else {
        console.error("Game initialization failed. Game will not start.");
    }
}
// --- Start the Game ---
window.addEventListener('DOMContentLoaded', init); // Run init after HTML is ready