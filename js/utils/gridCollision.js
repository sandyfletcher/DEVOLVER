// -----------------------------------------------------------------------------
// root/js/utils/gridCollision.js - Handles Entity vs World Grid Collision Logic
// -----------------------------------------------------------------------------

import * as Config from '../config.js';
import * as WorldData from './worldData.js';

// Small value for floating point comparisons.
const E_EPSILON = 1e-4; // Tiny offset to prevent floating point errors / sticking

// --- Collision Helpers ---

// Checks if entity is significantly submerged, as a % from bottom edge
export function isEntityInWater(entity) {
    // Check only if entity object and its properties are valid
    if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number' ||
        typeof entity.width !== 'number' || typeof entity.height !== 'number' ||
        isNaN(entity.x) || isNaN(entity.y) || isNaN(entity.width) || isNaN(entity.height) ||
        entity.width <= 0 || entity.height <= 0) {
        // console.warn("isEntityInWater: Invalid entity data provided.", entity);
        return false;
    }

    const submersionCheckFraction = 0.50;
    // Calculate the Y coordinate to check, entity.y is top, entity.y + entity.height is bottom.
    // We check a point X% of the way down from the top.
    const checkY = entity.y + entity.height * submersionCheckFraction; // Check 50% down
    // horizontal center for X coordinate check
    const checkX = entity.x + entity.width * 0.5;
    // Convert world coordinates to grid coordinates
    const { col, row } = worldToGridCoords(checkX, checkY);
    // Check the block type at the calculated grid cell
    const blockType = WorldData.getBlockType(col, row);
    // Return true if the block at the check point is water (and not out of bounds)
    return blockType === Config.BLOCK_WATER;
}

// Checks if block at given grid coordinates is solid
export function isSolid(col, row) {
    // Check if row/col is outside valid grid range defined in Config
    if (row < 0 || row >= Config.GRID_ROWS || col < 0 || col >= Config.GRID_COLS) {
        return false; // Treat out of bounds as not solid
    }
    const block = WorldData.getBlock(col, row);
    // Check if block data is null or air
    if (block === null || block === Config.BLOCK_AIR) {
        return false;
    }
    // Check specific non-solid types (assuming block is an object now)
    if (typeof block === 'object' && block.type === Config.BLOCK_WATER) {
        return false; // Water is not solid for stopping purposes
    }
    // For now, any block object that exists and isn't air or water is considered solid.
    if (typeof block === 'object' && typeof block.type === 'number') {
        // Check if orientation is solid (e.g., not a slope that should be passable from this angle)
        // For now, all orientations are treated as solid, but this is where slope collision logic would go.
        if (block.orientation !== Config.ORIENTATION_FULL) {
             // TODO: Implement slope collision logic here
             // For now, treat all blocks as solid regardless of orientation
             return true;
        }
        return true; // It's a block object representing a solid tile with full orientation
    }
    // Fallback for unexpected data
    return false;
}


// Converts world coordinates (pixels) to grid coordinates (column, row)
export function worldToGridCoords(worldX, worldY) {
    // Ensure worldX and worldY are numbers and not NaN
    const safeWorldX = typeof worldX === 'number' && !isNaN(worldX) ? worldX : 0;
    const safeWorldY = typeof worldY === 'number' && !isNaN(worldY) ? worldY : 0;
    const col = Math.floor(safeWorldX / Config.BLOCK_WIDTH);
    const row = Math.floor(safeWorldY / Config.BLOCK_HEIGHT);
    return { col, row };
}

// Finds the Y pixel coordinate of the highest solid block surface below a given point.
// This function is currently not used in collideAndResolve but could be useful elsewhere.
/*
export function getCollisionSurfaceYBelow(col, startRow) {
     if (col < 0 || col >= Config.GRID_COLS) return Config.CANVAS_HEIGHT * 2;
     const searchStartRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, Math.floor(startRow)));
     for (let r = searchStartRow; r < Config.GRID_ROWS; r++) {
         if (isSolid(col, r)) {
             return r * Config.BLOCK_HEIGHT;
         }
     }
     return Config.CANVAS_HEIGHT * 2;
}
*/

// --- Main Collision Resolution Function ---

// Performs swept AABB collision detection and resolution against the world grid.
// Includes logic for stepping up 1-block high obstacles.
// Updates the entity's position and velocity based on collisions.
// Uses precise snapping on collision.

