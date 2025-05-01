// root/js/main.js - Game Entry Point and Main Loop

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
import * as GridCollision from './utils/gridCollision.js';
import * as GridRenderer from './utils/grid.js'; // NEW: Import GridRenderer
// Correctly import unpauseGameMusic
import * as AudioManager from './audioManager.js';
// Make sure unpauseGameMusic is accessible via AudioManager namespace
// import { unpauseGameMusic } from './audioManager.js'; // This wouldn't work with * as AudioManager

import { Portal } from './portal.js';

// =============================================================================
// --- Global Game Variables ---
// =============================================================================

let player = null;
let portal = null; // Portal instance
let gameLoopId = null; // store requestAnimationFrame ID for pausing/stopping
let lastTime = 0; // track time since last frame for dt calculation
let gameStartTime = 0; // track when the current game started for playtime/stats

// --- Portal State ---
let currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // Radius value managed by main.js

// --- Camera ---
let cameraX = 0;
let cameraY = 0;
let cameraScale = 1.0; // 1.0 = normal zoom

// --- DOM References ---
let appContainer = null;
let gameOverlay = null;
let startGameButton = null;
let resumeButton = null;
let restartButtonGameOver = null;
let restartButtonVictory = null;
let gameOverStatsTextP = null;
let victoryStatsTextP = null;

// NEW: Settings Button References
let btnToggleGrid = null;
let btnMuteMusic = null;
let btnMuteSfx = null;

// --- Game State Enum ---
const GameState = Object.freeze({
    PRE_GAME: 'PRE_GAME', // Title screen state
    RUNNING: 'RUNNING', // Game loop is active, timers decrement, physics runs, state transitions occur
    PAUSED: 'PAUSED',   // Game loop is paused, no updates
    GAME_OVER: 'GAME_OVER', // Game over screen state
    VICTORY: 'VICTORY' // Victory screen state
});
let currentGameState = GameState.PRE_GAME; // Initial state

// --- Wave/Intermission State Tracking (for Main.js Logic) ---
// Track the WaveManager's state from the previous frame to detect transitions.
// Needed, for example, to trigger radius increase only once when BUILDPHASE starts.
let previousWaveManagerState = null; // Tracker for WaveManager state transitions across frames

// --- Auto-Pause State ---
// Flag to indicate if the game was paused automatically due to losing tab visibility.
let isAutoPaused = false; // <--- NEW FLAG FOR AUTO-PAUSE

// NEW: Settings State
let isGridVisible = false; // Default to grid off
// Audio mute states are managed by AudioManager.js, but we can get them for UI updates


// =============================================================================
// --- Helper Functions ---
// =============================================================================

// --- Return the internal canvas size in pixels, which matches the world dimensions ---
function getWorldPixelWidth() { return Config.CANVAS_WIDTH; }
function getWorldPixelHeight() { return Config.GRID_ROWS * Config.BLOCK_HEIGHT; } // Use GRID_ROWS * BLOCK_HEIGHT for world height

/* --- Console log the world grid (currently unused but kept for future debugging) ---
// function logWorldGrid() { ... }
*/

// --- Global Exposures ---
// Expose pauseGame globally for the UI pause button.
window.pauseGameCallback = pauseGame;
// Expose updateCameraScale globally for the Input module (mouse wheel).
window.updateCameraScale = function(deltaScale) {
    const oldScale = cameraScale;
    let newScale = cameraScale + deltaScale;
    const internalCanvasWidth = Config.CANVAS_WIDTH; // internal canvas dimensions
    const internalCanvasHeight = Config.CANVAS_HEIGHT;
    const worldPixelWidth = getWorldPixelWidth(); // world dimensions
    const worldPixelHeight = getWorldPixelHeight();

    // Calculate the minimum scale required to make the world fill the viewport (no black bars if world is large enough)
    const scaleToFitWidth = (worldPixelWidth > 0) ? internalCanvasWidth / worldPixelWidth : 1;
    const scaleToFitHeight = (worldPixelHeight > 0) ? internalCanvasHeight / worldPixelHeight : 1;
    const minScaleRequired = Math.max(scaleToFitWidth, scaleToFitHeight);

    // The effective minimum scale is the LARGER of the configured minimum and the required scale to fill the view.
    const effectiveMinScale = Math.max(Config.MIN_CAMERA_SCALE, minScaleRequired);

    // Clamp the new scale between the effective minimum and the configured maximum.
    newScale = Math.max(effectiveMinScale, Math.min(newScale, Config.MAX_CAMERA_SCALE));

    // Apply the final clamped scale. The camera position will be re-clamped in the next game loop by calculateCameraPosition.
    cameraScale = newScale;
}

// --- Convert canvas pixel coordinates to world coordinates ---
function getMouseWorldCoords(inputMousePos) {
    // Calculate world coordinates based on camera position and scale
    const worldX = cameraX + (inputMousePos.x / cameraScale);
    const worldY = cameraY + (inputMousePos.y / cameraScale);
    return { x: worldX, y: worldY };
}

// --- Convert canvas pixel coordinates directly to grid coordinates ---
function getMouseGridCoords(inputMousePos) {
    const { x: worldX, y: worldY } = getMouseWorldCoords(inputMousePos);
    // Use the utility function to convert world pixels to grid indices
    return GridCollision.worldToGridCoords(worldX, worldY);
}

