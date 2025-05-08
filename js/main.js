// =============================================================================
// root/js/main.js - Game Entry Point and Main Loop
// =============================================================================

import * as UI from './ui.js';
import * as Input from './input.js';
import * as Config from './config.js';
import * as Renderer from './renderer.js';
import * as WaveManager from './waveManager.js';
import * as GridRenderer from './utils/grid.js';
import * as ItemManager from './itemManager.js';
import * as WorldManager from './worldManager.js';
import * as EnemyManager from './enemyManager.js';
import * as AudioManager from './audioManager.js';
import * as AgingManager from './agingManager.js';
import * as GridCollision from './utils/gridCollision.js';
import * as CollisionManager from './collisionManager.js';
import { Player } from './player.js';
import { Portal } from './portal.js';

// =============================================================================
// --- Global Game Variables ---
// =============================================================================

let player = null;
let gameStartTime = 0; // track when the current game started for playtime/stats
let portal = null;
let gameLoopId = null; // requestAnimationFrame ID for pausing
let lastTime = 0; // time since last frame
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
let errorOverlayMessageP = null; // For the dynamic error message
let btnToggleGrid = null;
let muteMusicButtonEl = null;
let muteSfxButtonEl = null;
let cutsceneImages = []; // array of HTMLImageElements
let currentCutsceneImageIndex = 0;
let cutsceneTimer = 0;
let cutsceneDurationPerImage = Config.CUTSCENE_IMAGE_DURATION;
let cutsceneSkipButton = null;
const GameState = Object.freeze({ // Game State Enum
    PRE_GAME: 'PRE_GAME',                   // title screen
    MAIN_MENU: 'MAIN_MENU',                 // main menu screen
    SETTINGS_MENU: 'SETTINGS_MENU',         // settings menu screen
    CUTSCENE: 'CUTSCENE',                   // intro cutscene playing
    ERROR: 'ERROR',                         // NEW: error overlay
    RUNNING: 'RUNNING',                     // loop active, timers decrement, physics run, state transitions occur
    PAUSED: 'PAUSED',                       // loop paused, no updates (except cutscene timer if state was CUTSCENE when paused?) - Let's only pause RUNNING.
    GAME_OVER: 'GAME_OVER',                 // gameover screen
    VICTORY: 'VICTORY'                      // victory screen
});
let currentGameState = GameState.PRE_GAME;  // initial state
let isAutoPaused = false;                   // boolean if paused due to losing tab visibility
let isGridVisible = false;

// =============================================================================
// --- Helper Functions ---
// =============================================================================

