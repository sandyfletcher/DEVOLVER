// -----------------------------------------------------------------------------
// root/js/waveManager.js - Manages waves of enemies and timing (TIME-BASED)
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as EnemyManager from './enemyManager.js';
import * as AudioManager from './audioManager.js';
import * as ItemManager from './itemManager.js';
import * as WorldManager from './worldManager.js'; // Import WorldManager
import * as UI from './ui.js'; // Import UI module for epoch text

// --- Module State ---
let currentMainWaveIndex = -1; // Index in Config.WAVES array (-1 means not started)
let currentSubWaveIndex = 0;   // Index within the current main wave's subWaves array
let currentGroupIndex = 0;     // Index within the current sub-wave's enemyGroups array
let enemiesSpawnedThisGroup = 0; // Count for the current group being spawned
let groupSpawnTimer = 0;       // Timer for delay *between* enemies in the current group
let groupStartDelayTimer = 0;  // Timer for the delay *before* the current group starts (relative to sub-wave start)
let state = 'PRE_WAVE'; // Use PRE_WAVE here as the initial state for the manager itself
let preWaveTimer = Config.WAVE_START_DELAY; // Timer before the very first wave
let mainWaveTimer = 0; // Timer for the total duration of the current main wave
let buildPhaseTimer = 0;
let warpPhaseTimer = 0;
let currentMaxTimer = 0; // Used for UI bar denominator
let waveStartCallback = null; // Callback function to notify caller when a wave starts (currently used by main.js for epoch text)
let portalRef = null; // Reference to the Portal instance from main.js (needed for cleanup radius)

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

// --- Advances the internal spawning progression state (moves to next group or sub-wave) ---
function advanceSpawnProgression() {
    const subWaveData = getCurrentSubWaveData();
    if (!subWaveData) {
        // This implies we finished the last sub-wave or an error occurred and spawning for this wave cycle is complete.
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
            // console.log(`[WaveMgr] All sub-waves processed for Wave ${currentMainWaveIndex + 1}. Spawning complete.`);
            currentGroupIndex = -1; // Sentinel
            currentSubWaveIndex = -1; // Sentinel
            return false; // Indicate no more spawning progression for this wave
        }
    }
}
// --- Starts the next main wave, sets up timers and initial spawning state ---
function startNextWave() {
    currentMainWaveIndex++; // Increment index to point to the *next* wave to start
    const waveData = getCurrentWaveData(); // Get data for the *new* current index

    if (!waveData) {
        // No more waves found, transition to victory state
        console.log("[WaveMgr] All defined waves completed!");
        state = 'VICTORY';
        currentMaxTimer = 0; // No timer in victory state
        // Note: Enemy clearing and music stopping are handled by main.js now when it detects victory
        console.log("[WaveMgr] Transitioned to VICTORY state.");
        return false; // Indicates no wave was started
    }

    // Found a valid next wave, start the countdown
    state = 'WAVE_COUNTDOWN';
    mainWaveTimer = waveData.duration; // Set timer to the wave's total duration
    currentMaxTimer = waveData.duration; // Set max timer for UI
    // console.log(`[WaveMgr] Starting Main Wave ${waveData.mainWaveNumber}. Duration: ${mainWaveTimer}s`);

    // Call the callback to notify the main loop (e.g., to show epoch text)
    // This callback is now typically used for the *start* of the wave countdown, not the WARP phase.
    if (typeof waveStartCallback === 'function') {
        // console.log(`[WaveMgr] Calling waveStartCallback for wave ${waveData.mainWaveNumber}.`);
        waveStartCallback(waveData.mainWaveNumber);
    } else {
        // console.warn("[WaveMgr] No waveStartCallback function registered."); 
    }
    // --- Trigger game music playback for the new wave ---
    if (waveData.audioTrack) {
        AudioManager.playGameMusic(waveData.audioTrack); // <-- Play the track for this wave
    } else {
        AudioManager.stopGameMusic(); // <-- Stop game music if no track is defined for this wave
    }
    // Reset spawning progression pointers for the new wave
    currentSubWaveIndex = 0;
    currentGroupIndex = 0; // Start with the first group of the first sub-wave
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0; // Ready to spawn first enemy in group
    const firstGroup = getCurrentGroupData();
     if (firstGroup) {
        groupStartDelayTimer = firstGroup.startDelay ?? 0; // Set start delay for the very first group
        // console.log(`[WaveMgr] Setup first group (Type: ${firstGroup.type}, Count: ${firstGroup.count}) in Sub-Wave ${currentMainWaveIndex+1}.${currentSubWaveIndex+1}. Start Delay: ${groupStartDelayTimer}s`);
     } else {
         console.warn(`[WaveMgr] Wave ${waveData.mainWaveNumber} has no enemy groups defined.`);
         groupStartDelayTimer = waveData.duration + 1; // Effectively prevent spawning if no groups
     }
    return true; // Indicates a wave was started
}