// Callback function to handle the start of a new wave, triggered by WaveManager
// Used to display the epoch text overlay.
function handleWaveStart(waveNumber) {
    console.log(`Main: Starting Wave ${waveNumber}`);
    const epochYear = Config.EPOCH_MAP[waveNumber];
    if (epochYear !== undefined) {
        UI.showEpochText(epochYear); // Show epoch if mapped in config
    } else {
        console.warn(`Main: No epoch defined in Config.EPOCH_MAP for wave ${waveNumber}.`);
        UI.showEpochText(`Wave ${waveNumber} Starting`); // default to naming by wave number
    }
}

// =============================================================================
// --- Settings Toggle Functions ---
// =============================================================================

// NEW: Toggles the visibility of the grid.
function toggleGridDisplay() {
    isGridVisible = !isGridVisible;
    console.log(`Main: Grid display is now ${isGridVisible ? 'ON' : 'OFF'}.`);
    // UI update handled by main loop's UI.updateSettingsButtonStates
    UI.illuminateButton('toggleGrid'); // Illuminate the button
    // Re-render static world to apply change? No, GridRenderer draws directly in main loop now.
}

// NEW: Toggles music mute state.
function toggleMusicMute() {
    // AudioManager manages the mute state and volume. We just call its toggle function.
    const newState = AudioManager.toggleMusicMute();
    console.log(`Main: Music is now ${newState ? 'muted' : 'unmuted'}.`);
    // UI update handled by main loop's UI.updateSettingsButtonStates
    UI.illuminateButton('muteMusic'); // Illuminate the button
}

// NEW: Toggles SFX mute state.
function toggleSfxMute() {
    // AudioManager manages the mute state and volume. We just call its toggle function.
    const newState = AudioManager.toggleSfxMute();
    console.log(`Main: SFX is now ${newState ? 'muted' : 'unmuted'}.`);
    // UI update handled by main loop's UI.updateSettingsButtonStates
    UI.illuminateButton('muteSfx'); // Illuminate the button
}


// =============================================================================
// --- Overlay Management ---
// =============================================================================

// Shows a specific game overlay state (title, pause, game over, victory) and handles music transitions.
function showOverlay(stateToShow) {
    if (!gameOverlay || !appContainer) {
         console.error("ShowOverlay: Core overlay/app container not found!");
         return; // Cannot show overlay if elements are missing
    }
    // Remove previous state-specific classes
    gameOverlay.classList.remove('show-title', 'show-pause', 'show-gameover', 'show-victory');

    // Add the class corresponding to the desired state and handle audio transitions
    switch (stateToShow) {
        case GameState.PRE_GAME:
            gameOverlay.classList.add('show-title');
            // Stop all music for a clean start on the title screen
            AudioManager.stopAllMusic();
            // Play title music (if defined in config)
            // Ensure UI music volume is set before playing (respects mute state)
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME); // Reset UI volume setting
            if (Config.AUDIO_TRACKS.title) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.title);
            } else {
                AudioManager.stopUIMusic(); // Ensure UI music is stopped if no title track
            }
            break;
        case GameState.PAUSED:
            gameOverlay.classList.add('show-pause');
            // Pause game music and play pause music (if defined)
            AudioManager.pauseGameMusic(); // Pause game music (retains position)
             // Ensure UI music volume is set before playing (respects mute state)
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME); // Reset UI volume setting
            if (Config.AUDIO_TRACKS.pause) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            } else {
                AudioManager.stopUIMusic(); // Ensure UI music is stopped if no pause track
            }
            break;
        case GameState.GAME_OVER:
            gameOverlay.classList.add('show-gameover');
            // Update game over stats text element if it exists
            if (gameOverStatsTextP) {
                 // Get the wave number reached from WaveManager
                 const finalWave = WaveManager.getWaveInfo().mainWaveNumber;
                 gameOverStatsTextP.textContent = `You reached Wave ${finalWave}!`; // Display the final wave
            } else {
                console.warn("ShowOverlay: gameover-stats-text element not found for GAME_OVER state.");
            }
            // Stop game music and play game over music (if defined)
            AudioManager.stopGameMusic(); // Stop game music (reset position)
             // Ensure UI music volume is set before playing (respects mute state)
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME); // Reset UI volume setting
            if (Config.AUDIO_TRACKS.gameOver) { // Assuming you add a gameover track
                 AudioManager.playUIMusic(Config.AUDIO_TRACKS.gameOver);
            } else {
                 AudioManager.stopUIMusic(); // Ensure UI music is stopped if no game over track
            }
            break;
        case GameState.VICTORY:
            gameOverlay.classList.add('show-victory');
            // Update victory stats text element if it exists
            if (victoryStatsTextP) {
                 // Get the total number of waves from config
                 const totalWaves = Config.WAVES.length;
                 victoryStatsTextP.textContent = `You cleared all ${totalWaves} waves!`; // Display total waves cleared
            } else {
                console.warn("ShowOverlay: victory-stats-text element not found for VICTORY state.");
            }
            // Stop game music and play victory music (if defined)
             AudioManager.stopGameMusic(); // Stop game music
             // Ensure UI music volume is set before playing (respects mute state)
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME); // Reset UI volume setting
            if (Config.AUDIO_TRACKS.victory) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.victory);
            } else {
                 AudioManager.stopUIMusic(); // Ensure UI music is stopped if no victory track
            }
            break;
    }
    // Make the overlay visible and apply the blur/dim effect to the background container
    gameOverlay.classList.add('active');
    appContainer.classList.add('overlay-active');
}

