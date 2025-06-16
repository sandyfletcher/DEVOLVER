// =============================================================================
// js/renderer.js - Canvas Setup and Drawing Operations
// =============================================================================

import * as Config from './config.js';
import * as GridCollision from './gridCollision.js';
import * as DebugLogger from './debugLogger.js';

let canvas = null;
let ctx = null;
let gridCanvas = null; // off-screen canvas element
let gridCtx = null; // context for off-screen canvas
let gameWrapperEl = null; // get dimensions for main canvas
let cameraX = 0;
let cameraY = 0;
let actualCameraScale = 1.0; // ctx.scale() value, dynamically calculated
let currentZoomFactor = 1.0; // player-controlled abstract zoom level (1.0 = fit height by default)
const MAX_ZOOM_FACTOR = Config.MAX_CAMERA_SCALE; // Use existing config for max abstract zoom
let MIN_ZOOM_FACTOR = 0.1; // Default initial value, will be dynamically calculated
const FULL_WORLD_PIXEL_WIDTH = Config.CANVAS_WIDTH; // total dimensions of game world
const FULL_WORLD_PIXEL_HEIGHT = Config.CANVAS_HEIGHT;

function _getWorldPixelWidth() { return FULL_WORLD_PIXEL_WIDTH; } // get fixed pixel width of entire game world
function _getWorldPixelHeight() { return FULL_WORLD_PIXEL_HEIGHT; } // fixed pixel height

function _handleResize() {
    if (!canvas || !gameWrapperEl) return;
    const newDisplayWidth = gameWrapperEl.clientWidth;
    const newDisplayHeight = gameWrapperEl.clientHeight;
    // Only update canvas's internal drawing buffer dimensions if the wrapper has positive size.
    if (newDisplayWidth > 0 && newDisplayHeight > 0) {
        if (canvas.width !== newDisplayWidth || canvas.height !== newDisplayHeight) {
            canvas.width = newDisplayWidth;
            canvas.height = newDisplayHeight;
            DebugLogger.log(`Renderer: Canvas drawing buffer resized to ${canvas.width}x${canvas.height}`);
        }
    }
    _updateMinZoomFactorAndRecalculateScale(); // update min zoom and actual scale based on current canvas dimensions
}

