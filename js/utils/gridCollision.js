
// -----------------------------------------------------------------------------
// root/js/utils/gridCollision.js - Handles Entity vs World Grid Collision Logic
// -----------------------------------------------------------------------------
console.log("utils/gridCollision.js loaded");

// Import necessary modules
import * as Config from '../config.js';         // For block dimensions, grid size etc.
import * as WorldData from './worldData.js'; // To access world block data (getBlock)

// --- Collision Helper Functions --- 

/**
 * Checks if a block at given grid coordinates is solid for collision purposes.
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

    const block = WorldData.getBlock(col, row);

    // Check if block data is null or air
    if (block === null || block === Config.BLOCK_AIR) {
        return false;
    }
    // Check specific non-solid types (assuming block is an object now)
    if (typeof block === 'object' && block.type === Config.BLOCK_WATER) {
        // TODO: Water physics later
        return false; // Water is not solid for stopping purposes
    }
    // For now, any block object that exists and isn't air or water is considered solid.
    if (typeof block === 'object' && typeof block.type === 'number') {
        return true; // It's a block object representing a solid tile
    }
    // Fallback for unexpected data
    return false;
}

/**
 * Converts world coordinates (pixels) to grid coordinates (column, row).
 * @param {number} worldX - X position in pixels.
 * @param {number} worldY - Y position in pixels.
 * @returns {{col: number, row: number}} Object containing column and row indices.
 */
export function worldToGridCoords(worldX, worldY) {
    const col = Math.floor(worldX / Config.BLOCK_WIDTH);
    const row = Math.floor(worldY / Config.BLOCK_HEIGHT);
    return { col, row };
}

/** Finds the Y pixel coordinate of the highest solid block surface below a given point. (Optional helper) */
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

// --- Main Collision Resolution Function ---

/**
 * Performs swept AABB collision detection and resolution against the world grid.
 * Includes logic for stepping up 1-block high obstacles.
 * Updates the entity's position and velocity based on collisions.
 * Uses precise snapping on collision.
 *
 * @param {object} entity - The entity object (must have x, y, width, height, vx, vy).
 * @param {number} potentialMoveX - The intended horizontal movement distance for this frame (entity.vx * dt).
 * @param {number} potentialMoveY - The intended vertical movement distance for this frame (entity.vy * dt).
 * @returns {{collidedX: boolean, collidedY: boolean, isOnGround: boolean, didStepUp: boolean}} Collision results.
 */
