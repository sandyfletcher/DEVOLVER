// root/js/main.js - Game Entry Point and Main Loop

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
import * as AudioManager from './audioManager.js';
import { Portal } from './portal.js';

// =============================================================================
// --- Global Game Variables ---
// =============================================================================

let player = null;
let portal = null; // Portal instance
let gameLoopId = null; // store requestAnimationFrame ID for pausing/stopping
let lastTime = 0;
let gameStartTime = 0; // track when the current game started for playtime/stats
// --- Portal State ---
let currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS;
// --- Camera ---
let cameraX = 0;
let cameraY = 0;
let cameraScale = 1.0; // 1.0 = normal zoom
// --- DOM References ---
let appContainer = null;
let gameOverlay = null;
let startGameButton = null;
let resumeButton = null;
let restartButtonGameOver = null;
let restartButtonVictory = null;
let gameOverStatsTextP = null;
let victoryStatsTextP = null;
let intermissionRadiusIncreasedThisWave = false;
// --- Game State Enum ---
const GameState = Object.freeze({
    PRE_GAME: 'PRE_GAME',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY'
});
let currentGameState = GameState.PRE_GAME;

// =============================================================================
// --- Helper Functions ---
// =============================================================================

// --- Return the internal canvas size in pixels, which matches the world dimensions ---
function getWorldPixelWidth() { return Config.CANVAS_WIDTH; }
function getWorldPixelHeight() { return Config.GRID_ROWS * Config.BLOCK_HEIGHT; } // Use GRID_ROWS * BLOCK_HEIGHT for world height

/* --- Console log the world grid (currently unused but kept for future debugging) ---
function logWorldGrid() {
    console.log("--- World Grid Debug Output ---");
    console.time("GridLog Generation");
    const blockToChar = {
        [Config.BLOCK_AIR]: ' ', [Config.BLOCK_WATER]: '~', [Config.BLOCK_SAND]: '.',
        [Config.BLOCK_DIRT]: '#', [Config.BLOCK_GRASS]: '"', [Config.BLOCK_STONE]: 'R',
        [Config.BLOCK_WOOD]: 'P', [Config.BLOCK_METAL]: 'M', [Config.BLOCK_BONE]: 'B'
    };
    const defaultChar = '?';
    let gridString = "";
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        let rowString = "";
        for (let c = 0; c < Config.GRID_COLS; c++) {
            // Use WorldData.getBlockType which handles the object/number distinction
            rowString += blockToChar[WorldData.getBlockType(c, r)] ?? defaultChar;
       }
        gridString += rowString + "\n";
    }
    console.log(gridString);
    console.timeEnd("GridLog Generation");
    console.log("--- End World Grid Debug Output ---");
}*/

