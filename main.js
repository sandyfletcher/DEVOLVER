// -----------------------------------------------------------------------------
// root/js/main.js - Game Entry Point and Main Loop
// -----------------------------------------------------------------------------

import * as UI from './js/ui.js';
import * as Input from './js/utils/input.js';
import * as Config from './js/utils/config.js';
import * as Renderer from './js/renderer.js';
import * as WaveManager from './js/waveManager.js';
import * as GridRenderer from './js/utils/grid.js';
import * as ItemManager from './js/itemManager.js';
import * as WorldManager from './js/worldManager.js';
import * as EnemyManager from './js/enemyManager.js';
import * as AudioManager from './js/audioManager.js';
import * as AgingManager from './js/agingManager.js';
import * as GridCollision from './js/utils/gridCollision.js';
import * as CollisionManager from './js/collisionManager.js';
import { Player } from './js/player.js';
import { Portal } from './js/portal.js';
import * as World from './js/utils/world.js';


// =============================================================================
// --- Global Variables ---
// =============================================================================

let gameStartTime = 0;
let lastTime = 0;
let gameLoopId = null;
let isAutoPaused = false;
let isGridVisible = false;

let player = null;
let portal = null;
let cameraX = 0;
let cameraY = 0;
let cameraScale = 1.0;

let appContainer = null;
let bootOverlayEl = null;
let menuOverlayEl = null;
let epochOverlayEl = null;

let topSidebarEl = null;
let gameWrapperEl = null;
let bottomSidebarEl = null;

// let cutsceneImages = []; // REMOVED: No longer an array of image elements
let cutsceneImageDisplayEl = null; // NEW: Single image element for cutscene
let currentCutsceneImageIndex = 0;
let cutsceneTimer = 0;
let cutsceneDurationPerImage = Config.CUTSCENE_IMAGE_DURATION;
let cutsceneTextContentEl = null;
let cutsceneTextContainerEl = null;

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
let settingsButtonPauseOverlay = null; 

// Overlay content divs
let overlayTitleContentEl = null;
let overlayErrorContentEl = null;
let overlayMainMenuContentEl = null;
let overlaySettingsContentEl = null;
let overlayCutsceneContentEl = null;
let overlayPauseContentEl = null;
let overlayGameOverContentEl = null;
let overlayVictoryContentEl = null;

let gameOverStatsTextP = null;
let victoryStatsTextP = null;
let errorOverlayMessageP = null;

const GameState = Object.freeze({
    TITLE: 'TITLE',
    MAIN_MENU: 'MAIN_MENU',
    SETTINGS: 'SETTINGS', 
    CUTSCENE: 'CUTSCENE',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY',
    ERROR: 'ERROR'
});
let currentGameState = GameState.TITLE;
let settingsOpenedFrom = null; 


let worldGenerationPromise = null;
let isWorldGenerated = false;

// =============================================================================
// --- Helper Functions ---
// =============================================================================

function getWorldPixelWidth() { return Config.CANVAS_WIDTH; }
function getWorldPixelHeight() { return Config.GRID_ROWS * Config.BLOCK_HEIGHT; }
window.pauseGameCallback = pauseGame;
window.updateCameraScale = function(deltaScale) {
    if (currentGameState !== GameState.RUNNING && currentGameState !== GameState.PAUSED) {
        return;
    }
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
    // console.log(`Triggered by WaveManager - Starting Wave ${waveNumber}`);
}
window.toggleGridDisplay = toggleGridDisplay;
function toggleGridDisplay() {
    isGridVisible = !isGridVisible;
    // console.log(`Main: Grid display is now ${isGridVisible ? 'ON' : 'OFF'}.`);
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
}
window.toggleMusicMute = toggleMusicMute;
function toggleMusicMute() {
    const newState = AudioManager.toggleMusicMute();
    // console.log(`Main: Music is now ${newState ? 'muted' : 'unmuted'}.`);
    UI.updateSettingsButtonStates(isGridVisible, newState, AudioManager.getSfxMutedState());
}
window.toggleSfxMute = toggleSfxMute;
function toggleSfxMute() {
    const newState = AudioManager.toggleSfxMute();
    // console.log(`Main: SFX is now ${newState ? 'muted' : 'unmuted'}.`);
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), newState);
}


