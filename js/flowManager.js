// -----------------------------------------------------------------------------
// root/js/flowManager.js - Manages Game State, Flow, and Overlays
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as AudioManager from './audioManager.js';
import * as WaveManager from './waveManager.js';
import * as UI from './uiManager.js';

export const GameState = Object.freeze({
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
let bootOverlayEl, menuOverlayEl, appContainer, gameWrapperEl;
let overlayTitleContentEl, overlayErrorContentEl, overlayMainMenuContentEl;
let overlaySettingsContentEl, overlayCutsceneContentEl, overlayPauseContentEl;
let overlayGameOverContentEl, overlayVictoryContentEl;
let cutsceneImageDisplayEl, cutsceneTextContentEl, cutsceneTextContainerEl, cutsceneSkipButton;
let gameOverStatsTextP, victoryStatsTextP, errorOverlayMessageP;
let currentCutsceneImageIndex = 0;
let cutsceneTimer = 0;
const cutsceneDurationPerImage = Config.CUTSCENE_IMAGE_DURATION;
let mainInitializeAndRunGameCallback;
let mainFullGameResetCallback;

export function init(dependencies) {
    bootOverlayEl = dependencies.bootOverlayEl;
    menuOverlayEl = dependencies.menuOverlayEl;
    appContainer = dependencies.appContainer;
    gameWrapperEl = dependencies.gameWrapperEl;
    overlayTitleContentEl = dependencies.overlayTitleContentEl;
    overlayErrorContentEl = dependencies.overlayErrorContentEl;
    overlayMainMenuContentEl = dependencies.overlayMainMenuContentEl;
    overlaySettingsContentEl = dependencies.overlaySettingsContentEl;
    overlayCutsceneContentEl = dependencies.overlayCutsceneContentEl;
    overlayPauseContentEl = dependencies.overlayPauseContentEl;
    overlayGameOverContentEl = dependencies.overlayGameOverContentEl;
    overlayVictoryContentEl = dependencies.overlayVictoryContentEl;
    cutsceneImageDisplayEl = dependencies.cutsceneImageDisplayEl;
    cutsceneTextContentEl = dependencies.cutsceneTextContentEl;
    cutsceneTextContainerEl = dependencies.cutsceneTextContainerEl;
    cutsceneSkipButton = dependencies.cutsceneSkipButton;
    gameOverStatsTextP = dependencies.gameOverStatsTextP;
    victoryStatsTextP = dependencies.victoryStatsTextP;
    errorOverlayMessageP = dependencies.errorOverlayMessageP;
    mainInitializeAndRunGameCallback = dependencies.onStartGameRequested;
    mainFullGameResetCallback = dependencies.onFullGameResetRequested;
    changeState(GameState.TITLE); // initial state
}
export function getCurrentState() {
    return currentGameState;
}
function showOverlayInternal(stateToShow) {
    if (!bootOverlayEl || !menuOverlayEl || !appContainer || !gameWrapperEl ) {
        console.error("FlowManager ShowOverlay: Core overlay/app or game world container elements not found!");
        return;
    }
    bootOverlayEl.className = '';
    menuOverlayEl.className = '';
    appContainer.classList.remove('overlay-active');
    const allContentDivs = [
        overlayTitleContentEl, overlayErrorContentEl, overlayMainMenuContentEl,
        overlaySettingsContentEl, overlayCutsceneContentEl, overlayPauseContentEl,
        overlayGameOverContentEl, overlayVictoryContentEl
    ];
    allContentDivs.forEach(div => { if (div) div.style.display = 'none'; });
    if (gameWrapperEl) gameWrapperEl.style.display = 'flex'; // default gameWrapperEl display
    if (stateToShow !== GameState.CUTSCENE) {
        if (cutsceneImageDisplayEl) {
            cutsceneImageDisplayEl.classList.remove('active');
            cutsceneImageDisplayEl.src = "";
        }
        if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
        if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
        if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
    }
    switch (stateToShow) {
        case GameState.TITLE:
            if (gameWrapperEl) gameWrapperEl.style.display = 'none';
            bootOverlayEl.classList.add('show-title');
            if (overlayTitleContentEl) overlayTitleContentEl.style.display = 'flex';
            AudioManager.stopAllMusic();
            break;
        case GameState.RUNNING:
            hideAllOverlaysInternal(); // handles overlays, blur, and gameWrapperEl display
            AudioManager.stopUIMusic(); // music started by WaveManager
            break;
        case GameState.MAIN_MENU:
            if (gameWrapperEl) gameWrapperEl.style.display = 'none';
            menuOverlayEl.classList.add('active', 'show-mainmenu', 'force-opaque');
            if (overlayMainMenuContentEl) overlayMainMenuContentEl.style.display = 'flex';
            AudioManager.stopGameMusic(); AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.MENU) AudioManager.playUIMusic(Config.AUDIO_TRACKS.MENU);
            break;
        case GameState.SETTINGS:
            menuOverlayEl.classList.add('active', 'show-settings');
            if (overlaySettingsContentEl) overlaySettingsContentEl.style.display = 'flex';
            if (settingsOpenedFrom === GameState.PAUSED) {
                appContainer.classList.add('overlay-active'); // game wrapper blurred
                if (gameWrapperEl) gameWrapperEl.style.display = 'flex'; // ensure visible
            } else { // from main menu
                menuOverlayEl.classList.add('force-opaque');
                if (gameWrapperEl) gameWrapperEl.style.display = 'none'; // hide game wrapper
            }
            break;
        case GameState.CUTSCENE:
            menuOverlayEl.classList.add('active', 'show-cutscene');
            if (overlayCutsceneContentEl) overlayCutsceneContentEl.style.display = 'flex';
            appContainer.classList.add('overlay-active'); // wrapper should be visible to blur
            if (gameWrapperEl) gameWrapperEl.style.display = 'flex';
            AudioManager.stopUIMusic(); AudioManager.stopGameMusic();
            if (Config.AUDIO_TRACKS.CUTSCENE) AudioManager.playUIMusic(Config.AUDIO_TRACKS.CUTSCENE);
            if (cutsceneImageDisplayEl) {
                cutsceneImageDisplayEl.src = '';
                cutsceneImageDisplayEl.classList.remove('active');
            }
            if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
            break;
        case GameState.PAUSED:
            menuOverlayEl.classList.add('active', 'show-pause');
            if (overlayPauseContentEl) overlayPauseContentEl.style.display = 'flex';
            appContainer.classList.add('overlay-active');
            if (gameWrapperEl) gameWrapperEl.style.display = 'flex';
            AudioManager.pauseGameMusic(); AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.pause) AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            const epochInfo = WaveManager.getCurrentEpochInfo(); // update epoch text in pause menu
            UI.updatePauseMenuEpochText(epochInfo);
            break;
        case GameState.GAME_OVER:
            menuOverlayEl.classList.add('active', 'show-gameover');
            if (overlayGameOverContentEl) overlayGameOverContentEl.style.display = 'flex';
            appContainer.classList.add('overlay-active');
            if (gameWrapperEl) gameWrapperEl.style.display = 'flex';
            AudioManager.stopGameMusic();
            if (gameOverStatsTextP && WaveManager) gameOverStatsTextP.textContent = `You reached Wave ${WaveManager.getCurrentWaveNumber()}!`;
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.gameOver) AudioManager.playUIMusic(Config.AUDIO_TRACKS.gameOver);
            break;
        case GameState.VICTORY:
            menuOverlayEl.classList.add('active', 'show-victory');
            if (overlayVictoryContentEl) overlayVictoryContentEl.style.display = 'flex';
            appContainer.classList.add('overlay-active');
            if (gameWrapperEl) gameWrapperEl.style.display = 'flex';
            AudioManager.stopGameMusic();
            if (victoryStatsTextP && Config.WAVES) victoryStatsTextP.textContent = `You cleared all ${Config.WAVES.length} waves!`;
            AudioManager.setVolume('ui', Config.AUDIO_DEFAULT_UI_VOLUME);
            if (Config.AUDIO_TRACKS.victory) AudioManager.playUIMusic(Config.AUDIO_TRACKS.victory);
            else if (Config.AUDIO_TRACKS.pause) AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            break;
        case GameState.ERROR:
            if (gameWrapperEl) gameWrapperEl.style.display = 'none';
            bootOverlayEl.classList.add('show-error');
            if (overlayErrorContentEl) overlayErrorContentEl.style.display = 'flex';
            AudioManager.stopAllMusic();
            break;
        default:
            console.warn(`FlowManager.showOverlayInternal: Unhandled state ${stateToShow}, defaulting to TITLE behavior.`);
            if (gameWrapperEl) gameWrapperEl.style.display = 'none';
            bootOverlayEl.classList.add('show-title');
            if (overlayTitleContentEl) overlayTitleContentEl.style.display = 'flex';
            AudioManager.stopAllMusic();
            break;
    }
}
function hideAllOverlaysInternal() {
    if (!bootOverlayEl || !menuOverlayEl || !appContainer || !gameWrapperEl) return;
    bootOverlayEl.className = '';
    menuOverlayEl.className = '';
    appContainer.classList.remove('overlay-active');
    const allContentDivs = [
        overlayTitleContentEl, overlayErrorContentEl, overlayMainMenuContentEl,
        overlaySettingsContentEl, overlayCutsceneContentEl, overlayPauseContentEl,
        overlayGameOverContentEl, overlayVictoryContentEl
    ];
    allContentDivs.forEach(div => { if (div) div.style.display = 'none'; });
    if (gameWrapperEl) gameWrapperEl.style.display = ''; // default CSS flex
}
export function changeState(newState, data = {}) {
    const oldState = currentGameState;
    currentGameState = newState;
    console.log(`FlowManager: State changed from ${oldState} to ${newState}`);
    if (newState === GameState.ERROR && errorOverlayMessageP && data.errorMessage) {
        errorOverlayMessageP.textContent = `Error: ${data.errorMessage}`;
    }
    showOverlayInternal(newState);
}
export function handleTitleStart() {
    changeState(GameState.MAIN_MENU);
}
export function openSettingsFromMainMenu() {
    settingsOpenedFrom = GameState.MAIN_MENU;
    changeState(GameState.SETTINGS);
}
export function openSettingsFromPause() {
    settingsOpenedFrom = GameState.PAUSED;
    changeState(GameState.SETTINGS);
}
export function closeSettings() {
    if (settingsOpenedFrom === GameState.MAIN_MENU) {
        changeState(GameState.MAIN_MENU);
    } else if (settingsOpenedFrom === GameState.PAUSED) {
        changeState(GameState.PAUSED);
    }
    settingsOpenedFrom = null;
}
export function startCutscene() {
    changeState(GameState.CUTSCENE);
    currentCutsceneImageIndex = 0;
    cutsceneTimer = cutsceneDurationPerImage;
    if (!Config.CUTSCENE_SLIDES || Config.CUTSCENE_SLIDES.length === 0) {
        console.warn("Cutscene: No slides defined. Skipping cutscene.");
        if (mainInitializeAndRunGameCallback) mainInitializeAndRunGameCallback();
        else console.error("FlowManager: mainInitializeAndRunGameCallback not set!");
        return;
    }
    if (currentCutsceneImageIndex < Config.CUTSCENE_SLIDES.length) {
        const currentSlide = Config.CUTSCENE_SLIDES[currentCutsceneImageIndex];
        if (!currentSlide || typeof currentSlide.imagePath !== 'string' || typeof currentSlide.text !== 'string') {
            console.error("Cutscene ERROR: Invalid slide data. Skipping.");
            if (mainInitializeAndRunGameCallback) mainInitializeAndRunGameCallback();
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
        console.error("Cutscene ERROR: Initial index out of bounds. Skipping.");
        if (mainInitializeAndRunGameCallback) mainInitializeAndRunGameCallback();
    }
}
export function updateCutscene(dt) {
    if (currentGameState !== GameState.CUTSCENE) return;
    cutsceneTimer -= dt;
    if (cutsceneTimer <= 0) {
        if (cutsceneImageDisplayEl) cutsceneImageDisplayEl.classList.remove('active');
        if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
        currentCutsceneImageIndex++;
        if (currentCutsceneImageIndex < Config.CUTSCENE_SLIDES.length) {
            cutsceneTimer = cutsceneDurationPerImage;
            setTimeout(() => {
                if (currentGameState !== GameState.CUTSCENE) return;
                const nextSlide = Config.CUTSCENE_SLIDES[currentCutsceneImageIndex];
                if (!nextSlide || typeof nextSlide.imagePath !== 'string' || typeof nextSlide.text !== 'string') {
                    console.error("Cutscene Update: Invalid next slide data. Ending cutscene.");
                    if (mainInitializeAndRunGameCallback) mainInitializeAndRunGameCallback();
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
            }, 1000);
        } else {
            if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
             if (cutsceneImageDisplayEl) {
                cutsceneImageDisplayEl.src = '';
                cutsceneImageDisplayEl.classList.remove('active');
            }
            if (mainInitializeAndRunGameCallback) mainInitializeAndRunGameCallback();
            else console.error("FlowManager: mainInitializeAndRunGameCallback not set after cutscene!");
        }
    }
}
export function skipCutscene() {
    if (currentGameState !== GameState.CUTSCENE) return;
    if (cutsceneImageDisplayEl) {
        cutsceneImageDisplayEl.classList.remove('active');
        cutsceneImageDisplayEl.src = '';
    }
    if (cutsceneTextContainerEl) cutsceneTextContainerEl.classList.remove('visible');
    if (cutsceneSkipButton) cutsceneSkipButton.classList.remove('visible');
    currentCutsceneImageIndex = 0; cutsceneTimer = 0;
    if (cutsceneTextContentEl) cutsceneTextContentEl.textContent = '';
    if (mainInitializeAndRunGameCallback) mainInitializeAndRunGameCallback();
    else console.error("FlowManager: mainInitializeAndRunGameCallback not set for skip cutscene!");
}
export function requestStartGameplay() {
    if (mainInitializeAndRunGameCallback) { // called when game should actually start (after "start game" or cutscene end)
        mainInitializeAndRunGameCallback(); // set currentGameState to RUNNING (main.js)
    } else {
        console.error("FlowManager: mainInitializeAndRunGameCallback not set!");
        changeState(GameState.ERROR, { errorMessage: "Cannot start game, core setup missing." });
    }
}
export function pauseGame() {
    if (currentGameState !== GameState.RUNNING) return;
    console.log(">>> FlowManager: Pausing Game <<<");
    settingsOpenedFrom = null;
    changeState(GameState.PAUSED);
}
export function resumeGame() {
    if (currentGameState !== GameState.PAUSED) return;
    console.log(">>> FlowManager: Resuming Game <<<");
    changeState(GameState.RUNNING); // changes state and calls showOverlayInternal
    AudioManager.unpauseGameMusic();
}
export function handleGameOver() {
    if (currentGameState === GameState.GAME_OVER) return;
    console.log(">>> FlowManager: Handling Game Over <<<");
    changeState(GameState.GAME_OVER);
}
export function handleVictory() {
    if (currentGameState === GameState.VICTORY) return;
    console.log(">>> FlowManager: Handling Victory! <<<");
    changeState(GameState.VICTORY);
}
export function requestFullGameReset() {
    if (mainFullGameResetCallback) {
        mainFullGameResetCallback();
    } else {
        console.error("FlowManager: mainFullGameResetCallback not set!");
        changeState(GameState.ERROR, { errorMessage: "Cannot restart game, core reset missing." });
    }
}