// -----------------------------------------------------------------------------
// root/js/main.js - Game Entry Point and Main Loop
// -----------------------------------------------------------------------------

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
import * as GridCollision from './utils/gridCollision.js'; // Needed for worldToGridCoords

// --- Game State Enum ---
const GameState = Object.freeze({
    PRE_GAME: 'PRE_GAME',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER'
});
let currentGameState = GameState.PRE_GAME;

// --- Global Game Variables ---
let player = null;
let gameLoopId = null; // To store requestAnimationFrame ID for pausing/stopping
let lastTime = 0;

// --- Camera State ---
let cameraX = 0;
let cameraY = 0;
let cameraScale = 1.0; // 1.0 = normal zoom

// --- DOM References ---
let appContainer = null;
let gameOverlay = null;
// Button References
let startGameButton = null;
let resumeButton = null;
let restartButtonOverlay = null;
// Other Overlay Elements
let gameOverStatsP = null; // Reference for game over stats text

// --- Function to handle scale updates from input ---
// (Keep this function as it relates to camera, independent of overlay)
window.updateCameraScale = function(deltaScale) {
    const oldScale = cameraScale;
    let newScale = cameraScale + deltaScale;
    newScale = Math.max(Config.MIN_CAMERA_SCALE, Math.min(newScale, Config.MAX_CAMERA_SCALE));
    cameraScale = newScale;
}

// --- Coordinate Conversion Helpers ---
function getMouseWorldCoords(canvasX, canvasY) {
    const worldX = cameraX + (canvasX / cameraScale);
    const worldY = cameraY + (canvasY / cameraScale);
    return { x: worldX, y: worldY };
}

function getMouseGridCoords(canvasX, canvasY) {
    const { x: worldX, y: worldY } = getMouseWorldCoords(canvasX, canvasY);
    return GridCollision.worldToGridCoords(worldX, worldY);
}

function isTargetWithinRange(player, targetWorldPos) {
    if (!player || !targetWorldPos) return false;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    const dx = targetWorldPos.x - playerCenterX;
    const dy = targetWorldPos.y - playerCenterY;
    return (dx * dx + dy * dy) <= Config.PLAYER_INTERACTION_RANGE_SQ;
}

// --- Function to log the world grid ---
function logWorldGrid() {
    // console.log("--- World Grid Debug Output ---");
    // console.time("GridLog Generation");
    const blockToChar = {
        [Config.BLOCK_AIR]: ' ', [Config.BLOCK_WATER]: '~', [Config.BLOCK_SAND]: '.',
        [Config.BLOCK_DIRT]: '#', [Config.BLOCK_GRASS]: '"', [Config.BLOCK_STONE]: 'R',
        [Config.BLOCK_WOOD]: 'P', [Config.BLOCK_METAL]: 'M', [Config.BLOCK_BONE]: 'B' // Added Bone
    };
    const defaultChar = '?';
    let gridString = "";
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        let rowString = "";
        for (let c = 0; c < Config.GRID_COLS; c++) {
            rowString += blockToChar[WorldData.getBlockType(c, r)] ?? defaultChar;
        }
        gridString += rowString + "\n";
    }
    // console.log(gridString);
    // console.timeEnd("GridLog Generation");
    // console.log("--- End World Grid Debug Output ---");
}

// --- Overlay Management ---
function showOverlay(stateToShow) {
    // Uses references obtained during init
    if (!gameOverlay || !appContainer) {
         console.error("ShowOverlay: Core overlay/app container not found!");
         return;
    }

    gameOverlay.classList.remove('show-title', 'show-pause', 'show-gameover');

    switch (stateToShow) {
        case GameState.PRE_GAME:
            gameOverlay.classList.add('show-title');
            break;
        case GameState.PAUSED:
            gameOverlay.classList.add('show-pause');
            break;
        case GameState.GAME_OVER:
            gameOverlay.classList.add('show-gameover');
            if (gameOverStatsP) {
                 const finalWave = WaveManager.getCurrentWaveNumber() > 0 ? WaveManager.getCurrentWaveNumber() : 1;
                 gameOverStatsP.textContent = `You reached Wave ${finalWave}.`;
            } else {
                console.warn("ShowOverlay: gameOverStatsP element not found for GAME_OVER state.");
            }
            break;
    }
    gameOverlay.classList.add('active');
    appContainer.classList.add('overlay-active');
}

function hideOverlay() {
    if (!gameOverlay || !appContainer) return;
    gameOverlay.classList.remove('active');
    appContainer.classList.remove('overlay-active');
}

