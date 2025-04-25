// -----------------------------------------------------------------------------
// root/js/waveManager.js - Manages waves of enemies and timing
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as EnemyManager from './enemyManager.js';
import { WAVES } from './utils/waveScripts.js';

// --- Module State ---
let currentMainWaveIndex = -1; // Index in Config.WAVES array (-1 means not started)
let currentSubWaveIndex = 0;   // Index within the current main wave's subWaves array
let currentGroupIndex = 0;     // Index within the current sub-wave's enemyGroups array
let enemiesSpawnedThisGroup = 0;// Count for the current group being spawned
let groupSpawnTimer = 0;       // Timer for delay *between* enemies in the current group
let groupStartDelayTimer = 0;  // Timer for the delay *before* the current group starts

// Wave States: PRE_WAVE, SPAWNING, ACTIVE, INTERMISSION, GAME_OVER, ALL_WAVES_CLEARED)
let state = 'PRE_WAVE';
let preWaveTimer = Config.WAVE_START_DELAY; // Timer before the very first wave
let intermissionTimer = 0; // Timer between main waves

// --- Internal Helper Functions ---

function getCurrentWaveData() {
    if (currentMainWaveIndex < 0 || currentMainWaveIndex >= WAVES.length) {
        return null;
    }
    return WAVES[currentMainWaveIndex];
}

function getCurrentSubWaveData() {
    const waveData = getCurrentWaveData();
    if (!waveData || currentSubWaveIndex >= waveData.subWaves.length) {
        return null;
    }
    return waveData.subWaves[currentSubWaveIndex];
}

function getCurrentGroupData() {
    const subWaveData = getCurrentSubWaveData();
    if (!subWaveData || currentGroupIndex >= subWaveData.enemyGroups.length) {
        return null;
    }
    return subWaveData.enemyGroups[currentGroupIndex];
}

/** Sets up the state variables for the next group within the current sub-wave. */
function setupNextGroup() {
    const subWaveData = getCurrentSubWaveData();
    if (!subWaveData) return false; // Should not happen if called correctly

    currentGroupIndex++;
    if (currentGroupIndex >= subWaveData.enemyGroups.length) {
        // All groups in this sub-wave are done, move to the next sub-wave
        return setupNextSubWave();
    }

    // Reset counters for the new group
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0; // Ready to spawn first enemy (after start delay)
    const groupData = getCurrentGroupData();
    groupStartDelayTimer = groupData?.startDelay ?? 0; // Set start delay for this group

    // console.log(`[WaveMgr] Setup Group ${currentGroupIndex + 1} (Type: ${groupData?.type}, Count: ${groupData?.count}) in Sub-Wave ${currentMainWaveIndex + 1}.${currentSubWaveIndex + 1}`);
    return true; // Successfully set up the next group
}

/** Sets up the state variables for the next sub-wave within the current main wave. */
function setupNextSubWave() {
    const waveData = getCurrentWaveData();
    if (!waveData) return false;

    currentSubWaveIndex++;
    if (currentSubWaveIndex >= waveData.subWaves.length) {
        // All sub-waves for this main wave have finished spawning.
        // The main wave is now considered 'ACTIVE' until cleared.
        console.log(`[WaveMgr] All sub-waves spawned for Main Wave ${waveData.mainWaveNumber}. State -> ACTIVE.`);
        state = 'ACTIVE';
        return false; // Indicate no more sub-waves to set up *within this main wave*
    }

    // Reset group index for the new sub-wave
    currentGroupIndex = -1; // Will be incremented to 0 by setupNextGroup
    // console.log(`[WaveMgr] Setup Sub-Wave ${currentMainWaveIndex + 1}.${currentSubWaveIndex + 1}`);
    return setupNextGroup(); // Set up the first group of the new sub-wave
}

