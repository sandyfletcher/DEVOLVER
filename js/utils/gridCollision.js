// -----------------------------------------------------------------------------
// root/js/utils/gridCollision.js - Handles Entity vs World Grid Collision Logic
// -----------------------------------------------------------------------------

import * as Config from '../config.js';
import * as WorldData from './worldData.js'; // Make sure WorldData is imported

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
        console.warn("isEntityInWater: Invalid entity data provided.", entity);
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

/**
 * Checks if a grid cell has an adjacent solid block (needed for placement support).
 * @param {number} col - The column of the cell to check around.
 * @param {number} row - The row of the cell to check around.
 * @returns {boolean} True if any adjacent cell (cardinal directions) is solid.
 */
export function hasSolidNeighbor(col, row) {
     // Ensure col and row are valid numbers
     if (typeof col !== 'number' || typeof row !== 'number' || isNaN(col) || isNaN(row)) {
         // console.warn("hasSolidNeighbor: Invalid coordinates.", col, row); // Keep console less noisy
         return false;
     }
    const neighbors = [
        { c: col, r: row - 1 }, // Above
        { c: col, r: row + 1 }, // Below
        { c: col - 1, r: row }, // Left
        { c: col + 1, r: row }  // Right
    ];

    for (const n of neighbors) {
        // Use GridCollision.isSolid which handles boundary checks and block type checks
        if (isSolid(n.c, n.r)) {
            return true; // Found a solid neighbor
        }
    }
    return false; // No solid neighbors found
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
    // We need a stepTier flag to know how to modify VX later
    let stepTier = 0; // 0: no step, 1: effortless step, 2: slowed step


    // Determine if Step-Up is possible based on if vertical velocity isn't significantly upward (prevents jump-steps)
    // Use a small positive threshold (e.g., allowing slight upward movement or standing still/falling)
    const canAttemptStepUp = entity.vy <= Config.GRAVITY_ACCELERATION * (1 / 60) + E_EPSILON; // Allow if falling, standing, or moving up slowly


    // --- Step 1: Resolve X-axis Collision ---
    if (Math.abs(moveX) > E_EPSILON) {
        const signX = Math.sign(moveX);
        const xEdge = (signX > 0) ? entity.x + entity.width : entity.x;
        let earliestToiX = 1.0;
        // collisionSurfaceX is not strictly needed with the new step-up logic, but keep for non-step-up case
        let collisionSurfaceX = 0;
        let stepUpCandidateCol = -1;
        let stepUpCandidateRow = -1;
        // Calculate row span of the entity's current position
        const yStart = entity.y;
        const yEnd = entity.y + entity.height;
        const minRow = Math.max(0, Math.floor(yStart / Config.BLOCK_HEIGHT));
        const maxRow = Math.min(Config.GRID_ROWS - 1, Math.floor((yEnd - E_EPSILON) / Config.BLOCK_HEIGHT));

        // Calculate column check range and direction for the sweep
         const targetXEdge = xEdge + moveX;
         const actualCheckStart = (signX > 0) ? Math.max(0, Math.floor((xEdge + E_EPSILON) / Config.BLOCK_WIDTH)) : Math.min(Config.GRID_COLS - 1, Math.floor((xEdge - E_EPSILON) / Config.BLOCK_WIDTH));
         const actualCheckEnd = (signX > 0) ? Math.min(Config.GRID_COLS - 1, Math.floor((targetXEdge + E_EPSILON) / Config.BLOCK_WIDTH)) : Math.max(0, Math.floor((targetXEdge - E_EPSILON) / Config.BLOCK_WIDTH));

        // Find the earliest X collision across the entity's vertical span
        for (let r = minRow; r <= maxRow; r++) {
            const step = (signX > 0) ? 1 : -1;
            for (let c = actualCheckStart; (signX > 0 ? c <= actualCheckEnd : c >= actualCheckEnd); c += step) {
                if (c < 0 || c >= Config.GRID_COLS) continue;

                if (isSolid(c, r)) {
                    const blockEdgeX = (signX > 0) ? c * Config.BLOCK_WIDTH : (c + 1) * Config.BLOCK_WIDTH;
                    const distance = blockEdgeX - xEdge;
                    let toiX = distance / moveX;

                    if (toiX >= -E_EPSILON && toiX < earliestToiX) {
                        earliestToiX = toiX;
                        collisionSurfaceX = blockEdgeX; // Still needed for non-step-up collision
                        stepUpCandidateCol = c;
                        stepUpCandidateRow = r;
                    }
                     // Optimization: Break inner loop once a solid block is found in this row in the sweep direction
                     break;
                }
            }
        }

        // --- Determine Step-Up Outcome AFTER finding the earliest collision ---
        let performStepUp = false;
        stepTier = 0; // Reset tier

        if (earliestToiX < 1.0 - E_EPSILON && canAttemptStepUp && stepUpCandidateCol !== -1) {
             const blockTopY = stepUpCandidateRow * Config.BLOCK_HEIGHT;
             const entityBottomY = entity.y + entity.height;
             // Calculate the height difference between the entity's feet and the obstacle's top
             // This is the height the entity would need to step *onto*.
             const obstaclePixelHeight = entityBottomY - blockTopY;

             // Check if the obstacle height is within the limits for stepping (up to Tier 2 max)
             const isStepPossibleHeightwise = obstaclePixelHeight > -E_EPSILON && // Ensure obstacle is not above entity's feet (allows stepping onto same level)
                                                obstaclePixelHeight <= entity.height * Config.ENTITY_STEP_TIER2_MAX_HEIGHT_FACTOR;

             // Check if the space directly above the obstacle is clear for the entity's full height
             let isSpaceAboveClear = true;
             const entityTopRow = Math.floor(entity.y / Config.BLOCK_HEIGHT);
             // Check rows from entity's top down to the row *just above* the obstacle
             for (let r = entityTopRow; r < stepUpCandidateRow; r++) {
                 // Ensure cell is within bounds before checking solid status
                  if (r < 0 || r >= Config.GRID_ROWS || stepUpCandidateCol < 0 || stepUpCandidateCol >= Config.GRID_COLS) {
                      isSpaceAboveClear = false; // Treat out of bounds as blockage
                      break;
                  }
                 if (isSolid(stepUpCandidateCol, r)) {
                     isSpaceAboveClear = false;
                     break;
                 }
             }

            // If step is possible by height AND space above is clear:
            if (isStepPossibleHeightwise && isSpaceAboveClear) {
                 performStepUp = true; // A step-up IS possible
                 // Determine the tier based on the obstacle height
                 if (obstaclePixelHeight <= entity.height * Config.ENTITY_STEP_TIER1_MAX_HEIGHT_FACTOR) {
                      stepTier = 1; // Effortless step
                 } else { // obstaclePixelHeight is between T1 max and T2 max
                      stepTier = 2; // Slowed step
                 }
             }
        }

        // --- Apply X Collision Result or Step-Up ---
        if (performStepUp) {
            // Step Up:
            // 1. Move horizontally by the TOI amount.
            entity.x += moveX * earliestToiX;
            // 2. Snap entity's bottom to the top of the obstacle block.
            entity.y = (stepUpCandidateRow * Config.BLOCK_HEIGHT) - entity.height;
            // 3. Zero out vertical velocity during step-up.
            entity.vy = 0;
            // 4. Mark that a step up occurred.
            didStepUp = true;
            // 5. Apply horizontal velocity modification based on tier.
            if (stepTier === 2) {
                 entity.vx *= Config.ENTITY_STEP_TIER2_HORIZONTAL_FRICTION;
            }
             // We do NOT set collidedX = true here, horizontal movement might continue next frame.

        } else if (earliestToiX < 1.0 - E_EPSILON) {
            // Standard X Collision (obstacle too high or space above blocked):
            // 1. Move entity exactly to the collision surface by the TOI amount.
            entity.x += moveX * earliestToiX;
            // 2. Snap precisely to the edge of the block, offset by epsilon to prevent sticking.
            entity.x = (signX > 0) ? (collisionSurfaceX - entity.width - E_EPSILON) : (collisionSurfaceX + E_EPSILON);
            // 3. Stop horizontal velocity.
            entity.vx = 0;
            // 4. Mark that X collision occurred.
            collidedX = true;
        } else {
            // No X collision: Move freely horizontally for the full potential distance.
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
    // less critical now that Y collision handles landing, but can be a fallback, also needed to set isOnGround correctly if entity is just standing still.
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