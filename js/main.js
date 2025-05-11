// -----------------------------------------------------------------------------
// root/js/main.js - Game Entry Point and Main Loop
// -----------------------------------------------------------------------------

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
// --- Global Variables ---
// =============================================================================

let gameStartTime = 0; // track when current game started for playtime stat
let lastTime = 0; // time since last frame
let gameLoopId = null; // requestAnimationFrame ID for pausing
let isAutoPaused = false; // flag if paused due to tab visibility
let isGridVisible = false;

let player = null;
let portal = null;
let cameraX = 0;
let cameraY = 0;
let cameraScale = 1.0; // 1 = normal zoom

let appContainer = null;
let bootOverlayEl = null;
let menuOverlayEl = null;
let epochOverlayEl = null;

// NEW: Game world element references
let topSidebarEl = null;
let gameWrapperEl = null;
let bottomSidebarEl = null;

let cutsceneImages = []; // array of HTMLImageElements
let currentCutsceneImageIndex = 0;
let cutsceneTimer = 0;
let cutsceneDurationPerImage = Config.CUTSCENE_IMAGE_DURATION;
let cutsceneTextContentEl = null; // For the <p> tag to display cutscene text
let cutsceneTextContainerEl = null; // For the <div> #cutscene-text-box

let titleStartButton = null;
let mainmenuStartGameButton = null;
let mainmenuSettingsButton = null;
let settingsBackButton = null;
let resumeButton = null;
let restartButtonGameOver = null;
let restartButtonVictory = null;
let restartButtonPause = null;
let cutsceneSkipButton = null;
let btnToggleGrid = null;
let muteMusicButtonEl = null;
let muteSfxButtonEl = null;

// Overlay content divs (for direct manipulation in MAIN_MENU state)
let overlayMainMenuContentEl = null;
let overlaySettingsContentEl = null;
let gameOverStatsTextP = null;
let victoryStatsTextP = null;
let errorOverlayMessageP = null;

const GameState = Object.freeze({ // game state enum
    TITLE: 'TITLE',         // Title screen (was PRE_GAME)
    MAIN_MENU: 'MAIN_MENU', // Main menu screen (now includes settings as an overlay variation)
    CUTSCENE: 'CUTSCENE',   // Intro cutscene playing
    RUNNING: 'RUNNING',     // Loop active, timers decrement, physics run, state transitions occur
    PAUSED: 'PAUSED',       // Loop paused, no updates
    GAME_OVER: 'GAME_OVER', // Gameover screen
    VICTORY: 'VICTORY',     // Victory screen
    ERROR: 'ERROR'          // Error overlay
});

let currentGameState = GameState.TITLE; // initial state

// =============================================================================
// --- Helper Functions ---
// =============================================================================

