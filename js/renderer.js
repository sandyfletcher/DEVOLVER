// =============================================================================
// js/renderer.js - Canvas Setup and Drawing Operations
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as GridCollision from './utils/gridCollision.js';

let canvas = null;
let ctx = null;
let gridCanvas = null; // off-screen canvas element
let gridCtx = null;    // context for off-screen canvas
let gameWrapperEl = null; // get dimensions for main canvas
let cameraX = 0;
let cameraY = 0;
let actualCameraScale = 1.0; // ctx.scale() value, dynamically calculated
let currentZoomFactor = 1.0; // player-controlled abstract zoom level (1.0 = fit height by default)
const MAX_ZOOM_FACTOR = Config.MAX_CAMERA_SCALE; // use existing config for max abstract zoom
let MIN_ZOOM_FACTOR = Config.MIN_CAMERA_SCALE;   // base min zoom, will be adjusted dynamically
const FULL_WORLD_PIXEL_WIDTH = Config.CANVAS_WIDTH; // total dimensions of game world
const FULL_WORLD_PIXEL_HEIGHT = Config.CANVAS_HEIGHT;

function handleResize() {
    if (!canvas || !gameWrapperEl) return;
    const newWidth = gameWrapperEl.clientWidth;
    const newHeight = gameWrapperEl.clientHeight;
    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        console.log(`Renderer: Canvas resized to ${canvas.width}x${canvas.height}`);
    } // gridCanvas size remains fixed to the full world dimensions (handled by createGridCanvas)
    updateMinZoomFactorAndRecalculateScale(); // update min zoom and actual scale based on new canvas size,  also effectively re-clamps currentZoomFactor if needed
}

