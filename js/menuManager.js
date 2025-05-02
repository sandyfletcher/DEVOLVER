// -----------------------------------------------------------------------------
// root/js/menuManager.js - Manages the content and interaction within the game overlay
// -----------------------------------------------------------------------------

import * as AudioManager from './audioManager.js';
// Import Config if needed for specific text/durations, though maybe less so now
// import * as Config from './config.js';

// --- DOM Element References ---
let gameOverlay = null;
let overlayTitleContent = null;
let overlayPauseContent = null;
let overlayGameoverContent = null;
let overlayVictoryContent = null;
let gameoverStatsTextP = null; // Paragraph for game over stats
let victoryStatsTextP = null; // Paragraph for victory stats

// --- Internal State ---
// Add a flag to track the currently displayed screen type within the overlay
let currentScreenType = null; // e.g., 'title', 'pause', 'gameover', 'victory'

// --- Callbacks to Main.js ---
// These will be set by Main.js during initialization
let startGameCallback = null;
let resumeGameCallback = null;
let restartGameCallback = null; // Used by both game over and victory screens

// --- Screen Audio Mappings ---
// Define audio tracks associated with each screen type.
const screenAudio = {
    'title': 'assets/audio/music/Title.mp3', // Assuming you'll add these later
    'pause': 'assets/audio/music/Pause.mp3',
    'gameover': 'assets/audio/music/GameOver.mp3', // Assuming you'll add these later
    'victory': 'assets/audio/music/Victory.mp3', // Assuming you'll add these later
    // Add future screens here: 'settings': 'path/to/settings_music.mp3'
};


// --- Initialization ---
export function init(callbacks) {
    // Get main overlay container and its content divs
    gameOverlay = document.getElementById('game-overlay');
    overlayTitleContent = document.getElementById('overlay-title-content');
    overlayPauseContent = document.getElementById('overlay-pause-content');
    overlayGameoverContent = document.getElementById('overlay-gameover-content');
    overlayVictoryContent = document.getElementById('overlay-victory-content');

    // Get specific elements within the content divs (like stats text)
    gameoverStatsTextP = document.getElementById('gameover-stats-text');
    victoryStatsTextP = document.getElementById('victory-stats-text');

    // --- Verify Essential Overlay Elements Are Found ---
    const requiredElements = [
        gameOverlay, overlayTitleContent, overlayPauseContent,
        overlayGameoverContent, overlayVictoryContent,
        gameoverStatsTextP, victoryStatsTextP
    ];
    if (requiredElements.some(el => !el)) {
        console.error("MenuManager Init: Could not find all essential overlay elements!");
         // Log specific missing elements if needed
         requiredElements.forEach(el => {
             if (!el) console.error(`Missing overlay element: ${el?.id || el?.className || 'Unknown (null)'}`);
         });
        // Consider throwing an error or disabling the menu system if critical elements are missing
        // For now, we'll just warn and some functionality might be broken
         return false;
    }
    // Store callbacks provided by Main.js
    startGameCallback = callbacks.startGame;
    resumeGameCallback = callbacks.resumeGame;
    restartGameCallback = callbacks.restartGame;


    // --- Setup Event Listeners for Overlay Buttons ---
    // Button listeners will now call the callbacks provided by main.js
    document.getElementById('start-game-button')?.addEventListener('click', () => {
        // console.log("MenuManager: Start Game button clicked");
        if (startGameCallback) startGameCallback();
        // MenuManager hides itself on game start/resume
        // Main.js handles the state change, which will trigger MenuManager.hideOverlay() via its state logic.
    });

    document.getElementById('resume-button')?.addEventListener('click', () => {
        // console.log("MenuManager: Resume button clicked");
        if (resumeGameCallback) resumeGameCallback();
        // MenuManager hides itself on game start/resume
    });

    document.getElementById('restart-button-overlay')?.addEventListener('click', () => {
        // console.log("MenuManager: Restart button clicked (Game Over)");
        if (restartGameCallback) restartGameCallback();
        // MenuManager hides itself on game restart
    });

    document.getElementById('restart-button-overlay-victory')?.addEventListener('click', () => {
        // console.log("MenuManager: Restart button clicked (Victory)");
        if (restartGameCallback) restartGameCallback();
        // MenuManager hides itself on game restart
    });

    // Optional: Add commented-out listeners for future screens
    /*
    document.getElementById('settings-button-main')?.addEventListener('click', () => {
        showScreen('settings'); // Transition to settings screen
    });
    document.getElementById('back-button-settings')?.addEventListener('click', () => {
         showScreen('title'); // Transition back to title screen
    });
    */

    // Initial state setup: All content divs are hidden by default CSS,
    // the overlay container itself is also hidden by default CSS (`opacity: 0`, `visibility: hidden`).
    // Main.js will call showScreen('title') to initially display the title.

    // console.log("MenuManager initialized.");
    return true; // Indicate successful initialization
}


