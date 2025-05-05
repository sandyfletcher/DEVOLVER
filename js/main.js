// =============================================================================
// root/js/main.js - Game Entry Point and Main Loop
// =============================================================================

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
import * as GridRenderer from './utils/grid.js';
import * as AudioManager from './audioManager.js';
import { Portal } from './portal.js';

// =============================================================================
// --- Global Game Variables ---
// =============================================================================

let player = null;
let gameStartTime = 0; // track when the current game started for playtime/stats
let portal = null;
let gameLoopId = null; // requestAnimationFrame ID for pausing
let lastTime = 0; // time since last frame
let currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS;
let cameraX = 0;
let cameraY = 0;
let cameraScale = 1.0; // 1 = normal zoom
let appContainer = null;
let gameOverlay = null;
let startGameButton = null;
let resumeButton = null;
let restartButtonGameOver = null;
let restartButtonVictory = null;
let gameOverStatsTextP = null;
let victoryStatsTextP = null;
let btnToggleGrid = null;
let muteMusicButtonEl = null;
let muteSfxButtonEl = null;
// --- Game State Enum ---
const GameState = Object.freeze({
    PRE_GAME: 'PRE_GAME', // title screen
    RUNNING: 'RUNNING', // loop active, timers decrement, physics run, state transitions occur
    PAUSED: 'PAUSED',   // loop paused, no updates
    GAME_OVER: 'GAME_OVER', // gameover screen
    VICTORY: 'VICTORY' // victory screen
});
let currentGameState = GameState.PRE_GAME;
let isAutoPaused = false; // boolean if paused due to losing tab visibility
let isGridVisible = false;

// =============================================================================
// --- Helper Functions ---
// =============================================================================