function updateMinZoomFactorAndRecalculateScale() {
    if (!canvas || canvas.height === 0 || canvas.width === 0 || FULL_WORLD_PIXEL_HEIGHT === 0 || FULL_WORLD_PIXEL_WIDTH === 0) {
        MIN_ZOOM_FACTOR = Config.MIN_CAMERA_SCALE; // fallback to config's absolute min
        actualCameraScale = 1.0;
        console.warn("Renderer: Cannot update min zoom factor, canvas or world dimensions are zero.");
        return;
    }
    const arCanvas = canvas.width / canvas.height; // Calculate the zoom factor needed to make the entire world width visible, given that a zoomFactor of 1.0 makes the entire world height visible.
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

export function init() { // Initializes the main canvas and rendering context. */
    canvas = document.getElementById('game-canvas');
    gameWrapperEl = document.getElementById('game-wrapper'); // Get the game wrapper element
    if (!canvas) { throw new Error("Renderer: Canvas element 'game-canvas' not found!"); }
    if (!gameWrapperEl) { throw new Error("Renderer: Game wrapper element 'game-wrapper' not found!"); }
    handleResize(); // initial resize to set canvas internal dimensions and calculate initial scales
    ctx = canvas.getContext('2d');
    if (!ctx) { throw new Error("Renderer: Failed to get 2D context!"); }
    ctx.imageSmoothingEnabled = false;
    window.addEventListener('resize', handleResize); // resize listener
}

export function createGridCanvas() {
    gridCanvas = document.createElement('canvas');
    gridCanvas.width = FULL_WORLD_PIXEL_WIDTH; // grid canvas dimensions are fixed to the full world size
    gridCanvas.height = FULL_WORLD_PIXEL_HEIGHT;
    gridCtx = gridCanvas.getContext('2d');
    if (!gridCtx) { throw new Error("Renderer: Failed to get 2D context for grid canvas!"); }
    gridCtx.imageSmoothingEnabled = false;
}

export function getContext() { return ctx; } //main rendering context
export function getGridContext() { return gridCtx; } // context for off-screen grid canvas
export function getGridCanvas() { return gridCanvas; } // off-screen grid canvas HTML element itself

export function clear() { // clears entire main canvas and fills with the background color
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

function getWorldPixelWidth() { return FULL_WORLD_PIXEL_WIDTH; } // get fixed pixel width of entire game world
function getWorldPixelHeight() { return FULL_WORLD_PIXEL_HEIGHT; } // fixed pixel height

export function updateZoomLevel(deltaZoom) { //  update abstract zoom level
    const oldZoomFactor = currentZoomFactor;
    currentZoomFactor += deltaZoom;
    currentZoomFactor = Math.max(MIN_ZOOM_FACTOR, Math.min(currentZoomFactor, MAX_ZOOM_FACTOR));

    if (currentZoomFactor !== oldZoomFactor) {
         updateMinZoomFactorAndRecalculateScale(); // recalculate actualCameraScale
    }
}
export function calculateInitialCamera(player) {
    if (!canvas) {
        console.error("Renderer: Canvas not initialized for calculateInitialCamera.");
        return;
    }
    currentZoomFactor = 1.0; // start with zoom factor 1 (fits world height)
    updateMinZoomFactorAndRecalculateScale(); // set actualCameraScale
    if (player && player.isActive) {
        const viewWidthOnCanvas = canvas.width;     // current canvas dimensions in CSS pixels
        const viewHeightOnCanvas = canvas.height;   
        const visibleWorldWidth = viewWidthOnCanvas / actualCameraScale; // how much world is visible with current actualCameraScale
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
        if (worldPixelWidthVal <= visibleWorldWidth) cameraX = (worldPixelWidthVal - visibleWorldWidth) / 2; // center if world is smaller than visible area
        if (worldPixelHeightVal <= visibleWorldHeight) cameraY = (worldPixelHeightVal - visibleWorldHeight) / 2;
    } else {
        cameraX = 0;
        cameraY = 0; // actualCameraScale is already set by updateMinZoomFactorAndRecalculateScale
    }
}
export function calculateCameraPosition(player, isGameRunning) {
    if (!canvas || !player || !player.isActive || !isGameRunning) return;
    const viewWidthOnCanvas = canvas.width;
    const viewHeightOnCanvas = canvas.height;
    const visibleWorldWidth = viewWidthOnCanvas / actualCameraScale; // actualCameraScale is managed by zoom resize
    const visibleWorldHeight = viewHeightOnCanvas / actualCameraScale;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    let targetX = playerCenterX - (visibleWorldWidth / 2);
    let targetY = playerCenterY - (visibleWorldHeight / 2);
    cameraX = targetX; // camera follows player
    cameraY = targetY;
    const worldPixelWidthVal = getWorldPixelWidth();
    const worldPixelHeightVal = getWorldPixelHeight();
    const maxCameraX = Math.max(0, worldPixelWidthVal - visibleWorldWidth); // clamp camera to world boundaries
    const maxCameraY = Math.max(0, worldPixelHeightVal - visibleWorldHeight);
    cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
    cameraY = Math.max(0, Math.min(cameraY, maxCameraY));
    if (worldPixelWidthVal <= visibleWorldWidth) { // center if world is smaller than viewport
        cameraX = (worldPixelWidthVal - visibleWorldWidth) / 2;
    }
    if (worldPixelHeightVal <= visibleWorldHeight) {
        cameraY = (worldPixelHeightVal - visibleWorldHeight) / 2;
    }
}
export function applyCameraTransforms(renderCtx) {
    if (!renderCtx) renderCtx = ctx; // default to main context
    renderCtx.save();
    renderCtx.scale(actualCameraScale, actualCameraScale); // use dynamic actualCameraScale
    renderCtx.translate(-cameraX, -cameraY);
}
export function restoreCameraTransforms(renderCtx) {
    if (!renderCtx) renderCtx = ctx;
    renderCtx.restore();
}
export function getMouseWorldCoords(inputMousePos) { // converts mouse coordinates from the internal canvas space to world space
    if (!canvas) {
        console.error("Renderer: Canvas not initialized for getMouseWorldCoords.");
        return { x: 0, y: 0 }; // fallback for no canvas
    }
    if (!inputMousePos || typeof inputMousePos.x !== 'number' || typeof inputMousePos.y !== 'number' || isNaN(inputMousePos.x) || isNaN(inputMousePos.y)) {
        console.warn("getMouseWorldCoords: Invalid inputMousePos, returning viewport center.", inputMousePos);
        return { // fallback for no inputMousePos
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
export function getCameraScale() { return actualCameraScale; } // effective scale applied
export function getCurrentZoomFactor() { return currentZoomFactor; } // player-controlled zoom factor