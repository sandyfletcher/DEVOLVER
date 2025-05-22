// -----------------------------------------------------------------------------
// root/js/agingManager.js - Handles World Aging Effects (erosion, growth, etc.)
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as World from './utils/world.js'; // Import world data access
import * as GridCollision from './utils/gridCollision.js'; // Import solid checks, hasSolidNeighbor
import { createBlock } from './utils/block.js'; // Import createBlock

let allGravityChangesFromAgingThisPass = []; // This will store gravity changes from aging, to be returned by applyAging

// Helper function to get neighbor block types
function getNeighborTypes(c, r) {
    const neighborTypes = {};
    // Cardinal directions
    neighborTypes.above = World.getBlockType(c, r - 1);
    neighborTypes.below = World.getBlockType(c, r + 1);
    neighborTypes.left = World.getBlockType(c - 1, r);
    neighborTypes.right = World.getBlockType(c + 1, r);
    // Diagonal directions
    neighborTypes.aboveLeft = World.getBlockType(c - 1, r - 1);
    neighborTypes.aboveRight = World.getBlockType(c + 1, r - 1);
    neighborTypes.belowLeft = World.getBlockType(c - 1, r + 1);
    neighborTypes.belowRight = World.getBlockType(c + 1, r + 1);
    return neighborTypes;
}

// Helper function to check exposure to a specific type (AIR or WATER)
// Optimization: Pass neighborTypes to avoid redundant calls to World.getBlockType
function isExposedTo(neighborTypes, exposedType) {
    return neighborTypes.above === exposedType ||
        neighborTypes.below === exposedType ||
        neighborTypes.left === exposedType ||
        neighborTypes.right === exposedType;
}

// Helper function to calculate the number of contiguous WATER blocks directly above a cell
function getWaterDepthAbove(c, r) {
    let depth = 0;
    // Start checking from the row directly above the current cell (r - 1)
    for (let checkR = r - 1; checkR >= 0; checkR--) {
        const blockType = World.getBlockType(c, checkR); // Handles out of bounds above
        if (blockType === Config.BLOCK_WATER) {
            depth++; // Count this water block
        } else {
            // Stop counting when we hit a non-water block (AIR, SOLID, or out of bounds)
            break;
        }
    }
    return depth;
}

// --- MODIFIED HELPER: Calculate natural vertical wood pillar height downwards ---
/**
 * Calculates the height of a contiguous vertical pillar of natural (not player-placed) WOOD blocks
 * starting from (c, r_start) and going downwards.
 * @param {number} c Column index.
 * @param {number} r_start Starting row index.
 * @returns {number} The height of the natural wood pillar.
 */
function getNaturalWoodPillarHeightDownwards(c, r_start) {
    let height = 0;
    for (let checkR = r_start; checkR < Config.GRID_ROWS; checkR++) {
        const blockData = World.getBlock(c, checkR);
        // Check if it's a WOOD block AND not player-placed
        if (blockData && typeof blockData === 'object' && blockData.type === Config.BLOCK_WOOD && !blockData.isPlayerPlaced) {
            height++;
        } else {
            break; // Stop if not natural wood, or it's air, water, or end of grid
        }
    }
    return height;
}
function placeInitialCanopy(trunkC, trunkTopR, radius, changedCellsArray) { //  Places the initial tree canopy around a given trunk top position
    if (radius < 0) return; // No canopy if radius is negative
    const centerR = trunkTopR - 1; // Canopy center is typically one block above the trunk top
    for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
            // Skip the very center if radius > 0? Maybe keep it simple and fill center too.
            // Optional: Create a more rounded shape by checking distance: if (dcdc + drdr > radius*radius) continue;
            const c = trunkC + dc;
            const r = centerR + dr;
            // Check bounds
            if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) {
                continue;
            }
            const currentBlockType = World.getBlockType(c, r);
            // Place canopy only in AIR blocks
            if (currentBlockType === Config.BLOCK_AIR) {
                const success = World.setBlock(c, r, Config.BLOCK_VEGETATION, false); // Trees are not player placed
                if (success) {
                    const blockAfterChange = World.getBlock(c, r);
                    changedCellsArray.push({ // Corrected: changedCellsAndTypes -> changedCellsArray
                        c, r,
                        oldBlockType: Config.BLOCK_AIR,
                        newBlockType: Config.BLOCK_VEGETATION,
                        finalBlockData: blockAfterChange
                    });
                }
            }
        }
    }
}
function isLikelyTreeTrunk(c, r) { // Check if a WOOD block is likely part of a tree trunk
    const blockType = World.getBlockType(c, r);
    if (blockType !== Config.BLOCK_WOOD) return false;
    const typeBelow = World.getBlockType(c, r + 1);
    const typeAbove = World.getBlockType(c, r - 1);
    // It's wood, has wood or solid ground below, and has vegetation or air above
    const hasSupport = (typeBelow === Config.BLOCK_WOOD || GridCollision.isSolid(c, r + 1)); // Check solid for base
    const hasCanopyOrAirAbove = (typeAbove === Config.BLOCK_VEGETATION || typeAbove === Config.BLOCK_AIR || typeAbove === null); // null means top of world
    return hasSupport && hasCanopyOrAirAbove;
}