// Returns the world width in pixels (matches internal canvas width)
function getWorldPixelWidth() { return Config.CANVAS_WIDTH; }
// Returns the world height in pixels (grid rows * block height)
function getWorldPixelHeight() { return Config.GRID_ROWS * Config.BLOCK_HEIGHT; }
// Expose pauseGame globally for the UI pause button.
window.pauseGameCallback = pauseGame;
// Expose updateCameraScale globally for the Input module (mouse wheel).
window.updateCameraScale = function(deltaScale) {
    // Ensure camera can only be updated if game is running or paused (not during overlays or game over)
     if (currentGameState !== GameState.RUNNING && currentGameState !== GameState.PAUSED) {
        return; // Ignore zoom input outside active game states
     }
    const oldScale = cameraScale;
    let newScale = cameraScale + deltaScale;
    const internalCanvasWidth = Config.CANVAS_WIDTH; // internal canvas dimensions
    const internalCanvasHeight = Config.CANVAS_HEIGHT;
    const worldPixelWidth = getWorldPixelWidth(); // world dimensions
    const worldPixelHeight = getWorldPixelHeight();
    // Calculate minimum scale required to make world fill viewport (no black bars if world is large enough)
    // Avoid division by zero if world dimensions are somehow 0
    const scaleToFitWidth = (worldPixelWidth > 0) ? internalCanvasWidth / worldPixelWidth : 1;
    const scaleToFitHeight = (worldPixelHeight > 0) ? internalCanvasHeight / worldPixelHeight : 1;
    const minScaleRequired = Math.max(scaleToFitWidth, scaleToFitHeight);
    // The effective minimum scale is the LARGER of the configured minimum and the required scale to fill the view.
    const effectiveMinScale = Math.max(Config.MIN_CAMERA_SCALE, minScaleRequired);
    // Clamp the new scale between the effective minimum and the configured maximum.
    newScale = Math.max(effectiveMinScale, Math.min(newScale, Config.MAX_CAMERA_SCALE));
    // Apply the final clamped scale. Camera position will be re-clamped in game loop by calculateCameraPosition.
    cameraScale = newScale;
    // console.log(`Camera Scale updated: ${oldScale.toFixed(2)} -> ${cameraScale.toFixed(2)}`);
}
// --- Convert canvas pixel coordinates to world coordinates ---
function getMouseWorldCoords(inputMousePos) {
    // Ensure inputMousePos is valid
    if (!inputMousePos || typeof inputMousePos.x !== 'number' || typeof inputMousePos.y !== 'number' || isNaN(inputMousePos.x) || isNaN(inputMousePos.y)) {
         // console.warn("getMouseWorldCoords: Invalid input mouse position.", inputMousePos); // Too noisy
         // Return center of the viewport in world coordinates as a fallback
         return {
             x: cameraX + (Config.CANVAS_WIDTH / 2) / cameraScale,
             y: cameraY + (Config.CANVAS_HEIGHT / 2) / cameraScale
         };
    }
    // calculate coordinates based on camera position and scale
    const worldX = cameraX + (inputMousePos.x / cameraScale);
    const worldY = cameraY + (inputMousePos.y / cameraScale);
    return { x: worldX, y: worldY };
}
// --- Convert canvas pixel coordinates directly to grid coordinates ---
function getMouseGridCoords(inputMousePos) {
    const { x: worldX, y: worldY } = getMouseWorldCoords(inputMousePos);
    // use utility function to convert world pixels to grid indices
    return GridCollision.worldToGridCoords(worldX, worldY);
}
// --- Callback function to handle the start of a new wave, triggered by WaveManager ---
// Used to display the epoch text overlay.
function handleWaveStart(waveNumber) {
    console.log(`Main: Starting Wave ${waveNumber}`);
    const epochYear = Config.EPOCH_MAP[waveNumber];
    if (epochYear !== undefined) {
        UI.showEpochText(epochYear);
    } else {
        console.warn(`Main: No epoch defined in Config.EPOCH_MAP for wave ${waveNumber}.`);
        UI.showEpochText(`Wave ${waveNumber} Starting`); // fallback naming by wave number
    }
     // Optionally play wave music here if not already started by WaveManager
     // WaveManager now handles starting the music track associated with the wave config.
}
// --- Toggle grid visibility ---
// Exposed globally for UI/Input buttons
window.toggleGridDisplay = toggleGridDisplay;
function toggleGridDisplay() {
    isGridVisible = !isGridVisible;
    console.log(`Main: Grid display is now ${isGridVisible ? 'ON' : 'OFF'}.`);
    // Update UI button appearance immediately
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
    // Note: Drawing the grid is handled in the gameLoop based on the `isGridVisible` flag.
}
// --- Toggle music mute ---
// Exposed globally for UI/Input buttons
window.toggleMusicMute = toggleMusicMute;
function toggleMusicMute() {
    const newState = AudioManager.toggleMusicMute(); // Toggle mute state in AudioManager
    console.log(`Main: Music is now ${newState ? 'muted' : 'unmuted'}.`);
    // Update UI button appearance immediately
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), newState);
}
// --- Toggle SFX mute ---
// Exposed globally for UI/Input buttons
window.toggleSfxMute = toggleSfxMute;
function toggleSfxMute() {
    const newState = AudioManager.toggleSfxMute(); // Toggle mute state in AudioManager
    console.log(`Main: SFX is now ${isSfxMuted ? 'muted' : 'unmuted'}.`);
    // Update UI button appearance immediately
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), newState);
}
// =============================================================================
// --- Overlay Management ---
// =============================================================================
// Shows a specific game overlay state (title, pause, game over, victory)
// Handles adding/removing classes and audio transitions.
function showOverlay(stateToShow) {
    // Ensure necessary overlay elements and the app container exist
    if (!gameOverlay || !appContainer) {
         console.error("ShowOverlay: Core overlay/app container not found!");
         return; // Cannot show overlay if critical elements are missing
    }
    // Remove all previous state-specific classes and overlay-active class immediately
    gameOverlay.classList.remove('show-title', 'show-pause', 'show-gameover', 'show-victory');
    appContainer.classList.remove('overlay-active'); // Remove blur/dim from previous state
    // Stop any UI music that might be playing before starting the new one
    AudioManager.stopUIMusic();
    // Stop game music if applicable (not needed for pause state)
    if (currentGameState !== GameState.PAUSED) {
        AudioManager.stopGameMusic();
    }
    // Reset UI music volume to default whenever showing an overlay
    AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
    // Add class corresponding to desired state and handle state-specific logic/audio
    switch (stateToShow) {
        case GameState.PRE_GAME:
            gameOverlay.classList.add('show-title');
            if (Config.AUDIO_TRACKS.title) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.title); // play title music
            } else {
                console.warn("Title music track not defined in Config.AUDIO_TRACKS.");
            }
            break;
        case GameState.PAUSED:
            gameOverlay.classList.add('show-pause');
             AudioManager.pauseGameMusic(); // Pause game music and retain position
            if (Config.AUDIO_TRACKS.pause) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause); // Play pause music
            } else {
                 console.warn("Pause music track not defined in Config.AUDIO_TRACKS.");
            }
            break;
        case GameState.GAME_OVER:
            gameOverlay.classList.add('show-gameover');
            // Update game over stats text element if it exists
            if (gameOverStatsTextP) {
                 const finalWave = WaveManager.getCurrentWaveNumber(); // Get wave reached
                 gameOverStatsTextP.textContent = `You reached Wave ${finalWave}!`; // Display wave reached
            } else {
                console.warn("ShowOverlay: gameover-stats-text element not found.");
            }
            if (Config.AUDIO_TRACKS.gameOver) {
                 AudioManager.playUIMusic(Config.AUDIO_TRACKS.gameOver); // Play game over music
            } else {
                 console.warn("Game Over music track not defined in Config.AUDIO_TRACKS.");
            }
            break;
        case GameState.VICTORY:
            gameOverlay.classList.add('show-victory');
            // Update victory stats text element if it exists
            if (victoryStatsTextP) {
                 const totalWaves = Config.WAVES.length; // Get total number of waves
                 victoryStatsTextP.textContent = `You cleared all ${totalWaves} waves!`; // Display waves cleared
            } else {
                console.warn("ShowOverlay: victory-stats-text element not found.");
            }
            if (Config.AUDIO_TRACKS.victory) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.victory); // Play victory music
            } else {
                 console.warn("Victory music track not defined in Config.AUDIO_TRACKS.");
            }
            break;
        default:
            console.warn(`ShowOverlay: Unknown state requested: ${stateToShow}`);
            // As a fallback, maybe show the title screen?
             gameOverlay.classList.add('show-title');
            break;
    }
    // Make the overlay container visible and apply the blur/dim effect to the background container
    gameOverlay.classList.add('active');
    appContainer.classList.add('overlay-active');
}
// Hides the game overlay and restores the background container.
// Stops any active UI music.
function hideOverlay() {
    if (!gameOverlay || !appContainer) {
         console.error("HideOverlay: Core overlay/app container not found!");
         return; // Cannot hide overlay if elements are missing
    }
    gameOverlay.classList.remove('active'); // remove the 'active' class to trigger fade-out animation
    appContainer.classList.remove('overlay-active'); // remove the 'overlay-active' class to remove blur/dim
    AudioManager.stopUIMusic();
}

