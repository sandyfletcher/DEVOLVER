// -----------------------------------------------------------------------------
// root/js/main.js - Game Entry Point and Main Loop
// -----------------------------------------------------------------------------

// --- Module Imports ---
import * as UI from './ui.js';
import { Player, isTargetWithinRange } from './player.js';
import * as Input from './input.js';
import * as Config from './config.js';
import * as Renderer from './renderer.js';
import * as CollisionManager from './collisionManager.js';
import * as World from './worldManager.js'; // WorldManager now handles dynamic world updates and draw coordination
import * as ItemManager from './itemManager.js';
import * as EnemyManager from './enemyManager.js';
import * as WaveManager from './waveManager.js'; // Updated WaveManager
// import * as WorldData from './utils/worldData.js'; // May not be needed directly here anymore
import * as GridCollision from './utils/gridCollision.js'; // Needed for worldToGridCoords
import * as AudioManager from './audioManager.js'; // <-- IMPORT AUDIO MANAGER

// --- Game State Enum ---
const GameState = Object.freeze({
    PRE_GAME: 'PRE_GAME', // Before first game starts (Title Screen)
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER', // Player died
    VICTORY: 'VICTORY' // All waves cleared
});
let currentGameState = GameState.PRE_GAME;

// --- Global Game Variables ---
let player = null;
let gameLoopId = null; // To store requestAnimationFrame ID for pausing/stopping
let lastTime = 0;
let gameStartTime = 0; // Track when the current game started (for total playtime/stats)

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

// --- Helper function to get world dimensions in pixels ---
// (These correctly return the internal canvas size, which matches the world size)
function getWorldPixelWidth() {
    return Config.CANVAS_WIDTH; // Use the internal canvas width from config
}
function getWorldPixelHeight() {
    return Config.CANVAS_HEIGHT; // Use the internal canvas height from config
}

// --- Global Function Exposure ---
// Expose pauseGame globally via window object for the UI button callback
window.pauseGameCallback = pauseGame;

// Expose updateCameraScale globally for the input wheel handler
window.updateCameraScale = function(deltaScale) {
    const oldScale = cameraScale;
    let newScale = cameraScale + deltaScale;

    // --- Calculate the minimum scale required to fill the viewport ---
    const internalCanvasWidth = Config.CANVAS_WIDTH;
    const internalCanvasHeight = Config.CANVAS_HEIGHT;
    const worldPixelWidth = getWorldPixelWidth();
    const worldPixelHeight = getWorldPixelHeight();

    // Avoid division by zero, default to 1 if dimensions are invalid
    const scaleToFitWidth = (worldPixelWidth > 0) ? internalCanvasWidth / worldPixelWidth : 1;
    const scaleToFitHeight = (worldPixelHeight > 0) ? internalCanvasHeight / worldPixelHeight : 1;

    // Minimum scale required to ensure the world fills the view horizontally AND vertically
    const minScaleRequired = Math.max(scaleToFitWidth, scaleToFitHeight);

    // The effective minimum scale is the LARGER of the configured limit and the required limit
    const effectiveMinScale = Math.max(Config.MIN_CAMERA_SCALE, minScaleRequired);

    // --- Clamp the new scale ---
    // Apply effective minimum and user-defined maximum
    newScale = Math.max(effectiveMinScale, Math.min(newScale, Config.MAX_CAMERA_SCALE));

    // Apply the final clamped scale
    cameraScale = newScale;

    // Camera position will be re-clamped in the next game loop by calculateCameraPosition
}

// --- Coordinate Conversion Helpers ---
// These should now work correctly as inputMousePos provides internal coords
function getMouseWorldCoords(inputMousePos) {
    // Convert INTERNAL canvas pixel coordinates to world coordinates
    const worldX = cameraX + (inputMousePos.x / cameraScale);
    const worldY = cameraY + (inputMousePos.y / cameraScale);
    return { x: worldX, y: worldY };
}