// Hides the currently active overlay and restores the background container's appearance.
// Also handles stopping UI music and resuming game music if returning to RUNNING state.
// Note: Music resume logic is now primarily handled by resumeGame() calling unpauseGameMusic().
function hideOverlay() {
    if (!gameOverlay || !appContainer) return; // Cannot hide overlay if elements are missing

    gameOverlay.classList.remove('active'); // Hide the overlay

    // Stop UI music immediately when hiding overlay
    AudioManager.stopUIMusic();

    // Re-enable pointer events on the background elements after the blur transition finishes.
    // The CSS transition duration is 0.3s.
    setTimeout(() => {
         appContainer.classList.remove('overlay-active');
    }, 300); // Match CSS transition duration
}

// =============================================================================
// --- Game State Control ---
// =============================================================================

// Starts a new game, initializing all systems and transitioning to the RUNNING state.
function startGame() {
    // Prevent starting if already in RUNNING state
    if (currentGameState === GameState.RUNNING) {
        console.warn("startGame called but game already RUNNING.");
        return;
    }
    // Ensure UI is initialized before proceeding with game start logic
    if (!UI.isInitialized()) {
         console.error("FATAL: UI was not initialized correctly. Aborting game start.");
         // Attempt to show an error overlay if basic UI elements were found during init
         showOverlay(GameState.PRE_GAME); // Revert to title state, possibly showing an error message later
         return; // Stop game start sequence
    }
    // Reset UI references before creating new game objects
    UI.setPlayerReference(null);
    UI.setPortalReference(null);

    // Initialize Core Managers and World
    World.init(); // Initialize World (Generates terrain, seeds water, creates static canvas)
    ItemManager.init(); // Initialize Item Manager (Spawns starting items)
    EnemyManager.init(); // Initialize Enemy Manager (Clears enemies list)

    // Create the Portal instance AFTER World is initialized, as its position depends on world generation results.
    const portalSpawnX = Config.CANVAS_WIDTH / 2 - Config.PORTAL_WIDTH / 2;
    // Position the portal centered horizontally, slightly above the mean ground level.
    // The mean ground level is now calculated during world generation, but CONFIG stores the target row.
    const portalSpawnY = (Config.WORLD_GROUND_LEVEL_MEAN * Config.BLOCK_HEIGHT) - Config.PORTAL_HEIGHT - (Config.PORTAL_SPAWN_Y_OFFSET_BLOCKS * Config.BLOCK_HEIGHT);
    portal = new Portal(portalSpawnX, portalSpawnY); // Create portal instance

    // Create the Player instance.
    try {
        player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);

        // Set Player and Portal References in the UI manager
        UI.setPlayerReference(player);
        UI.setPortalReference(portal);

    } catch (error) {
        // Handle fatal errors during player/portal creation or setup
        player = null;
        portal = null;
        currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // Reset radius managed by main.js
        console.error("FATAL: Game Object Creation/Init Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        currentGameState = GameState.PRE_GAME; // Revert state on fatal error
        showOverlay(GameState.PRE_GAME); // Show title screen, possibly indicating an error
        alert("Error creating game objects. Please check console and refresh.");
        return; // Stop game start sequence
    }

    // Pass the newly created Portal instance reference to the WaveManager.
    // This is needed for WaveManager's cleanup logic during the WARPPHASE.
    // WaveManager.reset now requires the callback and portal reference.
    WaveManager.reset(handleWaveStart, portal); // Reset WaveManager, passing callback AND portal instance

    // Calculate initial camera position, centered on the player.
    calculateInitialCamera();

    // Reset or initialize the portal safety radius managed by main.js.
    currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // Initialize radius for the first wave/intermission

    // Initialize the state tracker for WaveManager state transitions.
    previousWaveManagerState = null; // Reset this when game starts

    // Initialize the auto-pause flag.
    isAutoPaused = false; // Initialize the auto-pause flag.

    // NEW: Reset settings state on new game
    isGridVisible = false; // Grid starts off
    // AudioManager mute states are managed by AudioManager, but ensure default volumes are applied
    AudioManager.setVolume('game', Config.AUDIO_DEFAULT_GAME_VOLUME);
    AudioManager.setVolume('sfx', Config.AUDIO_DEFAULT_SFX_VOLUME);
    AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME); // Set UI volume in case it was messed with
    // Update UI settings button states to reflect the reset
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());


    // Transition the main game state to RUNNING.
    currentGameState = GameState.RUNNING;

    // Hide any active overlay (like the title screen).
    hideOverlay();

    // Consume any lingering input events (like the click on the start button).
    Input.consumeClick(); // This clears the attack flag which might be set by the start button click

    // Record the game start time for potential future stats.
    gameStartTime = performance.now();

    // Reset lastTime to 0 to ensure correct dt calculation on the first frame of the new game.
    lastTime = 0;

    // Cancel any previous animation frame loop just in case.
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }

    // Start the main game loop.
    gameLoopId = requestAnimationFrame(gameLoop);
    console.log(">>> Game Started <<<");
}

