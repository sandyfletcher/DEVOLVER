// -----------------------------------------------------------------------------
// world.js - Handles Terrain Generation, Properties, and Drawing
// -----------------------------------------------------------------------------
console.log("world.js loaded");

// --- Module Imports ---
import * as Config from './config.js';

// --- Module State ---
// In the future, this could hold data about destructible terrain, placed blocks, etc.
// Example: let terrainGrid = [];

// --- Private Helper Functions (Terrain Drawing) ---

function drawWater(ctx) {
    ctx.fillStyle = Config.WATER_COLOR;
    // Left water
    ctx.fillRect(0, Config.WATER_LEVEL, Config.WATER_WIDTH, Config.CANVAS_HEIGHT - Config.WATER_LEVEL);
    // Right water
    ctx.fillRect(Config.CANVAS_WIDTH - Config.WATER_WIDTH, Config.WATER_LEVEL, Config.WATER_WIDTH, Config.CANVAS_HEIGHT - Config.WATER_LEVEL);
}

function drawSand(ctx) {
    ctx.fillStyle = Config.SAND_COLOR;
    // Left Sand (Polygon)
    ctx.beginPath();
    ctx.moveTo(Config.WATER_WIDTH, Config.WATER_LEVEL); // Top left corner (at water edge)
    ctx.lineTo(Config.GROUND_START_X, Config.GROUND_BASE_LEVEL); // Top right corner (at ground edge)
    ctx.lineTo(Config.GROUND_START_X, Config.CANVAS_HEIGHT); // Bottom right corner
    ctx.lineTo(Config.WATER_WIDTH, Config.CANVAS_HEIGHT); // Bottom left corner
    ctx.closePath();
    ctx.fill();

    // Right Sand (Polygon)
    ctx.beginPath();
    ctx.moveTo(Config.GROUND_END_X, Config.GROUND_BASE_LEVEL); // Top left corner (at ground edge)
    ctx.lineTo(Config.CANVAS_WIDTH - Config.WATER_WIDTH, Config.WATER_LEVEL); // Top right corner (at water edge)
    ctx.lineTo(Config.CANVAS_WIDTH - Config.WATER_WIDTH, Config.CANVAS_HEIGHT); // Bottom right corner
    ctx.lineTo(Config.GROUND_END_X, Config.CANVAS_HEIGHT); // Bottom left corner
    ctx.closePath();
    ctx.fill();
}

function drawGround(ctx) {
    ctx.fillStyle = Config.GROUND_COLOR;
    ctx.beginPath();
    // Start at the bottom-left of the ground area
    ctx.moveTo(Config.GROUND_START_X, Config.CANVAS_HEIGHT);
    // Go up to the ground level at the start (using getSurfaceY for consistency)
    ctx.lineTo(Config.GROUND_START_X, getSurfaceY(Config.GROUND_START_X));

    // Draw the top surface (flat + hill + flat) using getSurfaceY
    for (let x = Config.GROUND_START_X; x <= Config.GROUND_END_X; x += 5) { // Sample points
        ctx.lineTo(x, getSurfaceY(x));
    }
    // Ensure the line reaches the exact end point's surface Y
    ctx.lineTo(Config.GROUND_END_X, getSurfaceY(Config.GROUND_END_X));

    // Go down to the bottom-right of the ground area
    ctx.lineTo(Config.GROUND_END_X, Config.CANVAS_HEIGHT);

    // Close the path along the bottom
    ctx.closePath();
    ctx.fill();
}


// --- Public Functions ---

/**
 * Initializes the world module. (Currently does nothing, placeholder)
 */
export function init() {
    // Future: Could pre-calculate terrain features, load map data, etc.
    console.log("World initialized.");
}

/**
 * Calculates the Y-coordinate of the solid surface (ground, sand, or water level)
 * at a given horizontal position.
 * @param {number} xPos - The horizontal position to check.
 * @returns {number} The Y-coordinate of the surface.
 */
export function getSurfaceY(xPos) {
    // 1. Check Water Zones
    if (xPos < Config.WATER_WIDTH || xPos > Config.CANVAS_WIDTH - Config.WATER_WIDTH) {
        // Return water level - entities might interact differently with this later
        // For pure collision, player currently stops *before* entering water zone,
        // but this function defines the water *surface*.
        return Config.WATER_LEVEL;
    }

    // 2. Check Sand Zones (Linear Interpolation for slope)
    if (xPos >= Config.WATER_WIDTH && xPos < Config.GROUND_START_X) { // Left Sand
        const sandProgress = (xPos - Config.WATER_WIDTH) / Config.SAND_WIDTH; // 0 to 1
        return Config.WATER_LEVEL + (Config.GROUND_BASE_LEVEL - Config.WATER_LEVEL) * sandProgress;
    }
    if (xPos <= Config.CANVAS_WIDTH - Config.WATER_WIDTH && xPos > Config.GROUND_END_X) { // Right Sand
        const sandProgress = ((Config.CANVAS_WIDTH - Config.WATER_WIDTH) - xPos) / Config.SAND_WIDTH; // 0 to 1
        return Config.WATER_LEVEL + (Config.GROUND_BASE_LEVEL - Config.WATER_LEVEL) * sandProgress;
    }

    // 3. Check Main Ground Zone (Hill Calculation)
    if (xPos >= Config.GROUND_START_X && xPos <= Config.GROUND_END_X) {
        const halfHillWidth = Config.HILL_EFFECTIVE_WIDTH / 2;
        const distFromCenter = Math.abs(xPos - Config.HILL_CENTER_X);

        if (distFromCenter <= halfHillWidth) {
            // Calculate parabolic height *reduction* from the peak
            // Peak is at GROUND_BASE_LEVEL - HILL_MAX_HEIGHT
            const heightReduction = Config.HILL_MAX_HEIGHT * Math.pow((distFromCenter / halfHillWidth), 2);
            return (Config.GROUND_BASE_LEVEL - Config.HILL_MAX_HEIGHT) + heightReduction;
        } else {
            // Flat ground part within the main ground zone
            return Config.GROUND_BASE_LEVEL;
        }
    }

    // Fallback (e.g., if xPos is somehow outside all defined zones)
    console.warn(`getSurfaceY called with unexpected xPos: ${xPos}`);
    return Config.CANVAS_HEIGHT; // Return bottom of screen as safest fallback
}


/**
 * Draws the entire world terrain (ground, sand, water) onto the canvas.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 */
export function draw(ctx) {
    if (!ctx) {
        console.error("World.draw: Rendering context not provided!");
        return;
    }
    // Order matters for correct layering:
    drawGround(ctx);
    drawSand(ctx);
    drawWater(ctx);
}

// --- Future Functions (Examples) ---
/*
export function isSolid(x, y) {
    // Check if a specific coordinate is inside solid ground/sand
    // Needs to account for terrain grid/block data later
    const surfaceY = getSurfaceY(x);
    return y >= surfaceY;
}

export function getBlockAt(gridX, gridY) {
    // Return the type of block at a grid coordinate
}

export function setBlockAt(gridX, gridY, blockType) {
    // Modify the terrain grid (building/destruction)
}
*/