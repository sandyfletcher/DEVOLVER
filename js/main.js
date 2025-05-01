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
let btnMuteMusic = null;
let btnMuteSfx = null;
// --- Game State Enum ---
const GameState = Object.freeze({
    PRE_GAME: 'PRE_GAME', // title screen
    RUNNING: 'RUNNING', // loop active, timers decrement, physics run, state transitions occur
    PAUSED: 'PAUSED',   // loop paused, no updates
    GAME_OVER: 'GAME_OVER', // gameover screen
    VICTORY: 'VICTORY' // victory screen
});
let previousWaveManagerState = null;
let currentGameState = GameState.PRE_GAME;
let isAutoPaused = false; //  boolean if paused due to losing tab visibility
let isGridVisible = false;

// =============================================================================
// --- Helper Functions ---
// =============================================================================

function getWorldPixelWidth() { return Config.CANVAS_WIDTH; } // internal canvas size in pixels to match world dimensions
function getWorldPixelHeight() { return Config.GRID_ROWS * Config.BLOCK_HEIGHT; }
window.pauseGameCallback = pauseGame; // expose pauseGame globally for the UI pause button.
window.updateCameraScale = function(deltaScale) { // expose updateCameraScale globally for the Input module (mouse wheel).
    const oldScale = cameraScale;
    let newScale = cameraScale + deltaScale;
    const internalCanvasWidth = Config.CANVAS_WIDTH; // internal canvas dimensions
    const internalCanvasHeight = Config.CANVAS_HEIGHT;
    const worldPixelWidth = getWorldPixelWidth(); // world dimensions
    const worldPixelHeight = getWorldPixelHeight();
    const scaleToFitWidth = (worldPixelWidth > 0) ? internalCanvasWidth / worldPixelWidth : 1; // calculate minimum scale required to make world fill viewport (no black bars if world is large enough)
    const scaleToFitHeight = (worldPixelHeight > 0) ? internalCanvasHeight / worldPixelHeight : 1;
    const minScaleRequired = Math.max(scaleToFitWidth, scaleToFitHeight);
    const effectiveMinScale = Math.max(Config.MIN_CAMERA_SCALE, minScaleRequired); // effective minimum scale is the LARGER of configured minimum and required scale to fill view
    newScale = Math.max(effectiveMinScale, Math.min(newScale, Config.MAX_CAMERA_SCALE)); // clamp new scale between effective minimum and configured maximum
    cameraScale = newScale; // apply final clamped scale - camera position will be re-clamped in game loop by calculateCameraPosition
}
// --- Convert canvas pixel coordinates to world coordinates ---
function getMouseWorldCoords(inputMousePos) {
    const worldX = cameraX + (inputMousePos.x / cameraScale); // calculate coordinates based on camera position and scale
    const worldY = cameraY + (inputMousePos.y / cameraScale);
    return { x: worldX, y: worldY };
}
// --- Convert canvas pixel coordinates directly to grid coordinates ---
function getMouseGridCoords(inputMousePos) {
    const { x: worldX, y: worldY } = getMouseWorldCoords(inputMousePos);
    return GridCollision.worldToGridCoords(worldX, worldY); // use utility function to convert world pixels to grid indices
}
// --- Callback function to handle the start of a new wave, triggered by WaveManager, used to display the epoch text overlay ---
function handleWaveStart(waveNumber) {
    console.log(`Main: Starting Wave ${waveNumber}`);
    const epochYear = Config.EPOCH_MAP[waveNumber];
    if (epochYear !== undefined) {
        UI.showEpochText(epochYear);
    } else {
        console.warn(`Main: No epoch defined in Config.EPOCH_MAP for wave ${waveNumber}.`);
        UI.showEpochText(`Wave ${waveNumber} Starting`); // fallback naming by wave number
    }
}
// --- Toggle grid visibility ---
function toggleGridDisplay() {
    isGridVisible = !isGridVisible;
    console.log(`Main: Grid display is now ${isGridVisible ? 'ON' : 'OFF'}.`);
    UI.illuminateButton('toggleGrid');
}
//  --- Toggle music mute ---
function toggleMusicMute() {
    const newState = AudioManager.toggleMusicMute();
    console.log(`Main: Music is now ${newState ? 'muted' : 'unmuted'}.`);
    UI.illuminateButton('muteMusic');
}
// --- Toggle SFX mute ---
function toggleSfxMute() {
    const newState = AudioManager.toggleSfxMute();
    console.log(`Main: SFX is now ${newState ? 'muted' : 'unmuted'}.`);
    UI.illuminateButton('muteSfx');
}

// =============================================================================
// --- Overlay Management ---
// =============================================================================