// --- Screen Display Functions ---

/**
 * Shows a specific screen within the overlay.
 * Main.js calls this after activating the overlay container and pausing the game.
 * @param {string} screenType - The type of screen to show ('title', 'pause', 'gameover', 'victory').
 * @param {object} [screenData] - Optional data specific to the screen (e.g., stats for gameover).
 */
export function showScreen(screenType, screenData = {}) {
     if (!gameOverlay) {
         console.error("MenuManager showScreen: Not initialized.");
         return;
     }

     // Ensure screenType is lowercase for consistency
    screenType = screenType.toLowerCase();

     // Hide all content divs first
    hideAllContent();

     // Show the requested content div and update internal state
    switch (screenType) {
        case 'title':
             if (overlayTitleContent) overlayTitleContent.style.display = 'flex';
             break;
        case 'pause':
             if (overlayPauseContent) overlayPauseContent.style.display = 'flex';
             break;
        case 'gameover':
             if (overlayGameoverContent) overlayGameoverContent.style.display = 'flex';
             // Update game over stats if provided
             if (gameoverStatsTextP && screenData.finalWave !== undefined) {
                 gameoverStatsTextP.textContent = `You reached Wave ${screenData.finalWave}!`;
             }
             break;
        case 'victory':
             if (overlayVictoryContent) overlayVictoryContent.style.display = 'flex';
              // Update victory stats if provided
             if (victoryStatsTextP && screenData.totalWaves !== undefined) {
                 victoryStatsTextP.textContent = `You cleared all ${screenData.totalWaves} waves!`;
             }
             break;
        // Add future screens here:
        /*
        case 'settings':
            // Assuming you have a settings content div: overlaySettingsContent.style.display = 'flex';
            // Update settings UI elements based on current settings state (passed in screenData or globally accessible)
             break;
        */
        default:
             console.warn(`MenuManager: Unknown screen type requested: ${screenType}`);
             // Fallback to title or hide everything? Let's hide everything.
             hideAllContent();
             return; // Exit if unknown type
    }

    currentScreenType = screenType; // Update internal state

     // --- Handle Screen-Specific Audio ---
     // Stop any UI music currently playing before starting the new one
     AudioManager.stopUIMusic();
     const trackPath = screenAudio[screenType];
     if (trackPath) {
          AudioManager.playUIMusic(trackPath);
     } else {
         // No specific track for this screen, UI music remains stopped.
     }

     // Main.js handles adding the 'active' class to the gameOverlay container.
     // This manager only handles *which* content is visible inside it.
     // Also, Main.js handles adding the 'overlay-active' class to appContainer for blur.
}

/** Hides all specific content divs within the overlay. */
function hideAllContent() {
    if (overlayTitleContent) overlayTitleContent.style.display = 'none';
    if (overlayPauseContent) overlayPauseContent.style.display = 'none';
    if (overlayGameoverContent) overlayGameoverContent.style.display = 'none';
    if (overlayVictoryContent) overlayVictoryContent.style.display = 'none';
    // Hide future screens here too
    // if (overlaySettingsContent) overlaySettingsContent.style.display = 'none';
    currentScreenType = null; // No screen is currently active within the manager
}

/** Hides the entire overlay container. Main.js calls this. */
export function hideOverlay() {
    if (!gameOverlay) return;
    // Main.js handles removing the 'active' class from the gameOverlay container.
    // Main.js also handles removing the 'overlay-active' class from appContainer for blur.

    hideAllContent(); // Ensure all internal content is hidden when the overlay container is hidden
    AudioManager.stopUIMusic(); // Stop UI music when the overlay is hidden
    // console.log("MenuManager: Entire overlay hidden.");
}


// --- Getters (Optional, useful for debugging or other modules) ---
export function getCurrentScreenType() {
    return currentScreenType;
}