function getWorldPixelWidth() { return Config.CANVAS_WIDTH; }
function getWorldPixelHeight() { return Config.GRID_ROWS * Config.BLOCK_HEIGHT; }
window.pauseGameCallback = pauseGame; // expose pauseGame globally for UI pause button
window.updateCameraScale = function(deltaScale) { // expose updateCameraScale globally for input (mouse wheel)
    if (currentGameState !== GameState.RUNNING && currentGameState !== GameState.PAUSED) {
        return; // camera can only zoom if game is running/paused, not in overlay/menu
    }
    const oldScale = cameraScale;
    let newScale = cameraScale + deltaScale;
    const internalCanvasWidth = Config.CANVAS_WIDTH; // internal canvas dimensions
    const internalCanvasHeight = Config.CANVAS_HEIGHT;
    const worldPixelWidth = getWorldPixelWidth(); // world dimensions
    const worldPixelHeight = getWorldPixelHeight();
    const scaleToFitWidth = (worldPixelWidth > 0) ? internalCanvasWidth / worldPixelWidth : 1; // calculate minimum scale to fill viewport - avoid division by 0
    const scaleToFitHeight = (worldPixelHeight > 0) ? internalCanvasHeight / worldPixelHeight : 1;
    const minScaleRequired = Math.max(scaleToFitWidth, scaleToFitHeight);
    const effectiveMinScale = Math.max(Config.MIN_CAMERA_SCALE, minScaleRequired); // effective minimum scale is the LARGER of configured minimum and required scale to fill view
    newScale = Math.max(effectiveMinScale, Math.min(newScale, Config.MAX_CAMERA_SCALE)); // clamp new scale between effective minimum and configured maximum
    cameraScale = newScale; // apply final clamped scale - camera position re-clamped in game loop
}
function getMouseWorldCoords(inputMousePos) { // convert canvas coordinates to world coordinates
    if (!inputMousePos || typeof inputMousePos.x !== 'number' || typeof inputMousePos.y !== 'number' || isNaN(inputMousePos.x) || isNaN(inputMousePos.y)) {
        console.warn("getMouseWorldCoords: Invalid input mouse position.", inputMousePos);
        return { // return center of viewport in world coordinates as fallback
            x: cameraX + (Config.CANVAS_WIDTH / 2) / cameraScale,
            y: cameraY + (Config.CANVAS_HEIGHT / 2) / cameraScale
        };
    }
    const worldX = cameraX + (inputMousePos.x / cameraScale); // calculate coordinates based on camera position and scale
    const worldY = cameraY + (inputMousePos.y / cameraScale);
    return { x: worldX, y: worldY };
}
function getMouseGridCoords(inputMousePos) { // convert canvas coordinates to grid coordinates
    const { x: worldX, y: worldY } = getMouseWorldCoords(inputMousePos);
    return GridCollision.worldToGridCoords(worldX, worldY); // world pixels to grid indices
}
function handleWaveStart(waveNumber) { // callback function to handle start of new wave
    console.log(`Triggered by WaveManager - Starting Wave ${waveNumber}`);
}
window.toggleGridDisplay = toggleGridDisplay; // exposed toggle globally for UI button
function toggleGridDisplay() {
    isGridVisible = !isGridVisible;
    console.log(`Main: Grid display is now ${isGridVisible ? 'ON' : 'OFF'}.`);
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState()); // update UI button appearance immediately
}
window.toggleMusicMute = toggleMusicMute; // exposed globally for button
function toggleMusicMute() {
    const newState = AudioManager.toggleMusicMute(); // mute in AudioManager
    console.log(`Main: Music is now ${newState ? 'muted' : 'unmuted'}.`);
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), newState); // update button appearance
}
window.toggleSfxMute = toggleSfxMute;
function toggleSfxMute() {
    const newState = AudioManager.toggleSfxMute();
    console.log(`Main: SFX is now ${AudioManager.getSfxMutedState() ? 'muted' : 'unmuted'}.`);
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), newState);
}

// =============================================================================
// --- Overlay Management ---
// =============================================================================

