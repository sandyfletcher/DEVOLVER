// -----------------------------------------------------------------------------
// root/js/utils/gridCollision.js - Handles Entity vs World Grid Collision Logic
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as World from './world.js';

export const E_EPSILON = 1e-4; // tiny offset to prevent floating point errors / sticking (pixels)
export function isEntityInWater(entity) { // checks if entity is significantly submerged, as a % from bottom edge
    if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number' || // check only if entity object and properties are valid
        typeof entity.width !== 'number' || typeof entity.height !== 'number' ||
        isNaN(entity.x) || isNaN(entity.y) || isNaN(entity.width) || isNaN(entity.height) ||
        entity.width <= 0 || entity.height <= 0) {
        console.warn("isEntityInWater: Invalid entity data provided.", entity);
        return false;
    }
    const submersionCheckFraction = 0.50; // calculate the Y coordinate to check, entity.y is top, entity.y + entity.height is bottom.
    const checkY = entity.y + entity.height * submersionCheckFraction; // we check a point X% of the way down from the top. // Check 50% down (pixel Y)
    const checkX = entity.x + entity.width * 0.5; // horizontal center for X coordinate check (pixel X)
    const { col, row } = worldToGridCoords(checkX, checkY); // convert world coordinates (pixels) to grid coordinates (handles bounds)
    const blockType = World.getBlockType(col, row); // check the block type at the calculated grid cell
    return blockType === Config.BLOCK_WATER; // return true if the block at the check point is water (and not out of bounds)
}
export function isSolid(col, row) { // checks if block at given grid coordinates is solid
    if (row < 0 || row >= Config.GRID_ROWS || col < 0 || col >= Config.GRID_COLS) {
        return false; // Out of bounds is not solid
    }
    const block = World.getBlock(col, row); // block can be {type, isPlayerPlaced, hp, ...} or BLOCK_AIR
    if (block === null || block === Config.BLOCK_AIR) {
        return false;
    }
    if (typeof block === 'object') { // It's a block data object
        // These types are never solid for movement/physics
        if (block.type === Config.BLOCK_WATER ||
            block.type === Config.BLOCK_ROPE ||
            block.type === Config.BLOCK_VEGETATION) { // MODIFIED: VEGETATION is not solid
            return false;
        }
        // For WOOD, check if it's player-placed
        if (block.type === Config.BLOCK_WOOD) {
            if (block.isPlayerPlaced === true) {
                return true; // Player-placed wood IS solid
            } else {
                return false; // MODIFIED: Natural wood (trees) is NOT solid for physics
            }
        }
        // If it's any other known block type object (DIRT, STONE, METAL, BONE), it's solid.
        // This assumes all other block types in Config.BLOCK_HP etc. are meant to be solid if not listed above.
        // We check `typeof block.type === 'number'` because all valid block types (even AIR which is 0) are numbers.
        if (typeof block.type === 'number') {
             // We've already handled AIR, WATER, ROPE, VEGETATION, and conditional WOOD.
             // Any other numeric type remaining (e.g., DIRT, STONE, METAL, BONE) is considered solid.
            return true;
        }
    }
    // Fallback for any unexpected data or old numeric representations (should be rare with createBlock)
    if (typeof block === 'number' && block !== Config.BLOCK_AIR) {
        // This case implies block is a number like BLOCK_DIRT (3) directly, not an object.
        // And it's not BLOCK_AIR (0).
        // Based on the logic above, if it were VEGETATION (4) or WOOD (6) as numbers,
        // they wouldn't be caught by the object checks.
        // So, we need to explicitly make numeric VEGETATION and WOOD non-solid here too for consistency if such data existed.
        // However, with createBlock, numeric blocks other than AIR shouldn't really exist.
        // For safety, let's ensure numeric VEGETATION/WOOD are also non-solid if they somehow appear.
        if (block === Config.BLOCK_VEGETATION || block === Config.BLOCK_WOOD) {
            // This path is less likely due to createBlock, but handles old data representations.
            // For WOOD, this would make ALL wood non-solid if it's just a number.
            // The isPlayerPlaced check is only possible if it's an object.
            // To be safe and simple, if WOOD is just a number, assume it's natural/pass-through.
            return false;
        }
        // If it's a number, not AIR, and not numeric VEGETATION/WOOD, treat as solid (e.g. numeric DIRT/STONE).
        // console.warn(`isSolid encountered unhandled numeric block type: ${block} at [${col},${row}]. Treating as solid if not VEG/WOOD.`);
        return true;
    }
    return false; // Default to not solid if type is unknown or doesn't fit rules
}
export function isRope(col, row) {
    if (row < 0 || row >= Config.GRID_ROWS || col < 0 || col >= Config.GRID_COLS) {
        return false;
    }
    return World.getBlockType(col, row) === Config.BLOCK_ROPE;
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
    const col = Math.floor(safeWorldX / Config.BLOCK_WIDTH); // Use scaled BLOCK_WIDTH
    const row = Math.floor(safeWorldY / Config.BLOCK_HEIGHT); // Use scaled BLOCK_HEIGHT
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
    let moveX = potentialMoveX; // use the passed-in movement amounts (in pixels)
    let moveY = potentialMoveY; // use the passed-in movement amounts (in pixels)
    let collidedX = false;
    let collidedY = false;
    let isOnGround = false; // assume not on ground initially
    let didStepUp = false;
    let stepTier = 0; // need a flag to modify VX - 0: no step, 1: effortless step, 2: slowed step
    // Determine if stepup is possible based on vertical velocity (GRAVITY_ACCELERATION is scaled pixels/sec^2)
    const canAttemptStepUp = entity.vy <= Config.GRAVITY_ACCELERATION * (1 / 60) + E_EPSILON;
    if (Math.abs(moveX) > E_EPSILON) { // step 1: resolve x-axis collision
        const signX = Math.sign(moveX);
        const xEdge = (signX > 0) ? entity.x + entity.width : entity.x; // entity's leading edge (pixel X)
        let earliestToiX = 1.0; // Time of Impact (0 to 1)
        let collisionSurfaceX = 0; // Pixel X coordinate of the solid block edge collided with
        let stepUpCandidateCol = -1;
        let stepUpCandidateRow = -1;
        // Calculate row span of the entity's current position (using scaled BLOCK_HEIGHT)
        const yStart = entity.y;
        const yEnd = entity.y + entity.height;
        const minRow = Math.max(0, Math.floor(yStart / Config.BLOCK_HEIGHT));
        const maxRow = Math.min(Config.GRID_ROWS - 1, Math.floor((yEnd - E_EPSILON) / Config.BLOCK_HEIGHT));
        // Calculate column check range and direction for the sweep (using scaled BLOCK_WIDTH)
        const targetXEdge = xEdge + moveX;
        const actualCheckStart = (signX > 0) ? Math.max(0, Math.floor((xEdge + E_EPSILON) / Config.BLOCK_WIDTH)) : Math.min(Config.GRID_COLS - 1, Math.floor((xEdge - E_EPSILON) / Config.BLOCK_WIDTH));
        const actualCheckEnd = (signX > 0) ? Math.min(Config.GRID_COLS - 1, Math.floor((targetXEdge + E_EPSILON) / Config.BLOCK_WIDTH)) : Math.max(0, Math.floor((targetXEdge - E_EPSILON) / Config.BLOCK_WIDTH));
        // Find the earliest X collision across entity's vertical span
        const step = (signX > 0) ? 1 : -1;
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = actualCheckStart; (signX > 0 ? c <= actualCheckEnd : c >= actualCheckEnd); c += step) {
                if (c < 0 || c >= Config.GRID_COLS) continue;
                if (isSolid(c, r)) { // isSolid uses grid coordinates (This will now correctly identify which blocks are solid for movement)
                    const blockEdgeX = (signX > 0) ? c * Config.BLOCK_WIDTH : (c + 1) * Config.BLOCK_WIDTH; // Pixel X of block edge (using scaled BLOCK_WIDTH)
                    const distance = blockEdgeX - xEdge; // Distance in pixels
                    let toiX = 1.0;
                    if (Math.abs(moveX) > E_EPSILON) { // Avoid division by zero if moveX is tiny
                        toiX = distance / moveX; // Time of impact (0 to 1)
                    } else {
                        // If moveX is tiny but there's a collision, it's an immediate collision (toi=0)
                        // This case should theoretically be caught by the initial if(Math.abs(moveX) > E_EPSILON) but as a safeguard:
                        if ((signX > 0 && blockEdgeX >= xEdge - E_EPSILON) || (signX < 0 && blockEdgeX <= xEdge + E_EPSILON)) {
                            toiX = 0;
                        } else {
                            continue; // Block is behind entity, not a collision
                        }
                    }
                    if (toiX >= -E_EPSILON && toiX < earliestToiX) {
                        earliestToiX = toiX;
                        collisionSurfaceX = blockEdgeX; // pixel X of collision surface
                        stepUpCandidateCol = c;
                        stepUpCandidateRow = r;
                    }
                    break; // break inner loop once solid block is found in row in the direction of motion
                }
            }
        }
        let performStepUp = false; // determine step-up outcome AFTER finding the earliest collision
        stepTier = 0; // reset tier
        // Check if a step-up is possible (collision detected, entity not falling too fast, and step height/space above is clear)
        if (earliestToiX < 1.0 - E_EPSILON && canAttemptStepUp && stepUpCandidateCol !== -1) {
            const blockTopY = stepUpCandidateRow * Config.BLOCK_HEIGHT; // Pixel Y of block top (using scaled BLOCK_HEIGHT)
            const entityBottomY = entity.y + entity.height; // Pixel Y of entity bottom (entity.height is scaled)
            const obstaclePixelHeight = entityBottomY - blockTopY; // Calculate height difference (in pixels) - height entity would need to step *onto*
            // Check if obstacle height is within the configured factors of entity height (which is scaled)
            const isStepPossibleHeightwise = obstaclePixelHeight > -E_EPSILON && obstaclePixelHeight <= entity.height * Config.ENTITY_STEP_TIER2_MAX_HEIGHT_FACTOR;
            let isSpaceAboveClear = true; // check if space directly above obstacle is clear for entity's full height (using scaled BLOCK_HEIGHT)
            const entityTopRow = Math.floor(entity.y / Config.BLOCK_HEIGHT); // Row of entity's top (using scaled BLOCK_HEIGHT)
            // Check rows from entity's top down to row just above obstacle
            for (let r = entityTopRow; r < stepUpCandidateRow; r++) {
                // Ensure cell is within bounds before checking solid status
                if (r < 0 || r >= Config.GRID_ROWS || stepUpCandidateCol < 0 || stepUpCandidateCol >= Config.GRID_COLS) {
                    isSpaceAboveClear = false; // treat out of bounds as blockage
                    break;
                }
                if (isSolid(stepUpCandidateCol, r)) { // isSolid uses grid coordinates
                    isSpaceAboveClear = false;
                    break;
                }
            }
            if (isStepPossibleHeightwise && isSpaceAboveClear) {
                performStepUp = true; // step-up becomes possible
                // Determine step tier based on obstacle height relative to entity height (which is scaled)
                if (obstaclePixelHeight <= entity.height * Config.ENTITY_STEP_TIER1_MAX_HEIGHT_FACTOR) {
                    stepTier = 1; // effortless
                } else {
                    stepTier = 2; // slowed
                }
            }
        }
        if (performStepUp) {
            entity.x += moveX * earliestToiX; // move horizontally by the TOI amount (in pixels)
            entity.y = (stepUpCandidateRow * Config.BLOCK_HEIGHT) - entity.height; // snap entity's bottom to the top of the obstacle block (using scaled BLOCK_HEIGHT and entity.height)
            entity.vy = 0; // zero out vertical velocity during step-up
            didStepUp = true; // mark that a step up occurred
            if (stepTier === 2) { // apply horizontal velocity modification based on tier (factor is fixed)
                entity.vx *= Config.ENTITY_STEP_TIER2_HORIZONTAL_FRICTION;
            }
            // do NOT set collidedX = true here, horizontal movement might continue next frame
        } else if (earliestToiX < 1.0 - E_EPSILON) { // apply X collision result if step-up not possible
            // standard X collision (obstacle too high or space above blocked): move entity exactly to the collision surface by the TOI amount
            entity.x += moveX * earliestToiX; // Move by pixel amount
            // snap precisely to the edge of the block, offset by epsilon (pixels) to prevent sticking
            entity.x = (signX > 0) ? (collisionSurfaceX - entity.width - E_EPSILON) : (collisionSurfaceX + E_EPSILON);
            entity.vx = 0; // stop horizontal velocity
            collidedX = true; // mark that X collision occurred
        } else {
            entity.x += moveX; // no X collision: move freely horizontally for the full potential distance (in pixels)
        }
    }
    // Resolve Y-axis collision using entity's new X and Y in case vy was zeroed by step-up
    const actualMoveY = didStepUp ? 0 : moveY; // If stepped up, vertical movement is handled, don't apply moveY again
    if (Math.abs(actualMoveY) > E_EPSILON || didStepUp) { // check Y if there's vertical movement OR stepped up (need to check for landing after step)
        const signY = didStepUp ? 1 : Math.sign(actualMoveY); // determine check direction. If stepped up, check downwards. Otherwise use moveY's sign.
        const yEdge = (signY > 0) ? entity.y + entity.height : entity.y; // entity's leading edge (pixel Y)
        let earliestToiY = 1.0; // time of impact (0 to 1)
        let collisionSurfaceY = 0; // Pixel Y coordinate of the solid block edge collided with
        // Calculate column span of the entity at its (potentially new) X position (using scaled BLOCK_WIDTH)
        const xStart = entity.x;
        const xEnd = entity.x + entity.width;
        const minCol = Math.max(0, Math.floor(xStart / Config.BLOCK_WIDTH));
        const maxCol = Math.min(Config.GRID_COLS - 1, Math.floor((xEnd - E_EPSILON) / Config.BLOCK_WIDTH)); // use epsilon for right edge
        // Calculate row check range for the sweep based on entity's current Y and actualMoveY (using scaled BLOCK_HEIGHT)
        // Adjust the check range slightly to include the *next* cell if we start exactly at an edge
        const actualCheckStart = (signY > 0) ? Math.max(0, Math.floor((yEdge + E_EPSILON) / Config.BLOCK_HEIGHT)) : Math.min(Config.GRID_ROWS - 1, Math.floor((yEdge - E_EPSILON) / Config.BLOCK_HEIGHT));
        const actualCheckEnd = (signY > 0) ? Math.min(Config.GRID_ROWS - 1, Math.floor((yEdge + actualMoveY + E_EPSILON) / Config.BLOCK_HEIGHT)) : Math.max(0, Math.floor((yEdge + actualMoveY - E_EPSILON) / Config.BLOCK_HEIGHT));
        // Find the earliest Y collision across the entity's horizontal span
        const step = (signY > 0) ? 1 : -1;
        for (let c = minCol; c <= maxCol; c++) {
            const checkStart = actualCheckStart;
            const checkEnd = actualCheckEnd;
            for (let r = checkStart; (signY > 0 ? r <= checkEnd : r >= checkEnd); r += step) {
                if (r < 0 || r >= Config.GRID_ROWS) continue; // ensure cell is within bounds
                if (isSolid(c, r)) { // isSolid uses grid coordinates
                    const blockEdgeY = (signY > 0) ? r * Config.BLOCK_HEIGHT : (r + 1) * Config.BLOCK_HEIGHT; // pixel Y of block edge (using scaled BLOCK_HEIGHT)
                    let toiY = 1.0; // Time of Impact (0 to 1)
                    if (Math.abs(actualMoveY) > E_EPSILON) { // If there was vertical movement
                        const distance = blockEdgeY - yEdge; // Distance in pixels
                        toiY = distance / actualMoveY;
                    } else if (didStepUp) { // If didn't have vertical movement but *did* step up (check for landing)
                        // If stepped up with moveY=0, collision is immediate (toi=0) if block edge is in the right direction relative to entity edge
                        if ((signY > 0 && blockEdgeY >= yEdge - E_EPSILON) || (signY < 0 && blockEdgeY <= yEdge + E_EPSILON)) {
                            toiY = 0; // immediate collision
                        } else {
                            continue; // collision is not in the direction of the check after step-up
                        }
                    } else {
                        // If no vertical movement and didn't step up, but found a solid block...
                        // This case implies a horizontal collision with a corner or ledge alignment causing the check to find a Y-collision
                        // If the block edge is exactly aligned with entity edge, toiY is 0
                        if (Math.abs(blockEdgeY - yEdge) < E_EPSILON) {
                            toiY = 0;
                        } else {
                            // Block is not aligned and entity isn't moving vertically, so no Y collision this frame
                            continue;
                        }
                    }
                    if (toiY >= -E_EPSILON && toiY < earliestToiY) { // check if valid collision (toi is between -E_EPSILON and 1.0) and it's the earliest so far
                        earliestToiY = toiY;
                        collisionSurfaceY = blockEdgeY; // pixel Y of collision surface
                    }
                    // If toiY is very close to 0 or negative due to floating point, might still be a valid collision if entity is embedded
                    // A more robust system would handle embedded collisions, but for now, check if TOI is small.
                    if (toiY < E_EPSILON) { // If toi is very small, it's an immediate or very close collision
                        earliestToiY = 0; // Treat as immediate collision
                        collisionSurfaceY = blockEdgeY; // Use this block edge
                        break; // Stop searching in this column for immediate collision
                    }

                }
            }
        }
        if (earliestToiY < 1.0 - E_EPSILON) { // apply Y collision - detection includes toi=0 case after step-up
            entity.y += actualMoveY * earliestToiY; // move vertically by the calculated TOI (in pixels)
            // snap precisely to the collision surface, offset by epsilon (pixels) to prevent sticking
            entity.y = (signY > 0) ? (collisionSurfaceY - entity.height - E_EPSILON) : (collisionSurfaceY + E_EPSILON);
            if (signY > 0) { // collided downwards (landed)
                isOnGround = true; // landed on something
            }
            entity.vy = 0; // stop vertical velocity
            collidedY = true;
        } else if (!didStepUp) { // no Y collision detected AND didn't step up, move freely vertically
            entity.y += actualMoveY; // move full potential distance (in pixels)
            // isOnGround remains false if moving downwards freely
        } else {
            // stepped up, but didn't immediately hit ground below (e.g. stepped onto edge) - isOnGround remains false until next frame or final check confirms landing
        }
    } else { // no vertical movement predicted AND no step-up, but check if already on ground from last frame - helps maintain isOnGround status even if vy is 0
        if (entity.isOnGround) { // re-verify if still on ground
            const checkDist = 1.0; // check 1 pixel below entity's feet (in pixels)
            const yBelow = entity.y + entity.height + checkDist; // Pixel Y below entity bottom
            const rowBelow = Math.floor(yBelow / Config.BLOCK_HEIGHT); // Row below entity bottom (using scaled BLOCK_HEIGHT)
            const checkPointsX = [ // check multiple points along the bottom edge for robustness (entity.width is scaled)
                entity.x + E_EPSILON, // left edge inset slightly
                entity.x + entity.width * 0.5, // center
                entity.x + entity.width - E_EPSILON // right edge inset slightly
            ];
            let stillOnGround = false;
            for (const checkX of checkPointsX) {
                const col = Math.floor(checkX / Config.BLOCK_WIDTH); // Column of check point (using scaled BLOCK_WIDTH)
                if (isSolid(col, rowBelow)) { // isSolid uses grid coordinates
                    const groundSurfaceY = rowBelow * Config.BLOCK_HEIGHT; // Pixel Y of the solid ground surface (using scaled BLOCK_HEIGHT)
                    // Check if the bottom of the entity is within the check distance of the ground surface
                    if (Math.abs((entity.y + entity.height) - groundSurfaceY) < checkDist + E_EPSILON) {
                        stillOnGround = true;
                        // If entity is embedded into the ground, snap it up
                        if ((entity.y + entity.height) > groundSurfaceY + E_EPSILON) {
                            entity.y = groundSurfaceY - entity.height;
                            entity.vy = 0; // Stop vertical velocity ifdetected ground and snapping occurred here
                            collidedY = true; // considered a Y collision if snapped
                        }
                        break; // found ground below, no need to check other points
                    }
                }
            }
            // Set the final isOnGround state based on the re-verification loop
            isOnGround = stillOnGround;
        }
    }
    return { collidedX, collidedY, isOnGround, didStepUp }; // return results
}