async function performBackgroundWorldGeneration() {
    if (worldGenerationPromise && isWorldGenerated) {
        return;
    }
    if (worldGenerationPromise && !isWorldGenerated) {
        return worldGenerationPromise;
    }
    isWorldGenerated = false;
    worldGenerationPromise = (async () => {
        try {
            WorldManager.executeInitialWorldGenerationSequence();
            const initialAgingPasses = Config.AGING_INITIAL_PASSES ?? 1;
            for (let i = 0; i < initialAgingPasses; i++) {
                WorldManager.applyLightingPass();
                AgingManager.applyAging(null);
            }
            if (!Renderer.getGridCanvas()) {
                Renderer.createGridCanvas();
            }
            WorldManager.renderStaticWorldToGridCanvas();
            WorldManager.seedWaterUpdateQueue();
            isWorldGenerated = true;
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

    // --- 1. Resetting Classes and Visibility ---
    bootOverlayEl.className = ''; 
    menuOverlayEl.className = ''; 
    appContainer.classList.remove('overlay-active'); 

    const allContentDivs = [
        overlayTitleContentEl, overlayErrorContentEl, overlayMainMenuContentEl,
        overlaySettingsContentEl, overlayCutsceneContentEl, overlayPauseContentEl,
        overlayGameOverContentEl, overlayVictoryContentEl
    ];
    allContentDivs.forEach(div => { if (div) div.style.display = 'none'; });

    topSidebarEl.style.display = '';
    gameWrapperEl.style.display = '';
    bottomSidebarEl.style.display = '';

    // --- 2. Handle Cutscene Specific Cleanup (if not showing cutscene) ---
    if (stateToShow !== GameState.CUTSCENE) {
        if (cutsceneImageDisplayEl) { // Check the single image display element
            cutsceneImageDisplayEl.classList.remove('active');
            cutsceneImageDisplayEl.src = ""; // Clear src
        }
        if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
        if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
        if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
    }

    // --- 3. Configure Overlay Based on `stateToShow` ---
    switch (stateToShow) {
        case GameState.TITLE:
            topSidebarEl.style.display = 'none'; gameWrapperEl.style.display = 'none'; bottomSidebarEl.style.display = 'none';
            bootOverlayEl.classList.add('show-title');
            if (overlayTitleContentEl) overlayTitleContentEl.style.display = 'flex';
            AudioManager.stopAllMusic();
            break;

        case GameState.MAIN_MENU:
            topSidebarEl.style.display = 'none'; gameWrapperEl.style.display = 'none'; bottomSidebarEl.style.display = 'none';
            menuOverlayEl.classList.add('active', 'show-mainmenu', 'force-opaque');
            if (overlayMainMenuContentEl) overlayMainMenuContentEl.style.display = 'flex';
            AudioManager.stopGameMusic(); AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.pause) AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            break;

        case GameState.SETTINGS: 
            menuOverlayEl.classList.add('active', 'show-settings');
            if (overlaySettingsContentEl) overlaySettingsContentEl.style.display = 'flex';
            if (settingsOpenedFrom === GameState.PAUSED) {
                appContainer.classList.add('overlay-active');
            } else { 
                menuOverlayEl.classList.add('force-opaque');
                topSidebarEl.style.display = 'none'; gameWrapperEl.style.display = 'none'; bottomSidebarEl.style.display = 'none';
            }
            break;

        case GameState.CUTSCENE:
            menuOverlayEl.classList.add('active', 'show-cutscene');
            if (overlayCutsceneContentEl) overlayCutsceneContentEl.style.display = 'flex';
            appContainer.classList.add('overlay-active'); 
            AudioManager.stopUIMusic(); AudioManager.stopGameMusic();
            if (cutsceneImageDisplayEl) { // Prepare single image display
                cutsceneImageDisplayEl.src = '';
                cutsceneImageDisplayEl.classList.remove('active');
            }
            if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = ''; 
            break;

        case GameState.PAUSED:
            menuOverlayEl.classList.add('active', 'show-pause');
            if (overlayPauseContentEl) overlayPauseContentEl.style.display = 'flex';
            appContainer.classList.add('overlay-active');
            AudioManager.pauseGameMusic(); AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.pause) AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            break;

        case GameState.GAME_OVER:
            menuOverlayEl.classList.add('active', 'show-gameover');
            if (overlayGameOverContentEl) overlayGameOverContentEl.style.display = 'flex';
            appContainer.classList.add('overlay-active');
            AudioManager.stopGameMusic();
            if (gameOverStatsTextP && WaveManager) gameOverStatsTextP.textContent = `You reached Wave ${WaveManager.getCurrentWaveNumber()}!`;
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.gameOver) AudioManager.playUIMusic(Config.AUDIO_TRACKS.gameOver);
            else if (Config.AUDIO_TRACKS.pause) AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            break;

        case GameState.VICTORY:
            menuOverlayEl.classList.add('active', 'show-victory');
            if (overlayVictoryContentEl) overlayVictoryContentEl.style.display = 'flex';
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
            if (overlayErrorContentEl) overlayErrorContentEl.style.display = 'flex';
            AudioManager.stopAllMusic();
            break;

        default:
            console.warn(`ShowOverlay: Unknown state requested: ${stateToShow}. Defaulting to TITLE.`);
            topSidebarEl.style.display = 'none'; gameWrapperEl.style.display = 'none'; bottomSidebarEl.style.display = 'none';
            bootOverlayEl.classList.add('show-title');
            if (overlayTitleContentEl) overlayTitleContentEl.style.display = 'flex';
            AudioManager.stopAllMusic();
            break;
    }
}