function getWorldPixelWidth() { return Config.CANVAS_WIDTH; } // Returns the world width in pixels (matches internal canvas width)
function getWorldPixelHeight() { return Config.GRID_ROWS * Config.BLOCK_HEIGHT; } // Returns the world height in pixels (grid rows * block height)
window.pauseGameCallback = pauseGame; // Expose pauseGame globally for the UI pause button.
window.updateCameraScale = function(deltaScale) { // Expose updateCameraScale globally for the Input module (mouse wheel).
    if (currentGameState !== GameState.RUNNING && currentGameState !== GameState.PAUSED) { // Ensure camera can only be updated if game is running or paused (not during overlays or menu states)
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
    const effectiveMinScale = Math.max(Config.MIN_CAMERA_SCALE, minScaleRequired); // effective minimum scale is LARGER of configured minimum and required scale to fill view
    newScale = Math.max(effectiveMinScale, Math.min(newScale, Config.MAX_CAMERA_SCALE)); // clamp new scale between effective minimum and configured maximum
    cameraScale = newScale; // apply final clamped scale - camera position re-clamped in game loop
}
function getMouseWorldCoords(inputMousePos) { // Convert canvas pixel coordinates to world coordinates
    if (!inputMousePos || typeof inputMousePos.x !== 'number' || typeof inputMousePos.y !== 'number' || isNaN(inputMousePos.x) || isNaN(inputMousePos.y)) {
        console.warn("getMouseWorldCoords: Invalid input mouse position.", inputMousePos);
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
function handleWaveStart(waveNumber) { // Callback function to handle the start of a new wave - Used to display the epoch text overlay.
    console.log(`Triggered by WaveManager - Starting Wave ${waveNumber}`);
}
// --- Toggle grid visibility ---
// Exposed globally for UI/Input buttons
window.toggleGridDisplay = toggleGridDisplay;
function toggleGridDisplay() {
    isGridVisible = !isGridVisible;
    console.log(`Main: Grid display is now ${isGridVisible ? 'ON' : 'OFF'}.`);
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState()); // update UI button appearance immediately
    // Note: Drawing the grid is handled in the gameLoop based on the `isGridVisible` flag.
}

window.toggleMusicMute = toggleMusicMute; // Toggle music mute - Exposed globally for UI/Input buttons

function toggleMusicMute() {
    const newState = AudioManager.toggleMusicMute(); // Toggle mute state in AudioManager
    console.log(`Main: Music is now ${newState ? 'muted' : 'unmuted'}.`);
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), newState); // Update UI button appearance immediately
}
// --- Toggle SFX mute ---
// Exposed globally for UI/Input buttons
window.toggleSfxMute = toggleSfxMute;
function toggleSfxMute() {
    const newState = AudioManager.toggleSfxMute(); // Toggle mute state in AudioManager
    console.log(`Main: SFX is now ${AudioManager.getSfxMutedState() ? 'muted' : 'unmuted'}.`);
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), newState); // Update UI button appearance immediately
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
    // Remove all previous state-specific classes and the 'active' class from the overlay
    // Also remove 'overlay-active' from the app container to reset blur/dim
    gameOverlay.classList.remove(
        'active', // Crucially remove 'active' to reset transitions
        'show-title', 'show-mainmenu', 'show-settings', 'show-cutscene',
        'show-pause', 'show-gameover', 'show-victory', 'show-error' // Added show-error
    );
    appContainer.classList.remove('overlay-active');
    // Stop any UI music that might be playing before starting the new one for the new overlay state
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
        case GameState.MAIN_MENU:
            gameOverlay.classList.add('show-mainmenu');
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            // Play Main Menu music (reuse pause music for now)
            if (Config.AUDIO_TRACKS.pause) { // Using pause music as menu music for now
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            } else {
                console.warn("Pause music track not defined for main menu.");
            }
            break;
        case GameState.SETTINGS_MENU:
            gameOverlay.classList.add('show-settings');
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            // Play Settings Menu music (reuse pause music for now)
            if (Config.AUDIO_TRACKS.pause) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            } else {
                console.warn("Pause music track not defined for settings menu.");
            }
            break;
        case GameState.CUTSCENE:
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
        case GameState.ERROR: // New case for error state
            gameOverlay.classList.add('show-error');
            // Error text content is set in the init() catch block
            // No specific audio for error state, music should have been stopped
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
}

// Shows the Settings Menu
function showSettingsMenu() {
    currentGameState = GameState.SETTINGS_MENU;
    showOverlay(GameState.SETTINGS_MENU);
}

// Starts the Intro Cutscene (triggered by Main Menu START GAME button)
function startCutscene() {
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
        } else { // All images have been shown, end the cutscene and start the game
            AudioManager.stopUIMusic(); // Stop cutscene/UI music
            initializeAndRunGame(); // Call the function that actually starts the game
        }
    }
}

