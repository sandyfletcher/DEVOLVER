// =============================================================================
// root/js/main.js - Game Entry Point and Main Loop
// =============================================================================

import * as UI from './js/uiManager.js';
import * as Input from './js/inputManager.js';
import * as Config from './js/utils/config.js';
import * as Renderer from './js/utils/renderer.js';
import * as WaveManager from './js/waveManager.js';
import * as GridRenderer from './js/utils/grid.js';
import * as ItemManager from './js/itemManager.js';
import * as WorldManager from './js/worldManager.js';
import * as EnemyManager from './js/enemyManager.js';
import * as AudioManager from './js/audioManager.js';
import * as AgingManager from './js/agingManager.js';
import * as CollisionManager from './js/collisionManager.js';
import * as FlowManager from './js/flowManager.js';
import * as ProjectileManager from './js/projectileManager.js';
import { Player } from './js/utils/player.js';
import { Portal } from './js/utils/portal.js';
import * as World from './js/utils/world.js';
import * as DebugLogger from './js/utils/debugLogger.js';

let gameStartTime = 0;
let lastTime = 0;
let gameLoopId = null;
let isAutoPaused = false;
let isGridVisible = false;
let player = null;
let portal = null;
let appContainerEl, bootOverlayEl, menuOverlayEl, gameWrapperEl, epochOverlayEl;
let overlayTitleContentEl, overlayErrorContentEl, overlayMainMenuContentEl;
let overlaySettingsContentEl, overlayCutsceneContentEl, overlayPauseContentEl;
let overlayGameOverContentEl, overlayVictoryContentEl;
let cutsceneImageDisplayEl, cutsceneTextContentEl, cutsceneTextContainerEl, cutsceneSkipButton;
let gameOverStatsTextP, victoryStatsTextP, errorOverlayMessageP;
let titleStartButton, mainmenuStartGameButton, mainmenuSettingsButton, settingsBackButton;
let resumeButton, restartButtonGameOver, restartButtonVictory, restartButtonPause;
let btnToggleGridEl, muteMusicButtonEl, muteSfxButtonEl, settingsButtonPauseOverlayEl;
let settingsBtnWeaponHighlight, highlightColorPreview, colorPickerPalette;
let weaponHighlightColor = Config.PLAYER_WEAPON_HIGHLIGHT_DEFAULT_COLOR;
let worldGenerationPromise = null;
let isWorldGenerated = false;
const GameState = FlowManager.GameState;

// --- Global Functions for HTML Event Handlers & Renderer ---

window.pauseGameCallback = () => FlowManager.pauseGame();
window.updateCameraScale = (deltaZoom) => {
    const currentGameState = FlowManager.getCurrentState();
    if (currentGameState !== GameState.RUNNING && currentGameState !== GameState.PAUSED) {
        return;
    }
    Renderer.updateZoomLevel(deltaZoom);
};
window.skipCutscene = () => FlowManager.skipCutscene();

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
            DebugLogger.time("executeInitialWorldGenerationSequence");
            WorldManager.executeInitialWorldGenerationSequence(); // This applies its own lighting pass initially
            DebugLogger.timeEnd("executeInitialWorldGenerationSequence");

            const initialAgingPasses = Config.AGING_INITIAL_PASSES ?? 1;
            for (let i = 0; i < initialAgingPasses; i++) {
                DebugLogger.log(`[Main] Initial Aging Pass ${i + 1}/${initialAgingPasses}`);
                // 1. Calculate lighting changes for this pass
                World.resetAllBlockLighting(); // Reset lighting for this aging pass
                const proposedLightingChangesThisPass = WorldManager.applyLightingPass(false); // false to skip debug drawing

                // 2. Apply these lighting changes directly to the world data
                if (proposedLightingChangesThisPass.length > 0) {
                    proposedLightingChangesThisPass.forEach(change => {
                        const block = World.getBlock(change.c, change.r);
                        if (block && typeof block === 'object' && typeof block.lightLevel === 'number') {
                            block.lightLevel = change.newLightLevel;
                        }
                    });
                }

                // 3. Apply aging using the now updated lighting state
                AgingManager.applyAging(null);
            }

            DebugLogger.log("[Main] Applying final lighting pass after all initial aging...");
            World.resetAllBlockLighting(); // Reset before the final, thorough pass
            const finalLightingChanges = WorldManager.applyLightingPass(false, 1); // false to skip debug, 1 for full scan
            if (finalLightingChanges.length > 0) {
                finalLightingChanges.forEach(change => {
                    const block = World.getBlock(change.c, change.r);
                    if (block && typeof block === 'object' && typeof block.lightLevel === 'number') {
                        block.lightLevel = change.newLightLevel;
                    }
                });
                DebugLogger.log(`[Main] Final lighting pass lit ${finalLightingChanges.length} additional blocks.`);
            }

            if (!Renderer.getGridCanvas()) Renderer.createGridCanvas();
            WorldManager.renderStaticWorldToGridCanvas();
            WorldManager.seedWaterUpdateQueue(); // This seeds water, waterPropagationTimer reset by WaveManager on warp
            isWorldGenerated = true;
        } catch (error) {
            console.error("[Main] FATAL error during background world generation:", error);
            isWorldGenerated = false;
            throw error;
        }
    })();
    return worldGenerationPromise;
}