// --- Global Exposures ---
window.pauseGameCallback = pauseGame; // expose pauseGame globally via window object for UI button callback
window.updateCameraScale = function(deltaScale) { // expose updateCameraScale globally for input wheel handler
    const oldScale = cameraScale;
    let newScale = cameraScale + deltaScale;
    const internalCanvasWidth = Config.CANVAS_WIDTH; // calculate the minimum scale required to fill the viewport
    const internalCanvasHeight = Config.CANVAS_HEIGHT;
    const worldPixelWidth = getWorldPixelWidth();
    const worldPixelHeight = getWorldPixelHeight();
    const scaleToFitWidth = (worldPixelWidth > 0) ? internalCanvasWidth / worldPixelWidth : 1; // avoid division by zero, default to 1 if invalid
    const scaleToFitHeight = (worldPixelHeight > 0) ? internalCanvasHeight / worldPixelHeight : 1;
    const minScaleRequired = Math.max(scaleToFitWidth, scaleToFitHeight); // minimum required to ensure the world fills the view
    const effectiveMinScale = Math.max(Config.MIN_CAMERA_SCALE, minScaleRequired); // effective minimum scale is the LARGER of configured limit and required limit
    newScale = Math.max(effectiveMinScale, Math.min(newScale, Config.MAX_CAMERA_SCALE)); // clamp  new scale, apply effective minimum and user-defined maximum
    cameraScale = newScale; // apply final clamped scale, camera position will be re-clamped in the next game loop by calculateCameraPosition
}
// --- Convert canvas pixel coordinates to world coordinates ---
function getMouseWorldCoords(inputMousePos) {
    const worldX = cameraX + (inputMousePos.x / cameraScale);
    const worldY = cameraY + (inputMousePos.y / cameraScale);
    return { x: worldX, y: worldY };
}
// --- Convert canvas pixel coordinates directly to grid coordinates ---
function getMouseGridCoords(inputMousePos) {
    const { x: worldX, y: worldY } = getMouseWorldCoords(inputMousePos);
    return GridCollision.worldToGridCoords(worldX, worldY);
}
// Callback function to handle the start of a new wave, triggered by WaveManager
function handleWaveStart(waveNumber) {
    console.log(`Wave ${waveNumber}`);
    const epochYear = Config.EPOCH_MAP[waveNumber];
    if (epochYear !== undefined) {
        UI.showEpochText(epochYear);
    } else {
        console.warn(`Main: No epoch defined in Config.EPOCH_MAP for wave ${waveNumber}.`);
        // Optional: Show default text like "Wave {waveNumber} Starting"
        // UI.showEpochText(`Wave ${waveNumber} Starting`);
    }
}

// =============================================================================
// --- Overlay Management ---
// =============================================================================

function showOverlay(stateToShow) {
    if (!gameOverlay || !appContainer) {
         console.error("ShowOverlay: Core overlay/app container not found!");
         return;
    }
// remove previous state classes
    gameOverlay.classList.remove('show-title', 'show-pause', 'show-gameover', 'show-victory');
// handle audio transitions based on state being shown
    switch (stateToShow) {
        case GameState.PRE_GAME:
            gameOverlay.classList.add('show-title');
// stop all music for a clean start on title screen
            AudioManager.stopAllMusic();
// play title music (if defined)
            if (Config.AUDIO_TRACKS.title) {
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.title);
            } else {
                AudioManager.stopUIMusic(); // Ensure UI music is stopped if no title track
            }
            break;
        case GameState.PAUSED:
            gameOverlay.classList.add('show-pause');
// stop gamemusic and start pausemusic
            AudioManager.pauseGameMusic(); // Pause game music
            if (Config.AUDIO_TRACKS.pause) { // Play pause music if defined
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.pause);
            } else {
                AudioManager.stopUIMusic(); // Ensure UI music is stopped if no pause track
            }
            break;
        case GameState.GAME_OVER:
            gameOverlay.classList.add('show-gameover');
// update game over stats if element exists
            if (gameOverStatsTextP) {
                 const finalWave = WaveManager.getCurrentWaveNumber(); // wave reached stat
                 gameOverStatsTextP.textContent = `You reached Wave ${finalWave}!`; // Adjusted text
            } else {
                console.warn("ShowOverlay: gameover-stats-text element not found for GAME_OVER state.");
            }
// stop gamemusic and start gameovermusic
            AudioManager.stopGameMusic(); // Stop game music
            if (Config.AUDIO_TRACKS.gameOver) { // Play game over music if defined
                 AudioManager.playUIMusic(Config.AUDIO_TRACKS.gameOver);
            } else {
                 AudioManager.stopUIMusic(); // Ensure UI music is stopped if no game over track
            }
            break;
        case GameState.VICTORY:
            gameOverlay.classList.add('show-victory');
// update victory stats text
            if (victoryStatsTextP) {
                 victoryStatsTextP.textContent = `You cleared all ${Config.WAVES.length} waves!`;
            } else {
                console.warn("ShowOverlay: victory-stats-text element not found for VICTORY state.");
            }
