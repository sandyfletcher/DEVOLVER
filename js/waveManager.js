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
    else groupStartDelayTimer = waveData.duration + 1;
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
    if (!portalRef) {
        console.error("[WaveMgr] Warp process failed: Portal reference is null.");
        return;
    }
    // 0. Clear any existing visual animations from previous states (IMPORTANT)
    WorldManager.finalizeAllGravityAnimations(); // Clear out any stragglers
    WorldManager.finalizeAllTransformAnimations(); // Clear out any stragglers
    // 1. Snapshot initial grid state
    console.log("[WaveMgr] Snapshotting initial grid state...");
    const initialGridState = World.getGrid().map(row =>
        row.map(block => {
            if (typeof block === 'object' && block !== null) {
                return { ...block }; // Shallow copy of block object
            }
            return block; // Keep BLOCK_AIR (0) as is
        })
    );
    // 2. Entity Clearing & Portal Radius
    portalRef.setSafetyRadius(portalRef.safetyRadius + Config.PORTAL_RADIUS_GROWTH_PER_WAVE);
    const portalCenter = portalRef.getPosition();
    const safeRadius = portalRef.safetyRadius;
    ItemManager.clearItemsOutsideRadius(portalCenter.x, portalCenter.y, safeRadius);
    EnemyManager.clearEnemiesOutsideRadius(portalCenter.x, portalCenter.y, safeRadius);
    console.log("[WaveMgr] Entity cleanup and portal radius update complete.");
    // 3. Logical Gravity Settlement (Done once before aging/lighting loop)
    console.log("[WaveMgr] Applying gravity settlement (LOGICAL)...");
    let allGravityChangesForAnimation = WorldManager.applyGravitySettlement(portalRef); // Returns changes for animation
    console.log(`[WaveMgr] Gravity settlement (LOGICAL) complete. ${allGravityChangesForAnimation.length} blocks potentially moved.`);
    // MYA Transition (UI)
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
    // 4. Interleaved Lighting and Aging Process (LOGICAL UPDATES ONLY)
    console.log("[WaveMgr] Starting interleaved lighting and aging process (LOGICAL)...");
    if (nextWaveData && typeof nextWaveData === 'object') {
        const passes = nextWaveData.agingPasses ?? Config.AGING_DEFAULT_PASSES_PER_WAVE;
        for (let i = 0; i < passes; i++) {
            console.log(`[WaveMgr] Warp Intermission - Pass ${i + 1}/${passes}`);
            World.resetAllBlockLighting(); // Reset all lighting (LOGICAL)
            const proposedLightingChangesThisPass = WorldManager.applyLightingPass(false); // LOGICAL
            if (proposedLightingChangesThisPass.length > 0) {
                proposedLightingChangesThisPass.forEach(change => {
                    const block = World.getBlock(change.c, change.r);
                    if (block && typeof block === 'object') {
                        block.isLit = change.newLitState; // Directly update world data
                    }
                });
            }
            const agingChangesInThisPass = AgingManager.applyAging(portalRef); // LOGICAL (calls World.setBlock internally)
            if (agingChangesInThisPass.gravityChanges && Array.isArray(agingChangesInThisPass.gravityChanges)) {
                allGravityChangesForAnimation.push(...agingChangesInThisPass.gravityChanges); // Collect gravity changes from aging
            }
        }
        console.log(`[WaveMgr] Interleaved lighting & aging (LOGICAL) complete. Total passes: ${passes}.`);
    } else {
        console.warn("[WaveMgr] No next wave data found for aging/lighting process. This might be the last wave transition before victory.");
    }
    // 5. Final Lighting Pass (LOGICAL)
    console.log("[WaveMgr] Applying final lighting pass after warp phase aging (LOGICAL)...");
    World.resetAllBlockLighting();
    const finalWarpLightingChanges = WorldManager.applyLightingPass(false, 1);
    if (finalWarpLightingChanges.length > 0) {
        finalWarpLightingChanges.forEach(change => {
            const block = World.getBlock(change.c, change.r);
            if (block && typeof block === 'object') {
                block.isLit = change.newLitState; // Apply directly to world data
            }
        });
        console.log(`[WaveMgr] Final warp lighting pass lit ${finalWarpLightingChanges.length} additional blocks.`);
    }
    // 6. Diff and Queue Transform Animations
    console.log("[WaveMgr] Diffing grid and queuing transform animations...");
    WorldManager.diffGridAndQueueTransformAnimations(initialGridState, World.getGrid());
    // 7. Queue All Collected Gravity Animations
    if (allGravityChangesForAnimation.length > 0) {
        console.log(`[WaveMgr] Queuing ${allGravityChangesForAnimation.length} gravity changes for animation.`);
        WorldManager.addProposedGravityChanges(allGravityChangesForAnimation);
    }
    // 8. Sun Animation (Visual)
    if (Config.SUN_ANIMATION_ENABLED) {
        isSunAnimationActive = true;
        sunAnimationDuration = Config.MYA_TRANSITION_ANIMATION_DURATION > 0 ? Config.MYA_TRANSITION_ANIMATION_DURATION : Config.FIXED_SUN_ANIMATION_DURATION;
        sunAnimationTimer = sunAnimationDuration;
        console.log(`[WaveMgr] Started visual sun animation for ${sunAnimationDuration}s.`);
    }
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
            if (gameState === 'RUNNING') {
                preWaveTimer -= dt;
                if (preWaveTimer <= 0) startNextWave();
            }
            break;
        case 'WAVE_COUNTDOWN':
            if (gameState === 'RUNNING') {
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
                                } else { groupSpawnTimer = 0.2; }
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
                state = 'WARP_ANIMATING';
                console.log("[WaveMgr] Transitioned from BUILDPHASE to WARP_ANIMATING. Waiting for animations.");
                currentMaxTimer = sunAnimationDuration;
            }
            break;
        case 'WARP_ANIMATING':
            if (WorldManager.areGravityAnimationsComplete() &&
                WorldManager.areTransformAnimationsComplete() && // CHANGED HERE
                !isSunAnimationActive) {
                console.log("[WaveMgr] All world block animations complete (Gravity, Transform) during WARP_ANIMATING.");
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
    }
}
export function setVictory() {
    if (state !== 'VICTORY') {
        state = 'VICTORY';
        preWaveTimer = 0; mainWaveTimer = 0; buildPhaseTimer = 0;
        groupSpawnTimer = 0; groupStartDelayTimer = 0; currentMaxTimer = 0;
        isSunAnimationActive = false; sunAnimationTimer = 0;
    }
}
export function isGameOver() { return state === 'GAME_OVER'; }
export function getCurrentWaveNumber() {
    if (state === 'GAME_OVER' || state === 'VICTORY') return Math.max(0, currentMainWaveIndex + 1);
    if (state === 'BUILDPHASE' || state === 'WARP_ANIMATING') return currentMainWaveIndex + 2;
    return (currentMainWaveIndex < 0) ? 1 : currentMainWaveIndex + 1;
}
export function getWaveInfo() {
    let timer = 0;
    let currentWaveNumber = getCurrentWaveNumber();
    let maxTimerToUse = currentMaxTimer;
    switch (state) {
        case 'PRE_WAVE': timer = preWaveTimer; maxTimerToUse = Config.WAVE_START_DELAY; break;
        case 'WAVE_COUNTDOWN': timer = mainWaveTimer; break;
        case 'BUILDPHASE': timer = buildPhaseTimer; break;
        case 'WARP_ANIMATING':
            if (isSunAnimationActive) {
                timer = sunAnimationTimer; maxTimerToUse = sunAnimationDuration;
            } else if (Config.MYA_TRANSITION_ANIMATION_DURATION > 0) {
                const uiMyaInfo = (typeof UI.getMyaTransitionInfo === 'function') ? UI.getMyaTransitionInfo() : {timer: Config.MYA_TRANSITION_ANIMATION_DURATION, duration: Config.MYA_TRANSITION_ANIMATION_DURATION, isActive: true};
                timer = uiMyaInfo.timer; maxTimerToUse = uiMyaInfo.duration;
            } else {
                if (WorldManager.areGravityAnimationsComplete() && WorldManager.areTransformAnimationsComplete()) timer = 0;
                else timer = 1;
                maxTimerToUse = 1;
            }
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
    if (myaValue === 0) return "Present Day";
    return `${Math.round(myaValue)} million years ago`;
}
export function getCurrentEpochInfo() {
    let waveData;
    if (state === 'PRE_WAVE' || (currentMainWaveIndex === -1 && state !== 'WARP_ANIMATING' && state !== 'BUILDPHASE')) return null;
    if (state === 'BUILDPHASE' || state === 'WARP_ANIMATING') {
        const nextWaveIdx = currentMainWaveIndex + 1;
        if (nextWaveIdx < Config.WAVES.length) waveData = Config.WAVES[nextWaveIdx];
        else return "Final Preparations";
    } else {
        waveData = getCurrentWaveData();
    }
    if (!waveData) return null;
    if (typeof waveData.mya === 'number') return formatMyaForPauseMenu(waveData.mya);
    else if (waveData.customEpochText) return waveData.customEpochText;
    return `Wave ${waveData.mainWaveNumber}`;
}