function showOverlay(stateToShow) {
    if (!bootOverlayEl || !menuOverlayEl || !appContainer || !topSidebarEl || !gameWrapperEl || !bottomSidebarEl) {
        console.error("ShowOverlay: Core overlay/app or game world container elements not found!");
        return;
    }

    // 1. Reset overlay classes
    bootOverlayEl.className = '';
    menuOverlayEl.className = ''; // Also removes 'force-opaque'

    // 2. Default: game world is visible (will be set to '' which reverts to CSS default), no blur
    topSidebarEl.style.display = '';
    gameWrapperEl.style.display = '';
    bottomSidebarEl.style.display = '';
    appContainer.classList.remove('overlay-active');

    // 3. Reset cutscene elements if the new state is NOT CUTSCENE.
    if (stateToShow !== GameState.CUTSCENE) {
        if (cutsceneImages && cutsceneImages.length > 0) {
            cutsceneImages.forEach(img => {
                if (img) img.classList.remove('active');
            });
        }
        if (cutsceneTextContentEl) {
            cutsceneTextContentEl.textContent = '';
        }
        if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
        if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
    }

    // 4. Hide specific content divs within #menu-overlay (safeguard)
    if (overlayMainMenuContentEl) overlayMainMenuContentEl.style.display = '';
    if (overlaySettingsContentEl) overlaySettingsContentEl.style.display = '';

    // 5. Apply new state logic.
    switch (stateToShow) {
        case GameState.TITLE:
            topSidebarEl.style.display = 'none';
            gameWrapperEl.style.display = 'none';
            bottomSidebarEl.style.display = 'none';
            bootOverlayEl.classList.add('show-title');
            AudioManager.stopAllMusic();
            break;

        case GameState.MAIN_MENU:
            topSidebarEl.style.display = 'none';
            gameWrapperEl.style.display = 'none';
            bottomSidebarEl.style.display = 'none';
            menuOverlayEl.classList.add('active');
            menuOverlayEl.classList.add('show-mainmenu');
            menuOverlayEl.classList.add('force-opaque');
            AudioManager.stopGameMusic();
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.pause) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            } else {
                console.warn("UI Music track not defined for main menu (using pause track).");
            }
            break;

        case GameState.CUTSCENE: // Game world visible (blurred)
            menuOverlayEl.classList.add('active');
            menuOverlayEl.classList.add('show-cutscene');
            appContainer.classList.add('overlay-active'); // Add blur
            AudioManager.stopUIMusic();
            AudioManager.stopGameMusic();
            if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
            break;

        case GameState.PAUSED: // Game world visible (blurred)
            menuOverlayEl.classList.add('active');
            menuOverlayEl.classList.add('show-pause');
            appContainer.classList.add('overlay-active'); // Add blur
            AudioManager.pauseGameMusic();
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.pause) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            } else {
                console.warn("Pause music track not defined.");
            }
            break;

        case GameState.GAME_OVER: // Game world visible (blurred)
            menuOverlayEl.classList.add('active');
            menuOverlayEl.classList.add('show-gameover');
            appContainer.classList.add('overlay-active'); // Add blur
            AudioManager.stopGameMusic();
            if (gameOverStatsTextP && WaveManager) {
                const finalWave = WaveManager.getCurrentWaveNumber();
                gameOverStatsTextP.textContent = `You reached Wave ${finalWave}!`;
            }
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            // Fallback to pause music if specific game over music isn't defined
            if (Config.AUDIO_TRACKS.gameOver) { // Assuming you might add this
                 AudioManager.playUIMusic(Config.AUDIO_TRACKS.gameOver);
            } else if (Config.AUDIO_TRACKS.pause) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            }
            break;

        case GameState.VICTORY: // Game world visible (blurred)
            menuOverlayEl.classList.add('active');
            menuOverlayEl.classList.add('show-victory');
            appContainer.classList.add('overlay-active'); // Add blur
            AudioManager.stopGameMusic();
            if (victoryStatsTextP && Config.WAVES) {
                const totalWaves = Config.WAVES.length;
                victoryStatsTextP.textContent = `You cleared all ${totalWaves} waves!`;
            }
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.victory) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.victory);
            } else if (Config.AUDIO_TRACKS.pause) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            }
            break;

        case GameState.ERROR:
            topSidebarEl.style.display = 'none';
            gameWrapperEl.style.display = 'none';
            bottomSidebarEl.style.display = 'none';
            bootOverlayEl.classList.add('show-error');
            AudioManager.stopAllMusic();
            break;

        default: // Fallback to TITLE appearance
            console.warn(`ShowOverlay: Unknown state requested: ${stateToShow}. Defaulting to TITLE.`);
            topSidebarEl.style.display = 'none';
            gameWrapperEl.style.display = 'none';
            bottomSidebarEl.style.display = 'none';
            bootOverlayEl.classList.add('show-title');
            AudioManager.stopAllMusic();
            break;
    }
}

// You would also have a hideOverlay function if needed, though showOverlay often implicitly hides
// by resetting classes. If you need an explicit hide for going from an overlay to RUNNING state:
function hideOverlay() {
    if (!bootOverlayEl || !menuOverlayEl || !appContainer || !topSidebarEl || !gameWrapperEl || !bottomSidebarEl) {
        console.error("HideOverlay: Core overlay/app or game world container elements not found!");
        return;
    }
    // Ensure game world elements are visible (revert to CSS default display)
    topSidebarEl.style.display = '';
    gameWrapperEl.style.display = '';
    bottomSidebarEl.style.display = '';

    // Hide both overlays by removing their activating classes
    bootOverlayEl.className = ''; // Removes 'show-title', 'show-error'
    menuOverlayEl.className = ''; // Removes 'active', 'show-*', and 'force-opaque'
    appContainer.classList.remove('overlay-active'); // Remove blur from background
}

// =============================================================================
// --- Game State Control Functions ---
// =============================================================================

