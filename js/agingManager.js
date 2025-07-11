// -----------------------------------------------------------------------------
// root/js/agingManager.js - Handles World Aging Effects (erosion, growth, etc.)
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as World from './utils/world.js';
import * as GridCollision from './utils/gridCollision.js';
import { createBlock } from './utils/block.js';

let allGravityChangesFromAgingThisPass = [];

// check 8 immediate neighbors for homogeneity
function areNeighborsHomogeneous(c, r, originalType) {
    const neighbors = [
        { dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 },
        { dc: -1, dr: 0 },                    { dc: 1, dr: 0 },
        { dc: -1, dr: 1 },  { dc: 0, dr: 1 },  { dc: 1, dr: 1 },
    ];
    for (const offset of neighbors) {
        if (World.getBlockType(c + offset.dc, r + offset.dr) !== originalType) {
            return false;
        }
    }
    return true;
}
// calculate influence score from surrounding blocks
function calculateInfluenceScore(c, r, transformationRule) {
    let totalInfluence = 0;
    const influences = transformationRule.influences;
    if (!influences) return 0;
    const ringWeights = transformationRule.ringWeights || Config.AGING_DEFAULT_RING_WEIGHTS;
    // check rings 3, 5, 7
    for (let ringSize = 3; ringSize <= 7; ringSize += 2) {
        const ringWeight = ringWeights[ringSize] || 0;
        if (ringWeight === 0) continue;
        const radius = Math.floor(ringSize / 2);
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                if (dr === 0 && dc === 0) continue; // skip center block
                // skip inner rings already processed
                if (Math.abs(dr) < radius && Math.abs(dc) < radius) continue;
                const neighborType = World.getBlockType(c + dc, r + dr);
                if (neighborType !== null && influences[neighborType]) {
                    totalInfluence += influences[neighborType] * ringWeight;
                }
            }
        }
    }
    return totalInfluence;
}
// check special tree formation rule
function checkForTreeFormation(c, r, changedCellsArray) {
    const neighborTypes = {};
    const neighborOffsets = [
        { key: 'above', dc: 0, dr: -1 }, { key: 'below', dc: 0, dr: 1 },
        { key: 'left', dc: -1, dr: 0 }, { key: 'right', dc: 1, dr: 0 },
        { key: 'aboveLeft', dc: -1, dr: -1 }, { key: 'aboveRight', dc: 1, dr: -1 },
        { key: 'belowLeft', dc: -1, dr: 1 }, { key: 'belowRight', dc: 1, dr: 1 }
    ];
    for (const offset of neighborOffsets) {
        neighborTypes[offset.key] = World.getBlockType(c + offset.dc, r + offset.dr);
    }
    const allEightNeighborsAreVeg = Object.values(neighborTypes).every(type => type === Config.BLOCK_VEGETATION);
    if (allEightNeighborsAreVeg) {
        if (GridCollision.isSolid(c, r + 2) && Math.random() < (Config.AGING_PROB_VEGETATION_TO_WOOD_SURROUNDED ?? 0.02)) {
            // further checks for spacing could be added here
            const pattern = [
                { dr: -1, dc: -1, type: Config.BLOCK_VEGETATION }, { dr: -1, dc: 0, type: Config.BLOCK_VEGETATION }, { dr: -1, dc: 1, type: Config.BLOCK_VEGETATION },
                { dr: 0, dc: -1, type: Config.BLOCK_AIR }, { dr: 0, dc: 0, type: Config.BLOCK_WOOD }, { dr: 0, dc: 1, type: Config.BLOCK_AIR },
                { dr: 1, dc: -1, type: Config.BLOCK_AIR }, { dr: 1, dc: 0, type: Config.BLOCK_WOOD }, { dr: 1, dc: 1, type: Config.BLOCK_AIR },
            ];
            for (const cell of pattern) {
                const targetC = c + cell.dc;
                const targetR = r + cell.dr;
                if (targetR >= 0 && targetR < Config.GRID_ROWS && targetC >= 0 && targetC < Config.GRID_COLS) {
                    const oldBlockAtTargetType = World.getBlockType(targetC, targetR);
                    const success = World.setBlock(targetC, targetR, cell.type, false);
                    if (success && oldBlockAtTargetType !== cell.type) {
                        changedCellsArray.push({
                            c: targetC, r: targetR,
                            oldBlockType: oldBlockAtTargetType,
                            newBlockType: cell.type,
                            finalBlockData: World.getBlock(targetC, targetR)
                        });
                    }
                }
            }
            return true; // tree
        }
    }
    return false; // no tree
}
export function applyAging(portalRef) {
    const grid = World.getGrid();
    if (!grid || grid.length === 0 || grid[0].length === 0) {
        return { visualChanges: [], gravityChanges: [] };
    }
    let changedCellsAndTypes = [];
    allGravityChangesFromAgingThisPass = [];
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (portalRef) {
                const blockCenterX = c * Config.BLOCK_WIDTH + Config.BLOCK_WIDTH / 2;
                const blockCenterY = r * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2;
                const portalCenter = portalRef.getPosition();
                const dx = blockCenterX - portalCenter.x;
                const dy = blockCenterY - portalCenter.y;
                if (dx * dx + dy * dy < portalRef.safetyRadius * portalRef.safetyRadius) {
                    continue;
                }
            }
            const blockBeforeChange = World.getBlock(c, r);
            if (blockBeforeChange === null) continue;
            const originalType = (typeof blockBeforeChange === 'object') ? blockBeforeChange.type : blockBeforeChange;
            if (originalType === Config.BLOCK_AIR || originalType === Config.BLOCK_WATER) continue;
            let newType = originalType; // 1: Influence-Based Material Weathering ---
            let changeOccurred = false;
            if (areNeighborsHomogeneous(c, r, originalType)) {
                // early exit if no influencers
            } else {
                // "border block", proceed with deeper analysis
                const blockRules = Config.AGING_RULES[originalType];
                if (blockRules) {
                    for (const targetTypeStr in blockRules) {
                        const targetType = parseInt(targetTypeStr, 10);
                        const rule = blockRules[targetType];
                        const blockIsLit = (blockBeforeChange.lightLevel || 0) >= Config.MIN_LIGHT_THRESHOLD;
                        if (originalType === Config.BLOCK_DIRT && targetType === Config.BLOCK_VEGETATION && !blockIsLit) {
                            continue; // Don't process vegetation growth rule for unlit dirt
                        }
                        if (originalType === Config.BLOCK_VEGETATION && targetType === Config.BLOCK_AIR && blockIsLit) {
                            continue; // Don't process decay rule for lit vegetation
                        }
                        let finalProbability = rule.baseProbability || 0;
                        finalProbability += calculateInfluenceScore(c, r, rule);
                        if (Math.random() < finalProbability) {
                            newType = targetType;
                            changeOccurred = true;
                            break;
                        }
                    }
                }
            }
            // --- 2: Special Pattern-Based Formations ---
            let specialRuleTriggered = false;
            if (!changeOccurred) {
                if (originalType === Config.BLOCK_VEGETATION) {
                    if (checkForTreeFormation(c, r, changedCellsAndTypes)) {
                         specialRuleTriggered = true;
                    }
                }
            }
            if (specialRuleTriggered) {
                continue;
            }
            // --- 3: Apply the Single-Block Change ---
            if (changeOccurred) {
                const originalIsPlayerPlaced = (typeof blockBeforeChange === 'object') ? (blockBeforeChange.isPlayerPlaced ?? false) : false;
                if (World.setBlock(c, r, newType, originalIsPlayerPlaced)) {
                    changedCellsAndTypes.push({
                        c, r,
                        oldBlockType: originalType,
                        newBlockType: newType,
                        finalBlockData: World.getBlock(c, r)
                    });
                }
            }
        }
    }
    return {
        visualChanges: changedCellsAndTypes,
        gravityChanges: allGravityChangesFromAgingThisPass
    };
}