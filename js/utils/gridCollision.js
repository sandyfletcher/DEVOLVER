// -----------------------------------------------------------------------------
// js/utils/gridCollision.js - Handles Entity vs World Grid Collision Logic
// -----------------------------------------------------------------------------
console.log("utils/gridCollision.js loaded");

// Import necessary modules
import * as Config from '../config.js';         // For block dimensions, grid size etc.
import * as WorldData from './worldData.js'; // To access world block data (getBlock)

/**
 * Checks if a block at given grid coordinates is solid for collision purposes.
 * This is the CORE logic that determines what stops movement.
 * @param {number} col - Column index.
 * @param {number} row - Row index.
 * @returns {boolean} True if the block is solid, false otherwise.
 */
export function isSolid(col, row) {
    // Delegate to WorldData to get the block
    const block = WorldData.getBlock(col, row);

    // Check basic conditions: out of bounds, air
    if (block === null || block === Config.BLOCK_AIR) return false;

    // Check specific non-solid types (assuming block is an object now)
    if (block.type === Config.BLOCK_WATER /* && block.orientation === Config.ORIENTATION_FULL */ ) {
        return false; // Water is not solid
    }

    // TODO: Implement slope-aware collision checks based on block.orientation
    // This is where you'd add logic like: if (block.orientation === SLOPE_TL) { calculate height... }
    // For now, any block that exists and isn't air or water is considered solid
    // regardless of orientation. This collides with the block's bounding box.
    return true;
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
 * Finds the Y pixel coordinate of the highest solid block surface in a column.
 * (Optional - keep if useful, depends on isSolid)
 * @param {number} col - Column index.
 * @returns {number} The Y pixel coordinate of the top surface, or canvas height if column is empty/out of bounds.
 */
export function getCollisionSurfaceY(col) {
    if (col < 0 || col >= Config.GRID_COLS) return Config.CANVAS_HEIGHT; // Out of bounds
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        // Use the isSolid function from this module
        if (isSolid(col, r)) {
            return r * Config.BLOCK_HEIGHT; // Return top edge of the first solid block found
        }
    }
    return Config.CANVAS_HEIGHT; // No solid block found
}


// --- NEW SWEPT COLLISION FUNCTION ---

/**
 * Performs swept AABB collision detection and resolution against the world grid.
 * Updates the entity's position and velocity based on collisions.
 * Assumes entity velocity (vx, vy) is in pixels per frame.
 * @param {object} entity - The entity object (must have x, y, width, height, vx, vy).
 * @returns {{collidedX: boolean, collidedY: boolean, isOnGround: boolean}} Collision results.
 */