// stop gamemusic and start victorymusic
             AudioManager.stopGameMusic(); // Stop game music
            if (Config.AUDIO_TRACKS.victory) { // Play victory music if defined
                AudioManager.playUIMusic(Config.AUDIO_TRACKS.victory);
            } else {
                 AudioManager.stopUIMusic(); // Ensure UI music is stopped if no victory track
            }
            break;
    }
// make overlay visible and dim background
    gameOverlay.classList.add('active');
    appContainer.classList.add('overlay-active');
}
// hide overlay and restore background
function hideOverlay() {
    if (!gameOverlay || !appContainer) return;
    gameOverlay.classList.remove('active');
// ensure background interaction is re-enabled
     appContainer.classList.remove('overlay-active');
// stop UI music when hiding overlay
    AudioManager.stopUIMusic(); // stop UI music (pause, game over, victory)
    // Resume game music ONLY if transitioning from PAUSED to RUNNING
    if (currentGameState === GameState.RUNNING) {
        AudioManager.resumeGameMusic();
    }
}

// =============================================================================
// --- Game State Control ---
// =============================================================================

function startGame() {
    if (currentGameState === GameState.RUNNING) {
        console.warn("startGame called but game already RUNNING.");
        return;
    }
    if (!UI.isInitialized()) { // Initialize UI Elements (find, create dynamic slots, add listeners)
         console.error("FATAL: UI was not initialized correctly. Aborting game start.");
         return;
    }
    UI.setPlayerReference(null); // Reset player reference
    UI.setPortalReference(null); // portal too
    World.init(); // Initialize Game Logic Systems
    ItemManager.init();
    EnemyManager.init();
    WaveManager.reset(handleWaveStart);
    try { // Create Player Instance
        player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
        const portalSpawnX = Config.CANVAS_WIDTH / 2 - Config.PORTAL_WIDTH / 2; // Position the portal centered horizontally, slightly above the mean ground level
        const portalSpawnY = (Config.WORLD_GROUND_LEVEL_MEAN * Config.BLOCK_HEIGHT) - Config.PORTAL_HEIGHT - (Config.PORTAL_SPAWN_Y_OFFSET_BLOCKS * Config.BLOCK_HEIGHT);
        portal = new Portal(portalSpawnX, portalSpawnY); // Create portal instance
        UI.setPlayerReference(player); // Set Player and Portal References in UI
        UI.setPortalReference(portal); // Set portal reference
    } catch (error) {
        // Ensure portal and player are null if creation failed
        player = null;
        portal = null;
        currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // Reset radius
        console.error("FATAL: Game Object Creation/Init Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        currentGameState = GameState.PRE_GAME;
        showOverlay(GameState.PRE_GAME);
        alert("Error creating game objects. Please check console and refresh.");
        return;
    }
    calculateInitialCamera(); // Calculate camera position, centered on player
    currentPortalSafetyRadius = Config.PORTAL_SAFETY_RADIUS; // Reset radius for new game
    intermissionRadiusIncreasedThisWave = false;
    currentGameState = GameState.RUNNING; // Set game state, hide overlay
    hideOverlay();
    Input.consumeClick(); // consume any lingering clicks
    gameStartTime = performance.now(); // Start Game Loop
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }
    gameLoopId = requestAnimationFrame(gameLoop);
    console.log(">>> Game Loop Started <<<");
}
// --- Pause currently running game ---
function pauseGame() { // exposed via window.pauseGameCallback
    if (currentGameState !== GameState.RUNNING) return;
    console.log(">>> Pausing Game <<<");
    currentGameState = GameState.PAUSED;
    showOverlay(GameState.PAUSED);
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId); // stop game loop
        gameLoopId = null;
    }
}
// --- Resumes the game from a paused state ---
function resumeGame() {
    if (currentGameState !== GameState.PAUSED) return;
    console.log(">>> Resuming Game <<<");
    currentGameState = GameState.RUNNING;
    hideOverlay();
    if (!gameLoopId) {
        gameLoopId = requestAnimationFrame(gameLoop); // restart game loop
    }
}
// --- Handles transition to game over state ---
function handleGameOver() {
    if (currentGameState === GameState.GAME_OVER) return;
    console.log(">>> Handling Game Over <<<");
    currentGameState = GameState.GAME_OVER;
    WaveManager.setGameOver();
    showOverlay(GameState.GAME_OVER);
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }
    // Perform a final UI update to show the end-game state
    const waveInfo = WaveManager.getWaveInfo();
    // Pass player health and portal health one last time
    UI.updatePortalAndWaveInfo(waveInfo, portal?.currentHealth, portal?.maxHealth); // Pass portal health
    if (player) {
         UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.hasWeapon(Config.WEAPON_TYPE_SWORD), player.hasWeapon(Config.WEAPON_TYPE_SPEAR), player.hasWeapon(Config.WEAPON_TYPE_SHOVEL));
    }
}
// --- Handles the transition to the victory state (all waves cleared) ---
function handleVictory() {
     if (currentGameState === GameState.VICTORY) return; // Prevent multiple calls
     console.log(">>> Handling Victory <<<");
     currentGameState = GameState.VICTORY;
      // Inform WaveManager (though it's already in VICTORY state)
      WaveManager.setVictory(); // Add a setVictory function to WaveManager
     showOverlay(GameState.VICTORY); // Show victory overlay (plays victory music)
     if (gameLoopId) {
         cancelAnimationFrame(gameLoopId); // Stop the game loop
         gameLoopId = null;
     }
     // Final UI Update
     const waveInfo = WaveManager.getWaveInfo(); // State should be VICTORY
     const livingEnemies = EnemyManager.getLivingEnemyCount(); // Should be 0
     UI.updateWaveInfo(waveInfo, livingEnemies);
     if (player) {
         UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.hasWeapon(Config.WEAPON_TYPE_SWORD), player.hasWeapon(Config.WEAPON_TYPE_SPEAR), player.hasWeapon(Config.WEAPON_TYPE_SHOVEL));
     }
}
/** Restart game from GAME_OVER, VICTORY, or PAUSED state */
function restartGame() {
    if (currentGameState !== GameState.GAME_OVER && currentGameState !== GameState.VICTORY && currentGameState !== GameState.PAUSED) {
        console.warn("Restart called but game not in a restartable state.");
        return; // Prevent restarting from RUNNING or PRE_GAME states via this button
    }
    console.log(">>> Restarting Game <<<");
    // No need to explicitly set state to PRE_GAME here; startGame handles the full reset cycle
    startGame(); // Re-run the full start sequence (clear state, reset managers, create player, start loop)
}

