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
import * as WorldData from './utils/worldData.js'; // May not be needed directly here anymore
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

// --- DOM References (Mainly for overlay/app container) ---
let appContainer = null;
let gameOverlay = null;
// Button References (Overlay only)
let startGameButton = null;
let resumeButton = null;
let restartButtonOverlay = null;
// Other Overlay Elements
let gameOverStatsP = null; // Reference for game over stats text

// --- Global Function Exposure ---
// Expose pauseGame globally via window object for the UI button callback
window.pauseGameCallback = pauseGame;
// Expose updateCameraScale globally for the input wheel handler
window.updateCameraScale = function(deltaScale) {
    const oldScale = cameraScale;
    let newScale = cameraScale + deltaScale;
    // Clamp scale within defined limits
    newScale = Math.max(Config.MIN_CAMERA_SCALE, Math.min(newScale, Config.MAX_CAMERA_SCALE));
    cameraScale = newScale;
    // Note: Camera position clamping needs to account for new scale,
    // this happens naturally in calculateCameraPosition if called after scale update.
}

// --- Coordinate Conversion Helpers ---
function getMouseWorldCoords(canvasX, canvasY) {
    // Convert canvas pixel coordinates to world coordinates, considering camera position and scale
    const worldX = cameraX + (canvasX / cameraScale);
    const worldY = cameraY + (canvasY / cameraScale);
    return { x: worldX, y: worldY };
}

function getMouseGridCoords(canvasX, canvasY) {
    // Convert canvas pixel coordinates directly to grid coordinates
    const { x: worldX, y: worldY } = getMouseWorldCoords(canvasX, canvasY);
    return GridCollision.worldToGridCoords(worldX, worldY);
}

// Helper to check range (already exists in player.js, keep here for potential other uses?)
function isTargetWithinRange(player, targetWorldPos) {
    if (!player || !targetWorldPos) return false;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    const dx = targetWorldPos.x - playerCenterX;
    const dy = targetWorldPos.y - playerCenterY;
    return (dx * dx + dy * dy) <= Config.PLAYER_INTERACTION_RANGE_SQ;
}

// --- Function to log the world grid (for debugging) ---
function logWorldGrid() {
    // console.log("--- World Grid Debug Output ---");
    // console.time("GridLog Generation");
    const blockToChar = {
        [Config.BLOCK_AIR]: ' ', [Config.BLOCK_WATER]: '~', [Config.BLOCK_SAND]: '.',
        [Config.BLOCK_DIRT]: '#', [Config.BLOCK_GRASS]: '"', [Config.BLOCK_STONE]: 'R',
        [Config.BLOCK_WOOD]: 'P', [Config.BLOCK_METAL]: 'M', [Config.BLOCK_BONE]: 'B'
    };
    const defaultChar = '?';
    let gridString = "";
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        let rowString = "";
        for (let c = 0; c < Config.GRID_COLS; c++) {
            // Use WorldData.getBlockType which handles the object/number distinction
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
    if (!gameOverlay || !appContainer) {
         console.error("ShowOverlay: Core overlay/app container not found!");
         return;
    }

    // Remove previous state classes
    gameOverlay.classList.remove('show-title', 'show-pause', 'show-gameover');

    // Add class for the current state
    switch (stateToShow) {
        case GameState.PRE_GAME:
            gameOverlay.classList.add('show-title');
            break;
        case GameState.PAUSED:
            gameOverlay.classList.add('show-pause');
            break;
        case GameState.GAME_OVER:
            gameOverlay.classList.add('show-gameover');
            // Update game over stats text if element exists
            if (gameOverStatsP) {
                 const finalWave = WaveManager.getCurrentWaveNumber() > 0 ? WaveManager.getCurrentWaveNumber() : 1; // Use wave number
                 gameOverStatsP.textContent = `You reached Wave ${finalWave}.`;
            } else {
                console.warn("ShowOverlay: gameOverStatsP element not found for GAME_OVER state.");
            }
            break;
    }
    // Make overlay visible and dim background
    gameOverlay.classList.add('active');
    appContainer.classList.add('overlay-active');
}

function hideOverlay() {
    if (!gameOverlay || !appContainer) return;
    gameOverlay.classList.remove('active');
    appContainer.classList.remove('overlay-active');
}

// --- Game State Control ---

/** Starts a new game or restarts after game over/pause. */
function startGame() {
    if (currentGameState === GameState.RUNNING) return; // Prevent starting if already running
    console.log(">>> Starting Game <<<");

    // 1. Initialize Game UI Elements FIRST (Finds elements, creates dynamic slots, adds listeners)
    if (!UI.initGameUI()) {
        console.error("FATAL: Failed to initialize critical game UI elements. Aborting start.");
        showOverlay(GameState.PRE_GAME); // Stay on title screen
        alert("Error: Could not initialize game UI. Please check console and refresh.");
        return;
    }
    // 2. Reset player reference in UI *before* creating new player (important for restarts)
    UI.setPlayerReference(null);

    // 3. Set game state and hide overlay
    currentGameState = GameState.RUNNING;
    hideOverlay(); // Hide overlay AFTER UI init succeeds

    // 4. Initialize Game Logic Systems
    // WorldData.initializeGrid(); // REMOVED - WorldManager.init() handles this now.
    World.init(); // Generates world, creates static canvas, calls WorldData.initializeGrid() internally.
    // logWorldGrid(); // Optional: Log the generated grid for debugging

    ItemManager.init(); // Clear/initialize items, spawn starting weapons
    EnemyManager.init(); // Clear/initialize enemy list
    WaveManager.init(); // Reset/initialize wave manager to Wave 1 start

    // 5. Create Player Instance
    try {
        player = null; // Ensure old reference is cleared
        player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);

        // 6. Set Player Reference in UI *after* player is created
        UI.setPlayerReference(player); // UI can now access player data for updates and button clicks

        // Initial UI updates will now happen within the first game loop frame
        // or triggered by setPlayerReference if implemented there.

    } catch (error) {
        console.error("FATAL: Player Creation/Init Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        currentGameState = GameState.PRE_GAME; // Revert state
        showOverlay(GameState.PRE_GAME);
        alert("Error creating player. Please check console and refresh.");
        return;
    }

    // 7. Calculate Initial Camera Position
    calculateInitialCamera(); // Center camera on player

    // 8. Start Game Loop
    Input.consumeClick(); // Clear any clicks during transition/load
    lastTime = performance.now(); // Set start time for delta time calculation
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId); // Clear any potentially orphaned loop
    }
    gameLoopId = requestAnimationFrame(gameLoop); // START THE LOOP!
    console.log(">>> Game Loop Started <<<");
}

