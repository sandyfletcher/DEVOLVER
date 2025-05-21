// -----------------------------------------------------------------------------
// root/js/inputmanager.js - Handles Keyboard and Touch Input
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';

let canvas = null;
let appContainer = null;

export const state = { // Input State holds the *current* state of actions, modified by keyboard/mouse
    left: false,
    right: false,
    jump: false,
    attack: false, // Remains true while key/mouse button held
    downAction: false,
    internalMouseX: 0,
    internalMouseY: 0,
};

const keyMap = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump',
    ArrowDown: 'downAction', s: 'downAction', S: 'downAction',
    f: 'attack', F: 'attack',
    Escape: 'pause',
};

// --- Keyboard Event Handlers ---
const handleKeyDown = (e) => {
    const action = keyMap[e.key];
    if (action) {
        e.preventDefault();
        // Handle continuous/holdable actions (movement, jump, attack)
        if (action !== 'pause') {
            state[action] = true;
        }
        else if (action === 'pause') { // Handle immediate actions (pause)
            if (typeof window.pauseGameCallback === 'function') {
                window.pauseGameCallback();
            } else {
                console.warn("Input: Pause callback not found or not a function!");
            }
        }
    }
};

const handleKeyUp = (e) => {
    const action = keyMap[e.key];
    if (action) {
        if (action !== 'pause') {
            state[action] = false;
        }
    }
};

function getInternalMouseCoords(e) {
    if (!canvas) return { x: state.internalMouseX, y: state.internalMouseY };
    const rect = canvas.getBoundingClientRect();
    // If canvas.width/height are set to rect.width/height, no further scaling needed here.
    let internalX = e.clientX - rect.left;
    let internalY = e.clientY - rect.top;

    // Clamp to canvas dimensions (0 to canvas.width/height)
    internalX = Math.max(0, Math.min(internalX, canvas.width));
    internalY = Math.max(0, Math.min(internalY, canvas.height));

    return { x: internalX, y: internalY };
}

const handleMouseDown = (e) => {
    if (e.target === canvas) {
        const coords = getInternalMouseCoords(e);
        state.internalMouseX = coords.x;
        state.internalMouseY = coords.y;
        if (e.button === 0) { // Left click
            if (!state.attack) {
                state.attack = true;
            }
            e.preventDefault();
        }
    }
};

const handleMouseUp = (e) => {
     if (e.target === canvas) {
        if (e.button === 0) { // Left click release
            state.attack = false;
        }
    }
};

const handleMouseMove = (e) => {
    if (canvas) {
        const coords = getInternalMouseCoords(e);
        state.internalMouseX = coords.x;
        state.internalMouseY = coords.y;
    }
};

const handleWheel = (e) => {
     if (!appContainer || !appContainer.contains(e.target)) {
        return;
    }
    e.preventDefault();
    const deltaScale = -e.deltaY * Config.ZOOM_SPEED_FACTOR;
    if (typeof window.updateCameraScale === 'function') {
        window.updateCameraScale(deltaScale);
    } else {
        console.warn("Input: window.updateCameraScale function not found!");
    }
};

const handleTouchStart = (e) => {
    // Prevent default browser actions like scrolling/zooming IF touch is on canvas or item box
    const touchedElement = e.target;
    const isItemBox = touchedElement.classList.contains('item-box');
    const isCanvas = touchedElement === canvas;

    if (isItemBox || isCanvas) {
        e.preventDefault(); // Prevent default only for game-interactive elements
    }

    // Only process touches on the canvas (for attack) or item boxes (for selection)
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const touchedEl = document.elementFromPoint(touch.clientX, touch.clientY);

        if (touchedEl === canvas) {
            // Touch started on the canvas - treat as 'attack'
            const coords = getInternalMouseCoords(touch);
            state.internalMouseX = coords.x; // Update aiming coords
            state.internalMouseY = coords.y;
            if (!state.attack) {
                state.attack = true;
            }
        } else if (touchedEl && touchedEl.classList.contains('item-box')) {
            // Touch started on an item/weapon slot - trigger its click handler
            touchedEl.click(); // Use the existing click handler for selection
        }
    }
};

const handleTouchMove = (e) => {
    // Update aiming coordinates if touch moves over the canvas
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        // Check if touch is currently over the canvas
        const touchedEl = document.elementFromPoint(touch.clientX, touch.clientY);
        if (touchedEl === canvas) {
            const coords = getInternalMouseCoords(touch);
            state.internalMouseX = coords.x;
            state.internalMouseY = coords.y;
            // Potentially prevent default if touch *stays* over canvas? Maybe not needed.
            // e.preventDefault();
            break; // Process only one relevant touch move
        }
    }
};

const handleTouchEnd = (e) => {
    // Check if a touch ending was over the canvas, if so, stop the attack state
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        // Use document.elementFromPoint *at the touch end coordinates*
        // Note: This might sometimes be outside the canvas even if the touch started there.
        const endedEl = document.elementFromPoint(touch.clientX, touch.clientY);
        // A simpler approach: If *any* touch ends, assume attack stops.
        // This prevents attack state getting stuck if touchend happens off-canvas.
        if (state.attack) {
             state.attack = false;
        }
    }
};

const handleTouchCancel = (e) => {
    // Treat touchcancel like touchend for state resetting
    handleTouchEnd(e);
};

export function init() {
    canvas = document.getElementById('game-canvas');
    appContainer = document.getElementById('app-container');

    if (!canvas) {
        console.error("Input Initialization Error: Canvas element 'game-canvas' not found!");
        return;
    }
    if (!appContainer) {
        console.warn("Input Initialization Warning: App container element 'app-container' not found. Scroll zoom might occur outside game area.");
    }

    // Add Keyboard Listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    // Add Mouse Listeners to Canvas
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    // Add Touch Listeners (simplified) - Attach to appContainer for wider coverage
    const touchTarget = appContainer || window; // Use window as fallback
    touchTarget.addEventListener('touchstart', handleTouchStart, { passive: false });
    touchTarget.addEventListener('touchmove', handleTouchMove, { passive: false }); // Still needed for aiming update
    touchTarget.addEventListener('touchend', handleTouchEnd, { passive: false });
    touchTarget.addEventListener('touchcancel', handleTouchCancel, { passive: false });
    // Add Wheel Listener
    window.addEventListener('wheel', handleWheel, { passive: false });
}

// Returns the current input state object (no change needed)
export function getState() {
    return state;
}

// Returns the current mouse position relative to the INTERNAL canvas resolution (no change needed)
export function getMousePosition() {
    return { x: state.internalMouseX, y: state.internalMouseY };
}