// =============================================================================
// --- Game Loop ---
// =============================================================================

function gameLoop(timestamp) {
    if (currentGameState !== GameState.RUNNING) { // Ensure loop doesn't run if game state is not RUNNING
        if (gameLoopId) {
            console.warn("Game loop called unexpectedly while not running. State:", currentGameState);
            cancelAnimationFrame(gameLoopId);
            gameLoopId = null;
        }
        if (currentGameState !== GameState.PAUSED) { // reset lastTime if game truly stops (not just paused) to ensure a clean start next time
            lastTime = 0;
        }
        return;
    }
// --- Delta Time Calculation ---
    let dt;
    if (lastTime === 0) { // set dt to 0 to avoid negative time calculations on startup or after a long pause
        dt = 0;
        // console.log("GameLoop: First frame detected (lastTime was 0). dt set to 0.");
    } else { // standard calculation for subsequent frames
        dt = (timestamp - lastTime) / 1000; // time since last frame in seconds
        dt = Math.min(dt, Config.MAX_DELTA_TIME); // clamp dt to prevent physics issues if frame rate drops
    }
    lastTime = timestamp; // update lastTime for the next frame
// --- Game Over Checks ---
if (player && player.getCurrentHealth() <= 0) {
    console.log("Game Over: Player died.");
    handleGameOver(); // Player died
    return;
}
 // Check Portal Health - Only trigger game over if portal dies AND it's not the final wave
 if (portal && !portal.isAlive() && WaveManager.getCurrentWaveNumber() < Config.WAVES.length) {
     console.log("Game Over: Portal destroyed before the final wave.");
     handleGameOver(); // Portal destroyed
     return;
 }
// --- Input Phase ---
    const inputState = Input.getState();
    const internalMousePos = Input.getMousePosition();
    let targetWorldPos = getMouseWorldCoords(internalMousePos);
    let targetGridCell = getMouseGridCoords(internalMousePos);
// --- Update Phase ---
let currentPlayerPosition = null;
if (player) {
    player.update(dt, inputState, targetWorldPos, targetGridCell);
    currentPlayerPosition = player.getPosition();
    player.equipItem(player.getCurrentlySelectedItem()); // Re-equip to update UI selection state based on availability/possession
}
if (portal) { // Update portal
    portal.update(dt);
}
ItemManager.update(dt);
EnemyManager.update(dt, currentPlayerPosition);
WaveManager.update(dt, currentGameState); // Pass the current game state to WaveManager.update so it knows whether to decrement timers
World.update(dt);

// --- Check Wave Manager state AFTER update ---
    // Get the latest wave info after update
     const waveInfo = WaveManager.getWaveInfo();
    // Check if transitioning into intermission to increment radius
    if (waveInfo.state === 'INTERMISSION' && !intermissionRadiusIncreasedThisWave) {
        currentPortalSafetyRadius += Config.PORTAL_RADIUS_GROWTH_PER_WAVE;
        intermissionRadiusIncreasedThisWave = true;
        console.log(`Intermission - Safety Radius: ${currentPortalSafetyRadius}`);
    } else if (waveInfo.state !== 'INTERMISSION') {
         intermissionRadiusIncreasedThisWave = false; // Reset flag when not in intermission
    }
    if (waveInfo.state === 'VICTORY') {
         handleVictory(); // transition to victory state
         return; // stop processing
    }
// --- Update Camera Position ---
    calculateCameraPosition();
// --- Collision Detection Phase ---
    if (player) {
        CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
        CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
        CollisionManager.checkPlayerAttackBlockCollisions(player);
        CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies());
    }
    if (portal) {
        CollisionManager.checkEnemyPortalCollisions(EnemyManager.getEnemies(), portal);
    }
