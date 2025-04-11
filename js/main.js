// -----------------------------------------------------------------------------
// root/js/main.js - Game Entry Point and Main Loop
// -----------------------------------------------------------------------------

// --- Module Imports ---
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
import * as WorldData from './utils/worldData.js';
import * as GridCollision from './utils/gridCollision.js'; // Needed for worldToGridCoords

// --- Global Game Variables ---
let player = null;
let gameRunning = true;
let lastTime = 0;
let restartBtnRef = null; // Variable to hold button reference

// --- Camera State ---
let cameraX = 0;
let cameraY = 0;
let cameraScale = 1.0; // 1.0 = normal zoom

// --- Function to handle scale updates from input ---
// Make it globally accessible IF input.js calls it directly (simplest way for now)
window.updateCameraScale = function(deltaScale) {
    const oldScale = cameraScale; // Store old scale if needed for centering adjustments (optional)
    // Calculate and clamp new scale
    let newScale = cameraScale + deltaScale;
    newScale = Math.max(Config.MIN_CAMERA_SCALE, Math.min(newScale, Config.MAX_CAMERA_SCALE)); // Use Config limits
    cameraScale = newScale;
}

// --- Coordinate Conversion Helpers ---
function getMouseWorldCoords(canvasX, canvasY) {
    // Convert canvas coordinates to world coordinates
    const worldX = cameraX + (canvasX / cameraScale);
    const worldY = cameraY + (canvasY / cameraScale);
    return { x: worldX, y: worldY };
}

function getMouseGridCoords(canvasX, canvasY) {
    const { x: worldX, y: worldY } = getMouseWorldCoords(canvasX, canvasY);
    // Convert world coordinates to grid coordinates
    return GridCollision.worldToGridCoords(worldX, worldY);
}

function isTargetWithinRange(player, targetWorldPos) {
    if (!player || !targetWorldPos) return false;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    const dx = targetWorldPos.x - playerCenterX;
    const dy = targetWorldPos.y - playerCenterY;
    return (dx * dx + dy * dy) <= Config.PLAYER_INTERACTION_RANGE_SQ;
}

// --- Function to log the world grid ---
function logWorldGrid() {
    console.log("--- World Grid Debug Output ---");
    console.time("GridLog Generation"); // Optional: time how long it takes

    const blockToChar = {
        [Config.BLOCK_AIR]: ' ', // Use space for air for better visual clarity
        [Config.BLOCK_WATER]: '~', // Tilde often used for water
        [Config.BLOCK_SAND]: '.', // Dot for sand
        [Config.BLOCK_DIRT]: '#', // Hash for dirt
        [Config.BLOCK_GRASS]: '"', // Double quote for grass tufts
        [Config.BLOCK_STONE]: 'R', // R for Rock/Stone
        [Config.BLOCK_WOOD_WALL]: 'P', // P for Plank/Wood Wall
        [Config.BLOCK_METAL]: 'M', // M for Metal
        // Add mappings for any other block types you have
    };
    const defaultChar = '?'; // Character for unknown block types

    let gridString = "";
    const gridHeight = Config.GRID_ROWS;
    const gridWidth = Config.GRID_COLS;

    for (let r = 0; r < gridHeight; r++) {
        let rowString = "";
        for (let c = 0; c < gridWidth; c++) {
            const blockType = WorldData.getBlockType(c, r); // Use the getter
            const char = blockToChar[blockType] ?? defaultChar; // Get char or default
            rowString += char;
        }
        gridString += rowString + "\n"; // Add the completed row and a newline
    }

    console.log(gridString);
    console.timeEnd("GridLog Generation"); // Optional: end timer
    console.log("--- End World Grid Debug Output ---");
}

// --- Restart Game Function ---
function restartGame() {
    console.log(">>> RESTARTING GAME <<<");
    // Reset Player (or create new)
    if (!player) {
        player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
    } else {
        player.reset();
    }

    // Reset managers to clear old data
    WorldData.initializeGrid();
    World.init();
    ItemManager.init();
    EnemyManager.clearAllEnemies();
    WaveManager.reset();

    // Reset Game Loop State
    lastTime = performance.now();
    gameRunning = true;
    Input.consumeClick();

    // Initial UI Update after reset
    const waveInfo = WaveManager.getWaveInfo();
    const livingEnemies = EnemyManager.getLivingEnemyCount();
    UI.updateWaveInfo(waveInfo, livingEnemies);
    UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus(), player.getSpearStatus(), player.getShovelStatus()); // remember to add new weapons here
    UI.updateGameOverState(false);

    // Console log depiction of generated world
    logWorldGrid();
    console.log(">>> GAME RESTARTED <<<");
}

