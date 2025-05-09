// -----------------------------------------------------------------------------
// root/js/waveManager.js - Manages waves of enemies and timing (TIME-BASED)
// -----------------------------------------------------------------------------

import * as UI from './ui.js';
import * as Config from './config.js';
import * as ItemManager from './itemManager.js';
import * as WorldData from './utils/worldData.js';
import * as EnemyManager from './enemyManager.js';
import * as AudioManager from './audioManager.js';
import * as WorldManager from './worldManager.js';
import * as AgingManager from './agingManager.js';

let currentMainWaveIndex = -1; // Index in Config.WAVES array (-1 means not started)
let currentSubWaveIndex = 0;   // Index within the current main wave's subWaves array
let currentGroupIndex = 0;     // Index within the current sub-wave's enemyGroups array
let enemiesSpawnedThisGroup = 0; // Count for the current group being spawned
let groupSpawnTimer = 0;       // Timer for delay *between* enemies in the current group
let groupStartDelayTimer = 0;  // Timer for the delay *before* the current group starts (relative to sub-wave start)
let state = 'PRE_WAVE'; // States: PRE_WAVE, WAVE_COUNTDOWN, BUILDPHASE, WARPPHASE, VICTORY, GAME_OVER
let preWaveTimer = Config.WAVE_START_DELAY; // Timer before the very first wave
let mainWaveTimer = 0; // Timer for the total duration of the current main wave
let buildPhaseTimer = 0; // Timer for the building phase
let warpPhaseTimer = 0; // Timer for the cleanup/warp phase
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
function advanceSpawnProgression() { // Advances the internal spawning progression state (moves to next group or sub-wave)
    const subWaveData = getCurrentSubWaveData();
    if (!subWaveData) { // This implies we finished the last sub-wave or an error occurred and spawning for this wave cycle is complete.
        console.log(`[WaveMgr] Spawning complete for Wave ${currentMainWaveIndex + 1}.`);
        currentGroupIndex = -1; // Use sentinel values to indicate finished spawning
        currentSubWaveIndex = -1;
        // The state remains WAVE_COUNTDOWN until the mainWaveTimer runs out.
        return false;
    }
    currentGroupIndex++; // Move to the next group index
    if (currentGroupIndex < subWaveData.enemyGroups.length) { // Successfully moved to the next group in the current sub-wave
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
// --- Starts the next main wave, sets up timers and initial spawning state ---
function startNextWave() {
    currentMainWaveIndex++; // Increment index to point to the *next* wave to start
    const waveData = getCurrentWaveData(); // Get data for the *new* current index
    if (!waveData) {
        // No more waves found, transition to victory state
        console.log("[WaveMgr] All defined waves completed!");
        state = 'VICTORY';
        currentMaxTimer = 0; // No timer in victory state
        console.log("[WaveMgr] Transitioned to VICTORY state.");
        return false; // Indicates no wave was started
    }
    // --- Show epoch text for the first wave if it's just starting ---
    if (currentMainWaveIndex === 0) { // This is the first wave (index 0)
        if (waveData.epochName) {
            UI.showEpochText(waveData.epochName);
        } else {
            UI.showEpochText(`Starting Wave ${waveData.mainWaveNumber}`); // Fallback
        }
    }
    // Found a valid next wave, start the countdown
    state = 'WAVE_COUNTDOWN';
    mainWaveTimer = waveData.duration; // Set timer to the wave's total duration
    currentMaxTimer = waveData.duration; // Set max timer for UI
    console.log(`[WaveMgr] Starting Main Wave ${waveData.mainWaveNumber}. Duration: ${mainWaveTimer}s`);
    // Call the callback to notify the main loop (e.g., to show epoch text)
    if (typeof waveStartCallback === 'function') {
        console.log(`[WaveMgr] Calling waveStartCallback for wave ${waveData.mainWaveNumber}.`);
        waveStartCallback(waveData.mainWaveNumber); // Pass the 1-based wave number
    } else {
        console.warn("[WaveMgr] No waveStartCallback function registered.");
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
        // console.log(`[WaveMgr] Setup Group ${currentGroupIndex + 1} (Type: ${firstGroup.type}, Count: ${firstGroup.count}) in Sub-Wave ${currentMainWaveIndex+1}.${currentSubWaveIndex+1}. Start Delay: ${groupStartDelayTimer}s`);
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
    } else { // No more waves, transition to victory
        state = 'VICTORY';
        currentMaxTimer = 0; // No timer in victory state
        console.log("[WaveMgr] All waves completed! Transitioned to VICTORY state.");
    }
    // Reset spawning progression pointers after ending a wave (applies to the *next* wave)
    currentSubWaveIndex = 0;
    currentGroupIndex = 0;
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0;
    groupStartDelayTimer = 0; // Will be set up properly when startNextWave is called later
}
// Helper to capture the current state of the grid (types only)
function captureCurrentGridState() {
    const grid = WorldData.getGrid();
    return grid.map(row => row.map(block => (typeof block === 'object' ? block.type : block)));
}
// Helper to diff two grid states
function diffGrids(gridStateBefore, gridStateAfterSnapshot) {
    const changes = [];
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const typeBefore = gridStateBefore[r]?.[c]; // Use optional chaining
            const blockAfter = gridStateAfterSnapshot[r]?.[c]; // Get the block object/value
            const typeAfter = (typeof blockAfter === 'object' && blockAfter !== null) ? blockAfter.type : blockAfter;
            if (typeBefore !== undefined && typeAfter !== undefined && typeBefore !== typeAfter) {
                changes.push({ c, r, oldBlockType: typeBefore, newBlockType: typeAfter });
            }
        }
    }
    return changes;
}