function getMouseGridCoords(inputMousePos) {
    // Convert INTERNAL canvas pixel coordinates directly to grid coordinates
    const { x: worldX, y: worldY } = getMouseWorldCoords(inputMousePos);
    return GridCollision.worldToGridCoords(worldX, worldY); // worldToGridCoords uses BLOCK_WIDTH/HEIGHT
}

// --- Function to log the world grid (for debugging) ---
// Kept for potential future use if needed
// function logWorldGrid() {
//     console.log("--- World Grid Debug Output ---");
//     console.time("GridLog Generation");
//     const blockToChar = {
//         [Config.BLOCK_AIR]: ' ', [Config.BLOCK_WATER]: '~', [Config.BLOCK_SAND]: '.',
//         [Config.BLOCK_DIRT]: '#', [Config.BLOCK_GRASS]: '"', [Config.BLOCK_STONE]: 'R',
//         [Config.BLOCK_WOOD]: 'P', [Config.BLOCK_METAL]: 'M', [Config.BLOCK_BONE]: 'B'
//     };
//     const defaultChar = '?';
//     let gridString = "";
//     for (let r = 0; r < Config.GRID_ROWS; r++) {
//         let rowString = "";
//         for (let c = 0; c < Config.GRID_COLS; c++) {
//             // Use WorldData.getBlockType which handles the object/number distinction
//             rowString += blockToChar[WorldData.getBlockType(c, r)] ?? defaultChar;
//         }
//         gridString += rowString + "\n";
//     }
//     console.log(gridString);
//     console.timeEnd("GridLog Generation");
//     console.log("--- End World Grid Debug Output ---");
// }

// --- Overlay Management ---
function showOverlay(stateToShow) {
    if (!gameOverlay || !appContainer) {
         console.error("ShowOverlay: Core overlay/app container not found!");
         return;
    }

    // Remove previous state classes
    gameOverlay.classList.remove('show-title', 'show-pause', 'show-gameover', 'show-victory'); // Add 'show-victory'

    // Add class for the current state
    switch (stateToShow) {
        case GameState.PRE_GAME:
            gameOverlay.classList.add('show-title');
            AudioManager.stopMusic(); // Ensure music is stopped on title screen
            break;
        case GameState.PAUSED:
            gameOverlay.classList.add('show-pause');
            AudioManager.pauseMusic(); // Pause music when game is paused
            break;
        case GameState.GAME_OVER:
            gameOverlay.classList.add('show-gameover');
            // Update game over stats text if element exists
            if (gameOverStatsP) {
                 const finalWave = WaveManager.getCurrentWaveNumber(); // Get wave number reached
                 gameOverStatsP.textContent = `You reached Wave ${finalWave}.`;
            } else {
                console.warn("ShowOverlay: gameOverStatsP element not found for GAME_OVER state.");
            }
            AudioManager.stopMusic(); // Stop music on game over (WaveManager also does this, but redundancy is ok)
            break;
        case GameState.VICTORY:
            gameOverlay.classList.add('show-victory');
            // Add victory text/stats here if desired
            if (gameOverStatsP) { // Re-use gameover stats element for simplicity, or add a new one
                 gameOverStatsP.textContent = `You cleared all ${Config.WAVES.length} waves!`;
            } else {
                 console.warn("ShowOverlay: gameOverStatsP element not found for VICTORY state.");
            }
            AudioManager.stopMusic(); // Stop music on victory (WaveManager also does this)
            break;
    }
    // Make overlay visible and dim background
    gameOverlay.classList.add('active');
    appContainer.classList.add('overlay-active');
}

function hideOverlay() {
    if (!gameOverlay || !appContainer) return;
    gameOverlay.classList.remove('active');
    // Ensure background interaction is re-enabled
     appContainer.classList.remove('overlay-active'); // Redundant, but safe

     // Resume music if transitioning from PAUSED to RUNNING
     if (currentGameState === GameState.RUNNING) {
         AudioManager.resumeMusic();
     }
}

