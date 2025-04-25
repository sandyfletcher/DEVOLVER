// -----------------------------------------------------------------------------
// root/js/waveManager.js - Manages waves of enemies and timing (TIME-BASED)
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as EnemyManager from './enemyManager.js';
import * as AudioManager from './audioManager.js';

// --- Module State ---
let currentMainWaveIndex = -1; // Index in Config.WAVES array (-1 means not started)
let currentSubWaveIndex = 0;   // Index within the current main wave's subWaves array
let currentGroupIndex = 0;     // Index within the current sub-wave's enemyGroups array
let enemiesSpawnedThisGroup = 0; // Count for the current group being spawned
let groupSpawnTimer = 0;       // Timer for delay *between* enemies in the current group
let groupStartDelayTimer = 0;  // Timer for the delay *before* the current group starts (relative to sub-wave start)

// Wave States: PRE_WAVE, WAVE_COUNTDOWN, INTERMISSION, GAME_OVER, VICTORY
let state = 'PRE_WAVE';
let preWaveTimer = Config.WAVE_START_DELAY; // Timer before the very first wave
let mainWaveTimer = 0; // Timer for the total duration of the current main wave
let intermissionTimer = 0; // Timer between main waves

// --- Internal Helper Functions ---

function getCurrentWaveData() {
    if (currentMainWaveIndex < 0 || currentMainWaveIndex >= Config.WAVES.length) {
        return null;
    }
    return Config.WAVES[currentMainWaveIndex];
}

function getCurrentSubWaveData() {
    const waveData = getCurrentWaveData();
    if (!waveData || currentSubWaveIndex < 0 || currentSubWaveIndex >= waveData.subWaves.length) {
        return null;
    }
    return waveData.subWaves[currentSubWaveIndex];
}

function getCurrentGroupData() {
    const subWaveData = getCurrentSubWaveData();
    if (!subWaveData || currentGroupIndex < 0 || currentGroupIndex >= subWaveData.enemyGroups.length) {
        return null;
    }
    return subWaveData.enemyGroups[currentGroupIndex];
}

/**
 * Advances the internal spawning progression state (moves to next group or sub-wave)
 * This is called when a group finishes spawning.
 * @returns {boolean} True if successfully advanced to a new group, false if spawning is complete for the current wave.
 */
function advanceSpawnProgression() {
    const subWaveData = getCurrentSubWaveData();
    if (!subWaveData) {
        // This implies we finished the last sub-wave or an error occurred.
        // Spawning for this wave cycle is complete.
        console.log(`[WaveMgr] Spawning complete for Wave ${currentMainWaveIndex + 1}.`);
        currentGroupIndex = -1; // Use sentinel values to indicate finished spawning
        currentSubWaveIndex = -1;
        // The state remains WAVE_COUNTDOWN until the mainWaveTimer runs out.
        return false;
    }

    currentGroupIndex++; // Move to the next group index
    if (currentGroupIndex < subWaveData.enemyGroups.length) {
        // Successfully moved to the next group in the current sub-wave
        const groupData = getCurrentGroupData();
        enemiesSpawnedThisGroup = 0;
        groupSpawnTimer = 0; // Ready to spawn first enemy (after start delay)
        groupStartDelayTimer = groupData.startDelay ?? 0; // Set start delay for THIS group

        // console.log(`[WaveMgr] Setup Group ${currentGroupIndex + 1} (Type: ${groupData?.type}, Count: ${groupData?.count}) in Sub-Wave ${currentMainWaveIndex + 1}.${currentSubWaveIndex + 1}. Start Delay: ${groupStartDelayTimer}s`);
        return true; // Successfully set up the next group
    } else {
        // Finished all groups in the current sub-wave, move to the next sub-wave
        currentSubWaveIndex++; // Move to the next sub-wave index
        currentGroupIndex = 0; // Reset group index for the new sub-wave

        const nextSubWaveData = getCurrentSubWaveData();
        if (nextSubWaveData) {
            // Successfully moved to the next sub-wave
            // console.log(`[WaveMgr] Setup Sub-Wave ${currentMainWaveIndex + 1}.${currentSubWaveIndex + 1}. Setting up first group.`);
            const groupData = nextSubWaveData.enemyGroups[0]; // Get the first group of the new sub-wave
            enemiesSpawnedThisGroup = 0;
            groupSpawnTimer = 0;
            groupStartDelayTimer = groupData?.startDelay ?? 0; // Set start delay for the first group of the new sub-wave

            // console.log(`[WaveMgr] Setup Group ${currentGroupIndex + 1} (Type: ${groupData?.type}, Count: ${groupData?.count}) in Sub-Wave ${currentMainWaveIndex + 1}.${currentSubWaveIndex + 1}. Start Delay: ${groupStartDelayTimer}s`);
            return true; // Successfully set up the first group of the next sub-wave
        } else {
            // Finished all sub-waves in the current main wave
            // Spawning for this wave cycle is complete.
            console.log(`[WaveMgr] All sub-waves processed for Wave ${currentMainWaveIndex + 1}. Spawning complete.`);
            currentGroupIndex = -1; // Sentinel
            currentSubWaveIndex = -1; // Sentinel
            return false; // Indicate no more spawning progression for this wave
        }
    }
}