// =============================================================================
// --- Game State Control ---
// =============================================================================

// Starts a new game. Initializes all systems and transitions to RUNNING state.
function startGame() {
    if (currentGameState === GameState.RUNNING) { // prevent starting if already in RUNNING state
        console.warn("startGame called but game already RUNNING.");
        return;
    }
    // Crucial check: Ensure core UI is initialized before creating game objects that rely on it.
     if (!UI.isInitialized()) {
          console.error("FATAL: UI was not initialized correctly. Aborting game start.");
          showOverlay(GameState.PRE_GAME); // Revert to title screen
          return; // Abandon start sequence
     }

    console.log(">>> Initializing New Game <<<");
    // --- Reset/Initialize Core Systems ---
    // Reset UI references first, as new player/portal objects will be created.
    UI.setPlayerReference(null); // Clear old reference, will be set after new player is created
    UI.setPortalReference(null); // Clear old reference, will be set after new portal is created

    // Create Portal instance AFTER world, as position depends on world generation results
    const portalSpawnX = Config.CANVAS_WIDTH / 2 - Config.PORTAL_WIDTH / 2;
    // Position portal centered horizontally, slightly above mean ground level
    const portalSpawnY = (Config.WORLD_GROUND_LEVEL_MEAN * Config.BLOCK_HEIGHT) - Config.PORTAL_HEIGHT - (Config.PORTAL_SPAWN_Y_OFFSET_BLOCKS * Config.BLOCK_HEIGHT);
    // Defensive check for calculated spawn Y
    if (isNaN(portalSpawnY) || portalSpawnY < 0) {
         console.error("FATAL: Invalid Portal Spawn Y calculation! Defaulting position.");
         portal = new Portal(Config.CANVAS_WIDTH / 2 - Config.PORTAL_WIDTH / 2, 50); // Fallback to safe, high position
     } else {
         portal = new Portal(portalSpawnX, portalSpawnY); // Create portal
     }

    // World Init (includes generating terrain and initial aging pass)
    // World init now needs the newly created portal reference for initial aging.
    World.init(portal);

    // ItemManager Init (handles initial shovel spawn now)
    ItemManager.init(); // MODIFIED: ItemManager init no longer spawns sword/spear items directly
    // EnemyManager Init
    EnemyManager.init();

    // Create Player instance
     try {
         // Player constructor now initializes with the shovel and unarmed state
         const playerSpawnX = Config.PLAYER_START_X;
         const playerSpawnY = Config.PLAYER_START_Y;
         // Defensive check for calculated spawn Y
          if (isNaN(playerSpawnY) || playerSpawnY < 0) {
             console.error("FATAL: Invalid Player Spawn Y calculation! Defaulting position.");
             player = new Player(Config.CANVAS_WIDTH / 2 - Config.PLAYER_WIDTH / 2, 100, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR); // Fallback
         } else {
             player = new Player(playerSpawnX, playerSpawnY, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
         }
         UI.setPlayerReference(player); // Set reference in UI manager
         UI.setPortalReference(portal); // Set portal reference in UI manager
     } catch (error) {
         // Handle fatal errors during player/portal setup
         player = null;
         portal = null;
         currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS;
         console.error("FATAL: Game Object Creation/Init Error Message:", error.message);
         console.error("Error Stack:", error.stack);
         currentGameState = GameState.PRE_GAME;
         showOverlay(GameState.PRE_GAME); // Show title screen on fatal error
         alert("Error creating game objects. Please check console and refresh."); // User-facing alert
         return; // Abandon start sequence
     }
    // WaveManager Reset (needs the newly created portal reference)
    WaveManager.reset(handleWaveStart, portal); // Reset calls init internally
    // Calculate initial camera position centered on the player
    calculateInitialCamera();
    // Reset other game state variables managed by main.js
    currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // Initialize portal safety radius
    isAutoPaused = false; // Reset auto-pause flag
    isGridVisible = false; // Ensure grid starts hidden on new game
    // Ensure AudioManager volumes are at default/reset on game start for game/sfx music
    // UI music volume is handled by showOverlay/hideOverlay calls.
    AudioManager.setVolume('game', Config.AUDIO_DEFAULT_GAME_VOLUME);
    AudioManager.setVolume('sfx', Config.AUDIO_DEFAULT_SFX_VOLUME);
    // Update settings buttons UI based on initial states (grid hidden, music/sfx as per AudioManager default/saved)
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
    // --- Transition to RUNNING state ---
    currentGameState = GameState.RUNNING;
    hideOverlay(); // Hide any active overlay (title, game over, etc.)
    // Record game start time for potential future stats display
    gameStartTime = performance.now();
    lastTime = 0; // Reset lastTime for correct dt calculation on the first frame of the new game
    // Cancel any previous animation frame loop just in case (e.g., from a prior game instance)
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }
    // Start the main game loop using requestAnimationFrame
    gameLoopId = requestAnimationFrame(gameLoop);
    console.log(">>> Game Started <<<");
}
// Pauses the currently running game. Exposed via window.pauseGameCallback.
function pauseGame() {
    // Only pause if currently RUNNING
    if (currentGameState !== GameState.RUNNING) {
         // console.warn("pauseGame called but game is not RUNNING.");
         return;
    }
    console.log(">>> Pausing Game <<<");
    currentGameState = GameState.PAUSED; // Change main game state
    showOverlay(GameState.PAUSED); // Show pause overlay and handle audio
    // Stop the game loop by cancelling the animation frame request
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null; // Clear the ID reference
    }
}
// Resumes the game from the paused state. Called when the user clicks "Resume" on the pause overlay.
function resumeGame() {
    // Only resume if the game is currently PAUSED
    if (currentGameState !== GameState.PAUSED) {
         // console.warn("resumeGame called but game is not PAUSED.");
         return;
    }
    console.log(">>> Resuming Game <<<");
    currentGameState = GameState.RUNNING; // Transition back to RUNNING state

    // Hide the overlay and handle audio transition (stops UI music, unpauses game music)
    hideOverlay();

    // Reset the auto-pause flag if it was set (user manually resumed)
    isAutoPaused = false;

    // Unpause game music (handled by hideOverlay/AudioManager.unpauseGameMusic)
    // AudioManager.unpauseGameMusic(); // Called inside hideOverlay now

    // Restart the game loop if it's not already running
    if (!gameLoopId) {
        // The requestAnimationFrame call is now at the top of gameLoop, so it will be called regardless of state.
        // We just need to ensure the loop *is* running if it was cancelled (e.g. by pauseGame).
        gameLoopId = requestAnimationFrame(gameLoop);
    }
    // Note: lastTime should *not* be reset here, requestAnimationFrame will provide a correct timestamp.
}

