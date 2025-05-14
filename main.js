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
import * as CollisionManager from './js/collisionManager.js';
import * as FlowManager from './js/flowManager.js';
import { Player } from './js/player.js';
import { Portal } from './js/portal.js';
// World and GridCollision are used by Renderer now for coordinate conversion too

let gameStartTime = 0;
let lastTime = 0;
let gameLoopId = null;
let isAutoPaused = false; // Remains in main.js for visibilitychange
let isGridVisible = false; // Remains in main.js for settings UI toggle
let player = null;
let portal = null;

// DOM Element references for FlowManager and UI
let appContainerEl, bootOverlayEl, menuOverlayEl, gameWrapperEl, epochOverlayEl;
let overlayTitleContentEl, overlayErrorContentEl, overlayMainMenuContentEl;
let overlaySettingsContentEl, overlayCutsceneContentEl, overlayPauseContentEl;
let overlayGameOverContentEl, overlayVictoryContentEl;
let cutsceneImageDisplayEl, cutsceneTextContentEl, cutsceneTextContainerEl, cutsceneSkipButton;
let gameOverStatsTextP, victoryStatsTextP, errorOverlayMessageP;

// Button references for event listeners
let titleStartButton, mainmenuStartGameButton, mainmenuSettingsButton, settingsBackButton;
let resumeButton, restartButtonGameOver, restartButtonVictory, restartButtonPause;
let btnToggleGridEl, muteMusicButtonEl, muteSfxButtonEl, settingsButtonPauseOverlayEl;

let worldGenerationPromise = null;
let isWorldGenerated = false;

// Make GameState accessible if needed by main logic directly (e.g. Renderer conditional drawing)
const GameState = FlowManager.GameState;


// --- Global Functions for HTML Event Handlers & Renderer ---
window.pauseGameCallback = () => FlowManager.pauseGame(); // Delegate to FlowManager
window.updateCameraScale = (deltaScale) => { // Delegate to Renderer
    const currentGameState = FlowManager.getCurrentState();
    if (currentGameState !== GameState.RUNNING && currentGameState !== GameState.PAUSED) {
        return;
    }
    Renderer.updateCameraScale(deltaScale);
};
window.skipCutscene = () => FlowManager.skipCutscene(); // Delegate

// Settings Toggles (remain in main.js for now, tightly coupled with isGridVisible)
function toggleGridDisplay() {
    isGridVisible = !isGridVisible;
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());
}
window.toggleGridDisplay = toggleGridDisplay;

function toggleMusicMute() {
    const newState = AudioManager.toggleMusicMute();
    UI.updateSettingsButtonStates(isGridVisible, newState, AudioManager.getSfxMutedState());
}
window.toggleMusicMute = toggleMusicMute;

function toggleSfxMute() {
    const newState = AudioManager.toggleSfxMute();
    UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), newState);
}
window.toggleSfxMute = toggleSfxMute;


