// js/waveManager.js
import * as Config from './config.js';
import * as EnemyManager from './enemyManager.js'; // Needs EnemyManager to spawn and check counts

console.log("waveManager.js loaded");

// --- Module State ---
let currentWaveNumber = 0;
let state = 'PRE_WAVE'; // Possible states: PRE_WAVE, SPAWNING, ACTIVE, INTERMISSION, GAME_OVER
let timer = 0;
let enemiesToSpawnThisWave = 0;
let enemiesSpawnedThisWave = 0;
let enemySpawnDelayTimer = 0;

// --- Internal Helper Functions ---

// Renamed from main.js's startWave, now internal to the manager
function setupNextWave(waveNum) {
    console.log(`[WaveManager] Setting up Wave ${waveNum}. State: SPAWNING.`);
    currentWaveNumber = waveNum;
    state = 'SPAWNING';
    enemiesSpawnedThisWave = 0;
    enemySpawnDelayTimer = Config.WAVE_ENEMY_SPAWN_DELAY; // Initial delay before first spawn

    // Example scaling - adjust as needed
    if (waveNum === 1) {
        enemiesToSpawnThisWave = Config.WAVE_1_ENEMY_COUNT;
    } else {
        // Example: Increase by 5 each wave, but maybe add variety later
        enemiesToSpawnThisWave = Config.WAVE_1_ENEMY_COUNT + (waveNum - 1) * 5;
    }
    console.log(`[WaveManager] Enemies to spawn this wave: ${enemiesToSpawnThisWave}`);
}


// --- Exported Functions ---

export function init() {
    console.log("[WaveManager] Initializing...");
    currentWaveNumber = 0;
    state = 'PRE_WAVE';
    timer = Config.WAVE_START_DELAY;
    enemiesToSpawnThisWave = 0;
    enemiesSpawnedThisWave = 0;
    enemySpawnDelayTimer = 0;
    console.log(`[WaveManager] Initial state: ${state}, Timer: ${timer}`);
}

export function reset() {
    console.log("[WaveManager] Resetting...");
    init(); // Re-initialize to default state
}

export function update(dt) {
    // Logging for state transitions or key events
    // console.log(`[Wave Update] State: ${state}, Timer: ${timer?.toFixed(2)}, DT: ${dt?.toFixed(4)}, Enemies Living: ${EnemyManager.getLivingEnemyCount()}`);

    switch (state) {
        case 'PRE_WAVE':
            timer -= dt;
            if (timer <= 0) {
                console.log("[WaveManager] PRE_WAVE timer finished. Starting Wave 1.");
                setupNextWave(1);
            }
            break;

        case 'SPAWNING':
             // Check if finished spawning ALL enemies for this wave
             if (enemiesSpawnedThisWave >= enemiesToSpawnThisWave) {
                console.log(`[WaveManager] Finished spawning ${enemiesSpawnedThisWave}/${enemiesToSpawnThisWave}. Changing state to ACTIVE.`);
                state = 'ACTIVE';
                timer = 0; // Reset timer for potential future use in ACTIVE state?
                return; // Exit spawning logic
            }

            // Decrement spawn delay timer
            enemySpawnDelayTimer -= dt;

            // Check if timer is ready to spawn ONE enemy
            if (enemySpawnDelayTimer <= 0) {
                // console.log(`[WaveManager] Attempting spawn via EnemyManager.trySpawnEnemy(). Spawned so far: ${enemiesSpawnedThisWave}`);
                const spawned = EnemyManager.trySpawnEnemy(); // Attempt the spawn

                if (spawned) {
                    enemiesSpawnedThisWave++;
                    // console.log(`[WaveManager] Spawn SUCCESS! enemiesSpawnedThisWave now ${enemiesSpawnedThisWave}. Resetting delay timer.`);
                    enemySpawnDelayTimer = Config.WAVE_ENEMY_SPAWN_DELAY; // Reset delay for next spawn
                } else {
                    // console.warn(`[WaveManager] Spawn FAILED (trySpawnEnemy returned false - max enemies reached?). Retrying shortly.`);
                    enemySpawnDelayTimer = 0.1; // Set short delay before retrying spawn attempt
                }
            }
            break; // End SPAWNING case

        case 'ACTIVE':
            // Wave is active, enemies are spawned (or finishing spawning).
            // Check if all spawned enemies are defeated.
            // Crucially: Ensure all enemies *intended* for the wave have been spawned *before* checking defeat conditions.
            if (EnemyManager.getLivingEnemyCount() === 0 && enemiesSpawnedThisWave >= enemiesToSpawnThisWave) {
                console.log(`[WaveManager] Wave ${currentWaveNumber} Cleared! Setting state to INTERMISSION.`);
                state = 'INTERMISSION';
                timer = Config.WAVE_INTERMISSION_DURATION;
            }
            break;

        case 'INTERMISSION':
            timer -= dt;
            if (timer <= 0) {
                console.log("[WaveManager] Intermission finished. Starting next wave.");
                setupNextWave(currentWaveNumber + 1);
            }
            break;

        case 'GAME_OVER':
            // Do nothing during game over state within the wave manager update
            break;

        default:
            console.error("Unknown wave state:", state);
            break;
    }
}

export function setGameOver() {
    console.log("[WaveManager] Setting state to GAME_OVER.");
    state = 'GAME_OVER';
    timer = 0; // Reset any active timers
}

export function isGameOver() {
    return state === 'GAME_OVER';
}

export function getState() {
    return state;
}

export function getCurrentWaveNumber() {
    return currentWaveNumber;
}

export function getTimer() {
    return timer; // Returns the relevant timer (pre-wave, intermission)
}

export function getWaveInfo() {
    // Helper to get all relevant info for UI or other systems
    return {
        number: currentWaveNumber,
        state: state,
        timer: timer,
        // Could add more info like enemies remaining if needed
        // enemiesRemaining: state === 'ACTIVE' || state === 'SPAWNING' ? enemiesToSpawnThisWave - enemiesSpawnedThisWave + EnemyManager.getLivingEnemyCount() : 0
    };
}