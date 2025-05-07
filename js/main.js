// =============================================================================
// root/js/main.js - Game Entry Point and Main Loop
// =============================================================================

import * as UI from './ui.js';
import { Player } from './player.js';
import * as Input from './input.js';
import * as Config from './config.js';
import * as Renderer from './renderer.js';
import * as CollisionManager from './collisionManager.js';
import * as WorldManager from './worldManager.js';
import * as ItemManager from './itemManager.js';
import * as EnemyManager from './enemyManager.js';
import * as WaveManager from './waveManager.js';
import * as GridCollision from './utils/gridCollision.js';
import * as GridRenderer from './utils/grid.js';
import * as AudioManager from './audioManager.js';
import * as AgingManager from './agingManager.js';
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
let epochOverlayEl = null;
let titleStartButton = null;
let mainmenuStartGameButton = null;
let mainmenuSettingsButton = null;
let settingsBackButton = null;
let resumeButton = null;
let restartButtonGameOver = null;
let restartButtonVictory = null;
let restartButtonPause = null; // pause restart button
let gameOverStatsTextP = null;
let victoryStatsTextP = null;
let btnToggleGrid = null;
let muteMusicButtonEl = null;
let muteSfxButtonEl = null;
let cutsceneImages = []; // array of HTMLImageElements
let currentCutsceneImageIndex = 0;
let cutsceneTimer = 0;
let cutsceneDurationPerImage = Config.CUTSCENE_IMAGE_DURATION;
let cutsceneSkipButton = null;

// --- Game State Enum (Expanded) ---
const GameState = Object.freeze({
    PRE_GAME: 'PRE_GAME',       // title screen
    MAIN_MENU: 'MAIN_MENU',     // main menu screen
    SETTINGS_MENU: 'SETTINGS_MENU', // settings menu screen
    CUTSCENE: 'CUTSCENE',       // intro cutscene playing
    RUNNING: 'RUNNING',         // loop active, timers decrement, physics run, state transitions occur
    PAUSED: 'PAUSED',           // loop paused, no updates (except cutscene timer if state was CUTSCENE when paused?) - Let's only pause RUNNING.
    GAME_OVER: 'GAME_OVER',     // gameover screen
    VICTORY: 'VICTORY'          // victory screen
});
let currentGameState = GameState.PRE_GAME; // Initial state
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
    // Ensure camera can only be updated if game is running or paused (not during overlays or menu states)
     if (currentGameState !== GameState.RUNNING && currentGameState !== GameState.PAUSED) {
        return; // Ignore zoom input outside active game states
     }
    const oldScale = cameraScale;
    let newScale = cameraScale + deltaScale;
    const internalCanvasWidth = Config.CANVAS_WIDTH; // internal canvas dimensions
    const internalCanvasHeight = Config.CANVAS_HEIGHT;
    const worldPixelWidth = getWorldPixelWidth(); // world dimensions
    const worldPixelHeight = getWorldPixelHeight();
    const scaleToFitWidth = (worldPixelWidth > 0) ? internalCanvasWidth / worldPixelWidth : 1; // calculate minimum required to fill viewport (no black bars) - avoid division by zero if dimensions somehow are
    const scaleToFitHeight = (worldPixelHeight > 0) ? internalCanvasHeight / worldPixelHeight : 1;
    const minScaleRequired = Math.max(scaleToFitWidth, scaleToFitHeight);
    const effectiveMinScale = Math.max(Config.MIN_CAMERA_SCALE, minScaleRequired); // The effective minimum scale is the LARGER of the configured minimum and the required scale to fill the view.
    newScale = Math.max(effectiveMinScale, Math.min(newScale, Config.MAX_CAMERA_SCALE)); // Clamp the new scale between the effective minimum and the configured maximum.
    cameraScale = newScale; // Apply the final clamped scale. Camera position will be re-clamped in game loop by calculateCameraPosition.
}
// --- Convert canvas pixel coordinates to world coordinates ---
function getMouseWorldCoords(inputMousePos) {
    // Ensure inputMousePos is valid
    if (!inputMousePos || typeof inputMousePos.x !== 'number' || typeof inputMousePos.y !== 'number' || isNaN(inputMousePos.x) || isNaN(inputMousePos.y)) {
         return { // return center of the viewport in world coordinates as a fallback
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
    console.log(`Main: Triggered by WaveManager - Starting Wave ${waveNumber}`);
    // Epoch text is now triggered by WaveManager when entering WARPPHASE
    // const epochYear = Config.EPOCH_MAP[waveNumber];
    // if (epochYear !== undefined) {
    //     UI.showEpochText(epochYear);
    // } else {
    //     console.warn(`Main: No epoch defined in Config.EPOCH_MAP for wave ${waveNumber}.`);
    //     UI.showEpochText(`Wave ${waveNumber} Starting`); // fallback naming by wave number
    // }
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
    console.log(`Main: SFX is now ${AudioManager.getSfxMutedState() ? 'muted' : 'unmuted'}.`); // Corrected log message
    // Update UI button appearance immediately
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), newState);
}
// =============================================================================
// --- Overlay Management ---
// =============================================================================
// Shows a specific game overlay state (title, pause, game over, victory, menus, cutscene)
// Handles adding/removing classes and audio transitions.
function showOverlay(stateToShow) {
    // Ensure necessary overlay elements and the app container exist
    if (!gameOverlay || !appContainer) {
         console.error("ShowOverlay: Core overlay/app container not found!");
         return; // Cannot show overlay if critical elements are missing
    }
    // Remove all previous state-specific classes and overlay-active class immediately
    gameOverlay.classList.remove('show-title', 'show-mainmenu', 'show-settings', 'show-cutscene', 'show-pause', 'show-gameover', 'show-victory'); // Added new states
    appContainer.classList.remove('overlay-active'); // Remove blur/dim from previous state

    // Stop any UI music that might be playing before starting the new one
    AudioManager.stopUIMusic();
    // Stop game music if applicable (not needed for pause state)
    if (currentGameState !== GameState.PAUSED) { // The state *before* calling showOverlay
        AudioManager.stopGameMusic(); // Stop game music if we are NOT coming from PAUSED
    }

    // Reset UI music volume to default whenever showing an overlay state that has UI music
    // Specific logic for audio based on the new state being shown
    switch (stateToShow) {
        case GameState.PRE_GAME:
            gameOverlay.classList.add('show-title');
            // Play title music if defined (or fallback)
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.title) {
                // AudioManager.playUIMusic(Config.AUDIO_TRACKS.title); // TODO: Uncomment when title music track is added
            } else if (Config.AUDIO_TRACKS.pause) {
                 AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause); // Fallback
            } else {
                 console.warn("Title and Pause music tracks not defined.");
            }
            break;
        case GameState.MAIN_MENU: // Added
            gameOverlay.classList.add('show-mainmenu');
             AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
             // Play Main Menu music (reuse pause music for now)
             if (Config.AUDIO_TRACKS.pause) { // Using pause music as menu music for now
                 AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
             } else {
                  console.warn("Pause music track not defined for main menu.");
             }
            break;
        case GameState.SETTINGS_MENU: // Added
            gameOverlay.classList.add('show-settings');
             AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
             // Play Settings Menu music (reuse pause music for now)
             if (Config.AUDIO_TRACKS.pause) {
                 AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
             } else {
                  console.warn("Pause music track not defined for settings menu.");
             }
            break;
        case GameState.CUTSCENE: // Added
            gameOverlay.classList.add('show-cutscene');
            // Cutscene might have its own audio or be silent
            // AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME); // Or set specific cutscene volume
            // if (Config.AUDIO_TRACKS.introMusic) { // Example: Play intro music
            //      AudioManager.playUIMusic(Config.AUDIO_TRACKS.introMusic);
            // } else {
                 AudioManager.stopUIMusic(); // Ensure UI music is off if silent cutscene
                 AudioManager.stopGameMusic(); // Ensure game music is off
            // }
            // Cutscene images visibility is handled by updateCutscene or startCutscene
            break;
        case GameState.PAUSED:
            gameOverlay.classList.add('show-pause');
             AudioManager.pauseGameMusic(); // Pause game music and retain position
            if (Config.AUDIO_TRACKS.pause) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause); // Play pause music
            } else {
                 console.warn("Pause music track not defined.");
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
            // Play game over music if defined (or fallback)
             AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.gameOver) {
                 // AudioManager.playUIMusic(Config.AUDIO_TRACKS.gameOver); // TODO: Uncomment when game over music track is added
            } else if (Config.AUDIO_TRACKS.pause) {
                  AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause); // Fallback
             } else {
                  console.warn("Game Over and Pause music tracks not defined.");
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
             AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.victory) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.victory); // Play victory music
            } else if (Config.AUDIO_TRACKS.pause) {
                 AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause); // Fallback
            } else {
                 console.warn("Victory and Pause music tracks not defined.");
            }
            break;
        default:
            console.warn(`ShowOverlay: Unknown state requested: ${stateToShow}`);
            // As a fallback, maybe show the title screen?
             gameOverlay.classList.add('show-title');
             AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
             if (Config.AUDIO_TRACKS.pause) { // Fallback to pause music
                  AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
             }
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
    // Resume game music if the state is RUNNING (handled by AudioManager.unpauseGameMusic within hideOverlay call in resumeGame)
}