// --- Game State Control ---
function startGame() {
    // Starts the game from the title screen or after a restart
    if (currentGameState === GameState.RUNNING) return; // Prevent starting if already running
    // console.log(">>> Starting Game <<<");

    // --- Initialize Game UI Elements FIRST ---
    // This now happens *after* user clicks start, ensuring elements exist
    if (!UI.initGameUI()) {
        console.error("FATAL: Failed to initialize critical game UI elements. Aborting start.");
        // Optionally show an error message in the overlay
         showOverlay(GameState.PRE_GAME); // Stay on title screen
         alert("Error: Could not initialize game UI. Please check console and refresh."); // Simple error
        return;
    }

    currentGameState = GameState.RUNNING;
    hideOverlay(); // Hide overlay AFTER UI init succeeds

    // --- Initialize Game Logic Systems ---
    World.init(); // Generate world, create static canvas
    logWorldGrid(); // Log the generated world

    ItemManager.init(); // Clear/initialize items
    EnemyManager.init(); // Clear/initialize enemies
    WaveManager.init(); // Reset/initialize wave manager

// --- Create Player ---
    try {
        player = null;
        player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
        UI.setPlayerReference(player);
        UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus(), player.getSpearStatus(), player.getShovelStatus());
        const waveInfo = WaveManager.getWaveInfo();
        const livingEnemies = EnemyManager.getLivingEnemyCount();
        UI.updateWaveInfo(waveInfo, livingEnemies);
    } catch (error) {
        console.error("FATAL: Player Creation/Init Error Message:", error.message); // Log the message
        console.error("Error Stack:", error.stack);     // Log the stack trace
        currentGameState = GameState.PRE_GAME; // Revert state
        showOverlay(GameState.PRE_GAME);
        alert("Error creating player. Please check console and refresh.");
        return;
    }

    // --- Initial Camera Calculation ---
    calculateInitialCamera();

    // --- Start Game Loop ---
    Input.consumeClick(); // Clear any clicks during transition/load
    lastTime = performance.now(); // Set start time for dt calculation
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId); // Clear any potentially orphaned loop
    }
    gameLoopId = requestAnimationFrame(gameLoop); // START THE LOOP!
    console.log(">>> Game Loop Started <<<");
}

function pauseGame() {
    if (currentGameState !== GameState.RUNNING) return;
    console.log(">>> Pausing Game <<<");
    currentGameState = GameState.PAUSED;
    showOverlay(GameState.PAUSED);
    // Stop the game loop
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null; // Indicate loop is stopped
    }
}

function resumeGame() {
    if (currentGameState !== GameState.PAUSED) return;
    console.log(">>> Resuming Game <<<");
    currentGameState = GameState.RUNNING;
    hideOverlay();

    // Restart the loop
    lastTime = performance.now(); // IMPORTANT: Reset time to avoid huge dt jump
    if (!gameLoopId) { // Only start if not already running
        gameLoopId = requestAnimationFrame(gameLoop);
    }
}

function handleGameOver() {
    // Central function to manage game over state transition
    if (currentGameState === GameState.GAME_OVER) return; // Prevent multiple calls
    console.log(">>> Handling Game Over <<<");
    currentGameState = GameState.GAME_OVER;
    showOverlay(GameState.GAME_OVER); // This function now updates stats too

    // Stop the game loop
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }

    // Optional: Update final UI state in sidebars one last time
    // Could be useful if some UI elements don't update instantly
    const waveInfo = WaveManager.getWaveInfo(); // Get final info
    const livingEnemies = EnemyManager.getLivingEnemyCount(); // Should be 0 or low
    UI.updateWaveInfo(waveInfo, livingEnemies);
    if (player) {
         UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus(), player.getSpearStatus(), player.getShovelStatus());
    }
}

function restartGame() {
    // Called only by the overlay restart button
    if (currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.PAUSED) { // Allow restart from pause too?
        console.warn("Restart called but game not in GAME_OVER or PAUSED state.");
       // return; // Decide if you want to allow restart from pause
    }
    console.log(">>> Restarting Game <<<");
    // No need to hide overlay explicitly, startGame will do it.
    // Setting state allows startGame to proceed correctly.
    currentGameState = GameState.PRE_GAME;
    startGame(); // Re-run the full start sequence (clears state, resets managers, creates player, starts loop)
}