// Tries to expand the canopy around a given vegetation block
function expandCanopy(canopyC, canopyR, changedCellsArray) {
    const neighbors = [
        { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
        { dc: -1, dr: 0 }, { dc: 1, dr: 0 },
        // Optional: Add diagonals for faster/bushier growth
        { dc: -1, dr: -1 }, { dc: 1, dr: -1 },
        { dc: -1, dr: 1 }, { dc: 1, dr: 1 },
    ];
    let expansionOccurred = false;
    for (const offset of neighbors) {
        const nc = canopyC + offset.dc;
        const nr = canopyR + offset.dr;
        // Basic bounds check
        if (nr < 0 || nr >= Config.GRID_ROWS || nc < 0 || nc >= Config.GRID_COLS) {
            continue;
        }
        // TODO: Implement max radius check - more complex, needs tree origin
        // For now, just expand into adjacent air
        if (World.getBlockType(nc, nr) === Config.BLOCK_AIR) {
            if (Math.random() < (Config.AGING_PROB_TREE_CANOPY_GROW ?? 0.1)) {
                const success = World.setBlock(nc, nr, Config.BLOCK_VEGETATION, false);
                if (success) {
                    const blockAfterChange = World.getBlock(nc, nr);
                    changedCellsArray.push({ // Corrected: changedCellsAndTypes -> changedCellsArray
                        c: nc, r: nr,
                        oldBlockType: Config.BLOCK_AIR,
                        newBlockType: Config.BLOCK_VEGETATION,
                        finalBlockData: blockAfterChange
                    });
                    expansionOccurred = true;
                    // Maybe only expand one block per tick per original canopy block?
                    // break; // Uncomment to limit growth to one new block per original block per aging pass
                }
            }
        }
    }
    return expansionOccurred;
}

export function applyAging(portalRef) { // applies aging effects (erosion, growth, stoneification, etc.) to the world grid
    const grid = World.getGrid();
    if (!grid || grid.length === 0 || grid[0].length === 0) {
        console.error("World grid is not available or empty for aging.");
        return { visualChanges: [], gravityChanges: [] }; // Return structure
    }
    let changedCellsAndTypes = []; // This will be part of the return
    allGravityChangesFromAgingThisPass = []; // Reset for this pass
    for (let r = 0; r < Config.GRID_ROWS; r++) { // iterate through ALL cells
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (portalRef) { // Portal protection check
                const blockCenterX = c * Config.BLOCK_WIDTH + Config.BLOCK_WIDTH / 2;
                const blockCenterY = r * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2;
                const portalCenter = portalRef.getPosition();
                const portalX = portalCenter.x;
                const portalY = portalCenter.y;
                const protectedRadiusSq = portalRef.safetyRadius * portalRef.safetyRadius;
                const dx = blockCenterX - portalX;
                const dy = blockCenterY - portalY;
                const distSqToPortal = dx * dx + dy * dy;
                if (distSqToPortal < protectedRadiusSq) {
                    continue; // Skip aging within portal safety radius
                }
            }
            const blockBeforeChange = World.getBlock(c, r);
            if (blockBeforeChange === null) continue;
            const originalType = (typeof blockBeforeChange === 'object') ? blockBeforeChange.type : blockBeforeChange;
            const originalIsPlayerPlaced = (typeof blockBeforeChange === 'object') ? (blockBeforeChange.isPlayerPlaced ?? false) : false;
            const neighborTypes = getNeighborTypes(c, r); // This now includes diagonals
            const isExposedToAir = isExposedTo(neighborTypes, Config.BLOCK_AIR);
            const isExposedToWater = isExposedTo(neighborTypes, Config.BLOCK_WATER);
            const waterDepthAbove = getWaterDepthAbove(c, r);
            let newType = originalType;
            let tinyTreeFormedThisCell = false; // Flag to prevent double processing if a 3x3 tree forms
            // Rule 1: SAND Erosion (Highest Priority)
            if (originalType === Config.BLOCK_SAND) {
                if (waterDepthAbove > 0) {
                    if (Math.random() < Config.AGING_PROB_WATER_EROSION_SAND) {
                        newType = Config.BLOCK_WATER;
                    }
                } else if (isExposedToAir) {
                    if (Math.random() < Config.AGING_PROB_AIR_EROSION_SAND) {
                        newType = Config.BLOCK_AIR;
                    }
                }
            }
            // Rule 1.5: DIRT/VEGETATION Water Erosion -> SAND
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_VEGETATION)) {
                if (waterDepthAbove > 0) {
                    if (Math.random() < Config.AGING_PROB_WATER_EROSION_DIRT_VEGETATION) {
                        newType = Config.BLOCK_SAND;
                    }
                }
            }
            // Unlit VEGETATION -> AIR (Decay) 
            if (!tinyTreeFormedThisCell && newType === originalType && originalType === Config.BLOCK_VEGETATION) {
                // blockBeforeChange is the state of the block at (c,r) at the start of this aging pass for this cell.
                // If newType hasn't changed yet, blockBeforeChange.isLit is the correct lighting state to check.
                const isBlockLit = (typeof blockBeforeChange === 'object' && blockBeforeChange !== null) ? (blockBeforeChange.isLit ?? false) : false;
                if (!isBlockLit) { // If the vegetation block itself is not lit
                    if (Math.random() < Config.AGING_PROB_UNLIT_VEGETATION_DECAY) { // Use the new config constant
                        newType = Config.BLOCK_AIR;
                    }
                }
            }
            // AIR -> VEGETATION GROWTH (on lit DIRT or lit VEGETATION below)
            if (newType === originalType && originalType === Config.BLOCK_AIR) {
                const blockBelowData = World.getBlock(c, r + 1);
                if (blockBelowData !== null && r < Config.GRID_ROWS - 1) {
                    const blockBelowType = (typeof blockBelowData === 'object') ? blockBelowData.type : blockBelowData;
                    const blockBelowIsLit = (typeof blockBelowData === 'object') ? (blockBelowData.isLit ?? false) : false;

                    if (blockBelowIsLit) {
                        if (blockBelowType === Config.BLOCK_DIRT) {
                            if (Math.random() < (Config.AGING_PROB_AIR_GROWS_VEGETATION_ON_LIT_DIRT ?? 0.01)) {
                                newType = Config.BLOCK_VEGETATION;
                            }
                        } else if (blockBelowType === Config.BLOCK_VEGETATION) {
                            if (Math.random() < (Config.AGING_PROB_AIR_GROWS_VEGETATION_ON_LIT_VEGETATION ?? 0.02)) {
                                newType = Config.BLOCK_VEGETATION;
                            }
                        }
                    }
                }
            }
            // Rule 2.3: VEGETATION Surrounded by 8 VEGETATION -> Tiny Tree Structure
            if (newType === originalType && originalType === Config.BLOCK_VEGETATION) {
                const allEightNeighborsAreVeg =
                    (neighborTypes.above === Config.BLOCK_VEGETATION) &&
                    (neighborTypes.below === Config.BLOCK_VEGETATION) &&
                    (neighborTypes.left === Config.BLOCK_VEGETATION) &&
                    (neighborTypes.right === Config.BLOCK_VEGETATION) &&
                    (neighborTypes.aboveLeft === Config.BLOCK_VEGETATION) &&
                    (neighborTypes.aboveRight === Config.BLOCK_VEGETATION) &&
                    (neighborTypes.belowLeft === Config.BLOCK_VEGETATION) &&
                    (neighborTypes.belowRight === Config.BLOCK_VEGETATION);
                if (allEightNeighborsAreVeg) {
                    const hasTrunkSupport = GridCollision.isSolid(c, r + 2); // Check below the lowest wood part of the new tree pattern
                    if (hasTrunkSupport) {
                        let tooCloseToAnotherTree = false;
                        const spacingRadius = Config.MIN_TREE_SPACING_RADIUS ?? 8;
                        // Scan around the base of the *potential new trunk* (which starts at (c,r) and (c,r+1))
                        for (let dr_spacing = -spacingRadius; dr_spacing <= spacingRadius; dr_spacing++) {
                            for (let dc_spacing = -spacingRadius; dc_spacing <= spacingRadius; dc_spacing++) {
                                // We are checking around the central point (c,r) which is where the top of the 2-block trunk will be.
                                const check_c = c + dc_spacing;
                                const check_r = r + dr_spacing;
                                if (check_r < 0 || check_r >= Config.GRID_ROWS || check_c < 0 || check_c >= Config.GRID_COLS) {
                                    continue;
                                }
                                // Avoid checking the exact cells that *will become* the new trunk if we are at the origin of spacing check
                                if (dr_spacing >= 0 && dr_spacing <= 1 && dc_spacing === 0 && (check_c === c && (check_r === r || check_r === r + 1))) {
                                    continue;
                                }
                                const blockAtSpacingCheck = World.getBlock(check_c, check_r);
                                if (blockAtSpacingCheck && typeof blockAtSpacingCheck === 'object' && blockAtSpacingCheck.type === Config.BLOCK_WOOD) {
                                    if (isLikelyTreeTrunk(check_c, check_r)) {
                                        tooCloseToAnotherTree = true;
                                        break;
                                    }
                                }
                            }
                            if (tooCloseToAnotherTree) break;
                        }
                        if (!tooCloseToAnotherTree) {
                            if (Math.random() < (Config.AGING_PROB_VEGETATION_TO_WOOD_SURROUNDED ?? 0.02)) {
                                tinyTreeFormedThisCell = true;
                                const pattern = [
                                    { dr: -1, dc: -1, type: Config.BLOCK_VEGETATION }, { dr: -1, dc: 0, type: Config.BLOCK_VEGETATION }, { dr: -1, dc: +1, type: Config.BLOCK_VEGETATION },
                                    { dr: 0, dc: -1, type: Config.BLOCK_AIR }, { dr: 0, dc: 0, type: Config.BLOCK_WOOD }, { dr: 0, dc: +1, type: Config.BLOCK_AIR },
                                    { dr: +1, dc: -1, type: Config.BLOCK_AIR }, { dr: +1, dc: 0, type: Config.BLOCK_WOOD }, { dr: +1, dc: +1, type: Config.BLOCK_AIR },
                                ];
                                for (const cell of pattern) {
                                    const targetC = c + cell.dc;
                                    const targetR = r + cell.dr;
                                    if (targetR >= 0 && targetR < Config.GRID_ROWS && targetC >= 0 && targetC < Config.GRID_COLS) {
                                        // Determine old block type at target for accurate logging
                                        let oldBlockAtTargetType;
                                        const oldBlockDataAtTarget = World.getBlock(targetC, targetR);
                                        if (typeof oldBlockDataAtTarget === 'object' && oldBlockDataAtTarget !== null) {
                                            oldBlockAtTargetType = oldBlockDataAtTarget.type;
                                        } else {
                                            oldBlockAtTargetType = oldBlockDataAtTarget; // Should be BLOCK_AIR (0) or null
                                        }
                                        const success = World.setBlock(targetC, targetR, cell.type, false);
                                        if (success) {
                                            const blockAfterChange = World.getBlock(targetC, targetR);
                                            // Only add to visual changes if the block type actually changed
                                            if (oldBlockAtTargetType !== cell.type) {
                                                changedCellsAndTypes.push({
                                                    c: targetC, r: targetR,
                                                    oldBlockType: oldBlockAtTargetType,
                                                    newBlockType: cell.type,
                                                    finalBlockData: blockAfterChange
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // --- Rule 2.4: WOOD -> Grow WOOD Upwards, check Collapse/Canopy ---
            if (!tinyTreeFormedThisCell && newType === Config.BLOCK_WOOD && !originalIsPlayerPlaced) {
                const hasSupportBelow = GridCollision.isSolid(c, r + 1) || World.getBlockType(c, r + 1) === Config.BLOCK_WOOD;
                const blockAboveTypeCurrent = World.getBlockType(c, r - 1);
                if (hasSupportBelow && (blockAboveTypeCurrent === Config.BLOCK_AIR || blockAboveTypeCurrent === Config.BLOCK_VEGETATION) && r > 0) {
                    if (Math.random() < (Config.AGING_PROB_WOOD_GROWS_WOOD_UP ?? 0.1)) {
                        const growUpR = r - 1;
                        const oldBlockTypeAtGrowLocation = blockAboveTypeCurrent;
                        const successGrowWoodUp = World.setBlock(c, growUpR, Config.BLOCK_WOOD, false);
                        if (successGrowWoodUp) {
                            const newWoodBlockData = World.getBlock(c, growUpR);
                            changedCellsAndTypes.push({
                                c: c, r: growUpR,
                                oldBlockType: oldBlockTypeAtGrowLocation,
                                newBlockType: Config.BLOCK_WOOD,
                                finalBlockData: newWoodBlockData
                            });
                            const MAX_TRUNK_HEIGHT = Config.MAX_NATURAL_TRUNK_HEIGHT_BEFORE_COLLAPSE ?? 15;
                            const totalNaturalWoodPillarHeight = getNaturalWoodPillarHeightDownwards(c, growUpR);
                            if (totalNaturalWoodPillarHeight > MAX_TRUNK_HEIGHT) {
                                let blocksToMakeFallThisCollapse = [];
                                for (let h_fall = 0; h_fall < totalNaturalWoodPillarHeight; h_fall++) {
                                    const fallR = growUpR + h_fall;
                                    if (fallR >= Config.GRID_ROWS) break;
                                    const currentBlockDataForFall = World.getBlock(c, fallR);
                                    if (currentBlockDataForFall && currentBlockDataForFall.type === Config.BLOCK_WOOD && !currentBlockDataForFall.isPlayerPlaced) {
                                        const fallingBlockData = { ...currentBlockDataForFall };
                                        World.setBlock(c, fallR, Config.BLOCK_AIR, false);
                                        let r_end_fall = Config.GRID_ROWS - 1;
                                        for (let check_r_fall = fallR + 1; check_r_fall < Config.GRID_ROWS; check_r_fall++) {
                                            if (GridCollision.isSolid(c, check_r_fall)) {
                                                r_end_fall = check_r_fall - 1;
                                                break;
                                            }
                                        }
                                        r_end_fall = Math.max(fallR, r_end_fall);
                                        blocksToMakeFallThisCollapse.push({ c, r_start: fallR, r_end: r_end_fall, blockData: fallingBlockData });
                                        let collapseChangeIndex = changedCellsAndTypes.findIndex(ch => ch.c === c && ch.r === fallR);
                                        if (collapseChangeIndex !== -1) {
                                            changedCellsAndTypes[collapseChangeIndex].newBlockType = Config.BLOCK_AIR;
                                            changedCellsAndTypes[collapseChangeIndex].finalBlockData = createBlock(Config.BLOCK_AIR, false);
                                        } else {
                                            changedCellsAndTypes.push({
                                                c, r: fallR,
                                                oldBlockType: Config.BLOCK_WOOD,
                                                newBlockType: Config.BLOCK_AIR,
                                                finalBlockData: createBlock(Config.BLOCK_AIR, false)
                                            });
                                        }
                                    } else { break; }
                                }
                                if (blocksToMakeFallThisCollapse.length > 0) {
                                    allGravityChangesFromAgingThisPass.push(...blocksToMakeFallThisCollapse);
                                }
                            } else {
                                const MIN_TRUNK_HEIGHT_FOR_CANOPY = Config.TREE_MIN_HEIGHT_TO_FORM_ORGANIC ?? 4;
                                if (totalNaturalWoodPillarHeight >= MIN_TRUNK_HEIGHT_FOR_CANOPY) {
                                    const blockAboveNewWoodForCanopy = World.getBlockType(c, growUpR - 1);
                                    if (blockAboveNewWoodForCanopy === Config.BLOCK_AIR) {
                                        placeInitialCanopy(c, growUpR, Config.TREE_INITIAL_CANOPY_RADIUS, changedCellsAndTypes);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // Rule 3: Tree Canopy Growth & Decay (Only if a tiny tree wasn't formed at this (c,r) which would change its type)
            if (!tinyTreeFormedThisCell && newType === originalType && originalType === Config.BLOCK_VEGETATION) {
                let isNearTrunk = false;
                for (let dr_canopy = -1; dr_canopy <= 1; dr_canopy++) {
                    for (let dc_canopy = -1; dc_canopy <= 1; dc_canopy++) {
                        if (dr_canopy === 0 && dc_canopy === 0) continue;
                        if (isLikelyTreeTrunk(c + dc_canopy, r + dr_canopy)) {
                            isNearTrunk = true;
                            break;
                        }
                    }
                    if (isNearTrunk) break;
                }
                if (isNearTrunk) {
                    expandCanopy(c, r, changedCellsAndTypes);
                }
            }
            if (!tinyTreeFormedThisCell && newType === originalType && originalType === Config.BLOCK_VEGETATION) {
                let isNearTrunkDecay = false;
                for (let dr_decay = -1; dr_decay <= 1; dr_decay++) {
                    for (let dc_decay = -1; dc_decay <= 1; dc_decay++) {
                        if (dr_decay === 0 && dc_decay === 0) continue;
                        if (isLikelyTreeTrunk(c + dc_decay, r + dr_decay)) {
                            isNearTrunkDecay = true;
                            break;
                        }
                    }
                    if (isNearTrunkDecay) break;
                }
                const isNotDirectlyOnTrunkTop = !(World.getBlockType(c, r + 1) === Config.BLOCK_WOOD && isLikelyTreeTrunk(c, r + 1));
                if (isNearTrunkDecay && isNotDirectlyOnTrunkTop && Math.random() < (Config.AGING_PROB_TREE_CANOPY_DECAY ?? 0.01)) {
                    newType = Config.BLOCK_AIR;
                }
            }
            if (!tinyTreeFormedThisCell && newType === originalType && originalType === Config.BLOCK_WOOD && !originalIsPlayerPlaced) {
                if (isLikelyTreeTrunk(c, r)) {
                    if (Math.random() < (Config.AGING_PROB_TREE_TRUNK_DECAY ?? 0.005)) {
                        newType = Config.BLOCK_AIR;
                    }
                }
            }
            // Rule 4: Deep Stoneification
            if (!tinyTreeFormedThisCell && newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_VEGETATION || originalType === Config.BLOCK_SAND)) {
                const depthInPixels = r * Config.BLOCK_HEIGHT;
                if (depthInPixels > Config.AGING_STONEIFICATION_DEPTH_THRESHOLD) {
                    if (Math.random() < Config.AGING_PROB_STONEIFICATION_DEEP) {
                        newType = Config.BLOCK_STONE;
                    }
                }
            }
            // Rule 5: Surface Stone Erosion
            if (!tinyTreeFormedThisCell && newType === originalType && originalType === Config.BLOCK_STONE) {
                const isSurfaceStone = neighborTypes.above === Config.BLOCK_AIR || neighborTypes.above === Config.BLOCK_WATER;
                if (isSurfaceStone) {
                    if (Math.random() < Config.AGING_PROB_EROSION_SURFACE_STONE) {
                        newType = Config.BLOCK_AIR;
                    }
                }
            }
            // Only apply single block change if a tiny tree wasn't formed at this exact (c,r) as center
            if (!tinyTreeFormedThisCell && newType !== originalType) {
                const successSetBlock = World.setBlock(c, r, newType, originalIsPlayerPlaced);
                if (!successSetBlock) {
                    console.error(`Aging failed to set block data at [${c}, ${r}] to type ${newType}.`);
                } else {
                    const blockAfterChangeMain = World.getBlock(c, r);
                    changedCellsAndTypes.push({
                        c,
                        r,
                        oldBlockType: originalType,
                        newBlockType: newType,
                        finalBlockData: blockAfterChangeMain
                    });
                }
            }
            // Sand Sedimentation Rule (runs regardless of tiny tree formation, as it checks current grid state)
            const currentTypeAtCR = World.getBlockType(c, r); // This will be WOOD if a tiny tree just formed at (c,r)
            if (currentTypeAtCR === Config.BLOCK_SAND) { // This rule should still work, it's independent of the above rules' direct output for (c,r)
                if (waterDepthAbove > 0) {
                    const maxSandDepthBelowInBlocks = Math.min(waterDepthAbove, Config.AGING_WATER_DEPTH_INFLUENCE_MAX_DEPTH);
                    for (let potentialDepth = 1; potentialDepth <= maxSandDepthBelowInBlocks; potentialDepth++) {
                        const nr_sand_sed = r + potentialDepth;
                        if (nr_sand_sed >= Config.GRID_ROWS) break;
                        const targetBlockBeforeSedimentation = World.getBlock(c, nr_sand_sed);
                        const targetBlockTypeBeforeChange = (typeof targetBlockBeforeSedimentation === 'object' && targetBlockBeforeSedimentation !== null)
                            ? targetBlockBeforeSedimentation.type
                            : targetBlockBeforeSedimentation;
                        const isConvertibleMaterial = Config.AGING_MATERIAL_CONVERSION_FACTORS[targetBlockTypeBeforeChange] !== undefined;
                        if (isConvertibleMaterial) {
                            if (Math.random() < Config.AGING_PROB_SAND_SEDIMENTATION_BELOW) {
                                if (targetBlockTypeBeforeChange !== Config.BLOCK_SAND) {
                                    const successSed = World.setBlock(c, nr_sand_sed, Config.BLOCK_SAND, false);
                                    if (successSed) {
                                        const blockAfterSedimentation = World.getBlock(c, nr_sand_sed);
                                        changedCellsAndTypes.push({
                                            c: c,
                                            r: nr_sand_sed,
                                            oldBlockType: targetBlockTypeBeforeChange,
                                            newBlockType: Config.BLOCK_SAND,
                                            finalBlockData: blockAfterSedimentation
                                        });
                                    }
                                }
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                }
            }
        }
    }
    return {
        visualChanges: changedCellsAndTypes,
        gravityChanges: allGravityChangesFromAgingThisPass
    };
}