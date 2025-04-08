// -----------------------------------------------------------------------------
// root/js/utils/grid.js - Draws grid onto off-screen canvas
// -----------------------------------------------------------------------------

// console.log("utils/grid loaded");

import * as Config from '../config.js';
import * as Renderer from '../renderer.js';

export function drawStaticGrid() {
    const gridCtx = Renderer.getGridContext();
    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCtx || !gridCanvas) {
        console.error("GridRenderer.drawStaticGrid: Grid context or canvas is missing!");
        return;
    }
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
}