async function initializeAndRunGame() {
    const currentGameState = FlowManager.getCurrentState();
    if (currentGameState === GameState.RUNNING) {
        DebugLogger.warn("[main.js] initializeAndRunGame called but game already RUNNING.");
        return;
    }
    try {
        if (!isWorldGenerated) {
            if (!worldGenerationPromise) {
                DebugLogger.warn("[Main] World generation promise not found. Starting now.");
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

        ItemManager.init(); // ItemManager.init might spawn items based on Config.DEBUG_MODE if we add that later
        EnemyManager.init();
        ProjectileManager.init();

        const playerSpawnX = Config.PLAYER_START_X;
        const playerSpawnY = Config.PLAYER_START_Y;
        player = new Player(playerSpawnX, playerSpawnY, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
        player.reset(); // Player's reset method now handles DEBUG_MODE inventory

        UI.setPlayerReference(player);
        UI.setPortalReference(portal);

        WaveManager.reset(null, portal);
        Renderer.calculateInitialCamera(player);
        isAutoPaused = false;

        AudioManager.setVolume('game', Config.AUDIO_DEFAULT_GAME_VOLUME);
        AudioManager.setVolume('sfx', Config.AUDIO_DEFAULT_SFX_VOLUME);
        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());

        FlowManager.changeState(GameState.RUNNING); // Crucially, FlowManager changes state to RUNNING *after* setup
        gameStartTime = performance.now();
        console.log(">>> [main.js] Game Started <<<");
    } catch (error) {
        console.error("[main.js] FATAL Error during initializeAndRunGame:", error);
        FlowManager.changeState(GameState.ERROR, { errorMessage: error.message });
    }
}

function fullGameResetAndShowMenu() {
    DebugLogger.log("[Main] Performing full game reset and returning to Main Menu.");
    player = null; portal = null;
    UI.setPlayerReference(null); UI.setPortalReference(null); // UI still needs to be cleared
    EnemyManager.clearAllEnemies(); ItemManager.clearAllItems(); ProjectileManager.clearAllProjectiles();
    AudioManager.stopAllMusic();
    isAutoPaused = false; // isGridVisible state persists unless explicitly reset
    worldGenerationPromise = null;
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
        const waveInfo = WaveManager.getWaveInfo(); // get wave info once for the frame

        if (currentGameState === GameState.RUNNING || currentGameState === GameState.CUTSCENE ||
            (waveInfo.state === 'WARP_ANIMATING' && currentGameState !== GameState.PAUSED)) {
            dt = rawDt;
        }

        if (waveInfo.state === 'WARP_ANIMATING') { // update MYA transition animation if active (during WARP_ANIMATING)
            UI.updateMyaEpochTransition(dt);
        }

        if (currentGameState === GameState.RUNNING) {
            Renderer.calculateCameraPosition(player, currentGameState === GameState.RUNNING);
            WaveManager.update(dt, currentGameState);
            if (player) {
                const inputState = Input.getState();
                const internalMousePos = Input.getMousePosition();
                const targetWorldPos = Renderer.getMouseWorldCoords(internalMousePos);
                const targetGridCell = Renderer.getMouseGridCoords(internalMousePos);
                player.update(dt, inputState, targetWorldPos, targetGridCell);
            }

            const playerPosForEnemies = (player && player.isActive && !player.isDying) ? player.getPosition() : null;
            EnemyManager.update(dt, playerPosForEnemies);

            ProjectileManager.update(dt);

            const playerRefForItems = (player && player.isActive && !player.isDying) ? player : null;
            ItemManager.update(dt, playerRefForItems);

            if (portal && portal.isAlive()) portal.update(dt);

            if (player) {
                CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
                CollisionManager.checkPlayerProjectileCollisions(player, ProjectileManager.getProjectiles());
                CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
                CollisionManager.checkPlayerAttackBlockCollisions(player);
                CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies());
            }

            CollisionManager.checkProjectileEnemyCollisions(ProjectileManager.getProjectiles(), EnemyManager.getEnemies(), player);
            CollisionManager.checkProjectileBlockCollisions(ProjectileManager.getProjectiles());

            if (portal && portal.isAlive()) {
                CollisionManager.checkEnemyPortalCollisions(EnemyManager.getEnemies(), portal);
            }

            if ((player && !player.isActive) || (portal && !portal.isAlive())) {
                WaveManager.setGameOver();
                EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
                ItemManager.clearItemsOutsideRadius(0, 0, Infinity);
                FlowManager.handleGameOver();
                isAutoPaused = false;
            } else if (waveInfo.allWavesCleared) {
                WaveManager.setVictory();
                EnemyManager.clearEnemiesOutsideRadius(0, 0, Infinity);
                ItemManager.clearItemsOutsideRadius(0, 0, Infinity);
                FlowManager.handleVictory();
                isAutoPaused = false;
            }
        } else if (currentGameState === GameState.CUTSCENE) {
            FlowManager.updateCutscene(dt);
        }

        if (dt > 0) WorldManager.update(dt);

        Renderer.clear();
        const mainCtx = Renderer.getContext();
        const isGameWorldVisible = currentGameState === GameState.RUNNING || currentGameState === GameState.PAUSED ||
                                 currentGameState === GameState.GAME_OVER || currentGameState === GameState.VICTORY ||
                                 (currentGameState === GameState.CUTSCENE && waveInfo.state !== 'PRE_WAVE') ||
                                 (waveInfo.state === 'WARP_ANIMATING');

        if (isGameWorldVisible && gameWrapperEl && gameWrapperEl.style.display !== 'none') {
            Renderer.applyCameraTransforms(mainCtx);
            WorldManager.draw(mainCtx);
            GridRenderer.drawStaticGrid(mainCtx, isGridVisible);
            ItemManager.draw(mainCtx, weaponHighlightColor);
            ProjectileManager.draw(mainCtx, weaponHighlightColor);
            if (portal) portal.draw(mainCtx);
            EnemyManager.draw(mainCtx);
            if (player && currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY) {
                player.draw(mainCtx, weaponHighlightColor);
                const waveInfoAtDraw = WaveManager.getWaveInfo();
                const currentWaveManagerStateAtDraw = waveInfoAtDraw.state;
                const isGameplayActiveAtDraw = ['WAVE_COUNTDOWN', 'BUILDPHASE', 'WARP_ANIMATING'].includes(currentWaveManagerStateAtDraw);
                const playerIsInteractableAtDraw = player && player.isActive && !player.isDying;
                if (playerIsInteractableAtDraw && isGameplayActiveAtDraw && player.isMaterialSelected()) {
                    player.drawPlacementRange(mainCtx);
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
                playerExists ? player.hasWeapon(Config.WEAPON_TYPE_SHOVEL) : false,
                playerExists ? player.hasWeapon(Config.WEAPON_TYPE_BOW) : false
            );
            const portalExists = !!portal;
            UI.updatePortalInfo(
                portalExists ? portal.currentHealth : 0,
                portalExists ? portal.maxHealth : Config.PORTAL_INITIAL_HEALTH
            );
            UI.updateWaveTimer(waveInfo);
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
        titleStartButton = document.getElementById('title-heading-button');
        mainmenuStartGameButton = document.getElementById('mainmenu-start-game-button');
        mainmenuSettingsButton = document.getElementById('mainmenu-settings-button');
        settingsBackButton = document.getElementById('settings-back-button');
        settingsButtonPauseOverlayEl = document.getElementById('settings-button-overlay-pause');
        resumeButton = document.getElementById('resume-button');
        restartButtonGameOver = document.getElementById('restart-button-overlay');
        restartButtonVictory = document.getElementById('restart-button-overlay-victory');
        restartButtonPause = document.getElementById('restart-button-overlay-pause');
        btnToggleGridEl = document.getElementById('settings-btn-toggle-grid');
        muteMusicButtonEl = document.getElementById('settings-btn-mute-music');
        muteSfxButtonEl = document.getElementById('settings-btn-mute-sfx');
        settingsBtnWeaponHighlight = document.getElementById('settings-btn-weapon-highlight');
        highlightColorPreview = document.getElementById('highlight-color-preview');
        colorPickerPalette = document.getElementById('color-picker-palette');

        const allElements = [
            appContainerEl, bootOverlayEl, menuOverlayEl, gameWrapperEl, epochOverlayEl,
            overlayTitleContentEl, overlayErrorContentEl, overlayMainMenuContentEl,
            overlaySettingsContentEl, overlayCutsceneContentEl, overlayPauseContentEl,
            overlayGameOverContentEl, overlayVictoryContentEl,
            cutsceneImageDisplayEl, cutsceneTextContentEl, cutsceneTextContainerEl, cutsceneSkipButton,
            gameOverStatsTextP, victoryStatsTextP, errorOverlayMessageP,
            titleStartButton, mainmenuStartGameButton, mainmenuSettingsButton, settingsBackButton,
            settingsButtonPauseOverlayEl, resumeButton, restartButtonGameOver, restartButtonVictory,
            restartButtonPause, btnToggleGridEl, muteMusicButtonEl, muteSfxButtonEl,
            settingsBtnWeaponHighlight, highlightColorPreview, colorPickerPalette
        ];
        if (allElements.some(el => !el)) {
            allElements.forEach((el, index) => {
                if (!el) console.error(`FATAL INIT ERROR: UI Element at index ${index} (check init list) not found.`);
            });
            throw new Error("One or more critical UI elements are missing.");
        }

        Renderer.init();
        AudioManager.init();
        if (!UI.initGameUI()) throw new Error("FATAL INIT ERROR: UI.initGameUI() failed.");
        Input.init();
        lastTime = 0;
        isAutoPaused = false;
        isGridVisible = false;
        UI.updateSettingsButtonStates(isGridVisible, AudioManager.getMusicMutedState(), AudioManager.getSfxMutedState());

        weaponHighlightColor = localStorage.getItem('weaponHighlightColor') || Config.PLAYER_WEAPON_HIGHLIGHT_DEFAULT_COLOR;
        highlightColorPreview.style.backgroundColor = weaponHighlightColor;
        Config.WEAPON_HIGHLIGHT_PALETTE.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', () => {
                weaponHighlightColor = color;
                highlightColorPreview.style.backgroundColor = color;
                colorPickerPalette.style.display = 'none';
                localStorage.setItem('weaponHighlightColor', color);
            });
            colorPickerPalette.appendChild(swatch);
        });
        
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
        titleStartButton.addEventListener('click', () => FlowManager.handleTitleStart());
        mainmenuStartGameButton.addEventListener('click', () => FlowManager.startCutscene());
        mainmenuSettingsButton.addEventListener('click', () => FlowManager.openSettingsFromMainMenu());
        settingsButtonPauseOverlayEl.addEventListener('click', () => FlowManager.openSettingsFromPause());
        settingsBackButton.addEventListener('click', () => {
            colorPickerPalette.style.display = 'none';
            FlowManager.closeSettings();
        });
        resumeButton.addEventListener('click', () => FlowManager.resumeGame());
        restartButtonGameOver.addEventListener('click', () => FlowManager.requestFullGameReset());
        restartButtonVictory.addEventListener('click', () => FlowManager.requestFullGameReset());
        restartButtonPause.addEventListener('click', () => FlowManager.requestFullGameReset());
        cutsceneSkipButton.addEventListener('click', () => FlowManager.skipCutscene());
        settingsBtnWeaponHighlight.addEventListener('click', () => {
            const isVisible = colorPickerPalette.style.display === 'grid';
            colorPickerPalette.style.display = isVisible ? 'none' : 'grid';
        });

        gameLoopId = requestAnimationFrame(gameLoop);
    } catch (error) {
        console.error("FATAL: Initialization Error:", error);
        if (bootOverlayEl && errorOverlayMessageP && FlowManager.getCurrentState() !== GameState.ERROR) {
            FlowManager.changeState(GameState.ERROR, { errorMessage: `Initialization Error: ${error.message}. Check console.` });
        } else {
            alert(`FATAL Initialization Error:\n${error.message}\nCheck console for details.`);
        }
    }
}

function handleVisibilityChange() {
    if (document.hidden && FlowManager.getCurrentState() === GameState.RUNNING) {
        isAutoPaused = true;
        FlowManager.pauseGame();
    }
}

window.addEventListener('DOMContentLoaded', init);