/** Function to trigger aging, animation queuing, and entity cleanup */
function triggerWarpCleanup() {
    console.log("[WaveMgr] Triggering Warp Cleanup...");
    if (!portalRef) {
        console.error("[WaveMgr] Warp Cleanup failed: Portal reference is null.");
        return;
    }
    // 1. Update portal safety radius
    portalRef.setSafetyRadius(portalRef.safetyRadius + Config.PORTAL_RADIUS_GROWTH_PER_WAVE);
    console.log(`[WaveMgr] Portal Safety Radius Increased to ${portalRef.safetyRadius.toFixed(1)}.`);
    // 2. Clear Enemies and Items Outside the Portal's Safety Radius
    const portalCenter = portalRef.getPosition();
    const safeRadius = portalRef.safetyRadius;
    ItemManager.clearItemsOutsideRadius(portalCenter.x, portalCenter.y, safeRadius);
    EnemyManager.clearEnemiesOutsideRadius(portalCenter.x, portalCenter.y, safeRadius);
    console.log(`[WaveMgr] Cleared entities/items outside portal radius ${safeRadius.toFixed(1)}.`);
    const nextWaveIndexToPrepareFor = currentMainWaveIndex + 1;
    const nextWaveData = Config.WAVES[nextWaveIndexToPrepareFor];
    if (nextWaveData && typeof nextWaveData === 'object') { // Ensure nextWaveData is a valid object
        const passes = nextWaveData.agingPasses ?? Config.AGING_DEFAULT_PASSES_PER_WAVE;
        const intensity = nextWaveData.agingIntensity ?? Config.AGING_BASE_INTENSITY;
        console.log(`[WaveMgr] Preparing aging for upcoming Wave ${nextWaveData.mainWaveNumber ?? 'Unknown'} (${passes} passes, intensity ${intensity.toFixed(2)})...`);
        const gridStateBeforeAging = captureCurrentGridState();
        for (let i = 0; i < passes; i++) {
            AgingManager.applyAging(portalRef, intensity);
        }
        console.log(`[WaveMgr] Aging passes complete for Wave ${nextWaveData.mainWaveNumber ?? 'Unknown'}. WorldData updated.`);

        const finalGridState = WorldData.getGrid();
        const proposedVisualChanges = diffGrids(gridStateBeforeAging, finalGridState);
        console.log(`[WaveMgr] Found ${proposedVisualChanges.length} net visual changes for animation.`);
        if (proposedVisualChanges.length > 0) {
            WorldManager.addProposedAgingChanges(proposedVisualChanges);
        }
        // Show Epoch Text for the upcoming wave
        const epochName = nextWaveData.epochName ?? `Preparing Wave ${nextWaveData.mainWaveNumber ?? 'Next'}`;
        UI.showEpochText(epochName);
    } else {
        console.warn(`[WaveMgr] triggerWarpCleanup: No valid nextWaveData found. Index: ${nextWaveIndexToPrepareFor}. Skipping aging and epoch text for next wave.`);
        // Fallback epoch text if no next wave (should ideally not happen if victory state is handled correctly)
        UI.showEpochText("Final Preparations...");
    }
    // The renderStaticWorldToGridCanvas() and seedWaterUpdateQueue() calls will now happen
    // at the END of the WARPPHASE timer in the main update loop of WaveManager.
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
    console.log(`[WaveManager] Initialized. State: ${state}, First Wave In: ${preWaveTimer}s.`);
}