// --- Show specific game overlay state (title, pause, game over, victory) and handle music transitions ---
function showOverlay(stateToShow) {
    if (!gameOverlay || !appContainer) {
         console.error("ShowOverlay: Core overlay/app container not found!");
         return; // cannot show overlay if elements are missing
    }
    gameOverlay.classList.remove('show-title', 'show-pause', 'show-gameover', 'show-victory'); // remove previous state-specific classes
    switch (stateToShow) { // add class corresponding to desired state and handle audio transitions
        case GameState.PRE_GAME:
            gameOverlay.classList.add('show-title');
            AudioManager.stopAllMusic();
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME); // reset UI volume setting
            if (Config.AUDIO_TRACKS.title) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.title); // play title music
            } else {
                AudioManager.stopUIMusic(); // UI music is stopped if no track found
                console.error("Title music not found!");
            }
            break;
        case GameState.PAUSED:
            gameOverlay.classList.add('show-pause');
            AudioManager.pauseGameMusic(); // pause game music and retain position 
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME); // reset UI volume setting?
            if (Config.AUDIO_TRACKS.pause) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            } else {
                AudioManager.stopUIMusic();
                console.error("Pause music not found!");
            }
            break;
        case GameState.GAME_OVER:
            gameOverlay.classList.add('show-gameover');
            if (gameOverStatsTextP) { // update stats element
                 const finalWave = WaveManager.getWaveInfo().mainWaveNumber; // get wave reached
                 gameOverStatsTextP.textContent = `You reached Wave ${finalWave}!`; // display wave reached
            } else {
                console.warn("ShowOverlay: gameover-stats-text element not found for GAME_OVER state.");
            }
            AudioManager.stopGameMusic();
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME); // reset UI volume setting?
            if (Config.AUDIO_TRACKS.gameOver) {
                 AudioManager.playUIMusic(Config.AUDIO_TRACKS.gameOver);
            } else {
                 AudioManager.stopUIMusic();
                 console.error("Game Over music not found!");
            }
            break;
        case GameState.VICTORY:
            gameOverlay.classList.add('show-victory');
            if (victoryStatsTextP) { // update victory stats text element if it exists
                 const totalWaves = Config.WAVES.length; // get total number of waves
                 victoryStatsTextP.textContent = `You cleared all ${totalWaves} waves!`; // display waves cleared - TODO: improve this and display better stats
            } else {
                console.warn("ShowOverlay: victory-stats-text element not found for VICTORY state.");
            }
             AudioManager.stopGameMusic();
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME); 
            if (Config.AUDIO_TRACKS.victory) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.victory);
            } else {
                 AudioManager.stopUIMusic();
                 console.error("Victory music not found!");
            }
            break;
    }
    gameOverlay.classList.add('active'); // make overlay visible
    appContainer.classList.add('overlay-active'); // apply the blur/dim effect to background container
}
// --- Hide overlay, restore background , stop UImusic ---
function hideOverlay() {
    if (!gameOverlay || !appContainer) return; // cannot hide overlay if elements missing
    gameOverlay.classList.remove('active'); // hide overlay
    AudioManager.stopUIMusic();
    setTimeout(() => { // match CSS transition then re-enable pointer events
         appContainer.classList.remove('overlay-active');
    }, 300);
}

// =============================================================================
// --- Game State Control ---
// =============================================================================