// --- Render Phase ---
    Renderer.clear();
    const mainCtx = Renderer.getContext();
    // Pass the dynamically managed radius to the portal instance for drawing
    mainCtx.save(); // save context state before transformation
    mainCtx.scale(cameraScale, cameraScale); // apply camera transformations (scale and translate)
    mainCtx.translate(-cameraX, -cameraY);
// --- Draw World Elements ---
    World.draw(mainCtx); // static world background
    ItemManager.draw(mainCtx); // items
    if (portal) { // Draw portal
        portal.setSafetyRadius(currentPortalSafetyRadius); // Update portal instance with current radius before drawing
        portal.draw(mainCtx);
    }
    EnemyManager.draw(mainCtx); // enemies
    if (player) {
        player.draw(mainCtx); // player sprite and held weapon visual
        player.drawGhostBlock(mainCtx); // block placement preview
    }
    mainCtx.restore(); // restore context state (remove transformations)
    // --- Update Sidebar UI ---
    const livingEnemies = EnemyManager.getLivingEnemyCount(); // This is for debugging/info, not the main portal health display
    // Use the updated function to send wave info and portal health
    UI.updatePortalAndWaveInfo(waveInfo, portal?.currentHealth, portal?.maxHealth);
    if (player) {
        UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.hasWeapon(Config.WEAPON_TYPE_SWORD), player.hasWeapon(Config.WEAPON_TYPE_SPEAR), player.hasWeapon(Config.WEAPON_TYPE_SHOVEL));
    }