function hideAllOverlays() { 
    if (!bootOverlayEl || !menuOverlayEl || !appContainer) return;
    bootOverlayEl.className = '';
    menuOverlayEl.className = '';
    appContainer.classList.remove('overlay-active');

    const allContentDivs = [
        overlayTitleContentEl, overlayErrorContentEl, overlayMainMenuContentEl,
        overlaySettingsContentEl, overlayCutsceneContentEl, overlayPauseContentEl,
        overlayGameOverContentEl, overlayVictoryContentEl
    ];
    allContentDivs.forEach(div => { if (div) div.style.display = 'none'; });

    topSidebarEl.style.display = '';
    gameWrapperEl.style.display = '';
    bottomSidebarEl.style.display = '';
}

// =============================================================================
// --- Game State Control Functions ---
// =============================================================================

function handleTitleStart() {
    currentGameState = GameState.MAIN_MENU;
    showOverlay(GameState.MAIN_MENU);
}

function openSettingsFromMainMenu() {
    settingsOpenedFrom = GameState.MAIN_MENU;
    currentGameState = GameState.SETTINGS;
    showOverlay(GameState.SETTINGS);
}

function openSettingsFromPause() {
    settingsOpenedFrom = GameState.PAUSED;
    currentGameState = GameState.SETTINGS; 
    showOverlay(GameState.SETTINGS); 
}

function closeSettings() {
    if (settingsOpenedFrom === GameState.MAIN_MENU) {
        currentGameState = GameState.MAIN_MENU;
        showOverlay(GameState.MAIN_MENU);
    } else if (settingsOpenedFrom === GameState.PAUSED) {
        currentGameState = GameState.PAUSED;
        showOverlay(GameState.PAUSED); 
    }
    settingsOpenedFrom = null;
}