// =============================================================================
// --- Game State Control Functions (Expanded) ---
// =============================================================================

// Function triggered by the initial Title Screen START button
function startGame() {
    console.log(">>> [main.js] Title Screen START clicked. Showing Main Menu <<<");
    showMainMenu(); // Transition to the Main Menu state
}

// Shows the Main Menu
function showMainMenu() {
    // Stop any potentially running game music just in case we navigated back here
     AudioManager.stopGameMusic();
    // Clear any entities from a previous game if this is a restart via Main Menu
    EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
    ItemManager.clearItemsOutsideRadius(0, 0, Infinity);

    currentGameState = GameState.MAIN_MENU;
    showOverlay(GameState.MAIN_MENU);
    console.log(">>> [main.js] Game State: MAIN_MENU <<<");
}

// Shows the Settings Menu
function showSettingsMenu() {
    currentGameState = GameState.SETTINGS_MENU;
    showOverlay(GameState.SETTINGS_MENU);
    console.log(">>> [main.js] Game State: SETTINGS_MENU <<<");
}

// Starts the Intro Cutscene (triggered by Main Menu START GAME button)
function startCutscene() {
    // Skip cutscene if debug flag is true
    if (Config.DEBUG_SKIP_CUTSCENE) {
        console.log(">>> [main.js] DEBUG: Skipping cutscene, starting game directly <<<");
        initializeAndRunGame(); // Jump directly to game initialization
        return;
    }

    console.log(">>> [main.js] Starting Cutscene <<<");
    currentGameState = GameState.CUTSCENE;
    showOverlay(GameState.CUTSCENE); // Show cutscene overlay

    // Initialize cutscene state
    currentCutsceneImageIndex = 0;
    cutsceneTimer = cutsceneDurationPerImage; // Timer for the first image

    // Hide all cutscene images initially
    cutsceneImages.forEach(img => {
        img.classList.remove('active');
        // Also reset opacity/z-index if needed, though CSS handles it
        // img.style.opacity = '0';
        // img.style.zIndex = '0';
    });

    // Show the first image immediately
    if (cutsceneImages[currentCutsceneImageIndex]) {
        cutsceneImages[currentCutsceneImageIndex].classList.add('active');
        // console.log(`Showing cutscene image ${currentCutsceneImageIndex + 1}`);
    } else {
        console.error("Cutscene ERROR: First image element not found!");
        // If images fail, maybe skip cutscene or show error?
        initializeAndRunGame(); // Fallback to starting game if images aren't found
        return;
    }

    // Optional: Start cutscene music
    // if (Config.AUDIO_TRACKS.introMusic) {
    //      AudioManager.playUIMusic(Config.AUDIO_TRACKS.introMusic);
    // }

    console.log(">>> [main.js] Game State: CUTSCENE <<<");
}