// Handles the transition to the game over state. Triggered by gameLoop when player/portal health <= 0 or player death anim finishes.
function handleGameOver() {
    // Prevent multiple calls if already in the GAME_OVER state
    if (currentGameState === GameState.GAME_OVER) return;

    console.log(">>> Handling Game Over <<<");
    currentGameState = GameState.GAME_OVER; // Change main game state

    // Notify WaveManager of game over state (primarily for timer text display)
    WaveManager.setGameOver();

    // Clear all enemies and items from the game world immediately
    // Use Infinity radius to clear all items and enemies regardless of their state or location.
    EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
    ItemManager.clearItemsOutsideRadius(0, 0, Infinity);

    // Show the game over overlay and handle audio transitions
    showOverlay(GameState.GAME_OVER);

    // Stop the game loop
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }

    // Reset auto-pause flag on game over
    isAutoPaused = false;

    // Reset lastTime to 0 to ensure a fresh dt calculation if game is restarted later
    lastTime = 0;
}

// Handles the transition to the victory state. Triggered by gameLoop when WaveManager signals all waves cleared and enemies are gone.
function handleVictory() {
     // Prevent multiple calls if already in the VICTORY state
     if (currentGameState === GameState.VICTORY) return;

     console.log(">>> Handling Victory <<<");
     currentGameState = GameState.VICTORY; // Change main game state

     // Notify WaveManager of victory state (primarily for timer text display)
     WaveManager.setVictory();

     // Clear all enemies and items
     EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
     ItemManager.clearItemsOutsideRadius(0, 0, Infinity);

     // Show the victory overlay and handle audio transitions
     showOverlay(GameState.VICTORY);

     // Stop the game loop
     if (gameLoopId) {
         cancelAnimationFrame(gameLoopId);
         gameLoopId = null;
     }

     // Reset auto-pause flag
     isAutoPaused = false;

     // Reset lastTime for potential restart
     lastTime = 0;
}


// Restarts the game. Only allowed from GAME_OVER, VICTORY, or PAUSED states.
function restartGame() {
    // Check if the current state is one from which restarting is permissible
    if (currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY && currentGameState !== GameState.PAUSED) {
        console.warn("restartGame called but game not in a restartable state.");
        return;
    }
    console.log(">>> Restarting Game <<<");

    // Stop any currently active game loop before starting a new one
     if (gameLoopId) {
         cancelAnimationFrame(gameLoopId);
         gameLoopId = null;
     }
    // Perform a full reset of systems and state by calling startGame
    startGame();
}