/** Ends the current main wave (when its timer runs out) and transitions to BUILDPHASE or VICTORY. */
function endWave() {
    const waveData = getCurrentWaveData(); // Get data for the wave that just ended
    if (!waveData) {
        console.error("[WaveMgr] endWave called but no current wave data found!");
        // Fallback to game over?
        state = 'GAME_OVER'; // Safety state
        currentMaxTimer = 0; // No timer in game over state
         // Note: Enemy clearing and music stopping are handled by main.js now when it detects game over
        return;
    }

    // Check if there's a *next* wave available AFTER the one that just finished
    if (currentMainWaveIndex + 1 < Config.WAVES.length) {
        // There is a next wave, transition to BUILDPHASE
        state = 'BUILDPHASE';
        // --- Use the intermission duration from the current wave's config ---
        const waveIntermissionDuration = waveData.intermissionDuration ?? (Config.WARPPHASE_DURATION + 50.0); // Use config value, fallback to WARP + 50s
        // Calculate build phase duration: Total Intermission - Fixed Warp Phase
        buildPhaseTimer = Math.max(0, waveIntermissionDuration - Config.WARPPHASE_DURATION);
        warpPhaseTimer = 0; // Ensure warp timer is zeroed initially

        currentMaxTimer = buildPhaseTimer; // Set max timer for UI to the build phase duration
        AudioManager.stopGameMusic(); // <-- Stop wave music for intermission
        console.log(`[WaveMgr] Transitioned to BUILDPHASE (${buildPhaseTimer.toFixed(2)}s). Next wave (${currentMainWaveIndex + 2}) starts after total ${waveIntermissionDuration.toFixed(2)}s.`);
    } else {
        // No more waves, transition to victory
        state = 'VICTORY';
        currentMaxTimer = 0; // No timer in victory state
        // Note: Enemy clearing and music stopping are handled by main.js now when it detects victory
        console.log("[WaveMgr] All waves completed! Transitioned to VICTORY state.");
    }

    // Reset spawning progression pointers after ending a wave (applies to the *next* wave)
    currentSubWaveIndex = 0;
    currentGroupIndex = 0;
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0;
    groupStartDelayTimer = 0; // Will be set up properly when startNextWave is called later
}

// Function to trigger the cleanup logic (clearing enemies/items) AND aging logic
function triggerWarpCleanup() {
    // console.log("[WaveMgr] Triggering Warp Cleanup...");
    if (!portalRef) {
        console.error("[WaveMgr] Warp Cleanup failed: Portal reference is null.");
        return;
    }

    const portalCenter = portalRef.getPosition(); // Get portal center (already adjusted for size)
    const safeRadius = portalRef.safetyRadius; // Get the current safety radius
    // --- Clear Enemies and Items outside the radius ---
    ItemManager.clearItemsOutsideRadius(portalCenter.x, portalCenter.y, safeRadius);
    EnemyManager.clearEnemiesOutsideRadius(portalCenter.x, portalCenter.y, safeRadius);
    // console.log(`[WaveMgr] Cleared entities/items outside portal radius ${safeRadius.toFixed(1)}.`);
    // ---  Show Epoch Text during Warp ---
    // Get the epoch for the wave that is *about* to start (the next one)
    const nextWaveNumber = currentMainWaveIndex + 1 + 1; // waveJustCompleted + 1 (for 1-based) + 1 (for the next wave number)
    const nextEpochYear = Config.EPOCH_MAP[nextWaveNumber];
    if (nextEpochYear !== undefined) {
         // Show the epoch for the *next* wave
         UI.showEpochText(nextEpochYear); // UI handles display duration
    } else {
         // Fallback if no epoch defined for the next wave
         UI.showEpochText(`Preparing Wave ${nextWaveNumber}`);
    }
    // --- Apply World Aging ---
    // Get the data for the NEXT wave to determine its aging intensity
    const nextWaveData = Config.WAVES[currentMainWaveIndex + 1]; // Index is current + 1
    // Determine the aging intensity for the upcoming wave (defaults to base if not specified)
    const agingIntensityForNextWave = nextWaveData?.agingIntensity ?? Config.AGING_BASE_INTENSITY;
    // Pass the portal reference and the calculated aging intensity
    WorldManager.applyAging(portalRef, agingIntensityForNextWave); // MODIFIED: Pass agingIntensityForNextWave instead of nextWaveNumber
}