// Updates the cutscene timer and switches images
function updateCutscene(dt) {
    if (currentGameState !== GameState.CUTSCENE) return; // Only update if in cutscene state

    cutsceneTimer -= dt; // Decrement timer

    if (cutsceneTimer <= 0) {
        // Timer finished for the current image
        // Hide the current image
        if (cutsceneImages[currentCutsceneImageIndex]) {
            cutsceneImages[currentCutsceneImageIndex].classList.remove('active');
             // console.log(`Finished cutscene image ${currentCutsceneImageIndex + 1}`);
        }

        currentCutsceneImageIndex++; // Move to the next image

        if (currentCutsceneImageIndex < cutsceneImages.length) {
            // There are more images, show the next one
            cutsceneTimer = cutsceneDurationPerImage; // Reset timer for the next image
            if (cutsceneImages[currentCutsceneImageIndex]) {
                cutsceneImages[currentCutsceneImageIndex].classList.add('active');
                 // console.log(`Showing cutscene image ${currentCutsceneImageIndex + 1}`);
            } else {
                 console.error(`Cutscene ERROR: Image element ${currentCutsceneImageIndex + 1} not found!`);
                 // Handle missing image: skip to next or end cutscene
                 updateCutscene(0); // Recursively call with dt=0 to try the next image immediately
                 return; // Exit this update call
            }
        } else {
            // All images have been shown, end the cutscene and start the game
            console.log(">>> [main.js] Cutscene finished. Starting Game <<<");
             AudioManager.stopUIMusic(); // Stop cutscene/UI music
            initializeAndRunGame(); // Call the function that actually starts the game
        }
    }
}

// ADDED: Skips the cutscene and immediately starts the game.
function skipCutscene() {
     // Only skip if currently in the cutscene state
     if (currentGameState !== GameState.CUTSCENE) {
         console.warn("skipCutscene called but game is not in CUTSCENE state.");
         return;
     }
     console.log(">>> [main.js] Skipping Cutscene <<<");

     // Stop cutscene audio (handled by initializeAndRunGame/hideOverlay, but safety)
     AudioManager.stopUIMusic();

     // Immediately transition to game initialization and RUNNING state
     initializeAndRunGame();
}

// Expose skipCutscene globally so it can be called directly by the button's click listener
window.skipCutscene = skipCutscene;


// (Renamed from the original startGame) - Initializes all game systems and starts the RUNNING state.
// Triggered ONLY at the end of the cutscene, or directly if cutscene is skipped.
function initializeAndRunGame() {
    if (currentGameState === GameState.RUNNING) { // Prevent accidental multiple calls
        console.warn("[main.js] initializeAndRunGame called but game already RUNNING.");
        return;
    }
    // Ensure we are transitioning from a menu/cutscene state (optional but good check)
     if (currentGameState !== GameState.MAIN_MENU && currentGameState !== GameState.CUTSCENE && currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY && currentGameState !== GameState.PAUSED) {
          console.warn(`[main.js] initializeAndRunGame called from unexpected state: ${currentGameState}. Allowing, but investigate.`);
     }

    try { // <--- ADD THIS TRY BLOCK
        console.log(">>> [main.js] Initializing New Game <<<");
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
         console.error("[main.js] FATAL: Invalid Portal Spawn Y calculation! Defaulting position.");
         portal = new Portal(Config.CANVAS_WIDTH / 2 - Config.PORTAL_WIDTH / 2, 50); // Fallback to safe, high position
     } else {
         portal = new Portal(portalSpawnX, portalSpawnY); // Create portal
     }

    // World Init (includes generating terrain and initial flood fill, but NOT initial aging)
    WorldManager.init(portal); // Pass portalRef for potential use within WorldManager init (e.g. initial aging if it were there)

    // --- Apply Initial World Aging Passes AFTER generation and flood fill ---
    // Now that WorldManager and AgingManager are initialized, and the world is generated/flooded,
    // we can apply the initial aging passes here, passing the portal reference.
    const initialAgingPasses = Config.AGING_INITIAL_PASSES ?? 1; // Use default if config missing or invalid
    console.log(`[main.js] Applying initial world aging (${initialAgingPasses} passes) after generation...`);
    let totalChangedCellsInitialAging = 0;
    const changedCellsInitialAging = new Map(); // Use a Map to collect unique changes

    for (let i = 0; i < initialAgingPasses; i++) {
         // Use the base aging intensity for initial passes
         // AgingManager.applyAging returns a list of {c,r} changed cells
         // MODIFIED: Pass null for the portal reference during the initial aging pass
         const changedCellsInPass = AgingManager.applyAging(null, Config.AGING_BASE_INTENSITY);

         // Add the changed cells from this pass to the overall list for initial aging
         changedCellsInPass.forEach(({ c, r }) => {
             const key = `${c},${r}`;
             if (!changedCellsInitialAging.has(key)) {
                 changedCellsInitialAging.set(key, { c, r });
                 totalChangedCellsInitialAging++;
             }
         });
    }
    console.log(`[main.js] Initial world aging complete. Total unique cells changed: ${totalChangedCellsInitialAging}`);

    // --- Update Visuals and Water Simulation after Initial Aging ---
    // Update the static world canvas for all cells changed during initial aging
    changedCellsInitialAging.forEach(({ c, r }) => {
        WorldManager.updateStaticWorldAt(c, r); // Update the static visual representation
    });

    // Re-render the entire static world canvas once after all initial aging changes are drawn
    WorldManager.renderStaticWorldToGridCanvas();

    // Seed the water simulation queue based on the final world state after initial aging and rendering
    WorldManager.seedWaterUpdateQueue();


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
             console.error("[main.js] FATAL: Invalid Player Spawn Y calculation! Defaulting position.");
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
         console.error("[main.js] FATAL: Game Object Creation/Init Error Message:", error.message);
         console.error("[main.js] Error Stack:", error.stack);
         // Transition back to title screen on fatal game start error
         currentGameState = GameState.PRE_GAME;
         showOverlay(GameState.PRE_GAME); // Show title screen on fatal error
         alert("Error creating game objects. Please check console and refresh."); // User-facing alert
         return; // Abandon start sequence
     }
    // WaveManager Reset (needs the newly created portal reference)
    // This sets the WaveManager's internal state to 'PRE_WAVE' and its timer to Config.WAVE_START_DELAY (5.0)
    WaveManager.reset(handleWaveStart, portal);
    console.log("[main.js] WaveManager reset for new game.");


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
    console.log(`[main.js] Transitioning to GameState.RUNNING from ${currentGameState}`);
    currentGameState = GameState.RUNNING;
    hideOverlay(); // Hide any active overlay (title, menu, cutscene etc.)
    // Record game start time for potential future stats display
    gameStartTime = performance.now();
    // lastTime is updated unconditionally in gameLoop
    // Cancel any previous animation frame loop just in case (e.g., from a prior game instance)
    // === REMOVE THE gameLoopId CANCELLATION HERE ===
    // if (gameLoopId) {
    //     cancelAnimationFrame(gameLoopId);
    //     gameLoopId = null; // Clear the ID reference
    // }
    // ===============================================
    // Start the main game loop using requestAnimationFrame (already called at the top of gameLoop)
    // gameLoopId = requestAnimationFrame(gameLoop); // No need to call here, it's self-scheduling
    console.log(">>> [main.js] Game Started <<<");
} catch (error) { // <--- ADD THIS CATCH BLOCK
    console.error("[main.js] FATAL Error during initializeAndRunGame:", error);
    // Handle fatal errors during game startup - go back to title or show error screen
    // Use the existing error display logic from the init() function if needed
    // For debugging, logging and maybe an alert is enough.
    alert("FATAL Error starting game. Check console for details.");
    // Attempt to reset state to prevent loop from getting stuck
    currentGameState = GameState.PRE_GAME;
    showOverlay(GameState.PRE_GAME); // Show title screen
}
}// Pauses the currently running game. Exposed via window.pauseGameCallback.