/** Sets up the state variables for the next main wave. */
function setupNextMainWave() {
    currentMainWaveIndex++;
    if (currentMainWaveIndex >= WAVES.length) {
        console.log("[WaveMgr] All defined waves completed!");
        // TODO: Implement game win state or loop waves
        state = 'ALL_WAVES_CLEARED'; // Or GAME_OVER, or loop index back to 0
        return false; // No more waves
    }

    // Reset sub-wave and group indices for the new main wave
    currentSubWaveIndex = 0;
    currentGroupIndex = -1; // Will be incremented to 0 by setupNextGroup

    console.log(`[WaveMgr] Setup Main Wave ${currentMainWaveIndex + 1}`);
    return setupNextGroup(); // Setup the first group of the first sub-wave
}

// --- Exported Functions ---

/** Initializes the wave manager to its default state. */
export function init() {
    currentMainWaveIndex = -1;
    currentSubWaveIndex = 0;
    currentGroupIndex = 0;
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0;
    groupStartDelayTimer = 0;
    state = 'PRE_WAVE';
    preWaveTimer = Config.WAVE_START_DELAY;
    intermissionTimer = 0;
    console.log(`[WaveManager] Initialized. State: ${state}, Timer: ${preWaveTimer}`);
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
    const livingCount = EnemyManager.getLivingEnemyCount();

    switch (state) {
        case 'PRE_WAVE':
            preWaveTimer -= dt;
            if (preWaveTimer <= 0) {
                if (setupNextMainWave()) { // Setup Wave 1, Group 1
                    state = 'SPAWNING';
                    console.log("[WaveMgr] PRE_WAVE -> SPAWNING");
                }
                // else: setupNextMainWave handled game end/win state change
            }
            break;

        case 'SPAWNING':
            const groupData = getCurrentGroupData();

            if (!groupData) {
                // This state implies we *should* have a group. If not, something went wrong,
                // or we just finished the last group and need setupNextGroup to transition.
                // Attempt recovery by trying to set up the next logical step.
                // console.warn("[WaveMgr] SPAWNING state with no current group data. Attempting advance...");
                if (!setupNextGroup()) {
                     // If setup fails (e.g., moved to ACTIVE or finished all waves), the state will change.
                     // If it's still somehow in SPAWNING, log an error.
                     if(state === 'SPAWNING') console.error("[WaveMgr] Failed to advance group/sub-wave/wave from SPAWNING state.");
                }
                break; // Exit case for this frame
            }

            // 1. Handle Group Start Delay
            if (groupStartDelayTimer > 0) {
                groupStartDelayTimer -= dt;
                break; // Waiting for group to start
            }

            // 2. Check if current group is fully spawned
            if (enemiesSpawnedThisGroup >= groupData.count) {
                // Move to the next group (which might trigger next sub-wave or ACTIVE state)
                if (!setupNextGroup()) {
                    // State potentially changed inside setupNextGroup/SubWave
                }
                break; // Process the new group/state next frame
            }

            // 3. Handle time delay between spawns in this group
            groupSpawnTimer -= dt;
            if (groupSpawnTimer <= 0) {
                // Attempt to spawn one enemy of the group's type
                const spawned = EnemyManager.trySpawnEnemy(groupData.type);
                if (spawned) {
                    enemiesSpawnedThisGroup++;
                    // Reset timer for the next spawn in this group
                    groupSpawnTimer = groupData.delayBetween ?? Config.WAVE_ENEMY_SPAWN_DELAY;
                    // console.log(`Spawned ${groupData.type} (${enemiesSpawnedThisGroup}/${groupData.count})`);
                } else {
                    // Spawn failed (max enemies?), retry shortly without advancing count
                    groupSpawnTimer = 0.2; // Short delay before retry
                    // console.warn(`Spawn failed for ${groupData.type}, retrying...`);
                }
            }
            break; // End of SPAWNING case

        case 'ACTIVE':
            // Entered only after ALL groups/sub-waves of a main wave have finished spawning.
            // Wait for all living enemies to be cleared.
            if (livingCount === 0) {
                console.log(`[WaveMgr] Main Wave ${currentMainWaveIndex + 1} Cleared! ACTIVE -> INTERMISSION`);
                state = 'INTERMISSION';
                intermissionTimer = Config.WAVE_INTERMISSION_DURATION;
            }
            break;

        case 'INTERMISSION':
            intermissionTimer -= dt;
            if (intermissionTimer <= 0) {
                if (setupNextMainWave()) { // Setup next main wave
                    state = 'SPAWNING';
                    console.log("[WaveMgr] INTERMISSION -> SPAWNING");
                }
                // else: setupNextMainWave handled game end/win state change
            }
            break;

        case 'ALL_WAVES_CLEARED':
            // Optional state: Game won! Could transition to a special screen.
            // For now, just sits here. Could also set state = 'GAME_OVER'.
            break;

        case 'GAME_OVER':
            // Player died, no actions needed in wave manager
            break;

        default:
            console.error("Unknown wave state:", state);
            state = 'GAME_OVER'; // Attempt recovery?
            break;
    }
}