function handleTitleStart() {
    currentGameState = GameState.MAIN_MENU;
    showOverlay(GameState.MAIN_MENU);
}
function showMainMenu() {
    AudioManager.stopGameMusic();
    EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
    ItemManager.clearItemsOutsideRadius(0, 0, Infinity);
    currentGameState = GameState.MAIN_MENU;
    showOverlay(GameState.MAIN_MENU);
}
function showSettingsContent() {
    if (currentGameState !== GameState.MAIN_MENU || !overlayMainMenuContentEl || !overlaySettingsContentEl) return;
    overlayMainMenuContentEl.style.display = 'none';
    overlaySettingsContentEl.style.display = 'flex';
}
function backToMainMenuFromSettings() {
    if (currentGameState !== GameState.MAIN_MENU || !overlayMainMenuContentEl || !overlaySettingsContentEl) return;
    overlaySettingsContentEl.style.display = 'none';
    overlayMainMenuContentEl.style.display = 'flex';
}
function updateCutsceneText() {
    if (!cutsceneTextContentEl || currentGameState !== GameState.CUTSCENE) {
        if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = ''; // Clear if not in cutscene
        return;
    }
    const textsArray = Config.CUTSCENE_TEXTS || [];
    const text = textsArray[currentCutsceneImageIndex];
    if (text) {
        cutsceneTextContentEl.textContent = text;
    } else {
        cutsceneTextContentEl.textContent = ''; // No text for this image or array is empty
    }
}
function startCutscene() {
    currentGameState = GameState.CUTSCENE;
    showOverlay(GameState.CUTSCENE); // This will clear existing text
    currentCutsceneImageIndex = 0;
    cutsceneTimer = cutsceneDurationPerImage;
    cutsceneImages.forEach(img => img.classList.remove('active'));
    if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
    if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
    if (cutsceneImages[currentCutsceneImageIndex]) {
        cutsceneImages[currentCutsceneImageIndex].classList.add('active');
    
        // Use a slight delay for text/button fade-in to ensure image starts appearing first

        setTimeout(() => {

            if (currentGameState === GameState.CUTSCENE) { // Check if still in cutscene

                 if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.add('visible');

                 if (cutsceneSkipButton) cutsceneSkipButton.classList.add('visible');

            }

        }, 100); // 100ms delay, adjust as needed

    } else {
        console.error("Cutscene ERROR: First image element not found!");
        initializeAndRunGame();
        return;
    }
    updateCutsceneText(); // Update text for the first image
}

