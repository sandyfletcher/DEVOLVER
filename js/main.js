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
    }

    // --- Handle GAME OVER state ---
    if (WaveManager.isGameOver()) {
        Renderer.clear();
        // Draw final state
        World.draw(Renderer.getContext());
        ItemManager.draw(Renderer.getContext());
        EnemyManager.draw(Renderer.getContext());
        if (player) player.draw(Renderer.getContext());
        // Draw Game Over UI
        if (player) {
           const waveInfo = WaveManager.getWaveInfo();
           UI.draw(Renderer.getContext(), player.getCurrentHealth(), player.getMaxHealth(), waveInfo);
        }
        // Check for restart click
        if (Input.didClickPlayAgain()) {
            console.log("Play Again button clicked!");
            restartGame();
            requestAnimationFrame(gameLoop); // Start new loop after restart
            return; // Exit this game over frame
        }
        // Draw touch controls on game over screen too
        Input.drawControls(Renderer.getContext());
        // Keep requesting frames for game over screen
        requestAnimationFrame(gameLoop);
        return; // Exit this game over frame
    }

    // --- If Game is Active, Proceed with Normal Loop ---
    if (!gameRunning) return;

    // --- Delta Time Calc ---
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    const dt = Math.min(deltaTime, Config.MAX_DELTA_TIME);

    // --- Input Phase ---
    const inputState = Input.getState();

    // --- Get Player Position ---
    let currentPlayerPosition = null;
    if (player && player.getCurrentHealth() > 0) {
        currentPlayerPosition = player.getPosition();
    }

    // --- Update Phase ---
    // Player update can happen early
    if (player) { player.update(dt, inputState); }
    ItemManager.update(dt); // Update items

    // --- VVV CHANGE ORDER HERE VVV ---
    // Update Enemy Manager FIRST to remove dead enemies from last frame
    EnemyManager.update(dt, currentPlayerPosition);
    // Update Wave Manager AFTER enemies are cleaned up, so living count is accurate
    WaveManager.update(dt);
    // --- END CHANGE ORDER ---

    World.update(dt); // World updates (e.g., block changes)

    // --- Collision Detection Phase ---
    if (player) {
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

    // --- Draw In-Game UI --- (FIXED SECTION)
    if (player) {
        const waveInfo = WaveManager.getWaveInfo();
        // Separate line for UI.draw
        UI.draw(Renderer.getContext(), player.getCurrentHealth(), player.getMaxHealth(), waveInfo);
    } // <-- Added missing closing brace for the inner if(player)

    // Draw touch controls AFTER other elements
    Input.drawControls(Renderer.getContext());


    // --- End of Frame Logic ---
    // Consume click state only if the game isn't over (handled separately above)
    Input.consumeClick(); // Consume click regardless of wave state if game running

    // --- Loop Continuation ---
    requestAnimationFrame(gameLoop);

} // --- End of gameLoop Function ---
// 
// // --- Initialization ---
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