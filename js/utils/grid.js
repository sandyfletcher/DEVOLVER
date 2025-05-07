// -----------------------------------------------------------------------------
// root/js/utils/grid.js - Draws the grid lines onto the off-screen canvas
// -----------------------------------------------------------------------------

import * as Config from '../config.js';

export function drawStaticGrid(ctx, showGrid) { // draws grid lines onto provided canvas context
    if (!ctx || !showGrid) {
         return;
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.1)'; // set style for the grid lines
    ctx.lineWidth = 1.0;
    const canvasWidth = Config.GRID_COLS * Config.BLOCK_WIDTH;
    const canvasHeight = Config.GRID_ROWS * Config.BLOCK_HEIGHT;
    for (let c = 0; c <= Config.GRID_COLS; c++) { // draw vertical lines
        const x = c * Config.BLOCK_WIDTH; // calculate X pixel position for line
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
    }
    for (let r = 0; r <= Config.GRID_ROWS; r++) { // draw horizontal lines
        const y = r * Config.BLOCK_HEIGHT; // calculate the Y pixel position for line
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
    }
    ctx.restore();
}