// -----------------------------------------------------------------------------
// main.js - Game Entry Point and Main Loop
// -----------------------------------------------------------------------------
console.log("main.js loaded");

// --- Module Imports ---
import * as Config from './config.js';
import * as Input from './input.js';
import * as Renderer from './renderer.js';
import * as World from './world.js';
import { Player } from './player.js';
import * as ItemManager from './itemManager.js';
import * as EnemyManager from './enemyManager.js';
import * as UI from './ui.js';

// --- Global Game Variables ---
let player = null;
let gameRunning = true;
let lastTime = 0;

// --- Wave System State ---
let currentWaveNumber = 0;
let waveState = 'PRE_WAVE';
let waveTimer; // Declare but assign in init
let enemiesToSpawnThisWave = 0;
let enemiesSpawnedThisWave = 0;
let enemySpawnDelayTimer = 0;

// --- Collision Detection Helpers ---
function checkCollision(rect1, rect2) {
    if (!rect1 || !rect2) { return false; }
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function checkPlayerItemCollisions() {
    if (!player) return;
    const items = ItemManager.getItems();
    const playerRect = player.getRect();
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        const itemRect = item.getRect();
        if (checkCollision(playerRect, itemRect)) {
            const pickedUp = player.pickupItem(item);
            if (pickedUp) { ItemManager.removeItem(item); }
        }
    }
}

function checkAttackEnemyCollisions() {
    if (!player || !player.isAttacking) { return; }
    const attackHitbox = player.getAttackHitbox();
    if (!attackHitbox) return;
    const enemies = EnemyManager.getEnemies();
    for (const enemy of enemies) {
        if (enemy.isActive && checkCollision(attackHitbox, enemy.getRect())) {
            if (!player.hasHitEnemyThisSwing(enemy)) {
                enemy.takeDamage(Config.PLAYER_ATTACK_DAMAGE);
                player.registerHitEnemy(enemy);
            }
        }
    }
}

function checkPlayerEnemyCollisions() {
    if (!player || player.isInvulnerable) { return; }
    const enemies = EnemyManager.getEnemies();
    const playerRect = player.getRect();
    for (const enemy of enemies) {
        if (enemy.isActive && checkCollision(playerRect, enemy.getRect())) {
            player.takeDamage(Config.ENEMY_CONTACT_DAMAGE);
            break;
        }
    }
}

// --- Wave Management Functions ---

function startWave(waveNum) {
    console.log(`STARTING WAVE ${waveNum}. Setting state to SPAWNING.`);
    currentWaveNumber = waveNum;
    waveState = 'SPAWNING';
    enemiesSpawnedThisWave = 0;
    enemySpawnDelayTimer = Config.WAVE_ENEMY_SPAWN_DELAY;

    if (waveNum === 1) {
        enemiesToSpawnThisWave = Config.WAVE_1_ENEMY_COUNT;
    } else {
        enemiesToSpawnThisWave = Config.WAVE_1_ENEMY_COUNT + (waveNum - 1) * 5;
    }
    console.log(`Enemies to spawn: ${enemiesToSpawnThisWave}`);
}

