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
let gameWrapperEl = null; // To get dimensions for the main canvas

// --- Camera State ---
let cameraX = 0;
let cameraY = 0;
let actualCameraScale = 1.0; // This will be the ctx.scale() value, dynamically calculated
let currentZoomFactor = 1.0; // Player-controlled abstract zoom level (1.0 = fit height by default)

const MAX_ZOOM_FACTOR = Config.MAX_CAMERA_SCALE; // Use existing config for max abstract zoom
let MIN_ZOOM_FACTOR = Config.MIN_CAMERA_SCALE;   // Base min zoom, will be adjusted dynamically

// These represent the total dimensions of your game world.
// Config.CANVAS_WIDTH and Config.CANVAS_HEIGHT from config.js already serve this purpose.
const FULL_WORLD_PIXEL_WIDTH = Config.CANVAS_WIDTH;
const FULL_WORLD_PIXEL_HEIGHT = Config.CANVAS_HEIGHT;


// --- Private Helper Functions ---

function handleResize() {
    if (!canvas || !gameWrapperEl) return;

    const newWidth = gameWrapperEl.clientWidth;
    const newHeight = gameWrapperEl.clientHeight;

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        // console.log(`Renderer: Canvas resized to ${canvas.width}x${canvas.height}`);
    }

    // gridCanvas size remains fixed to the full world dimensions (handled by createGridCanvas)

    updateMinZoomFactorAndRecalculateScale(); // Update min zoom and actual scale based on new canvas size
                                          // This also effectively re-clamps currentZoomFactor if needed
}

function updateMinZoomFactorAndRecalculateScale() {
    if (!canvas || canvas.height === 0 || canvas.width === 0 || FULL_WORLD_PIXEL_HEIGHT === 0 || FULL_WORLD_PIXEL_WIDTH === 0) {
        MIN_ZOOM_FACTOR = Config.MIN_CAMERA_SCALE; // Fallback to config's absolute min
        actualCameraScale = 1.0;
        // console.warn("Renderer: Cannot update min zoom factor, canvas or world dimensions are zero.");
        return;
    }

    // Calculate the zoom factor needed to make the entire world width visible,
    // given that a zoomFactor of 1.0 makes the entire world height visible.
    const arCanvas = canvas.width / canvas.height;
    const arWorld = FULL_WORLD_PIXEL_WIDTH / FULL_WORLD_PIXEL_HEIGHT;

    // If arCanvas < arWorld, the canvas is "taller" or "less wide" than the world.
    // To fit width, we'd need to zoom out more (smaller zoomFactor).
    // If arCanvas > arWorld, the canvas is "wider" or "less tall" than the world.
    // To fit width, we'd need to zoom in relative to fitting height (larger zoomFactor, but still <=1.0 if world is wider).
    const zoomFactorToFitWidth = arCanvas / arWorld;

    // The minimum zoom factor should allow viewing either the full height (zoomFactor=1.0) or full width.
    // So, it's the smaller of 1.0 (fits height) and zoomFactorToFitWidth (fits width).
    MIN_ZOOM_FACTOR = Math.min(1.0, zoomFactorToFitWidth);


    // Now, also consider the absolute minimum scale from Config.js
    // We need to convert Config.MIN_CAMERA_SCALE (an absolute ctx.scale value)
    // to an equivalent currentZoomFactor.
    // actualCameraScale = (canvas.height / FULL_WORLD_PIXEL_HEIGHT) * currentZoomFactor
    // So, currentZoomFactor = actualCameraScale * FULL_WORLD_PIXEL_HEIGHT / canvas.height
    if (canvas.height > 0 && FULL_WORLD_PIXEL_HEIGHT > 0) {
        const baseScaleFactorForHeightFit = canvas.height / FULL_WORLD_PIXEL_HEIGHT;
        if (baseScaleFactorForHeightFit > 0) { // Avoid division by zero
            const minZoomFactorFromConfigLimit = Config.MIN_CAMERA_SCALE / baseScaleFactorForHeightFit;
            MIN_ZOOM_FACTOR = Math.max(MIN_ZOOM_FACTOR, minZoomFactorFromConfigLimit);
        } else {
             // Fallback if baseScaleFactorForHeightFit is zero or negative (shouldn't happen with positive dimensions)
            MIN_ZOOM_FACTOR = Math.max(MIN_ZOOM_FACTOR, 0.1); // Arbitrary small positive
        }
    } else {
        MIN_ZOOM_FACTOR = Math.max(MIN_ZOOM_FACTOR, 0.1);
    }


    // Re-clamp currentZoomFactor based on the new MIN_ZOOM_FACTOR
    currentZoomFactor = Math.max(MIN_ZOOM_FACTOR, Math.min(currentZoomFactor, MAX_ZOOM_FACTOR));

    // Recalculate actualCameraScale based on the (potentially clamped) currentZoomFactor
    if (canvas.height > 0 && FULL_WORLD_PIXEL_HEIGHT > 0) {
        const baseScaleToFitHeight = canvas.height / FULL_WORLD_PIXEL_HEIGHT;
        actualCameraScale = baseScaleToFitHeight * currentZoomFactor;
    } else {
        actualCameraScale = 1.0; // Fallback
    }
    // console.log(`Renderer: MinZoomFactor: ${MIN_ZOOM_FACTOR.toFixed(3)}, CurrentZoom: ${currentZoomFactor.toFixed(3)}, ActualScale: ${actualCameraScale.toFixed(3)}`);
}


