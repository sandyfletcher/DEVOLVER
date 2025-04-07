// js/waveManager.js
import * as Config from './config.js';
import * as EnemyManager from './enemyManager.js'; // Needs EnemyManager to spawn and check counts

console.log("waveManager.js loaded (with debug logging)"); // Added note

// --- Module State ---
let currentWaveNumber = 0;
let state = 'PRE_WAVE'; // Possible states: PRE_WAVE, SPAWNING, ACTIVE, INTERMISSION, GAME_OVER
let timer = 0;
let enemiesToSpawnThisWave = 0;
let enemiesSpawnedThisWave = 0;
let enemySpawnDelayTimer = 0;

// --- Internal Helper Functions ---

// Sets up the next wave's parameters
function setupNextWave(waveNum) {
    console.log(`[WaveManager] Setting up Wave ${waveNum}. State: SPAWNING.`);
    currentWaveNumber = waveNum;
    state = 'SPAWNING';
    enemiesSpawnedThisWave = 0; // Reset spawn count for the new wave
    enemySpawnDelayTimer = Config.WAVE_ENEMY_SPAWN_DELAY; // Initial delay before first spawn

    // Example scaling - adjust as needed
    if (waveNum === 1) {
        enemiesToSpawnThisWave = Config.WAVE_1_ENEMY_COUNT;
    } else {
        // Example: Increase by 5 each wave
        enemiesToSpawnThisWave = Config.WAVE_1_ENEMY_COUNT + (waveNum - 1) * 5;
    }
    // --- ADD LOGGING ---
    console.log(`[WaveManager Setup] Wave: ${currentWaveNumber}, To Spawn: ${enemiesToSpawnThisWave}`);
}


// --- Exported Functions ---

/** Initializes the wave manager to its default state. */
export function init() {
    currentWaveNumber = 0;
    state = 'PRE_WAVE';
    timer = Config.WAVE_START_DELAY;
    enemiesToSpawnThisWave = 0;
    enemiesSpawnedThisWave = 0;
    enemySpawnDelayTimer = 0;
    console.log(`[WaveManager] Initial state: ${state}, Timer: ${timer}`);
}

/** Resets the wave manager, typically for restarting the game. */
export function reset() {
    console.log("[WaveManager] Resetting...");
    init(); // Re-initialize to default state
}

/**
 * Updates the wave state machine, handling timers, spawning, and progression.
 * @param {number} dt - Delta time in seconds.
 */