function startCutscene() {
    currentGameState = GameState.CUTSCENE;
    showOverlay(GameState.CUTSCENE); // This prepares the overlay and elements

    currentCutsceneImageIndex = 0;
    cutsceneTimer = cutsceneDurationPerImage; // Use the existing config for duration per image

    // UPDATED: Check the new CUTSCENE_SLIDES array
    if (!Config.CUTSCENE_SLIDES || Config.CUTSCENE_SLIDES.length === 0) {
        console.warn("Cutscene: No slides defined in Config.CUTSCENE_SLIDES. Skipping cutscene.");
        initializeAndRunGame();
        return;
    }

    // UPDATED: Access data from the first slide
    if (currentCutsceneImageIndex < Config.CUTSCENE_SLIDES.length) {
        const currentSlide = Config.CUTSCENE_SLIDES[currentCutsceneImageIndex];

        if (!currentSlide || typeof currentSlide.imagePath !== 'string' || typeof currentSlide.text !== 'string') {
            console.error("Cutscene ERROR: Invalid slide data for index " + currentCutsceneImageIndex + ". Skipping.");
            initializeAndRunGame();
            return;
        }

        if (cutsceneImageDisplayEl) {
            cutsceneImageDisplayEl.src = currentSlide.imagePath;
            cutsceneImageDisplayEl.alt = `Cutscene Image ${currentCutsceneImageIndex + 1}`;
            cutsceneImageDisplayEl.classList.add('active');
        }

        if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = currentSlide.text || '';

        setTimeout(() => {
            if (currentGameState === GameState.CUTSCENE) {
                if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.add('visible');
                if (cutsceneSkipButton) cutsceneSkipButton.classList.add('visible');
            }
        }, 100);
    } else {
        console.error("Cutscene ERROR: Initial index out of bounds (should not happen if length > 0). Skipping.");
        initializeAndRunGame();
    }
}

function updateCutscene(dt) {
    if (currentGameState !== GameState.CUTSCENE) return;
    cutsceneTimer -= dt;

    if (cutsceneTimer <= 0) {
        if (cutsceneImageDisplayEl) cutsceneImageDisplayEl.classList.remove('active');
        if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
        // If skip button is separate, hide it too: if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
        // (Currently skip button visibility is tied to text container's logic or overall cutscene display)

        currentCutsceneImageIndex++;

        // UPDATED: Check against CUTSCENE_SLIDES.length
        if (currentCutsceneImageIndex < Config.CUTSCENE_SLIDES.length) {
            cutsceneTimer = cutsceneDurationPerImage;

            setTimeout(() => {
                if (currentGameState !== GameState.CUTSCENE) return;

                // UPDATED: Access data from the next slide
                const nextSlide = Config.CUTSCENE_SLIDES[currentCutsceneImageIndex];

                if (!nextSlide || typeof nextSlide.imagePath !== 'string' || typeof nextSlide.text !== 'string') {
                    console.error("Cutscene Update: Invalid next slide data for index " + currentCutsceneImageIndex + ". Ending cutscene.");
                    if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
                     if (cutsceneImageDisplayEl) {
                         cutsceneImageDisplayEl.src = '';
                         cutsceneImageDisplayEl.classList.remove('active');
                     }
                    initializeAndRunGame();
                    return;
                }

                if (cutsceneImageDisplayEl) {
                    cutsceneImageDisplayEl.src = nextSlide.imagePath;
                    cutsceneImageDisplayEl.alt = `Cutscene Image ${currentCutsceneImageIndex + 1}`;
                    cutsceneImageDisplayEl.classList.add('active');
                }

                if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = nextSlide.text || '';

                if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.add('visible');
                if (cutsceneSkipButton && cutsceneTextContainerEl && !cutsceneTextContainerEl.contains(cutsceneSkipButton)) {
                     cutsceneSkipButton.classList.add('visible');
                }

            }, 1000); // Delay for image fade-out

        } else {
            // Cutscene finished
            if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
            if (cutsceneImageDisplayEl) {
                cutsceneImageDisplayEl.src = '';
                cutsceneImageDisplayEl.classList.remove('active');
            }
            initializeAndRunGame();
        }
    }
}

window.skipCutscene = skipCutscene;
function skipCutscene() {
    if (currentGameState !== GameState.CUTSCENE) return;

    if (cutsceneImageDisplayEl) {
        cutsceneImageDisplayEl.classList.remove('active');
        cutsceneImageDisplayEl.src = ''; 
    }
    if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
    if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible'); 

    currentCutsceneImageIndex = 0; cutsceneTimer = 0; 
    if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';

    initializeAndRunGame();
}

