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
import * as World from './utils/world.js'; // Make sure World is imported if using its functions directly


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

// Global state for background world generation
let worldGenerationPromise = null;
let isWorldGenerated = false;

// =============================================================================
// --- Helper Functions ---
// =============================================================================

function getWorldPixelWidth() { return Config.CANVAS_WIDTH; }
function getWorldPixelHeight() { return Config.GRID_ROWS * Config.BLOCK_HEIGHT; }
window.pauseGameCallback = pauseGame; // expose pauseGame globally for UI pause button
window.updateCameraScale = function(deltaScale) { // expose updateCameraScale globally for input (mouse wheel)
    if (currentGameState !== GameState.RUNNING && currentGameState !== GameState.PAUSED) {
        return;
    }
    // const oldScale = cameraScale; // Not used
    let newScale = cameraScale + deltaScale;
    const internalCanvasWidth = Config.CANVAS_WIDTH;
    const internalCanvasHeight = Config.CANVAS_HEIGHT;
    const worldPixelWidthVal = getWorldPixelWidth();
    const worldPixelHeightVal = getWorldPixelHeight();
    const scaleToFitWidth = (worldPixelWidthVal > 0) ? internalCanvasWidth / worldPixelWidthVal : 1;
    const scaleToFitHeight = (worldPixelHeightVal > 0) ? internalCanvasHeight / worldPixelHeightVal : 1;
    const minScaleRequired = Math.max(scaleToFitWidth, scaleToFitHeight);
    const effectiveMinScale = Math.max(Config.MIN_CAMERA_SCALE, minScaleRequired);
    newScale = Math.max(effectiveMinScale, Math.min(newScale, Config.MAX_CAMERA_SCALE));
    cameraScale = newScale;
}
function getMouseWorldCoords(inputMousePos) {
    if (!inputMousePos || typeof inputMousePos.x !== 'number' || typeof inputMousePos.y !== 'number' || isNaN(inputMousePos.x) || isNaN(inputMousePos.y)) {
        // console.warn("getMouseWorldCoords: Invalid input mouse position.", inputMousePos);
        return {
            x: cameraX + (Config.CANVAS_WIDTH / 2) / cameraScale,
            y: cameraY + (Config.CANVAS_HEIGHT / 2) / cameraScale
        };
    }
    const worldX = cameraX + (inputMousePos.x / cameraScale);
    const worldY = cameraY + (inputMousePos.y / cameraScale);
    return { x: worldX, y: worldY };
}
function getMouseGridCoords(inputMousePos) {
    const { x: worldX, y: worldY } = getMouseWorldCoords(inputMousePos);
    return GridCollision.worldToGridCoords(worldX, worldY);
}
function handleWaveStart(waveNumber) {
    console.log(`Triggered by WaveManager - Starting Wave ${waveNumber}`);
}
window.toggleGridDisplay = toggleGridDisplay;
function toggleGridDisplay() {
    isGridVisible = !isGridVisible;
    console.log(`Main: Grid display is now ${isGridVisible ? 'ON' : 'OFF'}.`);
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
}
window.toggleMusicMute = toggleMusicMute;
function toggleMusicMute() {
    const newState = AudioManager.toggleMusicMute();
    console.log(`Main: Music is now ${newState ? 'muted' : 'unmuted'}.`);
    UI.updateSettingsButtonStates(isGridVisible, newState, AudioManager.getSfxMutedState()); // Pass new music state
}
window.toggleSfxMute = toggleSfxMute;
function toggleSfxMute() {
    const newState = AudioManager.toggleSfxMute();
    console.log(`Main: SFX is now ${newState ? 'muted' : 'unmuted'}.`);
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), newState); // Pass new SFX state
}