export function collideAndResolve(entity, potentialMoveX, potentialMoveY) {
    let moveX = potentialMoveX; // Use the passed-in movement amount
    let moveY = potentialMoveY; // Use the passed-in movement amount
    let collidedX = false;
    let collidedY = false;
    let isOnGround = false; // Assume not on ground initially for this frame check
    let didStepUp = false;

    // Small value for floating point comparisons.
    const E_EPSILON = 1e-4; // Tiny offset to prevent floating point errors / sticking

    // Determine if Step-Up is possible based on state
    // Allow step-up only if vertical velocity isn't significantly upward (prevents jump-steps)
    // Compare against gravity effect over one frame for a threshold
    const canAttemptStepUp = entity.vy <= Config.GRAVITY_ACCELERATION * (1 / 60); // Allow if falling or moving up slowly

    // --- Step 1: Resolve X-axis Collision ---
    if (Math.abs(moveX) > E_EPSILON) {
        const signX = Math.sign(moveX);
        const xEdge = (signX > 0) ? entity.x + entity.width : entity.x; // Leading edge
        let earliestToiX = 1.0; // Time of impact (0 to 1)
        let collisionSurfaceX = 0;
        let stepUpCandidateCol = -1;
        let stepUpCandidateRow = -1;
        // Calculate row span of the entity
        const yStart = entity.y;
        const yEnd = entity.y + entity.height;
        const minRow = Math.max(0, Math.floor(yStart / Config.BLOCK_HEIGHT));
        const maxRow = Math.min(Config.GRID_ROWS - 1, Math.floor((yEnd - E_EPSILON) / Config.BLOCK_HEIGHT)); // Use epsilon for bottom edge
        // Calculate column span for the sweep check based on moveX
        const targetXEdge = xEdge + moveX;
        const startColCheck = Math.floor(xEdge / Config.BLOCK_WIDTH);
        const endColCheck = Math.floor((targetXEdge + (signX > 0 ? E_EPSILON : -E_EPSILON)) / Config.BLOCK_WIDTH);
        // Find the earliest X collision across the entity's vertical span
        for (let r = minRow; r <= maxRow; r++) {
        // Determine column check range and direction for this row
            const checkStart = (signX > 0) ? Math.max(0, startColCheck + 1) : Math.min(Config.GRID_COLS - 1, startColCheck);
            const checkEnd = (signX > 0) ? Math.min(Config.GRID_COLS - 1, endColCheck) : Math.max(0, endColCheck);
            const step = (signX > 0) ? 1 : -1;

            for (let c = checkStart; (signX > 0 ? c <= checkEnd : c >= checkEnd); c += step) {
                if (isSolid(c, r)) {
                    const blockEdgeX = (signX > 0) ? c * Config.BLOCK_WIDTH : (c + 1) * Config.BLOCK_WIDTH;
                    const toiX = (blockEdgeX - xEdge) / moveX; // Calculate time of impact (fraction of moveX)
                    // Check if valid collision (forward in time) and earliest found
                    if (toiX >= -E_EPSILON && toiX < earliestToiX) {
                        earliestToiX = toiX;
                        collisionSurfaceX = blockEdgeX;
                        stepUpCandidateCol = c;
                        stepUpCandidateRow = r;
                    }
                    break; // Stop checking further columns in this row
                }
            }
        }
        // --- Check for Step-Up Condition ---
        let performStepUp = false;
        if (earliestToiX < 1.0 - E_EPSILON && canAttemptStepUp && stepUpCandidateCol !== -1) {
            const entityHeightInBlocks = Math.ceil(entity.height / Config.BLOCK_HEIGHT);
            const isObstacleAtFeet = (stepUpCandidateRow === maxRow);
            const isSpaceAboveObstacleClear = !isSolid(stepUpCandidateCol, stepUpCandidateRow - 1);
            const headClearanceRow = stepUpCandidateRow - entityHeightInBlocks;
            const isHeadClearanceAvailable = !isSolid(stepUpCandidateCol, headClearanceRow);
            if (isObstacleAtFeet && isSpaceAboveObstacleClear && isHeadClearanceAvailable) {
                 performStepUp = true;
                 didStepUp = true;
            }
        }
        // --- Apply X Collision Result ---
        if (performStepUp) {
            // Step Up: Allow horizontal movement up to collision, adjust Y, stop VY
            const allowedMoveX = moveX * earliestToiX;
            entity.x += allowedMoveX;
            entity.y = (stepUpCandidateRow * Config.BLOCK_HEIGHT) - entity.height; // Place feet exactly on step
            entity.vy = 0; // Stop vertical velocity during step
            // Note: We don't set collidedX=true or vx=0, allowing slide if input held
        } else if (earliestToiX < 1.0 - E_EPSILON) {
            // Standard X Collision: Move exactly to surface, stop VX
            const allowedMoveX = moveX * earliestToiX;
            entity.x += allowedMoveX;
            // Snap precisely: Adjust slightly away from the wall to prevent sticking
            entity.x = (signX > 0) ? (collisionSurfaceX - entity.width - E_EPSILON) : (collisionSurfaceX + E_EPSILON);
            entity.vx = 0; // Stop horizontal velocity
            collidedX = true;
        } else {
            // No X collision: Move freely horizontally for the full potential distance
            entity.x += moveX;
        }
    }

    // --- Step 2: Resolve Y-axis Collision (Using entity's potential X and Y from Step 1---

    // Re-read moveY in case vy was zeroed by step-up
    moveY = didStepUp ? 0 : potentialMoveY; // If stepped up, no vertical move this frame

    if (Math.abs(moveY) > E_EPSILON || didStepUp) { // Also check Y if step-up occurred to confirm landing
        const signY = didStepUp ? 1 : Math.sign(moveY); // If stepped up, check downwards
        const yEdge = (signY > 0) ? entity.y + entity.height : entity.y;
        let earliestToiY = 1.0;
        let collisionSurfaceY = 0;
        // Calculate column span of the entity at its (potentially new) X position
        const xStart = entity.x;
        const xEnd = entity.x + entity.width;
        const minCol = Math.max(0, Math.floor(xStart / Config.BLOCK_WIDTH));
        const maxCol = Math.min(Config.GRID_COLS - 1, Math.floor((xEnd - E_EPSILON) / Config.BLOCK_WIDTH)); // Use epsilon for right edge
        // Calculate row span for the sweep check
        // If stepped up, target edge is just slightly below current position
        const targetYEdge = yEdge + (didStepUp ? E_EPSILON * 2 : moveY);
        const startRowCheck = Math.floor(yEdge / Config.BLOCK_HEIGHT);
        const endRowCheck = Math.floor((targetYEdge + (signY > 0 ? E_EPSILON : -E_EPSILON)) / Config.BLOCK_HEIGHT);
        // Find the earliest Y collision across the entity's horizontal span
        for (let c = minCol; c <= maxCol; c++) {
            const checkStart = (signY > 0) ? Math.max(0, startRowCheck + 1) : Math.min(Config.GRID_ROWS - 1, startRowCheck);
            const checkEnd = (signY > 0) ? Math.min(Config.GRID_ROWS - 1, endRowCheck) : Math.max(0, endRowCheck);
            const step = (signY > 0) ? 1 : -1;

            for (let r = checkStart; (signY > 0 ? r <= checkEnd : r >= checkEnd); r += step) {
                if (isSolid(c, r)) {
                    const blockEdgeY = (signY > 0) ? r * Config.BLOCK_HEIGHT : (r + 1) * Config.BLOCK_HEIGHT;
                    let toiY = 1.0;
                    // Calculate TOI only if actually moving vertically (or checking after step up)
                    if (Math.abs(moveY) > E_EPSILON) {
                         toiY = (blockEdgeY - yEdge) / moveY;
                    } else if (didStepUp && blockEdgeY >= yEdge) { // If stepped up, check immediately below
                         toiY = 0; // Immediate collision if solid block is below
                    }

                    if (toiY >= -E_EPSILON && toiY < earliestToiY) {
                        earliestToiY = toiY;
                        collisionSurfaceY = blockEdgeY;
                    }
                    break; // Stop checking further rows in this column
                }
            }
        }

        // --- Apply Y Collision Result ---
        if (earliestToiY < 1.0 - E_EPSILON) { // Collision detected
            const allowedMoveY = moveY * earliestToiY;
            entity.y += allowedMoveY;
            // Snap precisely: Adjust slightly away from surface
            entity.y = (signY > 0) ? (collisionSurfaceY - entity.height - E_EPSILON) : (collisionSurfaceY + E_EPSILON);

            if (signY > 0) { // Collided downwards (landed)
                isOnGround = true; // Landed on something
            }
            entity.vy = 0; // Stop vertical velocity
            collidedY = true;
        } else if (!didStepUp) {
            // No Y collision detected AND didn't step up, move freely vertically
            entity.y += moveY; // Move full potential distance
            // isOnGround remains false if moving downwards freely
        } else {
             // Stepped up, but didn't immediately hit ground below (e.g. stepped onto edge)
             // isOnGround remains false until next frame or final check confirms
        }
    }

    // --- Step 3: Final Check (Confirms ground status after all movement/snapping, catches landings from horizontal slides or step-ups) ---
    if (!isOnGround) { // Only run if not already confirmed on ground by Y-collision
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
                if (Math.abs((entity.y + entity.height) - groundSurfaceY) < checkDist * 1.5) {
                    isOnGround = true;
                    // Snap feet precisely to the ground surface if close enough
                    entity.y = groundSurfaceY - entity.height;
                    // Ensure vertical velocity is zeroed if we snap to ground here
                    if (entity.vy > 0) {
                        entity.vy = 0;
                    }
                    collidedY = true; // Considered a Y collision if snapped
                    break; // Found ground, no need to check other points
                }
            }
        }
    }
    // Return results
    return { collidedX, collidedY, isOnGround, didStepUp };
}