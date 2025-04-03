// -----------------------------------------------------------------------------
// renderer.js - Handles Canvas Setup and Basic Drawing Operations
// -----------------------------------------------------------------------------
console.log("renderer.js loaded");

import * as Config from './config.js'; // For canvas dimensions, background color

// --- Module State ---
let canvas = null;
let ctx = null;

// --- Public Functions ---

/**
 * Initializes the renderer by getting the canvas and context.
 * Must be called before any drawing operations.
 */
export function init() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) {
        throw new Error("Renderer: Canvas element with ID 'game-canvas' not found!");
    }

    // Set internal canvas dimensions explicitly from config
    canvas.width = Config.CANVAS_WIDTH;
    canvas.height = Config.CANVAS_HEIGHT;

    ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error("Renderer: Failed to get 2D rendering context!");
    }

    console.log("Renderer initialized successfully.");
}

/**
 * Clears the entire canvas and fills with the background color.
 */
export function clear() {
    if (!ctx || !canvas) {
        console.error("Renderer: Cannot clear - not initialized.");
        return;
    }
    // Clear the rectangle
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Optionally fill with background color (good practice)
    ctx.fillStyle = Config.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Returns the 2D rendering context.
 * @returns {CanvasRenderingContext2D | null} The context, or null if not initialized.
 */
export function getContext() {
    return ctx;
}

/**
 * Returns the canvas element.
 * @returns {HTMLCanvasElement | null} The canvas element, or null if not initialized.
 */
export function getCanvas() {
    return canvas;
}

// --- Future Drawing Helpers (Examples) ---
/*
export function drawRect(x, y, width, height, color) {
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
}

export function drawText(text, x, y, color = 'white', font = '16px sans-serif') {
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.fillText(text, x, y);
}
*/