// Skips the cutscene and immediately starts the game.
function skipCutscene() {
    // Only skip if currently in the cutscene state
    if (currentGameState !== GameState.CUTSCENE) {
        console.warn("skipCutscene called but game is not in CUTSCENE state.");
        return;
    }
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

    try {
    // --- Reset/Initialize Core Systems ---
    // Reset UI references first, as new player/portal objects will be created.
    UI.setPlayerReference(null); // Clear old reference, will be set after new player is created
    UI.setPortalReference(null); // Clear old reference, will be set after new portal is created

    // Create Portal instance AFTER world, as position depends on world generation results
    const portalSpawnX = Config.CANVAS_WIDTH / 2 - Config.PORTAL_WIDTH / 2;
    // Position portal centered horizontally, slightly above mean ground level
    const portalSpawnY = (Config.WORLD_GROUND_LEVEL_MEAN_ROW * Config.BLOCK_HEIGHT) - Config.PORTAL_HEIGHT - (Config.PORTAL_SPAWN_Y_OFFSET_BLOCKS * Config.BLOCK_HEIGHT);
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
    // The `changedCellsInitialAging` map is no longer strictly needed here because AgingManager
    // now updates the static world canvas immediately for each change *within* the aging pass.
    // However, collecting them might still be useful for debugging or future optimizations.
    // Let's keep the logic to collect them, but the visual update happens inside AgingManager.
    const changedCellsInitialAging = new Map();

    for (let i = 0; i < initialAgingPasses; i++) {
        // Use the base aging intensity for initial passes
        // AgingManager.applyAging returns a list of {c,r} changed cells.
        // It now also calls updateStaticWorldAt and queues water candidates internally.
        // MODIFIED: Pass null for the portal reference during the initial aging pass
        const changedCellsInPass = AgingManager.applyAging(null, Config.AGING_BASE_INTENSITY);

        // Add the changed cells from this pass to the overall list for initial aging
        changedCellsInPass.forEach(({ c, r }) => {
            const key = `${c},${r}`;
            if (!changedCellsInitialAging.has(key)) {
                changedCellsInitialAging.set(key, { c, r });
                // The visual update is already done by AgingManager.updateStaticWorldAt(c, r)
                // No, AgingManager does NOT call WorldManager.updateStaticWorldAt.
                // WorldManager.updateStaticWorldAt should be called here if animations are OFF,
                // or after animations if ON.
                // FOR INITIAL AGING: Let's apply directly since animations are for WARPPHASE.
                WorldManager.updateStaticWorldAt(c, r);
            }
        });
    }
    console.log(`[main.js] Initial world aging complete. Total unique blocks changed: ${changedCellsInitialAging.size}`);

    WorldManager.renderStaticWorldToGridCanvas(); // Update final state of the static canvas for Visuals and Water Simulation after Initial Aging
    WorldManager.seedWaterUpdateQueue(); // Seed the water simulation queue based on the final world state after initial aging and rendering
    ItemManager.init(); // ItemManager Init (handles initial shovel spawn now)
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
        // currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // Removed global
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
    // WaveManager's handleWaveStart callback is no longer used for epoch text display.
    WaveManager.reset(handleWaveStart, portal); // Keeping the callback parameter for potential future use
    console.log("[main.js] WaveManager reset for new game.");


    // Calculate initial camera position centered on the player
    calculateInitialCamera();
    // Reset other game state variables managed by main.js
    // currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // Removed - portal instance handles its own
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
    // Cancel any previous animation frame loop just in case (e.g. from a prior game instance)
    // The requestAnimationFrame call is now at the top of gameLoop, so it will be called regardless of state.
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
}
// Pauses the currently running game. Exposed via window.pauseGameCallback.

function pauseGame() {
    // Only pause if currently RUNNING
    if (currentGameState !== GameState.RUNNING) {
        console.warn("pauseGame called but game is not RUNNING.");
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
        console.warn("resumeGame called but game is not PAUSED.");
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
    AudioManager.unpauseGameMusic(); // Explicitly unpause after overlay is hidden
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
    showOverlay(GameState.GAME_OVER); // Show the game over overlay and handle audio transitions
    isAutoPaused = false; // Reset auto-pause flag on game over
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
    // currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // Removed global
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
    gameLoopId = requestAnimationFrame(gameLoop);
    try {
        let rawDt = (lastTime === 0) ? 0 : (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        rawDt = Math.min(rawDt, Config.MAX_DELTA_TIME);
        let dt = 0;

        // MODIFIED: Pass dt if RUNNING, CUTSCENE, or in WARPPHASE
        if (currentGameState === GameState.RUNNING ||
            currentGameState === GameState.CUTSCENE ||
            (WaveManager.getWaveInfo().state === 'WARPPHASE' && currentGameState !== GameState.PAUSED) // Ensure game isn't paused during warp for dt
        ) {
            dt = rawDt;
        }


        if (currentGameState === GameState.RUNNING) {
            // --- All your core game update logic is here ---
            // This block will now execute when the state is RUNNING
            // and will use the non-zero dt calculated above.

            WaveManager.update(dt, currentGameState); // Pass real dt and current state
            const updatedWaveInfo = WaveManager.getWaveInfo(); // Get updated info after WaveManager.update()
            // const currentWaveManagerState = updatedWaveInfo.state; // No longer needed here


            // --- Update Entities ---
            if (player) {
                const inputState = Input.getState();
                const internalMousePos = Input.getMousePosition();
                const targetWorldPos = getMouseWorldCoords(internalMousePos);
                const targetGridCell = getMouseGridCoords(internalMousePos);
                player.update(dt, inputState, targetWorldPos, targetGridCell);
            }

            calculateCameraPosition();

            const playerPosForEnemies = (player && player.isActive && !player.isDying) ? player.getPosition() : null;
            EnemyManager.update(dt, playerPosForEnemies);

            const playerRefForItems = (player && player.isActive && !player.isDying) ? player : null;
            ItemManager.update(dt, playerRefForItems);

            // WorldManager.update for water is now called below, based on dt > 0

            // --- Collision Detection (Only happens if RUNNING) ---
            if (player) {
                CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
                CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
                CollisionManager.checkPlayerAttackBlockCollisions(player);
                CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies());
            }
            if (portal && portal.isAlive()) {
                CollisionManager.checkEnemyPortalCollisions(EnemyManager.getEnemies(), portal);
            }

            // --- Check for Game Over/Victory Conditions (After all updates and collisions) ---
            if ((player && !player.isActive) || (portal && !portal.isAlive())) {
                console.log("Main: Player inactive or Portal destroyed. Triggering Game Over.");
                handleGameOver();
            }
            else if (updatedWaveInfo.allWavesCleared) {
                console.log("Main: WaveManager signals all waves cleared. Triggering Victory.");
                handleVictory();
            }

        } else if (currentGameState === GameState.CUTSCENE) {
            updateCutscene(dt);
        }

        // ALWAYS call WorldManager.update if dt > 0, as it handles aging animations during WARPPHASE
        // The WaveManager.update call above will have set its internal state correctly.
        if (dt > 0) {
            WorldManager.update(dt); // This will process water and aging animations
        }

        // --- Rendering ---
        Renderer.clear();
        const mainCtx = Renderer.getContext();
        // Show world if RUNNING, PAUSED, or if WaveManager is in WARPPHASE (even if main game is PAUSED during warp)
        const isGameWorldVisible = currentGameState === GameState.RUNNING || 
                                currentGameState === GameState.PAUSED || 
                                currentGameState === GameState.GAME_OVER || 
                                currentGameState === GameState.VICTORY ||
                                (WaveManager.getWaveInfo().state === 'WARPPHASE');
        if (isGameWorldVisible) {
            mainCtx.save();
            mainCtx.scale(cameraScale, cameraScale);
            mainCtx.translate(-cameraX, -cameraY);
            WorldManager.draw(mainCtx);
            GridRenderer.drawStaticGrid(mainCtx, isGridVisible);
            ItemManager.draw(mainCtx);
            if (portal) portal.draw(mainCtx);
            EnemyManager.draw(mainCtx);
            if (player && currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY) {
                player.draw(mainCtx);
                const waveInfoAtDraw = WaveManager.getWaveInfo();
                const currentWaveManagerStateAtDraw = waveInfoAtDraw.state;
                // Allow ghost block during WARPPHASE or BUILDPHASE
                const isGameplayActiveAtDraw = currentWaveManagerStateAtDraw === 'PRE_WAVE' || 
                                                currentWaveManagerStateAtDraw === 'WAVE_COUNTDOWN' || 
                                                currentWaveManagerStateAtDraw === 'BUILDPHASE' || 
                                                currentWaveManagerStateAtDraw === 'WARPPHASE'; // Added WARPPHASE TODO: check this logic it may need to change
                const playerIsInteractableAtDraw = player && player.isActive && !player.isDying;
                if (playerIsInteractableAtDraw && isGameplayActiveAtDraw && player.isMaterialSelected()) {
                    player.drawGhostBlock(mainCtx);
                }
            }
            mainCtx.restore();
        }

        if (UI.isInitialized()) { // UI Updates
            const playerExists = !!player;
            UI.updatePlayerInfo(
                playerExists ? player.getCurrentHealth() : 0,
                playerExists ? player.getMaxHealth() : Config.PLAYER_MAX_HEALTH_DISPLAY,
                playerExists ? player.getInventory() : {},
                playerExists ? player.hasWeapon(Config.WEAPON_TYPE_SWORD) : false,
                playerExists ? player.hasWeapon(Config.WEAPON_TYPE_SPEAR) : false,
                playerExists ? player.hasWeapon(Config.WEAPON_TYPE_SHOVEL) : false
            );
            const portalExists = !!portal;
            UI.updatePortalInfo(
                portalExists ? portal.currentHealth : 0,
                portalExists ? portal.maxHealth : Config.PORTAL_INITIAL_HEALTH
            );
            UI.updateWaveTimer(WaveManager.getWaveInfo());
        }
    } catch (error) {
        console.error("Unhandled error in gameLoop:", error);
        if (gameLoopId) {
            cancelAnimationFrame(gameLoopId);
            gameLoopId = null;
        }
    }
}

// Calculates and sets the initial camera position, centering it on the player.
// Called ONCE at the start of a new game (by initializeAndRunGame).
function calculateInitialCamera() {
    if (player && player.isActive) { // Only calculate if player object exists AND is active
        const viewWidth = Config.CANVAS_WIDTH; // Internal rendering width (matches canvas.width)
        const viewHeight = Config.CANVAS_HEIGHT; // Internal rendering height (matches canvas.height)
        cameraScale = 1.0; // Reset zoom to default on game start
        const visibleWorldWidth = viewWidth / cameraScale; // Calculate the visible area of the world at the current scale.
        const visibleWorldHeight = viewHeight / cameraScale;
        const playerCenterX = player.x + player.width / 2; // Calculate the target camera position to center the view on the player's center.
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
    }
    else { // If no player exists or is not active (e.g., on initial load or after game over), set default camera state (top-left corner, scale 1).
        cameraX = 0;
        cameraY = 0;
        cameraScale = 1.0;
        console.log("Initial Camera Set: Player not active or not found, defaulting camera to (0,0) @ scale 1.0");
    }
}

// Updates the camera position during gameplay, following the player and clamping to bounds.
// Called every frame DURING THE RUNNING STATE, AFTER entity updates.
function calculateCameraPosition() {
    if (!player || !player.isActive || currentGameState !== GameState.RUNNING) {
        return;
    }
    const viewWidth = Config.CANVAS_WIDTH;
    const viewHeight = Config.CANVAS_HEIGHT;
    const visibleWorldWidth = viewWidth / cameraScale;
    const visibleWorldHeight = viewHeight / cameraScale;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    let targetX = playerCenterX - (visibleWorldWidth / 2);
    let targetY = playerCenterY - (visibleWorldHeight / 2);
    cameraX = targetX;
    cameraY = targetY;
    const worldPixelWidth = getWorldPixelWidth();
    const worldPixelHeight = getWorldPixelHeight();
    const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth);
    const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);
    cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
    cameraY = Math.max(0, Math.min(targetY, maxCameraY));
    if (worldPixelWidth <= visibleWorldWidth) {
        cameraX = (worldPixelWidth - visibleWorldWidth) / 2;
    }
    if (worldPixelHeight <= visibleWorldHeight) {
        cameraY = (worldPixelHeight - visibleWorldHeight) / 2;
    }
}