function pauseGame() {
    // Only pause if currently RUNNING
    if (currentGameState !== GameState.RUNNING) {
         // console.warn("pauseGame called but game is not RUNNING."); // Too noisy if multiple presses
         return;
    }
    console.log(">>> [main.js] Pausing Game <<<");
    currentGameState = GameState.PAUSED; // Change main game state
    showOverlay(GameState.PAUSED); // Show pause overlay and handle audio
    // Stop the game loop by cancelling the animation frame request
    // No longer cancel the animation frame request, the loop just passes dt=0 when not RUNNING or CUTSCENE
    // if (gameLoopId) {
    //     cancelAnimationFrame(gameLoopId);
    //     gameLoopId = null; // Clear the ID reference
    // }
}
// Resumes the game from the paused state. Called when the user clicks "Resume" on the pause overlay.
function resumeGame() {
    // Only resume if the game is currently PAUSED
    if (currentGameState !== GameState.PAUSED) {
         // console.warn("resumeGame called but game is not PAUSED."); // Too noisy
         return;
    }
    console.log(">>> [main.js] Resuming Game <<<");

    // Reset the auto-pause flag if it was set (user manually resumed)
    isAutoPaused = false;

    // Transition back to RUNNING state
    console.log(`[main.js] Transitioning to GameState.RUNNING from ${currentGameState}`);
    currentGameState = GameState.RUNNING; // Transition back to RUNNING state

    // Hide the overlay and handle audio transition (stops UI music, unpauses game music)
    hideOverlay();

    // Unpause game music (handled by hideOverlay/AudioManager.unpauseGameMusic)
    // AudioManager.unpauseGameMusic(); // Called inside hideOverlay now

    // Restart the game loop if it's not already running
    // The requestAnimationFrame call is now at the top of gameLoop, so it will be called regardless of state.
    // We just need to ensure the loop *is* running if it was cancelled (e.g. by pauseGame) - but we stopped cancelling it.
    // If the loop was cancelled, we *would* need to call requestAnimationFrame here.
    // Since we changed to not cancelling the loop, no explicit restart is needed here.
    // if (!gameLoopId) {
    //     gameLoopId = requestAnimationFrame(gameLoop);
    // }
    // Note: lastTime should NOT be reset here, requestAnimationFrame will provide a correct timestamp.
    // We changed dt logic to handle this correctly.
}

// Handles the transition to the game over state. Triggered by gameLoop when player/portal health <= 0 or player death anim finishes.
function handleGameOver() {
    // Prevent multiple calls if already in the GAME_OVER state
    if (currentGameState === GameState.GAME_OVER) return;

    console.log(">>> [main.js] Handling Game Over <<<");
    currentGameState = GameState.GAME_OVER; // Change main game state

    // Notify WaveManager of game over state (primarily for timer text display)
    WaveManager.setGameOver();

    // Clear all enemies and items from the game world immediately
    // Use Infinity radius to clear all items and enemies regardless of their state or location.
    EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
    ItemManager.clearItemsOutsideRadius(0, 0, Infinity);

    // Show the game over overlay and handle audio transitions
    showOverlay(GameState.GAME_OVER);

    // Stop the game loop (optional, but can save CPU if loop does nothing significant outside RUNNING/CUTSCENE)
    // Let's keep the loop running to draw the static overlay.
    // if (gameLoopId) {
    //     cancelAnimationFrame(gameLoopId);
    //     gameLoopId = null;
    // }

    // Reset auto-pause flag on game over
    isAutoPaused = false;

    // Reset lastTime to 0 to ensure a fresh dt calculation if game is restarted later
    // No, lastTime is updated unconditionally now. It will be correct.
    // lastTime = 0;
}

// Handles the transition to the victory state. Triggered by gameLoop when WaveManager signals all waves cleared and enemies are gone.
function handleVictory() {
     // Prevent multiple calls if already in the VICTORY state
     if (currentGameState === GameState.VICTORY) return;

     console.log(">>> [main.js] Handling Victory! <<<");
     currentGameState = GameState.VICTORY; // Change main game state

     // Notify WaveManager of victory state (primarily for timer text display)
     WaveManager.setVictory();

     // Clear all enemies and items
     EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
     ItemManager.clearItemsOutsideRadius(0, 0, Infinity);

     // Show the victory overlay and handle audio transitions
     showOverlay(GameState.VICTORY);

     // Stop the game loop (optional, see game over)
     // if (gameLoopId) {
     //     cancelAnimationFrame(gameLoopId);
     //     gameLoopId = null;
     // }

     // Reset auto-pause flag
     isAutoPaused = false;

     // Reset lastTime for potential restart (not needed with new dt logic)
     // lastTime = 0;
}