// --- Main game loop function, called by requestAnimationFrame ---
function gameLoop(timestamp) {

    // Request the next frame *before* any state changes or logic updates.
    // This ensures the loop continues regardless of state, allowing static PAUSED/Overlay screens to be drawn.
    gameLoopId = requestAnimationFrame(gameLoop);

    // Calculate delta time (time elapsed since last frame in seconds)
    let dt;
    // If lastTime is 0 or the game state is not RUNNING, set dt to 0.
    // This prevents large jumps in timers/physics after pauses or on the first frame.
    if (lastTime === 0 || currentGameState !== GameState.RUNNING) {
        dt = 0;
    } else {
        // Calculate actual delta time when RUNNING
        dt = (timestamp - lastTime) / 1000; // Convert milliseconds to seconds
        // Clamp dt to prevent physics instability if frame rate drops significantly
        dt = Math.min(dt, Config.MAX_DELTA_TIME);
    }

    // Only update lastTime if the game is currently RUNNING.
    // This correctly calculates dt when resuming from PAUSED.
    if (currentGameState === GameState.RUNNING) {
         lastTime = timestamp;
    } else {
         // lastTime is intentionally NOT updated if not RUNNING.
         // When resuming, the next timestamp will be compared against the old lastTime,
         // providing the correct duration of the pause *after* dt was 0 during the pause.
    }

    // --- Game Logic (Only runs if currentGameState === GameState.RUNNING) ---
    // If the game state is not RUNNING, skip all the update logic below.
    // Rendering and UI updates (which may depend on WaveManager state) still happen after this block.
    if (currentGameState === GameState.RUNNING) {

        // Update WaveManager in ALL states (including BUILD/WARP) so its internal timers progress.
        // Capture the state *before* the update to detect transitions
        const previousWaveManagerState = WaveManager.getWaveInfo().state;
        WaveManager.update(dt, currentGameState); // Pass current game state
        const updatedWaveInfo = WaveManager.getWaveInfo(); // Get state *after* the update
        const currentWaveManagerState = updatedWaveInfo.state;


        // Logic for increasing portal safety radius - triggered ONCE at the transition from BUILDPHASE to WARPPHASE
        // This happens *before* aging in WARPPHASE uses the radius.
         // WaveManager now handles triggering the cleanup/aging within its update() when entering WARPPHASE.
         if (currentWaveManagerState === 'WARPPHASE' && previousWaveManagerState === 'BUILDPHASE') {
            // Increase the safety radius based on the config value for wave progression
            currentPortalSafetyRadius += Config.PORTAL_RADIUS_GROWTH_PER_WAVE;
            if(portal) portal.setSafetyRadius(currentPortalSafetyRadius); // Update portal instance
            console.log(`Main: Portal Safety Radius Increased to ${currentPortalSafetyRadius.toFixed(1)}.`);
            // Trigger cleanup and aging here when entering WARPPHASE (handled in WaveManager)
            // WaveManager.triggerWarpCleanup(); // WaveManager now calls this internally
         }

        // --- Update Entities ---
        // Entities update their positions, states, timers, animations etc.
        // They handle their own internal logic based on isActive/isDying flags.
        // Pass input only if player is capable of receiving it (active and not dying).
        // Pass player ref/pos only if player is capable of interacting/being targeted.

        // Update Player
        if (player) {
            // Get input state only if player is interactable
            const inputState = player && player.isActive && !player.isDying ? Input.getState() : {}; // Check player validity and state here
            // Get mouse/target positions always, even if player is dying (for drawing maybe, though player.draw handles it)
            const internalMousePos = Input.getMousePosition(); // Mouse pos is always tracked by Input module
            const targetWorldPos = getMouseWorldCoords(internalMousePos);
            const targetGridCell = getMouseGridCoords(internalMousePos);
            player.update(dt, inputState, targetWorldPos, targetGridCell);
        }

        // *** ADDED/MOVED: Calculate and update camera position after player update, only if game is running ***
        // The calculateCameraPosition function now handles the player.isActive check internally.
        calculateCameraPosition();

        // Update Enemies
        // Pass player position for AI targeting only if player is interactable
        const playerPosForEnemies = (player && player.isActive && !player.isDying) ? player.getPosition() : null; // Check player validity and state here
        // Enemies update their state even if dying (to run animation timer)
        EnemyManager.update(dt, playerPosForEnemies);

        // Update Items
        // Pass player reference for item attraction only if player is interactable
        const playerRefForItems = (player && player.isActive && !player.isDying) ? player : null; // Check player validity and state here
        // Items update their state even if not attracted
        ItemManager.update(dt, playerRefForItems);

        // World update (water flow, aging triggered by WaveManager)
        World.update(dt);


        // --- Collision Detection (Only happens if RUNNING) ---
        // Collision checks occur *after* entity positions and states (like isAttacking, isDying) are updated.
        // CollisionManager functions themselves check if entities are !isDying before applying damage or interaction.
        if (player) { // Only check player collisions if player object exists (checks !player.isActive, !player.isDying internally)
            CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager); // Player vs items (pickup)
            CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies()); // Player attack vs enemies
            CollisionManager.checkPlayerAttackBlockCollisions(player); // Player attack vs blocks (digging)
            CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies()); // Player vs enemies (contact damage)
        }
        // Check enemy collisions with portal if portal exists and is alive
        if (portal && portal.isAlive()) {
             CollisionManager.checkEnemyPortalCollisions(EnemyManager.getEnemies(), portal);
        }

        // --- Check for Game Over/Victory Conditions (After all updates and collisions) ---
        // Check if player is *no longer active* (meaning their death animation has finished).
        if (player && !player.isActive) {
            console.log("Main: Player inactive (death animation finished). Triggering Game Over.");
            handleGameOver();
            // No return needed; the next frame's check will cause it to exit the logic section.
        }
        // Check if the portal has been destroyed.
        if (portal && portal.isAlive && !portal.isAlive()) { // Add check for portal.isAlive existence first
            console.log("Main: Portal health zero. Triggering Game Over.");
            handleGameOver();
            // No return needed.
        }

        // Check if WaveManager signals all waves are cleared AND there are no *living* enemies remaining.
        const livingEnemies = EnemyManager.getLivingEnemyCount(); // This correctly excludes enemies currently in dying animation
        if (updatedWaveInfo.allWavesCleared && livingEnemies === 0) {
             console.log("Main: WaveManager signals all waves cleared and no living enemies remaining. Triggering Victory.");
             handleVictory();
             // No return needed.
        }

    } // --- End of Game Logic (Runs only if currentGameState === GameState.RUNNING) ---


    // --- Rendering ---
    // Rendering happens regardless of the RUNNING state, allowing static PAUSED/Overlay screens to be drawn.
    Renderer.clear(); // Clear the main canvas and fill with background color
    const mainCtx = Renderer.getContext(); // Get the 2D rendering context

    // Apply camera transformations (scale and translation) to the context
    mainCtx.save(); // Save context state before applying transformations
    mainCtx.scale(cameraScale, cameraScale); // Apply zoom (scale)
    mainCtx.translate(-cameraX, -cameraY); // Apply scroll/pan (translation)

    // Draw static world (rendered once to an off-screen canvas and drawn as an image)
    World.draw(mainCtx); // This draws the updated gridCanvas

    // Draw debug grid if enabled (draws directly onto the main canvas)
    GridRenderer.drawStaticGrid(mainCtx, isGridVisible);

    // Draw dynamic entities and elements
    // Draw items (Items should be drawn regardless of wave state if present)
    ItemManager.draw(mainCtx);

    // Draw portal (always draw if exists and not destroyed)
    if (portal) {
         // Portal visual (and safety radius circle) should be drawn even if not gameplay active
         portal.setSafetyRadius(currentPortalSafetyRadius); // Ensure portal has the current radius
         portal.draw(mainCtx);
    }

    // Draw enemies (Draw if active OR dying - Enemy.draw handles this internally)
    // Draw enemies regardless of RUNNING state, if they exist and are dying/active for animation
    EnemyManager.draw(mainCtx);


    // Draw player and their visual elements (Draw if active OR dying - Player.draw handles this internally)
    // Draw player regardless of RUNNING state (except GAME_OVER/VICTORY where player object might be null or irrelevant)
    if (player && currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY) {
         player.draw(mainCtx); // player.draw handles isActive/isDying internally

         // Draw ghost block ONLY during active gameplay phases and if material is selected AND player is interactable
         const waveInfoAtDraw = WaveManager.getWaveInfo(); // Get current wave state info for rendering decisions
         const currentWaveManagerStateAtDraw = waveInfoAtDraw.state;
         const isGameplayActiveAtDraw = currentWaveManagerStateAtDraw === 'PRE_WAVE' || currentWaveManagerStateAtDraw === 'WAVE_COUNTDOWN';
         // Check player validity and state again before drawing ghost block
         const playerIsInteractableAtDraw = player && player.isActive && !player.isDying;

         // Ghost block requires player to be interactive (alive, not dying) AND in a gameplay active phase AND a material is selected
         if (playerIsInteractableAtDraw && isGameplayActiveAtDraw && player.isMaterialSelected()) {
              player.drawGhostBlock(mainCtx);
         }
    }

    mainCtx.restore(); // Restore context state (important for UI drawing etc.)


    // --- UI Updates ---
    // UI updates should run every frame regardless of RUNNING state to reflect timers, health, etc.
    if (UI.isInitialized()) {
        // Update player-related UI (health bar, inventory, weapon slots)
        // Pass player info even if player is dying or inactive so UI can show 0 health
        const playerExists = !!player; // Check if player object exists
        UI.updatePlayerInfo(
            playerExists ? player.getCurrentHealth() : 0,
            playerExists ? player.getMaxHealth() : Config.PLAYER_MAX_HEALTH_DISPLAY,
            playerExists ? player.getInventory() : {},
            playerExists ? player.hasWeapon(Config.WEAPON_TYPE_SWORD) : false,
            playerExists ? player.hasWeapon(Config.WEAPON_TYPE_SPEAR) : false,
            playerExists ? player.hasWeapon(Config.WEAPON_TYPE_SHOVEL) : false
        );

        // Update portal-related UI (health bar)
        const portalExists = !!portal; // Check if portal object exists
        UI.updatePortalInfo(
            portalExists ? portal.currentHealth : 0,
            portalExists ? portal.maxHealth : Config.PORTAL_INITIAL_HEALTH
        );

        // Update wave timer and info based on the latest wave state
        UI.updateWaveTimer(WaveManager.getWaveInfo()); // Always update UI timer based on latest info

        // Settings button states are updated by their toggle functions or game start/reset
        // UI.updateSettingsButtonStates(...)
     } else {
        // console.error("UI not initialized, skipping UI updates."); // Keep console less noisy
     }


    // The recursive requestAnimationFrame call is at the very top of the function.
    // If we reach here, the next frame has already been requested.
}