async function initializeAndRunGame() {
    // console.log(`[Main] Attempting to initialize and run game from state: ${currentGameState}`);
    if (currentGameState === GameState.RUNNING) {
        // console.warn("[main.js] initializeAndRunGame called but game already RUNNING.");
        return;
    }

    try {
        if (!isWorldGenerated) {
            if (!worldGenerationPromise) {
                // console.warn("[Main] World generation promise not found. Attempting to start generation now.");
                await performBackgroundWorldGeneration();
            } else {
                // console.log("[Main] Waiting for background world generation to finish...");
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
            player.reset(); 
            UI.setPlayerReference(player);
            UI.setPortalReference(portal);
        } catch (error) {
            player = null; portal = null;
            console.error("[main.js] FATAL: Game Object Creation/Init Error Message:", error.message);
            currentGameState = GameState.TITLE; showOverlay(GameState.TITLE);
            if (errorOverlayMessageP) errorOverlayMessageP.textContent = `Error: Could not create game objects. ${error.message}`;
            currentGameState = GameState.ERROR; showOverlay(GameState.ERROR);
            return;
        }

        WaveManager.reset(handleWaveStart, portal);
        calculateInitialCamera();
        isAutoPaused = false;
        isGridVisible = false; 
        AudioManager.setVolume('game', Config.AUDIO_DEFAULT_GAME_VOLUME);
        AudioManager.setVolume('sfx', Config.AUDIO_DEFAULT_SFX_VOLUME);
        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());

        currentGameState = GameState.RUNNING;
        hideAllOverlays(); 
        gameStartTime = performance.now();
        // console.log(">>> [main.js] Game Started <<<");

    } catch (error) {
        console.error("[main.js] FATAL Error during initializeAndRunGame:", error);
        if (errorOverlayMessageP) errorOverlayMessageP.textContent = `Error: ${error.message}`;
        currentGameState = GameState.ERROR;
        showOverlay(GameState.ERROR);
    }
}

function pauseGame() {
    if (currentGameState !== GameState.RUNNING) return;
    // console.log(">>> [main.js] Pausing Game <<<");
    currentGameState = GameState.PAUSED;
    settingsOpenedFrom = null; 
    showOverlay(GameState.PAUSED);
}
function resumeGame() {
    if (currentGameState !== GameState.PAUSED) return;
    // console.log(">>> [main.js] Resuming Game <<<");
    isAutoPaused = false;
    currentGameState = GameState.RUNNING;
    hideAllOverlays();
    AudioManager.unpauseGameMusic();
}
function handleGameOver() {
    if (currentGameState === GameState.GAME_OVER) return;
    // console.log(">>> [main.js] Handling Game Over <<<");
    currentGameState = GameState.GAME_OVER;
    WaveManager.setGameOver();
    EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
    ItemManager.clearItemsOutsideRadius(0, 0, Infinity);
    showOverlay(GameState.GAME_OVER);
    isAutoPaused = false;
}
function handleVictory() {
    if (currentGameState === GameState.VICTORY) return;
    // console.log(">>> [main.js] Handling Victory! <<<");
    currentGameState = GameState.VICTORY;
    WaveManager.setVictory();
    EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
    ItemManager.clearItemsOutsideRadius(0, 0, Infinity);
    showOverlay(GameState.VICTORY);
    isAutoPaused = false;
}
function restartGame() { 
    // console.log(">>> [main.js] Restarting Game (Returning to Main Menu) <<<");
    player = null; portal = null;
    UI.setPlayerReference(null); UI.setPortalReference(null);
    EnemyManager.clearAllEnemies(); ItemManager.clearAllItems();
    AudioManager.stopAllMusic();
    cameraX = 0; cameraY = 0; cameraScale = 1.0;
    isAutoPaused = false; isGridVisible = false;
    settingsOpenedFrom = null;
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
    
    currentCutsceneImageIndex = 0; cutsceneTimer = 0;
    if (cutsceneImageDisplayEl) { // Clear single image display
        cutsceneImageDisplayEl.src = '';
        cutsceneImageDisplayEl.classList.remove('active');
    }
    if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
    if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
    
    worldGenerationPromise = null;
    isWorldGenerated = false;

    currentGameState = GameState.MAIN_MENU; 
    showOverlay(GameState.MAIN_MENU);       
}