// Resets the wave manager, typically for restarting the game
// Pass the callback and portal reference here as well
export function reset(callback = null, portalObject = null) {
    // Pass the callback and portal during reset as well
    init(callback, portalObject); // Re-initialize using the init function
    console.log("[WaveManager] Resetting.");
}

// Updates the wave state machine, handling timers and spawning. Timers only decrement if the game is in the RUNNING state.
export function update(dt, gameState) {

    // MODIFIED: Timers for BUILDPHASE and WARPPHASE should run even if gameState is PAUSED,
    // but other game logic (like spawning) should only happen if gameState is RUNNING.
    // For simplicity, let's assume dt is only > 0 if the game isn't fully frozen.
    // If dt is 0, timers won't progress.

    if (dt > 0) { // Only process timers if time has passed
        switch (state) {
            case 'PRE_WAVE':
                if (gameState === 'RUNNING') { // Only run pre-wave timer if game is actively running
                    preWaveTimer -= dt;
                    if (preWaveTimer <= 0) {
                        console.log("[WaveMgr] preWaveTimer <= 0. Starting next wave.");
                        startNextWave(); // This handles transition to WAVE_COUNTDOWN or VICTORY
                    }
                }
                // maxTimer remains Config.WAVE_START_DELAY
                break;

            case 'WAVE_COUNTDOWN':
                if (gameState === 'RUNNING') { // Only run main wave timer and spawning if game is actively running
                    mainWaveTimer -= dt;
                    if (mainWaveTimer <= 0) {
                        mainWaveTimer = 0; // Ensure it doesn't go negative in display
                        console.log("[WaveMgr] mainWaveTimer <= 0. Ending wave.");
                        endWave(); // This handles transition to BUILDPHASE or VICTORY
                        break; // State changed, exit switch for this frame
                    }
                    // --- Handle Enemy Spawning Progression ---
                    const subWaveData = getCurrentSubWaveData();
                    const groupData = getCurrentGroupData();
                    if (subWaveData && groupData && currentGroupIndex !== -1) { // Ensure not -1 (finished)
                        if (groupStartDelayTimer > 0) {
                            groupStartDelayTimer -= dt;
                        } else {
                            if (enemiesSpawnedThisGroup < groupData.count) {
                                groupSpawnTimer -= dt;
                                if (groupSpawnTimer <= 0) {
                                    const spawned = EnemyManager.trySpawnEnemy(groupData.type);
                                    if (spawned) {
                                        enemiesSpawnedThisGroup++;
                                        // Ensure delayBetween is positive, else use a small default to avoid tight loop
                                        groupSpawnTimer = groupData.delayBetween > 0 ? groupData.delayBetween : 0.1;
                                        // If spawning instantly (delay=0), reset timer immediately for next potential spawn
                                        if (groupData.delayBetween <= 0 && enemiesSpawnedThisGroup < groupData.count) {
                                            groupSpawnTimer = 0; // Allow next spawn attempt in the same frame if delay is 0
                                        }
                                    } else {
                                        groupSpawnTimer = 0.2; // Short delay if spawn failed (e.g., max enemies)
                                    }
                                }
                            } else {
                                advanceSpawnProgression(); // Move to next group or sub-wave
                            }
                        }
                    }
                }
                break;
            case 'BUILDPHASE':
                // Build phase timer always runs if dt > 0, regardless of main gameState RUNNING/PAUSED
                buildPhaseTimer -= dt;
                if (buildPhaseTimer <= 0) {
                    buildPhaseTimer = 0;
                    state = 'WARPPHASE';
                    warpPhaseTimer = Config.WARPPHASE_DURATION;
                    currentMaxTimer = Config.WARPPHASE_DURATION;
                    console.log(`[WaveMgr] Transitioned to WARPPHASE (${warpPhaseTimer.toFixed(2)}s).`);
                    triggerWarpCleanup(); // Call cleanup (which now queues animations)
                    console.log(`[WaveMgr] Aging animation queuing triggered for WARPPHASE.`);
                }
                break;
            case 'WARPPHASE':
                // Warp phase timer always runs if dt > 0
                warpPhaseTimer -= dt;
                if (warpPhaseTimer <= 0) {
                    warpPhaseTimer = 0;
                    console.log("[WaveMgr] WARPPHASE timer ended.");
                    WorldManager.finalizeAllAgingAnimations(); // Finalize any ongoing aging animations immediately
                    // Now that all WorldData changes are visually committed (or forced),
                    // re-render the entire static canvas and seed water.
                    console.log("[WaveMgr] Rendering final static world and seeding water queue after WARPPHASE.");
                    WorldManager.renderStaticWorldToGridCanvas();
                    WorldManager.seedWaterUpdateQueue();
                
                    startNextWave(); // Transition to next WAVE_COUNTDOWN or VICTORY
                }
                break;
            // VICTORY and GAME_OVER states do not have active timers to decrement.
            case 'VICTORY':
            case 'GAME_OVER':
                // No timer updates needed for these states.
                break;
            default:
                break;
        }
    }
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
    // currentMainWaveIndex is -1 before wave 1, 0 during wave 1 and its intermission, 1 during wave 2 etc.
    // In GAME_OVER or VICTORY, return the wave number reached *before* ending.
    if (state === 'GAME_OVER' || state === 'VICTORY') {
        // If the game ended during PRE_WAVE, the "reached wave" is 0.
        // Otherwise, it's the currentMainWaveIndex + 1 (the wave that was active or just completed).
        // A slightly more complex logic might be needed if game over can happen exactly at the transition,
        // but this is usually sufficient for display.
        return Math.max(0, currentMainWaveIndex + 1);
    }
    // If in WARPPHASE or BUILDPHASE, currentMainWaveIndex is the wave that *just finished*.
    // We want to display the NEXT wave number in the UI during intermission countdown.
    // Fix: If in intermission, currentMainWaveIndex is the index of the wave that *just finished*.
    // The number of the wave that JUST FINISHED is currentMainWaveIndex + 1.
    // The number of the wave that is UPCOMING is (currentMainWaveIndex + 1) + 1.
    // Let's display the number of the UPCOMING wave during intermission (BUILDPHASE/WARPPHASE)
    if (state === 'BUILDPHASE' || state === 'WARPPHASE') {
        // currentMainWaveIndex is the index of the wave that *just completed* (e.g., 0 after wave 1 finishes).
        // The next wave number is index + 2 (e.g., 0 + 2 = 2 for wave 2).
        return currentMainWaveIndex + 2; // Show the *next* wave number
    }

    // If in PRE_WAVE, the currentMainWaveIndex is -1. We want to show "Wave 1" upcoming.
    // If in WAVE_COUNTDOWN, the currentMainWaveIndex is the wave currently active. Show currentMainWaveIndex + 1.
    return (currentMainWaveIndex < 0) ? 1 : currentMainWaveIndex + 1; // Show "Wave 1" during PRE_WAVE, current wave number during WAVE_COUNTDOWN
}