// Pauses the currently running game.
function pauseGame() { // exposed via window.pauseGameCallback
    // Only pause if the game is currently RUNNING
    if (currentGameState !== GameState.RUNNING) return;

    console.log(">>> Pausing Game <<<");
    currentGameState = GameState.PAUSED; // Change main game state
    showOverlay(GameState.PAUSED); // Show the pause overlay and handle audio
    // Stop the game loop by canceling the animation frame request.
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null; // Clear the ID
    }
    // lastTime is NOT reset here, so dt calculation is correct when resuming.
    // isAutoPaused flag is set by the visibility change handler *if* it was auto-triggered.
}

// Resumes the game from a paused state.
// Called when the user clicks the "Resume" button on the pause overlay.
function resumeGame() {
    // Only resume if the game is currently PAUSED
    if (currentGameState !== GameState.PAUSED) return;

    console.log(">>> Resuming Game <<<");

    // Transition the main game state back to RUNNING.
    currentGameState = GameState.RUNNING;

    // Hide the pause overlay. This also stops the UI pause music.
    hideOverlay();

    // Reset the isAutoPaused flag now that the user has manually resumed.
    isAutoPaused = false;

    // Attempt to unpause/resume the background game music.
    // The AudioManager function now simply tries to play the current game track
    // if one is loaded and it's currently paused.
    AudioManager.unpauseGameMusic(); // <--- CALL THE UNPAUSE MUSIC FUNCTION HERE

    // Restart the game loop by requesting the next animation frame.
    // The loop function `gameLoop` itself will only run its body if `currentGameState === GameState.RUNNING`.
    if (!gameLoopId) { // Only request if not already requested somehow
        gameLoopId = requestAnimationFrame(gameLoop);
    }
    // lastTime was preserved during pause, so dt calculation will be correct.
}

// Handles the transition to the game over state.
function handleGameOver() {
    // Prevent multiple calls to handle game over
    if (currentGameState === GameState.GAME_OVER) return;

    console.log(">>> Handling Game Over <<<");
    currentGameState = GameState.GAME_OVER; // Change main game state
    WaveManager.setGameOver(); // Notify WaveManager of game over state
    EnemyManager.clearAllEnemies(); // Clear enemies on game over
    ItemManager.clearItemsOutsideRadius(0, 0, Infinity); // Clear all items on game over

    showOverlay(GameState.GAME_OVER); // Show the game over overlay and handle audio
    // Stop the game loop.
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }
    // Reset auto-pause flag on game over.
    isAutoPaused = false;

    // lastTime is reset in gameLoop's exit condition when state is not RUNNING and not PAUSED.
    // Any entity updates/collisions are stopped by the `if (currentGameState !== GameState.RUNNING)` check in the loop.
    // World updates (like water) stop as well.
}

// Handles the transition to the victory state (all waves cleared).
function handleVictory() {
     // Prevent multiple calls to handle victory
     if (currentGameState === GameState.VICTORY) return;

     console.log(">>> Handling Victory <<<");
     currentGameState = GameState.VICTORY; // Change main game state
     WaveManager.setVictory(); // Notify WaveManager of victory state
     EnemyManager.clearAllEnemies(); // Clear enemies on victory
     ItemManager.clearItemsOutsideRadius(0, 0, Infinity); // Clear all items on victory

     showOverlay(GameState.VICTORY); // Show the victory overlay and handle audio
     // Stop the game loop.
     if (gameLoopId) {
         cancelAnimationFrame(gameLoopId); // Stop the game loop
         gameLoopId = null;
     }
     // Reset auto-pause flag on victory.
     isAutoPaused = false;

     // lastTime is reset in gameLoop's exit condition when state is not RUNNING and not PAUSED.
     // Any entity updates/collisions are stopped by the `if (currentGameState !== GameState.RUNNING)` check in the loop.
     // World updates (like water) stop as well.
}

/** Restarts the game from GAME_OVER, VICTORY, or PAUSED state. */
function restartGame() {
    // Only allow restart from specific states
    if (currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY && currentGameState !== GameState.PAUSED) {
        console.warn("Restart called but game not in a restartable state.");
        return; // Prevent restarting from RUNNING or PRE_GAME states via this button click
    }

    console.log(">>> Restarting Game <<<");
    // The `startGame()` function performs a full reset of all systems and state,
    // including the auto-pause flag and state trackers.
    startGame();
}

// =============================================================================
// --- Game Loop ---
// =============================================================================