export function collideAndResolve(entity, potentialMoveX, potentialMoveY) {
     // Basic validation for entity object
     if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number' ||
        typeof entity.width !== 'number' || typeof entity.height !== 'number' ||
        isNaN(entity.x) || isNaN(entity.y) || isNaN(entity.width) || isNaN(entity.height) ||
        entity.width <= 0 || entity.height <= 0) {
         console.error("collideAndResolve: Invalid entity data provided. Skipping collision.", entity);
         return { collidedX: false, collidedY: false, isOnGround: false, didStepUp: false };
     }


    let moveX = potentialMoveX; // Use the passed-in movement amount
    let moveY = potentialMoveY; // Use the passed-in movement amount
    let collidedX = false;
    let collidedY = false;
    let isOnGround = false; // Assume not on ground initially for this frame check
    let didStepUp = false;

    // Determine if Step-Up is possible based on if vertical velocity isn't significantly upward (prevents jump-steps)
    // Use a small positive threshold (e.g., allowing slight upward movement or standing still/falling)
    const canAttemptStepUp = entity.vy <= Config.GRAVITY_ACCELERATION * (1 / 60) + E_EPSILON; // Allow if falling, standing, or moving up slowly

    // Store initial position for step-up check later
    const startX = entity.x;
    const startY = entity.y;


    // --- Step 1: Resolve X-axis Collision ---
    if (Math.abs(moveX) > E_EPSILON) {
        const signX = Math.sign(moveX);
        const xEdge = (signX > 0) ? entity.x + entity.width : entity.x; // Leading edge of entity
        let earliestToiX = 1.0; // Time of impact (0 to 1)
        let collisionSurfaceX = 0;
        let stepUpCandidateCol = -1;
        let stepUpCandidateRow = -1;
        // Calculate row span of the entity's current position
        const yStart = entity.y;
        const yEnd = entity.y + entity.height;
        const minRow = Math.max(0, Math.floor(yStart / Config.BLOCK_HEIGHT));
        const maxRow = Math.min(Config.GRID_ROWS - 1, Math.floor((yEnd - E_EPSILON) / Config.BLOCK_HEIGHT)); // Use epsilon for bottom edge

        // Calculate column check range and direction for the sweep
        const targetXEdge = xEdge + moveX;
        const startColCheck = Math.floor(xEdge / Config.BLOCK_WIDTH);
        const endColCheck = Math.floor((targetXEdge + (signX > 0 ? E_EPSILON : -E_EPSILON)) / Config.BLOCK_WIDTH);

        // Find the earliest X collision across the entity's vertical span
        for (let r = minRow; r <= maxRow; r++) {
             // Determine column check range and direction for this row - only check cells the entity is moving *into*
            const checkStart = (signX > 0) ? Math.max(0, startColCheck) : Math.min(Config.GRID_COLS - 1, startColCheck);
            const checkEnd = (signX > 0) ? Math.min(Config.GRID_COLS - 1, endColCheck) : Math.max(0, endColCheck);
            const step = (signX > 0) ? 1 : -1;

            // Adjust the check range slightly to include the *next* cell if we start exactly at an edge
            const actualCheckStart = (signX > 0) ? Math.max(0, Math.floor((xEdge + E_EPSILON) / Config.BLOCK_WIDTH)) : Math.min(Config.GRID_COLS - 1, Math.floor((xEdge - E_EPSILON) / Config.BLOCK_WIDTH));
            const actualCheckEnd = (signX > 0) ? Math.min(Config.GRID_COLS - 1, Math.floor((targetXEdge + E_EPSILON) / Config.BLOCK_WIDTH)) : Math.max(0, Math.floor((targetXEdge - E_EPSILON) / Config.BLOCK_WIDTH));


            for (let c = actualCheckStart; (signX > 0 ? c <= actualCheckEnd : c >= actualCheckEnd); c += step) {
                 if (c < 0 || c >= Config.GRID_COLS) continue; // Ensure cell is within bounds

                if (isSolid(c, r)) {
                    // Found a potential solid block
                    const blockEdgeX = (signX > 0) ? c * Config.BLOCK_WIDTH : (c + 1) * Config.BLOCK_WIDTH; // The edge of the block being hit

                    // --- Correct TOI Calculation ---
                    // Time of Impact = (Distance to Collision Plane) / (Velocity towards Plane)
                    // Distance = block edge position - entity leading edge position
                    const distance = blockEdgeX - xEdge;
                    let toiX = distance / moveX;

                    // Check if valid collision (toi is between -E_EPSILON and 1.0) and it's the earliest so far
                    if (toiX >= -E_EPSILON && toiX < earliestToiX) {
                        earliestToiX = toiX;
                        collisionSurfaceX = blockEdgeX;
                         // Store candidate block coordinates for potential step-up check
                         stepUpCandidateCol = c;
                         stepUpCandidateRow = r;
                    }
                    // Optimization: If we found a collision in this row, we don't need to check further columns in this row *in the same direction of movement*.
                    // However, for step-up, we need the *earliest* collision among the blocks the player is hitting.
                    // So, don't break immediately, let the loop continue to find the overall earliest TOI across the row.
                    // But we can break from the inner column loop if we found a block, assuming the *outer* loop over rows handles finding the earliest overall.
                    // Let's keep the break for simplicity and typical platformer collision response. If multiple blocks are hit in the same row simultaneously, this finds the first one checked based on loop order.
                    break; // Break inner column loop for this row
                }
            }
        }
        // --- Check for Step-Up Condition AFTER finding the earliest collision ---
        let performStepUp = false;
        // Conditions for step-up:
        // 1. A valid X collision was detected (earliestToiX < 1.0)
        // 2. The entity is capable of attempting a step-up (canAttemptStepUp)
        // 3. The collision occurred near the *bottom* of the entity (within 1 block height from feet, roughly)
        // 4. The space *above* the colliding block is clear for the entity to move into
        if (earliestToiX < 1.0 - E_EPSILON && canAttemptStepUp && stepUpCandidateCol !== -1) {
            const entityBottomY = entity.y + entity.height;
            const blockTopY = stepUpCandidateRow * Config.BLOCK_HEIGHT;
            // Check if the colliding block's top is close to the entity's feet (e.g., within entity's height)
            // This roughly means the obstacle is no taller than the entity's leg/body part.
            const collisionIsLowOnEntity = (blockTopY >= entity.y && blockTopY < entityBottomY + Config.BLOCK_HEIGHT); // Within entity height + 1 block tolerance
            const obstacleHeight = Math.max(0, entityBottomY - blockTopY); // How tall is the obstacle segment hit?
            const maxStepHeight = Config.BLOCK_HEIGHT + E_EPSILON; // Allow stepping up ~1 block height

            if (collisionIsLowOnEntity && obstacleHeight <= maxStepHeight) {
                 // Now check if the space directly above the obstacle, in the column being moved into, is clear for the entity's full height
                 const targetCol = stepUpCandidateCol;
                 let isSpaceAboveClear = true;
                 const entityTopRow = Math.floor(entity.y / Config.BLOCK_HEIGHT);
                 // Check rows from entity's top down to the row *just above* the obstacle
                 for (let r = entityTopRow; r < stepUpCandidateRow; r++) {
                     if (isSolid(targetCol, r)) {
                         isSpaceAboveClear = false;
                         break;
                     }
                 }
                 // If space is clear, perform the step up
                 if (isSpaceAboveClear) {
                      performStepUp = true;
                 }
            }
        }

        // --- Apply X Collision Result / Step-Up ---
        if (performStepUp) {
            // Step Up: Move horizontally up to the collision point, then adjust Y upwards.
            // Move horizontally by the calculated TOI
            entity.x += moveX * earliestToiX;
            // Snap entity's feet to the top of the obstacle block
            entity.y = (stepUpCandidateRow * Config.BLOCK_HEIGHT) - entity.height;
            entity.vy = 0; // Zero out vertical velocity during step
            didStepUp = true; // Mark that a step up occurred
            // Note: We don't set collidedX=true or vx=0, allowing continued horizontal movement if input is held
        } else if (earliestToiX < 1.0 - E_EPSILON) {
            // Standard X Collision: Move exactly to the collision surface, stop VX
            entity.x += moveX * earliestToiX;
            // Snap precisely to the edge of the block, offset by epsilon to prevent sticking
            entity.x = (signX > 0) ? (collisionSurfaceX - entity.width - E_EPSILON) : (collisionSurfaceX + E_EPSILON);
            entity.vx = 0; // Stop horizontal velocity
            collidedX = true;
        } else {
            // No X collision: Move freely horizontally for the full potential distance
            entity.x += moveX;
        }
    }

    // --- Step 2: Resolve Y-axis Collision (Using entity's potentially new X and Y from Step 1) ---

    // Re-read moveY in case vy was zeroed by step-up
    // If stepUp occurred, the potential vertical move for THIS frame is 0,
    // but we still need to check for collisions at the new stepped-up Y position.
    // So, if didStepUp is true, moveY effectively becomes 0 for this check, but the check is immediate (toi=0).
    const actualMoveY = didStepUp ? 0 : moveY;

    if (Math.abs(actualMoveY) > E_EPSILON || didStepUp) { // Check Y if there's vertical movement OR if stepped up (to land)
        // Determine check direction. If stepped up, check downwards. Otherwise use moveY's sign.
        const signY = didStepUp ? 1 : Math.sign(actualMoveY);
        const yEdge = (signY > 0) ? entity.y + entity.height : entity.y; // Leading edge of entity
        let earliestToiY = 1.0; // Time of impact (0 to 1)
        let collisionSurfaceY = 0;
        // Calculate column span of the entity at its (potentially new) X position
        const xStart = entity.x;
        const xEnd = entity.x + entity.width;
        const minCol = Math.max(0, Math.floor(xStart / Config.BLOCK_WIDTH));
        const maxCol = Math.min(Config.GRID_COLS - 1, Math.floor((xEnd - E_EPSILON) / Config.BLOCK_WIDTH)); // Use epsilon for right edge

        // Calculate row check range for the sweep based on entity's current Y and actualMoveY
        const targetYEdge = yEdge + actualMoveY;
         const startRowCheck = Math.floor(yEdge / Config.BLOCK_HEIGHT);
         const endRowCheck = Math.floor((targetYEdge + (signY > 0 ? E_EPSILON : -E_EPSILON)) / Config.BLOCK_HEIGHT);

         // Adjust the check range slightly to include the *next* cell if we start exactly at an edge
        const actualCheckStart = (signY > 0) ? Math.max(0, Math.floor((yEdge + E_EPSILON) / Config.BLOCK_HEIGHT)) : Math.min(Config.GRID_ROWS - 1, Math.floor((yEdge - E_EPSILON) / Config.BLOCK_HEIGHT));
        const actualCheckEnd = (signY > 0) ? Math.min(Config.GRID_ROWS - 1, Math.floor((targetYEdge + E_EPSILON) / Config.BLOCK_HEIGHT)) : Math.max(0, Math.floor((targetYEdge - E_EPSILON) / Config.BLOCK_HEIGHT));


        // Find the earliest Y collision across the entity's horizontal span
        for (let c = minCol; c <= maxCol; c++) {
             const checkStart = actualCheckStart;
             const checkEnd = actualCheckEnd;
             const step = (signY > 0) ? 1 : -1;

             for (let r = checkStart; (signY > 0 ? r <= checkEnd : r >= checkEnd); r += step) {
                 if (r < 0 || r >= Config.GRID_ROWS) continue; // Ensure cell is within bounds

                if (isSolid(c, r)) {
                    // Found a potential solid block
                    const blockEdgeY = (signY > 0) ? r * Config.BLOCK_HEIGHT : (r + 1) * Config.BLOCK_HEIGHT; // The edge of the block being hit

                    // --- Correct TOI Calculation ---
                    let toiY = 1.0;
                    if (Math.abs(actualMoveY) > E_EPSILON) {
                         // Time of Impact = (Distance to Collision Plane) / (Velocity towards Plane)
                         // Distance = block edge position - entity leading edge position
                         const distance = blockEdgeY - yEdge;
                         toiY = distance / actualMoveY;
                    } else if (didStepUp) {
                         // If stepped up, this collision is immediate if the block edge is in the right direction relative to entity edge
                         // (i.e., block top is below entity bottom, or block bottom is above entity top)
                         if ((signY > 0 && blockEdgeY >= yEdge - E_EPSILON) || (signY < 0 && blockEdgeY <= yEdge + E_EPSILON)) {
                             toiY = 0; // Immediate collision
                         } else {
                             continue; // Collision is not in the direction of the check after step-up
                         }
                    }

                    // Check if valid collision (toi is between -E_EPSILON and 1.0) and it's the earliest so far
                    // If stepUp, we specifically allow toiY = 0
                    if (toiY >= -E_EPSILON && toiY < earliestToiY) {
                         earliestToiY = toiY;
                         collisionSurfaceY = blockEdgeY;
                    }
                     // Optimization: If we found a collision in this column, we don't need to check further rows in this column *in the same direction of movement*.
                     break; // Break inner row loop for this column
                }
            }
        }

        // --- Apply Y Collision Result ---
        if (earliestToiY < 1.0 - E_EPSILON) { // Collision detected (includes toi=0 case after step-up)
            // Move vertically by the calculated TOI
            entity.y += actualMoveY * earliestToiY;

            // Snap precisely to the collision surface, offset by epsilon to prevent sticking
            entity.y = (signY > 0) ? (collisionSurfaceY - entity.height - E_EPSILON) : (collisionSurfaceY + E_EPSILON);

            if (signY > 0) { // Collided downwards (landed)
                isOnGround = true; // Landed on something
            }
            entity.vy = 0; // Stop vertical velocity
            collidedY = true;
        } else if (!didStepUp) {
            // No Y collision detected AND didn't step up, move freely vertically
            entity.y += actualMoveY; // Move full potential distance
            // isOnGround remains false if moving downwards freely
        } else {
             // Stepped up, but didn't immediately hit ground below (e.g. stepped onto edge)
             // isOnGround remains false until next frame or final check confirms landing
        }
    } else {
         // No vertical movement predicted AND no step-up, but check if already on ground from last frame
         // This helps maintain isOnGround status even if vy is 0
          if (entity.isOnGround) {
              // Re-verify if still on ground
              const checkDist = 1.0; // Check 1 pixel below
              const yBelow = entity.y + entity.height + checkDist;
              const rowBelow = Math.floor(yBelow / Config.BLOCK_HEIGHT);
              // Check multiple points along the bottom edge for robustness
              const checkPointsX = [
                  entity.x + E_EPSILON,                // Left edge (inset slightly)
                  entity.x + entity.width * 0.5,       // Center
                  entity.x + entity.width - E_EPSILON  // Right edge (inset slightly)
              ];
               let stillOnGround = false;
               for (const checkX of checkPointsX) {
                   const col = Math.floor(checkX / Config.BLOCK_WIDTH);
                   if (isSolid(col, rowBelow)) {
                        stillOnGround = true;
                        break; // Found ground below
                   }
               }
               isOnGround = stillOnGround;
          }
    }


    // --- Final Check (Confirms ground status after all movement/snapping, catches landings from horizontal slides or step-ups that didn't snap perfectly) ---
    // This check is less critical now that Y collision handles landing, but can be a fallback.
    // It's also needed to set isOnGround correctly if entity is just standing still.
    if (!isOnGround) { // Only run this check if isOnGround wasn't set by the Y collision resolution
        const checkDist = 1.0; // Check 1 pixel below the entity's feet
        const yBelow = entity.y + entity.height + checkDist;
        const rowBelow = Math.floor(yBelow / Config.BLOCK_HEIGHT);
        // Check multiple points along the bottom edge for robustness
        const checkPointsX = [
            entity.x + E_EPSILON,                // Left edge (inset slightly)
            entity.x + entity.width * 0.5,       // Center
            entity.x + entity.width - E_EPSILON  // Right edge (inset slightly)
        ];

        for (const checkX of checkPointsX) {
            const col = Math.floor(checkX / Config.BLOCK_WIDTH);
            if (isSolid(col, rowBelow)) {
                // Solid ground detected below. Check if entity is *very close* to it.
                const groundSurfaceY = rowBelow * Config.BLOCK_HEIGHT;
                // Use a slightly larger tolerance than E_EPSILON for snapping check
                // If bottom of entity is within checkDist of ground surface, consider it on ground.
                if (Math.abs((entity.y + entity.height) - groundSurfaceY) < checkDist + E_EPSILON) {
                    isOnGround = true;
                    // Snap feet precisely to the ground surface if close enough and not currently moving upwards
                    if (entity.vy >= 0) { // Only snap down if standing or falling
                        entity.y = groundSurfaceY - entity.height;
                         // Ensure vertical velocity is zeroed if we snap to ground here
                        if (entity.vy > 0) {
                            entity.vy = 0;
                        }
                        collidedY = true; // Considered a Y collision if snapped
                    }
                    break; // Found ground, no need to check other points
                }
            }
        }
    }


    // Return results
    return { collidedX, collidedY, isOnGround, didStepUp };
}