function gameLoop(timestamp) {
    gameLoopId = requestAnimationFrame(gameLoop);
    try {
        let rawDt = (lastTime === 0) ? 0 : (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        rawDt = Math.min(rawDt, Config.MAX_DELTA_TIME);
        let dt = 0;
        if (currentGameState === GameState.RUNNING || currentGameState === GameState.CUTSCENE ||
            (WaveManager.getWaveInfo().state === 'WARP_ANIMATING' && currentGameState !== GameState.PAUSED)) {
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
            if ((player && !player.isActive) || (portal && !portal.isAlive())) {
                handleGameOver();
            } else if (updatedWaveInfo.allWavesCleared) {
                handleVictory();
            }
        } else if (currentGameState === GameState.CUTSCENE) {
            updateCutscene(dt);
        }

        if (dt > 0) WorldManager.update(dt);

        Renderer.clear();
        const mainCtx = Renderer.getContext();
        const isGameWorldVisible = currentGameState === GameState.RUNNING || currentGameState === GameState.PAUSED ||
                                 currentGameState === GameState.GAME_OVER || currentGameState === GameState.VICTORY ||
                                 (currentGameState === GameState.CUTSCENE && WaveManager.getWaveInfo().state !== 'PRE_WAVE') || 
                                 (WaveManager.getWaveInfo().state === 'WARP_ANIMATING');


        if (isGameWorldVisible && gameWrapperEl && gameWrapperEl.style.display !== 'none') {
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
                const isGameplayActiveAtDraw = ['WAVE_COUNTDOWN', 'BUILDPHASE', 'WARP_ANIMATING'].includes(currentWaveManagerStateAtDraw);

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
        cameraScale = 1.0;
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
    cameraX = targetX; cameraY = targetY;
    const worldPixelWidthVal = getWorldPixelWidth();
    const worldPixelHeightVal = getWorldPixelHeight();
    const maxCameraX = Math.max(0, worldPixelWidthVal - visibleWorldWidth);
    const maxCameraY = Math.max(0, worldPixelHeightVal - visibleWorldHeight);
    cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
    cameraY = Math.max(0, Math.min(cameraY, maxCameraY));
    if (worldPixelWidthVal <= visibleWorldWidth) cameraX = (worldPixelWidthVal - visibleWorldWidth) / 2;
    if (worldPixelHeightVal <= visibleWorldHeight) cameraY = (worldPixelHeightVal - visibleWorldHeight) / 2;
}

function init() {
    currentGameState = GameState.TITLE;
    let success = true;
    try {
        appContainer = document.getElementById('app-container');
        bootOverlayEl = document.getElementById('boot-overlay');
        menuOverlayEl = document.getElementById('menu-overlay');
        topSidebarEl = document.getElementById('top-sidebar');
        gameWrapperEl = document.getElementById('game-wrapper');
        bottomSidebarEl = document.getElementById('bottom-sidebar');

        overlayTitleContentEl = document.getElementById('overlay-title-content');
        overlayErrorContentEl = document.getElementById('overlay-error-content');
        overlayMainMenuContentEl = document.getElementById('overlay-mainmenu-content');
        overlaySettingsContentEl = document.getElementById('overlay-settings-content');
        overlayCutsceneContentEl = document.getElementById('overlay-cutscene-content');
        overlayPauseContentEl = document.getElementById('overlay-pause-content');
        overlayGameOverContentEl = document.getElementById('overlay-gameover-content');
        overlayVictoryContentEl = document.getElementById('overlay-victory-content');

        titleStartButton = document.getElementById('start-game-button');
        mainmenuStartGameButton = document.getElementById('mainmenu-start-game-button');
        mainmenuSettingsButton = document.getElementById('mainmenu-settings-button');
        settingsBackButton = document.getElementById('settings-back-button');
        settingsButtonPauseOverlay = document.getElementById('settings-button-overlay-pause'); 
        resumeButton = document.getElementById('resume-button');
        restartButtonGameOver = document.getElementById('restart-button-overlay');
        restartButtonVictory = document.getElementById('restart-button-overlay-victory');
        restartButtonPause = document.getElementById('restart-button-overlay-pause');
        gameOverStatsTextP = document.getElementById('gameover-stats-text');
        victoryStatsTextP = document.getElementById('victory-stats-text');
        errorOverlayMessageP = document.getElementById('error-message-text');
        
        // Cutscene elements
        cutsceneImageDisplayEl = document.getElementById('cutscene-image-display'); // NEW
        cutsceneSkipButton = document.getElementById('cutscene-skip-button');
        cutsceneTextContentEl = document.getElementById('cutscene-text-content');
        cutsceneTextContainerEl = document.getElementById('cutscene-text-box');
        
        btnToggleGrid = document.getElementById('settings-btn-toggle-grid'); 
        muteMusicButtonEl = document.getElementById('settings-btn-mute-music');
        muteSfxButtonEl = document.getElementById('settings-btn-mute-sfx');
        epochOverlayEl = document.getElementById('epoch-overlay');


        const requiredCoreElements = [appContainer, bootOverlayEl, menuOverlayEl, topSidebarEl, gameWrapperEl, bottomSidebarEl, epochOverlayEl];
        const requiredContentElements = [
            overlayTitleContentEl, overlayErrorContentEl, overlayMainMenuContentEl, overlaySettingsContentEl,
            overlayCutsceneContentEl, overlayPauseContentEl, overlayGameOverContentEl, overlayVictoryContentEl
        ];
        const requiredButtonElements = [
            titleStartButton, mainmenuStartGameButton, mainmenuSettingsButton, settingsBackButton, settingsButtonPauseOverlay,
            resumeButton, restartButtonGameOver, restartButtonVictory, restartButtonPause, cutsceneSkipButton,
            btnToggleGrid, muteMusicButtonEl, muteSfxButtonEl
        ];
        // Updated requiredTextElements to include the single cutscene image display
        const requiredTextElements = [gameOverStatsTextP, victoryStatsTextP, errorOverlayMessageP, cutsceneTextContentEl, cutsceneTextContainerEl, cutsceneImageDisplayEl];

        [...requiredCoreElements, ...requiredContentElements, ...requiredButtonElements, ...requiredTextElements].forEach(el => {
            if (!el) {
                const varName = Object.keys(window).find(key => window[key] === el) || 
                                Object.keys(this).find(key => this[key] === el) ||    
                                "an unknown element (check init())";                  
                console.error(`FATAL INIT ERROR: UI Element "${varName}" (or one by its ID) not found in HTML.`);
                success = false;
            }
        });
        if (!success) throw new Error("One or more critical UI elements are missing from the HTML.");


        Renderer.init();
        AudioManager.init();
        AgingManager.init();
        if (!UI.initGameUI()) throw new Error("FATAL INIT ERROR: UI.initGameUI() failed.");
        Input.init();

        lastTime = 0; isAutoPaused = false; isGridVisible = false;
        currentCutsceneImageIndex = 0; cutsceneTimer = 0;
        settingsOpenedFrom = null;
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
        mainmenuSettingsButton.addEventListener('click', openSettingsFromMainMenu);
        settingsButtonPauseOverlay.addEventListener('click', openSettingsFromPause); 
        settingsBackButton.addEventListener('click', closeSettings);                
        resumeButton.addEventListener('click', resumeGame);
        restartButtonGameOver.addEventListener('click', restartGame);
        restartButtonVictory.addEventListener('click', restartGame);
        restartButtonPause.addEventListener('click', restartGame);
        cutsceneSkipButton.addEventListener('click', skipCutscene);
        showOverlay(GameState.TITLE);
        gameLoopId = requestAnimationFrame(gameLoop);
    } catch (error) {
        console.error("FATAL: Initialization Error:", error);
        if (bootOverlayEl && errorOverlayMessageP && currentGameState !== GameState.ERROR) {
            errorOverlayMessageP.textContent = `Initialization Error: ${error.message}. Check console.`;
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