function _updateMinZoomFactorAndRecalculateScale() {
    if (!canvas || canvas.height <= 0 || canvas.width <= 0 || FULL_WORLD_PIXEL_HEIGHT <= 0 || FULL_WORLD_PIXEL_WIDTH <= 0) {
        MIN_ZOOM_FACTOR = 0.1; // Fallback relative min zoom factor
        actualCameraScale = 1.0; // Fallback actual scale
        // Attempt to clamp currentZoomFactor even in fallback
        currentZoomFactor = Math.max(MIN_ZOOM_FACTOR, Math.min(currentZoomFactor, MAX_ZOOM_FACTOR));
        if (canvas && canvas.height > 0 && FULL_WORLD_PIXEL_HEIGHT > 0) {
             actualCameraScale = (canvas.height / FULL_WORLD_PIXEL_HEIGHT) * currentZoomFactor;
        } else if (canvas) { // if only canvas exists but world dims might be bad
            actualCameraScale = currentZoomFactor; // A less ideal fallback
        }
        DebugLogger.warn("Renderer: Cannot update min zoom factor due to invalid canvas/world dimensions. Using fallbacks.");
        return;
    }

    const canvasAspectRatio = canvas.width / canvas.height;
    const worldAspectRatio = FULL_WORLD_PIXEL_WIDTH / FULL_WORLD_PIXEL_HEIGHT;

    // Calculate the zoomFactor relative to 'fit-height' (where zoomFactor=1.0)
    // that would be required to make the world's width fit the canvas's width.
    const zoomFactorToFitCanvasWidth = canvasAspectRatio / worldAspectRatio;

    // MIN_ZOOM_FACTOR must be large enough so that:
    // 1. If we fit height (zoomFactor = 1.0), width is also contained (pillarboxed if world is narrower).
    // 2. If we fit width (zoomFactor = zoomFactorToFitCanvasWidth), height is also contained (letterboxed if world is shorter).
    // So, it's the larger of these two requirements for the relative zoom factor.
    MIN_ZOOM_FACTOR = Math.max(zoomFactorToFitCanvasWidth, 1.0);

    // Clamp currentZoomFactor using the dynamically calculated MIN_ZOOM_FACTOR and the configured MAX_ZOOM_FACTOR
    currentZoomFactor = Math.max(MIN_ZOOM_FACTOR, Math.min(currentZoomFactor, MAX_ZOOM_FACTOR));

    // Calculate the actualCameraScale.
    // Base scale is what's needed to fit world height to canvas height.
    const baseScaleToFitHeight = canvas.height / FULL_WORLD_PIXEL_HEIGHT;
    actualCameraScale = baseScaleToFitHeight * currentZoomFactor;

    // As a final hard limit, ensure the actualCameraScale is not less than Config.MIN_CAMERA_SCALE (absolute).
    // This prevents visuals from becoming too small, even if the relative zoom math allows it.
    if (Config.MIN_CAMERA_SCALE > 0 && actualCameraScale < Config.MIN_CAMERA_SCALE) {
        actualCameraScale = Config.MIN_CAMERA_SCALE;
        // If actualCameraScale was clamped by the absolute minimum, recalculate currentZoomFactor
        // to maintain consistency. This might mean currentZoomFactor slightly exceeds MIN_ZOOM_FACTOR
        // if Config.MIN_CAMERA_SCALE forces a "more zoomed in" view than strictly necessary to contain the world.
        currentZoomFactor = actualCameraScale / baseScaleToFitHeight;
        // Re-clamp currentZoomFactor with the new MIN_ZOOM_FACTOR just in case the above pushed it out of bounds
        // although it's more likely to be correct or higher than MIN_ZOOM_FACTOR here.
         currentZoomFactor = Math.max(MIN_ZOOM_FACTOR, Math.min(currentZoomFactor, MAX_ZOOM_FACTOR));
    }
    
    DebugLogger.log(`Renderer: MinZoomFactor (relative): ${MIN_ZOOM_FACTOR.toFixed(3)}, CurrentZoomFactor (relative): ${currentZoomFactor.toFixed(3)}, ActualCameraScale (absolute): ${actualCameraScale.toFixed(3)}`);
}

export function getContext() { return ctx; } // main rendering context
export function getGridContext() { return gridCtx; } // context for off-screen grid canvas
export function getGridCanvas() { return gridCanvas; } // off-screen grid canvas HTML element itself
export function getCanvas() { return canvas; }
export function getCameraScale() { return actualCameraScale; } // effective scale applied
export function getCurrentZoomFactor() { return currentZoomFactor; } // player-controlled zoom factor