// --- Game State Control ---

/** Starts a new game or restarts after game over/pause/victory. */
function startGame() {
    // Allow starting from PRE_GAME, PAUSED (effectively restarting), GAME_OVER, VICTORY
    if (currentGameState === GameState.RUNNING) {
        console.warn("startGame called but game already RUNNING.");
        return; // Prevent starting if already running
    }
    console.log(">>> Starting Game <<<");

    // 1. Initialize Game UI Elements FIRST (Finds elements, creates dynamic slots, adds listeners)
    // UI.initGameUI clears old slots and listeners internally.
    if (!UI.initGameUI()) {
        console.error("FATAL: Failed to initialize critical game UI elements. Aborting start.");
        currentGameState = GameState.PRE_GAME; // Stay on title screen state
        showOverlay(GameState.PRE_GAME); // Show title screen
        alert("Error: Could not initialize game UI. Please check console and refresh.");
        return;
    }

    // --- Attempt to unlock browser audio on this user gesture ---
    AudioManager.unlockAudio(); // This is the primary place to call unlock


    // 2. Reset player reference in UI *before* creating new player
    UI.setPlayerReference(null);

    // 3. Initialize Game Logic Systems (State reset happens inside their init/reset)
    World.init(); // Generates world, creates static canvas, calls WorldData.initializeGrid() internally.
    ItemManager.init(); // Clear/initialize items, spawn starting weapons
    EnemyManager.init(); // Clear/initialize enemy list
    WaveManager.init(); // Reset/initialize wave manager to PRE_WAVE start state

    // 4. Create Player Instance
    try {
        player = null; // Ensure old reference is cleared
        // Player reset is handled by the Player constructor and init sequence
        player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);

        // 5. Set Player Reference in UI *after* player is created
        UI.setPlayerReference(player); // UI can now access player data for updates and button clicks

    } catch (error) {
        console.error("FATAL: Player Creation/Init Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        currentGameState = GameState.PRE_GAME; // Revert state
        showOverlay(GameState.PRE_GAME); // Show title screen again
        alert("Error creating player. Please check console and refresh.");
        return;
    }

    // 6. Calculate Initial Camera Position
    calculateInitialCamera(); // Center camera on player

    // 7. Set game state and hide overlay
    currentGameState = GameState.RUNNING;
    hideOverlay(); // Hide overlay AFTER UI init succeeds and player is ready

    // 8. Start Game Loop
    Input.consumeClick(); // Clear any clicks during transition/load
    lastTime = performance.now(); // Set start time for delta time calculation
    gameStartTime = performance.now(); // Record game start time
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
    showOverlay(GameState.PAUSED); // Show the pause menu overlay (also pauses music)
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
    hideOverlay(); // Hide the pause overlay (also resumes music)

    // Restart the game loop
    lastTime = performance.now(); // IMPORTANT: Reset time to avoid huge dt jump after pause
    if (!gameLoopId) { // Only start if not already running (shouldn't be, but safe check)
        gameLoopId = requestAnimationFrame(gameLoop);
    }
}

/** Handles the transition to the game over state (player died). */
function handleGameOver() {
    if (currentGameState === GameState.GAME_OVER) return; // Prevent multiple calls
    console.log(">>> Handling Game Over <<<");
    currentGameState = GameState.GAME_OVER;
    showOverlay(GameState.GAME_OVER); // Show game over overlay (updates stats text internally, stops music)

    // Inform WaveManager about Game Over state (clears timers/enemies, stops music)
    WaveManager.setGameOver();

    // Stop the game loop
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }

    // Perform a final UI update to show the end-game state
    const waveInfo = WaveManager.getWaveInfo(); // Get final info (state should be GAME_OVER)
    const livingEnemies = EnemyManager.getLivingEnemyCount(); // Should be 0 after WaveManager.setGameOver()
    UI.updateWaveInfo(waveInfo, livingEnemies);
    if (player) {
         // Update health (likely 0), inventory, weapon status one last time
         UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.hasWeapon(Config.WEAPON_TYPE_SWORD), player.hasWeapon(Config.WEAPON_TYPE_SPEAR), player.hasWeapon(Config.WEAPON_TYPE_SHOVEL));
    }
}

