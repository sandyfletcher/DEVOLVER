// -----------------------------------------------------------------------------
// root/js/waveManager.js - Manages waves of enemies and timing (TIME-BASED)
// -----------------------------------------------------------------------------

import * as UI from './ui.js';
import * as Config from './config.js';
import * as ItemManager from './itemManager.js';
import * as World from './utils/world.js';
import * as EnemyManager from './enemyManager.js';
import * as AudioManager from './audioManager.js';
import * as WorldManager from './worldManager.js';
import * as AgingManager from './agingManager.js';

let currentMainWaveIndex = -1;
let currentSubWaveIndex = 0;
let currentGroupIndex = 0;
let enemiesSpawnedThisGroup = 0;
let groupSpawnTimer = 0;
let groupStartDelayTimer = 0;
// MODIFIED States: PRE_WAVE, WAVE_COUNTDOWN, BUILDPHASE, WARP_LOGIC, WARP_ANIMATING, VICTORY, GAME_OVER
let state = 'PRE_WAVE';
let preWaveTimer = Config.WAVE_START_DELAY;
let mainWaveTimer = 0;
let buildPhaseTimer = 0;
let warpPhaseTimer = 0; // Used for WARP_LOGIC duration
let currentMaxTimer = 0;
let waveStartCallback = null;
let portalRef = null;

// --- Internal Helper Functions (largely unchanged) ---
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
function advanceSpawnProgression() {
    const subWaveData = getCurrentSubWaveData();
    if (!subWaveData) {
        currentGroupIndex = -1;
        currentSubWaveIndex = -1;
        return false;
    }
    currentGroupIndex++;
    if (currentGroupIndex < subWaveData.enemyGroups.length) {
        const groupData = getCurrentGroupData();
        enemiesSpawnedThisGroup = 0;
        groupSpawnTimer = 0;
        groupStartDelayTimer = groupData.startDelay ?? 0;
        return true;
    } else {
        currentSubWaveIndex++;
        currentGroupIndex = 0;
        const nextSubWaveData = getCurrentSubWaveData();
        if (nextSubWaveData) {
            const groupData = nextSubWaveData.enemyGroups[0];
            enemiesSpawnedThisGroup = 0;
            groupSpawnTimer = 0;
            groupStartDelayTimer = groupData?.startDelay ?? 0;
            return true;
        } else {
            currentGroupIndex = -1;
            currentSubWaveIndex = -1;
            return false;
        }
    }
}

function startNextWave() {
    currentMainWaveIndex++;
    const waveData = getCurrentWaveData();
    if (!waveData) {
        state = 'VICTORY';
        currentMaxTimer = 0;
        return false;
    }
    if (currentMainWaveIndex === 0 && waveData.epochName) {
         UI.showEpochText(waveData.epochName);
    } else if (currentMainWaveIndex === 0) {
        UI.showEpochText(`Starting Wave ${waveData.mainWaveNumber}`);
    }
    // Else: epoch text for subsequent waves is shown during WARP_LOGIC

    state = 'WAVE_COUNTDOWN';
    mainWaveTimer = waveData.duration;
    currentMaxTimer = waveData.duration;
    if (typeof waveStartCallback === 'function') {
        waveStartCallback(waveData.mainWaveNumber);
    }
    if (waveData.audioTrack) {
        AudioManager.playGameMusic(waveData.audioTrack);
    } else {
        AudioManager.stopGameMusic();
    }
    currentSubWaveIndex = 0;
    currentGroupIndex = 0;
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0;
    const firstGroup = getCurrentGroupData();
    if (firstGroup) {
        groupStartDelayTimer = firstGroup.startDelay ?? 0;
    } else {
        groupStartDelayTimer = waveData.duration + 1;
    }
    return true;
}

function endWave() {
    const waveData = getCurrentWaveData();
    if (!waveData) {
        state = 'GAME_OVER';
        currentMaxTimer = 0;
        return;
    }
    if (currentMainWaveIndex + 1 < Config.WAVES.length) {
        state = 'BUILDPHASE';
        const waveIntermissionDuration = waveData.intermissionDuration ?? (Config.WARPPHASE_DURATION + 5.0); // Adjusted fallback
        buildPhaseTimer = Math.max(0, waveIntermissionDuration - Config.WARPPHASE_DURATION); // WARPPHASE_DURATION is now for WARP_LOGIC
        warpPhaseTimer = 0;
        currentMaxTimer = buildPhaseTimer;
        AudioManager.stopGameMusic();
    } else {
        state = 'VICTORY';
        currentMaxTimer = 0;
    }
    currentSubWaveIndex = 0;
    currentGroupIndex = 0;
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0;
    groupStartDelayTimer = 0;
}