// --- Exported Functions ---

// --- Initializes the wave manager to its default state, accepts an optional callback and portal reference ---
export function init(callback = null, portalObject = null) {
    currentMainWaveIndex = -1; // Start before the first wave
    currentSubWaveIndex = 0;
    currentGroupIndex = 0;
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0;
    groupStartDelayTimer = 0;
    state = 'PRE_WAVE';
    preWaveTimer = Config.WAVE_START_DELAY; // Use config value for first delay
    currentMaxTimer = Config.WAVE_START_DELAY; // Set initial max timer
    mainWaveTimer = 0; // No main wave active yet
    buildPhaseTimer = 0; // Reset new timers
    warpPhaseTimer = 0; // Reset new timers
    waveStartCallback = callback; // Store the callback
    portalRef = portalObject; // Store portal reference
    // console.log(`[WaveManager] Initialized. State: ${state}, First Wave In: ${preWaveTimer}s. Callback ${callback ? 'provided' : 'not provided'}. Portal ${portalObject ? 'provided' : 'not provided'}.`);
}

// Resets the wave manager, typically for restarting the game
// Pass the portal reference here as well
export function reset(callback = null, portalObject = null) {
    // Pass the callback and portal during reset as well
    init(callback, portalObject); // Re-initialize using the init function
    // console.log("[WaveManager] Reset.");
}