// The main game loop function, called by requestAnimationFrame.
function gameLoop(timestamp) {
    // --- Check and Handle Non-Running States ---
    // If the game is not RUNNING (e.g., PAUSED, GAME_OVER, VICTORY, PRE_GAME), stop the loop body.
    // This check also handles the auto-pause state because auto-pause transitions the state to PAUSED.
    if (currentGameState !== GameState.RUNNING) {
        // If the state is anything other than RUNNING, we check if a loop is still requested.
        // This check in case something tries to request a frame while not RUNNING.
        // The loop should ideally only be requested *from* RUNNING state, but this is defensive.
        if (gameLoopId) {
            // If gameLoopId is set but state isn't RUNNING, it means we transitioned out.
            // Cancel the potential next frame request.
            cancelAnimationFrame(gameLoopId);
            gameLoopId = null; // Clear the ID
        }
        // If the state is not RUNNING AND not PAUSED, reset lastTime.
        // This ensures that when the game *does* start again (via startGame/resumeGame),
        // the first dt calculation from lastTime = 0 is correct.
        if (currentGameState !== GameState.PAUSED) {
             lastTime = 0;
        }
        // Exit the function without running the main update/render logic.
        return;
    }

    // --- Delta Time Calculation ---
    // Calculate the time elapsed since the last frame in seconds.
    let dt;
    if (lastTime === 0) {
        // If lastTime is 0, it's the first frame (or after a long pause/reset). Set dt to 0.
        dt = 0;
        // console.log("GameLoop: First frame detected (lastTime was 0). dt set to 0."); // Debug log
    } else {
        // For all subsequent frames, calculate the actual delta time.
        dt = (timestamp - lastTime) / 1000; // Convert milliseconds to seconds
        // Clamp dt to prevent physics instability if the frame rate drops significantly (e.g., debugging pauses).
        dt = Math.min(dt, Config.MAX_DELTA_TIME);
    }
    // Update lastTime for the next frame's calculation.
    lastTime = timestamp;

    // --- Check Game Over/Victory Conditions FIRST during RUNNING state ---
    // This is the critical check to transition out of RUNNING.
    if (player && player.getCurrentHealth() <= 0 || (portal && !portal.isAlive())) {
        console.log("Main: Player or Portal health is zero. Triggering Game Over.");
        handleGameOver();
        // After triggering game over, the next frame will hit the `if (currentGameState !== GameState.RUNNING)` check
        // at the top and exit early. No need to process updates/render for this frame.
        return;
    }
    const waveInfo = WaveManager.getWaveInfo();
    if (waveInfo.allWavesCleared) {
         console.log("Main: WaveManager signals all waves cleared. Triggering Victory.");
         handleVictory();
         // Similar to Game Over, exit early.
         return;
    }


    // --- Update Phase ---

    // Get the latest wave information from the WaveManager.
    // This info includes the current state (WAVE_COUNTDOWN, BUILDPHASE, WARPPHASE, etc.)
    // and timer values. This should happen first, as other updates might depend on the state.
    // const waveInfo = WaveManager.getWaveInfo(); // Already got it for victory check above

    // Pass the current main GameState (RUNNING) to WaveManager.
    // WaveManager's internal timers (`preWaveTimer`, `mainWaveTimer`, etc.)
    // will *only* decrement when the `gameState` passed to it is `RUNNING`.
    WaveManager.update(dt, currentGameState);

    // --- Detect Wave State Transitions and Apply Effects ---
    // We need to know the WaveManager state *from the previous frame* to detect transitions.
    // `previousWaveManagerState` is a module-level variable updated at the end of the loop.
    const currentWaveManagerState = waveInfo.state; // Get the state *after* WaveManager.update potentially changed it this frame.

    // Logic for increasing the portal safety radius:
    // This should happen ONCE when the state transitions from WAVE_COUNTDOWN to BUILDPHASE (i.e., when a wave ends).
    if (currentWaveManagerState === 'BUILDPHASE' && previousWaveManagerState === 'WAVE_COUNTDOWN') {
        console.log("Main: Transitioned into BUILDPHASE (Wave Ended), increasing portal safety radius.");
        // Increment the radius by the configured growth amount per wave.
        currentPortalSafetyRadius += Config.PORTAL_RADIUS_GROWTH_PER_WAVE;
        console.log(`New Safety Radius: ${currentPortalSafetyRadius}`);
        // Note: Warp cleanup is triggered *by WaveManager* when it transitions into WARPPHASE.
        // The radius used for cleanup is the one *set* by main.js (which is updated here at the start of BUILDPHASE).
    }

    // Update the previous WaveManager state tracker for the next frame.
    previousWaveManagerState = currentWaveManagerState;


    // --- Update Game Objects Based on Wave State ---
    // During the 'WARPPHASE', we pause most updates (player, enemies, items, collisions)
    // to give the appearance of time warping/cleanup. Only the World (e.g., water) updates.
    // ALSO, entities should NOT update if their health is zero (handled within entity update methods).
    if (currentWaveManagerState !== 'WARPPHASE') {
         // --- Updates that Run During PRE_WAVE, WAVE_COUNTDOWN, BUILDPHASE ---

        // Update Player state based on input and environment.
        // Player.update checks its own health.
        if (player) {
             // Get current input state and mouse/target positions.
             const inputState = Input.getState();
             const internalMousePos = Input.getMousePosition();
             const targetWorldPos = getMouseWorldCoords(internalMousePos);
             const targetGridCell = getMouseGridCoords(internalMousePos);
             // Call the player's update method.
             player.update(dt, inputState, targetWorldPos, targetGridCell);

             // Consume attack input state after player has potentially used it
             // This is moved here from Input.js based on player's internal logic
             Input.consumeClick();
        }

        // Update Items (physics like falling, bobbing). Items.update checks isActive.
        ItemManager.update(dt);

        // Update Enemies (AI, movement, physics). EnemyManager.update filters active enemies.
        // Pass player position for AI targeting.
        EnemyManager.update(dt, player ? player.getPosition() : null);

        // --- Collision Detection Phase ---
        // Check for collisions between entities and the world/other entities.
        // Collision checks are resource-intensive and should be skipped during WARPPHASE.
        // Collision managers should check if entities are active/alive internally.
        if (player) { // Collision checks involving player
            CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
            // checkPlayerAttackEnemyCollisions checks if player is attacking and weapon damage > 0
            CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
            // checkPlayerAttackBlockCollisions checks if player is attacking and block damage > 0
            CollisionManager.checkPlayerAttackBlockCollisions(player);
             // checkPlayerEnemyCollisions checks if player is invulnerable or dead
             CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies());
        }
        // checkEnemyPortalCollisions checks if portal is alive
        if (portal) { // Collision checks involving portal
            CollisionManager.checkEnemyPortalCollisions(EnemyManager.getEnemies(), portal);
        }

    } else {
        // --- Updates that Run ONLY During WARPPHASE (if game is RUNNING) ---
        // During WARPPHASE, entities are frozen. Cleanup happens once at transition.
        // World update (water) continues below this block.
         // Ensure Input attack state is consumed even if player update is skipped
         Input.consumeClick();
    }

    // --- World Update (Dynamic Elements) ---
    // Update dynamic world elements like water flow.
    // This should generally continue during all states where physics is active,
    // except when the *main* game state is PAUSED, GAME_OVER, or VICTORY.
    // The outer `if (currentGameState === GameState.RUNNING)` check handles this.
    World.update(dt); // Water simulation continues even during WARPPHASE

    // --- Camera Update ---
    // Recalculate the camera position (usually following the player).
    // This should also run whenever the game is not paused/over.
    calculateCameraPosition();

    // --- Render Phase ---
    // Clear the main canvas for drawing the new frame.
    Renderer.clear();
    // Get the 2D rendering context for the main canvas.
    const mainCtx = Renderer.getContext();

    // Save the current context state before applying camera transformations.
    mainCtx.save();
    // Apply camera scale (zoom) and translation (pan).
    mainCtx.scale(cameraScale, cameraScale);
    mainCtx.translate(-cameraX, -cameraY);

    // --- Draw World Elements ---
    // Draw the static world background (pre-rendered grid canvas) and dynamic water.
    World.draw(mainCtx);

    // NEW: Draw Grid Lines if enabled (draw on mainCtx AFTER world but BEFORE entities)
    GridRenderer.drawStaticGrid(mainCtx, isGridVisible);


    // Draw active items in the world. ItemManager.draw checks isActive.
    ItemManager.draw(mainCtx);
    // Draw the portal. Portal.draw checks isActive.
    if (portal) {
        // Pass the current safety radius value (managed by main.js) to the portal instance
        // so it can draw the radius visualization if applicable (e.g., during BUILDPHASE).
        // The portal instance already has this radius property, but we ensure it's updated.
        portal.setSafetyRadius(currentPortalSafetyRadius);
        portal.draw(mainCtx);
    }
    // Draw active enemies. EnemyManager.draw checks isActive.
    // Only draw enemies if not in WARPPHASE to prevent them appearing frozen before removal.
     if (currentWaveManagerState !== 'WARPPHASE') {
        EnemyManager.draw(mainCtx);
     } else {
         // Optional: Draw a static snapshot or effect for enemies in WARPPHASE?
     }


    // Draw the player (and their held item visual/ghost block). Player.draw checks invulnerability flashing.
    if (player) {
        player.draw(mainCtx);
        player.drawGhostBlock(mainCtx);
    }
    // Restore the context state to remove the camera transformations.
    mainCtx.restore();

    // --- Update Sidebar UI elements based on the current game state ---
    if (player) {
        UI.updatePlayerInfo(
             player.getCurrentHealth(), player.getMaxHealth(),
             player.getInventory(),
             player.hasWeapon(Config.WEAPON_TYPE_SWORD),
             player.hasWeapon(Config.WEAPON_TYPE_SPEAR),
             player.hasWeapon(Config.WEAPON_TYPE_SHOVEL)
        );
    }
    if (portal) {
        UI.updatePortalInfo(portal.currentHealth, portal.maxHealth);
    }
    // Pass the entire waveInfo object to the UI timer update function.
    UI.updateWaveTimer(waveInfo); // UI uses waveInfo.state and waveInfo.timer/maxTimer
    // Update the state of settings buttons in the UI
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());

    // Request next animation frame only if the GameState.RUNNING check passed AND GameOver/Victory checks did not trigger state change
    gameLoopId = requestAnimationFrame(gameLoop);
}