// --- Game Loop ---
function gameLoop(timestamp) {
    // --- Delta Time Calc ---
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    const dt = Math.min(deltaTime, Config.MAX_DELTA_TIME);

    // --- Game Over Check ---
    let isGameOver = WaveManager.isGameOver();
    if (!isGameOver && player && player.getCurrentHealth() <= 0) {     // Check player health AFTER potential updates/collisions
        console.log("Game Over detected in loop (Player health <= 0). Setting state.");
        WaveManager.setGameOver();
        isGameOver = true; // Update local flag for this frame
        UI.updateGameOverState(true, WaveManager.getCurrentWaveNumber());     // Check wave manager state as well
    }

    // --- Handle GAME OVER state ---
    if (isGameOver) {
        // Render final scene
        Renderer.clear();
        World.draw(Renderer.getContext());
        ItemManager.draw(Renderer.getContext());
        EnemyManager.draw(Renderer.getContext());
        if (player) player.draw(Renderer.getContext());
        // Update UI (wave info shows game over, player info shows final state)
        const waveInfo = WaveManager.getWaveInfo();
        const livingEnemies = EnemyManager.getLivingEnemyCount();
        UI.updateWaveInfo(waveInfo, livingEnemies);
         if (player) {
            UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus(), player.getSpearStatus(), player.getShovelStatus());
         }

        // Draw touch controls
        Input.drawControls(Renderer.getContext());

        requestAnimationFrame(gameLoop);
        return;
    }
    
    // --- When Game is Active, Proceed with Normal Loop ---
    // if (!gameRunning) return; // Keep if you want an explicit pause flag later

    // --- Input Phase ---
    const inputState = Input.getState();
    const mousePos = Input.getMousePosition(); // Get canvas mouse coords
    let targetWorldPos = getMouseWorldCoords(mousePos.x, mousePos.y); // Convert to world coords
    let targetGridCell = getMouseGridCoords(mousePos.x, mousePos.y); // Convert to grid coords

    // Clamp target to interaction range if needed
    if (player && !isTargetWithinRange(player, targetWorldPos)) {
        // You could potentially clamp the target to the max range, or just null it out
        // For now, let's keep the target but player logic will need to check range
    }
    // --- Get Player Position for AI ---
    let currentPlayerPosition = null;
    if (player && player.getCurrentHealth() > 0) {
        currentPlayerPosition = player.getPosition();
    }

    // --- Update Phase (Game Logic) ---
    if (player) {
        player.update(dt, inputState, targetWorldPos, targetGridCell); // Pass target info
    }
    ItemManager.update(dt);
    EnemyManager.update(dt, currentPlayerPosition); // Pass player pos to enemies
    WaveManager.update(dt);
    World.update(dt); // World updates (e.g., block changes) - Placeholder

    // --- Camera Calculation ---
    const ctx = Renderer.getContext(); // Get context for dimensions if needed
    const viewWidth = ctx.canvas.width;
    const viewHeight = ctx.canvas.height;
    const worldPixelWidth = Config.CANVAS_WIDTH;  // Total world size (potentially larger later)
    const worldPixelHeight = Config.CANVAS_HEIGHT; // Total world size

    if (player) {
        // Calculate desired world coordinates visible at the edges of the screen
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;

        // Calculate the desired top-left camera corner position to center the player
        // Target: (player center) - (half of visible world size)
        cameraX = (player.x + player.width / 2) - (visibleWorldWidth / 2);
        cameraY = (player.y + player.height / 2) - (visibleWorldHeight / 2);

        // Clamp camera X
        const maxCameraX = worldPixelWidth - visibleWorldWidth;
        cameraX = Math.max(0, Math.min(cameraX, maxCameraX));

        // Clamp camera Y
        const maxCameraY = worldPixelHeight - visibleWorldHeight;
        cameraY = Math.max(0, Math.min(cameraY, maxCameraY));

        // Handle cases where world is smaller than viewport (prevent NaN/negative max)
        if (worldPixelWidth < visibleWorldWidth) { cameraX = (worldPixelWidth - visibleWorldWidth) / 2; } // Center world horizontally
        if (worldPixelHeight < visibleWorldHeight) { cameraY = (worldPixelHeight - visibleWorldHeight) / 2; } // Center world vertically
    } else {
        // Default camera position if no player (e.g., center of world)
        cameraX = (worldPixelWidth - viewWidth / cameraScale) / 2;
        cameraY = (worldPixelHeight - viewHeight / cameraScale) / 2;
        // Apply clamping just in case
        cameraX = Math.max(0, Math.min(cameraX, worldPixelWidth - viewWidth / cameraScale));
        cameraY = Math.max(0, Math.min(cameraY, worldPixelHeight - viewHeight / cameraScale));
    }

    // --- Collision Detection Phase ---
    if (player) {
        CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
        CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
        CollisionManager.checkPlayerAttackBlockCollisions(player); // Add block collision check
        CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies());
    }
    // Other collision checks (e.g., enemy projectiles - future)

    // --- Render Phase (Canvas) ---
    Renderer.clear(); // Clear canvas
    const mainCtx = Renderer.getContext(); // Use mainCtx alias for clarity
    mainCtx.save(); // Save context state
    // Apply Camera Transformations (Scale THEN Translate)
    mainCtx.scale(cameraScale, cameraScale);
    mainCtx.translate(-cameraX, -cameraY);

    // --- Draw World Elements (Relative to World Coords) ---
    World.draw(mainCtx); // Draw static world (already translated/scaled)
    ItemManager.draw(mainCtx); // Draw items
    EnemyManager.draw(mainCtx); // Draw enemies
    if (player) { player.draw(mainCtx); } // Draw player

    mainCtx.restore(); // Restore context to un-scaled, un-translated state

     // --- Draw Fixed UI Elements (Relative to Screen Coords) ---
    Input.drawControls(mainCtx); // Draw touch controls *after* restore

    // --- Render Phase (HTML UI) ---
    // Update sidebar information
    const waveInfo = WaveManager.getWaveInfo();
    const livingEnemies = EnemyManager.getLivingEnemyCount(); // Get current enemy count
    UI.updateWaveInfo(waveInfo, livingEnemies); // Update left sidebar
    if (player) {
        UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus(), player.getSpearStatus(), player.getShovelStatus()); // Update right sidebar with more weapons
    }
    // Ensure restart button remains hidden during active gameplay
    UI.updateGameOverState(false); // Call this every frame when game is running
    // --- Draw Touch Controls (Still on Canvas) ---
    Input.drawControls(Renderer.getContext());
    // Consume click state (relevant for attack)
    Input.consumeClick();
    // --- Loop Continuation ---
    requestAnimationFrame(gameLoop);
}