// --- Loop Continuation ---
    if (currentGameState === GameState.RUNNING) { // Schedule the next frame *only* if still running
        gameLoopId = requestAnimationFrame(gameLoop);
    } else {
        if (gameLoopId) { // If state changed (e.g., to PAUSED, GAME_OVER, VICTORY), ensure loop stops
            cancelAnimationFrame(gameLoopId);
            gameLoopId = null;
        }
        if (currentGameState !== GameState.PAUSED) { // reset lastTime if transitioning out of RUNNING to ensure the next time RUNNING starts (via resume or restart) the first dt calculation is handled cleanly
            lastTime = 0;
        }
    }
}

// =============================================================================
// --- Camera Calculation Helpers ---
// =============================================================================

function calculateInitialCamera() {
     if (player) {
        const viewWidth = Config.CANVAS_WIDTH; // internal canvas dimensions
        const viewHeight = Config.CANVAS_HEIGHT;
        cameraScale = 1.0; // reset zoom on new game
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;
        cameraX = (player.x + player.width / 2) - (visibleWorldWidth / 2); // center camera X and Y on the player's center
        cameraY = (player.y + player.height / 2) - (visibleWorldHeight / 2);
        const worldPixelWidth = getWorldPixelWidth(); // clamp camera position to world boundaries
        const worldPixelHeight = getWorldPixelHeight();
        const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth); // calculate max scroll positions based on current scale and ACTUAL world size
        cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
        const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);
        cameraY = Math.max(0, Math.min(cameraY, maxCameraY));
         if (worldPixelWidth <= visibleWorldWidth) { cameraX = (worldPixelWidth - visibleWorldWidth) / 2; } // center camera if world is smaller than viewport (zoomed out too far)
         if (worldPixelHeight <= visibleWorldHeight) { cameraY = (worldPixelHeight - visibleWorldHeight) / 2; }
    }
     else {
         cameraX = 0; cameraY = 0; cameraScale = 1.0; // default camera state if no player
     }
}
// --- Updates the camera position during gameplay ---
function calculateCameraPosition() {
     if (player) { // update camera if player exists
        const viewWidth = Config.CANVAS_WIDTH;
        const viewHeight = Config.CANVAS_HEIGHT;
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;
        let targetX = (player.x + player.width / 2) - (visibleWorldWidth / 2); // Target camera position to center on player
        let targetY = (player.y + player.height / 2) - (visibleWorldHeight / 2);
        cameraX = targetX; // direct follow for now
        cameraY = targetY;
        const worldPixelWidth = getWorldPixelWidth(); // clamp camera position to world boundaries based on current scale and ACTUAL world size
        const worldPixelHeight = getWorldPixelHeight();
        const maxCameraX = Math.max(0, worldPixelWidth - visibleWorldWidth);
        cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
        const maxCameraY = Math.max(0, worldPixelHeight - visibleWorldHeight);
        cameraY = Math.max(0, Math.min(cameraY, maxCameraY));
        if (worldPixelWidth <= visibleWorldWidth) { cameraX = (worldPixelWidth - visibleWorldWidth) / 2; } // Center if world smaller than viewport horizontally
        if (worldPixelHeight <= visibleWorldHeight) { cameraY = (worldPixelHeight - visibleWorldHeight) / 2; } // Center if world smaller than viewport vertically
    }
}

// =============================================================================
// --- Initialization ---
// =============================================================================