/** Starts the next main wave, sets up timers and initial spawning state. */
function startNextWave() {
    // Increment index to point to the *next* wave to start
    currentMainWaveIndex++;
    const waveData = getCurrentWaveData(); // Get data for the *new* current index

    if (!waveData) {
        // No more waves found, transition to victory state
        console.log("[WaveMgr] All defined waves completed!");
        state = 'VICTORY';
        EnemyManager.clearAllEnemies(); // Clear any remaining enemies on victory
        AudioManager.stopMusic(); // <-- Stop music on victory
        console.log("[WaveMgr] Transitioned to VICTORY state.");
        return false; // Indicates no wave was started
    }

    // Found a valid next wave, start the countdown
    state = 'WAVE_COUNTDOWN';
    mainWaveTimer = waveData.duration; // Set timer to the wave's total duration
    console.log(`[WaveMgr] Starting Main Wave ${waveData.mainWaveNumber}. Duration: ${mainWaveTimer}s`);

    // --- Trigger music playback for the new wave ---
    if (waveData.audioTrack) {
        AudioManager.playMusic(waveData.audioTrack); // <-- Play the track for this wave
    } else {
        AudioManager.stopMusic(); // <-- Stop music if no track is defined for this wave
    }


    // Reset spawning progression pointers for the new wave
    currentSubWaveIndex = 0;
    currentGroupIndex = 0; // Start with the first group of the first sub-wave
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0; // Ready to spawn first enemy in group

    const firstGroup = getCurrentGroupData();
     if (firstGroup) {
        groupStartDelayTimer = firstGroup.startDelay ?? 0; // Set start delay for the very first group
        console.log(`[WaveMgr] Setup first group (Type: ${firstGroup.type}, Count: ${firstGroup.count}) in Sub-Wave ${currentMainWaveIndex+1}.${currentSubWaveIndex+1}. Start Delay: ${groupStartDelayTimer}s`);
     } else {
         console.warn(`[WaveMgr] Wave ${waveData.mainWaveNumber} has no enemy groups defined.`);
         groupStartDelayTimer = waveData.duration + 1; // Effectively prevent spawning if no groups
     }


    return true; // Indicates a wave was started
}

/** Ends the current main wave (when its timer runs out) and transitions to intermission or victory. */
function endWave() {
    const waveData = getCurrentWaveData(); // Get data for the wave that just ended
    if (!waveData) {
        console.error("[WaveMgr] endWave called but no current wave data found!");
        // Fallback to victory or game over? For now, just return.
        state = 'GAME_OVER'; // Safety state
        AudioManager.stopMusic(); // <-- Stop music on error/game over
        return;
    }

    console.log(`[WaveMgr] Main Wave ${waveData.mainWaveNumber} ended by timer.`);
    EnemyManager.clearAllEnemies(); // Clear all remaining enemies at the end of the timed wave

    // Check if there's a *next* wave available AFTER the one that just finished
    if (currentMainWaveIndex + 1 < Config.WAVES.length) {
        // There is a next wave, transition to intermission
        state = 'INTERMISSION';
        intermissionTimer = Config.WAVE_INTERMISSION_DURATION;
        AudioManager.stopMusic(); // <-- Stop wave music for intermission (optional: play intermission music)
        console.log(`[WaveMgr] Transitioned to INTERMISSION. Next wave (${currentMainWaveIndex + 2}) starts in ${intermissionTimer}s.`);
    } else {
        // No more waves, transition to victory
        state = 'VICTORY';
        AudioManager.stopMusic(); // <-- Stop music on victory (optional: play victory music)
        console.log("[WaveMgr] All waves completed! Transitioned to VICTORY state.");
    }

    // Reset spawning progression pointers after ending a wave
    currentSubWaveIndex = 0;
    currentGroupIndex = 0;
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0;
    groupStartDelayTimer = 0;
}