// Start new game, initialize all systems and transition to RUNNING state
function startGame() {
    if (currentGameState === GameState.RUNNING) { // prevent starting if already in RUNNING state
        console.warn("startGame called but game already RUNNING.");
        return;
    }
    if (!UI.isInitialized()) {
         console.error("FATAL: UI was not initialized correctly. Aborting game start.");
         showOverlay(GameState.PRE_GAME); // revert to title
         return; // abandon start sequence
    }
    UI.setPlayerReference(null); // reset UI references before creating new game objects
    UI.setPortalReference(null);
    World.init();
    ItemManager.init();
    EnemyManager.init();
    const portalSpawnX = Config.CANVAS_WIDTH / 2 - Config.PORTAL_WIDTH / 2; // create portal instance AFTER world, as position depends on world generation results
    const portalSpawnY = (Config.WORLD_GROUND_LEVEL_MEAN * Config.BLOCK_HEIGHT) - Config.PORTAL_HEIGHT - (Config.PORTAL_SPAWN_Y_OFFSET_BLOCKS * Config.BLOCK_HEIGHT); // position portal centered horizontally, slightly above mean ground level
    portal = new Portal(portalSpawnX, portalSpawnY); // create portal
    try { // create player
        player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
        UI.setPlayerReference(player); // set references in UI manager
        UI.setPortalReference(portal);
    } catch (error) { // handle fatal errors during player/portal setup
        player = null;
        portal = null;
        currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS;
        console.error("FATAL: Game Object Creation/Init Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        currentGameState = GameState.PRE_GAME;
        showOverlay(GameState.PRE_GAME);
        alert("Error creating game objects. Please check console and refresh.");
        return; // abandon start sequence
    }
    WaveManager.reset(handleWaveStart, portal);
    calculateInitialCamera();
    currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // initialize portal safety radius
    previousWaveManagerState = null; // initialize state tracker for state transitions
    isAutoPaused = false;
    isGridVisible = false;
    AudioManager.setVolume('game', Config.AUDIO_DEFAULT_GAME_VOLUME);
    AudioManager.setVolume('sfx', Config.AUDIO_DEFAULT_SFX_VOLUME);
    AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
    currentGameState = GameState.RUNNING;
    hideOverlay();
    Input.consumeClick();
    gameStartTime = performance.now(); // record the game start time for potential future stats.
    lastTime = 0; // reset to ensure correct calculation on first frame of new game
    if (gameLoopId) { // cancel any previous animation frame loop just in case.
        cancelAnimationFrame(gameLoopId);
    }
    gameLoopId = requestAnimationFrame(gameLoop); // start main game loop
    console.log(">>> Game Started <<<");
}
function pauseGame() { // pause currently running game, exposed via window.pauseGameCallback
    if (currentGameState !== GameState.RUNNING) return; // only pause if currently RUNNING
    console.log(">>> Pausing Game <<<");
    currentGameState = GameState.PAUSED;
    showOverlay(GameState.PAUSED);
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }
}
// Resumes game from paused state, called when user clicks "Resume" on pause overlay
function resumeGame() {
    if (currentGameState !== GameState.PAUSED) return; // only resume if PAUSED
    console.log(">>> Resuming Game <<<");
    currentGameState = GameState.RUNNING; // transition back to RUNNING
    hideOverlay();
    isAutoPaused = false;
    AudioManager.unpauseGameMusic();
    if (!gameLoopId) {
        gameLoopId = requestAnimationFrame(gameLoop);
    }
}
// Handles the transition to the game over state.
function handleGameOver() {
    if (currentGameState === GameState.GAME_OVER) return; // prevent multiple calls
    console.log(">>> Handling Game Over <<<");
    currentGameState = GameState.GAME_OVER; // change main game state
    WaveManager.setGameOver(); // notify WaveManager of game over
    EnemyManager.clearAllEnemies(); // clear enemies on game over
    ItemManager.clearItemsOutsideRadius(0, 0, Infinity); // clear all items on game over
    showOverlay(GameState.GAME_OVER); // show overlay and handle audio
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId); // stop game loop
        gameLoopId = null;
    }
    isAutoPaused = false; // reset auto-pause flag on game over.
}
// Handles transition to victory state when all waves cleared
function handleVictory() {
     if (currentGameState === GameState.VICTORY) return; // prevent multiple calls
     console.log(">>> Handling Victory <<<");
     currentGameState = GameState.VICTORY;
     WaveManager.setVictory(); // notify WaveManager of victory
     EnemyManager.clearAllEnemies();
     ItemManager.clearItemsOutsideRadius(0, 0, Infinity); // clear all items on victory
     showOverlay(GameState.VICTORY); // show victory overlay and handle audio
     if (gameLoopId) {
         cancelAnimationFrame(gameLoopId); // stop game loop
         gameLoopId = null;
     }
     isAutoPaused = false;
}
// Only allow restart from GAME_OVER, VICTORY, or PAUSED state
function restartGame() {
    if (currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY && currentGameState !== GameState.PAUSED) {
        console.warn("Restart called but game not in a restartable state.");
        return;
    }
    console.log(">>> Restarting Game <<<");
    startGame(); // perform full reset of systems and state
}
// --- Main game loop function, called by requestAnimationFrame ---
function gameLoop(timestamp) {
    if (currentGameState !== GameState.RUNNING) { // stop loop if game is not RUNNING
        if (gameLoopId) {
            cancelAnimationFrame(gameLoopId);
            gameLoopId = null;
        }
        if (currentGameState !== GameState.PAUSED) {
             lastTime = 0;
        }
        return;
    }
    let dt; // time elapsed since last frame in seconds
    if (lastTime === 0) { // prevents potential negative on first frame or after a long pause
        dt = 0;
    } else { // all subsequent frames calculate actual delta time
        dt = (timestamp - lastTime) / 1000; // converting milliseconds to seconds
        dt = Math.min(dt, Config.MAX_DELTA_TIME); // clamp to prevent physics instability if frame rate drops significantly
    }
    lastTime = timestamp; // update lastTime for next frame calculation
    if (player && player.getCurrentHealth() <= 0 || (portal && !portal.isAlive())) { // check if to transition out of RUNNING
        console.log("Main: Player or Portal health is zero. Triggering Game Over.");
        handleGameOver();
        return;
    }
    const waveInfo = WaveManager.getWaveInfo();
    if (waveInfo.allWavesCleared) {
         console.log("Main: WaveManager signals all waves cleared. Triggering Victory.");
         handleVictory();
         return;
    }
    WaveManager.update(dt, currentGameState); // get latest wave info from WaveManager
    const currentWaveManagerState = waveInfo.state; // get state after WaveManager.update potentially changed it this frame
    if (currentWaveManagerState === 'BUILDPHASE' && previousWaveManagerState === 'WAVE_COUNTDOWN') { // logic increasing portal safety radius
        currentPortalSafetyRadius += Config.PORTAL_RADIUS_GROWTH_PER_WAVE; // increment radius by configured growth amount
        console.log(`Safety Radius: ${currentPortalSafetyRadius}`);
    }
    previousWaveManagerState = currentWaveManagerState; // update state for next frame
    if (currentWaveManagerState !== 'WARPPHASE') { // during WARPPHASE we pause most updates to give appearance of time warping (only World updates)
        if (player) {
             const inputState = Input.getState();
             const internalMousePos = Input.getMousePosition();
             const targetWorldPos = getMouseWorldCoords(internalMousePos);
             const targetGridCell = getMouseGridCoords(internalMousePos);
             player.update(dt, inputState, targetWorldPos, targetGridCell);
             Input.consumeClick();
        }
        ItemManager.update(dt, player);
        EnemyManager.update(dt, player ? player.getPosition() : null);
        if (player) { // collision checks involving player
            CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
            CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
            CollisionManager.checkPlayerAttackBlockCollisions(player);
            CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies());
        }
        if (portal) { // check if portal is alive
            CollisionManager.checkEnemyPortalCollisions(EnemyManager.getEnemies(), portal);
        }
    } else {
         Input.consumeClick();
    }
    World.update(dt);
    calculateCameraPosition();
    Renderer.clear();
    const mainCtx = Renderer.getContext();
    mainCtx.save();
    mainCtx.scale(cameraScale, cameraScale);
    mainCtx.translate(-cameraX, -cameraY);
    World.draw(mainCtx);
    GridRenderer.drawStaticGrid(mainCtx, isGridVisible);
    ItemManager.draw(mainCtx);
    if (portal) {
        portal.setSafetyRadius(currentPortalSafetyRadius);
        portal.draw(mainCtx);
    }
    if (currentWaveManagerState !== 'WARPPHASE') {
        EnemyManager.draw(mainCtx);
    } else {
        // TODO: Draw a static snapshot or effect for enemies in WARPPHASE?
    }
    if (player) { // draw player and their held item
        player.draw(mainCtx);
        player.drawGhostBlock(mainCtx);
    }
    mainCtx.restore(); // restore context state to remove camera transformations
    if (player) {
        UI.updatePlayerInfo( // update UI based on current state
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
    UI.updateWaveTimer(waveInfo);
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
    gameLoopId = requestAnimationFrame(gameLoop);
}
// --- Calculate and set initial camera position, centered on the player ---
function calculateInitialCamera() {
     if (player) { // only calculate if player exists
        const viewWidth = Config.CANVAS_WIDTH; // internal rendering width (matches canvas.width)
        const viewHeight = Config.CANVAS_HEIGHT; // internal rendering height (matches canvas.height)
        cameraScale = 1.0; // reset zoom to default on game start/initial calculation.
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
        const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth); // Use Math.max(0, ...) in case the world is smaller than the viewport (prevents negative max scroll).dddd
        const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);
        // Clamp the target camera position to stay within the valid world bounds.
        cameraX = Math.max(0, Math.min(targetX, maxCameraX));
        cameraY = Math.max(0, Math.min(targetY, maxCameraY));
        // --- Center Camera If World is Smaller Than Viewport ---
        if (worldPixelWidth <= visibleWorldWidth) { // If the world is narrower than the visible area at the current scale, center the camera horizontally.
            cameraX = (worldPixelWidth - visibleWorldWidth) / 2;
        }
        if (worldPixelHeight <= visibleWorldHeight) { // If the world is shorter than the visible area at the current scale, center the camera vertically.
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
// --- Initialization ---
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
            alert(`FATAL Initialization Error:\n${error.message}\nPlease check console (F12) and refresh.`); // if overlay can't be found, fall back to simple alert
        }
    }
}
// --- Auto-Pause When Hidden ---
function handleVisibilityChange() {
    if (document.hidden && currentGameState === GameState.RUNNING) {
        console.log("Document hidden, auto-pausing game.");
        isAutoPaused = true;
        pauseGame();
    }
}
// --- Listener to Run init Once DOM Fully Loaded ---
window.addEventListener('DOMContentLoaded', init);