function updateCutscene(dt) {
    if (currentGameState !== GameState.CUTSCENE) return;
    cutsceneTimer -= dt;
    if (cutsceneTimer <= 0) {
        if (cutsceneImages[currentCutsceneImageIndex]) {
            cutsceneImages[currentCutsceneImageIndex].classList.remove('active');
        }
                if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');

        if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
        currentCutsceneImageIndex++;
        if (currentCutsceneImageIndex < cutsceneImages.length) {
            cutsceneTimer = cutsceneDurationPerImage;
            if (cutsceneImages[currentCutsceneImageIndex]) {
                cutsceneImages[currentCutsceneImageIndex].classList.add('active');
                                setTimeout(() => { // Delay for next text/button fade-in

                    if (currentGameState === GameState.CUTSCENE && currentCutsceneImageIndex < cutsceneImages.length) {

                         if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.add('visible');

                         if (cutsceneSkipButton) cutsceneSkipButton.classList.add('visible');

                    }

                }, 100); // Match delay from startCutscene, or adjust
            } else {
                console.error(`Cutscene ERROR: Image element ${currentCutsceneImageIndex + 1} not found!`);
                updateCutscene(0); // Try to advance again immediately
                cutsceneTimer = 0;
                return;
            }
            updateCutsceneText(); // Update text for the new image
        } else {
            initializeAndRunGame(); // Cutscene ends
            if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = ''; // Clear text when cutscene ends
        }
    }
}
function skipCutscene() {
    if (currentGameState !== GameState.CUTSCENE) {
        console.warn("skipCutscene called but game is not in CUTSCENE state.");
        return;
    }
    if (cutsceneImages && cutsceneImages[currentCutsceneImageIndex]) {
        cutsceneImages[currentCutsceneImageIndex].classList.remove('active');
    }
    if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
    if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
    currentCutsceneImageIndex = 0; // Reset index
    cutsceneTimer = 0;             // Reset timer
    if (cutsceneTextContentEl) {
        cutsceneTextContentEl.textContent = ''; // Clear text
    }
    initializeAndRunGame();
    if(cutsceneTextContentEl) cutsceneTextContentEl.textContent = ''; // Clear text when skipping
}
window.skipCutscene = skipCutscene;
function initializeAndRunGame() {
    if (currentGameState === GameState.RUNNING) {
        console.warn("[main.js] initializeAndRunGame called but game already RUNNING.");
        return;
    }
    if (currentGameState !== GameState.MAIN_MENU && currentGameState !== GameState.CUTSCENE && currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY && currentGameState !== GameState.PAUSED) {
        console.warn(`[main.js] initializeAndRunGame called from unexpected state: ${currentGameState}. Allowing, but investigate.`);
    }
    try {
        UI.setPlayerReference(null);
        UI.setPortalReference(null);
        const portalSpawnX = Config.CANVAS_WIDTH / 2 - Config.PORTAL_WIDTH / 2;
        const portalSpawnY = (Config.MEAN_GROUND_LEVEL * Config.BLOCK_HEIGHT) - Config.PORTAL_HEIGHT - (Config.PORTAL_SPAWN_Y_OFFSET_BLOCKS * Config.BLOCK_HEIGHT);
        if (isNaN(portalSpawnY) || portalSpawnY < 0) {
            console.error("[main.js] FATAL: Invalid Portal Spawn Y calculation! Defaulting position.");
            portal = new Portal(Config.CANVAS_WIDTH / 2 - Config.PORTAL_WIDTH / 2, 50);
        } else {
            portal = new Portal(portalSpawnX, portalSpawnY);
        }
        WorldManager.init(portal); // <<<<<<< THIS NOW DOES:
                                   // 1. World.initializeGrid()
                                   // 2. worldGenerator.generateInitialWorld() (landmass, caves)
                                   // 3. WorldManager.applyGravitySettlement(null) (LOGICAL, modifies World.grid)
                                   // 4. applyInitialFloodFill() (LOGICAL, modifies World.grid)
                                   // 5. Renderer check & anim queue init
        const initialAgingPasses = Config.AGING_INITIAL_PASSES ?? 1;
        console.log(`[main.js] Applying initial world aging (${initialAgingPasses} passes) after generation...`);
        const changedCellsInitialAging = new Map();
        for (let i = 0; i < initialAgingPasses; i++) {
            const changedCellsInPass = AgingManager.applyAging(null);
            changedCellsInPass.forEach(({ c, r }) => {
                const key = `${c},${r}`;
                if (!changedCellsInitialAging.has(key)) {
                    changedCellsInitialAging.set(key, { c, r });
                    WorldManager.updateStaticWorldAt(c, r);
                }
            });
        }
        console.log(`[main.js] Initial world aging complete. Total unique blocks changed: ${changedCellsInitialAging.size}`);
        WorldManager.renderStaticWorldToGridCanvas();
        WorldManager.seedWaterUpdateQueue();
        ItemManager.init();
        EnemyManager.init();
        try {
            const playerSpawnX = Config.PLAYER_START_X;
            const playerSpawnY = Config.PLAYER_START_Y;
            if (isNaN(playerSpawnY) || playerSpawnY < 0) {
                console.error("[main.js] FATAL: Invalid Player Spawn Y calculation! Defaulting position.");
                player = new Player(Config.CANVAS_WIDTH / 2 - Config.PLAYER_WIDTH / 2, 100, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
            } else {
                player = new Player(playerSpawnX, playerSpawnY, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
            }
            UI.setPlayerReference(player);
            UI.setPortalReference(portal);
        } catch (error) {
            player = null;
            portal = null;
            console.error("[main.js] FATAL: Game Object Creation/Init Error Message:", error.message);
            console.error("[main.js] Error Stack:", error.stack);
            currentGameState = GameState.TITLE;
            showOverlay(GameState.TITLE);
            alert("Error creating game objects. Please check console and refresh.");
            return;
        }
        WaveManager.reset(handleWaveStart, portal);
        console.log("[main.js] WaveManager reset for new game.");
        calculateInitialCamera();
        isAutoPaused = false;
        isGridVisible = false;
        AudioManager.setVolume('game', Config.AUDIO_DEFAULT_GAME_VOLUME);
        AudioManager.setVolume('sfx', Config.AUDIO_DEFAULT_SFX_VOLUME);
        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
        console.log(`[main.js] Transitioning to GameState.RUNNING from ${currentGameState}`);
        currentGameState = GameState.RUNNING;
        hideOverlay();
        gameStartTime = performance.now();
        console.log(">>> [main.js] Game Started <<<");
    } catch (error) {
        console.error("[main.js] FATAL Error during initializeAndRunGame:", error);
        alert("FATAL Error starting game. Check console for details.");
        currentGameState = GameState.TITLE;
        showOverlay(GameState.TITLE);
    }
}
function pauseGame() {
    if (currentGameState !== GameState.RUNNING) {
        console.warn("pauseGame called but game is not RUNNING.");
        return;
    }
    console.log(">>> [main.js] Pausing Game <<<");
    currentGameState = GameState.PAUSED;
    showOverlay(GameState.PAUSED);
}
function resumeGame() {
    if (currentGameState !== GameState.PAUSED) {
        console.warn("resumeGame called but game is not PAUSED.");
        return;
    }
    console.log(">>> [main.js] Resuming Game <<<");
    isAutoPaused = false;
    console.log(`[main.js] Transitioning to GameState.RUNNING from ${currentGameState}`);
    currentGameState = GameState.RUNNING;
    hideOverlay();
    AudioManager.unpauseGameMusic();
}
function handleGameOver() {
    if (currentGameState === GameState.GAME_OVER) return;
    console.log(">>> [main.js] Handling Game Over <<<");
    currentGameState = GameState.GAME_OVER;
    WaveManager.setGameOver();
    EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
    ItemManager.clearItemsOutsideRadius(0, 0, Infinity);
    showOverlay(GameState.GAME_OVER);
    isAutoPaused = false;
}
function handleVictory() {
    if (currentGameState === GameState.VICTORY) return;
    console.log(">>> [main.js] Handling Victory! <<<");
    currentGameState = GameState.VICTORY;
    WaveManager.setVictory();
    EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
    ItemManager.clearItemsOutsideRadius(0, 0, Infinity);
    showOverlay(GameState.VICTORY);
    isAutoPaused = false;
}
function restartGame() {
    if (currentGameState !== GameState.GAME_OVER &&
        currentGameState !== GameState.VICTORY &&
        currentGameState !== GameState.PAUSED &&
        currentGameState !== GameState.MAIN_MENU)
    {
        console.warn(`[main.js] restartGame called but game not in a restartable state (${currentGameState}).`);
        return;
    }
    console.log(">>> [main.js] Restarting Game (Returning to Main Menu) <<<");
    player = null;
    portal = null;
    UI.setPlayerReference(null);
    UI.setPortalReference(null);
    EnemyManager.clearAllEnemies();
    ItemManager.clearAllItems();
    AudioManager.stopAllMusic();
    cameraX = 0;
    cameraY = 0;
    cameraScale = 1.0;
    isAutoPaused = false;
    isGridVisible = false;
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
    currentCutsceneImageIndex = 0;
    cutsceneTimer = 0;
    cutsceneImages.forEach(img => img.classList.remove('active'));
    if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
    if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
    showMainMenu();
}
function gameLoop(timestamp) {
    gameLoopId = requestAnimationFrame(gameLoop);
    try {
        let rawDt = (lastTime === 0) ? 0 : (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        rawDt = Math.min(rawDt, Config.MAX_DELTA_TIME);
        let dt = 0;
        if (currentGameState === GameState.RUNNING ||
            currentGameState === GameState.CUTSCENE ||
            (WaveManager.getWaveInfo().state === 'WARPPHASE' && currentGameState !== GameState.PAUSED)
        ) {
            dt = rawDt;
        }
        if (currentGameState === GameState.RUNNING) {
            WaveManager.update(dt, currentGameState);
            const updatedWaveInfo = WaveManager.getWaveInfo();
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
            if (portal && portal.isAlive()) { // or portal.isActive if that's preferred for update logic?
                portal.update(dt);
            }
            if (player) {
                CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
                CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
                CollisionManager.checkPlayerAttackBlockCollisions(player);
                CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies());
            }
            if (portal && portal.isAlive()) {
                CollisionManager.checkEnemyPortalCollisions(EnemyManager.getEnemies(), portal);
            }
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
        if (dt > 0) {
            WorldManager.update(dt);
        }
        Renderer.clear();
        const mainCtx = Renderer.getContext();
        const isGameWorldVisible = currentGameState === GameState.RUNNING || currentGameState === GameState.PAUSED || currentGameState === GameState.GAME_OVER || currentGameState === GameState.VICTORY || (currentGameState === GameState.CUTSCENE || WaveManager.getWaveInfo().state === 'WARPPHASE');
        if (isGameWorldVisible && gameWrapperEl && gameWrapperEl.style.display !== 'none') { // Check if game world should be drawn
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
                const isGameplayActiveAtDraw = currentWaveManagerStateAtDraw === 'PRE_WAVE' || currentWaveManagerStateAtDraw === 'WAVE_COUNTDOWN' || currentWaveManagerStateAtDraw === 'BUILDPHASE' || currentWaveManagerStateAtDraw === 'WARPPHASE';
                const playerIsInteractableAtDraw = player && player.isActive && !player.isDying;
                if (playerIsInteractableAtDraw && isGameplayActiveAtDraw && player.isMaterialSelected()) {
                    player.drawGhostBlock(mainCtx);
                }
            }
            mainCtx.restore();
        }
        if (UI.isInitialized()) {
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
function calculateInitialCamera() {
    if (player && player.isActive) {
        const viewWidth = Config.CANVAS_WIDTH;
        const viewHeight = Config.CANVAS_HEIGHT;
        cameraScale = 1.0;
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        let targetX = playerCenterX - (visibleWorldWidth / 2);
        let targetY = playerCenterY - (visibleWorldHeight / 2);
        const worldPixelWidth = getWorldPixelWidth();
        const worldPixelHeight = getWorldPixelHeight();
        const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth);
        const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);
        cameraX = Math.max(0, Math.min(targetX, maxCameraX));
        cameraY = Math.max(0, Math.min(targetY, maxCameraY));
        if (worldPixelWidth <= visibleWorldWidth) {
            cameraX = (worldPixelWidth - visibleWorldWidth) / 2;
        }
        if (worldPixelHeight <= visibleWorldHeight) {
            cameraY = (worldPixelHeight - visibleWorldHeight) / 2;
        }
    }
    else {
        cameraX = 0;
        cameraY = 0;
        cameraScale = 1.0;
        console.log("Initial Camera Set: Player not active or not found, defaulting camera to (0,0) @ scale 1.0");
    }
}
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
function init() {
    currentGameState = GameState.TITLE;
    try {
        appContainer = document.getElementById('app-container');
        bootOverlayEl = document.getElementById('boot-overlay');
        menuOverlayEl = document.getElementById('menu-overlay');

        // Cache game world elements
        topSidebarEl = document.getElementById('top-sidebar');
        gameWrapperEl = document.getElementById('game-wrapper');
        bottomSidebarEl = document.getElementById('bottom-sidebar');

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
        errorOverlayMessageP = document.getElementById('error-message-text');
        cutsceneSkipButton = document.getElementById('cutscene-skip-button');
        cutsceneTextContentEl = document.getElementById('cutscene-text-content');
        cutsceneTextContainerEl = document.getElementById('cutscene-text-box');
        btnToggleGrid = document.getElementById('btn-toggle-grid');
        muteMusicButtonEl = document.getElementById('btn-mute-music');
        muteSfxButtonEl = document.getElementById('btn-mute-sfx');
        epochOverlayEl = document.getElementById('epoch-overlay');
        overlayMainMenuContentEl = document.getElementById('overlay-mainmenu-content');
        overlaySettingsContentEl = document.getElementById('overlay-settings-content');
        cutsceneImages = [];
        Config.CUTSCENE_IMAGE_PATHS.forEach((_, index) => {
            const img = document.getElementById(`cutscene-image-${index + 1}`);
            if (img) cutsceneImages.push(img);
        });
        if (cutsceneImages.length !== Config.CUTSCENE_IMAGE_PATHS.length) {
            console.warn(`UI Warning: Found ${cutsceneImages.length} cutscene image elements, expected ${Config.CUTSCENE_IMAGE_PATHS.length}. Check IDs in index.html.`);
        }
        const requiredElements = [
            appContainer,  bootOverlayEl, menuOverlayEl,
            topSidebarEl, gameWrapperEl, bottomSidebarEl,
            titleStartButton, mainmenuStartGameButton, mainmenuSettingsButton, settingsBackButton,
            resumeButton, restartButtonGameOver, restartButtonVictory, restartButtonPause, gameOverStatsTextP, victoryStatsTextP,
            errorOverlayMessageP, btnToggleGrid, muteMusicButtonEl, muteSfxButtonEl, epochOverlayEl, cutsceneSkipButton,
            cutsceneTextContentEl,
            overlayMainMenuContentEl, overlaySettingsContentEl
        ];
        if (requiredElements.some(el => !el)) {
            const elementNames = [
                'appContainer (#app-container)', 'bootOverlayEl (#boot-overlay)', 'menuOverlayEl (#menu-overlay)',
                'topSidebarEl (#top-sidebar)', 'gameWrapperEl (#game-wrapper)', 'bottomSidebarEl (#bottom-sidebar)',
                'titleStartButton (#start-game-button)', 'mainmenuStartGameButton (#mainmenu-start-game-button)', 'mainmenuSettingsButton (#mainmenu-settings-button)', 'settingsBackButton (#settings-back-button)',
                'resumeButton (#resume-button)',
                'restartButtonGameOver (#restart-button-overlay)', 'restartButtonVictory (#restart-button-overlay-victory)',
                'restartButtonPause (#restart-button-overlay-pause)',
                'gameOverStatsTextP (#gameover-stats-text)', 'victoryStatsTextP (#victory-stats-text)',
                'errorOverlayMessageP (#error-message-text)',
                'btnToggleGrid (#btn-toggle-grid)', 'muteMusicButtonEl (#btn-mute-music)', 'muteSfxButtonEl (#btn-mute-sfx)',
                'epochOverlayEl (#epoch-overlay)', 'cutsceneSkipButton (#cutscene-skip-button)',
                'cutsceneTextContentEl (#cutscene-text-content)', 'cutsceneTextContainerEl (#cutscene-text-box)',
                'overlayMainMenuContentEl (#overlay-mainmenu-content)', 'overlaySettingsContentEl (#overlay-settings-content)'
            ];
            const missing = requiredElements
                .map((el, i) => el ? null : elementNames[i])
                .filter(name => name !== null);
            throw new Error(`FATAL INIT ERROR: Essential DOM elements not found: ${missing.join(', ')}! Please check index.html.`);
        }
        titleStartButton.addEventListener('click', handleTitleStart);
        mainmenuStartGameButton.addEventListener('click', startCutscene);
        mainmenuSettingsButton.addEventListener('click', showSettingsContent);
        settingsBackButton.addEventListener('click', backToMainMenuFromSettings);
        resumeButton.addEventListener('click', resumeGame);
        restartButtonGameOver.addEventListener('click', restartGame);
        restartButtonVictory.addEventListener('click', restartGame);
        restartButtonPause.addEventListener('click', restartGame);
        cutsceneSkipButton.addEventListener('click', skipCutscene);
        btnToggleGrid.addEventListener('click', toggleGridDisplay);
        muteMusicButtonEl.addEventListener('click', toggleMusicMute);
        muteSfxButtonEl.addEventListener('click', toggleSfxMute);
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
        lastTime = 0;
        isAutoPaused = false;
        isGridVisible = false;
        currentCutsceneImageIndex = 0;
        cutsceneTimer = 0;
        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
        document.addEventListener('visibilitychange', handleVisibilityChange);
        showOverlay(GameState.TITLE);
        gameLoopId = requestAnimationFrame(gameLoop);
    } catch (error) {
        console.error("FATAL: Initialization Error:", error);
        // Ensure errorOverlayMessageP exists before trying to set its textContent
        if (bootOverlayEl && errorOverlayMessageP) { // errorOverlayMessageP is inside bootOverlayEl
            errorOverlayMessageP.textContent = `Error: ${error.message}`;
            currentGameState = GameState.ERROR;
            showOverlay(GameState.ERROR); // This will make bootOverlayEl visible with error content
        } else {
            alert(`FATAL Initialization Error:\n${error.message}\nCheck console for details.`);
        }
    }
}
function handleVisibilityChange() {
    if (document.hidden && currentGameState === GameState.RUNNING) {
        console.log("[main.js] Document hidden, auto-pausing game.");
        isAutoPaused = true;
        pauseGame();
    }
}
window.addEventListener('DOMContentLoaded', init);