// --- Exported Functions ---

/** Initializes the wave manager to its default state. */
export function init() {
    currentMainWaveIndex = -1; // Start before the first wave
    currentSubWaveIndex = 0;
    currentGroupIndex = 0;
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0;
    groupStartDelayTimer = 0;
    state = 'PRE_WAVE';
    preWaveTimer = Config.WAVE_START_DELAY; // Use config value for first delay
    mainWaveTimer = 0; // No main wave active yet
    intermissionTimer = 0; // No intermission active yet
    // Audio should already be stopped by main.js showing the PRE_GAME overlay
    // REMOVE THE LINE BELOW
    // AudioManager.stopMusic();
    console.log(`[WaveManager] Initialized. State: ${state}, First Wave In: ${preWaveTimer}s`);
}

/** Resets the wave manager, typically for restarting the game. */
export function reset() {
    console.log("[WaveManager] Resetting...");
    init(); // Re-initialize to default state
}

/**
 * Updates the wave state machine, handling timers and spawning.
 * @param {number} dt - Delta time in seconds.
 */
export function update(dt) {
    // If the game is over, no wave logic runs except staying in the GAME_OVER state
    if (state === 'GAME_OVER' || state === 'VICTORY') {
        return;
    }

    switch (state) {
        case 'PRE_WAVE':
            preWaveTimer -= dt;
            if (preWaveTimer <= 0) {
                startNextWave(); // This handles transition to WAVE_COUNTDOWN or VICTORY
            }
            break;

        case 'WAVE_COUNTDOWN':
            // Always count down the main wave timer
            mainWaveTimer -= dt;
            if (mainWaveTimer <= 0) {
                mainWaveTimer = 0; // Ensure it doesn't go negative in display
                endWave(); // This handles transition to INTERMISSION or VICTORY
                break; // Exit case after state change
            }

            // --- Handle Enemy Spawning Progression within the WAVE_COUNTDOWN ---
            const subWaveData = getCurrentSubWaveData();
            const groupData = getCurrentGroupData();

            // Only attempt spawning if we are still in a valid sub-wave/group index for spawning
            if (subWaveData && groupData) {

                // 1. Handle Group Start Delay (relative to wave start, but checked sequentially)
                 // This timer is the time *remaining* until the current group can start spawning.
                if (groupStartDelayTimer > 0) {
                    groupStartDelayTimer -= dt;
                } else { // Group start delay is over, or was 0 initially
                    // Check if current group is fully spawned
                    if (enemiesSpawnedThisGroup < groupData.count) {
                        // Handle time delay between spawns in this group
                        groupSpawnTimer -= dt;
                        if (groupSpawnTimer <= 0) {
                            // Attempt to spawn one enemy of the group's type
                            const spawned = EnemyManager.trySpawnEnemy(groupData.type);
                            if (spawned) {
                                enemiesSpawnedThisGroup++;
                                // Reset timer for the next spawn in this group
                                groupSpawnTimer = groupData.delayBetween ?? Config.WAVE_ENEMY_SPAWN_DELAY;
                                // console.log(`Spawned ${groupData.type} (${enemiesSpawnedThisGroup}/${groupData.count}) for Wave ${currentMainWaveIndex+1}`);

                                // Immediately try to spawn the next enemy if delayBetween is 0 or negative
                                if (groupSpawnTimer <= 0 && enemiesSpawnedThisGroup < groupData.count) {
                                     // Keep groupSpawnTimer at 0 to spawn next frame
                                     groupSpawnTimer = 0;
                                }

                            } else {
                                // Spawn failed (max enemies?), retry shortly without advancing count
                                groupSpawnTimer = 0.2; // Short delay before retry
                                // console.warn(`Spawn failed for ${groupData.type}, retrying...`);
                            }
                        }
                    } else {
                        // Current group is fully spawned, advance spawning progression
                        advanceSpawnProgression(); // This sets up the next group's start delay
                    }
                }
            }
            // If subWaveData or groupData is null/undefined here, it means advanceSpawnProgression
            // has already run and determined there are no more groups to spawn for this wave.
            // The wave continues until mainWaveTimer hits zero.

            break; // End of WAVE_COUNTDOWN case

        case 'INTERMISSION':
            intermissionTimer -= dt;
            if (intermissionTimer <= 0) {
                startNextWave(); // This handles transition to WAVE_COUNTDOWN or VICTORY
            }
            break;

        case 'GAME_OVER':
             // Nothing to do here, main.js handles the visual overlay
            break;
        case 'VICTORY':
            // Nothing to do here, main.js can handle a victory overlay if needed
            break;

        default:
            console.error("Unknown wave state:", state);
            state = 'GAME_OVER'; // Attempt recovery
            AudioManager.stopMusic(); // <-- Stop music on error/game over
            break;
    }
}

