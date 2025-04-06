// -----------------------------------------------------------------------------
// js/utils/gridCollision.js - Handles Entity vs World Grid Collision Logic
// -----------------------------------------------------------------------------
console.log("utils/gridCollision.js loaded (with precise snapping)"); // Added note

// Import necessary modules
import * as Config from '../config.js';         // For block dimensions, grid size etc.
import * as WorldData from './worldData.js'; // To access world block data (getBlock)

/**
 * Checks if a block at given grid coordinates is solid for collision purposes.
 * This is the CORE logic that determines what stops movement.
 * Includes explicit boundary checks.
 * @param {number} col - Column index.
 * @param {number} row - Row index.
 * @returns {boolean} True if the block is solid, false otherwise.
 */
export function isSolid(col, row) {
    // Check if row/col is outside valid grid range defined in Config
    if (row < 0 || row >= Config.GRID_ROWS || col < 0 || col >= Config.GRID_COLS) {
        return false; // Treat out of bounds as not solid
    }

    // Delegate to WorldData to get the block (now we know row/col are within bounds)
    const block = WorldData.getBlock(col, row);

    // Check if block data is null (shouldn't happen if within bounds after init, but safety check)
    if (block === null) {
        // console.warn(`gridCollision.isSolid: getBlock returned null for in-bounds coords [${col}, ${row}]`);
        return false;
    }

    // Check if it's an air block
    if (block === Config.BLOCK_AIR) {
        return false;
    }

    // Check specific non-solid types (assuming block is an object now)
    // Ensure block has a 'type' property before accessing it
    if (typeof block === 'object' && block.type === Config.BLOCK_WATER /* && block.orientation === Config.ORIENTATION_FULL */ ) {
        // TODO: Water physics might require separate handling (e.g., buoyancy, slower movement)
        // For basic collision, treat it as non-solid for stopping movement.
        return false; // Water is not solid for stopping purposes
    }

    // TODO: Implement slope-aware collision checks based on block.orientation
    // This is where you'd add logic like: if (block.orientation === SLOPE_TL) { calculate height at specific x within block... }
    // For now, any block object that exists and isn't air or water is considered solid
    // regardless of orientation. This collides with the block's bounding box.
    // Check if it's a valid block object (has type) before assuming solid
    if (typeof block === 'object' && typeof block.type === 'number') {
        return true; // It's a block object representing a solid tile
    }

    // Fallback: if it's not air, not water, not null, but also not a valid block object, treat as non-solid? Or warn?
    // console.warn(`gridCollision.isSolid: Encountered unexpected block data at [${col}, ${row}]:`, block);
    return false; // Default to non-solid if data format is unexpected
}

/**
 * Converts world coordinates (pixels) to grid coordinates (column, row).
 * Utility function often needed alongside collision checks.
 * @param {number} worldX - X position in pixels.
 * @param {number} worldY - Y position in pixels.
 * @returns {{col: number, row: number}} Object containing column and row indices.
 */
export function worldToGridCoords(worldX, worldY) {
    const col = Math.floor(worldX / Config.BLOCK_WIDTH);
    const row = Math.floor(worldY / Config.BLOCK_HEIGHT);
    return { col, row };
}

/**
 * Finds the Y pixel coordinate of the highest solid block surface below a given point in a column.
 * Useful for initial placement or checking fall distances.
 * (Optional - keep if useful, depends on isSolid)
 * @param {number} col - Column index.
 * @param {number} startRow - Row index to start searching downwards from.
 * @returns {number} The Y pixel coordinate of the top surface, or a large value if no solid ground below.
 */
export function getCollisionSurfaceYBelow(col, startRow) {
    if (col < 0 || col >= Config.GRID_COLS) return Config.CANVAS_HEIGHT * 2; // Out of bounds below view

    // Ensure startRow is within reasonable bounds
    const searchStartRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, Math.floor(startRow)));

    for (let r = searchStartRow; r < Config.GRID_ROWS; r++) {
        if (isSolid(col, r)) {
            return r * Config.BLOCK_HEIGHT; // Return top edge of the first solid block found
        }
    }
    return Config.CANVAS_HEIGHT * 2; // No solid block found below
}


