// -----------------------------------------------------------------------------
// js/renderer.js - Handles Canvas Setup and Drawing Operations
// -----------------------------------------------------------------------------

import * as Config from './config.js';

// --- Module State ---
let canvas = null;
let ctx = null;
let gridCanvas = null; // The off-screen canvas element
let gridCtx = null;    // The context for the off-screen canvas
// --- Public Functions ---
/** Initializes the main canvas and rendering context. */
export function init() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) { throw new Error("Renderer: Canvas element 'game-canvas' not found!"); }

    // *** SET INTERNAL RESOLUTION ***
    canvas.width = Config.CANVAS_WIDTH;   // Use 1600 from config
    canvas.height = Config.CANVAS_HEIGHT; // Use 800 from config

    ctx = canvas.getContext('2d');
    if (!ctx) { throw new Error("Renderer: Failed to get 2D context!"); }
    // Disable image smoothing for pixel art
    ctx.imageSmoothingEnabled = false;
    // console.log(`Renderer initialized. Internal Canvas Size: ${canvas.width}x${canvas.height}`);
}
export function createGridCanvas() {
    gridCanvas = document.createElement('canvas');
    gridCanvas.width = Config.CANVAS_WIDTH; // SET OFF-SCREEN CANVAS RESOLUTION
    gridCanvas.height = Config.CANVAS_HEIGHT; // Match main canvas internal resolution
    gridCtx = gridCanvas.getContext('2d');
    if (!gridCtx) { throw new Error("Renderer: Failed to get 2D context for grid canvas!"); }
    gridCtx.imageSmoothingEnabled = false; // Disable image smoothing for pixel art on grid canvas too
    // console.log(`Renderer: Grid canvas created (${gridCanvas.width}x${gridCanvas.height}).`);
}
/** Returns the main rendering context. */
export function getContext() {
    return ctx;
}
/** Returns the context for the off-screen grid canvas. */
export function getGridContext() {
    return gridCtx;
}
/** Returns the off-screen grid canvas HTML element itself. */
export function getGridCanvas() {
    return gridCanvas;
}
/** Clears the entire main canvas and fills with the background color */
export function clear() {
    if (!ctx || !canvas) {
        console.error("Renderer: Cannot clear - not initialized.");
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = Config.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Clears a rectangular region on the main canvas.
 * Used for partial updates.
 * @param {number} x - X-coordinate of top-left corner.
 * @param {number} y - Y-coordinate of top-left corner.
 * @param {number} width - Width of rectangle to clear.
 * @param {number} height - Height of rectangle to clear.
 */
export function clearRect(x, y, width, height) {
    if (!ctx) { console.error("Renderer: Cannot clearRect - not initialized."); return; }
    // Maybe add bounds checking?
    ctx.clearRect(x, y, width, height);
}


/**
 * Returns the main canvas element.
 * @returns {HTMLCanvasElement | null} The canvas element, or null if not initialized.
 */
export function getCanvas() {
    return canvas;
}

// --- Future Drawing Helpers (Examples - No Change) ---
/*
export function drawRect(x, y, width, height, color) { ... }
export function drawText(text, x, y, color = 'white', font = '16px sans-serif') { ... }
*/