// --- Game Loop ---
function gameLoop(timestamp) {
    // If state is not RUNNING, the loop should not be executing updates.
    // The check here prevents accidental processing if state changes mid-frame.
    if (currentGameState !== GameState.RUNNING) {
        // Ensure loop ID is cleared if somehow called erroneously
        if (gameLoopId) {
             console.warn("Game loop called but game not running. State:", currentGameState, "Clearing loop ID.");
             cancelAnimationFrame(gameLoopId);
             gameLoopId = null;
        }
        return;
    }

    // --- Delta Time Calc ---
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    const dt = Math.min(deltaTime, Config.MAX_DELTA_TIME);

    // --- Game Over Check ---
    // Check Wave Manager first (e.g., explicit game over condition)
    if (WaveManager.isGameOver()) {
        handleGameOver();
        return; // Stop processing this frame
    }
    // Check Player health
    if (player && player.getCurrentHealth() <= 0) {
        // Consider adding a small delay or death animation trigger here
        WaveManager.setGameOver(); // Inform wave manager (might be redundant if health check sets it)
        handleGameOver();
        return; // Stop processing this frame
    }

    // --- Input Phase ---
    const inputState = Input.getState();
    const mousePos = Input.getMousePosition();
    let targetWorldPos = getMouseWorldCoords(mousePos.x, mousePos.y);
    let targetGridCell = getMouseGridCoords(mousePos.x, mousePos.y);
    // Range check is handled within player update/actions

    // --- Update Phase ---
    let currentPlayerPosition = null;
    if (player) {
        player.update(dt, inputState, targetWorldPos, targetGridCell); // Pass target info
        currentPlayerPosition = player.getPosition(); // Get position for AI
    }
    ItemManager.update(dt);
    EnemyManager.update(dt, currentPlayerPosition); // Pass player pos to enemies
    WaveManager.update(dt); // Handles wave timing, spawning
    World.update(dt); // Handles block physics, etc.

    // --- Camera Calculation ---
    calculateCameraPosition(); // Encapsulate camera update logic

    // --- Collision Detection Phase ---
    if (player) {
        CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
        CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
        CollisionManager.checkPlayerAttackBlockCollisions(player);
        CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies());
    }
    // CollisionManager.checkEnemyEnemyCollisions(EnemyManager.getEnemies()); // If needed
    // CollisionManager.checkProjectileCollisions(...); // Future


    // --- Render Phase ---
    Renderer.clear(); // Clear main canvas
    const mainCtx = Renderer.getContext();
    mainCtx.save(); // Save context state
    // Apply Camera Transformations
    mainCtx.scale(cameraScale, cameraScale);
    mainCtx.translate(-cameraX, -cameraY);

    // --- Draw World Elements (Relative to World Coords) ---
    World.draw(mainCtx); // Draw static world background
    ItemManager.draw(mainCtx); // Draw items
    EnemyManager.draw(mainCtx); // Draw enemies
    if (player) {
        player.draw(mainCtx); // Draw player
        // Draw Ghost Block - ensure player instance handles its own drawing logic including this
        player.drawGhostBlock(mainCtx); // Pass context to player method if it handles drawing
    }

    mainCtx.restore(); // Restore context to un-scaled, un-translated state

     // --- Draw UI Elements Relative to Screen Coords ---
    Input.drawControls(mainCtx); // Draw touch controls *after* restore

    // --- Update Sidebar UI ---
    // (Do this every frame while running)
    const waveInfo = WaveManager.getWaveInfo();
    const livingEnemies = EnemyManager.getLivingEnemyCount();
    UI.updateWaveInfo(waveInfo, livingEnemies);
    if (player) {
        UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus(), player.getSpearStatus(), player.getShovelStatus());
    }

    // Consume click state (relevant for attack/interaction)
    Input.consumeClick();

    // --- Loop Continuation ---
    // Schedule the next frame *only* if still running
     if (currentGameState === GameState.RUNNING) {
        gameLoopId = requestAnimationFrame(gameLoop);
     } else {
         gameLoopId = null; // Ensure ID is cleared if state changed mid-frame
     }
}