export function update(dt) {
    // --- ADD DETAILED LOGGING AT START OF UPDATE ---
    const livingCount = EnemyManager.getLivingEnemyCount(); // Get count once per frame
    // console.log(`[WaveMgr Update] State: ${state}, Living: ${livingCount}, Spawned: ${enemiesSpawnedThisWave}/${enemiesToSpawnThisWave}, Timer: ${timer.toFixed(1)}`);

    switch (state) {
        case 'PRE_WAVE':
            timer -= dt;
            if (timer <= 0) {
                console.log("[WaveManager] PRE_WAVE -> SPAWNING (Wave 1)"); // Log transition
                setupNextWave(1);
                // Skip further processing this frame after state change
                return; // Added return to prevent immediate SPAWNING logic run
            }
            break; // End PRE_WAVE

        case 'SPAWNING':
             // --- Check for completion FIRST ---
             if (enemiesSpawnedThisWave >= enemiesToSpawnThisWave) {
                 console.log(`[WaveManager] SPAWNING -> ACTIVE (Spawned ${enemiesSpawnedThisWave}/${enemiesToSpawnThisWave})`); // Log transition
                 state = 'ACTIVE';
                 // Intentional fall-through: Let ACTIVE case check immediately
             } else {
                 // --- If not complete, try spawning ---
                 enemySpawnDelayTimer -= dt;
                 if (enemySpawnDelayTimer <= 0) {
                     // --- Choose enemy type ---
                     let typeToSpawn;
                     const chanceForChaser = Math.min(0.8, 0.1 + (currentWaveNumber * 0.1));
                     if (currentWaveNumber === 1) {
                         typeToSpawn = Config.ENEMY_TYPE_CENTER_SEEKER;
                     } else if (Math.random() < chanceForChaser) {
                         typeToSpawn = Config.ENEMY_TYPE_PLAYER_CHASER;
                     } else {
                         typeToSpawn = Config.ENEMY_TYPE_CENTER_SEEKER;
                     }

                     // --- Attempt spawn ---
                     const spawned = EnemyManager.trySpawnEnemy(typeToSpawn);
                     // --- ADD LOGGING ---
                     console.log(`[WaveMgr SPAWNING] Try spawn type: ${typeToSpawn}, Result: ${spawned}`);

                     if (spawned) {
                         enemiesSpawnedThisWave++;
                         enemySpawnDelayTimer = Config.WAVE_ENEMY_SPAWN_DELAY; // Reset delay for next spawn
                     } else {
                         // console.warn(`[WaveManager] Spawn FAILED (Max enemies? Bad point?). Retrying shortly.`);
                         enemySpawnDelayTimer = 0.2; // Slightly longer retry delay if spawn failed
                     }
                 }
                 // --- Break ensures we only spawn or check completion, not both+ACTIVE in one frame ---
                 break; // End SPAWNING case (if still spawning)
             }
             // --- Intentional fall-through from SPAWNING completion check ---

        case 'ACTIVE':
            // This case runs if state was already ACTIVE, or if SPAWNING just completed this frame.
            // --- Check if wave can progress ---
            // Use the livingCount obtained at the start of the update function.
            const canProgress = (livingCount === 0 && enemiesSpawnedThisWave >= enemiesToSpawnThisWave);
             // Optional detailed log:
             // console.log(`[WaveMgr ACTIVE Check] Living: ${livingCount}, Spawned Check: ${enemiesSpawnedThisWave >= enemiesToSpawnThisWave}, Can Progress: ${canProgress}`);

            if (canProgress) {
                console.log(`[WaveManager] ACTIVE -> INTERMISSION (Wave ${currentWaveNumber} Cleared!)`); // Log transition
                state = 'INTERMISSION';
                timer = Config.WAVE_INTERMISSION_DURATION; // Set intermission timer
                 // Skip further processing this frame after state change
                return; // Added return
            }
            break; // End ACTIVE case

        case 'INTERMISSION':
            timer -= dt;
            if (timer <= 0) {
                console.log("[WaveManager] INTERMISSION -> SPAWNING (Next Wave)"); // Log transition
                setupNextWave(currentWaveNumber + 1); // Setup the next wave
                 // Skip further processing this frame after state change
                return; // Added return
            }
            break; // End INTERMISSION

        case 'GAME_OVER':
            // No actions needed in wave manager update during game over
            break; // End GAME_OVER

        default:
            console.error("Unknown wave state:", state);
            state = 'PRE_WAVE'; // Attempt recovery?
            break;
    }
}

/** Sets the game state to GAME_OVER. */
export function setGameOver() {
    if (state !== 'GAME_OVER') { // Prevent multiple logs/actions
        console.log("[WaveManager] Setting state to GAME_OVER.");
        state = 'GAME_OVER';
        timer = 0; // Reset any active timers
    }
}

/** Checks if the current wave state is GAME_OVER. */
export function isGameOver() {
    return state === 'GAME_OVER';
}

/** Returns the current wave state string. */
export function getState() {
    return state;
}

/** Returns the current wave number. */
export function getCurrentWaveNumber() {
    return currentWaveNumber;
}

/** Returns the current value of the relevant timer (pre-wave, intermission). */
export function getTimer() {
    return timer;
}

/** Returns an object containing relevant wave info for UI or other systems. */
export function getWaveInfo() {
    return {
        number: currentWaveNumber,
        state: state,
        timer: timer,
        // Example: enemiesRemaining calculation (optional)
        // enemiesRemaining: (state === 'ACTIVE' || state === 'SPAWNING') ? (enemiesToSpawnThisWave - enemiesSpawnedThisWave + livingCount) : 0
    };
}