// --- Initialization ---
function init() {
    console.log("Resources loaded, initializing game...");
    let initializationOk = true;
    try {
        UI.init(); // Initialize UI element references FIRST
        Renderer.init();
        Renderer.createGridCanvas(); // Create canvas for world render
        Input.init(); // Setup input listeners
        WorldData.initializeGrid(); // Ensures grid array is created
        World.init(); // Init world data and static render
        logWorldGrid();
        ItemManager.init();
        EnemyManager.init();
        WaveManager.init(); // Init wave manager state
    } catch (error) {
        console.error("FATAL: Module Initialization Error:", error);
        initializationOk = false;
    }

    if (initializationOk) {
        try {
// Create Player instance
            player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
// Pass player reference to UI for weapon switching etc.
            UI.setPlayerReference(player);
            UI.updatePlayerInfo(player.getCurrentHealth(), player.getMaxHealth(), player.getInventory(), player.getSwordStatus(), player.getSpearStatus(), player.getShovelStatus()); // Initial UI update, might have to add new weapons
        } catch (error) {
            console.error("FATAL: Player Creation Error:", error);
            initializationOk = false;
            // Display error
        }
        restartBtnRef = document.getElementById('restart-button');
        if (restartBtnRef) {
            restartBtnRef.addEventListener('click', () => {
                console.log("Restart button clicked!");
                // Only restart if game is actually over
                if (WaveManager.isGameOver()) {
                    restartGame();
                }
            });
        } else {
            console.warn("Restart button element not found during init.");
        }
    }

    if (initializationOk) {
        Input.consumeClick(); // Clear any initial clicks
        lastTime = performance.now(); // Set start time for dt calculation
        // --- Initial Camera Calculation ---
        // Calculate initial camera pos based on player start AFTER player exists
        if (player) {
            const viewWidth = Renderer.getCanvas().width;
            const viewHeight = Renderer.getCanvas().height;
            const visibleWorldWidth = viewWidth / cameraScale;
            const visibleWorldHeight = viewHeight / cameraScale;
            cameraX = (player.x + player.width / 2) - (visibleWorldWidth / 2);
            cameraY = (player.y + player.height / 2) - (visibleWorldHeight / 2);
            // Clamp initial camera position too
            const worldPixelWidth = Config.CANVAS_WIDTH;
            const worldPixelHeight = Config.CANVAS_HEIGHT;
            const maxCameraX = worldPixelWidth - visibleWorldWidth;
            cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
            const maxCameraY = worldPixelHeight - visibleWorldHeight;
            cameraY = Math.max(0, Math.min(cameraY, maxCameraY));
             if (worldPixelWidth < visibleWorldWidth) { cameraX = (worldPixelWidth - visibleWorldWidth) / 2; }
             if (worldPixelHeight < visibleWorldHeight) { cameraY = (worldPixelHeight - visibleWorldHeight) / 2; }
       }
       // --- End Initial Camera Calc ---
        // gameRunning = true; // Not strictly needed if relying on game over state
        requestAnimationFrame(gameLoop); // Start the main loop
        UI.updateGameOverState(false); // Ensure button is hidden initially
        // console.log("Game initialization complete. Starting loop.");
    } else {
        console.error("Game initialization failed. Game will not start.");
    }
}
// --- Start the Game ---
window.addEventListener('DOMContentLoaded', init); // Run init after HTML is ready