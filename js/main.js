// -----------------------------------------------------------------------------
// main.js - Game Entry Point and Main Loop
// -----------------------------------------------------------------------------

console.log("main.js loaded");

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

// --- Global Game Variables ---
let player = null;
let gameRunning = true;
let lastTime = 0;

// --- Restart Game Function ---
function restartGame() {
    console.log(">>> RESTARTING GAME <<<");
    if (player) {player.reset();
    } else {player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);}
    ItemManager.init();
    EnemyManager.clearAllEnemies();
    WaveManager.reset();
    lastTime = performance.now();
    gameRunning = true;
    Input.consumeClick();
    console.log(">>> GAME RESTARTED <<<");
}
// --- Game Loop ---
function gameLoop(timestamp) {
// --- Game Over Check ---
    if (player && player.getCurrentHealth() <= 0 && !WaveManager.isGameOver()) {
        console.log("Game Over detected in loop (Player health <= 0).");
        WaveManager.setGameOver();
        // if (player) { player.stopMovement(); } --- Stop player movement immediately if needed ---
    }
// --- Handle GAME OVER state ---
    if (WaveManager.isGameOver()) {
        Renderer.clear();
// --- Draw final state: world->items->enemies->player ---
        World.draw(Renderer.getContext());
        ItemManager.draw(Renderer.getContext());
        EnemyManager.draw(Renderer.getContext());
        if (player) player.draw(Renderer.getContext());
// --- Draw Game Over UI ---
        if (player) {
           const waveInfo = WaveManager.getWaveInfo(); // Get and print wave info
           UI.draw(Renderer.getContext(), player.getCurrentHealth(), player.getMaxHealth(), waveInfo);
        }
// --- Check for restart click ---
        if (Input.didClickPlayAgain()) {
            console.log("Play Again button clicked!");
            restartGame();
            requestAnimationFrame(gameLoop);
            return;
        }
// --- raw touch controls if needed ---
        Input.drawControls(Renderer.getContext());
// --- Keep requesting frames to draw the game over screen and check for clicks ---
        requestAnimationFrame(gameLoop);
        return; 
    }
// --- If Game is Active, Proceed with Normal Loop ---
    if (!gameRunning) return; // Allow pausing in the future
// --- Delta Time Calc ---
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    const dt = Math.min(deltaTime, Config.MAX_DELTA_TIME);
// --- Input Phase ---
    const inputState = Input.getState();
// --- Update Phase ---
    WaveManager.update(dt);
    if (player) { player.update(dt, inputState); }
    ItemManager.update(dt);
    EnemyManager.update(dt);
    World.update(dt);
// --- Collision Detection Phase ---
    if (player) { // Only check collisions if the player exists
        CollisionManager.checkPlayerItemCollisions(player, ItemManager.getItems(), ItemManager);
        CollisionManager.checkPlayerAttackEnemyCollisions(player, EnemyManager.getEnemies());
        CollisionManager.checkPlayerEnemyCollisions(player, EnemyManager.getEnemies());
    }
// --- Render Phase ---
    Renderer.clear();
    World.draw(Renderer.getContext());
    ItemManager.draw(Renderer.getContext());
    EnemyManager.draw(Renderer.getContext());
    if (player) { player.draw(Renderer.getContext()); }
    if (player) {
        const waveInfo = WaveManager.getWaveInfo();
        UI.draw(Renderer.getContext(), player.getCurrentHealth(), player.getMaxHealth(), waveInfo);
    }
    Input.drawControls(Renderer.getContext());
// --- ---
    if (!WaveManager.isGameOver()) {
        Input.consumeClick();
    }
// --- Loop Continuation ---
    requestAnimationFrame(gameLoop);
}
// --- Initialization ---
function init() {
    console.log("Initializing game...");
    let initializationOk = true;
    try {
        Renderer.init();
        Renderer.createGridCanvas();
        Input.init();
        World.init();
        ItemManager.init();
        EnemyManager.init();
        WaveManager.init();
    } catch (error) {
        console.error("FATAL: Module Initialization Error:", error);
        initializationOk = false;
        gameRunning = false;
    }
// --- ---
if (initializationOk) {
        try {
            player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
        } catch (error) {
            console.error("FATAL: Player Creation Error:", error);
            initializationOk = false;
            gameRunning = false;
        }
    }
// --- Reset click flag on initial load ---
    Input.consumeClick();
// --- ---
    if (initializationOk) {
        lastTime = performance.now();
        gameRunning = true;
        requestAnimationFrame(gameLoop);
        console.log("Game initialization complete. Starting loop.");
    } else {
        console.error("Game initialization failed. Game will not start.");
    }
}
// --- Start the Game ---
window.addEventListener('DOMContentLoaded', init);