/** Sets the game state to GAME_OVER. */
export function setGameOver() {
    if (state !== 'GAME_OVER') {
        console.log("[WaveManager] Setting state to GAME_OVER.");
        state = 'GAME_OVER';
        // Reset timers? Optional.
        preWaveTimer = 0;
        intermissionTimer = 0;
        groupSpawnTimer = 0;
        groupStartDelayTimer = 0;
    }
}

/** Checks if the current wave state is GAME_OVER. */
export function isGameOver() {
    // Consider ALL_WAVES_CLEARED as a form of game over for loop purposes? Or handle separately.
    return state === 'GAME_OVER'; // || state === 'ALL_WAVES_CLEARED';
}

/** Returns the current wave state string. */
export function getState() {
    return state;
}

/** Returns the current *main* wave number (1-based). */
export function getCurrentWaveNumber() {
    // Return 0 if waves haven't started, otherwise the 1-based index
    return (currentMainWaveIndex < 0) ? 0 : currentMainWaveIndex + 1;
}

// /** Returns the current value of the relevant timer (pre-wave, intermission). */
// export function getTimer() {
//     // This is less clear now with multiple timers. getWaveInfo is better.
//     if (state === 'PRE_WAVE') return preWaveTimer;
//     if (state === 'INTERMISSION') return intermissionTimer;
//     return 0;
// }

/** Returns an object containing relevant wave info for UI or other systems. */
export function getWaveInfo() {
    const groupData = getCurrentGroupData();
    let timer = 0;
    let timerLabel = "";
    let progressText = "";

    switch (state) {
        case 'PRE_WAVE':
            timer = preWaveTimer;
            timerLabel = "First Wave In:";
            break;
        case 'SPAWNING':
             // Show group start delay if active, otherwise no specific timer shown
             if (groupStartDelayTimer > 0) {
                 timer = groupStartDelayTimer;
                 timerLabel = "Group Delay:";
             }
             if (groupData) {
                 progressText = `Spawning: ${groupData.type} (${enemiesSpawnedThisGroup}/${groupData.count})`;
             }
             // Could potentially show Sub-Wave X/3 ?
             progressText += ` (Section ${currentSubWaveIndex + 1}/3)`; // Assumes 3 sub-waves always
            break;
        case 'ACTIVE':
            // No timer, maybe show "Clear remaining enemies!"
             progressText = "Defeat Remaining Enemies!";
            break;
        case 'INTERMISSION':
            timer = intermissionTimer;
            timerLabel = "Next Wave In:";
            break;
        case 'ALL_WAVES_CLEARED':
            progressText = "All Waves Cleared!";
            break;
        case 'GAME_OVER':
             // Handled by UI checking isGameOver()
            break;
    }

    return {
        state: state,
        mainWaveNumber: getCurrentWaveNumber(), // 1-based
        timer: timer,
        timerLabel: timerLabel,
        progressText: progressText, // Text summarizing spawning/clearing state
        isGameOver: isGameOver(),
        allWavesCleared: state === 'ALL_WAVES_CLEARED'
    };
}