export function collideAndResolve(entity) {
    let moveX = entity.vx;
    let moveY = entity.vy;
    let collidedX = false;
    let collidedY = false;
    let isOnGround = false; // Assume not on ground unless proven otherwise by collision

    // Small value for floating point comparisons and nudging away from walls
    const E_EPSILON = 1e-6;

    // --- Step 1: Resolve X-axis Collision ---
    if (Math.abs(moveX) > E_EPSILON) { // Only check if actually moving horizontally
        const signX = Math.sign(moveX);
        let minToiX = 1.0; // Minimum Time of Impact found (0 = immediate, 1 = no collision)

        // Determine grid cell range to check for horizontal movement
        const yStart = entity.y;
        const yEnd = entity.y + entity.height;
        const xEdge = (signX > 0) ? entity.x + entity.width : entity.x; // Leading edge X
        const targetXEdge = xEdge + moveX; // Where the leading edge wants to go

        // Calculate row span, clamping to grid bounds
        const minRow = Math.max(0, Math.floor(yStart / Config.BLOCK_HEIGHT));
        // Subtract epsilon before flooring end row to avoid checking row below if perfectly aligned at bottom edge
        const maxRow = Math.min(Config.GRID_ROWS - 1, Math.floor((yEnd - E_EPSILON) / Config.BLOCK_HEIGHT));

        // Calculate column span based on movement
        const startCol = Math.floor(xEdge / Config.BLOCK_WIDTH);
        const endCol = Math.floor(targetXEdge / Config.BLOCK_WIDTH);

        // Iterate through potentially colliding rows
        for (let r = minRow; r <= maxRow; r++) {
            // Determine column check range and direction for this row
            const colCheckStart = (signX > 0) ? Math.max(0, startCol + 1) : Math.min(Config.GRID_COLS - 1, startCol);
            const colCheckEnd = (signX > 0) ? Math.min(Config.GRID_COLS - 1, endCol) : Math.max(0, endCol);
            const step = (signX > 0) ? 1 : -1;

            for (let c = colCheckStart; (signX > 0 ? c <= colCheckEnd : c >= colCheckEnd); c += step) {
                if (isSolid(c, r)) {
                    // Calculate collision point on the block edge being approached
                    const blockEdgeX = (signX > 0) ? c * Config.BLOCK_WIDTH : (c + 1) * Config.BLOCK_WIDTH;
                    // Calculate time of impact (distance to block edge / total movement)
                    const toiX = (blockEdgeX - xEdge) / moveX;

                    // Check if this collision is valid (forward in time) and earlier than others
                    if (toiX >= -E_EPSILON && toiX < minToiX) { // Allow slightly negative toi due to epsilon/precision
                        // Nudge slightly away from wall to prevent sticking
                        const nudge = signX * -E_EPSILON * 2;
                        const distanceToNudgedCollision = (blockEdgeX - xEdge) + nudge;
                        // Recalculate TOI with nudge, clamp between 0 and 1
                        minToiX = Math.max(0, Math.min(1.0, distanceToNudgedCollision / moveX));
                    }
                    // Optimization: Once a solid block is hit in the path for this row,
                    // no need to check further columns in this row in the direction of movement.
                    // We break if we've reached or passed the target column index.
                    if (signX > 0 ? c >= endCol : c <= endCol) break;
                }
            }
        } // End row loop

        // Update position based on the earliest collision time found
        entity.x += moveX * minToiX;
        if (minToiX < 1.0 - E_EPSILON) { // Check if TOI is significantly less than 1
            entity.vx = 0; // Stop horizontal movement on collision
            collidedX = true;
        }
    } // End X-axis check

    // --- Step 2: Resolve Y-axis Collision ---
    // Use the entity's *potentially updated* X position from Step 1
    if (Math.abs(moveY) > E_EPSILON) { // Only check if actually moving vertically
        const signY = Math.sign(moveY);
        let minToiY = 1.0;

        // Determine grid cell range to check for vertical movement
        const xStart = entity.x;
        const xEnd = entity.x + entity.width;
        const yEdge = (signY > 0) ? entity.y + entity.height : entity.y; // Leading edge Y
        const targetYEdge = yEdge + moveY; // Where the leading edge wants to go

        // Calculate column span, clamping to grid bounds
        const minCol = Math.max(0, Math.floor(xStart / Config.BLOCK_WIDTH));
        // Subtract epsilon before flooring end col to avoid checking col right if perfectly aligned at right edge
        const maxCol = Math.min(Config.GRID_COLS - 1, Math.floor((xEnd - E_EPSILON) / Config.BLOCK_WIDTH));

        // Calculate row span based on movement
        const startRow = Math.floor(yEdge / Config.BLOCK_HEIGHT);
        const endRow = Math.floor(targetYEdge / Config.BLOCK_HEIGHT);

        // Iterate through potentially colliding columns
        for (let c = minCol; c <= maxCol; c++) {
            // Determine row check range and direction for this column
            const rowCheckStart = (signY > 0) ? Math.max(0, startRow + 1) : Math.min(Config.GRID_ROWS - 1, startRow);
            const rowCheckEnd = (signY > 0) ? Math.min(Config.GRID_ROWS - 1, endRow) : Math.max(0, endRow);
            const step = (signY > 0) ? 1 : -1;

            for (let r = rowCheckStart; (signY > 0 ? r <= rowCheckEnd : r >= rowCheckEnd); r += step) {
                if (isSolid(c, r)) {
                    // Calculate collision point on the block edge being approached
                    const blockEdgeY = (signY > 0) ? r * Config.BLOCK_HEIGHT : (r + 1) * Config.BLOCK_HEIGHT;
                    // Calculate time of impact
                    const toiY = (blockEdgeY - yEdge) / moveY;

                    if (toiY >= -E_EPSILON && toiY < minToiY) {
                         const nudge = signY * -E_EPSILON * 2;
                         const distanceToNudgedCollision = (blockEdgeY - yEdge) + nudge;
                         minToiY = Math.max(0, Math.min(1.0, distanceToNudgedCollision / moveY));
                    }
                     if (signY > 0 ? r >= endRow : r <= endRow) break; // Optimization
                }
            }
        } // End column loop

        // Update position based on earliest collision time
        entity.y += moveY * minToiY;
        if (minToiY < 1.0 - E_EPSILON) {
            if (signY > 0) { // Collided downwards
                isOnGround = true; // Landed on something
            }
            entity.vy = 0; // Stop vertical movement on collision
            collidedY = true;
        }
    } // End Y-axis check

    // --- Step 3: Final Ground Check (Post-Resolution) ---
    // This helps confirm ground status if sliding horizontally onto a ledge,
    // or if already standing still. Check 1 pixel below current position.
    // Crucial because Y collision might not have happened if entity was sliding horizontally.
    if (!isOnGround) {
        const checkYBelow = entity.y + entity.height + 1; // Check 1 pixel below
        // Calculate column checks slightly inset from entity edges
        const checkColLeft = worldToGridCoords(entity.x + E_EPSILON, checkYBelow).col;
        const checkColRight = worldToGridCoords(entity.x + entity.width - E_EPSILON, checkYBelow).col;
        const checkRowBelow = worldToGridCoords(entity.x, checkYBelow).row; // Row index below entity

        // Check if either point below hits solid ground
        if (isSolid(checkColLeft, checkRowBelow) || isSolid(checkColRight, checkRowBelow)) {
            // There might be ground below, check if entity is *very close*
            const groundSurfaceY = checkRowBelow * Config.BLOCK_HEIGHT;
            if (Math.abs((entity.y + entity.height) - groundSurfaceY) < 1.0) { // Allow small tolerance (e.g., 1 pixel gap)
                isOnGround = true;
                // Optional: If entity has stopped vertically, snap it precisely to the ground
                // This prevents gradual sinking/floating due to floating point inaccuracies.
                if (Math.abs(entity.vy) < E_EPSILON) {
                    entity.y = groundSurfaceY - entity.height;
                }
            }
        }
    } // End final ground check

    return { collidedX, collidedY, isOnGround };
}