// Updates the wave state machine, handling timers and spawning. Timers only decrement if the game is in the RUNNING state.
export function update(dt, gameState) {
    // No longer check state === 'GAME_OVER' or 'VICTORY' here; main.js handles that transition now.
    // WaveManager update logic *only* runs if gameState is 'RUNNING'.
    if (gameState === 'RUNNING') { // --- ONLY UPDATE TIMERS IF GAME IS RUNNING ---
        switch (state) {
            case 'PRE_WAVE':
                preWaveTimer -= dt;
                if (preWaveTimer <= 0) {
                    startNextWave(); // This handles transition to WAVE_COUNTDOWN or VICTORY
                }
                // maxTimer remains Config.WAVE_START_DELAY
                break;

            case 'WAVE_COUNTDOWN':
                // Always count down the main wave timer
                mainWaveTimer -= dt;
                if (mainWaveTimer <= 0) {
                    mainWaveTimer = 0; // Ensure it doesn't go negative in display
                    endWave(); // This handles transition to BUILDPHASE or VICTORY
                    // Note: endWave changes the state, so the break prevents further execution in this frame for WAVE_COUNTDOWN
                    break;
                }
                // --- Handle Enemy Spawning Progression within WAVE_COUNTDOWN (Remains the same) ---
                const subWaveData = getCurrentSubWaveData();
                const groupData = getCurrentGroupData();
                if (subWaveData && groupData && currentGroupIndex !== -1) { // Add check for currentGroupIndex !== -1
                    if (groupStartDelayTimer > 0) {
                        groupStartDelayTimer -= dt;
                    } else {
                        if (enemiesSpawnedThisGroup < groupData.count) {
                            groupSpawnTimer -= dt;
                            if (groupSpawnTimer <= 0) {
                                const spawned = EnemyManager.trySpawnEnemy(groupData.type);
                                if (spawned) {
                                    enemiesSpawnedThisGroup++;
                                    groupSpawnTimer = groupData.delayBetween ?? Config.WAVE_ENEMY_SPAWN_DELAY;
                                    // Immediately queue next spawn if delay is 0 and more enemies are needed
                                     if (groupSpawnTimer <= 0 && enemiesSpawnedThisGroup < groupData.count) {
                                          groupSpawnTimer = 0;
                                     }
                                } else {
                                    // If spawn failed (e.g., max enemies), wait a little before trying again
                                    groupSpawnTimer = 0.2;
                                }
                            }
                        } else {
                            advanceSpawnProgression(); // Move to next group/subwave if current group is done
                        }
                    }
                }
                // maxTimer remains waveData.duration (set in startNextWave)
                break;

            // --- INTERMISSION PHASES ---
            case 'BUILDPHASE':
                buildPhaseTimer -= dt;
                if (buildPhaseTimer <= 0) {
                    buildPhaseTimer = 0; // Ensure non-negative
                    state = 'WARPPHASE'; // Transition to Warp Phase
                    warpPhaseTimer = Config.WARPPHASE_DURATION; // Start warp timer (uses global fixed value)
                    currentMaxTimer = Config.WARPPHASE_DURATION; // Set max timer for UI to the warp phase duration
                    triggerWarpCleanup(); // === Call cleanup function on transition ===
                    // console.log(`[WaveMgr] Transitioned to WARPPHASE (${warpPhaseTimer.toFixed(2)}s). Cleanup triggered.`);
                }
                // maxTimer remains buildPhaseDuration (set in endWave) - it doesn't change during BUILDPHASE
                break;
            case 'WARPPHASE':
                 warpPhaseTimer -= dt;
                 if (warpPhaseTimer <= 0) {
                     warpPhaseTimer = 0; // Ensure non-negative
                     startNextWave(); // Transition to next WAVE_COUNTDOWN or VICTORY
                     // Note: startNextWave sets its own state and maxTimer, so no need to break
                 }
                 // maxTimer remains Config.WARPPHASE_DURATION (set on entering this state)
                 break;
            default:
                console.error("Unknown wave state:", state);
                // In a robust game, you might want a more graceful recovery or a fatal error display
                // For now, let main.js handle game over if portal/player health drops
                break;
        }
    }
    // If gameState is *not* RUNNING (e.g., PAUSED), none of the timers decrease.
}

/** Sets the game state to GAME_OVER (triggered by main.js when health is zero). */
export function setGameOver() {
    if (state !== 'GAME_OVER') {
        console.log("[WaveManager] Setting state to GAME_OVER.");
        state = 'GAME_OVER';
        // Clear internal timers to prevent further wave logic
        preWaveTimer = 0;
        mainWaveTimer = 0;
        buildPhaseTimer = 0; // Clear new timers
        warpPhaseTimer = 0;  // Clear new timers
        groupSpawnTimer = 0;
        groupStartDelayTimer = 0;
        currentMaxTimer = 0; // No timer in game over state
        // Note: Enemy clearing is handled by main.js now on game over
    }
}

/** Sets the game state to VICTORY (triggered by main.js when wave manager signals all waves cleared). */
export function setVictory() {
    if (state !== 'VICTORY') {
        console.log("[WaveManager] Setting state to VICTORY.");
        state = 'VICTORY';
         // Clear internal timers
        preWaveTimer = 0;
        mainWaveTimer = 0;
        buildPhaseTimer = 0; // Clear new timers
        warpPhaseTimer = 0;  // Clear new timers
        groupSpawnTimer = 0;
        groupStartDelayTimer = 0;
        currentMaxTimer = 0; // No timer in victory state
        // Note: Enemy clearing is handled by main.js now on victory
        // DO NOT call AudioManager.stopAllMusic() here. Main.js handles music on overlay show.
    }
}

/** Checks if the current wave manager state indicates the game should be over (health reached zero). */
// Main.js will use player/portal health check instead. This is now less critical for state transition but useful for internal checks.
export function isGameOver() {
    return state === 'GAME_OVER';
}