// NEW: Function to perform world generation steps in the background
async function performBackgroundWorldGeneration() {
    if (worldGenerationPromise && isWorldGenerated) {
        // console.log("[Main] Background world generation already completed."); // Less verbose
        return;
    }
    if (worldGenerationPromise && !isWorldGenerated) {
        // console.log("[Main] Background world generation already in progress."); // Less verbose
        return worldGenerationPromise;
    }

    console.log("[Main] Starting background world generation...");
    isWorldGenerated = false;

    worldGenerationPromise = (async () => {
        try {
            WorldManager.executeInitialWorldGenerationSequence();

            const initialAgingPasses = Config.AGING_INITIAL_PASSES ?? 1;
            // console.log(`[Main Background] Applying initial world aging (${initialAgingPasses} passes)...`); // Less verbose
            for (let i = 0; i < initialAgingPasses; i++) {
                AgingManager.applyAging(null);
            }
            // console.log(`[Main Background] Initial world aging complete.`); // Less verbose

            if (!Renderer.getGridCanvas()) {
                Renderer.createGridCanvas(); // Ensure it exists
            }
            WorldManager.renderStaticWorldToGridCanvas();
            WorldManager.seedWaterUpdateQueue();

            isWorldGenerated = true;
            console.log("[Main] Background world generation COMPLETE.");
        } catch (error) {
            console.error("[Main] FATAL error during background world generation:", error);
            isWorldGenerated = false;
            throw error;
        }
    })();
    return worldGenerationPromise;
}

// =============================================================================
// --- Overlay Management ---
// =============================================================================

function showOverlay(stateToShow) {
    if (!bootOverlayEl || !menuOverlayEl || !appContainer || !topSidebarEl || !gameWrapperEl || !bottomSidebarEl) {
        console.error("ShowOverlay: Core overlay/app or game world container elements not found!");
        return;
    }
    bootOverlayEl.className = '';
    menuOverlayEl.className = '';
    topSidebarEl.style.display = '';
    gameWrapperEl.style.display = '';
    bottomSidebarEl.style.display = '';
    appContainer.classList.remove('overlay-active');
    if (stateToShow !== GameState.CUTSCENE) {
        if (cutsceneImages && cutsceneImages.length > 0) {
            cutsceneImages.forEach(img => {
                if (img) img.classList.remove('active');
            });
        }
        if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
        if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
        if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
    }
    if (overlayMainMenuContentEl) overlayMainMenuContentEl.style.display = '';
    if (overlaySettingsContentEl) overlaySettingsContentEl.style.display = '';

    switch (stateToShow) {
        case GameState.TITLE:
            topSidebarEl.style.display = 'none'; gameWrapperEl.style.display = 'none'; bottomSidebarEl.style.display = 'none';
            bootOverlayEl.classList.add('show-title');
            AudioManager.stopAllMusic();
            break;
        case GameState.MAIN_MENU:
            topSidebarEl.style.display = 'none'; gameWrapperEl.style.display = 'none'; bottomSidebarEl.style.display = 'none';
            menuOverlayEl.classList.add('active', 'show-mainmenu', 'force-opaque');
            AudioManager.stopGameMusic(); AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.pause) AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            break;
        case GameState.CUTSCENE:
            menuOverlayEl.classList.add('active', 'show-cutscene');
            appContainer.classList.add('overlay-active');
            AudioManager.stopUIMusic(); AudioManager.stopGameMusic();
            if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
            break;
        case GameState.PAUSED:
            menuOverlayEl.classList.add('active', 'show-pause');
            appContainer.classList.add('overlay-active');
            AudioManager.pauseGameMusic(); AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.pause) AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            break;
        case GameState.GAME_OVER:
            menuOverlayEl.classList.add('active', 'show-gameover');
            appContainer.classList.add('overlay-active');
            AudioManager.stopGameMusic();
            if (gameOverStatsTextP && WaveManager) gameOverStatsTextP.textContent = `You reached Wave ${WaveManager.getCurrentWaveNumber()}!`;
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.gameOver) AudioManager.playUIMusic(Config.AUDIO_TRACKS.gameOver);
            else if (Config.AUDIO_TRACKS.pause) AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            break;
        case GameState.VICTORY:
            menuOverlayEl.classList.add('active', 'show-victory');
            appContainer.classList.add('overlay-active');
            AudioManager.stopGameMusic();
            if (victoryStatsTextP && Config.WAVES) victoryStatsTextP.textContent = `You cleared all ${Config.WAVES.length} waves!`;
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.victory) AudioManager.playUIMusic(Config.AUDIO_TRACKS.victory);
            else if (Config.AUDIO_TRACKS.pause) AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            break;
        case GameState.ERROR:
            topSidebarEl.style.display = 'none'; gameWrapperEl.style.display = 'none'; bottomSidebarEl.style.display = 'none';
            bootOverlayEl.classList.add('show-error');
            AudioManager.stopAllMusic();
            break;
        default:
            console.warn(`ShowOverlay: Unknown state requested: ${stateToShow}. Defaulting to TITLE.`);
            topSidebarEl.style.display = 'none'; gameWrapperEl.style.display = 'none'; bottomSidebarEl.style.display = 'none';
            bootOverlayEl.classList.add('show-title');
            AudioManager.stopAllMusic();
            break;
    }
}