function updateWaveSystem(dt) {
    // Optional overall log
    // console.log(`[Wave Update] State: ${waveState}, Timer: ${waveTimer?.toFixed(2)}, DT: ${dt?.toFixed(4)}, Enemies Living: ${EnemyManager.getLivingEnemyCount()}`);

    if (waveState === 'PRE_WAVE') {
        // ... (PRE_WAVE logic - seems ok) ...
         waveTimer -= dt;
         if (waveTimer <= 0) {
             console.log("PRE_WAVE timer finished. Attempting to start Wave 1.");
             startWave(1);
         }
    }
    else if (waveState === 'SPAWNING') {
        // --- ADD DETAILED LOGS HERE ---
        console.log(`[Spawning Update] Enemies Spawned: ${enemiesSpawnedThisWave}/${enemiesToSpawnThisWave}. Delay Timer: ${enemySpawnDelayTimer.toFixed(3)}`);

        // Check if finished spawning
        if (enemiesSpawnedThisWave >= enemiesToSpawnThisWave) {
            console.log(`[Spawning Update] Condition met: All enemies spawned (${enemiesSpawnedThisWave}). Changing state to ACTIVE.`);
            waveState = 'ACTIVE';
            return; // Stop further processing in this block
        }

        // Decrement spawn delay timer
        enemySpawnDelayTimer -= dt;
        console.log(`[Spawning Update] Decremented Delay Timer to: ${enemySpawnDelayTimer.toFixed(3)}`);

        // Check if timer is ready
        if (enemySpawnDelayTimer <= 0) {
            console.log(`[Spawning Update] Delay timer <= 0. Attempting spawn via EnemyManager.trySpawnEnemy().`);
            const spawned = EnemyManager.trySpawnEnemy(); // Attempt the spawn

            if (spawned) {
                enemiesSpawnedThisWave++;
                console.log(`[Spawning Update] Spawn SUCCESS! enemiesSpawnedThisWave now ${enemiesSpawnedThisWave}. Resetting delay timer.`);
                enemySpawnDelayTimer = Config.WAVE_ENEMY_SPAWN_DELAY; // Reset delay for next spawn
            } else {
                 console.warn(`[Spawning Update] Spawn FAILED (trySpawnEnemy returned false - max enemies reached?). Retrying shortly.`);
                 enemySpawnDelayTimer = 0.1; // Set short delay before retrying
            }
        }
        // --- END DETAILED LOGS ---
    }
    else if (waveState === 'ACTIVE') {
        // ... (ACTIVE logic - seems ok) ...
         if (EnemyManager.getLivingEnemyCount() === 0 && enemiesSpawnedThisWave >= enemiesToSpawnThisWave) {
            console.log(`--- Wave ${currentWaveNumber} Cleared! Setting state to INTERMISSION. ---`);
            waveState = 'INTERMISSION';
            waveTimer = Config.WAVE_INTERMISSION_DURATION;
         }
    }
    else if (waveState === 'INTERMISSION') {
        // ... (INTERMISSION logic - seems ok) ...
         waveTimer -= dt;
         if (waveTimer <= 0) {
             console.log("Intermission finished. Attempting to start next wave.");
             startWave(currentWaveNumber + 1);
         }
    }
    else if (waveState === 'GAME_OVER') {
        // Do nothing
    }
}