// Restarts the game. Only allowed from GAME_OVER, VICTORY, PAUSED, or SETTINGS/MAIN_MENU states.
// This now takes the user back to the main menu.
function restartGame() {
    // Check if the current state is one from which restarting is permissible
    if (currentGameState !== GameState.GAME_OVER &&
        currentGameState !== GameState.VICTORY &&
        currentGameState !== GameState.PAUSED &&
        currentGameState !== GameState.SETTINGS_MENU && // Allow restarting from settings
        currentGameState !== GameState.MAIN_MENU) // Allow restarting from main menu (shouldn't happen via button click, but state might be there)
    {
        console.warn(`[main.js] restartGame called but game not in a restartable state (${currentGameState}).`);
        return;
    }
    console.log(">>> [main.js] Restarting Game (Returning to Main Menu) <<<");

    // Clear any existing game objects and state that shouldn't persist
    // The game will be fully re-initialized when initializeAndRunGame is called from the cutscene later.
    player = null; // Clear player reference
    portal = null; // Clear portal reference
    UI.setPlayerReference(null); // Notify UI
    UI.setPortalReference(null); // Notify UI
    EnemyManager.clearAllEnemies(); // Clear any lingering enemies
    ItemManager.clearAllItems(); // Clear any lingering items
    // Do NOT reset WaveManager here. reset() is called within initializeAndRunGame
    // WaveManager.reset(); // Reset wave manager state

    // Stop any music that might be playing (game or UI)
    AudioManager.stopAllMusic();

    // Stop the game loop if it happens to be in RUNNING state (which it shouldn't be if called from a menu/pause/end screen, but safety)
    // The loop isn't cancelled anymore, it just runs with dt=0 in non-active states.

    // Reset camera and other global state variables
    cameraX = 0;
    cameraY = 0;
    cameraScale = 1.0;
    currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS;
    isAutoPaused = false;
    isGridVisible = false; // Reset grid visibility

    // Update settings buttons UI based on reset states
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());


    // Reset cutscene variables just in case
    currentCutsceneImageIndex = 0;
    cutsceneTimer = 0;
    cutsceneImages.forEach(img => img.classList.remove('active'));


    // Transition to the Main Menu
    showMainMenu();
}