// Calculates and sets the initial camera position, centering it on the player.
// Called ONCE at the start of a new game.
function calculateInitialCamera() {
     if (player) { // Only calculate if player object exists
        const viewWidth = Config.CANVAS_WIDTH; // Internal rendering width (matches canvas.width)
        const viewHeight = Config.CANVAS_HEIGHT; // Internal rendering height (matches canvas.height)

        // Reset zoom to default on game start
        cameraScale = 1.0;

        // Calculate the visible area of the world at the current scale.
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;

        // Calculate the target camera position to center the view on the player's center.
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        let targetX = playerCenterX - (visibleWorldWidth / 2);
        let targetY = playerCenterY - (visibleWorldHeight / 2);

        // --- Clamp Camera Position to World Boundaries ---
        // Calculate the actual size of the world in pixels (grid dimensions * block size).
        const worldPixelWidth = getWorldPixelWidth();
        const worldPixelHeight = getWorldPixelHeight();

        // Determine the maximum scroll position for X and Y, ensuring the camera doesn't show outside the world on the right/bottom.
        // Use Math.max(0, ...) in case the world is smaller than the viewport (prevents negative max scroll).
        const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth);
        const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);

        // Clamp the target camera position to stay within the valid world bounds.
        cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
        cameraY = Math.max(0, Math.min(targetY, maxCameraY));

        // --- Center Camera If World is Smaller Than Viewport ---
        // If the world is narrower than the visible area, center the camera horizontally.
        if (worldPixelWidth <= visibleWorldWidth) {
             cameraX = (worldPixelWidth - visibleWorldWidth) / 2;
        }
        // If the world is shorter than the visible area at the current scale, center the camera vertically.
        if (worldPixelHeight <= visibleWorldHeight) {
             cameraY = (worldPixelHeight - visibleWorldHeight) / 2;
        }
        // console.log(`Initial Camera Set: (${cameraX.toFixed(1)}, ${cameraY.toFixed(1)}) @ scale ${cameraScale.toFixed(2)}`);
     }
     else {
         // If no player exists (e.g., on initial load or after game over), set default camera state (top-left corner, scale 1).
         cameraX = 0;
         cameraY = 0;
         cameraScale = 1.0;
         // console.log("Initial Camera Set: Player not found, defaulting camera to (0,0) @ scale 1.0");
     }
}