export function init() { // initialize main canvas and rendering context
    canvas = document.getElementById('game-canvas');
    gameWrapperEl = document.getElementById('game-wrapper'); // game wrapper element
    if (!canvas) { throw new Error("Renderer: Canvas element 'game-canvas' not found!"); }
    if (!gameWrapperEl) { throw new Error("Renderer: Game wrapper element 'game-wrapper' not found!"); }
    
    // Initial call to set MIN_ZOOM_FACTOR before currentZoomFactor might be used
    // Ensure canvas has dimensions before calling this.
    // A bit of a chicken-and-egg, but _handleResize sets canvas dimensions if wrapper is visible.
    // If not visible, we use defaults.
    if (gameWrapperEl.clientWidth > 0 && gameWrapperEl.clientHeight > 0) {
        canvas.width = gameWrapperEl.clientWidth;
        canvas.height = gameWrapperEl.clientHeight;
    } else {
        // Fallback if wrapper isn't rendered yet (e.g., display:none initially)
        // Use a reasonable default or values from config if available.
        // The aspect-ratio CSS on #app-container might mean we can't rely on fixed width/height from canvas tag.
        // This path should ideally be hit less often if app-container has a defined size.
        const initialAppContainerWidth = parseFloat(getComputedStyle(document.getElementById('app-container')).width);
        const initialAppContainerHeight = parseFloat(getComputedStyle(document.getElementById('app-container')).height);
        // Prioritize game-wrapper's explicit canvas, but fallback to app-container if canvas parent is hidden
        canvas.width = initialAppContainerWidth > 0 ? initialAppContainerWidth : 800; 
        canvas.height = initialAppContainerHeight > 0 ? initialAppContainerHeight : 400;
        DebugLogger.warn(`Renderer init: gameWrapperEl has no dimensions. Using fallback canvas size: ${canvas.width}x${canvas.height}`);
    }

    _updateMinZoomFactorAndRecalculateScale(); // Calculate initial dynamic MIN_ZOOM_FACTOR
    
    ctx = canvas.getContext('2d');
    if (!ctx) { throw new Error("Renderer: Failed to get 2D context!"); }
    ctx.imageSmoothingEnabled = false;
    window.addEventListener('resize', _handleResize); // resize listener
}

export function createGridCanvas() {
    gridCanvas = document.createElement('canvas');
    gridCanvas.width = FULL_WORLD_PIXEL_WIDTH; // grid canvas dimensions are fixed to the full world size
    gridCanvas.height = FULL_WORLD_PIXEL_HEIGHT;
    gridCtx = gridCanvas.getContext('2d');
    if (!gridCtx) { throw new Error("Renderer: Failed to get 2D context for grid canvas!"); }
    gridCtx.imageSmoothingEnabled = false;
}

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

export function updateZoomLevel(deltaZoom) { // update abstract zoom level
    const oldZoomFactor = currentZoomFactor;
    currentZoomFactor += deltaZoom;
    // MIN_ZOOM_FACTOR is now dynamically calculated, so clamping happens correctly here.
    currentZoomFactor = Math.max(MIN_ZOOM_FACTOR, Math.min(currentZoomFactor, MAX_ZOOM_FACTOR));
    if (currentZoomFactor !== oldZoomFactor) {
        _updateMinZoomFactorAndRecalculateScale(); // recalculate actualCameraScale
    }
}

export function calculateInitialCamera(player) {
    if (!canvas) {
        console.error("Renderer: Canvas not initialized for calculateInitialCamera.");
        return;
    }
    currentZoomFactor = 1.0; // start with zoom factor 1 (fits world height by default, will be clamped by new MIN_ZOOM_FACTOR if necessary)
    _updateMinZoomFactorAndRecalculateScale(); // set actualCameraScale and clamp currentZoomFactor

    if (player && player.isActive) {
        const viewWidthOnCanvas = canvas.width;     // current canvas dimensions in CSS pixels
        const viewHeightOnCanvas = canvas.height;   
        const visibleWorldWidth = viewWidthOnCanvas / actualCameraScale; // how much world is visible with current actualCameraScale
        const visibleWorldHeight = viewHeightOnCanvas / actualCameraScale;
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        let targetX = playerCenterX - (visibleWorldWidth / 2);
        let targetY = playerCenterY - (visibleWorldHeight / 2);
        const worldPixelWidthVal = _getWorldPixelWidth();
        const worldPixelHeightVal = _getWorldPixelHeight();
        const maxCameraX = Math.max(0, worldPixelWidthVal - visibleWorldWidth);
        const maxCameraY = Math.max(0, worldPixelHeightVal - visibleWorldHeight);
        cameraX = Math.max(0, Math.min(targetX, maxCameraX));
        cameraY = Math.max(0, Math.min(targetY, maxCameraY));
        if (worldPixelWidthVal <= visibleWorldWidth + GridCollision.E_EPSILON) cameraX = (worldPixelWidthVal - visibleWorldWidth) / 2; // center if world is smaller than or equal to visible area
        if (worldPixelHeightVal <= visibleWorldHeight + GridCollision.E_EPSILON) cameraY = (worldPixelHeightVal - visibleWorldHeight) / 2;
    } else {
        cameraX = 0; // Center camera if no player
        cameraY = 0;
        if (FULL_WORLD_PIXEL_WIDTH > 0 && FULL_WORLD_PIXEL_HEIGHT > 0 && actualCameraScale > 0) {
             const visibleWorldWidth = canvas.width / actualCameraScale;
             const visibleWorldHeight = canvas.height / actualCameraScale;
             if (FULL_WORLD_PIXEL_WIDTH <= visibleWorldWidth) cameraX = (FULL_WORLD_PIXEL_WIDTH - visibleWorldWidth) / 2;
             if (FULL_WORLD_PIXEL_HEIGHT <= visibleWorldHeight) cameraY = (FULL_WORLD_PIXEL_HEIGHT - visibleWorldHeight) / 2;
        }
    }
}