// --- Main game loop function, called by requestAnimationFrame ---
function gameLoop(timestamp) {

    // Request the next frame *before* any state changes or logic updates.
    // This ensures the loop continues even if the current frame throws an error.
    gameLoopId = requestAnimationFrame(gameLoop);

    // --- DEBUG LOG: Start of game loop, capture state and timestamp ---
    // ADDED: Log state every frame to see if the loop is running and state is changing
    // console.log(`[gameLoop::start] State: ${currentGameState}, Timestamp: ${timestamp.toFixed(2)}`); // Commented out - too noisy

    // ADDED: Wrap the core game logic and rendering in a try...catch block
    // This helps catch unhandled errors that might otherwise stop the rAF loop
    try {

        // Calculate delta time (time elapsed since last frame in seconds)
        // Calculate raw dt based on real time, regardless of game state.
        let rawDt = (lastTime === 0) ? 0 : (timestamp - lastTime) / 1000;
        lastTime = timestamp; // Always update lastTime for the next frame's calculation

        // Clamp raw dt to prevent physics instability (applies to RUNNING and CUTSCENE)
        rawDt = Math.min(rawDt, Config.MAX_DELTA_TIME);

        // Determine the actual dt to use for updates based on the game state.
        let dt = 0;
        if (currentGameState === GameState.RUNNING) {
            dt = rawDt; // Use real dt for physics and game logic
        } else if (currentGameState === GameState.CUTSCENE) {
             dt = rawDt; // Use real dt for cutscene timer
        } else {
            // dt remains 0 for all other states (menus, paused, game over, victory, pre-game loading).
            // This means physics/game timers are effectively paused, but rendering still happens.
        }

        // --- DEBUG LOG: Calculated dt and entering state blocks ---
        // ADDED: Log when entering the RUNNING state update block
        // if (currentGameState === GameState.RUNNING) {
        //    console.log(`[main.js::gameLoop] State: RUNNING. Dt: ${dt.toFixed(3)}. Running game logic.`);
        // } else if (currentGameState === GameState.CUTSCENE) {
        //     // Optional: Log when entering the CUTSCENE block
        //     // console.log(`[main.js::gameLoop] State: CUTSCENE, Dt: ${dt.toFixed(3)}. Updating cutscene.`);
        // } else {
        //     // Optional: Log for other states if needed for debugging flow
        //     // console.log(`[main.js::gameLoop] State: ${currentGameState}, Dt: ${dt.toFixed(3)}. Skipping game logic.`);
        // }


        // --- Game Logic & Updates (Conditional based on state) ---

        // **MODIFIED: Check for RUNNING state FIRST**
        if (currentGameState === GameState.RUNNING) {
            // --- All your core game update logic is here ---
            // This block will now execute when the state is RUNNING
            // and will use the non-zero dt calculated above.

            // ADDED: Logs before calling major update functions to confirm they are reached
            // console.log("Updating WaveManager..."); // Already added logs like this
            const previousWaveManagerState = WaveManager.getWaveInfo().state;
            WaveManager.update(dt, currentGameState); // Pass real dt and current state
            const updatedWaveInfo = WaveManager.getWaveInfo();
            const currentWaveManagerState = updatedWaveInfo.state;


            // Logic for increasing portal safety radius - triggered ONCE at the transition from BUILDPHASE to WARPPHASE
            // This happens *before* aging in WARPPHASE uses the radius.
             // WaveManager now handles triggering the cleanup/aging within its update() when entering WARPPHASE.
             // Main.js no longer needs to explicitly call AgingManager.applyAging or cleanup here.
             // Main.js only needs to update the portal instance's radius state for drawing purposes.
             if (currentWaveManagerState === 'WARPPHASE' && previousWaveManagerState === 'BUILDPHASE') {
                // Increase the safety radius based on the config value for wave progression
                currentPortalSafetyRadius += Config.PORTAL_RADIUS_GROWTH_PER_WAVE;
                // Update the portal instance's internal safety radius value for drawing and internal checks
                if(portal) portal.setSafetyRadius(currentPortalSafetyRadius);
                console.log(`[main.js] Portal Safety Radius Increased to ${currentPortalSafetyRadius.toFixed(1)}.`);
                // Cleanup/Aging logic is now handled by WaveManager's triggerWarpCleanup which is called on state transition
             }


            // --- Update Entities ---
            // console.log("Updating Player..."); // ADDED LOG
            // Entities update their positions, states, timers, animations etc.
            // They handle their own internal logic based on isActive/isDying flags.
            // Pass input only if player is capable of receiving it (active and not dying).
            // Pass player ref/pos only if player is capable of interacting/being targeted.

            // Update Player
            if (player) {
                // Get input state only if player is interactable and game is RUNNING
                // Input module now handles checking its own state flags, which are set by listeners *regardless* of GameState.
                // Player update function needs to decide whether to process input based on its own state (isActive, !isDying).
                const inputState = Input.getState(); // Always get raw input state
                // Get mouse/target positions always, even if player is dying (for drawing maybe, though player.draw handles it)
                const internalMousePos = Input.getMousePosition(); // Mouse pos is always tracked by Input module
                const targetWorldPos = getMouseWorldCoords(internalMousePos);
                const targetGridCell = getMouseGridCoords(internalMousePos);
                player.update(dt, inputState, targetWorldPos, targetGridCell); // Pass real dt and input state
            }

            // console.log("Calculating Camera Position..."); // ADDED LOG
            // Calculate and update camera position after player update, only if game is running
            // The calculateCameraPosition function now handles the player.isActive check internally.
            calculateCameraPosition();

            // console.log("Updating Enemies..."); // ADDED LOG
            // Update Enemies
            // Pass player position for AI targeting only if player is interactable AND game is RUNNING
            const playerPosForEnemies = (player && player.isActive && !player.isDying) ? player.getPosition() : null; // Check player validity and state here
            // Enemies update their state even if dying (to run animation timer)
            EnemyManager.update(dt, playerPosForEnemies); // Pass real dt

            // console.log("Updating Items..."); // ADDED LOG
            // Update Items
            // Pass player reference for item attraction only if player is interactable AND game is RUNNING
            const playerRefForItems = (player && player.isActive && !player.isDying) ? player : null; // Check player validity and state here
            // Items update their state even if not attracted
            ItemManager.update(dt, playerRefForItems); // Pass real dt

            // console.log("Updating World (Water Sim)..."); // ADDED LOG
            // World update (water flow, aging triggered by WaveManager)
            // WorldManager.update handles water flow only now. Aging is triggered by WaveManager.
            WorldManager.update(dt); // Pass real dt


            // --- Collision Detection (Only happens if RUNNING) ---
            // console.log("Checking Collisions..."); // ADDED LOG
            // Collision checks occur *after* entity positions and states (like isAttacking, isDying) are updated.
            // CollisionManager functions themselves check if entities are !isDying internally.
            if (player) { // Only check player collisions if player object exists (checks !player.isActive, !player.isDying internally)
                CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager); // Player vs items (pickup)
                CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies()); // Player attack vs enemies
                CollisionManager.checkPlayerAttackBlockCollisions(player); // Player attack vs blocks (digging)
                CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies()); // Player vs enemies (contact damage)
            }
            // Check enemy collisions with portal if portal exists and is alive
            if (portal && portal.isAlive()) { // Add check for portal.isAlive method
                 CollisionManager.checkEnemyPortalCollisions(EnemyManager.getEnemies(), portal);
            }

            // --- Check for Game Over/Victory Conditions (After all updates and collisions) ---
            // Check if player is *no longer active* (meaning their death animation has finished).
            // Also check if the portal has been destroyed. Either condition triggers Game Over.
            // Game Over transition is now handled by main.js checking these conditions.
            // console.log("Checking Game Over/Victory Conditions..."); // ADDED LOG
            if ((player && !player.isActive) || (portal && !portal.isAlive())) { // Corrected portal check
                if (player && !player.isActive) {
                    console.log("Main: Player inactive (death animation finished). Triggering Game Over.");
                } else if (portal && !portal.isAlive()) {
                    console.log("Main: Portal health zero. Triggering Game Over.");
                }
                handleGameOver(); // Transition to Game Over state
                // No return needed; the state change means next frame will skip the RUNNING block.
            }

            // Check if WaveManager signals all waves cleared AND there are no *living* enemies remaining.
            const livingEnemies = EnemyManager.getLivingEnemyCount(); // This correctly excludes enemies currently in dying animation
            if (updatedWaveInfo.allWavesCleared && livingEnemies === 0) {
                 console.log("Main: WaveManager signals all waves cleared and no living enemies remaining. Triggering Victory.");
                 handleVictory(); // Transition to Victory state
                 // No return needed.
            }

        // **MODIFIED: Now this is the else if**
        } else if (currentGameState === GameState.CUTSCENE) {
            updateCutscene(dt); // Pass real dt to update the timer
            // Note: No other updates happen in CUTSCENE state except the timer and image switching.
            // Rendering *still* happens below, drawing the static cutscene images via CSS.
        }
        // else states (PRE_GAME, MAIN_MENU, SETTINGS_MENU, PAUSED, GAME_OVER, VICTORY) skip both blocks


        // --- Rendering ---
        // Rendering happens regardless of the RUNNING state, allowing static PAUSED/Overlay screens to be drawn.
        Renderer.clear(); // Clear the main canvas and fill with background color
        const mainCtx = Renderer.getContext(); // Get the 2D rendering context

        // Only apply camera transformations and draw world/entities if the state is NOT one of the full-screen overlay menu states
        // This avoids trying to render game world underneath menus/cutscenes
        const isGameWorldVisible = currentGameState === GameState.RUNNING || currentGameState === GameState.PAUSED || currentGameState === GameState.GAME_OVER || currentGameState === GameState.VICTORY;

        if (isGameWorldVisible) {
             // Apply camera transformations (scale and translation) to the context
            mainCtx.save(); // Save context state before applying transformations
            mainCtx.scale(cameraScale, cameraScale); // Apply zoom (scale)
            mainCtx.translate(-cameraX, -cameraY); // Apply scroll/pan (translation)

            // Draw static world (rendered once to an off-screen canvas and drawn as an image)
            WorldManager.draw(mainCtx); // This draws the updated gridCanvas

            // Draw debug grid if enabled (draws directly onto the main canvas)
            GridRenderer.drawStaticGrid(mainCtx, isGridVisible);

            // Draw dynamic entities and elements
            // Draw items (Items should be drawn regardless of wave state if present)
            ItemManager.draw(mainCtx);

            // Draw portal (always draw if exists and not destroyed)
            if (portal) {
                 // Portal visual (and safety radius circle) should be drawn even if not gameplay active
                 // portal.safetyRadius is already updated by main.js when radius increases.
                 portal.draw(mainCtx); // Portal draw uses its internal radius state
            }

            // Draw enemies (Draw if active OR dying - Enemy.draw handles this internally)
            // Draw enemies regardless of RUNNING state, if they exist and are dying/active for animation
            EnemyManager.draw(mainCtx);


            // Draw player and their visual elements (Draw if active OR dying - Player.draw handles this internally)
            // Draw player regardless of RUNNING state (except GAME_OVER/VICTORY where player object might be null or irrelevant)
            // Draw player in PAUSED state too
            if (player && currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY) {
                 player.draw(mainCtx); // player.draw handles isActive/isDying internally

                 // Draw ghost block ONLY during active gameplay phases and if material is selected AND player is interactable
                 const waveInfoAtDraw = WaveManager.getWaveInfo(); // Get current wave state info for rendering decisions
                 const currentWaveManagerStateAtDraw = waveInfoAtDraw.state;
                 const isGameplayActiveAtDraw = currentWaveManagerStateAtDraw === 'PRE_WAVE' || currentWaveManagerStateAtDraw === 'WAVE_COUNTDOWN' || currentWaveManagerStateAtDraw === 'BUILDPHASE';
                 // Check player validity and state again before drawing ghost block
                 // Player must be alive and not dying to place blocks
                 const playerIsInteractableAtDraw = player && player.isActive && !player.isDying;

                 // Ghost block requires player to be interactive (alive, not dying) AND in a gameplay active phase AND a material is selected
                 if (playerIsInteractableAtDraw && isGameplayActiveAtDraw && player.isMaterialSelected()) {
                      player.drawGhostBlock(mainCtx);
                 }
            }

            mainCtx.restore(); // Restore context state (important for UI drawing etc.)

        } // End if(isGameWorldVisible)


        // --- UI Updates ---
        // UI updates should run every frame regardless of RUNNING state to reflect timers, health, etc.
        if (UI.isInitialized()) {
            // Update player-related UI (health bar, inventory, weapon slots)
            // Pass player info even if player is dying or inactive so UI can show 0 health
            // UI updates happen *even if the game world isn't visible* (e.g., pause menu shows health)
            const playerExists = !!player; // Check if player object exists
            UI.updatePlayerInfo(
                playerExists ? player.getCurrentHealth() : 0,
                playerExists ? player.getMaxHealth() : Config.PLAYER_MAX_HEALTH_DISPLAY,
                playerExists ? player.getInventory() : {},
                playerExists ? player.hasWeapon(Config.WEAPON_TYPE_SWORD) : false,
                playerExists ? player.hasWeapon(Config.WEAPON_TYPE_SPEAR) : false,
                playerExists ? player.hasWeapon(Config.WEAPON_TYPE_SHOVEL) : false // Pass shovel status
            );

            // Update portal-related UI (health bar)
            const portalExists = !!portal; // Check if portal object exists
            UI.updatePortalInfo(
                portalExists ? portal.currentHealth : 0,
                portalExists ? portal.maxHealth : Config.PORTAL_INITIAL_HEALTH
            );

            // Update wave timer and info based on the latest wave state
            // Only update the timer UI if we are in a state where it's relevant (RUNNING, PAUSED, GAME_OVER, VICTORY)
            // Or maybe just update it always? Let's update it always, the UI can decide whether to display it.
            // The WaveManager.getWaveInfo() already returns appropriate values for GAME_OVER/VICTORY.
            // It needs to be updated in PAUSED state to reflect timer *before* pause.
            // It should probably not update in MENU/CUTSCENE states.
             // UPDATED: Update timer UI in ALL states. The UI function itself can decide how to render state/time.
             UI.updateWaveTimer(WaveManager.getWaveInfo()); // Always update UI timer based on latest info


            // Settings button states are updated by their toggle functions or game start/reset
            // UI.updateSettingsButtonStates(...); // This call is handled by main.js
         } else {
            // console.error("UI not initialized, skipping UI updates."); // Keep console less noisy
         }


        // The recursive requestAnimationFrame call is at the very top of the function.
        // If we reach here, the next frame has already been requested.

    // ADDED: End of the try block
    } catch (error) { // <--- ADD THIS CATCH BLOCK
        console.error("Unhandled error in gameLoop:", error);
        // Stop the loop to prevent further errors
        if (gameLoopId) {
            cancelAnimationFrame(gameLoopId);
            gameLoopId = null; // Clear the ID reference
        }
        // Maybe transition to an error state or Game Over state?
        // handleGameOver(); // Could go to game over screen on error
    }
}