// --- Public Functions ---

/** Initializes the main canvas and rendering context. */
export function init() {
    canvas = document.getElementById('game-canvas');
    gameWrapperEl = document.getElementById('game-wrapper'); // Get the game wrapper element

    if (!canvas) { throw new Error("Renderer: Canvas element 'game-canvas' not found!"); }
    if (!gameWrapperEl) { throw new Error("Renderer: Game wrapper element 'game-wrapper' not found!"); }

    // Initial resize to set canvas internal dimensions and calculate initial scales
    handleResize();

    ctx = canvas.getContext('2d');
    if (!ctx) { throw new Error("Renderer: Failed to get 2D context!"); }
    ctx.imageSmoothingEnabled = false;

    window.addEventListener('resize', handleResize); // Add resize listener
}

export function createGridCanvas() {
    gridCanvas = document.createElement('canvas');
    // Grid canvas dimensions are fixed to the full world size
    gridCanvas.width = FULL_WORLD_PIXEL_WIDTH;
    gridCanvas.height = FULL_WORLD_PIXEL_HEIGHT;
    gridCtx = gridCanvas.getContext('2d');
    if (!gridCtx) { throw new Error("Renderer: Failed to get 2D context for grid canvas!"); }
    gridCtx.imageSmoothingEnabled = false;
}

/** Returns the main rendering context. */
export function getContext() { return ctx; }
/** Returns the context for the off-screen grid canvas. */
export function getGridContext() { return gridCtx; }
/** Returns the off-screen grid canvas HTML element itself. */
export function getGridCanvas() { return gridCanvas; }