/** Returns the current *main* wave number (1-based). */
export function getCurrentWaveNumber() {
    // Return 0 if waves haven't started, otherwise the 1-based index
    // currentMainWaveIndex is -1 before wave 1, 0 during wave 1 and intermission, 1 during wave 2 etc.
    // In GAME_OVER or VICTORY, return the wave number reached *before* ending.
     if (state === 'GAME_OVER' || state === 'VICTORY') {
        // If the game ended during PRE_WAVE, the "reached wave" is 0.
        // Otherwise, it's the currentMainWaveIndex + 1 (the wave that was active or just completed).
        // A slightly more complex logic might be needed if game over can happen exactly at the transition,
        // but this is usually sufficient for display.
        return Math.max(0, currentMainWaveIndex + 1);
     }
    // If in WARPPHASE or BUILDPHASE, the currentMainWaveIndex is the wave that *just finished*.
    // We want to display the NEXT wave number in the UI during intermission countdown.
    if (state === 'BUILDPHASE' || state === 'WARPPHASE') {
        // Return the number of the wave that just finished (currentMainWaveIndex + 1)
        return currentMainWaveIndex + 1;
    }

    return (currentMainWaveIndex < 0) ? 0 : currentMainWaveIndex + 1;
}

/** Returns an object containing relevant wave info for UI or other systems. */
export function getWaveInfo() {
    let timer = 0;
    let progressText = ""; // Still keep progress text for debugging/potential future use
    let currentWaveNumber = getCurrentWaveNumber(); // Get 1-based number
    let maxTimer = currentMaxTimer; // Use the current max timer

    // Determine current timer and progress text based on state
    switch (state) {
        case 'PRE_WAVE':
            timer = preWaveTimer;
            maxTimer = Config.WAVE_START_DELAY; // Explicitly use the config value for pre-wave
            progressText = "First Wave Incoming"; // Keep for console/debug
            break;
        case 'WAVE_COUNTDOWN':
            timer = mainWaveTimer;
            // The maxTimer for WAVE_COUNTDOWN is set in startNextWave (waveData.duration)
            progressText = `Wave ${currentWaveNumber} Active`; // Keep for console/debug
            // Optional: Add enemy count or spawning progress to progressText if needed for debug
            const livingEnemies = EnemyManager.getLivingEnemyCount();
            if (livingEnemies > 0) {
                 progressText += ` (${livingEnemies} Enemies Left)`;
            } else {
                 progressText += ` (Clearing...)`;
            }
            break;
        case 'BUILDPHASE':
            timer = buildPhaseTimer;
             // The maxTimer for BUILDPHASE is set in endWave (calculated value)
            progressText = `Wave ${currentWaveNumber} Complete. Build Time!`; // Refer to completed wave
            break;
        case 'WARPPHASE':
             timer = warpPhaseTimer;
             // The maxTimer for WARPPHASE is set on entering the state (Config.WARPPHASE_DURATION)
             progressText = `Wave ${currentWaveNumber} Complete. Warping...`; // Refer to completed wave
             break;
        case 'GAME_OVER':
            timer = 0;
            maxTimer = 1; // Prevent division by zero in UI percent calculation
            progressText = "Game Over"; // Keep for console/debug
            // currentWaveNumber is handled by getCurrentWaveNumber() for Game Over
            break;
        case 'VICTORY':
            timer = 0;
            maxTimer = 1; // Prevent division by zero
            progressText = "Victory!"; // Keep for console/debug
            currentWaveNumber = Config.WAVES.length; // Show total number of waves cleared
            break;
        default:
             timer = 0;
             maxTimer = 1; // Avoid division by zero
             progressText = '---'; // Keep for console/debug
             break;
    }

    return {
        state: state, // Pass the actual state string
        mainWaveNumber: currentWaveNumber,
        timer: timer, // Time remaining in the current state
        maxTimer: maxTimer, // Initial duration of the current state (for UI bar width)
        progressText: progressText, // Keep for debug/console
        isGameOver: state === 'GAME_OVER', // Use direct state check for game over
        allWavesCleared: state === 'VICTORY' // Use direct state check for victory
    };
}