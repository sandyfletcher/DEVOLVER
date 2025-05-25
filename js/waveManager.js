// -----------------------------------------------------------------------------
// root/js/waveManager.js
// -----------------------------------------------------------------------------

import * as UI from './uiManager.js';
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
let isSunAnimationActive = false;
let sunAnimationTimer = 0;
let sunAnimationDuration = 0;

// --- Internal Helper Functions ---
function getCurrentWaveData() {
    if (currentMainWaveIndex < 0 || currentMainWaveIndex >= Config.WAVES.length) return null;
    return Config.WAVES[currentMainWaveIndex];
}
function getCurrentSubWaveData() {
    const waveData = getCurrentWaveData();
    if (!waveData || currentSubWaveIndex < 0 || currentSubWaveIndex >= waveData.subWaves.length) return null;
    return waveData.subWaves[currentSubWaveIndex];
}
function getCurrentGroupData() {
    const subWaveData = getCurrentSubWaveData();
    if (!subWaveData || currentGroupIndex < 0 || currentGroupIndex >= subWaveData.enemyGroups.length) return null;
    return subWaveData.enemyGroups[currentGroupIndex];
}
function advanceSpawnProgression() {
    const subWaveData = getCurrentSubWaveData();
    if (!subWaveData) {
        currentGroupIndex = -1; currentSubWaveIndex = -1; return false;
    }
    currentGroupIndex++;
    if (currentGroupIndex < subWaveData.enemyGroups.length) {
        const groupData = getCurrentGroupData();
        enemiesSpawnedThisGroup = 0; groupSpawnTimer = 0; groupStartDelayTimer = groupData.startDelay ?? 0;
        return true;
    } else {
        currentSubWaveIndex++; currentGroupIndex = 0;
        const nextSubWaveData = getCurrentSubWaveData();
        if (nextSubWaveData) {
            const groupData = nextSubWaveData.enemyGroups[0];
            enemiesSpawnedThisGroup = 0; groupSpawnTimer = 0; groupStartDelayTimer = groupData?.startDelay ?? 0;
            return true;
        } else {
            currentGroupIndex = -1; currentSubWaveIndex = -1; return false;
        }
    }
}
function startNextWave() {
    currentMainWaveIndex++;
    const waveData = getCurrentWaveData();
    if (!waveData) {
        state = 'VICTORY'; currentMaxTimer = 0; return false;
    }
    state = 'WAVE_COUNTDOWN';
    mainWaveTimer = waveData.duration; currentMaxTimer = waveData.duration;
    if (typeof waveStartCallback === 'function') waveStartCallback(waveData.mainWaveNumber);
    if (waveData.audioTrack) AudioManager.playGameMusic(waveData.audioTrack);
    else AudioManager.stopGameMusic();
    currentSubWaveIndex = 0; currentGroupIndex = 0; enemiesSpawnedThisGroup = 0; groupSpawnTimer = 0;
    const firstGroup = getCurrentGroupData();
    if (firstGroup) groupStartDelayTimer = firstGroup.startDelay ?? 0;
    else groupStartDelayTimer = waveData.duration + 1; // Ensure no spawns if no groups
    return true;
}
function endWave() {
    const waveData = getCurrentWaveData();
    if (!waveData) {
        state = 'GAME_OVER'; currentMaxTimer = 0;
        console.warn("[WaveManager] endWave called but no current wave data. Setting GAME_OVER.");
        return;
    }
    if (currentMainWaveIndex + 1 < Config.WAVES.length) {
        state = 'BUILDPHASE';
        if (portalRef) {
            portalRef.setSafetyRadius(portalRef.safetyRadius + Config.PORTAL_RADIUS_GROWTH_PER_WAVE);
            console.log(`[WaveMgr] Portal safety radius grown to ${portalRef.safetyRadius} at start of BUILDPHASE.`);
        } else {
            console.warn("[WaveMgr] portalRef is null, cannot grow safety radius at start of BUILDPHASE.");
        }
        buildPhaseTimer = waveData.intermissionDuration ?? (Config.AGING_DEFAULT_PASSES_PER_WAVE * 0.5 + 10.0);
        currentMaxTimer = buildPhaseTimer;
        AudioManager.stopGameMusic();
    } else {
        state = 'VICTORY'; currentMaxTimer = 0; AudioManager.stopGameMusic();
    }
    currentSubWaveIndex = 0; currentGroupIndex = 0; enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0; groupStartDelayTimer = 0;
}