export function calculateCameraPosition(player, isGameRunning) {
    if (!canvas || !player || !player.isActive || !isGameRunning) return;
    const viewWidthOnCanvas = canvas.width;
    const viewHeightOnCanvas = canvas.height;
    const visibleWorldWidth = viewWidthOnCanvas / actualCameraScale; 
    const visibleWorldHeight = viewHeightOnCanvas / actualCameraScale;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    let targetX = playerCenterX - (visibleWorldWidth / 2);
    let targetY = playerCenterY - (visibleWorldHeight / 2);
    cameraX = targetX; 
    cameraY = targetY;
    const worldPixelWidthVal = _getWorldPixelWidth();
    const worldPixelHeightVal = _getWorldPixelHeight();
    const maxCameraX = Math.max(0, worldPixelWidthVal - visibleWorldWidth); 
    const maxCameraY = Math.max(0, worldPixelHeightVal - visibleWorldHeight);
    cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
    cameraY = Math.max(0, Math.min(cameraY, maxCameraY));
    // If the world is smaller than the visible area after zoom, center the world in the viewport
    if (worldPixelWidthVal <= visibleWorldWidth + GridCollision.E_EPSILON) { 
        cameraX = (worldPixelWidthVal - visibleWorldWidth) / 2;
    }
    if (worldPixelHeightVal <= visibleWorldHeight + GridCollision.E_EPSILON) {
        cameraY = (worldPixelHeightVal - visibleWorldHeight) / 2;
    }
}

export function applyCameraTransforms(renderCtx) {
    if (!renderCtx) renderCtx = ctx; // default to main context
    if (!renderCtx) return; // Still possible ctx is null if init failed badly
    renderCtx.save();
    renderCtx.scale(actualCameraScale, actualCameraScale); 
    renderCtx.translate(-cameraX, -cameraY);
}

export function restoreCameraTransforms(renderCtx) {
    if (!renderCtx) renderCtx = ctx;
    if (!renderCtx) return;
    renderCtx.restore();
}

export function getMouseWorldCoords(inputMousePos) { 
    if (!canvas || actualCameraScale === 0) { // Added actualCameraScale === 0 check
        DebugLogger.error("Renderer: Canvas not initialized or camera scale is zero for getMouseWorldCoords.");
        return { x: 0, y: 0 }; 
    }
    if (!inputMousePos || typeof inputMousePos.x !== 'number' || typeof inputMousePos.y !== 'number' || isNaN(inputMousePos.x) || isNaN(inputMousePos.y)) {
        DebugLogger.warn("getMouseWorldCoords: Invalid inputMousePos, returning viewport center.", inputMousePos);
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
    const { x: worldX, y: worldY } = getMouseWorldCoords(inputMousePos); 
    return GridCollision.worldToGridCoords(worldX, worldY);
}