// =============================================================================
// --- Camera Calculation Helpers ---
// =============================================================================

// Calculates and sets the initial camera position, usually centering on the player.
function calculateInitialCamera() {
     if (player) { // Only calculate if the player exists
        const viewWidth = Config.CANVAS_WIDTH; // The internal rendering width (matches canvas.width)
        const viewHeight = Config.CANVAS_HEIGHT; // The internal rendering height (matches canvas.height)

        cameraScale = 1.0; // Reset zoom to default on game start/initial calculation.

        // Calculate the visible area of the world at the current scale.
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;

        // Calculate the target camera position to center the view on the player's center.
        let targetX = (player.x + player.width / 2) - (visibleWorldWidth / 2);
        let targetY = (player.y + player.height / 2) - (visibleWorldHeight / 2);

        // --- Clamp Camera Position to World Boundaries ---
        // Calculate the actual size of the world in pixels (grid dimensions * block size).
        const worldPixelWidth = getWorldPixelWidth();
        const worldPixelHeight = getWorldPixelHeight();

        // Determine the maximum scroll position for X and Y, ensuring the camera doesn't show outside the world on the right/bottom.
        // Use Math.max(0, ...) in case the world is smaller than the viewport (prevents negative max scroll).
        const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth);
        const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);

        // Clamp the target camera position to stay within the valid world bounds.
        cameraX = Math.max(0, Math.min(targetX, maxCameraX));
        cameraY = Math.max(0, Math.min(targetY, maxCameraY));

         // --- Center Camera If World is Smaller Than Viewport ---
         // If the world is narrower than the visible area at the current scale, center the camera horizontally.
         if (worldPixelWidth <= visibleWorldWidth) {
             cameraX = (worldPixelWidth - visibleWorldWidth) / 2;
         }
         // If the world is shorter than the visible area at the current scale, center the camera vertically.
         if (worldPixelHeight <= visibleWorldHeight) {
             cameraY = (worldPixelHeight - visibleWorldHeight) / 2;
         }
    }
     else {
         // If no player exists (e.g., on initial load or after game over), set default camera state.
         cameraX = 0; cameraY = 0; cameraScale = 1.0;
     }
}