function triggerWarpCleanupAndCalculations() {
    console.log("[WaveMgr] End of BUILDPHASE. Triggering entity cleanup, calculations, and animation queuing...");
    console.time("WarpPhaseCalculationsAndQueuing");
    if (!portalRef) {
        console.error("[WaveMgr] Warp process failed: Portal reference is null.");
        console.timeEnd("WarpPhaseCalculationsAndQueuing");
        state = 'PRE_WAVE'; // Fallback to avoid getting stuck
        return;
    }
    WorldManager.finalizeAllGravityAnimations();
    WorldManager.finalizeAllTransformAnimations();

    console.log("[WaveMgr] Snapshotting initial grid state...");
    console.time("SnapshotInitialGrid");
    const initialGridState = World.getGrid().map(row =>
        row.map(block => {
            if (typeof block === 'object' && block !== null) {
                return { ...block };
            }
            return block;
        })
    );
    console.timeEnd("SnapshotInitialGrid");
    
    const portalCenter = portalRef.getPosition();
    const safeRadius = portalRef.safetyRadius;
    ItemManager.clearItemsOutsideRadius(portalCenter.x, portalCenter.y, safeRadius);
    EnemyManager.clearEnemiesOutsideRadius(portalCenter.x, portalCenter.y, safeRadius);
    console.log("[WaveMgr] Entity cleanup using portal radius complete.");

    console.log("[WaveMgr] Applying gravity settlement (LOGICAL)...");
    console.time("LogicalGravitySettlement");
    let allGravityChangesForAnimation = WorldManager.applyGravitySettlement(portalRef);
    console.log(`[WaveMgr] Gravity settlement (LOGICAL) complete. ${allGravityChangesForAnimation.length} blocks potentially moved.`);
    console.timeEnd("LogicalGravitySettlement");

    const currentWaveData = getCurrentWaveData();
    const nextWaveIndexToPrepareFor = currentMainWaveIndex + 1;
    const nextWaveData = Config.WAVES[nextWaveIndexToPrepareFor];
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
            UI.showEpochText("Final Preparations...");
        }
    }
    
    console.log("[WaveMgr] Starting interleaved lighting and aging process (LOGICAL)...");
    console.time("InterleavedAgingAndLighting");
    if (nextWaveData && typeof nextWaveData === 'object') {
        const passes = nextWaveData.agingPasses ?? Config.AGING_DEFAULT_PASSES_PER_WAVE;
        for (let i = 0; i < passes; i++) {
            console.log(`[WaveMgr] Warp Intermission - Pass ${i + 1}/${passes}`);
            World.resetAllBlockLighting();
            const proposedLightingChangesThisPass = WorldManager.applyLightingPass(false);
            if (proposedLightingChangesThisPass.length > 0) {
                proposedLightingChangesThisPass.forEach(change => {
                    const block = World.getBlock(change.c, change.r);
                    if (block && typeof block === 'object' && typeof block.lightLevel === 'number') {
                        block.lightLevel = change.newLightLevel;
                    }
                });
            }
            const agingChangesInThisPass = AgingManager.applyAging(portalRef);
            if (agingChangesInThisPass.gravityChanges && Array.isArray(agingChangesInThisPass.gravityChanges)) {
                allGravityChangesForAnimation.push(...agingChangesInThisPass.gravityChanges);
            }
        }
        console.log(`[WaveMgr] Interleaved lighting & aging (LOGICAL) complete. Total passes: ${passes}.`);
    } else {
        console.warn("[WaveMgr] No next wave data found for aging/lighting process.");
    }
    console.timeEnd("InterleavedAgingAndLighting");
    
    console.log("[WaveMgr] Applying final lighting pass after warp phase aging (LOGICAL)...");
    console.time("FinalLightingPass");
    World.resetAllBlockLighting();
    const finalWarpLightingChanges = WorldManager.applyLightingPass(false, 1);
    if (finalWarpLightingChanges.length > 0) {
        finalWarpLightingChanges.forEach(change => {
            const block = World.getBlock(change.c, change.r);
            if (block && typeof block === 'object' && typeof block.lightLevel === 'number') {
                block.lightLevel = change.newLightLevel;
            }
        });
        console.log(`[WaveMgr] Final warp lighting pass lit ${finalWarpLightingChanges.length} additional blocks.`);
    }
    console.timeEnd("FinalLightingPass");
    
    console.log("[WaveMgr] Diffing grid and queuing transform animations...");
    WorldManager.diffGridAndQueueTransformAnimations(initialGridState, World.getGrid());

    if (allGravityChangesForAnimation.length > 0) {
        console.log(`[WaveMgr] Queuing ${allGravityChangesForAnimation.length} gravity changes for animation.`);
        WorldManager.addProposedGravityChanges(allGravityChangesForAnimation);
    }

    WorldManager.startDynamicWarpPacing(); // Activate dynamic pacing in WorldManager

    if (Config.SUN_ANIMATION_ENABLED) {
        isSunAnimationActive = true;
        // Align sun animation duration with the block animation target duration from WorldManager
        sunAnimationDuration = WorldManager.BLOCK_ANIM_TARGET_DURATION;
        sunAnimationTimer = sunAnimationDuration;
        console.log(`[WaveMgr] Started visual sun animation for ${sunAnimationDuration}s.`);
    }
    
    console.time("SeedWaterUpdateQueue");
    WorldManager.seedWaterUpdateQueue();
    console.timeEnd("SeedWaterUpdateQueue");

    console.timeEnd("WarpPhaseCalculationsAndQueuing");

    state = 'WARP_ANIMATING';
    currentMaxTimer = WorldManager.BLOCK_ANIM_TARGET_DURATION; // For UI timer consistency
    console.log(`[WaveMgr] Transitioned from BUILDPHASE to WARP_ANIMATING. Target animation duration: ${currentMaxTimer}s`);
}