/** Handles the transition to the victory state (all waves cleared). */
function handleVictory() {
     if (currentGameState === GameState.VICTORY) return; // Prevent multiple calls
     console.log(">>> Handling Victory <<<");
     currentGameState = GameState.VICTORY;
     showOverlay(GameState.VICTORY); // Show victory overlay (stops music)

     // WaveManager is already in VICTORY state

     // Stop the game loop
     if (gameLoopId) {
         cancelAnimationFrame(gameLoopId);
         gameLoopId = null;
     }

     // Final UI Update
     const waveInfo = WaveManager.getWaveInfo(); // State should be VICTORY
     const livingEnemies = EnemyManager.getLivingEnemyCount(); // Should be 0
     UI.updateWaveInfo(waveInfo, livingEnemies);
     if (player) {
         UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.hasWeapon(Config.WEAPON_TYPE_SWORD), player.hasWeapon(Config.WEAPON_TYPE_SPEAR), player.hasWeapon(Config.WEAPON_TYPE_SHOVEL));
     }
}


/** Restarts the game from the game over, victory, or pause screen. */
function restartGame() {
    // Allow restart from GAME_OVER, VICTORY, or PAUSED state
    if (currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY && currentGameState !== GameState.PAUSED) {
        console.warn("Restart called but game not in a restartable state.");
        return; // Prevent restarting from RUNNING or PRE_GAME states via this button
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
             // console.warn("Game loop called unexpectedly while not running. State:", currentGameState);
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

    // --- Game State Checks (Player Death & Victory) ---
    // Check Player health FIRST
    if (player && player.getCurrentHealth() <= 0) {
        // Player died, transition to game over
        handleGameOver();
        return; // Stop processing this frame
    }

    // Check if WaveManager signals victory (all waves cleared)
    // This check needs to happen *before* WaveManager.update this frame
    // if WaveManager.update might transition to VICTORY.
    // A safer approach is to check the state *after* the update, or have WaveManager
    // return a flag when it *just* transitioned to VICTORY this frame.
    // For now, let's check AFTER update.

    // --- Input Phase ---
    const inputState = Input.getState();
    const internalMousePos = Input.getMousePosition();
    let targetWorldPos = getMouseWorldCoords(internalMousePos);
    let targetGridCell = getMouseGridCoords(internalMousePos);

    // --- Update Phase ---
    let currentPlayerPosition = null; // <<< DECLARED HERE
    if (player) {
        player.update(dt, inputState, targetWorldPos, targetGridCell);
        currentPlayerPosition = player.getPosition(); // <<< Assigned here
    }

    // Update game logic systems
    ItemManager.update(dt);
    EnemyManager.update(dt, currentPlayerPosition); // <<< Pass potentially null position
    WaveManager.update(dt); // Update WaveManager (handles timers and spawning)
    World.update(dt); // Update dynamic world elements like water

    // --- Check Wave Manager state AFTER update ---
    const waveInfo = WaveManager.getWaveInfo(); // Get updated wave info AFTER WaveManager update
    if (waveInfo.state === 'VICTORY') {
         handleVictory(); // Transition to victory state
         return; // Stop processing this frame
    }

    // --- Camera Calculation ---
    calculateCameraPosition(); // Update camera position based on player movement and scale

    // --- Collision Detection Phase ---
    if (player) {
        CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
        CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
        CollisionManager.checkPlayerAttackBlockCollisions(player);
        CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies());
    }

    // --- Render Phase ---
    Renderer.clear();
    const mainCtx = Renderer.getContext();
    mainCtx.save(); // Save context state before transformations

    // Apply Camera Transformations (Scale and Translate)
    mainCtx.scale(cameraScale, cameraScale);
    mainCtx.translate(-cameraX, -cameraY);

    // --- Draw World Elements (Relative to World Coordinates) ---
    World.draw(mainCtx); // Draw static world background (handled by WorldManager/Renderer)
    ItemManager.draw(mainCtx); // Draw items
    EnemyManager.draw(mainCtx); // Draw enemies
    if (player) {
        player.draw(mainCtx); // Draw player sprite and held weapon visual
        player.drawGhostBlock(mainCtx); // Draw placement preview
    }

    mainCtx.restore(); // Restore context state (removes transformations)

    // --- Draw Screen-Relative UI Elements (AFTER restore) ---
    // Currently none drawn directly on canvas

    // --- Update Sidebar UI ---
    // This updates the HTML elements outside the canvas every frame while running
    // waveInfo is already retrieved after WaveManager.update
    const livingEnemies = EnemyManager.getLivingEnemyCount(); // Get current enemy count
    UI.updateWaveInfo(waveInfo, livingEnemies); // Update top sidebar portal info
    if (player) {
        // Update top sidebar health AND bottom sidebar inventory/weapon states
        UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.hasWeapon(Config.WEAPON_TYPE_SWORD), player.hasWeapon(Config.WEAPON_TYPE_SPEAR), player.hasWeapon(Config.WEAPON_TYPE_SHOVEL));
    }

    // Consume attack input state AFTER all updates and rendering for the frame
    // The player's update method now consumes it immediately on successful placement/attack start.
    // Input.consumeClick(); // This line can likely be removed now, as consumption is in player.js

    // --- Loop Continuation ---
    // Schedule the next frame *only* if still running
     if (currentGameState === GameState.RUNNING) {
        gameLoopId = requestAnimationFrame(gameLoop);
     } else {
         gameLoopId = null; // Ensure ID is cleared if state changed mid-frame
     }
}