// Updates the camera position during gameplay, following the player and clamping to bounds.
function calculateCameraPosition() {
     if (player) { // Update camera only if player exists
        const viewWidth = Config.CANVAS_WIDTH; // Internal canvas width
        const viewHeight = Config.CANVAS_HEIGHT; // Internal canvas height

        // Calculate the visible area of the world at the current camera scale.
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;

        // Calculate the target camera position to center the view on the player's center.
        let targetX = (player.x + player.width / 2) - (visibleWorldWidth / 2);
        let targetY = (player.y + player.height / 2) - (visibleWorldHeight / 2);

        // For now, the camera directly follows the player. Add smooth lerping here later if desired.
        cameraX = targetX;
        cameraY = targetY;

        // --- Clamp Camera Position to World Boundaries ---
        // Calculate the actual size of the world in pixels.
        const worldPixelWidth = getWorldPixelWidth();
        const worldPixelHeight = getWorldPixelHeight();

        // Determine the maximum scroll position.
        const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth);
        const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);

        // Clamp the camera position to stay within the valid world bounds.
        cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
        cameraY = Math.max(0, Math.min(cameraY, maxCameraY));

        // --- Center Camera If World is Smaller Than Viewport ---
        // If the world is narrower than the visible area, center the camera horizontally.
        if (worldPixelWidth <= visibleWorldWidth) {
             cameraX = (worldPixelWidth - visibleWorldWidth) / 2;
        }
        // If the world is shorter than the visible area, center the camera vertically.
        if (worldPixelHeight <= visibleWorldHeight) {
             cameraY = (worldPixelHeight - visibleWorldHeight) / 2;
        }
    }
    // If player doesn't exist, camera position/scale remains at its last or initial state.
}

// =============================================================================
// --- Initialization ---
// =============================================================================