// --- DEPRECATED DISCRETE COLLISION CHECK ---
// Keep for reference or temporary fallback if needed.
/**
 * [DEPRECATED - use collideAndResolve instead]
 * Checks grid collision using discrete steps. Prone to tunneling.
 */
export function checkGridCollision_Discrete(entity) {
    // ... (previous implementation - condensed for brevity) ...
    let { x, y, width, height, vx, vy } = entity;
    let collidedX = false, collidedY = false, isOnGround = false;
    const predictY = entity.y + entity.vy;
    if (entity.vy > 0) { const feetY = predictY + height; const cL = worldToGridCoords(entity.x + 1, feetY).col; const cR = worldToGridCoords(entity.x + width - 1, feetY).col; const rChk = worldToGridCoords(entity.x, feetY).row; if (isSolid(cL, rChk) || isSolid(cR, rChk)) { const gY = rChk * Config.BLOCK_HEIGHT; if (entity.y + height <= gY + 0.1) { entity.y = gY - height; entity.vy = 0; collidedY = true; isOnGround = true; } } }
    else if (entity.vy < 0) { const headY = predictY; const cL = worldToGridCoords(entity.x + 1, headY).col; const cR = worldToGridCoords(entity.x + width - 1, headY).col; const rChk = worldToGridCoords(entity.x, headY).row; if (isSolid(cL, rChk) || isSolid(cR, rChk)) { const ceilY = (rChk + 1) * Config.BLOCK_HEIGHT; if (entity.y >= ceilY - 0.1) { entity.y = ceilY; entity.vy = 0; collidedY = true; } } }
    y = entity.y; const predictX = entity.x + entity.vx;
    if (entity.vx > 0) { const rX = predictX + width; const cChk = worldToGridCoords(rX, y).col; const rT = worldToGridCoords(rX, y + 1).row; const rM = worldToGridCoords(rX, y + height / 2).row; const rB = worldToGridCoords(rX, y + height - 1).row; if (isSolid(cChk, rT) || isSolid(cChk, rM) || isSolid(cChk, rB)) { const wX = cChk * Config.BLOCK_WIDTH; if (entity.x + width <= wX + 0.1) { entity.x = wX - width; entity.vx = 0; collidedX = true; } } }
    else if (entity.vx < 0) { const lX = predictX; const cChk = worldToGridCoords(lX, y).col; const rT = worldToGridCoords(lX, y + 1).row; const rM = worldToGridCoords(lX, y + height / 2).row; const rB = worldToGridCoords(lX, y + height - 1).row; if (isSolid(cChk, rT) || isSolid(cChk, rM) || isSolid(cChk, rB)) { const wX = (cChk + 1) * Config.BLOCK_WIDTH; if (entity.x >= wX - 0.1) { entity.x = wX; entity.vx = 0; collidedX = true; } } }
    if (!isOnGround) { const yB = entity.y + height + 1; const cL = worldToGridCoords(entity.x + 1, yB).col; const cR = worldToGridCoords(entity.x + width - 1, yB).col; const rB = worldToGridCoords(entity.x, yB).row; if (isSolid(cL, rB) || isSolid(cR, rB)) { const gY = rB * Config.BLOCK_HEIGHT; if (Math.abs((entity.y + height) - gY) < 1.0) { isOnGround = true; } } }
    return { collidedX, collidedY, isOnGround };
}