// --- Initialization ---
function init() {
    // console.log("DOM loaded, initializing...");
    currentGameState = GameState.PRE_GAME; // Set initial state

    try {
        // --- Get Essential Container Refs FIRST ---
        appContainer = document.getElementById('app-container');
        gameOverlay = document.getElementById('game-overlay'); // Needed for UI.initOverlay potentially

        if (!appContainer || !gameOverlay) {
             throw new Error("Essential container elements (#app-container or #game-overlay) not found!");
        }

        // --- Initialize Core Systems that DON'T depend on specific game elements ---
        // Renderer needs canvas, check if it exists structurally FIRST
        const canvas = document.getElementById('game-canvas');
         if (!canvas) {
             // This is the likely culprit for the renderer error.
             throw new Error("Renderer Init Check: Canvas element 'game-canvas' not found in HTML structure!");
         }
        // NOW it's safe to initialize renderer
        Renderer.init();
        Renderer.createGridCanvas();
        Input.init(); // Safe to init input listeners

        // --- Initialize ONLY the Overlay UI ---
        // Use the correctly named function from the refactored ui.js
        if (!UI.initOverlay()) {
             throw new Error("Failed to initialize overlay UI elements!");
        }

        // --- Get Overlay Button/Stats References ---
        // (Getting these references here is fine as they are part of the overlay)
        startGameButton = document.getElementById('start-game-button');
        resumeButton = document.getElementById('resume-button');
        restartButtonOverlay = document.getElementById('restart-button-overlay');
        gameOverStatsP = document.getElementById('gameover-stats');

         if (!startGameButton || !resumeButton || !restartButtonOverlay || !gameOverStatsP) {
             throw new Error("Essential Overlay Button/Stats elements not found!");
         }

        // --- Setup Event Listeners ---
        startGameButton.addEventListener('click', startGame);
        resumeButton.addEventListener('click', resumeGame);
        restartButtonOverlay.addEventListener('click', restartGame);

        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (currentGameState === GameState.RUNNING) {
                    pauseGame();
                } else if (currentGameState === GameState.PAUSED) {
                    resumeGame();
                }
            }
             // Add other keybinds here if needed
        });

        // --- Show Initial State ---
        showOverlay(GameState.PRE_GAME);
        // console.log("Base initialization complete. Showing title screen.");

    } catch (error) {
        console.error("FATAL: Initialization Error:", error);
        // Display error in overlay (keep existing error display logic)
        if (gameOverlay) { // Check if overlay ref was obtained
            gameOverlay.innerHTML = `<div class="overlay-content" style="display: flex; flex-direction: column; align-items: center; color: red;"><h1>Initialization Error</h1><p>${error.message}</p><p>Please check the console (F12) and refresh.</p></div>`;
            gameOverlay.classList.add('active', 'show-title'); // Ensure visible
            if(appContainer) appContainer.classList.add('overlay-active'); // Dim background if possible
        } else {
            // Fallback if even overlay isn't found
            alert(`FATAL Initialization Error:\n${error.message}\nPlease check console (F12) and refresh.`);
        }
    }
}

// --- Camera Calculation Helper ---
function calculateInitialCamera() {
    // Calculates camera position based on player, called after player exists
     if (player) {
        const viewWidth = Renderer.getCanvas().width;
        const viewHeight = Renderer.getCanvas().height;
        // cameraScale should be reset to default on new game? Assume 1.0
        cameraScale = 1.0;
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;
        cameraX = (player.x + player.width / 2) - (visibleWorldWidth / 2);
        cameraY = (player.y + player.height / 2) - (visibleWorldHeight / 2);

        const worldPixelWidth = Config.CANVAS_WIDTH;
        const worldPixelHeight = Config.CANVAS_HEIGHT;
        const maxCameraX = worldPixelWidth - visibleWorldWidth;
        cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
        const maxCameraY = worldPixelHeight - visibleWorldHeight;
        cameraY = Math.max(0, Math.min(cameraY, maxCameraY));
         if (worldPixelWidth < visibleWorldWidth) { cameraX = (worldPixelWidth - visibleWorldWidth) / 2; }
         if (worldPixelHeight < visibleWorldHeight) { cameraY = (worldPixelHeight - visibleWorldHeight) / 2; }
    }
     else {
         // Default camera if somehow no player (shouldn't happen in startGame)
         cameraX = 0; cameraY = 0; cameraScale = 1.0;
     }
}

function calculateCameraPosition() {
    // Updates camera position based on player during gameplay
     if (player) {
        const viewWidth = Renderer.getCanvas().width;
        const viewHeight = Renderer.getCanvas().height;
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;

        // Smooth camera follow? Lerp? For now, direct follow:
        let targetX = (player.x + player.width / 2) - (visibleWorldWidth / 2);
        let targetY = (player.y + player.height / 2) - (visibleWorldHeight / 2);

        // Direct follow:
        cameraX = targetX;
        cameraY = targetY;


        // Clamp camera
        const worldPixelWidth = Config.CANVAS_WIDTH;
        const worldPixelHeight = Config.CANVAS_HEIGHT;
        const maxCameraX = worldPixelWidth - visibleWorldWidth;
        cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
        const maxCameraY = worldPixelHeight - visibleWorldHeight;
        cameraY = Math.max(0, Math.min(cameraY, maxCameraY));
        if (worldPixelWidth < visibleWorldWidth) { cameraX = (worldPixelWidth - visibleWorldWidth) / 2; }
        if (worldPixelHeight < visibleWorldHeight) { cameraY = (worldPixelHeight - visibleWorldHeight) / 2; }
    }
     // Don't change camera if no player (e.g., during game over)
}


// --- Start the Initialization Process ---
window.addEventListener('DOMContentLoaded', init); // Run init after HTML is ready