function hideOverlay() {
    if (!bootOverlayEl || !menuOverlayEl || !appContainer || !topSidebarEl || !gameWrapperEl || !bottomSidebarEl) {
        console.error("HideOverlay: Core overlay/app or game world container elements not found!");
        return;
    }
    topSidebarEl.style.display = ''; gameWrapperEl.style.display = ''; bottomSidebarEl.style.display = '';
    bootOverlayEl.className = ''; menuOverlayEl.className = '';
    appContainer.classList.remove('overlay-active');
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
    EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity); // Clear all enemies
    ItemManager.clearItemsOutsideRadius(0, 0, Infinity);   // Clear all items
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
        if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
        return;
    }
    const textsArray = Config.CUTSCENE_TEXTS || [];
    const text = textsArray[currentCutsceneImageIndex];
    if (text) cutsceneTextContentEl.textContent = text;
    else cutsceneTextContentEl.textContent = '';
}
function startCutscene() {
    currentGameState = GameState.CUTSCENE;
    showOverlay(GameState.CUTSCENE);
    currentCutsceneImageIndex = 0;
    cutsceneTimer = cutsceneDurationPerImage;
    cutsceneImages.forEach(img => img.classList.remove('active'));
    if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
    if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
    if (cutsceneImages[currentCutsceneImageIndex]) {
        cutsceneImages[currentCutsceneImageIndex].classList.add('active');
        setTimeout(() => {
            if (currentGameState === GameState.CUTSCENE) {
                 if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.add('visible');
                 if (cutsceneSkipButton) cutsceneSkipButton.classList.add('visible');
            }
        }, 100);
    } else {
        console.error("Cutscene ERROR: First image element not found!");
        initializeAndRunGame(); // Skip to game if image missing
        return;
    }
    updateCutsceneText();
}

function updateCutscene(dt) {
    if (currentGameState !== GameState.CUTSCENE) return;
    cutsceneTimer -= dt;
    if (cutsceneTimer <= 0) {
        if (cutsceneImages[currentCutsceneImageIndex]) cutsceneImages[currentCutsceneImageIndex].classList.remove('active');
        if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
        if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
        currentCutsceneImageIndex++;
        if (currentCutsceneImageIndex < cutsceneImages.length) {
            cutsceneTimer = cutsceneDurationPerImage;
            if (cutsceneImages[currentCutsceneImageIndex]) {
                cutsceneImages[currentCutsceneImageIndex].classList.add('active');
                setTimeout(() => {
                    if (currentGameState === GameState.CUTSCENE && currentCutsceneImageIndex < cutsceneImages.length) {
                         if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.add('visible');
                         if (cutsceneSkipButton) cutsceneSkipButton.classList.add('visible');
                    }
                }, 100);
            } else {
                console.error(`Cutscene ERROR: Image element ${currentCutsceneImageIndex + 1} not found!`);
                updateCutscene(0); cutsceneTimer = 0; return;
            }
            updateCutsceneText();
        } else {
            initializeAndRunGame();
            if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
        }
    }
}
window.skipCutscene = skipCutscene; // Expose for button
function skipCutscene() {
    if (currentGameState !== GameState.CUTSCENE) return;
    if (cutsceneImages[currentCutsceneImageIndex]) cutsceneImages[currentCutsceneImageIndex].classList.remove('active');
    if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
    if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
    currentCutsceneImageIndex = 0; cutsceneTimer = 0;
    if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
    initializeAndRunGame();
}

