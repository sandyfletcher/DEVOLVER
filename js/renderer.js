// -----------------------------------------------------------------------------
// js/renderer.js - Handles Canvas Setup and Drawing Operations
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as GridCollision from './utils/gridCollision.js'; // For worldToGridCoords

// --- Module State ---
let canvas = null;
let ctx = null;
let gridCanvas = null; // The off-screen canvas element
let gridCtx = null;    // The context for the off-screen canvas

// --- Camera State ---
let cameraX = 0;
let cameraY = 0;
let cameraScale = 1.0;

// --- Public Functions ---
/** Initializes the main canvas and rendering context. */
export function init() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) { throw new Error("Renderer: Canvas element 'game-canvas' not found!"); }

    canvas.width = Config.CANVAS_WIDTH;
    canvas.height = Config.CANVAS_HEIGHT;

    ctx = canvas.getContext('2d');
    if (!ctx) { throw new Error("Renderer: Failed to get 2D context!"); }
    ctx.imageSmoothingEnabled = false;
}
export function createGridCanvas() {
    gridCanvas = document.createElement('canvas');
    gridCanvas.width = Config.CANVAS_WIDTH;
    gridCanvas.height = Config.CANVAS_HEIGHT;
    gridCtx = gridCanvas.getContext('2d');
    if (!gridCtx) { throw new Error("Renderer: Failed to get 2D context for grid canvas!"); }
    gridCtx.imageSmoothingEnabled = false;
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

export function clearRect(x, y, width, height) {
    if (!ctx) { console.error("Renderer: Cannot clearRect - not initialized."); return; }
    ctx.clearRect(x, y, width, height);
}

export function getCanvas() {
    return canvas;
}

// --- Camera Management ---
function getWorldPixelWidth() { return Config.CANVAS_WIDTH; } // Assuming world width matches canvas width for now
function getWorldPixelHeight() { return Config.GRID_ROWS * Config.BLOCK_HEIGHT; }

export function updateCameraScale(deltaScale) {
    let newScale = cameraScale + deltaScale;
    const internalCanvasWidth = Config.CANVAS_WIDTH;
    const internalCanvasHeight = Config.CANVAS_HEIGHT;
    const worldPixelWidthVal = getWorldPixelWidth();
    const worldPixelHeightVal = getWorldPixelHeight();

    const scaleToFitWidth = (worldPixelWidthVal > 0) ? internalCanvasWidth / worldPixelWidthVal : 1;
    const scaleToFitHeight = (worldPixelHeightVal > 0) ? internalCanvasHeight / worldPixelHeightVal : 1;
    const minScaleRequired = Math.max(scaleToFitWidth, scaleToFitHeight); // Ensure world is always at least filling one dimension

    const effectiveMinScale = Math.max(Config.MIN_CAMERA_SCALE, minScaleRequired);
    newScale = Math.max(effectiveMinScale, Math.min(newScale, Config.MAX_CAMERA_SCALE));
    cameraScale = newScale;
}

export function calculateInitialCamera(player) {
    if (player && player.isActive) {
        const viewWidth = Config.CANVAS_WIDTH;
        const viewHeight = Config.CANVAS_HEIGHT;
        cameraScale = 1.0; // Start with default scale
        const visibleWorldWidth = viewWidth / cameraScale;
        const visibleWorldHeight = viewHeight / cameraScale;

        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;

        let targetX = playerCenterX - (visibleWorldWidth / 2);
        let targetY = playerCenterY - (visibleWorldHeight / 2);

        const worldPixelWidthVal = getWorldPixelWidth();
        const worldPixelHeightVal = getWorldPixelHeight();
        const maxCameraX = Math.max(0, worldPixelWidthVal - visibleWorldWidth);
        const maxCameraY = Math.max(0, worldPixelHeightVal - visibleWorldHeight);

        cameraX = Math.max(0, Math.min(targetX, maxCameraX));
        cameraY = Math.max(0, Math.min(targetY, maxCameraY));

        if (worldPixelWidthVal <= visibleWorldWidth) cameraX = (worldPixelWidthVal - visibleWorldWidth) / 2;
        if (worldPixelHeightVal <= visibleWorldHeight) cameraY = (worldPixelHeightVal - visibleWorldHeight) / 2;
    } else {
        cameraX = 0;
        cameraY = 0;
        cameraScale = 1.0;
    }
}

export function calculateCameraPosition(player, isGameRunning) {
    if (!player || !player.isActive || !isGameRunning) return;

    const viewWidth = Config.CANVAS_WIDTH;
    const viewHeight = Config.CANVAS_HEIGHT;
    const visibleWorldWidth = viewWidth / cameraScale;
    const visibleWorldHeight = viewHeight / cameraScale;

    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;

    let targetX = playerCenterX - (visibleWorldWidth / 2);
    let targetY = playerCenterY - (visibleWorldHeight / 2);

    cameraX = targetX; // Allow camera to follow player even if world is smaller than viewport
    cameraY = targetY;

    const worldPixelWidthVal = getWorldPixelWidth();
    const worldPixelHeightVal = getWorldPixelHeight();

    const maxCameraX = Math.max(0, worldPixelWidthVal - visibleWorldWidth);
    const maxCameraY = Math.max(0, worldPixelHeightVal - visibleWorldHeight);

    cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
    cameraY = Math.max(0, Math.min(cameraY, maxCameraY));

    // If the world is smaller than the viewport, center it
    if (worldPixelWidthVal <= visibleWorldWidth) {
        cameraX = (worldPixelWidthVal - visibleWorldWidth) / 2;
    }
    if (worldPixelHeightVal <= visibleWorldHeight) {
        cameraY = (worldPixelHeightVal - visibleWorldHeight) / 2;
    }
}

export function applyCameraTransforms(renderCtx) {
    if (!renderCtx) renderCtx = ctx; // Default to main context
    renderCtx.save();
    renderCtx.scale(cameraScale, cameraScale);
    renderCtx.translate(-cameraX, -cameraY);
}

export function restoreCameraTransforms(renderCtx) {
    if (!renderCtx) renderCtx = ctx;
    renderCtx.restore();
}

// --- Mouse Coordinate Conversion ---
export function getMouseWorldCoords(inputMousePos) {
    if (!inputMousePos || typeof inputMousePos.x !== 'number' || typeof inputMousePos.y !== 'number' || isNaN(inputMousePos.x) || isNaN(inputMousePos.y)) {
        return {
            x: cameraX + (Config.CANVAS_WIDTH / 2) / cameraScale,
            y: cameraY + (Config.CANVAS_HEIGHT / 2) / cameraScale
        };
    }
    const worldX = cameraX + (inputMousePos.x / cameraScale);
    const worldY = cameraY + (inputMousePos.y / cameraScale);
    return { x: worldX, y: worldY };
}

export function getMouseGridCoords(inputMousePos) {
    const { x: worldX, y: worldY } = getMouseWorldCoords(inputMousePos); // Uses internal camera state
    return GridCollision.worldToGridCoords(worldX, worldY);
}

export function getCameraScale() { return cameraScale; }