// --- Exported Functions ---
export function init(callback = null, portalObject = null) {
    currentMainWaveIndex = -1; currentSubWaveIndex = 0; currentGroupIndex = 0;
    enemiesSpawnedThisGroup = 0; groupSpawnTimer = 0; groupStartDelayTimer = 0;
    state = 'PRE_WAVE'; preWaveTimer = Config.WAVE_START_DELAY; currentMaxTimer = Config.WAVE_START_DELAY;
    mainWaveTimer = 0; buildPhaseTimer = 0; waveStartCallback = callback; portalRef = portalObject;
    isSunAnimationActive = false; sunAnimationTimer = 0; sunAnimationDuration = 0;
    console.log(`[WaveManager] Initialized. State: ${state}, First Wave In: ${preWaveTimer}s.`);
}
export function reset(callback = null, portalObject = null) {
    init(callback, portalObject);
    console.log("[WaveManager] Resetting.");
}
export function update(dt, gameState) {
    if (dt <= 0) return;
    if (isSunAnimationActive && state === 'WARP_ANIMATING') {
        sunAnimationTimer -= dt;
        if (sunAnimationTimer <= 0) {
            isSunAnimationActive = false; sunAnimationTimer = 0;
            console.log("[WaveMgr] Visual sun animation finished.");
        }
    }
    switch (state) {
        case 'PRE_WAVE':
            if (gameState === 'RUNNING') { // Ensure game is actually running
                preWaveTimer -= dt;
                if (preWaveTimer <= 0) startNextWave();
            }
            break;
        case 'WAVE_COUNTDOWN':
            if (gameState === 'RUNNING') { // Ensure game is actually running
                mainWaveTimer -= dt;
                if (mainWaveTimer <= 0) { mainWaveTimer = 0; endWave(); break; }
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
                                    if (groupData.delayBetween <= 0 && enemiesSpawnedThisGroup < groupData.count) groupSpawnTimer = 0;
                                } else { groupSpawnTimer = 0.2; } // Retry delay if spawn failed
                            }
                        } else { advanceSpawnProgression(); }
                    }
                }
            }
            break;
        case 'BUILDPHASE':
            buildPhaseTimer -= dt;
            if (buildPhaseTimer <= 0) {
                buildPhaseTimer = 0;
                triggerWarpCleanupAndCalculations();
            }
            break;
        case 'WARP_ANIMATING':
            const gravityComplete = WorldManager.areGravityAnimationsComplete();
            const transformComplete = WorldManager.areTransformAnimationsComplete();
            const sunComplete = !isSunAnimationActive;

            if (gravityComplete && transformComplete && sunComplete) {
                console.log("[WaveMgr] All animations complete. Transitioning to next wave.");
                WorldManager.endDynamicWarpPacing(); // Deactivate dynamic pacing
                WorldManager.renderStaticWorldToGridCanvas();
                WorldManager.seedWaterUpdateQueue();
                startNextWave();
            }
            break;
        case 'VICTORY': case 'GAME_OVER': break;
        default: console.warn(`[WaveManager] Unknown state: ${state}`); break;
    }
}
export function setGameOver() {
    if (state !== 'GAME_OVER') {
        state = 'GAME_OVER';
        preWaveTimer = 0; mainWaveTimer = 0; buildPhaseTimer = 0;
        groupSpawnTimer = 0; groupStartDelayTimer = 0; currentMaxTimer = 0;
        isSunAnimationActive = false; sunAnimationTimer = 0;
        WorldManager.endDynamicWarpPacing(); // Ensure pacing is off if game ends abruptly
    }
}
export function setVictory() {
    if (state !== 'VICTORY') {
        state = 'VICTORY';
        preWaveTimer = 0; mainWaveTimer = 0; buildPhaseTimer = 0;
        groupSpawnTimer = 0; groupStartDelayTimer = 0; currentMaxTimer = 0;
        isSunAnimationActive = false; sunAnimationTimer = 0;
        WorldManager.endDynamicWarpPacing(); // Ensure pacing is off
    }
}
export function isGameOver() { return state === 'GAME_OVER'; }
export function getCurrentWaveNumber() {
    if (state === 'GAME_OVER' || state === 'VICTORY') return Math.max(0, currentMainWaveIndex + 1);
    if (state === 'BUILDPHASE' || state === 'WARP_ANIMATING') return currentMainWaveIndex + 2; // Preparing for next wave
    return (currentMainWaveIndex < 0) ? 1 : currentMainWaveIndex + 1;
}
export function getWaveInfo() {
    let timer = 0;
    let currentWaveNumber = getCurrentWaveNumber();
    let maxTimerToUse = currentMaxTimer;
    switch (state) {
        case 'PRE_WAVE': timer = preWaveTimer; maxTimerToUse = Config.WAVE_START_DELAY; break;
        case 'WAVE_COUNTDOWN': timer = mainWaveTimer; break; // maxTimerToUse is already currentMaxTimer
        case 'BUILDPHASE': timer = buildPhaseTimer; break; // maxTimerToUse is already currentMaxTimer
        case 'WARP_ANIMATING':
             // For WARP_ANIMATING, timer now reflects the overall target duration
            timer = currentMaxTimer - (WorldManager.BLOCK_ANIM_TARGET_DURATION - Math.max(sunAnimationTimer, UI.getMyaTransitionInfo().timer, 0.01)); // A rough estimate of combined progress
            timer = Math.max(0, timer); // Ensure timer doesn't go negative
            // maxTimerToUse is already set to WorldManager.BLOCK_ANIM_TARGET_DURATION
            break;
        case 'GAME_OVER': case 'VICTORY': timer = 0; maxTimerToUse = 1; break;
        default: timer = 0; maxTimerToUse = 1; break;
    }
    return {
        state: state, mainWaveNumber: currentWaveNumber, timer: timer, maxTimer: maxTimerToUse,
        isGameOver: state === 'GAME_OVER', allWavesCleared: state === 'VICTORY'
    };
}
export function getAnimatedSunPosition() {
    if (!isSunAnimationActive || sunAnimationDuration <= 0) return null;
    const progress = Math.max(0, Math.min(1, 1 - (sunAnimationTimer / sunAnimationDuration)));
    const startXOffset = Config.SUN_ANIMATION_START_X_OFFSET_BLOCKS * Config.BLOCK_WIDTH;
    const endXOffset = Config.SUN_ANIMATION_END_X_OFFSET_BLOCKS * Config.BLOCK_WIDTH;
    const sunVisualStartX = Config.CANVAS_WIDTH + startXOffset;
    const sunVisualEndX = -endXOffset;
    const currentAnimatedSunX = sunVisualStartX + (sunVisualEndX - sunVisualStartX) * progress;
    const animatedSunY = (Config.SUN_MOVEMENT_Y_ROW_OFFSET * Config.BLOCK_HEIGHT) + (Config.BLOCK_HEIGHT / 2);
    return { x: currentAnimatedSunX, y: animatedSunY };
}
function formatMyaForPauseMenu(myaValue) {
    if (typeof myaValue !== 'number' || isNaN(myaValue)) return "Epoch Unknown";
    if (myaValue === 0) return "MODERN TIMES";
    return `${Math.round(myaValue)} MILLION YEARS AGO`;
}
export function getCurrentEpochInfo() {
    let waveData;
    if (state === 'PRE_WAVE' || (currentMainWaveIndex === -1 && state !== 'WARP_ANIMATING' && state !== 'BUILDPHASE')) return null; // No epoch before first wave starts transitioning
    if (state === 'BUILDPHASE' || state === 'WARP_ANIMATING') { // Show info for the *next* wave
        const nextWaveIdx = currentMainWaveIndex + 1;
        if (nextWaveIdx < Config.WAVES.length) waveData = Config.WAVES[nextWaveIdx];
        else return "Final Preparations"; // All waves done, about to hit victory
    } else { // Show info for the *current* wave
        waveData = getCurrentWaveData();
    }
    if (!waveData) return null;
    if (typeof waveData.mya === 'number') return formatMyaForPauseMenu(waveData.mya);
    else if (waveData.customEpochText) return waveData.customEpochText;
    return `Wave ${waveData.mainWaveNumber}`; // Fallback
}