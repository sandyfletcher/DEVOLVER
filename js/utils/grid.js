// -----------------------------------------------------------------------------
// root/js/utils/grid.js - Draws the grid lines onto the off-screen canvas
// -----------------------------------------------------------------------------

import * as Config from '../config.js';

/**
 * Draws the grid lines onto the provided canvas context.
 * @param {CanvasRenderingContext2D} ctx - The context to draw on.
 * @param {boolean} showGrid - Whether to actually draw the grid or just return.
 */
export function drawStaticGrid(ctx, showGrid) {
    if (!ctx || !showGrid) {
         return;
    }

    ctx.save();

    // Set the style for the grid lines
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.1)'; // Same semi-transparent dark grey
    ctx.lineWidth = 1.0; // <-- CHANGE LINE WIDTH TO 1.0

    const canvasWidth = Config.GRID_COLS * Config.BLOCK_WIDTH;
    const canvasHeight = Config.GRID_ROWS * Config.BLOCK_HEIGHT;

    // --- Draw Vertical Lines ---
    for (let c = 0; c <= Config.GRID_COLS; c++) {
        // Calculate the X pixel position for the line.
        // Use integer coordinates now that lineWidth is 1.0.
        const x = c * Config.BLOCK_WIDTH; // <-- REMOVE + 0.5
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
    }

    // --- Draw Horizontal Lines ---
    for (let r = 0; r <= Config.GRID_ROWS; r++) {
        // Calculate the Y pixel position for the line.
        // Use integer coordinates now that lineWidth is 1.0.
        const y = r * Config.BLOCK_HEIGHT; // <-- REMOVE + 0.5
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
    }

    ctx.restore();
}