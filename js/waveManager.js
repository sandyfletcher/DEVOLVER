// -----------------------------------------------------------------------------
// root/js/waveManager.js - Manages waves of enemies and timing (TIME-BASED)
// -----------------------------------------------------------------------------

import * as UI from './ui.js';
import * as Config from './utils/config.js';
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
let state = 'PRE_WAVE';
let preWaveTimer = Config.WAVE_START_DELAY;
let mainWaveTimer = 0;
let buildPhaseTimer = 0;
let currentMaxTimer = 0;
let waveStartCallback = null;
let portalRef = null;

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

    if (typeof waveData.mya === 'number') {
        UI.showEpochText(waveData.mya);
    } else if (waveData.customEpochText) {
        UI.showEpochText(waveData.customEpochText);
    } else {
        UI.showEpochText(`Starting Wave ${waveData.mainWaveNumber}`);
    }

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
function endWave() { // This function IS defined here
    const waveData = getCurrentWaveData();
    if (!waveData) {
        state = 'GAME_OVER'; // Should be caught by victory check first usually
        currentMaxTimer = 0;
        console.warn("[WaveManager] endWave called but no current wave data. Setting GAME_OVER.");
        return;
    }
    if (currentMainWaveIndex + 1 < Config.WAVES.length) {
        state = 'BUILDPHASE';
        buildPhaseTimer = waveData.intermissionDuration ?? (Config.AGING_DEFAULT_PASSES_PER_WAVE * 0.5 + 10.0);
        currentMaxTimer = buildPhaseTimer;
        AudioManager.stopGameMusic(); // Stop wave music during build phase
    } else {
        state = 'VICTORY';
        currentMaxTimer = 0;
        AudioManager.stopGameMusic(); // Stop wave music on victory
    }
    // Reset spawning progression for the next phase (build or next wave)
    currentSubWaveIndex = 0;
    currentGroupIndex = 0;
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0;
    groupStartDelayTimer = 0; // Will be set by startNextWave or triggerWarp... if needed
}
function triggerWarpCleanupAndCalculations() {
    console.log("[WaveMgr] End of BUILDPHASE. Triggering entity cleanup, calculations, and animation queuing...");
    if (!portalRef) {
        console.error("[WaveMgr] Warp process failed: Portal reference is null.");
        return;
    }
    // 1. Entity Clearing & Portal Radius
    portalRef.setSafetyRadius(portalRef.safetyRadius + Config.PORTAL_RADIUS_GROWTH_PER_WAVE);
    const portalCenter = portalRef.getPosition();
    const safeRadius = portalRef.safetyRadius;
    ItemManager.clearItemsOutsideRadius(portalCenter.x, portalCenter.y, safeRadius);
    EnemyManager.clearEnemiesOutsideRadius(portalCenter.x, portalCenter.y, safeRadius);
    console.log("[WaveMgr] Entity cleanup and portal radius update complete.");
    
    // 2. Logical Gravity Settlement
    console.log("[WaveMgr] Applying gravity settlement (LOGICAL)...");
    let gravityAnimationChanges = WorldManager.applyGravitySettlement(portalRef);
    console.log(`[WaveMgr] Gravity settlement (LOGICAL) complete. ${gravityAnimationChanges.length} blocks moved.`);
    if (gravityAnimationChanges.length > 0) {
        WorldManager.addProposedGravityChanges(gravityAnimationChanges);
    }

    // 3. Logical Aging Process
    console.log("[WaveMgr] Applying aging process (LOGICAL) post-settlement...");
    const nextWaveIndexToPrepareFor = currentMainWaveIndex + 1;
    const nextWaveData = Config.WAVES[nextWaveIndexToPrepareFor];
    let allVisualAgingChangesFromAgingPasses = []; 
    let allGravityChangesFromAgingPasses = [];   
    
    const currentWaveData = getCurrentWaveData();
    const currentMya = currentWaveData ? currentWaveData.mya : undefined;
    const nextMya = nextWaveData ? nextWaveData.mya : undefined;

    if (typeof currentMya === 'number' && typeof nextMya === 'number') {
        UI.startMyaEpochTransition(currentMya, nextMya, Config.MYA_TRANSITION_ANIMATION_DURATION);
    } else {
        if (nextWaveData) {
            if (typeof nextWaveData.mya === 'number') UI.showEpochText(nextWaveData.mya);
            else if (nextWaveData.customEpochText) UI.showEpochText(nextWaveData.customEpochText);
            else UI.showEpochText(`Preparing Wave ${nextWaveData.mainWaveNumber || 'Next'}`);
        } else {
            UI.showEpochText("Final Preparations..."); // Should lead to victory
        }
    }

    if (nextWaveData && typeof nextWaveData === 'object') {
        const passes = nextWaveData.agingPasses ?? Config.AGING_DEFAULT_PASSES_PER_WAVE;
        for (let i = 0; i < passes; i++) {
            WorldManager.applyLightingPass();
            const changesInPass = AgingManager.applyAging(portalRef);
            if (changesInPass.visualChanges && Array.isArray(changesInPass.visualChanges)) {
                allVisualAgingChangesFromAgingPasses.push(...changesInPass.visualChanges);
            }
            if (changesInPass.gravityChanges && Array.isArray(changesInPass.gravityChanges)) {
                allGravityChangesFromAgingPasses.push(...changesInPass.gravityChanges);
            }
        }
        console.log(`[WaveMgr] Aging (LOGICAL) complete. ${allVisualAgingChangesFromAgingPasses.length} visual changes, ${allGravityChangesFromAgingPasses.length} gravity changes from AgingManager.`);
        if (allVisualAgingChangesFromAgingPasses.length > 0) {
            WorldManager.addProposedAgingChanges(allVisualAgingChangesFromAgingPasses);
        }
        if (allGravityChangesFromAgingPasses.length > 0) {
            WorldManager.addProposedGravityChanges(allGravityChangesFromAgingPasses);
        }
    } else {
        console.warn("[WaveMgr] No next wave data found for aging process. This might be the last wave transition before victory.");
    }
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
            if (gameState === 'RUNNING') { // gameState here refers to FlowManager.GameState.RUNNING
                preWaveTimer -= dt;
                if (preWaveTimer <= 0) {
                    startNextWave(); // Calls the helper
                }
            }
            break;
        case 'WAVE_COUNTDOWN':
            if (gameState === 'RUNNING') {
                mainWaveTimer -= dt;
                if (mainWaveTimer <= 0) {
                    mainWaveTimer = 0;
                    endWave(); // CORRECTED: Calls the helper directly
                    break; // Important to break after state change
                }
                // Spawning logic
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
                                        groupSpawnTimer = 0; // Allow immediate next spawn if delay is 0
                                    }
                                } else {
                                    // If spawn failed (e.g., max enemies), retry shortly
                                    groupSpawnTimer = 0.2; // Wait a bit before retrying
                                }
                            }
                        } else {
                            // Group finished, advance to next group/subwave
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
                triggerWarpCleanupAndCalculations();
                state = 'WARP_ANIMATING';
                console.log("[WaveMgr] Transitioned from BUILDPHASE to WARP_ANIMATING. Waiting for animations.");
                currentMaxTimer = Config.MYA_TRANSITION_ANIMATION_DURATION; // Max timer for UI bar during warp animation
            }
            break;
        case 'WARP_ANIMATING':
            // During WARP_ANIMATING, the epoch text is doing its countdown.
            // Check if world animations (gravity, aging) are complete.
            if (WorldManager.areGravityAnimationsComplete() && WorldManager.areAgingAnimationsComplete()) {
                console.log("[WaveMgr] All world animations complete during WARP_ANIMATING. Finalizing warp.");
                WorldManager.renderStaticWorldToGridCanvas(); // Redraw static world
                WorldManager.seedWaterUpdateQueue();        // Re-seed water after changes
                startNextWave(); // This will transition to the next WAVE_COUNTDOWN or VICTORY
            }
            // The timer for this state in UI is driven by Config.MYA_TRANSITION_ANIMATION_DURATION
            // or a fixed visual progress if MYA transition is not happening.
            break;
        case 'VICTORY':
        case 'GAME_OVER':
            // No time-based updates needed for these states here
            break;
        default:
            console.warn(`[WaveManager] Unknown state: ${state}`);
            break;
    }
}
export function setGameOver() {
    if (state !== 'GAME_OVER') {
        state = 'GAME_OVER';
        preWaveTimer = 0; mainWaveTimer = 0; buildPhaseTimer = 0;
        groupSpawnTimer = 0; groupStartDelayTimer = 0;
        currentMaxTimer = 0; // Or some fixed value if UI needs it
    }
}
export function setVictory() {
    if (state !== 'VICTORY') {
        state = 'VICTORY';
        preWaveTimer = 0; mainWaveTimer = 0; buildPhaseTimer = 0;
        groupSpawnTimer = 0; groupStartDelayTimer = 0;
        currentMaxTimer = 0; // Or some fixed value
    }
}
export function isGameOver() { // Simple getter
    return state === 'GAME_OVER';
}
export function getCurrentWaveNumber() {
    if (state === 'GAME_OVER' || state === 'VICTORY') {
        return Math.max(0, currentMainWaveIndex + 1); // Show the wave they reached or completed
    }
    if (state === 'BUILDPHASE' || state === 'WARP_ANIMATING') {
        return currentMainWaveIndex + 2; // Show the upcoming wave number
    }
    return (currentMainWaveIndex < 0) ? 1 : currentMainWaveIndex + 1; // Current or first wave
}
export function getWaveInfo() {
    let timer = 0;
    let currentWaveNumber = getCurrentWaveNumber(); // Use the helper
    let maxTimerToUse = currentMaxTimer; // Default to currentMaxTimer

    switch (state) {
        case 'PRE_WAVE':
            timer = preWaveTimer;
            maxTimerToUse = Config.WAVE_START_DELAY;
            break;
        case 'WAVE_COUNTDOWN':
            timer = mainWaveTimer;
            // maxTimerToUse is already set by startNextWave to waveData.duration
            break;
        case 'BUILDPHASE':
            timer = buildPhaseTimer;
            // maxTimerToUse is already set by endWave to intermissionDuration
            break;
        case 'WARP_ANIMATING':
            // Timer could reflect MYA animation progress or world animation progress
            // For simplicity, let's use remaining MYA transition time if available,
            // otherwise a generic progress for world animations.
            // Since MYA transition drives the UI, let maxTimer be its duration.
            timer = Math.max(0, Config.MYA_TRANSITION_ANIMATION_DURATION - (WorldManager.areGravityAnimationsComplete() && WorldManager.areAgingAnimationsComplete() ? Config.MYA_TRANSITION_ANIMATION_DURATION : 0)); // Rough idea
            maxTimerToUse = Config.MYA_TRANSITION_ANIMATION_DURATION; // UI bar driven by this
            // This might need refinement based on how UI.updateMyaEpochTransition handles its timer internally.
            // For UI.updateWaveTimer, it mostly cares about the ratio for the bar.
            break;
        case 'GAME_OVER':
        case 'VICTORY':
            timer = 0; maxTimerToUse = 1; // Represents a completed state, bar can be 0% or 100%
            break;
        default:
            timer = 0; maxTimerToUse = 1; // Default for unknown states
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