// --- Camera Calculation Helpers ---
/** Calculates the initial camera position and scale when starting a game. */
function calculateInitialCamera() {
     if (player) {
        const viewWidth = Config.CANVAS_WIDTH; // Use internal canvas dimensions
        const viewHeight = Config.CANVAS_HEIGHT;
        cameraScale = 1.0; // Reset zoom on new game
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;

        // Center camera X and Y on the player's center
        cameraX = (player.x + player.width / 2) - (visibleWorldWidth / 2);
        cameraY = (player.y + player.height / 2) - (visibleWorldHeight / 2);

        // Clamp camera position to world boundaries
        const worldPixelWidth = getWorldPixelWidth(); // Gets internal world width (1600)
        const worldPixelHeight = getWorldPixelHeight(); // Gets internal world height (800)

        // Calculate max scroll positions based on current scale and ACTUAL world size
        const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth);
        cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
        const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);
        cameraY = Math.max(0, Math.min(cameraY, maxCameraY));

        // Center camera if world is smaller than viewport (zoomed out too far)
         if (worldPixelWidth <= visibleWorldWidth) { cameraX = (worldPixelWidth - visibleWorldWidth) / 2; }
         if (worldPixelHeight <= visibleWorldHeight) { cameraY = (worldPixelHeight - visibleWorldHeight) / 2; }
    }
     else {
         cameraX = 0; cameraY = 0; cameraScale = 1.0; // Default camera state if no player
     }
}

