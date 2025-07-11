// -----------------------------------------------------------------------------
// root/js/agingManager.js - Handles World Aging Effects (erosion, growth, etc.)
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as World from './utils/world.js';
import * as GridCollision from './utils/gridCollision.js';
import { createBlock } from './utils/block.js';

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
                if (Math.abs(dr) < radius && Math.abs(dc) < radius) continue; // skip inner rings already processed
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
function checkForTreeFormation(c, r) {
    // Tree Spacing Check
    const radius = Config.MIN_TREE_SPACING_RADIUS;
    for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
            if (dr === 0 && dc === 0) continue;
            const checkC = c + dc;
            const checkR = r + dr;
            if (checkR >= 0 && checkR < Config.GRID_ROWS && checkC >= 0 && checkC < Config.GRID_COLS) {
                // Get full block data to check isPlayerPlaced
                const block = World.getBlock(checkC, checkR);
                if (typeof block === 'object' && block !== null) {
                    // Check if the block is NATURALLY occurring wood.
                    if (block.type === Config.BLOCK_WOOD && !block.isPlayerPlaced) {
                        return null; // Found a natural tree nearby, stop.
                    }
                }
            }
        }
    }
    // check for DIRT below
    const blockBelowType = World.getBlockType(c, r + 1);
    const canRootInDirt = (blockBelowType === Config.BLOCK_DIRT);
    // "Soil" and "Luck" checks
    if (canRootInDirt && Math.random() < (Config.AGING_PROB_VEGETATION_TO_WOOD_SURROUNDED ?? 0.02)) {
        const proposedTreeChanges = [];
        // tree pattern
        const pattern = [
            // Canopy
            { dr: -1, dc: 0, type: Config.BLOCK_VEGETATION },
            // Trunk and clearing
            { dr: 0, dc: -1, type: Config.BLOCK_AIR },
            { dr: 0, dc: 0, type: Config.BLOCK_WOOD },
            { dr: 0, dc: 1, type: Config.BLOCK_AIR },
            // Base of trunk, consuming the dirt below
            { dr: 1, dc: 0, type: Config.BLOCK_WOOD },
        ];
        for (const cell of pattern) {
            const targetC = c + cell.dc;
            const targetR = r + cell.dr;
            if (targetR >= 0 && targetR < Config.GRID_ROWS && targetC >= 0 && targetC < Config.GRID_COLS) {
                const oldBlockAtTargetType = World.getBlockType(targetC, targetR);
                proposedTreeChanges.push({
                    c: targetC,
                    r: targetR,
                    oldBlockType: oldBlockAtTargetType,
                    newBlockType: cell.type,
                    finalBlockData: null
                });
            }
        }
        return proposedTreeChanges;
    }
    return null;
}
export function applyAging(portalRef) {
    const grid = World.getGrid();
    if (!grid || grid.length === 0 || grid[0].length === 0) {
        return { visualChanges: [] };
    }
    let proposedChanges = [];
    // PASS 1: Collect all proposed changes without modifying the grid
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
            let newType = originalType;
            let changeOccurred = false;
            if (areNeighborsHomogeneous(c, r, originalType)) {
                if (originalType === Config.BLOCK_STONE) {
                    if (Math.random() < Config.AGING_PROB_DIAMOND_FORMATION) {
                        newType = Config.BLOCK_DIAMOND;
                        changeOccurred = true;
                    } else {
                        continue;
                    }
                } else if (originalType === Config.BLOCK_VEGETATION) {
                    const treeChanges = checkForTreeFormation(c, r);
                    if (treeChanges) {
                        proposedChanges.push(...treeChanges);
                        continue;
                    }
                } else {
                    continue;
                }
            } else {
                // "border block", proceed with deeper analysis
                const blockRules = Config.AGING_RULES[originalType];
                if (blockRules) {
                    for (const targetTypeStr in blockRules) {
                        const targetType = parseInt(targetTypeStr, 10);
                        const rule = blockRules[targetType];
                        if (rule.target !== undefined) {
                            const blockIsLit = (blockBeforeChange.lightLevel || 0) >= Config.MIN_LIGHT_THRESHOLD;
                            if (originalType === Config.BLOCK_VEGETATION && !blockIsLit) {
                                continue;
                            }
                            const neighbors = [{dc:0,dr:-1}, {dc:0,dr:1}, {dc:-1,dr:0}, {dc:1,dr:0}];
                            for (const offset of neighbors) {
                                const nc = c + offset.dc;
                                const nr = r + offset.dr;
                                if (World.getBlockType(nc, nr) === rule.target) {
                                    let finalProbability = rule.baseProbability || 0;
                                    finalProbability += calculateInfluenceScore(c, r, rule);
                                    if (Math.random() < finalProbability) {
                                        proposedChanges.push({
                                            c: nc, r: nr,
                                            oldBlockType: rule.target,
                                            newBlockType: targetType,
                                            finalBlockData: null
                                        });
                                        break;
                                    }
                                }
                            }
                        } else {
                            const blockIsLit = (blockBeforeChange.lightLevel || 0) >= Config.MIN_LIGHT_THRESHOLD;
                            if (originalType === Config.BLOCK_DIRT && targetType === Config.BLOCK_VEGETATION && !blockIsLit) {
                                continue;
                            }
                            if (originalType === Config.BLOCK_VEGETATION && targetType === Config.BLOCK_AIR && blockIsLit) {
                                continue;
                            }
                            let finalProbability = rule.baseProbability || 0;
                            finalProbability += calculateInfluenceScore(c, r, rule);
                            if (Math.random() < finalProbability) {
                                // decay rule for unlit vegetation
                                if (originalType === Config.BLOCK_VEGETATION && targetType === Config.BLOCK_AIR && !blockIsLit) {
                                    // It's unlit vegetation decay. Apply the 90/10 rule.
                                    if (Math.random() < 0.10) { // 10% chance to become DIRT
                                        newType = Config.BLOCK_DIRT;
                                    } else { // 90% chance to become AIR
                                        newType = Config.BLOCK_AIR;
                                    }
                                } else {
                                    // for all other rules, apply target type normally
                                    newType = targetType;
                                }
                                changeOccurred = true;
                                break;
                            }
                        }
                    }
                }
            }
            if (changeOccurred) {
                proposedChanges.push({
                    c, r,
                    oldBlockType: originalType,
                    newBlockType: newType,
                    finalBlockData: null
                });
            }
        }
    }
    // PASS 2: Apply all collected changes to the grid
    const appliedChanges = [];
    proposedChanges.forEach(change => {
        const { c, r, newBlockType, oldBlockType } = change;
        const blockBeforeChange = World.getBlock(c, r);
        const originalIsPlayerPlaced = (typeof blockBeforeChange === 'object' && blockBeforeChange !== null) ? (blockBeforeChange.isPlayerPlaced ?? false) : false;

        if (World.setBlock(c, r, newBlockType, originalIsPlayerPlaced)) {
            appliedChanges.push({
                c, r,
                oldBlockType: oldBlockType,
                newBlockType: newBlockType,
                finalBlockData: World.getBlock(c, r)
            });
        }
    });
    return {
        visualChanges: appliedChanges
    };
}