/**
 * Performs swept AABB collision detection and resolution against the world grid.
 * Includes logic for stepping up 1-block high obstacles.
 * Updates the entity's position and velocity based on collisions.
 * Assumes entity velocity (vx, vy) is in pixels per frame.
 * MODIFIED: Uses more precise snapping on collision.
 * @param {object} entity - The entity object (must have x, y, width, height, vx, vy).
 * @returns {{collidedX: boolean, collidedY: boolean, isOnGround: boolean, didStepUp: boolean}} Collision results.
 */
export function collideAndResolve(entity) {
    let moveX = entity.vx;
    let moveY = entity.vy;
    let collidedX = false;
    let collidedY = false;
    let isOnGround = false;
    let didStepUp = false;

    // Small value for floating point comparisons and preventing sticking. Can be tuned.
    // Smaller values increase precision but risk missing collisions if movement is very large per frame.
    const E_EPSILON = 1e-4;

    // Determine if Step-Up is possible based on state
    // Allow step-up only if not moving upwards fast (prevents jump-steps)
    const canAttemptStepUp = entity.vy >= -Config.GRAVITY * 2; // Allow if falling or moving up slowly/level

    // --- Step 1: Resolve X-axis Collision ---
    let earliestToiX = 1.0;       // Time of impact (0 to 1)
    let collisionSurfaceX = 0;    // Store the X coordinate of the surface we hit
    let stepUpCandidateCol = -1;
    let stepUpCandidateRow = -1;

    if (Math.abs(moveX) > E_EPSILON) {
        const signX = Math.sign(moveX);
        const xEdge = (signX > 0) ? entity.x + entity.width : entity.x; // Leading edge in X direction
        const targetXEdge = xEdge + moveX; // Where the leading edge would end up without collision

        // Calculate row span of the entity
        const yStart = entity.y;
        const yEnd = entity.y + entity.height;
        const minRow = Math.max(0, Math.floor(yStart / Config.BLOCK_HEIGHT));
        // Subtract epsilon when calculating maxRow to handle cases where entity bottom is exactly on a grid line
        const maxRow = Math.min(Config.GRID_ROWS - 1, Math.floor((yEnd - E_EPSILON) / Config.BLOCK_HEIGHT));

        // Calculate column span for the sweep check
        const startCol = Math.floor(xEdge / Config.BLOCK_WIDTH);
        // Add small epsilon to target edge when flooring to ensure check includes target column itself
        const endCol = Math.floor((targetXEdge + (signX > 0 ? E_EPSILON : -E_EPSILON)) / Config.BLOCK_WIDTH);

        // Find the earliest X collision across the entity's vertical span
        for (let r = minRow; r <= maxRow; r++) {
            // Determine column check range and direction for this row
            // Start check from the column adjacent to the current one in the direction of movement
            const colCheckStart = (signX > 0) ? Math.max(0, startCol + 1) : Math.min(Config.GRID_COLS - 1, startCol);
            const colCheckEnd = (signX > 0) ? Math.min(Config.GRID_COLS - 1, endCol) : Math.max(0, endCol);
            const step = (signX > 0) ? 1 : -1;

            // Scan columns towards the target end column
            for (let c = colCheckStart; (signX > 0 ? c <= colCheckEnd : c >= colCheckEnd); c += step) {
                if (isSolid(c, r)) {
                    // Calculate X coordinate of the block edge we might hit
                    const blockEdgeX = (signX > 0) ? c * Config.BLOCK_WIDTH : (c + 1) * Config.BLOCK_WIDTH;
                    // Calculate time of impact (fraction of movement)
                    const toiX = (blockEdgeX - xEdge) / moveX;

                    // Check if collision is valid (forward in time) and earlier than others found so far
                    if (toiX >= -E_EPSILON && toiX < earliestToiX) {
                        earliestToiX = toiX; // Store the earliest TOI
                        collisionSurfaceX = blockEdgeX; // Store the X coordinate of the surface hit
                        // Store the block coordinates that caused this potential collision for step-up check
                        stepUpCandidateCol = c;
                        stepUpCandidateRow = r;
                    }
                    // Optimization: Once a solid block is hit in the path for this row,
                    // no need to check further columns in this row in the direction of movement.
                    if (signX > 0 ? c >= endCol : c <= endCol) break;
                }
            }
        } // End X-collision detection loop

        // --- Check for Step-Up Condition *if* a potential collision was found ---
        if (earliestToiX < 1.0 - E_EPSILON && canAttemptStepUp && stepUpCandidateCol !== -1) {
            // Calculate entity height in blocks for head clearance check
            const entityHeightInBlocks = Math.ceil(entity.height / Config.BLOCK_HEIGHT);

            // Condition 1: Is the collision *only* with the block at the entity's feet level?
            const isObstacleAtFeet = (stepUpCandidateRow === maxRow);

            // Condition 2: Is the space directly above the obstacle clear?
            const isSpaceAboveObstacleClear = !isSolid(stepUpCandidateCol, stepUpCandidateRow - 1);

            // Condition 3: Is there head clearance above the *target* step position?
            // Check block(s) where the entity's head would be after stepping up.
            const headClearanceRow = stepUpCandidateRow - entityHeightInBlocks;
            const isHeadClearanceAvailable = !isSolid(stepUpCandidateCol, headClearanceRow);

            // *** Perform Step-Up? ***
            if (isObstacleAtFeet && isSpaceAboveObstacleClear && isHeadClearanceAvailable) {
                // YES, Step Up!
                didStepUp = true;
                // Allow intended horizontal movement up to the point of collision
                entity.x += moveX * earliestToiX;

                // Adjust Y position vertically to place feet EXACTLY on top of the step
                entity.y = (stepUpCandidateRow * Config.BLOCK_HEIGHT) - entity.height;
                entity.vy = 0; // Crucial: Stop vertical velocity during the step

                collidedX = false; // This wasn't a wall collision that stopped movement
                // Do not zero vx, allow movement to continue if input is held
            } else {
                // *** Standard X Collision Response (NO Step Up) ***
                // Move EXACTLY to the collision surface, plus epsilon to prevent sticking
                entity.x = (signX > 0) ? (collisionSurfaceX - entity.width - E_EPSILON) : (collisionSurfaceX + E_EPSILON);
                entity.vx = 0; // Stop horizontal movement
                collidedX = true;
            }
        } else {
            // No collision detected OR step-up conditions not met & no collision, move freely horizontally
            entity.x += moveX * earliestToiX; // Move potentially full distance if earliestToiX remained 1.0
            collidedX = false;
        }

    } // End X-axis check

    // --- Step 2: Resolve Y-axis Collision ---
    // *** Important: Use the entity's potentially updated X and Y from Step 1 ***
    // If a step-up occurred, entity.y was adjusted and vy was zeroed.
    moveY = entity.vy; // Re-read vy in case it was zeroed by step-up
    let earliestToiY = 1.0;
    let collisionSurfaceY = 0; // Store the Y coordinate of the surface we hit

    // Check Y if moving vertically OR if just stepped up (to confirm landing)
    if (Math.abs(moveY) > E_EPSILON || didStepUp) {
        const signY = Math.sign(moveY);
        // If stepped up, treat the effective direction as downwards to check for ground immediately below
        const effectiveSignY = (didStepUp && moveY === 0) ? 1 : signY;

        // Calculate column span of the entity at its (potentially new) X position
        const xStart = entity.x;
        const xEnd = entity.x + entity.width;
        const minCol = Math.max(0, Math.floor(xStart / Config.BLOCK_WIDTH));
        // Subtract epsilon for maxCol calculation
        const maxCol = Math.min(Config.GRID_COLS - 1, Math.floor((xEnd - E_EPSILON) / Config.BLOCK_WIDTH));

        // Determine leading edge and target edge in Y direction
        const yEdge = (effectiveSignY > 0) ? entity.y + entity.height : entity.y;
        // Add a tiny bit in the direction of movement for target edge calculation if stepped up, to ensure check below happens
        const targetYEdge = yEdge + (didStepUp ? E_EPSILON : moveY);

        // Calculate row span for the sweep check
        const startRow = Math.floor(yEdge / Config.BLOCK_HEIGHT);
        // Add small epsilon to target edge when flooring to ensure check includes target row itself
        const endRow = Math.floor((targetYEdge + (effectiveSignY > 0 ? E_EPSILON : -E_EPSILON)) / Config.BLOCK_HEIGHT);

        // Find the earliest Y collision across the entity's horizontal span
        for (let c = minCol; c <= maxCol; c++) {
            // Determine row check range and direction for this column
            // Start check from the row adjacent to the current one in the direction of movement
            const rowCheckStart = (effectiveSignY > 0) ? Math.max(0, startRow + 1) : Math.min(Config.GRID_ROWS - 1, startRow);
            const rowCheckEnd = (effectiveSignY > 0) ? Math.min(Config.GRID_ROWS - 1, endRow) : Math.max(0, endRow);
            const step = (effectiveSignY > 0) ? 1 : -1;

            for (let r = rowCheckStart; (effectiveSignY > 0 ? r <= rowCheckEnd : r >= rowCheckEnd); r += step) {
                if (isSolid(c, r)) {
                    const blockEdgeY = (effectiveSignY > 0) ? r * Config.BLOCK_HEIGHT : (r + 1) * Config.BLOCK_HEIGHT;
                    // Calculate TOI only if actually moving vertically to avoid division by zero
                    let toiY = 1.0;
                    if (Math.abs(moveY) > E_EPSILON) {
                         toiY = (blockEdgeY - yEdge) / moveY;
                    } else if (didStepUp && effectiveSignY > 0 && blockEdgeY >= yEdge) {
                         // If stepped up and checking below, treat TOI as 0 if immediately colliding or slightly overlapping
                         toiY = 0;
                    }

                    if (toiY >= -E_EPSILON && toiY < earliestToiY) {
                        earliestToiY = toiY;
                        collisionSurfaceY = blockEdgeY; // Store surface Y
                    }
                    if (effectiveSignY > 0 ? r >= endRow : r <= endRow) break; // Optimization
                }
            }
        } // End Y-collision detection loop

        // --- Apply Y Collision Result ---
        if (earliestToiY < 1.0 - E_EPSILON) { // Collision detected
             // Snap EXACTLY to the collision surface, plus epsilon
             entity.y = (effectiveSignY > 0) ? (collisionSurfaceY - entity.height - E_EPSILON) : (collisionSurfaceY + E_EPSILON);

            if (effectiveSignY > 0) { // Collided downwards (or landed after step-up)
                isOnGround = true; // Landed on something
            }
            entity.vy = 0; // Stop vertical movement
            collidedY = true;
        } else if (!didStepUp) {
             // No Y collision detected AND didn't step up, move freely vertically
             entity.y += moveY * earliestToiY; // Move potentially full distance
             collidedY = false;
             isOnGround = false; // Not on ground if moving freely downwards
        } else {
             // If step-up occurred but no *immediate* downward collision was found (e.g., stepped onto edge),
             // entity remains at the stepped Y, but is airborne until next frame's gravity takes effect.
             isOnGround = false; // Not confirmed on ground yet
        }

    } // End Y-axis check

    // --- Step 3: Final Ground Check (Post-Resolution) ---
    // This is essential! It confirms ground status if sliding horizontally onto a ledge,
    // standing still, or immediately after a step-up where the Y-collision check might not have registered.
    // Checks slightly below the entity's final position.
    if (!isOnGround) { // Only run if Y-collision didn't already confirm ground
        const checkYBelow = entity.y + entity.height + Config.BLOCK_HEIGHT * 0.1; // Check a bit (~10% block height) below feet
        // Check columns slightly inset from edges to avoid issues at exact corners
        const checkColLeft = worldToGridCoords(entity.x + entity.width * 0.1, checkYBelow).col; // Inset 10%
        const checkColRight = worldToGridCoords(entity.x + entity.width * 0.9, checkYBelow).col; // Inset 10%
        const checkRowBelow = worldToGridCoords(entity.x, checkYBelow).row; // Row index below entity

        // Check if either point below hits solid ground
        if (isSolid(checkColLeft, checkRowBelow) || isSolid(checkColRight, checkRowBelow)) {
            // There is solid ground directly below. Check if the entity is *very close* to it.
            const groundSurfaceY = checkRowBelow * Config.BLOCK_HEIGHT;
            // Use a small tolerance, related to E_EPSILON, for proximity check
            if (Math.abs((entity.y + entity.height) - groundSurfaceY) < E_EPSILON * 5) {
                isOnGround = true;
                 // Optional: Snap precisely to ground if vertical velocity is negligible (prevents floating point creep)
                 // Use a threshold slightly larger than Epsilon but smaller than gravity impact per frame
                if (Math.abs(entity.vy) < Config.GRAVITY * 0.5) {
                    entity.y = groundSurfaceY - entity.height; // Snap feet exactly to surface
                    entity.vy = 0; // Ensure velocity is zeroed if snapped
                }
            }
        }
    } // End final ground check

    // Return results, including the new didStepUp flag
    return { collidedX, collidedY, isOnGround, didStepUp };
}