// -----------------------------------------------------------------------------
// root/js/utils/grid.js - Draws grid onto off-screen canvas
// -----------------------------------------------------------------------------

// console.log("utils/grid loaded");

import * as Config from '../config.js';
import * as Renderer from '../renderer.js';

/**
 * Draws the grid lines onto the off-screen grid canvas.
 * This static visual data is rendered once with the world blocks when the world is generated.
 * It can be toggled or adjusted for debugging or visual style.
 * (Currently commented out in WorldManager draw functions by default).
 */
export function drawStaticGrid() {
    // Get the context and canvas element for the off-screen grid canvas from the Renderer
    const gridCtx = Renderer.getGridContext();
    const gridCanvas = Renderer.getGridCanvas();

    // Ensure the grid context and canvas are available
    if (!gridCtx || !gridCanvas) {
        console.error("GridRenderer.drawStaticGrid: Grid context or canvas is missing!");
        return; // Exit if dependencies are not available
    }

    // Save the current drawing context state before applying temporary styles (like strokeStyle, lineWidth)
    gridCtx.save();

    // Set the style for the grid lines
    gridCtx.strokeStyle = 'rgba(50, 50, 50, 0.1)'; // Semi-transparent dark grey
    gridCtx.lineWidth = 0.5; // Thin lines

    // Get the dimensions of the internal canvas / world grid in pixels
    const canvasWidth = Config.GRID_COLS * Config.BLOCK_WIDTH;
    const canvasHeight = Config.GRID_ROWS * Config.BLOCK_HEIGHT;

    // --- Draw Vertical Lines ---
    // Iterate through columns, drawing a vertical line at the left edge of each column (and one after the last column)
    for (let c = 0; c <= Config.GRID_COLS; c++) {
        // Calculate the X pixel position for the line. Use Math.floor for pixel snapping.
        const x = Math.floor(c * Config.BLOCK_WIDTH);
        // Start a new path for this line
        gridCtx.beginPath();
        // Move to the starting point (top of the line)
        gridCtx.moveTo(x, 0);
        // Draw a line down to the ending point (bottom of the line)
        gridCtx.lineTo(x, canvasHeight);
        // Apply the stroke (draw the line)
        gridCtx.stroke();
    }

    // --- Draw Horizontal Lines ---
    // Iterate through rows, drawing a horizontal line at the top edge of each row (and one after the last row)
    for (let r = 0; r <= Config.GRID_ROWS; r++) {
        // Calculate the Y pixel position for the line. Use Math.floor for pixel snapping.
        const y = Math.floor(r * Config.BLOCK_HEIGHT);
        // Start a new path for this line
        gridCtx.beginPath();
        // Move to the starting point (left end of the line)
        gridCtx.moveTo(0, y);
        // Draw a line across to the ending point (right end of the line)
        gridCtx.lineTo(canvasWidth, y);
        // Apply the stroke (draw the line)
        gridCtx.stroke();
    }

    // Restore the previous drawing context state (removes the temporary strokeStyle, lineWidth)
    gridCtx.restore();

    // console.log("Static grid lines drawn onto the off-screen canvas.");
}