function init() {
    currentGameState = GameState.PRE_GAME; // set initial state
    try {
        // get container refs
        appContainer = document.getElementById('app-container');
        gameOverlay = document.getElementById('game-overlay');
        startGameButton = document.getElementById('start-game-button');
        resumeButton = document.getElementById('resume-button');
        restartButtonGameOver = document.getElementById('restart-button-overlay');
        restartButtonVictory = document.getElementById('restart-button-overlay-victory');
        gameOverStatsTextP = document.getElementById('gameover-stats-text');
        victoryStatsTextP = document.getElementById('victory-stats-text');
        // check if all essential elements were found (these are the overlay ones)
        const essentialOverlayElements = [
            appContainer, gameOverlay, startGameButton, resumeButton,
            restartButtonGameOver, restartButtonVictory, gameOverStatsTextP, victoryStatsTextP
        ];
        if (essentialOverlayElements.some(el => !el)) { // find out which specific elements are missing for better debugging
             const missing = essentialOverlayElements.map((el, i) => el ? null : ['appContainer', 'gameOverlay', 'startGameButton', 'resumeButton', 'restartButtonGameOver', 'restartButtonVictory', 'gameover-stats-text', 'victory-stats-text'][i]).filter(id => id !== null);
             throw new Error(`Essential overlay elements not found: ${missing.join(', ')}! Check index.html.`);
        }
// --- Setup Event Listeners (Overlay buttons) ---
        startGameButton.addEventListener('click', startGame);
        resumeButton.addEventListener('click', resumeGame);
        restartButtonGameOver.addEventListener('click', restartGame);
        restartButtonVictory.addEventListener('click', restartGame);
 // --- Initialize Core Systems that DON'T depend on specific game elements ---
        const canvas = document.getElementById('game-canvas');
         if (!canvas) {
             throw new Error("Renderer Init Check: Canvas element 'game-canvas' not found in HTML structure!");
         }
        Renderer.init(); // set internal canvas resolution (1600x800)
        Renderer.createGridCanvas(); // create off-screen canvas (1600x800)
        Input.init();
        AudioManager.init();
        // Initialize Game UI *after* core rendering elements are ready
        if (!UI.initGameUI()) { // initGameUI now also finds the epoch overlay element
             throw new Error("UI initialization failed. Check console for missing elements.");
        }

        // Initialize WaveManager, passing the callback function
        WaveManager.init(handleWaveStart);

        // Show initial title screen overlay
        showOverlay(GameState.PRE_GAME);
    } catch (error) {
        console.error("FATAL: Initialization Error:", error);
        if (gameOverlay) { // Clear overlay content and show error
            // Ensure gameOverlay has a height/width to be visible if init fails early
            gameOverlay.style.width = '100%';
            gameOverlay.style.height = '100%';
            gameOverlay.style.position = 'fixed'; // Ensure it covers the screen
            gameOverlay.style.top = '0';
            gameOverlay.style.left = '0';
            gameOverlay.style.display = 'flex'; // Make it a flex container
            gameOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
            gameOverlay.style.color = 'red';
            gameOverlay.style.zIndex = '1000'; // Ensure it's on top
            gameOverlay.style.justifyContent = 'center';
            gameOverlay.style.alignItems = 'center';
            gameOverlay.style.flexDirection = 'column';
            gameOverlay.style.textAlign = 'center';

            gameOverlay.innerHTML = `
                <div id="overlay-error-content" style="display: flex; flex-direction: column; align-items: center;">
                    <h1 style="font-size: 2em; margin-bottom: 1rem;">Initialization Error</h1>
                    <p style="font-size: 1.2em; margin-bottom: 1rem;">${error.message}</p>
                    <p style="font-size: 1em;">Please check the console (F12) for more details and refresh.</p>
                </div>`;
            gameOverlay.classList.add('active'); // Ensure opacity is 1 if CSS transition applied
            if(appContainer) appContainer.classList.add('overlay-active');
             AudioManager.stopAllMusic(); // ensure music is stopped if an init error occurs
        } else {
            alert(`FATAL Initialization Error:\n${error.message}\nPlease check console (F12) and refresh.`);
        }
    }
        lastTime = 0; // double-check lastTime is initialized to 0 globally when script loads
}
// --- Start Initialization When DOM is Ready ---
window.addEventListener('DOMContentLoaded', init);