async function initializeAndRunGame() {
    if (currentGameState === GameState.RUNNING) {
        console.warn("[main.js] initializeAndRunGame called but game already RUNNING.");
        return;
    }
    if (currentGameState !== GameState.MAIN_MENU && currentGameState !== GameState.CUTSCENE &&
        currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY &&
        currentGameState !== GameState.PAUSED) {
        // console.warn(`[main.js] initializeAndRunGame called from unexpected state: ${currentGameState}. Allowing, but investigate.`);
    }

    try {
        if (!isWorldGenerated) {
            if (!worldGenerationPromise) {
                console.warn("[Main] World generation promise not found. Attempting to start generation now.");
                await performBackgroundWorldGeneration();
            } else {
                console.log("[Main] Waiting for background world generation to finish...");
                await worldGenerationPromise;
            }
            if (!isWorldGenerated) {
                const errorMessage = "World generation did not complete successfully. Cannot start game.";
                console.error(`[Main] ${errorMessage}`);
                if (errorOverlayMessageP) errorOverlayMessageP.textContent = `Error: ${errorMessage}`;
                currentGameState = GameState.ERROR;
                showOverlay(GameState.ERROR);
                return;
            }
            // console.log("[Main] Background world generation confirmed complete. Proceeding with game setup."); // Less verbose
        }

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
            player = null; portal = null;
            console.error("[main.js] FATAL: Game Object Creation/Init Error Message:", error.message);
            // console.error("[main.js] Error Stack:", error.stack); // Can be noisy
            currentGameState = GameState.TITLE; showOverlay(GameState.TITLE);
            if (errorOverlayMessageP) errorOverlayMessageP.textContent = `Error: Could not create game objects. ${error.message}`;
            currentGameState = GameState.ERROR; showOverlay(GameState.ERROR);
            return;
        }

        WaveManager.reset(handleWaveStart, portal);
        // console.log("[main.js] WaveManager reset for new game."); // Less verbose

        calculateInitialCamera();
        isAutoPaused = false;
        isGridVisible = false;
        AudioManager.setVolume('game', Config.AUDIO_DEFAULT_GAME_VOLUME);
        AudioManager.setVolume('sfx', Config.AUDIO_DEFAULT_SFX_VOLUME);
        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());

        // console.log(`[main.js] Transitioning to GameState.RUNNING from ${currentGameState}`); // Less verbose
        currentGameState = GameState.RUNNING;
        hideOverlay();
        gameStartTime = performance.now();
        console.log(">>> [main.js] Game Started <<<");

    } catch (error) {
        console.error("[main.js] FATAL Error during initializeAndRunGame:", error);
        if (errorOverlayMessageP) errorOverlayMessageP.textContent = `Error: ${error.message}`;
        currentGameState = GameState.ERROR;
        showOverlay(GameState.ERROR);
    }
}

function pauseGame() {
    if (currentGameState !== GameState.RUNNING) return;
    console.log(">>> [main.js] Pausing Game <<<");
    currentGameState = GameState.PAUSED;
    showOverlay(GameState.PAUSED);
}
function resumeGame() {
    if (currentGameState !== GameState.PAUSED) return;
    console.log(">>> [main.js] Resuming Game <<<");
    isAutoPaused = false;
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
    if (currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY &&
        currentGameState !== GameState.PAUSED && currentGameState !== GameState.MAIN_MENU) {
        return;
    }
    console.log(">>> [main.js] Restarting Game (Returning to Main Menu) <<<");
    player = null; portal = null;
    UI.setPlayerReference(null); UI.setPortalReference(null);
    EnemyManager.clearAllEnemies(); ItemManager.clearAllItems();
    AudioManager.stopAllMusic();
    cameraX = 0; cameraY = 0; cameraScale = 1.0;
    isAutoPaused = false; isGridVisible = false;
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
    currentCutsceneImageIndex = 0; cutsceneTimer = 0;
    cutsceneImages.forEach(img => img.classList.remove('active'));
    if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
    if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
    worldGenerationPromise = null;
    isWorldGenerated = false;
    showMainMenu();
}