/** Pauses the currently running game. */
function pauseGame() { // This function is exposed via window.pauseGameCallback
    if (currentGameState !== GameState.RUNNING) return; // Can only pause if running
    console.log(">>> Pausing Game <<<");
    currentGameState = GameState.PAUSED;
    showOverlay(GameState.PAUSED); // Show the pause menu overlay
    // Stop the game loop
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null; // Indicate loop is stopped
    }
}

/** Resumes the game from a paused state. */
function resumeGame() {
    if (currentGameState !== GameState.PAUSED) return; // Can only resume if paused
    console.log(">>> Resuming Game <<<");
    currentGameState = GameState.RUNNING;
    hideOverlay(); // Hide the pause overlay

    // Restart the game loop
    lastTime = performance.now(); // IMPORTANT: Reset time to avoid huge dt jump after pause
    if (!gameLoopId) { // Only start if not already running (shouldn't be, but safe check)
        gameLoopId = requestAnimationFrame(gameLoop);
    }
}

/** Handles the transition to the game over state. */
function handleGameOver() {
    if (currentGameState === GameState.GAME_OVER) return; // Prevent multiple calls
    console.log(">>> Handling Game Over <<<");
    currentGameState = GameState.GAME_OVER;
    showOverlay(GameState.GAME_OVER); // Show game over overlay (updates stats text internally)

    // Stop the game loop
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }

    // Perform a final UI update to show the end-game state
    const waveInfo = WaveManager.getWaveInfo(); // Get final info
    const livingEnemies = EnemyManager.getLivingEnemyCount(); // Should be 0 or low
    UI.updateWaveInfo(waveInfo, livingEnemies);
    if (player) {
         // Update health (likely 0), inventory, weapon status one last time
         UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus(), player.getSpearStatus(), player.getShovelStatus());
    }
}

/** Restarts the game from the game over screen or potentially pause menu. */
function restartGame() {
    // Allow restart from GAME_OVER or PAUSED state
    if (currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.PAUSED) {
        console.warn("Restart called but game not in GAME_OVER or PAUSED state.");
        // Optionally return if you only want restart from Game Over
    }
    console.log(">>> Restarting Game <<<");
    // No need to hide overlay explicitly, startGame will handle it.
    // Setting state allows startGame to proceed correctly.
    currentGameState = GameState.PRE_GAME; // Set state as if before starting
    startGame(); // Re-run the full start sequence (clears state, resets managers, creates player, starts loop)
}