// Calculates and sets the initial camera position, centering it on the player.
// Called ONCE at the start of a new game (by initializeAndRunGame).
function calculateInitialCamera() {
     if (player && player.isActive) { // Only calculate if player object exists AND is active
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
        // Calculate the actual size of the world in pixels (grid dimensions * block height).
        const worldPixelWidth = getWorldPixelWidth();
        const worldPixelHeight = getWorldPixelHeight();

        // Determine the maximum scroll position for X and Y, ensuring the camera doesn't show outside the world on the right/bottom.
        // Use Math.max(0, ...) in case the world is smaller than the viewport (prevents negative max scroll).
        const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth);
        const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);

        // Clamp the target camera position to stay within the valid world bounds.
        cameraX = Math.max(0, Math.min(targetX, maxCameraX)); // Clamp targetX
        cameraY = Math.max(0, Math.min(targetY, maxCameraY)); // Clamp targetY

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
         // If no player exists or is not active (e.g., on initial load or after game over), set default camera state (top-left corner, scale 1).
         cameraX = 0;
         cameraY = 0;
         cameraScale = 1.0;
         // console.log("Initial Camera Set: Player not active or not found, defaulting camera to (0,0) @ scale 1.0");
     }
}

// Updates the camera position during gameplay, following the player and clamping to bounds.
// Called every frame DURING THE RUNNING STATE, AFTER entity updates.
function calculateCameraPosition() {
    // MODIFIED: Only calculate if player object exists AND is active AND game is RUNNING
    // The camera should follow during the dying animation (isActive is still true).
    // It should stop following once isActive is false (death animation finished).
    // Also, only update camera position while the game is actually RUNNING.
    if (!player || !player.isActive || currentGameState !== GameState.RUNNING) {
         // If player is not active, the camera should stop following.
         // Its position remains whatever it was in the last frame player was active.
         // console.log("calculateCameraPosition: Player not active or game not running, camera not following."); // Too noisy
         return; // Stop execution of the function
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
    console.log(">>> [main.js] Initializing Game Environment <<<");
    // Initial state is PRE_GAME (Title Screen)
    currentGameState = GameState.PRE_GAME;

    try {
        // --- Get Essential DOM References ---
        appContainer = document.getElementById('app-container');
        gameOverlay = document.getElementById('game-overlay');

        // Get Overlay Buttons & Stats Text (Updated)
        titleStartButton = document.getElementById('start-game-button'); // Original button now goes to Main Menu
        mainmenuStartGameButton = document.getElementById('mainmenu-start-game-button'); // New Main Menu Start
        mainmenuSettingsButton = document.getElementById('mainmenu-settings-button'); // New Main Menu Settings
        settingsBackButton = document.getElementById('settings-back-button'); // New Settings Back
        resumeButton = document.getElementById('resume-button');
        restartButtonGameOver = document.getElementById('restart-button-overlay');
        restartButtonVictory = document.getElementById('restart-button-overlay-victory');
        restartButtonPause = document.getElementById('restart-button-overlay-pause'); // Pause restart button
        gameOverStatsTextP = document.getElementById('gameover-stats-text');
        victoryStatsTextP = document.getElementById('victory-stats-text');
        // ADDED: Get Cutscene Skip Button Reference
        cutsceneSkipButton = document.getElementById('cutscene-skip-button');


        // Get Settings Button References (already here)
        btnToggleGrid = document.getElementById('btn-toggle-grid');
        muteMusicButtonEl = document.getElementById('btn-mute-music');
        muteSfxButtonEl = document.getElementById('btn-mute-sfx');

        // Find Epoch Overlay Element (already here)
        epochOverlayEl = document.getElementById('epoch-overlay');

        // Get Cutscene Image Elements (NEW)
        cutsceneImages = [];
        Config.CUTSCENE_IMAGE_PATHS.forEach((_, index) => {
            const img = document.getElementById(`cutscene-image-${index + 1}`);
            if (img) cutsceneImages.push(img);
        });
        if (cutsceneImages.length !== Config.CUTSCENE_IMAGE_PATHS.length) {
            console.warn(`UI Warning: Found ${cutsceneImages.length} cutscene image elements, expected ${Config.CUTSCENE_IMAGE_PATHS.length}. Check IDs in index.html.`);
        }


        // --- Verification - Check if all required DOM elements were found ---
        // Combine all required elements for a single check.
        const requiredElements = [
             appContainer, gameOverlay,
             titleStartButton, mainmenuStartGameButton, mainmenuSettingsButton, settingsBackButton, // Added new states
             resumeButton, restartButtonGameOver, restartButtonVictory,
             restartButtonPause,
             gameOverStatsTextP, victoryStatsTextP,
             btnToggleGrid, muteMusicButtonEl, muteSfxButtonEl,
             epochOverlayEl,
             // ADDED: Cutscene Skip Button
             cutsceneSkipButton
             // Note: Not strictly requiring cutscene images to allow fallback, but good to log if missing
        ];

        // Use `some()` to check if *any* element in the list is missing.
        if (requiredElements.some(el => !el)) {
             const elementNames = [
                 'appContainer (#app-container)', 'gameOverlay (#game-overlay)',
                 'titleStartButton (#start-game-button)', 'mainmenuStartGameButton (#mainmenu-start-game-button)', 'mainmenuSettingsButton (#mainmenu-settings-button)', 'settingsBackButton (#settings-back-button)', // Added names
                 'resumeButton (#resume-button)',
                 'restartButtonGameOver (#restart-button-overlay)', 'restartButtonVictory (#restart-button-overlay-victory)',
                 'restartButtonPause (#restart-button-overlay-pause)',
                 'gameOverStatsTextP (#gameover-stats-text)', 'victoryStatsTextP (#victory-stats-text)',
                 'btnToggleGrid (#btn-toggle-grid)', 'muteMusicButtonEl (#btn-mute-music)', 'muteSfxButtonEl (#btn-mute-sfx)',
                 'epochOverlayEl (#epoch-overlay)',
                 'cutsceneSkipButton (#cutscene-skip-button)' // Added skip button name
             ];
             const missing = requiredElements
                 .map((el, i) => el ? null : elementNames[i])
                 .filter(name => name !== null);

             throw new Error(`FATAL INIT ERROR: Essential DOM elements not found: ${missing.join(', ')}! Please check index.html.`);
        }


        // --- Setup Event Listeners for Overlay Buttons (Updated) ---
        titleStartButton.addEventListener('click', startGame); // Title screen button now goes to Main Menu
        mainmenuStartGameButton.addEventListener('click', startCutscene); // Main Menu button starts cutscene
        mainmenuSettingsButton.addEventListener('click', showSettingsMenu); // Main Menu button goes to Settings
        settingsBackButton.addEventListener('click', showMainMenu); // Settings button goes back to Main Menu

        // Existing listeners for game state transitions (now call restartGame which goes to Main Menu)
        resumeButton.addEventListener('click', resumeGame); // Resume still resumes from pause
        restartButtonGameOver.addEventListener('click', restartGame); // Game Over restart goes to Main Menu
        restartButtonVictory.addEventListener('click', restartGame); // Victory restart goes to Main Menu
        restartButtonPause.addEventListener('click', restartGame); // Pause restart goes to Main Menu

        // ADDED: Listener for Cutscene Skip Button
        cutsceneSkipButton.addEventListener('click', skipCutscene);


        // Setup Event Listeners for Settings Buttons (already here)
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
        lastTime = 0; // Critical for the first dt calculation in the game loop.
        currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // Manages the portal's dynamic safety radius.
        isAutoPaused = false; // Flag to track if the game was paused automatically due to visibility change.
        isGridVisible = false; // Initial state for the debug grid (hidden).

        // Reset cutscene variables (redundant after declaration, but good practice)
        currentCutsceneImageIndex = 0;
        cutsceneTimer = 0;


        // Update UI settings buttons immediately to reflect the default states after init.
        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());


        // --- Setup Visibility Change Listener for Auto-Pause ---
        // Listen for the browser tab/window visibility changing.
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // --- Show Initial Overlay ---
        // Start the game by displaying the title screen overlay.
        showOverlay(GameState.PRE_GAME);

        // Start the game loop immediately. It will run with dt=0 until the state is RUNNING or CUTSCENE.
         gameLoopId = requestAnimationFrame(gameLoop);

        console.log(">>> [main.js] Game Initialization Complete <<<");

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
    // Only auto-pause if currently RUNNING
    if (document.hidden && currentGameState === GameState.RUNNING) {
        console.log("[main.js] Document hidden, auto-pausing game.");
        isAutoPaused = true; // set auto-pause to true so we know it wasn't a user-initiated pause
        pauseGame(); // call pauseGame function to handle state transition and overlay
    } // if document becomes visible, we don't automatically resume - user must click button to trigger resumeGame()
}

// --- Listener to Run init Once DOM Loaded ---
window.addEventListener('DOMContentLoaded', init);