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
function checkForTreeFormation(c, r) {
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
    // This function is now only called for homogeneous vegetation, so this check is technically redundant but harmless.
    const allEightNeighborsAreVeg = Object.values(neighborTypes).every(type => type === Config.BLOCK_VEGETATION);
    if (allEightNeighborsAreVeg) {
        if (GridCollision.isSolid(c, r + 2) && Math.random() < (Config.AGING_PROB_VEGETATION_TO_WOOD_SURROUNDED ?? 0.02)) {
            const proposedTreeChanges = [];
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
                // This block is surrounded by blocks of the same type.
                // Diamond Formation Rule
                // We can check for special "pressure" or "pattern" transformations here.

                if (originalType === Config.BLOCK_STONE) {
                    // Diamond Formation Rule
                    if (Math.random() < Config.AGING_PROB_DIAMOND_FORMATION) {
                        newType = Config.BLOCK_DIAMOND;
                        changeOccurred = true;
                        // A change occurred, so we DON'T continue. We fall through to apply it.
                    } else {
                        // No diamond formed, so we can safely skip the rest of the logic for this block.
                        continue;
                    }
                } else if (originalType === Config.BLOCK_VEGETATION) {
                    // Tree Formation Rule - MOVED HERE
                    const treeChanges = checkForTreeFormation(c, r);
                    if (treeChanges) {
                        // Directly add the multi-block change and skip to the next grid cell
                        proposedChanges.push(...treeChanges);
                        continue;
                    }
                } else {
                    // It's a homogeneous block, but not stone or vegetation.
                    // Nothing to do, so we skip the expensive influence checks.
                    continue;
                }
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

            // --- Special Pattern-Based Formations are now handled above ---
            // The old block of code that was here has been removed.

            // --- Apply the Single-Block Change ---
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
        const blockBeforeChange = World.getBlock(c, r); // Get the original block for its properties
        const originalIsPlayerPlaced = (typeof blockBeforeChange === 'object' && blockBeforeChange !== null) ? (blockBeforeChange.isPlayerPlaced ?? false) : false;

        // Apply the change to the world grid.
        if (World.setBlock(c, r, newBlockType, originalIsPlayerPlaced)) {
            appliedChanges.push({
                c, r,
                oldBlockType: oldBlockType,
                newBlockType: newBlockType,
                finalBlockData: World.getBlock(c, r) // Now we have the final data
            });
        }
    });

    return {
        visualChanges: appliedChanges
    };
}