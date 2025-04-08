// -----------------------------------------------------------------------------
// js/renderer.js - Handles Canvas Setup and Drawing Operations
// -----------------------------------------------------------------------------

// console.log("renderer loaded");

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
    canvas.width = Config.CANVAS_WIDTH;
    canvas.height = Config.CANVAS_HEIGHT;
    ctx = canvas.getContext('2d');
    if (!ctx) { throw new Error("Renderer: Failed to get 2D context!"); }
    // console.log("Renderer initialized successfully.");
}

/** Creates and initializes the off-screen canvas for the static grid layer. */
export function createGridCanvas() {
    // Check if it already exists maybe? For now, just create.
    gridCanvas = document.createElement('canvas');
    gridCanvas.width = Config.CANVAS_WIDTH;
    gridCanvas.height = Config.CANVAS_HEIGHT;
    gridCtx = gridCanvas.getContext('2d');
    if (!gridCtx) { throw new Error("Renderer: Failed to get 2D context for grid canvas!"); }
    // console.log("Renderer: Grid canvas created.");
}

/** Returns the main rendering context. */
export function getContext() {
    return ctx;
}

/** Returns the context for the off-screen grid canvas. */
export function getGridContext() {
    return gridCtx;
}

/**
 * Returns the off-screen grid canvas HTML element itself.
 * @returns {HTMLCanvasElement | null} The grid canvas element or null if not created.
 */
export function getGridCanvas() {
    return gridCanvas;
}

/**
 * Clears the entire main canvas and fills with the background color.
 */
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