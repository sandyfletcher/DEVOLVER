// -----------------------------------------------------------------------------
// js/rendering/grid-renderer.js - Handles drawing the static world grid lines
// -----------------------------------------------------------------------------
console.log("rendering/grid-renderer.js loaded");

// Adjust paths as necessary if your folder structure is different
import * as Config from '../config.js';
import * as Renderer from '../renderer.js'; // Needs access to the grid canvas/context

/**
 * Draws the static grid lines onto the dedicated off-screen grid canvas.
 * This should be called once during initialization or if grid dimensions change.
 */
export function drawStaticGrid() {
    // Get the context and canvas element from the main Renderer module
    const gridCtx = Renderer.getGridContext();
    const gridCanvas = Renderer.getGridCanvas(); // We need the canvas for its dimensions

    if (!gridCtx || !gridCanvas) {
        console.error("GridRenderer.drawStaticGrid: Grid context or canvas is missing! Ensure Renderer.createGridCanvas() was called.");
        return;
    }

    console.log("Drawing static grid layer...");

    // Clear the grid canvas completely before drawing
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

    gridCtx.save(); // Save context state

    gridCtx.strokeStyle = 'rgba(50, 50, 50, 0.1)'; // Style for the grid lines
    gridCtx.lineWidth = 0.5; // Use thin lines

    // Calculate grid dimensions based on Config (ensure canvas matches this size)
    const canvasWidth = Config.GRID_COLS * Config.BLOCK_WIDTH;
    const canvasHeight = Config.GRID_ROWS * Config.BLOCK_HEIGHT;

    // Draw vertical lines
    for (let c = 0; c <= Config.GRID_COLS; c++) { // Iterate one past the last column for the final line
        const x = c * Config.BLOCK_WIDTH;
        gridCtx.beginPath();
        // Ensure lines cover the whole intended grid area, even if canvas is larger
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, canvasHeight);
        gridCtx.stroke();
    }

    // Draw horizontal lines
    for (let r = 0; r <= Config.GRID_ROWS; r++) { // Iterate one past the last row for the final line
        const y = r * Config.BLOCK_HEIGHT;
        gridCtx.beginPath();
        // Ensure lines cover the whole intended grid area
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(canvasWidth, y);
        gridCtx.stroke();
    }

    gridCtx.restore(); // Restore context state
    console.log("Static grid layer drawn onto off-screen canvas.");
}

// --- Potential Future Additions ---
// export function clearGrid() { ... } // If needed to explicitly clear grid canvas later