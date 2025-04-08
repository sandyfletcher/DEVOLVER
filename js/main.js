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

// --- Global Game Variables ---
let player = null;
let gameRunning = true;
let lastTime = 0;
let restartBtnRef = null; // Variable to hold button reference

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
    ItemManager.init();
    EnemyManager.clearAllEnemies();
    WaveManager.reset();
    // Reset Game Loop State
    lastTime = performance.now();
    gameRunning = true;
    Input.consumeClick();

    // Initial UI Update after reset (optional, loop will catch it)
    const waveInfo = WaveManager.getWaveInfo();
    const livingEnemies = EnemyManager.getLivingEnemyCount();
    UI.updateWaveInfo(waveInfo, livingEnemies);
    UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus());
    UI.updateGameOverState(false);

    console.log(">>> GAME RESTARTED <<<");
}

// --- Game Loop ---
function gameLoop(timestamp) {
    // --- Delta Time Calc ---
    // Calculate dt first, always needed
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    const dt = Math.min(deltaTime, Config.MAX_DELTA_TIME);

    // --- Game Over Check ---
    // Check player health AFTER potential updates/collisions
    // Check wave manager state as well
    let isGameOver = WaveManager.isGameOver();
    if (!isGameOver && player && player.getCurrentHealth() <= 0) {
        console.log("Game Over detected in loop (Player health <= 0). Setting state.");
        WaveManager.setGameOver();
        isGameOver = true; // Update local flag for this frame
        UI.updateGameOverState(true, WaveManager.getCurrentWaveNumber());
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

        // No restart check here anymore

        requestAnimationFrame(gameLoop);
        return;
    }
    
    // --- If Game is Active, Proceed with Normal Loop ---
    // gameRunning flag might not be needed if game over state handles loop exit
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
        World.init(); // Init world data and static render
        ItemManager.init();
        EnemyManager.init();
        WaveManager.init(); // Init wave manager state
    } catch (error) {
        console.error("FATAL: Module Initialization Error:", error);
        initializationOk = false;
        // Potentially display error to user in HTML
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
        console.log("Game initialization complete. Starting loop.");
    } else {
        console.error("Game initialization failed. Game will not start.");
        // Display a user-friendly error message in the HTML body/overlay
    }
}
// --- Start the Game ---
window.addEventListener('DOMContentLoaded', init); // Run init after HTML is ready