// Updates the camera position during gameplay, following the player and clamping to bounds.
// Called every frame DURING THE RUNNING STATE, AFTER entity updates.
function calculateCameraPosition() {
    // *** MODIFIED: Only calculate if player object exists AND is active ***
    // The camera should follow during the dying animation (isActive is still true).
    // It should stop following once isActive is false (death animation finished).
    if (!player || !player.isActive) {
         // If player is not active, the camera should stop following.
         // Its position remains whatever it was in the last frame player was active.
         // console.log("calculateCameraPosition: Player not active, camera not following.");
         return; // Stop execution of the function if player is not active
    }

    const viewWidth = Config.CANVAS_WIDTH; // Internal canvas width
    const viewHeight = Config.CANVAS_HEIGHT; // Internal canvas height

    // Calculate the visible area of the world at the current camera scale.
    const visibleWorldWidth = viewWidth / cameraScale;
    const visibleWorldHeight = viewHeight / cameraScale;

    // Calculate the target camera position to center the view on the player's center.
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    let targetX = playerCenterX - (visibleWorldWidth / 2);
    let targetY = playerCenterY - (visibleWorldHeight / 2);

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
    cameraY = Math.max(0, Math.min(targetY, maxCameraY));

    // --- Center Camera If World is Smaller Than Viewport ---
    // If the world is narrower than the visible area, center the camera horizontally.
    if (worldPixelWidth <= visibleWorldWidth) {
         cameraX = (worldPixelWidth - visibleWorldWidth) / 2;
    }
    // If the world is shorter than the visible area, center the camera vertically.
    if (worldPixelHeight <= visibleWorldHeight) {
         cameraY = (worldPixelHeight - visibleWorldHeight) / 2;
    }
     // console.log(`Camera Pos: (${cameraX.toFixed(1)}, ${cameraY.toFixed(1)})`); // Too noisy
}