function triggerWarpCleanup() {
    console.log("[WaveMgr] Triggering Warp Cleanup (Entity Clearing & Portal Radius)...");
    if (!portalRef) {
        console.error("[WaveMgr] Warp Cleanup failed: Portal reference is null.");
        return;
    }
    portalRef.setSafetyRadius(portalRef.safetyRadius + Config.PORTAL_RADIUS_GROWTH_PER_WAVE);
    const portalCenter = portalRef.getPosition();
    const safeRadius = portalRef.safetyRadius;
    ItemManager.clearItemsOutsideRadius(portalCenter.x, portalCenter.y, safeRadius);
    EnemyManager.clearEnemiesOutsideRadius(portalCenter.x, portalCenter.y, safeRadius);
}

// --- Exported Functions ---
export function init(callback = null, portalObject = null) {
    currentMainWaveIndex = -1;
    currentSubWaveIndex = 0;
    currentGroupIndex = 0;
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0;
    groupStartDelayTimer = 0;
    state = 'PRE_WAVE';
    preWaveTimer = Config.WAVE_START_DELAY;
    currentMaxTimer = Config.WAVE_START_DELAY;
    mainWaveTimer = 0;
    buildPhaseTimer = 0;
    warpPhaseTimer = 0;
    waveStartCallback = callback;
    portalRef = portalObject;
    console.log(`[WaveManager] Initialized. State: ${state}, First Wave In: ${preWaveTimer}s.`);
}

export function reset(callback = null, portalObject = null) {
    init(callback, portalObject);
    console.log("[WaveManager] Resetting.");
}

export function update(dt, gameState) {
    if (dt <= 0) return;

    switch (state) {
        case 'PRE_WAVE':
            if (gameState === 'RUNNING') {
                preWaveTimer -= dt;
                if (preWaveTimer <= 0) {
                    startNextWave();
                }
            }
            break;

        case 'WAVE_COUNTDOWN':
            if (gameState === 'RUNNING') {
                mainWaveTimer -= dt;
                if (mainWaveTimer <= 0) {
                    mainWaveTimer = 0;
                    endWave();
                    break;
                }
                const subWaveData = getCurrentSubWaveData();
                const groupData = getCurrentGroupData();
                if (subWaveData && groupData && currentGroupIndex !== -1) {
                    if (groupStartDelayTimer > 0) {
                        groupStartDelayTimer -= dt;
                    } else {
                        if (enemiesSpawnedThisGroup < groupData.count) {
                            groupSpawnTimer -= dt;
                            if (groupSpawnTimer <= 0) {
                                const spawned = EnemyManager.trySpawnEnemy(groupData.type);
                                if (spawned) {
                                    enemiesSpawnedThisGroup++;
                                    groupSpawnTimer = groupData.delayBetween > 0 ? groupData.delayBetween : 0.1;
                                    if (groupData.delayBetween <= 0 && enemiesSpawnedThisGroup < groupData.count) {
                                        groupSpawnTimer = 0;
                                    }
                                } else {
                                    groupSpawnTimer = 0.2;
                                }
                            }
                        } else {
                            advanceSpawnProgression();
                        }
                    }
                }
            }
            break;

        case 'BUILDPHASE':
            buildPhaseTimer -= dt;
            if (buildPhaseTimer <= 0) {
                buildPhaseTimer = 0;
                state = 'WARP_LOGIC'; // Transition to WARP_LOGIC
                warpPhaseTimer = Config.WARPPHASE_DURATION; // Set timer for logical processing
                currentMaxTimer = Config.WARPPHASE_DURATION;
                console.log(`[WaveMgr] Transitioned to WARP_LOGIC (${warpPhaseTimer.toFixed(2)}s).`);
                triggerWarpCleanup(); // Entity clearing & portal radius happens at start of WARP_LOGIC
            }
            break;

        case 'WARP_LOGIC': // New state for logical changes and animation queuing
            warpPhaseTimer -= dt;
            if (warpPhaseTimer <= 0) {
                warpPhaseTimer = 0;
                console.log("[WaveMgr] WARP_LOGIC timer ended. Processing world changes & queueing animations...");

                // 1. Logical Gravity Settlement
                console.log("[WaveMgr] Applying gravity settlement (LOGICAL)...");
                let gravityAnimationChanges = [];
                if (portalRef) {
                    gravityAnimationChanges = WorldManager.applyGravitySettlement(portalRef);
                } else {
                    console.error("[WaveMgr] Cannot apply gravity settlement: portalRef is null.");
                }
                console.log(`[WaveMgr] Gravity settlement (LOGICAL) complete. ${gravityAnimationChanges.length} blocks moved.`);
                if (gravityAnimationChanges.length > 0) {
                    WorldManager.addProposedGravityChanges(gravityAnimationChanges);
                }

                // 2. Logical Aging Process (using simplified return from AgingManager)
                console.log("[WaveMgr] Applying aging process (LOGICAL) post-settlement...");
                const nextWaveIndexToPrepareFor = currentMainWaveIndex + 1;
                const nextWaveData = Config.WAVES[nextWaveIndexToPrepareFor];
                let allAgingChangesDetailed = [];

                if (nextWaveData && typeof nextWaveData === 'object') {
                    const passes = nextWaveData.agingPasses ?? Config.AGING_DEFAULT_PASSES_PER_WAVE;
                    const intensity = nextWaveData.agingIntensity ?? Config.AGING_BASE_INTENSITY;
                    
                    for (let i = 0; i < passes; i++) {
                        // AgingManager.applyAging now returns detailed changes
                        const detailedChangesInPass = AgingManager.applyAging(portalRef, intensity); 
                        allAgingChangesDetailed.push(...detailedChangesInPass);
                        // TODO: Consider if deduplication of changes is needed if a block ages multiple times.
                        // For now, each change will queue an animation.
                    }
                    
                    console.log(`[WaveMgr] Aging (LOGICAL) complete. ${allAgingChangesDetailed.length} detailed changes from AgingManager.`);
                    if (allAgingChangesDetailed.length > 0) {
                        WorldManager.addProposedAgingChanges(allAgingChangesDetailed);
                    }
                    
                    const epochName = nextWaveData.epochName ?? `Preparing Wave ${nextWaveData.mainWaveNumber ?? 'Next'}`;
                    UI.showEpochText(epochName); // Show epoch text for upcoming wave
                } else {
                    UI.showEpochText("Final Preparations..."); // Fallback if no next wave data
                }
                
                state = 'WARP_ANIMATING';
                console.log("[WaveMgr] Transitioned to WARP_ANIMATING. Waiting for animations to complete.");
                currentMaxTimer = 1; // UI shows text "Warping..." or similar
            }
            break;

        case 'WARP_ANIMATING': // New state for waiting for animations
            // WorldManager.update(dt) is called by main.js and will advance animations.
            if (WorldManager.areGravityAnimationsComplete() && WorldManager.areAgingAnimationsComplete()) {
                console.log("[WaveMgr] All warp animations complete. Finalizing warp.");
                WorldManager.renderStaticWorldToGridCanvas(); // Final render after all animations
                WorldManager.seedWaterUpdateQueue();
                startNextWave(); // Transition to next WAVE_COUNTDOWN or VICTORY
            }
            // UI timer can show "Warping..." or "Morphing..."
            break;

        // VICTORY and GAME_OVER states do not have active timers to decrement.
        case 'VICTORY':
        case 'GAME_OVER':
            break;
        default:
            break;
    }
}