// Initializes the game by setting up DOM references, event listeners, core systems (Renderer, Input, Audio, UI), and showing initial overlay.
function init() {
    currentGameState = GameState.PRE_GAME; // Set the initial main game state.

    try {
        // --- Get Essential DOM References ---
        appContainer = document.getElementById('app-container');
        gameOverlay = document.getElementById('game-overlay');
        startGameButton = document.getElementById('start-game-button');
        resumeButton = document.getElementById('resume-button');
        restartButtonGameOver = document.getElementById('restart-button-overlay');
        restartButtonVictory = document.getElementById('restart-button-overlay-victory');
        gameOverStatsTextP = document.getElementById('gameover-stats-text');
        victoryStatsTextP = document.getElementById('victory-stats-text');

        // Get Settings Button References
        btnToggleGrid = document.getElementById('btn-toggle-grid');
        btnMuteMusic = document.getElementById('btn-mute-music');
        btnMuteSfx = document.getElementById('btn-mute-sfx');

        // --- Verify Essential DOM Elements Are Found ---
        const essentialOverlayElements = [
            appContainer, gameOverlay, startGameButton, resumeButton,
            restartButtonGameOver, restartButtonVictory, gameOverStatsTextP, victoryStatsTextP,
            btnToggleGrid, btnMuteMusic, btnMuteSfx // Include settings buttons in check
        ];
        // Use `some()` to check if *any* element is missing.
        if (essentialOverlayElements.some(el => !el)) {
             // Identify which specific elements are missing for better debugging.
             const missing = essentialOverlayElements.map((el, i) => el ? null : [
                 'appContainer', 'gameOverlay', 'startGameButton', 'resumeButton',
                 'restartButtonGameOver', 'restartButtonVictory', 'gameover-stats-text', 'victory-stats-text',
                 'btn-toggle-grid', 'btn-mute-music', 'btn-mute-sfx' // NEW: Button IDs
             ][i]).filter(id => id !== null);
             // Throw a descriptive error if required elements are missing.
             throw new Error(`FATAL INIT ERROR: Essential overlay elements not found: ${missing.join(', ')}! Check index.html.`);
        }

        // --- Setup Event Listeners for Overlay Buttons ---
        startGameButton.addEventListener('click', startGame);
        // The resume button listener will now handle resuming *after* an auto-pause as well.
        resumeButton.addEventListener('click', resumeGame);
        restartButtonGameOver.addEventListener('click', restartGame);
        restartButtonVictory.addEventListener('click', restartGame);

        // Setup Event Listeners for Settings Buttons
        btnToggleGrid.addEventListener('click', toggleGridDisplay);
        btnMuteMusic.addEventListener('click', toggleMusicMute); // These now call our new toggle functions
        btnMuteSfx.addEventListener('click', toggleSfxMute);

        // --- Initialize Core Systems that DON'T Depend on Game Objects (Player, Portal) ---

        // Initialize the Renderer, setting canvas size and getting contexts.
        const canvas = document.getElementById('game-canvas');
         if (!canvas) {
             throw new Error("FATAL INIT ERROR: Canvas element 'game-canvas' not found!");
         }
        Renderer.init(); // Sets internal canvas resolution (1600x800 from config)
        Renderer.createGridCanvas(); // Creates off-screen canvas for static world rendering

        // Initialize Input handlers (keyboard, mouse, touch, wheel).
        Input.init();
        // Initialize Audio Manager (creates audio elements).
        AudioManager.init(); // This now applies initial mute state from its own flags

        // Initialize Game UI. This finds UI elements and sets up item/weapon slots.
        // initGameUI also finds the epoch overlay element.
        if (!UI.initGameUI()) {
             throw new Error("FATAL INIT ERROR: UI initialization failed. Check console for missing elements.");
        }

        // --- Initialize Module-Level State Variables ---
        // These need to be initialized here when the script first runs or when the game starts/restarts.
        // Some (like player, portal) are reset in startGame(), but the state trackers below are initialized here.
        lastTime = 0; // Critical for the first dt calculation in the game loop.
        previousWaveManagerState = null; // Tracker for WaveManager state transitions.
        currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // Radius value managed by main.js.
        isAutoPaused = false; // Initialize the auto-pause flag.

        // Initialize settings state here (defaults set at variable declaration)
        isGridVisible = false; // Explicitly ensure default state on init script run

        // Update UI settings buttons initially to reflect the default state
        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());


        // --- Setup Visibility Change Listener for Auto-Pause ---
        // Listen for when the document becomes hidden or visible.
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // --- Show Initial Overlay ---
        // Start by displaying the title screen.
        showOverlay(GameState.PRE_GAME);

    } catch (error) { // --- Handle Fatal Initialization Errors ---
        console.error("FATAL: Initialization Error:", error);
        // Attempt to display an error message on the screen using the overlay if possible.
        if (gameOverlay) {
            // Style the overlay to make the error prominent.
            gameOverlay.style.width = '100%';
            gameOverlay.style.height = '100%';
            gameOverlay.style.position = 'fixed';
            gameOverlay.style.top = '0';
            gameOverlay.style.left = '0';
            gameOverlay.style.display = 'flex';
            gameOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)'; // More opaque background
            gameOverlay.style.color = 'red'; // Error text color
            gameOverlay.style.zIndex = '1000'; // Ensure it's on top
            gameOverlay.style.justifyContent = 'center';
            gameOverlay.style.alignItems = 'center';
            gameOverlay.style.flexDirection = 'column';
            gameOverlay.style.textAlign = 'center';
            gameOverlay.style.padding = '20px'; // Add some padding
            gameOverlay.style.boxSizing = 'border-box';

            // Set the HTML content of the overlay to display the error message.
            gameOverlay.innerHTML = `
                <div id="overlay-error-content" style="display: flex; flex-direction: column; align-items: center; max-width: 600px;">
                    <h1 style="font-size: 2.5em; margin-bottom: 1rem; font-family: 'RubikIso', sans-serif;">Game Error</h1>
                    <p style="font-size: 1.3em; margin-bottom: 1.5rem;">An unrecoverable error occurred during initialization.</p>
                    <p style="font-size: 1.1em; margin-bottom: 2rem; word-break: break-word;">Error: ${error.message}</p>
                    <p style="font-size: 1em;">Please check the browser's developer console (usually by pressing F12) for more technical details and try refreshing the page.</p>
                </div>`;
            // Ensure the overlay is fully visible regardless of CSS transitions if needed.
            gameOverlay.classList.add('active'); // Assume 'active' class sets opacity to 1
            if(appContainer) appContainer.classList.add('overlay-active'); // Apply background blur if container exists
             // Stop any music that might have started during partial init.
             AudioManager.stopAllMusic();
        } else {
            // If the overlay itself couldn't be found, fall back to a simple alert.
            alert(`FATAL Initialization Error:\n${error.message}\nPlease check console (F12) and refresh.`);
        }
    }
}
// --- Automatically pauses when window is hidden - user must click Resume button to continue ---
function handleVisibilityChange() {
    if (document.hidden && currentGameState === GameState.RUNNING) {
        console.log("Document hidden, auto-pausing game.");
        isAutoPaused = true;
        pauseGame();
    }
}
// --- Add an event listener to run the init function once the DOM is fully loaded and parsed ---
window.addEventListener('DOMContentLoaded', init);