// --- NEW Restart Game Function ---
function restartGame() {
    console.log(">>> RESTARTING GAME <<<");

    // 1. Reset Player
    if (player) {
        player.reset();
    } else { // Should not happen, but safety check
        player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR);
    }

    // 2. Reset Items (re-run init which clears and adds sword)
    ItemManager.init();

    // 3. Reset Enemies
    EnemyManager.clearAllEnemies();

    // 4. Reset Wave System
    currentWaveNumber = 0;
    waveState = 'PRE_WAVE'; // Go back to the initial delay state
    waveTimer = Config.WAVE_START_DELAY;
    enemiesToSpawnThisWave = 0;
    enemiesSpawnedThisWave = 0;
    enemySpawnDelayTimer = 0;

    // 5. Reset Timings and Flags
    lastTime = performance.now(); // Reset delta time calculation starting point
    gameRunning = true; // Ensure game is marked as running

    // 6. Consume any click that triggered the restart
    Input.consumeClick();

    // 7. Restart the animation loop if it was fully stopped (optional, depends on game over handling)
    // Our current loop doesn't fully stop, just skips updates, so no need to re-request frame here.
    console.log(">>> GAME RESTARTED <<<");
}
// --- END Restart Game Function ---
// 
// // --- Game Loop ---
function gameLoop(timestamp) {
    // --- Game Over Check ---
    if (player && player.getCurrentHealth() <= 0 && waveState !== 'GAME_OVER') {
        console.log("Game Over detected in loop.");
        waveState = 'GAME_OVER';
        // Maybe stop player movement explicitly?
        // if (player) { player.vx = 0; }
    }

    // --- Handle GAME OVER state (Drawing & Restart Check) ---
     if (waveState === 'GAME_OVER') {
          Renderer.clear();
          // Draw world/items/enemies in their final state
          World.draw(Renderer.getContext());
          ItemManager.draw(Renderer.getContext());
          EnemyManager.draw(Renderer.getContext());
          if (player) player.draw(Renderer.getContext());

          // Draw the Game Over UI (which includes the button)
          if (player) { // Need player health for UI even if dead
             UI.draw(Renderer.getContext(), player.getCurrentHealth(), player.getMaxHealth(), { state: waveState, number: currentWaveNumber, timer: waveTimer });
          }

          // Check for restart click
          if (Input.didClickPlayAgain()) {
              console.log("Play Again button clicked!");
              Input.consumeClick(); // Consume the click so it's not processed again
              restartGame(); // Call the restart function
              // Need to request the next frame to continue after restart
              requestAnimationFrame(gameLoop);
              return; // Exit this frame early after initiating restart
          }

          // Keep drawing touch controls even in game over? Optional.
          Input.drawControls(Renderer.getContext());

          // Request the next frame to keep drawing the game over screen / checking for clicks
          requestAnimationFrame(gameLoop);
          return; // Skip the rest of the update/render logic
     }

    // --- If Not Game Over, Proceed with Normal Loop ---
    if (!gameRunning) return; // Allow pausing

    // --- Delta Time Calc ---
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    const dt = Math.min(deltaTime, Config.MAX_DELTA_TIME);

    // --- Input Phase ---
    const inputState = Input.getState();

    // --- Update Phase ---
    updateWaveSystem(dt);
    if (player) { player.update(dt, inputState); }
    ItemManager.update(dt);
    EnemyManager.update(dt);
    World.update(dt);

    // --- Collision Detection Phase ---
    checkPlayerItemCollisions();
    checkAttackEnemyCollisions();
    checkPlayerEnemyCollisions();

    // --- Render Phase ---
    Renderer.clear();
    World.draw(Renderer.getContext());
    ItemManager.draw(Renderer.getContext());
    EnemyManager.draw(Renderer.getContext());
    if (player) { player.draw(Renderer.getContext()); }
    if(player) {
        UI.draw(Renderer.getContext(), player.getCurrentHealth(), player.getMaxHealth(), { number: currentWaveNumber, state: waveState, timer: waveTimer });
    }
    Input.drawControls(Renderer.getContext());

    // --- Consume Click Flag (if not used for restart) ---
    Input.consumeClick(); // Reset click flag at end of frame

    // --- Loop Continuation ---
    requestAnimationFrame(gameLoop);
}

// --- Initialization ---
function init() {
    console.log("Initializing game with Health & Waves...");
    let initializationOk = true;
    try {
        Renderer.init();
        Renderer.createGridCanvas();
        Input.init();
        World.init();
        ItemManager.init();
        EnemyManager.init();
    } catch (error) { console.error("FATAL: Init Error:", error); initializationOk = false; gameRunning = false; }

    if (initializationOk) {
        try { player = new Player(Config.PLAYER_START_X, Config.PLAYER_START_Y, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT, Config.PLAYER_COLOR); }
        catch (error) { console.error("FATAL: Player Creation Error:", error); initializationOk = false; gameRunning = false; }
    }

    // Initialize Wave State
    currentWaveNumber = 0;
    waveState = 'PRE_WAVE';
    waveTimer = Config.WAVE_START_DELAY;
    enemiesToSpawnThisWave = 0;
    enemiesSpawnedThisWave = 0;
    enemySpawnDelayTimer = 0;
    // Reset click flag on init too
    Input.consumeClick();

    if (initializationOk) {
        lastTime = performance.now();
        gameRunning = true;
        requestAnimationFrame(gameLoop);
        console.log("Game initialization complete. Starting loop.");
    } else { console.error("Game initialization failed."); }
}

// --- Start the Game ---
window.addEventListener('DOMContentLoaded', init);