function gameLoop(timestamp) {
    gameLoopId = requestAnimationFrame(gameLoop);
    try {
        let rawDt = (lastTime === 0) ? 0 : (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        rawDt = Math.min(rawDt, Config.MAX_DELTA_TIME);
        let dt = 0;
        if (currentGameState === GameState.RUNNING || currentGameState === GameState.CUTSCENE ||
            (WaveManager.getWaveInfo().state === 'WARPPHASE' && currentGameState !== GameState.PAUSED)) { // WARPPHASE was WARP_ANIMATING
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
            if (portal && portal.isAlive()) portal.update(dt);
            if (player) {
                CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
                CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
                CollisionManager.checkPlayerAttackBlockCollisions(player);
                CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies());
            }
            if (portal && portal.isAlive()) {
                CollisionManager.checkEnemyPortalCollisions(EnemyManager.getEnemies(), portal);
            }
            if ((player && !player.isActive) || (portal && !portal.isAlive())) { // isActive check, not isDying
                handleGameOver();
            } else if (updatedWaveInfo.allWavesCleared) {
                handleVictory();
            }
        } else if (currentGameState === GameState.CUTSCENE) {
            updateCutscene(dt);
        }

        if (dt > 0) WorldManager.update(dt); // Update world animations and water sim

        Renderer.clear();
        const mainCtx = Renderer.getContext();
        const isGameWorldVisible = currentGameState === GameState.RUNNING || currentGameState === GameState.PAUSED ||
                                 currentGameState === GameState.GAME_OVER || currentGameState === GameState.VICTORY ||
                                 (currentGameState === GameState.CUTSCENE || WaveManager.getWaveInfo().state === 'WARPPHASE'); // WARPPHASE was WARP_ANIMATING

        if (isGameWorldVisible && gameWrapperEl && gameWrapperEl.style.display !== 'none') {
            mainCtx.save();
            mainCtx.scale(cameraScale, cameraScale);
            mainCtx.translate(-cameraX, -cameraY);
            WorldManager.draw(mainCtx); // Draws static world canvas + animations
            GridRenderer.drawStaticGrid(mainCtx, isGridVisible);
            ItemManager.draw(mainCtx);
            if (portal) portal.draw(mainCtx);
            EnemyManager.draw(mainCtx);
            if (player && currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY) {
                player.draw(mainCtx);
                const waveInfoAtDraw = WaveManager.getWaveInfo();
                const currentWaveManagerStateAtDraw = waveInfoAtDraw.state;
                const isGameplayActiveAtDraw = ['PRE_WAVE', 'WAVE_COUNTDOWN', 'BUILDPHASE', 'WARPPHASE'].includes(currentWaveManagerStateAtDraw);
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
        if (errorOverlayMessageP && currentGameState !== GameState.ERROR) errorOverlayMessageP.textContent = `Runtime Error: ${error.message}`;
        if (currentGameState !== GameState.ERROR) {
            currentGameState = GameState.ERROR;
            showOverlay(GameState.ERROR);
        }
    }
}

function calculateInitialCamera() {
    if (player && player.isActive) {
        const viewWidth = Config.CANVAS_WIDTH; const viewHeight = Config.CANVAS_HEIGHT;
        cameraScale = 1.0; // Reset scale for initial calculation
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        let targetX = playerCenterX - (visibleWorldWidth / 2);
        let targetY = playerCenterY - (visibleWorldHeight / 2);
        const worldPixelWidthVal = getWorldPixelWidth();
        const worldPixelHeightVal = getWorldPixelHeight();
        const maxCameraX = Math.max(0, worldPixelWidthVal - visibleWorldWidth);
        const maxCameraY = Math.max(0, worldPixelHeightVal - visibleWorldHeight);
        cameraX = Math.max(0, Math.min(targetX, maxCameraX));
        cameraY = Math.max(0, Math.min(targetY, maxCameraY));
        if (worldPixelWidthVal <= visibleWorldWidth) cameraX = (worldPixelWidthVal - visibleWorldWidth) / 2;
        if (worldPixelHeightVal <= visibleWorldHeight) cameraY = (worldPixelHeightVal - visibleWorldHeight) / 2;
    } else {
        cameraX = 0; cameraY = 0; cameraScale = 1.0;
        // console.log("Initial Camera Set: Player not active or not found, defaulting camera to (0,0) @ scale 1.0");
    }
}
function calculateCameraPosition() {
    if (!player || !player.isActive || currentGameState !== GameState.RUNNING) return;
    const viewWidth = Config.CANVAS_WIDTH; const viewHeight = Config.CANVAS_HEIGHT;
    const visibleWorldWidth = viewWidth / cameraScale;
    const visibleWorldHeight = viewHeight / cameraScale;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    let targetX = playerCenterX - (visibleWorldWidth / 2);
    let targetY = playerCenterY - (visibleWorldHeight / 2);
    cameraX = targetX; cameraY = targetY; // For smoother follow, could lerp cameraX/Y towards targetX/Y
    const worldPixelWidthVal = getWorldPixelWidth();
    const worldPixelHeightVal = getWorldPixelHeight();
    const maxCameraX = Math.max(0, worldPixelWidthVal - visibleWorldWidth);
    const maxCameraY = Math.max(0, worldPixelHeightVal - visibleWorldHeight);
    cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
    cameraY = Math.max(0, Math.min(cameraY, maxCameraY)); // Corrected targetY to cameraY
    if (worldPixelWidthVal <= visibleWorldWidth) cameraX = (worldPixelWidthVal - visibleWorldWidth) / 2;
    if (worldPixelHeightVal <= visibleWorldHeight) cameraY = (worldPixelHeightVal - visibleWorldHeight) / 2;
}

function init() {
    currentGameState = GameState.TITLE;
    try {
        appContainer = document.getElementById('app-container');
        bootOverlayEl = document.getElementById('boot-overlay');
        menuOverlayEl = document.getElementById('menu-overlay');
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
        // ... (element existence check as before) ...

        Renderer.init();
        AudioManager.init();
        AgingManager.init();
        if (!UI.initGameUI()) throw new Error("FATAL INIT ERROR: UI initialization failed.");
        Input.init();

        lastTime = 0; isAutoPaused = false; isGridVisible = false;
        currentCutsceneImageIndex = 0; cutsceneTimer = 0;
        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());

        performBackgroundWorldGeneration().catch(err => {
            console.error("Error setting up background world generation promise:", err);
            if (errorOverlayMessageP && currentGameState !== GameState.ERROR) {
                 errorOverlayMessageP.textContent = `Error: Failed to initiate world generation - ${err.message}`;
            }
            if (currentGameState !== GameState.ERROR) {
                currentGameState = GameState.ERROR;
                showOverlay(GameState.ERROR);
            }
        });

        document.addEventListener('visibilitychange', handleVisibilityChange);
        titleStartButton.addEventListener('click', handleTitleStart);
        mainmenuStartGameButton.addEventListener('click', startCutscene);
        mainmenuSettingsButton.addEventListener('click', showSettingsContent);
        settingsBackButton.addEventListener('click', backToMainMenuFromSettings);
        resumeButton.addEventListener('click', resumeGame);
        restartButtonGameOver.addEventListener('click', restartGame);
        restartButtonVictory.addEventListener('click', restartGame);
        restartButtonPause.addEventListener('click', restartGame);
        cutsceneSkipButton.addEventListener('click', skipCutscene);

        showOverlay(GameState.TITLE);
        gameLoopId = requestAnimationFrame(gameLoop);

    } catch (error) {
        console.error("FATAL: Initialization Error:", error);
        if (bootOverlayEl && errorOverlayMessageP) {
            errorOverlayMessageP.textContent = `Error: ${error.message}`;
            currentGameState = GameState.ERROR;
            showOverlay(GameState.ERROR);
        } else {
            alert(`FATAL Initialization Error:\n${error.message}\nCheck console for details.`);
        }
    }
}
function handleVisibilityChange() {
    if (document.hidden && currentGameState === GameState.RUNNING) {
        isAutoPaused = true;
        pauseGame();
    }
}
window.addEventListener('DOMContentLoaded', init);