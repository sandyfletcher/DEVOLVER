// root/js/waveManager.js

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

// --- Sun Animation State ---
let isSunAnimationActive = false;
let sunAnimationTimer = 0;
let sunAnimationDuration = 0;


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

    // The UI.showEpochText call that was here for the *second* display is REMOVED.
    // The animated/warp-time display is handled by UI.startMyaEpochTransition in triggerWarpCleanupAndCalculations.

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
        console.warn("[WaveManager] endWave called but no current wave data. Setting GAME_OVER.");
        return;
    }
    if (currentMainWaveIndex + 1 < Config.WAVES.length) {
        state = 'BUILDPHASE';
        buildPhaseTimer = waveData.intermissionDuration ?? (Config.AGING_DEFAULT_PASSES_PER_WAVE * 0.5 + 10.0);
        currentMaxTimer = buildPhaseTimer;
        AudioManager.stopGameMusic();
    } else {
        state = 'VICTORY';
        currentMaxTimer = 0;
        AudioManager.stopGameMusic();
    }
    currentSubWaveIndex = 0;
    currentGroupIndex = 0;
    enemiesSpawnedThisGroup = 0;
    groupSpawnTimer = 0;
    groupStartDelayTimer = 0;
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

    // 2. Logical Gravity Settlement (Done once before aging/lighting loop)
    console.log("[WaveMgr] Applying gravity settlement (LOGICAL)...");
    let gravityAnimationChanges = WorldManager.applyGravitySettlement(portalRef);
    console.log(`[WaveMgr] Gravity settlement (LOGICAL) complete. ${gravityAnimationChanges.length} blocks moved.`);
    if (gravityAnimationChanges.length > 0) {
        WorldManager.addProposedGravityChanges(gravityAnimationChanges);
    }

    // MYA Transition (Start this before the loop as it's a continuous visual effect)
    const currentWaveData = getCurrentWaveData();
    const nextWaveIndexToPrepareFor = currentMainWaveIndex + 1;
    const nextWaveData = Config.WAVES[nextWaveIndexToPrepareFor];
    const currentMya = currentWaveData ? currentWaveData.mya : undefined;
    const nextMya = nextWaveData ? nextWaveData.mya : undefined;

    if (typeof currentMya === 'number' && typeof nextMya === 'number') {
        UI.startMyaEpochTransition(currentMya, nextMya, Config.MYA_TRANSITION_ANIMATION_DURATION);
    } else {
        // Fallback epoch text display
        if (nextWaveData) {
            if (typeof nextWaveData.mya === 'number') UI.showEpochText(nextWaveData.mya);
            else if (nextWaveData.customEpochText) UI.showEpochText(nextWaveData.customEpochText);
            else UI.showEpochText(`Preparing Wave ${nextWaveData.mainWaveNumber || 'Next'}`);
        } else {
            UI.showEpochText("Final Preparations...");
        }
    }

    // 3. Interleaved Lighting and Aging Process
    console.log("[WaveMgr] Starting interleaved lighting and aging process (LOGICAL)...");
    let allVisualAgingChangesFromAgingPasses = [];
    let allGravityChangesFromAgingPasses = [];
    let allLightingChangesFromLoop = []; // To collect lighting changes for animation queueing

    if (nextWaveData && typeof nextWaveData === 'object') {
        const passes = nextWaveData.agingPasses ?? Config.AGING_DEFAULT_PASSES_PER_WAVE;
        for (let i = 0; i < passes; i++) {
            console.log(`[WaveMgr] Warp Intermission - Pass ${i + 1}/${passes}`);

            // A. Reset lighting state before calculating for this pass
            World.resetAllBlockLighting(); // Reset all lighting
            
            // B. Calculate and Apply Lighting for this pass
            console.log(`[WaveMgr] Pass ${i + 1}: Calculating lighting...`);
            const proposedLightingChangesThisPass = WorldManager.applyLightingPass(false); // false to skip debug drawing
            
            if (proposedLightingChangesThisPass.length > 0) {
                console.log(`[WaveMgr] Pass ${i + 1}: Applying ${proposedLightingChangesThisPass.length} lighting states directly.`);
                proposedLightingChangesThisPass.forEach(change => {
                    const block = World.getBlock(change.c, change.r);
                    if (block && typeof block === 'object') {
                        block.isLit = change.newLitState; // Directly update world data
                    }
                });
                allLightingChangesFromLoop.push(...proposedLightingChangesThisPass); // Collect for animation queue
            }

            // C. Apply Aging using the now updated lighting state
            console.log(`[WaveMgr] Pass ${i + 1}: Applying aging...`);
            const agingChangesInThisPass = AgingManager.applyAging(portalRef);
            if (agingChangesInThisPass.visualChanges && Array.isArray(agingChangesInThisPass.visualChanges)) {
                allVisualAgingChangesFromAgingPasses.push(...agingChangesInThisPass.visualChanges);
            }
            if (agingChangesInThisPass.gravityChanges && Array.isArray(agingChangesInThisPass.gravityChanges)) {
                allGravityChangesFromAgingPasses.push(...agingChangesInThisPass.gravityChanges);
            }
        }
        
        // Queue all collected animations after the loop
        if (allLightingChangesFromLoop.length > 0) {
            WorldManager.addProposedLightingChanges(allLightingChangesFromLoop);
        }
        if (allVisualAgingChangesFromAgingPasses.length > 0) {
            WorldManager.addProposedAgingChanges(allVisualAgingChangesFromAgingPasses);
        }
        if (allGravityChangesFromAgingPasses.length > 0) {
            WorldManager.addProposedGravityChanges(allGravityChangesFromAgingPasses);
        }
        
        console.log(`[WaveMgr] Interleaved lighting & aging (LOGICAL) complete. Total passes: ${passes}.`);
        console.log(`   - Total Visual Aging Changes: ${allVisualAgingChangesFromAgingPasses.length}`);
        console.log(`   - Total Gravity Changes from Aging: ${allGravityChangesFromAgingPasses.length}`);
        console.log(`   - Total Lighting Animation Changes Queued: ${allLightingChangesFromLoop.length}`);

    } else {
        console.warn("[WaveMgr] No next wave data found for aging/lighting process. This might be the last wave transition before victory.");
        // Even if no next wave for aging, we might still want a final lighting pass if it wasn't done yet.
        // However, the current structure ties passes to nextWaveData.
        // If nextWaveData is null (e.g., final wave completed), we might need one last lighting refresh *if* the previous logic
        // didn't already do it. But for now, this is fine. The previous one-time lighting pass will have run.
    }

    // --- START Sun Animation ---
    if (Config.SUN_ANIMATION_ENABLED) {
        isSunAnimationActive = true;
        sunAnimationDuration = Config.MYA_TRANSITION_ANIMATION_DURATION > 0 ? Config.MYA_TRANSITION_ANIMATION_DURATION : Config.FIXED_SUN_ANIMATION_DURATION;
        sunAnimationTimer = sunAnimationDuration;
        console.log(`[WaveMgr] Started visual sun animation for ${sunAnimationDuration}s.`);
    }
    // --- END Sun Animation ---
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
    isSunAnimationActive = false; // Reset sun animation state
    sunAnimationTimer = 0;
    sunAnimationDuration = 0;
    console.log(`[WaveManager] Initialized. State: ${state}, First Wave In: ${preWaveTimer}s.`);
}
export function reset(callback = null, portalObject = null) {
    init(callback, portalObject);
    console.log("[WaveManager] Resetting.");
}
export function update(dt, gameState) {
    if (dt <= 0) return;

    // --- Sun Animation Update (during WARP_ANIMATING) ---
    if (isSunAnimationActive && state === 'WARP_ANIMATING') {
        sunAnimationTimer -= dt;
        if (sunAnimationTimer <= 0) {
            isSunAnimationActive = false;
            sunAnimationTimer = 0;
            console.log("[WaveMgr] Visual sun animation finished.");
        }
    }
    // --- End Sun Animation Update ---

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
                triggerWarpCleanupAndCalculations(); 
                state = 'WARP_ANIMATING';
                console.log("[WaveMgr] Transitioned from BUILDPHASE to WARP_ANIMATING. Waiting for animations.");
                currentMaxTimer = sunAnimationDuration; // Use sun animation duration for the timer display
            }
            break;
        case 'WARP_ANIMATING':
            if (WorldManager.areGravityAnimationsComplete() &&
                WorldManager.areAgingAnimationsComplete() &&
                WorldManager.areLightingAnimationsComplete() &&
                !isSunAnimationActive) { // Also wait for sun animation to naturally complete its timer                
                console.log("[WaveMgr] All world block animations complete (Gravity, Aging, Lighting Flashes) during WARP_ANIMATING.");
                WorldManager.renderStaticWorldToGridCanvas();
                WorldManager.seedWaterUpdateQueue();
                startNextWave();
            }
            break;
        case 'VICTORY':
        case 'GAME_OVER':
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
        currentMaxTimer = 0;
        isSunAnimationActive = false; sunAnimationTimer = 0; // Stop sun animation
    }
}
export function setVictory() {
    if (state !== 'VICTORY') {
        state = 'VICTORY';
        preWaveTimer = 0; mainWaveTimer = 0; buildPhaseTimer = 0;
        groupSpawnTimer = 0; groupStartDelayTimer = 0;
        currentMaxTimer = 0;
        isSunAnimationActive = false; sunAnimationTimer = 0; // Stop sun animation
    }
}
export function isGameOver() {
    return state === 'GAME_OVER';
}
export function getCurrentWaveNumber() {
    if (state === 'GAME_OVER' || state === 'VICTORY') {
        return Math.max(0, currentMainWaveIndex + 1);
    }
    if (state === 'BUILDPHASE' || state === 'WARP_ANIMATING') {
        return currentMainWaveIndex + 2;
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
            break;
        case 'BUILDPHASE':
            timer = buildPhaseTimer;
            break;
        case 'WARP_ANIMATING':
            if (isSunAnimationActive) { // Prefer sun animation timer if active
                timer = sunAnimationTimer;
                maxTimerToUse = sunAnimationDuration;
            } else if (Config.MYA_TRANSITION_ANIMATION_DURATION > 0) {
                const uiMyaInfo = (typeof UI.getMyaTransitionInfo === 'function') ? UI.getMyaTransitionInfo() : {timer: Config.MYA_TRANSITION_ANIMATION_DURATION, duration: Config.MYA_TRANSITION_ANIMATION_DURATION, isActive: true};
                timer = uiMyaInfo.timer; 
                maxTimerToUse = uiMyaInfo.duration;
            } else {
                if (WorldManager.areGravityAnimationsComplete() &&
                    WorldManager.areAgingAnimationsComplete() &&
                    WorldManager.areLightingAnimationsComplete()) {
                    timer = 0;
                } else {
                    timer = 1; 
                }
                maxTimerToUse = 1;
            }
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

export function getAnimatedSunPosition() {
    if (!isSunAnimationActive || sunAnimationDuration <= 0) {
        return null;
    }

    const progress = Math.max(0, Math.min(1, 1 - (sunAnimationTimer / sunAnimationDuration)));
    
    const startXOffset = Config.SUN_ANIMATION_START_X_OFFSET_BLOCKS * Config.BLOCK_WIDTH;
    const endXOffset = Config.SUN_ANIMATION_END_X_OFFSET_BLOCKS * Config.BLOCK_WIDTH;

    const sunVisualStartX = Config.CANVAS_WIDTH + startXOffset;
    const sunVisualEndX = -endXOffset; // Negative because it goes off-screen left
    
    const currentAnimatedSunX = sunVisualStartX + (sunVisualEndX - sunVisualStartX) * progress;
    const animatedSunY = (Config.SUN_MOVEMENT_Y_ROW_OFFSET * Config.BLOCK_HEIGHT) + (Config.BLOCK_HEIGHT / 2);
    
    return { x: currentAnimatedSunX, y: animatedSunY };
}

// Helper to format MYA for pause menu - kept brief
function formatMyaForPauseMenu(myaValue) {
    if (typeof myaValue !== 'number' || isNaN(myaValue)) return "Epoch Unknown";
    if (myaValue === 0) return "Present Day";
    return `${Math.round(myaValue)} MYA`;
}

export function getCurrentEpochInfo() {
    let waveData;
    if (state === 'PRE_WAVE' || (currentMainWaveIndex === -1 && state !== 'WARP_ANIMATING' && state !== 'BUILDPHASE')) {
        return null;
    }

    if (state === 'BUILDPHASE' || state === 'WARP_ANIMATING') {
        const nextWaveIdx = currentMainWaveIndex + 1;
        if (nextWaveIdx < Config.WAVES.length) {
            waveData = Config.WAVES[nextWaveIdx];
        } else {
            return "Final Preparations"; // Or null if victory screen handles it
        }
    } else {
        waveData = getCurrentWaveData();
    }

    if (!waveData) return null;

    if (typeof waveData.mya === 'number') {
        return formatMyaForPauseMenu(waveData.mya);
    } else if (waveData.customEpochText) {
        return waveData.customEpochText;
    }
    // Fallback if no MYA or custom text, but wave exists
    return `Wave ${waveData.mainWaveNumber}`;
}