/** Sets the game state to GAME_OVER (e.g., triggered by player death). */
export function setGameOver() {
    if (state !== 'GAME_OVER') {
        console.log("[WaveManager] Setting state to GAME_OVER.");
        state = 'GAME_OVER';
        // Optionally clear timers or enemies
        preWaveTimer = 0;
        mainWaveTimer = 0;
        intermissionTimer = 0;
        groupSpawnTimer = 0;
        groupStartDelayTimer = 0;
        EnemyManager.clearAllEnemies(); // Clear enemies on player death
        AudioManager.stopMusic(); // <-- Stop music on game over
    }
}

/** Checks if the current wave state is GAME_OVER. */
export function isGameOver() {
    return state === 'GAME_OVER';
}

/** Returns the current *main* wave number (1-based). */
export function getCurrentWaveNumber() {
    // Return 0 if waves haven't started, otherwise the 1-based index
    // currentMainWaveIndex is -1 before wave 1, 0 during wave 1 and intermission, 1 during wave 2 etc.
    return (currentMainWaveIndex < 0) ? 0 : currentMainWaveIndex + 1;
}

/** Returns an object containing relevant wave info for UI or other systems. */
export function getWaveInfo() {
    const groupData = getCurrentGroupData();
    let timer = 0;
    let timerLabel = "";
    let progressText = "";
    let currentWaveNumber = getCurrentWaveNumber(); // Get 1-based number

    switch (state) {
        case 'PRE_WAVE':
            timer = preWaveTimer;
            timerLabel = "First Wave In:";
            currentWaveNumber = 1; // Show "Wave 1" is coming
            break;
        case 'WAVE_COUNTDOWN':
            timer = mainWaveTimer;
            timerLabel = "Wave Ends In:"; // Changed label
             if (currentSubWaveIndex !== -1 && currentGroupIndex !== -1 && groupData) {
                // Show spawning progress if still spawning groups for this wave
                let enemiesLeftInGroup = groupData.count - enemiesSpawnedThisGroup;
                progressText = `Spawning: ${groupData.type} (${enemiesLeftInGroup} left)`;
                // Optional: Add sub-wave/group index info if needed for complexity
                // progressText += ` (Sub-Wave ${currentSubWaveIndex + 1}, Group ${currentGroupIndex + 1})`;
             } else {
                 // Spawning is complete for this wave, just waiting for timer
                 progressText = "Spawning complete.";
             }
            // Append living enemy count below progress text or if no progress text
             const livingEnemies = EnemyManager.getLivingEnemyCount(); // Get live count directly
             if (livingEnemies > 0 || !progressText) {
                 if (progressText && progressText !== "Spawning complete.") progressText += ' | '; // Add separator if needed, but not if just "Spawning complete"
                 else if (!progressText) progressText = ''; // Ensure progressText is at least empty string if it was null/undefined
                 progressText += `Alive: ${livingEnemies}`;
             } else if (progressText === "Spawning complete." && livingEnemies > 0) {
                 // Special case: Spawning is done, but enemies are still alive
                 progressText = `Spawning complete. Alive: ${livingEnemies}`;
             }


            break;
        case 'INTERMISSION':
            timer = intermissionTimer;
            // Show the number of the NEXT wave during intermission
            timerLabel = `Next Wave (${currentWaveNumber + 1}) In:`;
            progressText = `Wave ${currentWaveNumber} Complete.`; // Show previous wave number complete
            break;
        case 'GAME_OVER':
            // UI handles this via the overlay state
            progressText = "Game Over"; // Fallback text if UI doesn't hide this part
            break;
        case 'VICTORY':
            progressText = "Victory!"; // Fallback text
             currentWaveNumber = Config.WAVES.length; // Show the last completed wave number
            break;
        default:
             // Handle other potential states or unknown states
             waveStatusEl.textContent = `Wave ${currentWaveNumber || '-'}`;
             waveTimerEl.textContent = waveInfo.timerLabel || '';
             enemyCountEl.textContent = waveInfo.progressText || '';
             break;
    }

    return {
        state: state,
        mainWaveNumber: currentWaveNumber,
        timer: timer,
        timerLabel: timerLabel,
        progressText: progressText,
        isGameOver: isGameOver(), // Check if state is specifically GAME_OVER
        allWavesCleared: state === 'VICTORY'
    };
}