/** Clears the entire main canvas and fills with the background color */
export function clear() {
    if (!ctx || !canvas) {
        console.error("Renderer: Cannot clear - not initialized.");
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Only clear to transparent
}

export function clearRect(x, y, width, height) {
    if (!ctx) { console.error("Renderer: Cannot clearRect - not initialized."); return; }
    ctx.clearRect(x, y, width, height);
}

export function getCanvas() { return canvas; }

// --- Camera Management ---

// Helper function to get the fixed pixel width of the entire game world
function getWorldPixelWidth() { return FULL_WORLD_PIXEL_WIDTH; }
// Helper function to get the fixed pixel height of the entire game world
function getWorldPixelHeight() { return FULL_WORLD_PIXEL_HEIGHT; }


// New function to update the abstract zoom level
export function updateZoomLevel(deltaZoom) {
    const oldZoomFactor = currentZoomFactor;
    currentZoomFactor += deltaZoom;
    currentZoomFactor = Math.max(MIN_ZOOM_FACTOR, Math.min(currentZoomFactor, MAX_ZOOM_FACTOR));

    if (currentZoomFactor !== oldZoomFactor) {
         updateMinZoomFactorAndRecalculateScale(); // This will recalculate actualCameraScale
    }
}


export function calculateInitialCamera(player) {
    if (!canvas) {
        console.error("Renderer: Canvas not initialized for calculateInitialCamera.");
        return;
    }
    // Set initial zoom factor (e.g., to fit height or a default zoom)
    currentZoomFactor = 1.0; // Start with zoom factor 1 (fits world height)
    // currentZoomFactor = MIN_ZOOM_FACTOR; // Alternative: Start zoomed out to see full world if wider

    updateMinZoomFactorAndRecalculateScale(); // This sets actualCameraScale

    if (player && player.isActive) {
        const viewWidthOnCanvas = canvas.width;     // Current canvas width in CSS pixels
        const viewHeightOnCanvas = canvas.height;   // Current canvas height in CSS pixels

        // How much of the world (in world pixels) is visible with current actualCameraScale
        const visibleWorldWidth = viewWidthOnCanvas / actualCameraScale;
        const visibleWorldHeight = viewHeightOnCanvas / actualCameraScale;

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

        // If world is smaller than visible area (e.g., due to extreme zoom out), center it
        if (worldPixelWidthVal <= visibleWorldWidth) cameraX = (worldPixelWidthVal - visibleWorldWidth) / 2;
        if (worldPixelHeightVal <= visibleWorldHeight) cameraY = (worldPixelHeightVal - visibleWorldHeight) / 2;

    } else {
        cameraX = 0;
        cameraY = 0;
        // actualCameraScale is already set by updateMinZoomFactorAndRecalculateScale
    }
}

export function calculateCameraPosition(player, isGameRunning) {
    if (!canvas || !player || !player.isActive || !isGameRunning) return;

    const viewWidthOnCanvas = canvas.width;
    const viewHeightOnCanvas = canvas.height;
    // actualCameraScale is managed by zoom updates and resize

    const visibleWorldWidth = viewWidthOnCanvas / actualCameraScale;
    const visibleWorldHeight = viewHeightOnCanvas / actualCameraScale;

    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;

    let targetX = playerCenterX - (visibleWorldWidth / 2);
    let targetY = playerCenterY - (visibleWorldHeight / 2);

    cameraX = targetX; // Allow camera to follow player
    cameraY = targetY;

    const worldPixelWidthVal = getWorldPixelWidth();
    const worldPixelHeightVal = getWorldPixelHeight();

    // Clamp camera to world boundaries
    const maxCameraX = Math.max(0, worldPixelWidthVal - visibleWorldWidth);
    const maxCameraY = Math.max(0, worldPixelHeightVal - visibleWorldHeight);

    cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
    cameraY = Math.max(0, Math.min(cameraY, maxCameraY));

    // If the world is smaller than the viewport (e.g. zoomed out very far), center it
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
    renderCtx.scale(actualCameraScale, actualCameraScale); // Use the dynamic actualCameraScale
    renderCtx.translate(-cameraX, -cameraY);
}

export function restoreCameraTransforms(renderCtx) {
    if (!renderCtx) renderCtx = ctx;
    renderCtx.restore();
}

// --- Mouse Coordinate Conversion ---
/**
 * Converts mouse coordinates from the internal canvas space to world space.
 * This function accounts for camera translation (cameraX, cameraY) and the dynamic actualCameraScale.
 * @param {object} inputMousePos - Mouse position {x, y} relative to the *actual* canvas resolution.
 * @returns {object} Mouse position {x, y} in world coordinates.
 */
export function getMouseWorldCoords(inputMousePos) {
    if (!canvas) {
        console.error("Renderer: Canvas not initialized for getMouseWorldCoords.");
        return { x: 0, y: 0 }; // Fallback
    }
    // Fallback if inputMousePos is invalid: return the world coordinates of the center of the viewport.
    if (!inputMousePos || typeof inputMousePos.x !== 'number' || typeof inputMousePos.y !== 'number' || isNaN(inputMousePos.x) || isNaN(inputMousePos.y)) {
        console.warn("getMouseWorldCoords: Invalid inputMousePos, returning viewport center.", inputMousePos);
        return {
            x: cameraX + (canvas.width / 2) / actualCameraScale,
            y: cameraY + (canvas.height / 2) / actualCameraScale
        };
    }

    const worldX = (inputMousePos.x / actualCameraScale) + cameraX;
    const worldY = (inputMousePos.y / actualCameraScale) + cameraY;

    return { x: worldX, y: worldY };
}

export function getMouseGridCoords(inputMousePos) {
    const { x: worldX, y: worldY } = getMouseWorldCoords(inputMousePos); // Uses internal camera state
    return GridCollision.worldToGridCoords(worldX, worldY);
}

// Getter for the effective scale being applied to the context
export function getCameraScale() { return actualCameraScale; }
// Getter for the player-controlled abstract zoom factor
export function getCurrentZoomFactor() { return currentZoomFactor; }