/** Returns an object containing relevant wave info for UI or other systems. */
export function getWaveInfo() {
    let timer = 0;
    // MODIFIED: progressText will be built by UI.js's updateWaveTimer
    // let progressText = ""; 
    let currentWaveNumber = getCurrentWaveNumber(); // getCurrentWaveNumber already handles state logic
    let maxTimer = currentMaxTimer; // Use the module-level max timer
    switch (state) {
        case 'PRE_WAVE':
            timer = preWaveTimer;
            maxTimer = Config.WAVE_START_DELAY; // Max timer for pre-wave is the start delay
            break;
        case 'WAVE_COUNTDOWN':
            timer = mainWaveTimer;
            // maxTimer is already set by startNextWave to waveData.duration
            break;
        case 'BUILDPHASE':
            timer = buildPhaseTimer;
            // maxTimer is already set by endWave to buildPhaseTimer initial value
            break;
        case 'WARPPHASE':
            timer = warpPhaseTimer;
            // maxTimer is already set when transitioning to WARPPHASE
            break;
        case 'GAME_OVER':
            timer = 0; maxTimer = 1; // Ensure maxTimer is not 0 for UI
            break;
        case 'VICTORY':
            timer = 0; maxTimer = 1; // Ensure maxTimer is not 0 for UI
            break;
        default:
            timer = 0; maxTimer = 1; // Default for unknown states
            break;
    }
    return {
        state: state, // e.g., "PRE_WAVE", "WAVE_COUNTDOWN", "BUILDPHASE", "WARPPHASE", "VICTORY"
        mainWaveNumber: currentWaveNumber, // The 1-based number of the current or upcoming wave
        timer: timer, // Current value of the relevant timer for this state
        maxTimer: maxTimer, // The maximum value for the current timer (for UI progress bar)
        isGameOver: state === 'GAME_OVER', // Flag for game over state
        allWavesCleared: state === 'VICTORY' // Flag for victory state
    };
}
