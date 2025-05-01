// -----------------------------------------------------------------------------
// root/js/utils/grid.js - Contains logic for drawing grid lines onto off-screen canvas
// -----------------------------------------------------------------------------

import * as Config from '../config.js';
// import * as Renderer from '../renderer.js'; // No longer needed here if ctx is passed

/**
 * Draws the grid lines onto the provided canvas context.
 * @param {CanvasRenderingContext2D} ctx - The context to draw on.
 * @param {boolean} showGrid - Whether to actually draw the grid or just return.
 */
export function drawStaticGrid(ctx, showGrid) {
    if (!ctx || !showGrid) {
         return; // Do nothing if context is missing or grid is not meant to be shown
    }

    // Save the current drawing context state before applying temporary styles (like strokeStyle, lineWidth)
    ctx.save();
    // Set the style for the grid lines
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.1)'; // Semi-transparent dark grey
    ctx.lineWidth = 0.5; // Thin lines
    // Get the dimensions of the internal canvas / world grid in pixels
    const canvasWidth = Config.GRID_COLS * Config.BLOCK_WIDTH;
    const canvasHeight = Config.GRID_ROWS * Config.BLOCK_HEIGHT;
    // --- Draw Vertical Lines ---
    // Iterate through columns, drawing a vertical line at the left edge of each column (and one after the last column)
    for (let c = 0; c <= Config.GRID_COLS; c++) {
        // Calculate the X pixel position for the line. Use Math.floor for pixel snapping.
        const x = Math.floor(c * Config.BLOCK_WIDTH);
        // Start a new path for this line
        ctx.beginPath();
        // Move to the starting point (top of the line)
        ctx.moveTo(x, 0);
        // Draw a line down to the ending point (bottom of the line)
        ctx.lineTo(x, canvasHeight);
        // Apply the stroke (draw the line)
        ctx.stroke();
    }
    // --- Draw Horizontal Lines ---
    // Iterate through rows, drawing a horizontal line at the top edge of each row (and one after the last row)
    for (let r = 0; r <= Config.GRID_ROWS; r++) {
        // Calculate the Y pixel position for the line. Use Math.floor for pixel snapping.
        const y = Math.floor(r * Config.BLOCK_HEIGHT);
        // Start a new path for this line
        ctx.beginPath();
        // Move to the starting point (left end of the line)
        ctx.moveTo(0, y);
        // Draw a line across to the ending point (right end of the line)
        ctx.lineTo(canvasWidth, y);
        // Apply the stroke (draw the line)
        ctx.stroke();
    }
    // Restore the previous drawing context state (removes the temporary strokeStyle, lineWidth)
    ctx.restore();
}