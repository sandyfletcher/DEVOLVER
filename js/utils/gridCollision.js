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


// --- CURRENT DISCRETE COLLISION CHECK ---
// NOTE: This function will be REPLACED later with the swept collision logic
// but we move it here first for organization.

/**
 * [DEPRECATED - use collideAndResolve instead after implementing swept collision]
 * Checks grid collision for a given entity based on its current position and velocity.
 * Modifies the entity's position and velocity directly upon collision. (Discrete check)
 * @param {object} entity - The entity object (must have x, y, width, height, vx, vy properties).
 * @returns {{collidedX: boolean, collidedY: boolean, isOnGround: boolean}} Collision results.
 */
export function checkGridCollision_Discrete(entity) {
    // Destructure entity properties for calculations. We modify entity directly.
    let { x, y, width, height, vx, vy } = entity; // Local copies needed for calculation
    let collidedX = false;
    let collidedY = false;
    let isOnGround = false; // Track if landed specifically in this step

    // --- Vertical Collision Prediction & Resolution ---
    const predictY = entity.y + entity.vy; // Use current entity values for prediction

    if (entity.vy > 0) { // Moving Down / Falling
        const feetY = predictY + height;
        const checkColLeft = worldToGridCoords(entity.x + 1, feetY).col;
        const checkColRight = worldToGridCoords(entity.x + width - 1, feetY).col;
        const checkRow = worldToGridCoords(entity.x, feetY).row;

        if (isSolid(checkColLeft, checkRow) || isSolid(checkColRight, checkRow)) {
            const groundSurfaceY = checkRow * Config.BLOCK_HEIGHT;
            if (entity.y + height <= groundSurfaceY + 0.1) {
                entity.y = groundSurfaceY - height;
                entity.vy = 0;
                collidedY = true;
                isOnGround = true;
            }
        }
    } else if (entity.vy < 0) { // Moving Up
        const headY = predictY;
        const checkColLeft = worldToGridCoords(entity.x + 1, headY).col;
        const checkColRight = worldToGridCoords(entity.x + width - 1, headY).col;
        const checkRow = worldToGridCoords(entity.x, headY).row;

        if (isSolid(checkColLeft, checkRow) || isSolid(checkColRight, checkRow)) {
            const ceilingSurfaceY = (checkRow + 1) * Config.BLOCK_HEIGHT;
             if (entity.y >= ceilingSurfaceY - 0.1) {
                 entity.y = ceilingSurfaceY;
                 entity.vy = 0;
                 collidedY = true;
             }
        }
    }
    y = entity.y; // Update local 'y' for horizontal checks

    // --- Horizontal Collision Prediction & Resolution ---
    const predictX = entity.x + entity.vx;

    if (entity.vx > 0) { // Moving Right
        const rightEdgeX = predictX + width;
        const checkCol = worldToGridCoords(rightEdgeX, y).col;
        const checkRowTop = worldToGridCoords(rightEdgeX, y + 1).row;
        const checkRowMid = worldToGridCoords(rightEdgeX, y + height / 2).row;
        const checkRowBot = worldToGridCoords(rightEdgeX, y + height - 1).row;

        if (isSolid(checkCol, checkRowTop) || isSolid(checkCol, checkRowMid) || isSolid(checkCol, checkRowBot)) {
            const wallSurfaceX = checkCol * Config.BLOCK_WIDTH;
             if (entity.x + width <= wallSurfaceX + 0.1) {
                 entity.x = wallSurfaceX - width;
                 entity.vx = 0;
                 collidedX = true;
             }
        }
    } else if (entity.vx < 0) { // Moving Left
        const leftEdgeX = predictX;
        const checkCol = worldToGridCoords(leftEdgeX, y).col;
        const checkRowTop = worldToGridCoords(leftEdgeX, y + 1).row;
        const checkRowMid = worldToGridCoords(leftEdgeX, y + height / 2).row;
        const checkRowBot = worldToGridCoords(leftEdgeX, y + height - 1).row;

        if (isSolid(checkCol, checkRowTop) || isSolid(checkCol, checkRowMid) || isSolid(checkCol, checkRowBot)) {
            const wallSurfaceX = (checkCol + 1) * Config.BLOCK_WIDTH;
             if (entity.x >= wallSurfaceX - 0.1) {
                 entity.x = wallSurfaceX;
                 entity.vx = 0;
                 collidedX = true;
             }
        }
    }

    // --- Final Ground Check (Post-Movement) ---
    if (!isOnGround) {
        const checkYBelow = entity.y + height + 1;
        const checkColLeft = worldToGridCoords(entity.x + 1, checkYBelow).col;
        const checkColRight = worldToGridCoords(entity.x + width - 1, checkYBelow).col;
        const checkRowBelow = worldToGridCoords(entity.x, checkYBelow).row;

        if (isSolid(checkColLeft, checkRowBelow) || isSolid(checkColRight, checkRowBelow)) {
            const groundSurfaceY = checkRowBelow * Config.BLOCK_HEIGHT;
            if (Math.abs((entity.y + height) - groundSurfaceY) < 1.0) {
                isOnGround = true;
                // Optional snap if vy === 0
                // if (entity.vy === 0) entity.y = groundSurfaceY - height;
            }
        }
    }

    return { collidedX, collidedY, isOnGround };
}

// ================================================================
// Placeholder for the NEW Swept Collision function we will write
// ================================================================
/*
export function collideAndResolve(entity, dt) { // dt might be needed if velocity is per second
    let collidedX = false;
    let collidedY = false;
    let isOnGround = false;

    // --- Calculate Target Positions based on velocity ---
    // Note: If vx/vy are pixels/frame, you don't need dt here.
    // If vx/vy are pixels/second, multiply by dt:
    // let moveX = entity.vx * dt;
    // let moveY = entity.vy * dt;
    let moveX = entity.vx; // Assuming pixels/frame for now based on current code
    let moveY = entity.vy;

    // --- Swept Collision - X Axis ---
    if (moveX !== 0) {
        // Broadphase check (optional optimisation)
        // Narrowphase check against relevant solid blocks
        // Calculate earliest time of impact (toiX, range 0-1)
        // Adjust moveX based on toiX
        // Update entity.x += moveX
        // If collision occurred (toiX < 1.0), set entity.vx = 0 and collidedX = true
    }

    // --- Swept Collision - Y Axis ---
    if (moveY !== 0) {
        // Broadphase check (optional optimisation)
        // Narrowphase check against relevant solid blocks
        // Calculate earliest time of impact (toiY, range 0-1)
        // Adjust moveY based on toiY
        // Update entity.y += moveY
        // If collision occurred (toiY < 1.0), set entity.vy = 0 and collidedY = true
        // If collided downwards (moveY > 0 and toiY < 1.0), set isOnGround = true
    }

     // --- Final Ground Check (Still potentially useful) ---
     // if (!isOnGround) { check 1 pixel below final entity.y... }

    return { collidedX, collidedY, isOnGround };
}
*/