async function performBackgroundWorldGeneration() {
    if (worldGenerationPromise && isWorldGenerated) return;
    if (worldGenerationPromise && !isWorldGenerated) return worldGenerationPromise;

    isWorldGenerated = false;
    worldGenerationPromise = (async () => {
        try {
            WorldManager.executeInitialWorldGenerationSequence();
            const initialAgingPasses = Config.AGING_INITIAL_PASSES ?? 1;
            for (let i = 0; i < initialAgingPasses; i++) {
                WorldManager.applyLightingPass();
                AgingManager.applyAging(null);
            }
            if (!Renderer.getGridCanvas()) Renderer.createGridCanvas();
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

function handleWaveStart(waveNumber) {
    // console.log(`Triggered by WaveManager - Starting Wave ${waveNumber}`);
}

async function initializeAndRunGame() {
    const currentGameState = FlowManager.getCurrentState();
    if (currentGameState === GameState.RUNNING) {
        console.warn("[main.js] initializeAndRunGame called but game already RUNNING.");
        return;
    }

    try {
        if (!isWorldGenerated) {
            if (!worldGenerationPromise) {
                console.warn("[Main] World generation promise not found. Starting now.");
                await performBackgroundWorldGeneration();
            } else {
                await worldGenerationPromise;
            }
            if (!isWorldGenerated) {
                const errorMessage = "World generation did not complete successfully. Cannot start game.";
                console.error(`[Main] ${errorMessage}`);
                FlowManager.changeState(GameState.ERROR, { errorMessage });
                return;
            }
        }

        UI.setPlayerReference(null);
        UI.setPortalReference(null);

        const portalSpawnX = Config.CANVAS_WIDTH / 2 - Config.PORTAL_WIDTH / 2;
        const portalSpawnY = (Config.MEAN_GROUND_LEVEL * Config.BLOCK_HEIGHT) - Config.PORTAL_HEIGHT - (Config.PORTAL_SPAWN_Y_OFFSET_BLOCKS * Config.BLOCK_HEIGHT);
        portal = new Portal(portalSpawnX, portalSpawnY);

        ItemManager.init();
        EnemyManager.init();

        const playerSpawnX = Config.PLAYER_START_X;
        const playerSpawnY = Config.PLAYER_START_Y;
        player = new Player(playerSpawnX, playerSpawnY, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
        player.reset();
        UI.setPlayerReference(player);
        UI.setPortalReference(portal);


        WaveManager.reset(handleWaveStart, portal);
        Renderer.calculateInitialCamera(player);
        isAutoPaused = false;
        // isGridVisible is managed by its toggle function

        AudioManager.setVolume('game', Config.AUDIO_DEFAULT_GAME_VOLUME);
        AudioManager.setVolume('sfx', Config.AUDIO_DEFAULT_SFX_VOLUME);
        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());

        // Crucially, FlowManager changes state to RUNNING *after* setup
        FlowManager.changeState(GameState.RUNNING);
        gameStartTime = performance.now();
        console.log(">>> [main.js] Game Started <<<");

    } catch (error) {
        console.error("[main.js] FATAL Error during initializeAndRunGame:", error);
        FlowManager.changeState(GameState.ERROR, { errorMessage: error.message });
    }
}


function fullGameResetAndShowMenu() {
    console.log("[Main] Performing full game reset and returning to Main Menu.");
    player = null; portal = null;
    UI.setPlayerReference(null); UI.setPortalReference(null); // UI still needs to be cleared
    EnemyManager.clearAllEnemies(); ItemManager.clearAllItems();
    AudioManager.stopAllMusic();
    isAutoPaused = false; // isGridVisible state persists unless explicitly reset
    worldGenerationPromise = null; // Reset world generation state for next game start
    isWorldGenerated = false;

    FlowManager.changeState(GameState.MAIN_MENU);
}


function gameLoop(timestamp) {
    gameLoopId = requestAnimationFrame(gameLoop);
    try {
        let rawDt = (lastTime === 0) ? 0 : (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        rawDt = Math.min(rawDt, Config.MAX_DELTA_TIME);
        let dt = 0;

        const currentGameState = FlowManager.getCurrentState();

        if (currentGameState === GameState.RUNNING || currentGameState === GameState.CUTSCENE ||
            (WaveManager.getWaveInfo().state === 'WARP_ANIMATING' && currentGameState !== GameState.PAUSED)) {
            dt = rawDt;
        }

        if (currentGameState === GameState.RUNNING) {
            WaveManager.update(dt, currentGameState); // Pass currentGameState for conditional updates
            const updatedWaveInfo = WaveManager.getWaveInfo();

            if (player) {
                const inputState = Input.getState();
                const internalMousePos = Input.getMousePosition();
                const targetWorldPos = Renderer.getMouseWorldCoords(internalMousePos);
                const targetGridCell = Renderer.getMouseGridCoords(internalMousePos);
                player.update(dt, inputState, targetWorldPos, targetGridCell);
            }

            Renderer.calculateCameraPosition(player, currentGameState === GameState.RUNNING);

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
                WaveManager.setGameOver(); // Inform WaveManager
                EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
                ItemManager.clearItemsOutsideRadius(0, 0, Infinity);
                FlowManager.handleGameOver(); // Let FlowManager handle state change and UI
                isAutoPaused = false;
            } else if (updatedWaveInfo.allWavesCleared) {
                WaveManager.setVictory(); // Inform WaveManager
                EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
                ItemManager.clearItemsOutsideRadius(0, 0, Infinity);
                FlowManager.handleVictory(); // Let FlowManager handle state change and UI
                isAutoPaused = false;
            }
        } else if (currentGameState === GameState.CUTSCENE) {
            FlowManager.updateCutscene(dt);
        }

        if (dt > 0) WorldManager.update(dt); // World simulation (water, gravity anims) runs even if paused if dt > 0

        Renderer.clear();
        const mainCtx = Renderer.getContext();

        const isGameWorldVisible = currentGameState === GameState.RUNNING || currentGameState === GameState.PAUSED ||
                                 currentGameState === GameState.GAME_OVER || currentGameState === GameState.VICTORY ||
                                 (currentGameState === GameState.CUTSCENE && WaveManager.getWaveInfo().state !== 'PRE_WAVE') ||
                                 (WaveManager.getWaveInfo().state === 'WARP_ANIMATING');


        if (isGameWorldVisible && gameWrapperEl && gameWrapperEl.style.display !== 'none') {
            Renderer.applyCameraTransforms(mainCtx); // Use Renderer's method

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
            Renderer.restoreCameraTransforms(mainCtx);
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
        if (FlowManager.getCurrentState() !== GameState.ERROR) {
            FlowManager.changeState(GameState.ERROR, { errorMessage: `Runtime Error: ${error.message}` });
        }
    }
}


function init() {
    let success = true;
    try {
        // Query DOM elements needed by FlowManager and main.js
        appContainerEl = document.getElementById('app-container');
        bootOverlayEl = document.getElementById('boot-overlay');
        menuOverlayEl = document.getElementById('menu-overlay');
        gameWrapperEl = document.getElementById('game-wrapper');
        epochOverlayEl = document.getElementById('epoch-overlay');
        overlayTitleContentEl = document.getElementById('overlay-title-content');
        overlayErrorContentEl = document.getElementById('overlay-error-content');
        overlayMainMenuContentEl = document.getElementById('overlay-mainmenu-content');
        overlaySettingsContentEl = document.getElementById('overlay-settings-content');
        overlayCutsceneContentEl = document.getElementById('overlay-cutscene-content');
        overlayPauseContentEl = document.getElementById('overlay-pause-content');
        overlayGameOverContentEl = document.getElementById('overlay-gameover-content');
        overlayVictoryContentEl = document.getElementById('overlay-victory-content');
        cutsceneImageDisplayEl = document.getElementById('cutscene-image-display');
        cutsceneTextContentEl = document.getElementById('cutscene-text-content');
        cutsceneTextContainerEl = document.getElementById('cutscene-text-box');
        cutsceneSkipButton = document.getElementById('cutscene-skip-button');
        gameOverStatsTextP = document.getElementById('gameover-stats-text');
        victoryStatsTextP = document.getElementById('victory-stats-text');
        errorOverlayMessageP = document.getElementById('error-message-text');

        // Query Button elements
        titleStartButton = document.getElementById('start-game-button');
        mainmenuStartGameButton = document.getElementById('mainmenu-start-game-button');
        mainmenuSettingsButton = document.getElementById('mainmenu-settings-button');
        settingsBackButton = document.getElementById('settings-back-button');
        settingsButtonPauseOverlayEl = document.getElementById('settings-button-overlay-pause');
        resumeButton = document.getElementById('resume-button');
        restartButtonGameOver = document.getElementById('restart-button-overlay');
        restartButtonVictory = document.getElementById('restart-button-overlay-victory');
        restartButtonPause = document.getElementById('restart-button-overlay-pause');
        btnToggleGridEl = document.getElementById('settings-btn-toggle-grid'); // Used by UI.js for updates
        muteMusicButtonEl = document.getElementById('settings-btn-mute-music'); // Used by UI.js for updates
        muteSfxButtonEl = document.getElementById('settings-btn-mute-sfx');     // Used by UI.js for updates

        // Verify all queried elements
        const allElements = [
            appContainerEl, bootOverlayEl, menuOverlayEl, gameWrapperEl, epochOverlayEl,
            overlayTitleContentEl, overlayErrorContentEl, overlayMainMenuContentEl,
            overlaySettingsContentEl, overlayCutsceneContentEl, overlayPauseContentEl,
            overlayGameOverContentEl, overlayVictoryContentEl,
            cutsceneImageDisplayEl, cutsceneTextContentEl, cutsceneTextContainerEl, cutsceneSkipButton,
            gameOverStatsTextP, victoryStatsTextP, errorOverlayMessageP,
            titleStartButton, mainmenuStartGameButton, mainmenuSettingsButton, settingsBackButton,
            settingsButtonPauseOverlayEl, resumeButton, restartButtonGameOver, restartButtonVictory,
            restartButtonPause, btnToggleGridEl, muteMusicButtonEl, muteSfxButtonEl
        ];
        if (allElements.some(el => !el)) {
            allElements.forEach((el, index) => {
                if (!el) console.error(`FATAL INIT ERROR: UI Element at index ${index} (check init list) not found.`);
            });
            throw new Error("One or more critical UI elements are missing.");
        }

        Renderer.init();
        AudioManager.init();
        AgingManager.init();
        if (!UI.initGameUI()) throw new Error("FATAL INIT ERROR: UI.initGameUI() failed.");
        Input.init();

        lastTime = 0; isAutoPaused = false; isGridVisible = false;
        // currentCutsceneImageIndex, cutsceneTimer, settingsOpenedFrom moved to FlowManager

        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());

        const gameFlowDependencies = {
            bootOverlayEl, menuOverlayEl, appContainer: appContainerEl, gameWrapperEl,
            overlayTitleContentEl, overlayErrorContentEl, overlayMainMenuContentEl,
            overlaySettingsContentEl, overlayCutsceneContentEl, overlayPauseContentEl,
            overlayGameOverContentEl, overlayVictoryContentEl,
            cutsceneImageDisplayEl, cutsceneTextContentEl, cutsceneTextContainerEl, cutsceneSkipButton,
            gameOverStatsTextP, victoryStatsTextP, errorOverlayMessageP,
            onStartGameRequested: initializeAndRunGame,
            onFullGameResetRequested: fullGameResetAndShowMenu
        };
        FlowManager.init(gameFlowDependencies);

        performBackgroundWorldGeneration().catch(err => {
            console.error("Error setting up background world generation promise:", err);
            FlowManager.changeState(GameState.ERROR, { errorMessage: `Failed to initiate world generation - ${err.message}` });
        });

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Setup event listeners to call FlowManager methods
        titleStartButton.addEventListener('click', () => FlowManager.handleTitleStart());
        mainmenuStartGameButton.addEventListener('click', () => FlowManager.startCutscene());
        mainmenuSettingsButton.addEventListener('click', () => FlowManager.openSettingsFromMainMenu());
        settingsButtonPauseOverlayEl.addEventListener('click', () => FlowManager.openSettingsFromPause());
        settingsBackButton.addEventListener('click', () => FlowManager.closeSettings());
        resumeButton.addEventListener('click', () => FlowManager.resumeGame());
        restartButtonGameOver.addEventListener('click', () => FlowManager.requestFullGameReset());
        restartButtonVictory.addEventListener('click', () => FlowManager.requestFullGameReset());
        restartButtonPause.addEventListener('click', () => FlowManager.requestFullGameReset());
        cutsceneSkipButton.addEventListener('click', () => FlowManager.skipCutscene());
        // Note: toggleGrid, toggleMusicMute, toggleSfxMute buttons use global functions defined earlier

        gameLoopId = requestAnimationFrame(gameLoop);

    } catch (error) {
        console.error("FATAL: Initialization Error:", error);
        // Try to show error on boot overlay if possible
        if (bootOverlayEl && errorOverlayMessageP && FlowManager.getCurrentState() !== GameState.ERROR) {
             // Use FlowManager to show the error state properly
            FlowManager.changeState(GameState.ERROR, { errorMessage: `Initialization Error: ${error.message}. Check console.` });
        } else {
            // Fallback if FlowManager or elements aren't ready
            alert(`FATAL Initialization Error:\n${error.message}\nCheck console for details.`);
        }
    }
}

function handleVisibilityChange() {
    if (document.hidden && FlowManager.getCurrentState() === GameState.RUNNING) {
        isAutoPaused = true;
        FlowManager.pauseGame(); // Delegate to FlowManager
    }
}

window.addEventListener('DOMContentLoaded', init);