function init() { // Initializes the game environment, DOM references, event listeners, and core systems. Called once when the DOM is fully loaded.
    currentGameState = GameState.PRE_GAME; // Initial state is PRE_GAME (Title Screen)
    try { // Get Essential DOM References
        appContainer = document.getElementById('app-container');
        gameOverlay = document.getElementById('game-overlay');
        titleStartButton = document.getElementById('start-game-button');
        mainmenuStartGameButton = document.getElementById('mainmenu-start-game-button');
        mainmenuSettingsButton = document.getElementById('mainmenu-settings-button');
        settingsBackButton = document.getElementById('settings-back-button');
        resumeButton = document.getElementById('resume-button');
        restartButtonGameOver = document.getElementById('restart-button-overlay');
        restartButtonVictory = document.getElementById('restart-button-overlay-victory');
        restartButtonPause = document.getElementById('restart-button-overlay-pause');
        gameOverStatsTextP = document.getElementById('gameover-stats-text');
        victoryStatsTextP = document.getElementById('victory-stats-text');
        errorOverlayMessageP = document.getElementById('error-message-text'); // Get ref for error message P tag
        cutsceneSkipButton = document.getElementById('cutscene-skip-button');
        btnToggleGrid = document.getElementById('btn-toggle-grid');
        muteMusicButtonEl = document.getElementById('btn-mute-music');
        muteSfxButtonEl = document.getElementById('btn-mute-sfx');
        epochOverlayEl = document.getElementById('epoch-overlay');
        cutsceneImages = [];
        Config.CUTSCENE_IMAGE_PATHS.forEach((_, index) => {
            const img = document.getElementById(`cutscene-image-${index + 1}`);
            if (img) cutsceneImages.push(img);
        });
        if (cutsceneImages.length !== Config.CUTSCENE_IMAGE_PATHS.length) {
            console.warn(`UI Warning: Found ${cutsceneImages.length} cutscene image elements, expected ${Config.CUTSCENE_IMAGE_PATHS.length}. Check IDs in index.html.`);
        }

        const requiredElements = [ // --- Verification - Check if all required DOM elements were found ---
            appContainer, gameOverlay, titleStartButton, mainmenuStartGameButton, mainmenuSettingsButton, settingsBackButton,
            resumeButton, restartButtonGameOver, restartButtonVictory, restartButtonPause, gameOverStatsTextP, victoryStatsTextP,
            errorOverlayMessageP, // Added error message P to check
            btnToggleGrid, muteMusicButtonEl, muteSfxButtonEl, epochOverlayEl, cutsceneSkipButton
        ];
        if (requiredElements.some(el => !el)) {
            const elementNames = [ // Map indices to names for logging
                'appContainer (#app-container)', 'gameOverlay (#game-overlay)',
                'titleStartButton (#start-game-button)', 'mainmenuStartGameButton (#mainmenu-start-game-button)', 'mainmenuSettingsButton (#mainmenu-settings-button)', 'settingsBackButton (#settings-back-button)',
                'resumeButton (#resume-button)',
                'restartButtonGameOver (#restart-button-overlay)', 'restartButtonVictory (#restart-button-overlay-victory)',
                'restartButtonPause (#restart-button-overlay-pause)',
                'gameOverStatsTextP (#gameover-stats-text)', 'victoryStatsTextP (#victory-stats-text)',
                'errorOverlayMessageP (#error-message-text)', // Added name for logging
                'btnToggleGrid (#btn-toggle-grid)', 'muteMusicButtonEl (#btn-mute-music)', 'muteSfxButtonEl (#btn-mute-sfx)',
                'epochOverlayEl (#epoch-overlay)',
                'cutsceneSkipButton (#cutscene-skip-button)',
            ];
            const missing = requiredElements
                .map((el, i) => el ? null : elementNames[i])
                .filter(name => name !== null);
            throw new Error(`FATAL INIT ERROR: Essential DOM elements not found: ${missing.join(', ')}! Please check index.html.`);
        }

        // --- Setup Event Listeners for Overlay Buttons (Updated) ---
        titleStartButton.addEventListener('click', startGame);
        mainmenuStartGameButton.addEventListener('click', startCutscene);
        mainmenuSettingsButton.addEventListener('click', showSettingsMenu);
        settingsBackButton.addEventListener('click', showMainMenu);
        resumeButton.addEventListener('click', resumeGame);
        restartButtonGameOver.addEventListener('click', restartGame);
        restartButtonVictory.addEventListener('click', restartGame);
        restartButtonPause.addEventListener('click', restartGame);
        cutsceneSkipButton.addEventListener('click', skipCutscene);
        btnToggleGrid.addEventListener('click', toggleGridDisplay);
        muteMusicButtonEl.addEventListener('click', toggleMusicMute);
        muteSfxButtonEl.addEventListener('click', toggleSfxMute);

        // --- Initialize Core Systems that DON'T Depend on Game Objects (Player, Portal) ---
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            throw new Error("FATAL INIT ERROR: Canvas element 'game-canvas' not found!");
        }
        Renderer.init();
        Renderer.createGridCanvas();
        AudioManager.init();
        AgingManager.init();
        if (!UI.initGameUI()) {
            throw new Error("FATAL INIT ERROR: UI initialization failed. Check console for missing sidebar elements or item slot issues.");
        }
        Input.init();
        // --- Initialize Module-Level State Variables ---
        lastTime = 0;
        isAutoPaused = false;
        isGridVisible = false;
        currentCutsceneImageIndex = 0;
        cutsceneTimer = 0;
        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
        document.addEventListener('visibilitychange', handleVisibilityChange);
        showOverlay(GameState.PRE_GAME);
        gameLoopId = requestAnimationFrame(gameLoop);
    } catch (error) {
        console.error("FATAL: Initialization Error:", error);
        // If gameOverlay and errorOverlayMessageP exist, use the new overlay system
        if (gameOverlay && errorOverlayMessageP) {
            errorOverlayMessageP.textContent = `Error: ${error.message}`; // Set the dynamic error message
            currentGameState = GameState.ERROR; // Set state before showing overlay
            showOverlay(GameState.ERROR); // Show the styled error overlay
            // appContainer.classList.add('overlay-active'); // showOverlay handles this now
            AudioManager.stopAllMusic();
        } else {
            // Fallback to alert if the new overlay system isn't available (e.g., error happened before DOM refs were obtained)
            alert(`FATAL Initialization Error:\n${error.message}\nCheck console for details.`);
        }
    }
}
function handleVisibilityChange() { // Auto-Pause When Hidden
    if (document.hidden && currentGameState === GameState.RUNNING) {
        console.log("[main.js] Document hidden, auto-pausing game.");
        isAutoPaused = true;
        pauseGame();
    }
}
// --- Listener to Run init Once DOM Loaded ---
window.addEventListener('DOMContentLoaded', init);