// --- Game Loop ---
function gameLoop(timestamp) {
    // Ensure loop doesn't run if game state is not RUNNING
    if (currentGameState !== GameState.RUNNING) {
        if (gameLoopId) {
             console.warn("Game loop called unexpectedly while not running. State:", currentGameState);
             cancelAnimationFrame(gameLoopId);
             gameLoopId = null;
        }
        return;
    }

    // --- Delta Time Calculation ---
    const deltaTime = (timestamp - lastTime) / 1000; // Time since last frame in seconds
    lastTime = timestamp;
    // Clamp delta time to prevent physics glitches if frame rate drops significantly
    const dt = Math.min(deltaTime, Config.MAX_DELTA_TIME);

    // --- Game Over Checks ---
    // Check conditions that trigger game over (WaveManager might have specific loss conditions)
    if (WaveManager.isGameOver()) {
        handleGameOver(); // Transition to game over state
        return; // Stop processing this frame
    }
    // Check Player health
    if (player && player.getCurrentHealth() <= 0) {
        WaveManager.setGameOver(); // Inform wave manager (might be redundant)
        handleGameOver(); // Transition to game over state
        return; // Stop processing this frame
    }

    // --- Input Phase ---
    // Get combined state from keyboard and UI buttons
    const inputState = Input.getState();
    // Get mouse position for aiming/interaction
    const mousePos = Input.getMousePosition();
    let targetWorldPos = getMouseWorldCoords(mousePos.x, mousePos.y);
    let targetGridCell = getMouseGridCoords(mousePos.x, mousePos.y);
    // Range check is handled within player update/actions

    // --- Update Phase ---
    let currentPlayerPosition = null;
    if (player) {
        player.update(dt, inputState, targetWorldPos, targetGridCell); // Pass full input state and target info
        currentPlayerPosition = player.getPosition(); // Get updated position for AI
    }
    ItemManager.update(dt); // Update item physics (bobbing, falling)
    EnemyManager.update(dt, currentPlayerPosition); // Update enemies, passing player position
    WaveManager.update(dt); // Update wave timing, spawning logic
    World.update(dt); // Update world effects (e.g., water flow - currently placeholder)

    // --- Camera Calculation ---
    calculateCameraPosition(); // Update camera position based on player movement and scale

    // --- Collision Detection Phase ---
    if (player) {
        CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
        CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
        CollisionManager.checkPlayerAttackBlockCollisions(player); // Check attacks vs world blocks
        CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies()); // Player taking contact damage
    }
    // Add other collision checks as needed (enemy-enemy, projectile-world, etc.)

    // --- Render Phase ---
    Renderer.clear(); // Clear main canvas
    const mainCtx = Renderer.getContext();
    mainCtx.save(); // Save context state (important before transformations)

    // Apply Camera Transformations (Scale and Translate)
    mainCtx.scale(cameraScale, cameraScale);
    mainCtx.translate(-cameraX, -cameraY);

    // --- Draw World Elements (Relative to World Coordinates) ---
    World.draw(mainCtx); // Draw static world background (pre-rendered blocks)
    ItemManager.draw(mainCtx); // Draw items
    EnemyManager.draw(mainCtx); // Draw enemies
    if (player) {
        player.draw(mainCtx); // Draw player sprite and held weapon visual
        player.drawGhostBlock(mainCtx); // Draw placement preview
    }

    mainCtx.restore(); // Restore context to un-scaled, un-translated state

     // --- Draw Screen-Relative UI Elements (AFTER restore) ---
    // Input.drawControls(mainCtx); // REMOVED - Controls are now HTML elements

    // --- Update Sidebar UI ---
    // This updates the HTML elements outside the canvas every frame while running
    const waveInfo = WaveManager.getWaveInfo();
    const livingEnemies = EnemyManager.getLivingEnemyCount();
    UI.updateWaveInfo(waveInfo, livingEnemies); // Update top sidebar portal info
    if (player) {
        // Update top sidebar health AND bottom sidebar inventory/weapon states
        UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus(), player.getSpearStatus(), player.getShovelStatus());
    }

    // Consume attack input state AFTER all updates and rendering for the frame
    Input.consumeClick(); // Resets the Input.state.attack flag

    // --- Loop Continuation ---
    // Schedule the next frame *only* if still running
     if (currentGameState === GameState.RUNNING) {
        gameLoopId = requestAnimationFrame(gameLoop);
     } else {
         gameLoopId = null; // Ensure ID is cleared if state changed mid-frame
     }
}

