// -----------------------------------------------------------------------------
// js/rendering/grid-renderer.js - Handles drawing the static world grid lines
// -----------------------------------------------------------------------------

console.log("rendering/grid-renderer.js loaded");

import * as Config from '../config.js';
import * as Renderer from '../renderer.js'; // Needs access to the grid canvas/context

/**
 * Draws the static grid lines onto the dedicated off-screen grid canvas.
 * This should be called once during initialization or if grid dimensions change.
 * Assumes the grid canvas/context has been created by Renderer.
 */
export function drawStaticGrid() {
    const gridCtx = Renderer.getGridContext(); // Get context from Renderer
    const gridCanvas = Renderer.getGridCanvas();

    if (!gridCtx || !gridCanvas) {
        console.error("GridRenderer.drawStaticGrid: Grid context or canvas is missing!");
        return;
    }

    console.log("Drawing static grid lines onto off-screen canvas..."); // Keep log as requested

    // Clear only if needed? Generally the main static render will clear first.
    // gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

    gridCtx.save();
    gridCtx.strokeStyle = 'rgba(50, 50, 50, 0.1)'; // Style for the grid lines
    gridCtx.lineWidth = 0.5;

    const canvasWidth = Config.GRID_COLS * Config.BLOCK_WIDTH;
    const canvasHeight = Config.GRID_ROWS * Config.BLOCK_HEIGHT;

    // Draw vertical lines
    for (let c = 0; c <= Config.GRID_COLS; c++) {
        const x = c * Config.BLOCK_WIDTH;
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, canvasHeight);
        gridCtx.stroke();
    }

    // Draw horizontal lines
    for (let r = 0; r <= Config.GRID_ROWS; r++) {
        const y = r * Config.BLOCK_HEIGHT;
        gridCtx.beginPath();
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(canvasWidth, y);
        gridCtx.stroke();
    }

    gridCtx.restore();
    // console.log("Static grid lines drawn."); // Maybe reduce logging noise slightly
}