// --- Initialization Function ---
// Initializes the game environment, DOM references, event listeners, and core systems.
// Called once when the DOM is fully loaded.
function init() {
    console.log(">>> Initializing Game Environment <<<");
    currentGameState = GameState.PRE_GAME; // Set the initial main game state.

    try {
        // --- Get Essential DOM References ---
        appContainer = document.getElementById('app-container');
        gameOverlay = document.getElementById('game-overlay');

        // Get Overlay Buttons & Stats Text
        startGameButton = document.getElementById('start-game-button');
        resumeButton = document.getElementById('resume-button');
        restartButtonGameOver = document.getElementById('restart-button-overlay');
        restartButtonVictory = document.getElementById('restart-button-overlay-victory');
        gameOverStatsTextP = document.getElementById('gameover-stats-text');
        victoryStatsTextP = document.getElementById('victory-stats-text');

        // Get Settings Button References
        btnToggleGrid = document.getElementById('btn-toggle-grid');
        muteMusicButtonEl = document.getElementById('btn-mute-music');
        muteSfxButtonEl = document.getElementById('btn-mute-sfx');

        // --- Verify Essential DOM Elements Are Found ---
        // Combine all required elements for a single check.
        const requiredElements = [
             appContainer, gameOverlay,
             startGameButton, resumeButton, restartButtonGameOver, restartButtonVictory,
             gameOverStatsTextP, victoryStatsTextP,
             btnToggleGrid, muteMusicButtonEl, muteSfxButtonEl // Include settings buttons (using correct variable names now)
        ];

        // Use `some()` to check if *any* element in the list is missing.
        if (requiredElements.some(el => !el)) {
             // Identify which specific elements are missing for better debugging output.
             const elementNames = [
                 'appContainer (#app-container)', 'gameOverlay (#game-overlay)',
                 'startGameButton (#start-game-button)', 'resumeButton (#resume-button)',
                 'restartButtonGameOver (#restart-button-overlay)', 'restartButtonVictory (#restart-button-overlay-victory)',
                 'gameOverStatsTextP (#gameover-stats-text)', 'victoryStatsTextP (#victory-stats-text)',
                 'btnToggleGrid (#btn-toggle-grid)', 'muteMusicButtonEl (#btn-mute-music)', 'muteSfxButtonEl (#btn-mute-sfx)' // Names for settings buttons
             ];
             const missing = requiredElements
                 .map((el, i) => el ? null : elementNames[i])
                 .filter(name => name !== null); // Filter out the names of elements that were found

             // Throw a descriptive error if required elements are missing.
             throw new Error(`FATAL INIT ERROR: Essential DOM elements not found: ${missing.join(', ')}! Please check index.html.`);
        }

        // --- Setup Event Listeners for Overlay Buttons ---
        startGameButton.addEventListener('click', startGame);
        // The resume button listener will also handle resuming *after* an auto-pause caused by tab visibility.
        resumeButton.addEventListener('click', resumeGame);
        restartButtonGameOver.addEventListener('click', restartGame);
        restartButtonVictory.addEventListener('click', restartGame);

        // Setup Event Listeners for Settings Buttons (NEW)
        // These listeners call the corresponding toggle functions defined above.
        btnToggleGrid.addEventListener('click', toggleGridDisplay);
        muteMusicButtonEl.addEventListener('click', toggleMusicMute);
        muteSfxButtonEl.addEventListener('click', toggleSfxMute);


        // --- Initialize Core Systems that DON'T Depend on Game Objects (Player, Portal) ---

        // Initialize the Renderer first. It sets up the main canvas and the off-screen grid canvas.
        const canvas = document.getElementById('game-canvas');
         if (!canvas) { // Double-check canvas existence before passing to Renderer init
             throw new Error("FATAL INIT ERROR: Canvas element 'game-canvas' not found!");
         }
        Renderer.init(); // Sets internal canvas resolution (from Config)
        Renderer.createGridCanvas(); // Creates off-screen canvas for static world rendering

        AudioManager.init(); // creates audio elements and applies initial mute state from its own flags


        // Initialize Game UI. This finds sidebar UI elements, sets up item/weapon slots, and populates the UI.actionButtons map which Input.js relies on.
        if (!UI.initGameUI()) {
             throw new Error("FATAL INIT ERROR: UI initialization failed. Check console for missing sidebar elements or item slot issues.");
        }

         // Initialize Input handlers. This needs access to the UI.actionButtons map,
         // so it must be called *after* UI.initGameUI.
         Input.init();


        // --- Initialize Module-Level State Variables ---
        // These variables manage the global state within main.js.
        lastTime = 0; // Critical for the first dt calculation in the game loop.
        currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // Manages the portal's dynamic safety radius.
        isAutoPaused = false; // Flag to track if the game was paused automatically due to visibility change.
        isGridVisible = false; // Initial state for the debug grid (hidden).

        // Update UI settings buttons immediately to reflect the default states after init.
        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());


        // --- Setup Visibility Change Listener for Auto-Pause ---
        // Listen for the browser tab/window visibility changing.
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // --- Show Initial Overlay ---
        // Start the game by displaying the title screen overlay.
        showOverlay(GameState.PRE_GAME);

        console.log(">>> Game Initialization Complete <<<");

    } catch (error) {
        // --- Handle Fatal Initialization Errors ---
        console.error("FATAL: Initialization Error:", error);
        if (gameOverlay) {
            // Apply styles directly to make the error message prominent and override any default overlay styles.
            gameOverlay.style.width = '100%';
            gameOverlay.style.height = '100%';
            gameOverlay.style.position = 'fixed'; // Use fixed to cover the whole viewport
            gameOverlay.style.top = '0';
            gameOverlay.style.left = '0';
            gameOverlay.style.display = 'flex'; // Use flexbox to center content
            gameOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)'; // More opaque background
            gameOverlay.style.color = 'red'; // Error text color
            gameOverlay.style.zIndex = '1000'; // Ensure it's on top of everything
            gameOverlay.style.justifyContent = 'center'; // Center horizontally
            gameOverlay.style.alignItems = 'center'; // Center vertically
            gameOverlay.style.flexDirection = 'column'; // Stack content vertically
            gameOverlay.style.textAlign = 'center'; // Center text
            gameOverlay.style.padding = '20px'; // Add some padding around the content
            gameOverlay.style.boxSizing = 'border-box'; // Include padding in element's total width and height
            // Set the HTML content of the overlay to display the error message.
            gameOverlay.innerHTML = `
                <div id="overlay-error-content" style="display: flex; flex-direction: column; align-items: center; max-width: 600px;">
                    <h1 style="font-size: 2.5em; margin-bottom: 1rem; font-family: 'RubikIso', sans-serif;">Game Error</h1>
                    <p style="font-size: 1.3em; margin-bottom: 1.5rem;">An unrecoverable error occurred during initialization.</p>
                    <p style="font-size: 1.1em; margin-bottom: 2rem; word-break: break-word;">Error: ${error.message}</p>
                    <p style="font-size: 1em;">Please check the browser's developer console (usually by pressing F12) for more technical details and try refreshing the page.</p>
                </div>`;
            // Ensure the overlay is fully visible, overriding any CSS transitions that might hide it by default.
            gameOverlay.classList.add('active'); // Assuming 'active' class sets opacity to 1
            // Apply background blur if the app container exists and is visible.
            if(appContainer) appContainer.classList.add('overlay-active');
                // Attempt to stop any music that might have started during partial initialization.
                AudioManager.stopAllMusic();
        } else {
            alert(`FATAL Initialization Error:\n${error.message}\n`); // if gameOverlay element couldn't be found, fall back to browser alert
        }
    }
}

// --- Auto-Pause When Hidden ---
function handleVisibilityChange() {
    if (document.hidden && currentGameState === GameState.RUNNING) {
        console.log("Document hidden, auto-pausing game.");
        isAutoPaused = true; // set auto-pause to true so we know it wasn't a user-initiated pause
        pauseGame(); // call pauseGame function to handle state transition and overlay
    } // if document becomes visible, we don't automatically resume - user must click button to trigger resumeGame()
}

// --- Listener to Run init Once DOM Loaded ---
window.addEventListener('DOMContentLoaded', init);