/** Updates the camera position during gameplay, typically following the player. */
function calculateCameraPosition() {
     if (player) { // Only update camera if the player exists (game is running/paused)
        const viewWidth = Config.CANVAS_WIDTH; // Use internal canvas dimensions
        const viewHeight = Config.CANVAS_HEIGHT;
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;

        // Target camera position to center on player
        let targetX = (player.x + player.width / 2) - (visibleWorldWidth / 2);
        let targetY = (player.y + player.height / 2) - (visibleWorldHeight / 2);

        // Direct follow for now:
        cameraX = targetX;
        cameraY = targetY;

        // Clamp camera position to world boundaries based on current scale and ACTUAL world size
        const worldPixelWidth = getWorldPixelWidth(); // Gets internal world width (1600)
        const worldPixelHeight = getWorldPixelHeight(); // Gets internal world height (800)
        const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth);
        cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
        const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);
        cameraY = Math.max(0, Math.min(cameraY, maxCameraY));

        // Center if world smaller than viewport horizontally
        if (worldPixelWidth <= visibleWorldWidth) { cameraX = (worldPixelWidth - visibleWorldWidth) / 2; }
        // Center if world smaller than viewport vertically
        if (worldPixelHeight <= visibleWorldHeight) { cameraY = (worldPixelHeight - visibleWorldHeight) / 2; }
    }
    // Don't update camera if no player (e.g., during game over screen)
}


// --- Initialization ---
/** Initializes the game application on page load. */
function init() {
    // console.log("DOM loaded, initializing...");
    currentGameState = GameState.PRE_GAME; // Set initial state

    try {
        // --- Get Essential Container Refs FIRST ---
        appContainer = document.getElementById('app-container');
        gameOverlay = document.getElementById('game-overlay');
        // Get Overlay Button/Stats References (early so they can get listeners)
        startGameButton = document.getElementById('start-game-button');
        resumeButton = document.getElementById('resume-button');
        restartButtonOverlay = document.getElementById('restart-button-overlay');
        gameOverStatsP = document.getElementById('gameover-stats'); // Re-used for victory stats

        if (!appContainer || !gameOverlay || !startGameButton || !resumeButton || !restartButtonOverlay || !gameOverStatsP) {
             throw new Error("Essential container or overlay elements not found! Check index.html.");
        }

        // --- Setup Event Listeners (Overlay buttons) ---
        startGameButton.addEventListener('click', startGame);
        resumeButton.addEventListener('click', resumeGame);
        restartButtonOverlay.addEventListener('click', restartGame);


        // --- Initialize Core Systems that DON'T depend on specific game elements ---
        const canvas = document.getElementById('game-canvas');
         if (!canvas) {
             throw new Error("Renderer Init Check: Canvas element 'game-canvas' not found in HTML structure!");
         }
        Renderer.init(); // Sets internal canvas resolution (1600x800)
        Renderer.createGridCanvas(); // Creates off-screen canvas (1600x800)
        Input.init(); // Setup listeners, calculates internal mouse coords
        AudioManager.init(); // <-- Initialize Audio Manager

        // --- Initialize ONLY the Overlay UI (elements already found) ---
        // No separate initOverlay needed if elements are found directly here.
        // UI.initOverlay(); // This function can be removed if not doing anything else.


        // --- Show Initial State ---
        showOverlay(GameState.PRE_GAME); // Display the title screen overlay (also stops music)

    } catch (error) {
        console.error("FATAL: Initialization Error:", error);
        // Display error message in the overlay if possible
        if (gameOverlay) {
            // Clear overlay content and show error
            gameOverlay.innerHTML = `
                <div class="overlay-content" id="overlay-error-content" style="display: flex; flex-direction: column; align-items: center; color: red;">
                    <h1>Initialization Error</h1>
                    <p>${error.message}</p>
                    <p>Please check the console (F12) for more details and refresh.</p>
                </div>`;
            gameOverlay.classList.add('active', 'show-title'); // Show using 'show-title' styling
            if(appContainer) appContainer.classList.add('overlay-active');
             AudioManager.stopMusic(); // Ensure music is stopped if an init error occurs
        } else {
            alert(`FATAL Initialization Error:\n${error.message}\nPlease check console (F12) and refresh.`);
        }
    }
}


// --- Start the Initialization Process when the DOM is ready ---
window.addEventListener('DOMContentLoaded', init);