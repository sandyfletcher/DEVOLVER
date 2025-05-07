// -----------------------------------------------------------------------------
// root/js/utils/gridCollision.js - Handles Entity vs World Grid Collision Logic
// -----------------------------------------------------------------------------

import * as Config from '../config.js';
import * as WorldData from './worldData.js';

export const E_EPSILON = 1e-4; // tiny offset to prevent floating point errors / sticking

export function isEntityInWater(entity) { // checks if entity is significantly submerged, as a % from bottom edge
    if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number' || // check only if entity object and properties are valid
        typeof entity.width !== 'number' || typeof entity.height !== 'number' ||
        isNaN(entity.x) || isNaN(entity.y) || isNaN(entity.width) || isNaN(entity.height) ||
        entity.width <= 0 || entity.height <= 0) {
        console.warn("isEntityInWater: Invalid entity data provided.", entity);
        return false;
    }
    const submersionCheckFraction = 0.50; // calculate the Y coordinate to check, entity.y is top, entity.y + entity.height is bottom.
    const checkY = entity.y + entity.height * submersionCheckFraction; // we check a point X% of the way down from the top. // Check 50% down
    const checkX = entity.x + entity.width * 0.5; // horizontal center for X coordinate check
    const { col, row } = worldToGridCoords(checkX, checkY); // convert world coordinates to grid coordinates
    const blockType = WorldData.getBlockType(col, row); // check the block type at the calculated grid cell
    return blockType === Config.BLOCK_WATER; // return true if the block at the check point is water (and not out of bounds)
}
export function isSolid(col, row) { // checks if block at given grid coordinates is solid
    if (row < 0 || row >= Config.GRID_ROWS || col < 0 || col >= Config.GRID_COLS) { // check if row/col is outside valid grid range defined in Config
        return false; // treat out of bounds as not solid
    }
    const block = WorldData.getBlock(col, row);
    if (block === null || block === Config.BLOCK_AIR) { // check if block data is null or air
        return false;
    }
    if (typeof block === 'object' && block.type === Config.BLOCK_WATER) {
        return false; // water is not solid
    }
    if (typeof block === 'object' && typeof block.type === 'number') { // any block object that exists and isn't air or water is solid
        return true; // block object representing solid tile
    }
    return false; // fallback for unexpected data
}
export function hasSolidNeighbor(col, row) { // checks if grid cell has adjacent solid block (needed for placement support)
    if (typeof col !== 'number' || typeof row !== 'number' || isNaN(col) || isNaN(row)) { // ensure col and row are valid numbers
        console.warn("hasSolidNeighbor: Invalid coordinates.", col, row);
        return false;
    }
    const neighbors = [
        { c: col, r: row - 1 }, // above
        { c: col, r: row + 1 }, // below
        { c: col - 1, r: row }, // left
        { c: col + 1, r: row }  // right
    ];
    for (const n of neighbors) {
        if (isSolid(n.c, n.r)) { // use GridCollision.isSolid which handles boundary checks and block type checks
            return true; // found solid neighbour
        }
    }
    return false; // no solid neighbours found
}
export function worldToGridCoords(worldX, worldY) { // converts world coordinates (pixels) to grid coordinates (column, row)
    const safeWorldX = typeof worldX === 'number' && !isNaN(worldX) ? worldX : 0;
    const safeWorldY = typeof worldY === 'number' && !isNaN(worldY) ? worldY : 0; // ensure worldX and worldY aren't NaN
    const col = Math.floor(safeWorldX / Config.BLOCK_WIDTH);
    const row = Math.floor(safeWorldY / Config.BLOCK_HEIGHT);
    return { col, row };
}
export function collideAndResolve(entity, potentialMoveX, potentialMoveY) { // main collision resolution- swept AABB collision detection/resolution against world grid
    if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number' || // basic validation
    typeof entity.width !== 'number' || typeof entity.height !== 'number' ||
    isNaN(entity.x) || isNaN(entity.y) || isNaN(entity.width) || isNaN(entity.height) ||
    entity.width <= 0 || entity.height <= 0) {
        console.error("collideAndResolve: Invalid entity data provided. Skipping collision.", entity);
        return { collidedX: false, collidedY: false, isOnGround: false, didStepUp: false };
    }
    let moveX = potentialMoveX; // use the passed-in movement amounts
    let moveY = potentialMoveY;
    let collidedX = false;
    let collidedY = false;
    let isOnGround = false; // assume not on ground initially
    let didStepUp = false;
    let stepTier = 0; // need a flag to modify VX - 0: no step, 1: effortless step, 2: slowed step
    const canAttemptStepUp = entity.vy <= Config.GRAVITY_ACCELERATION * (1 / 60) + E_EPSILON; // determine if stepup is possible based on vertical velocity
    if (Math.abs(moveX) > E_EPSILON) { // step 1: resolve x-axis collision
        const signX = Math.sign(moveX);
        const xEdge = (signX > 0) ? entity.x + entity.width : entity.x;
        let earliestToiX = 1.0;
        let collisionSurfaceX = 0;
        let stepUpCandidateCol = -1;
        let stepUpCandidateRow = -1;
        const yStart = entity.y; // calculate row span of the entity's current position
        const yEnd = entity.y + entity.height;
        const minRow = Math.max(0, Math.floor(yStart / Config.BLOCK_HEIGHT));
        const maxRow = Math.min(Config.GRID_ROWS - 1, Math.floor((yEnd - E_EPSILON) / Config.BLOCK_HEIGHT));
        const targetXEdge = xEdge + moveX; // calculate column check range and direction for the sweep
        const actualCheckStart = (signX > 0) ? Math.max(0, Math.floor((xEdge + E_EPSILON) / Config.BLOCK_WIDTH)) : Math.min(Config.GRID_COLS - 1, Math.floor((xEdge - E_EPSILON) / Config.BLOCK_WIDTH));
        const actualCheckEnd = (signX > 0) ? Math.min(Config.GRID_COLS - 1, Math.floor((targetXEdge + E_EPSILON) / Config.BLOCK_WIDTH)) : Math.max(0, Math.floor((targetXEdge - E_EPSILON) / Config.BLOCK_WIDTH));
        for (let r = minRow; r <= maxRow; r++) { // find the earliest X collision across entity's vertical span
            const step = (signX > 0) ? 1 : -1;
            for (let c = actualCheckStart; (signX > 0 ? c <= actualCheckEnd : c >= actualCheckEnd); c += step) {
                if (c < 0 || c >= Config.GRID_COLS) continue;
                if (isSolid(c, r)) {
                    const blockEdgeX = (signX > 0) ? c * Config.BLOCK_WIDTH : (c + 1) * Config.BLOCK_WIDTH;
                    const distance = blockEdgeX - xEdge;
                    let toiX = distance / moveX;
                    if (toiX >= -E_EPSILON && toiX < earliestToiX) {
                        earliestToiX = toiX;
                        collisionSurfaceX = blockEdgeX; // needed for non-step-up collision
                        stepUpCandidateCol = c;
                        stepUpCandidateRow = r;
                    }
                    break; // break inner loop once solid block is found in row
                }
            }
        }
        let performStepUp = false; // determine step-up outcome AFTER finding the earliest collision
        stepTier = 0; // reset tier
        if (earliestToiX < 1.0 - E_EPSILON && canAttemptStepUp && stepUpCandidateCol !== -1) {
            const blockTopY = stepUpCandidateRow * Config.BLOCK_HEIGHT;
            const entityBottomY = entity.y + entity.height;
            const obstaclePixelHeight = entityBottomY - blockTopY; // calculate height difference between entity's feet and obstacle's top - height entity would need to step *onto*
            // check if obstacle height is within the limits and not above bottom of entity to allow stepping onto same level
            const isStepPossibleHeightwise = obstaclePixelHeight > -E_EPSILON && obstaclePixelHeight <= entity.height * Config.ENTITY_STEP_TIER2_MAX_HEIGHT_FACTOR;
            let isSpaceAboveClear = true; // check if space directly above obstacle is clear for entity's full height
            const entityTopRow = Math.floor(entity.y / Config.BLOCK_HEIGHT);
            for (let r = entityTopRow; r < stepUpCandidateRow; r++) { // check rows from entity's top down to row just above obstacle
                if (r < 0 || r >= Config.GRID_ROWS || stepUpCandidateCol < 0 || stepUpCandidateCol >= Config.GRID_COLS) { // ensure cell is within bounds before checking solid status
                    isSpaceAboveClear = false; // treat out of bounds as blockage
                    break;
                }
                if (isSolid(stepUpCandidateCol, r)) {
                    isSpaceAboveClear = false;
                    break;
                }
            }
            if (isStepPossibleHeightwise && isSpaceAboveClear) {
                performStepUp = true; // step-up becomes possible
                if (obstaclePixelHeight <= entity.height * Config.ENTITY_STEP_TIER1_MAX_HEIGHT_FACTOR) { // tier is determined based on obstacle height
                    stepTier = 1; // effortless
                } else {
                    stepTier = 2; // slowed
                }
            }
        }
        if (performStepUp) {
            entity.x += moveX * earliestToiX; // move horizontally by the TOI amount
            entity.y = (stepUpCandidateRow * Config.BLOCK_HEIGHT) - entity.height; // snap entity's bottom to the top of the obstacle block
            entity.vy = 0; // zero out vertical velocity during step-up
            didStepUp = true; // mark that a step up occurred
            if (stepTier === 2) { // apply horizontal velocity modification based on tier
                 entity.vx *= Config.ENTITY_STEP_TIER2_HORIZONTAL_FRICTION;
            } // do NOT set collidedX = true here, horizontal movement might continue next frame
        } else if (earliestToiX < 1.0 - E_EPSILON) { // apply X collision result if step-up not possible
            entity.x += moveX * earliestToiX; // standard X collision (obstacle too high or space above blocked): move entity exactly to the collision surface by the TOI amount
            entity.x = (signX > 0) ? (collisionSurfaceX - entity.width - E_EPSILON) : (collisionSurfaceX + E_EPSILON); // snap precisely to the edge of the block, offset by epsilon to prevent sticking
            entity.vx = 0; // stop horizontal velocity
            collidedX = true; // mark that X collision occurred
        } else {
            entity.x += moveX; // no X collision: move freely horizontally for the full potential distance
        }
    }
    const actualMoveY = didStepUp ? 0 : moveY; // resolve Y-axis collision using entity's new X and Y in case vy was zeroed by step-up
    if (Math.abs(actualMoveY) > E_EPSILON || didStepUp) { // check Y if there's vertical movement or stepped up
        const signY = didStepUp ? 1 : Math.sign(actualMoveY); // determine check direction. If stepped up, check downwards. Otherwise use moveY's sign.
        const yEdge = (signY > 0) ? entity.y + entity.height : entity.y; // leading edge of entity
        let earliestToiY = 1.0; // time of impact (0 to 1)
        let collisionSurfaceY = 0;
        const xStart = entity.x; // calculate column span of the entity at its (potentially new) X position
        const xEnd = entity.x + entity.width;
        const minCol = Math.max(0, Math.floor(xStart / Config.BLOCK_WIDTH));
        const maxCol = Math.min(Config.GRID_COLS - 1, Math.floor((xEnd - E_EPSILON) / Config.BLOCK_WIDTH)); // use epsilon for right edge
        const targetYEdge = yEdge + actualMoveY; // calculate row check range for the sweep based on entity's current Y and actualMoveY
        const startRowCheck = Math.floor(yEdge / Config.BLOCK_HEIGHT);
        const endRowCheck = Math.floor((targetYEdge + (signY > 0 ? E_EPSILON : -E_EPSILON)) / Config.BLOCK_HEIGHT);
        // adjust the check range slightly to include the *next* cell if we start exactly at an edge
        const actualCheckStart = (signY > 0) ? Math.max(0, Math.floor((yEdge + E_EPSILON) / Config.BLOCK_HEIGHT)) : Math.min(Config.GRID_ROWS - 1, Math.floor((yEdge - E_EPSILON) / Config.BLOCK_HEIGHT));
        const actualCheckEnd = (signY > 0) ? Math.min(Config.GRID_ROWS - 1, Math.floor((targetYEdge + E_EPSILON) / Config.BLOCK_HEIGHT)) : Math.max(0, Math.floor((targetYEdge - E_EPSILON) / Config.BLOCK_HEIGHT));
        for (let c = minCol; c <= maxCol; c++) { // find the earliest Y collision across the entity's horizontal span
             const checkStart = actualCheckStart;
             const checkEnd = actualCheckEnd;
             const step = (signY > 0) ? 1 : -1;
             for (let r = checkStart; (signY > 0 ? r <= checkEnd : r >= checkEnd); r += step) {
                if (r < 0 || r >= Config.GRID_ROWS) continue; // ensure cell is within bounds
                if (isSolid(c, r)) {
                    const blockEdgeY = (signY > 0) ? r * Config.BLOCK_HEIGHT : (r + 1) * Config.BLOCK_HEIGHT; // found edge of potential solid block being hit
                    let toiY = 1.0; // correct TOI calculation
                    if (Math.abs(actualMoveY) > E_EPSILON) { // time of impact = distance to collision plane / velocity towards plane
                         const distance = blockEdgeY - yEdge; // distance = block edge position - entity leading edge position
                         toiY = distance / actualMoveY;
                    } else if (didStepUp) { // if stepped up, collision is immediate if block edge is right direction relative to entity edge - block top below entity bottom or block bottom above entity top
                         if ((signY > 0 && blockEdgeY >= yEdge - E_EPSILON) || (signY < 0 && blockEdgeY <= yEdge + E_EPSILON)) {
                             toiY = 0; // immediate collision
                         } else {
                             continue; // collision is not in the direction of the check after step-up
                         }
                    }
                    if (toiY >= -E_EPSILON && toiY < earliestToiY) { // check if valid collision (toi is between -E_EPSILON and 1.0) and it's the earliest so far
                         earliestToiY = toiY;
                         collisionSurfaceY = blockEdgeY;
                    }
                    break; // if we found a collision in this column, we don't need to check further rows in this column *in the same direction of movement*
                }
            }
        }
        if (earliestToiY < 1.0 - E_EPSILON) { // apply Y collision - detection includes toi=0 case after step-up
            entity.y += actualMoveY * earliestToiY; // move vertically by the calculated TOI
            entity.y = (signY > 0) ? (collisionSurfaceY - entity.height - E_EPSILON) : (collisionSurfaceY + E_EPSILON); // snap precisely to the collision surface, offset by epsilon to prevent sticking
            if (signY > 0) { // collided downwards (landed)
                isOnGround = true; // landed on something
            }
            entity.vy = 0; // stop vertical velocity
            collidedY = true;
        } else if (!didStepUp) { // no Y collision detected AND didn't step up, move freely vertically
            entity.y += actualMoveY; // move full potential distance // isOnGround remains false if moving downwards freely
        } else {
            // stepped up, but didn't immediately hit ground below (e.g. stepped onto edge) - isOnGround remains false until next frame or final check confirms landing
        }
    } else { // no vertical movement predicted AND no step-up, but check if already on ground from last frame - helps maintain isOnGround status even if vy is 0
        if (entity.isOnGround) { // re-verify if still on ground
            const checkDist = 1.0; // check 1 pixel below
            const yBelow = entity.y + entity.height + checkDist;
            const rowBelow = Math.floor(yBelow / Config.BLOCK_HEIGHT);
            const checkPointsX = [ // check multiple points along the bottom edge for robustness
                entity.x + E_EPSILON, // left edge inset slightly
                entity.x + entity.width * 0.5, // center
                entity.x + entity.width - E_EPSILON // right edge inset slightly
            ];
            let stillOnGround = false;
            for (const checkX of checkPointsX) {
                const col = Math.floor(checkX / Config.BLOCK_WIDTH);
                if (isSolid(col, rowBelow)) {
                        stillOnGround = true;
                        break; // found ground below
                }
            }
            isOnGround = stillOnGround;
        }
    }
    // final check confirms ground status after all movement/snapping, catches landings from horizontal slides or step-ups that didn't snap perfectly
    if (!isOnGround) { // only run this check if isOnGround wasn't set by Y collision resolution
        const checkDist = 1.0; // check 1 pixel below entity's feet
        const yBelow = entity.y + entity.height + checkDist;
        const rowBelow = Math.floor(yBelow / Config.BLOCK_HEIGHT);
        const checkPointsX = [ // check multiple points along bottom edge
            entity.x + E_EPSILON, // left edge inset slightly
            entity.x + entity.width * 0.5, // center
            entity.x + entity.width - E_EPSILON // right edge (inset slightly)
        ];
        for (const checkX of checkPointsX) {
            const col = Math.floor(checkX / Config.BLOCK_WIDTH);
            if (isSolid(col, rowBelow)) {
                const groundSurfaceY = rowBelow * Config.BLOCK_HEIGHT; // solid ground detected below
                if (Math.abs((entity.y + entity.height) - groundSurfaceY) < checkDist + E_EPSILON) { // if bottom of entity is within checkDist of ground surface, consider it on ground.

                    isOnGround = true;
                    if (entity.vy >= 0) { //snap feet precisely to ground surface if standing or falling
                        entity.y = groundSurfaceY - entity.height;
                        if (entity.vy > 0) { // ensure vertical velocity is zeroed if we snap to ground here

                            entity.vy = 0;
                        }
                        collidedY = true; // considered a Y collision if snapped
                    }
                    break; // found ground, no need to check other points
                }
            }
        }
    }
    return { collidedX, collidedY, isOnGround, didStepUp }; // return results
}