export function setGameOver() {
    if (state !== 'GAME_OVER') {
        state = 'GAME_OVER';
        preWaveTimer = 0; mainWaveTimer = 0; buildPhaseTimer = 0; warpPhaseTimer = 0;
        groupSpawnTimer = 0; groupStartDelayTimer = 0;
        currentMaxTimer = 0;
    }
}

export function setVictory() {
    if (state !== 'VICTORY') {
        state = 'VICTORY';
        preWaveTimer = 0; mainWaveTimer = 0; buildPhaseTimer = 0; warpPhaseTimer = 0;
        groupSpawnTimer = 0; groupStartDelayTimer = 0;
        currentMaxTimer = 0;
    }
}

export function isGameOver() {
    return state === 'GAME_OVER';
}

export function getCurrentWaveNumber() {
    if (state === 'GAME_OVER' || state === 'VICTORY') {
        return Math.max(0, currentMainWaveIndex + 1);
    }
    if (state === 'BUILDPHASE' || state === 'WARP_LOGIC' || state === 'WARP_ANIMATING') {
        return currentMainWaveIndex + 2; // Show upcoming wave number
    }
    return (currentMainWaveIndex < 0) ? 1 : currentMainWaveIndex + 1;
}

export function getWaveInfo() {
    let timer = 0;
    let currentWaveNumber = getCurrentWaveNumber();
    let maxTimerToUse = currentMaxTimer;

    switch (state) {
        case 'PRE_WAVE':
            timer = preWaveTimer;
            maxTimerToUse = Config.WAVE_START_DELAY;
            break;
        case 'WAVE_COUNTDOWN':
            timer = mainWaveTimer;
            // maxTimerToUse is already set
            break;
        case 'BUILDPHASE':
            timer = buildPhaseTimer;
            // maxTimerToUse is already set
            break;
        case 'WARP_LOGIC': // Timer for logical processing
            timer = warpPhaseTimer;
            // maxTimerToUse is already set (Config.WARPPHASE_DURATION)
            break;
        case 'WARP_ANIMATING': // No specific timer, but UI can show text
            timer = 1; maxTimerToUse = 1; // Indicates progress but not a countdown
            break;
        case 'GAME_OVER':
        case 'VICTORY':
            timer = 0; maxTimerToUse = 1;
            break;
        default:
            timer = 0; maxTimerToUse = 1;
            break;
    }
    return {
        state: state,
        mainWaveNumber: currentWaveNumber,
        timer: timer,
        maxTimer: maxTimerToUse,
        isGameOver: state === 'GAME_OVER',
        allWavesCleared: state === 'VICTORY'
    };
}