// --- Initialization ---
/** Initializes the game application on page load. */
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
             throw new Error("Renderer Init Check: Canvas element 'game-canvas' not found in HTML structure!");
         }
        // NOW it's safe to initialize renderer and create offscreen canvas
        Renderer.init();
        Renderer.createGridCanvas(); // Create the off-screen canvas for the world background
        Input.init(); // Setup keyboard/mouse listeners and expose Input.state

        // --- Initialize ONLY the Overlay UI ---
        // Finds overlay elements needed for showing/hiding states
        if (!UI.initOverlay()) {
             throw new Error("Failed to initialize overlay UI elements!");
        }

        // --- Get Overlay Button/Stats References (needed for listeners below) ---
        startGameButton = document.getElementById('start-game-button');
        resumeButton = document.getElementById('resume-button');
        restartButtonOverlay = document.getElementById('restart-button-overlay');
        gameOverStatsP = document.getElementById('gameover-stats');

         if (!startGameButton || !resumeButton || !restartButtonOverlay || !gameOverStatsP) {
             throw new Error("Essential Overlay Button/Stats elements not found!");
         }

        // --- Setup Event Listeners (Overlay buttons) ---
        startGameButton.addEventListener('click', startGame);
        resumeButton.addEventListener('click', resumeGame);
        restartButtonOverlay.addEventListener('click', restartGame);
        // Pause via keyboard (Esc) is handled in input.js
        // Pause via UI button is handled in ui.js calling the global callback

        // --- Show Initial State ---
        showOverlay(GameState.PRE_GAME); // Display the title screen overlay
        // console.log("Base initialization complete. Showing title screen.");

    } catch (error) {
        console.error("FATAL: Initialization Error:", error);
        // Display error message in the overlay if possible
        if (gameOverlay) {
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
/** Calculates the initial camera position and scale when starting a game. */
function calculateInitialCamera() {
     if (player) {
        const viewWidth = Renderer.getCanvas().width;
        const viewHeight = Renderer.getCanvas().height;
        // Reset camera scale to default on new game
        cameraScale = 1.0;
        // Calculate the world area visible through the viewport
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;
        // Center camera X and Y on the player's center
        cameraX = (player.x + player.width / 2) - (visibleWorldWidth / 2);
        cameraY = (player.y + player.height / 2) - (visibleWorldHeight / 2);

        // Clamp camera position to world boundaries
        const worldPixelWidth = Config.CANVAS_WIDTH;
        const worldPixelHeight = Config.CANVAS_HEIGHT;
        // Calculate max scroll positions based on current scale
        const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth); // Ensure max is not negative
        cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
        const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);
        cameraY = Math.max(0, Math.min(cameraY, maxCameraY));
        // Center camera if world is smaller than viewport (zoomed out too far)
         if (worldPixelWidth <= visibleWorldWidth) { cameraX = (worldPixelWidth - visibleWorldWidth) / 2; }
         if (worldPixelHeight <= visibleWorldHeight) { cameraY = (worldPixelHeight - visibleWorldHeight) / 2; }
    }
     else {
         // Default camera position if somehow no player (shouldn't happen in startGame)
         cameraX = 0; cameraY = 0; cameraScale = 1.0;
     }
}

/** Updates the camera position during gameplay, typically following the player. */
function calculateCameraPosition() {
     if (player) {
        const viewWidth = Renderer.getCanvas().width;
        const viewHeight = Renderer.getCanvas().height;
        // Calculate visible world dimensions based on current scale
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;

        // Target camera position to center on player
        // (Could add smoothing/lerping here later for smoother follow)
        let targetX = (player.x + player.width / 2) - (visibleWorldWidth / 2);
        let targetY = (player.y + player.height / 2) - (visibleWorldHeight / 2);

        // Direct follow for now:
        cameraX = targetX;
        cameraY = targetY;

        // Clamp camera position to world boundaries based on current scale
        const worldPixelWidth = Config.CANVAS_WIDTH;
        const worldPixelHeight = Config.CANVAS_HEIGHT;
        const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth);
        cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
        const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);
        cameraY = Math.max(0, Math.min(cameraY, maxCameraY));
        // Center if world smaller than viewport
        if (worldPixelWidth <= visibleWorldWidth) { cameraX = (worldPixelWidth - visibleWorldWidth) / 2; }
        if (worldPixelHeight <= visibleWorldHeight) { cameraY = (worldPixelHeight - visibleWorldHeight) / 2; }
    }
     // Don't update camera if no player (e.g., during game over screen)
}


// --- Start the Initialization Process when the DOM is ready ---
window.addEventListener('DOMContentLoaded', init);