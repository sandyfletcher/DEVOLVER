// -----------------------------------------------------------------------------
// root/js/input.js - Handles Keyboard and Touch Input
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as UI from './ui.js'; // Import UI module for button illumination

let canvas = null;
let appContainer = null;

// --- Input State ---
// This object holds the *current* state of actions.
// It's modified by keyboard events and the UI action buttons.
// It's read by the main game loop (main.js) and passed to the player.
export const state = {
    left: false,
    right: false,
    jump: false,
    attack: false,
    // Store mouse coordinates relative to the INTERNAL canvas resolution
    internalMouseX: 0,
    internalMouseY: 0,
    // Keep mouseX/Y perhaps for legacy reasons or debug, but internalMouseX/Y are primary
    mouseX: 0, // <<< Could potentially remove these if unused elsewhere
    mouseY: 0, // <<< Could potentially remove these if unused elsewhere
};

// --- Keyboard Mapping ---
// Maps keyboard keys to action names used in the `state` object.
const keyMap = {
    // Movement
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    // Jump
    ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump',
    // Attack / Use
    f: 'attack', F: 'attack',
    // Pause
    Escape: 'pause',
};

// --- Keyboard Event Handlers ---

/** Handles keydown events for mapped keys. */
const handleKeyDown = (e) => {
    const action = keyMap[e.key];
    if (action) {
        // Prevent default browser behavior for game keys (like scrolling with arrows/space)
        e.preventDefault();

        // Handle continuous actions (movement, jump - potentially holdable)
        if (action === 'left' || action === 'right' || action === 'jump') {
             // Only set state and illuminate if not already pressed
             if (!state[action]) {
                 state[action] = true;
                 UI.illuminateButton(action); // Illuminate corresponding UI button
             }
        }
        // Handle single-trigger actions (attack)
        else if (action === 'attack') {
            // Only set state and illuminate if not already attacking (to prevent multi-trigger)
            if (!state.attack) {
                state.attack = true;
                 UI.illuminateButton('attack'); // Illuminate UI button
            }
        }
        // Handle immediate actions (pause)
        else if (action === 'pause') {
            // Pause doesn't use the `state` object, it calls the callback directly.
            if (typeof window.pauseGameCallback === 'function') {
                UI.illuminateButton('pause'); // Illuminate UI button
                window.pauseGameCallback(); // Call the pause function exposed by main.js
            } else {
                 console.warn("Input: Pause callback not found or not a function!");
            }
        }
    }
};

/** Handles keyup events for mapped keys. */
const handleKeyUp = (e) => {
    const action = keyMap[e.key];
    if (action) {
        // Set continuous actions back to false
        if (action === 'left' || action === 'right' || action === 'jump') {
            state[action] = false;
        }
        // Do NOT set state.attack = false here; it's consumed by the game loop.
        // Pause is handled instantly on keydown.
        // No need to prevent default on keyup usually.
    }
};

// --- MOUSE/TOUCH INPUT ---

/** Gets mouse coordinates relative to the internal canvas resolution */
function getInternalMouseCoords(e) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect(); // Gets the *displayed* size/pos
    // Check for zero dimensions to prevent division by zero if canvas isn't visible yet
    if (rect.width === 0 || rect.height === 0) {
        return { x: state.internalMouseX, y: state.internalMouseY }; // Return last known coords
    }
    const displayMouseX = e.clientX - rect.left;
    const displayMouseY = e.clientY - rect.top;

    // Scale display coordinates to internal coordinates
    const internalX = displayMouseX * (canvas.width / rect.width);
    const internalY = displayMouseY * (canvas.height / rect.height);

    // Clamp to internal bounds just in case
    const clampedX = Math.max(0, Math.min(internalX, canvas.width));
    const clampedY = Math.max(0, Math.min(internalY, canvas.height));

    return { x: clampedX, y: clampedY };
}

/** Handles mousedown events ON THE CANVAS for triggering attacks. */
const handleMouseDown = (e) => {
    if (e.target === canvas) {
        // Update internal mouse coordinates on click
        const coords = getInternalMouseCoords(e);
        state.internalMouseX = coords.x;
        state.internalMouseY = coords.y;
        state.mouseX = e.clientX - canvas.getBoundingClientRect().left; // Update legacy values if needed
        state.mouseY = e.clientY - canvas.getBoundingClientRect().top;  // Update legacy values if needed

        if (e.button === 0) { // Left click
             if (!state.attack) {
                 state.attack = true;
                 UI.illuminateButton('attack');
            }
            e.preventDefault();
        }
    }
};

/** Handles mousemove events over the canvas to update aiming coordinates. */
const handleMouseMove = (e) => {
    if (canvas) {
        const coords = getInternalMouseCoords(e);
        state.internalMouseX = coords.x;
        state.internalMouseY = coords.y;
        state.mouseX = e.clientX - canvas.getBoundingClientRect().left; // Update legacy values if needed
        state.mouseY = e.clientY - canvas.getBoundingClientRect().top;  // Update legacy values if needed
    }
};

// --- Mouse Wheel Handler ---

/** Handles wheel events for zooming (delegates scale update). */
const handleWheel = (e) => {
    // Check if the scroll event target is within the app container to avoid hijacking page scroll
    if (!appContainer || !appContainer.contains(e.target)) {
         return; // Ignore scroll events outside the designated game area
    }

    e.preventDefault(); // Prevent default page scroll behavior

    // Calculate the change in scale based on scroll direction and speed factor
    const deltaScale = -e.deltaY * Config.ZOOM_SPEED_FACTOR;

    // Call the globally exposed function (from main.js) to update camera scale
    if (typeof window.updateCameraScale === 'function') {
        window.updateCameraScale(deltaScale);
    } else {
        console.warn("Input: window.updateCameraScale function not found!");
    }
};

/**
 * Consumes the attack trigger flag. Called by the main game loop
 * after the attack input has been processed for a frame.
 */
export function consumeClick() {
    state.attack = false;
}

// --- Public Interface ---

/** Initializes input handlers and sets up listeners. */
export function init() {
    canvas = document.getElementById('game-canvas');
    appContainer = document.getElementById('app-container'); // Used for wheel event bounds check

    if (!canvas) {
        console.error("Input Initialization Error: Canvas element 'game-canvas' not found!");
        return; // Stop initialization if canvas is missing
    }
    if (!appContainer) {
        // Warn but continue if app container isn't found (wheel check might be less precise)
        console.warn("Input Initialization Warning: App container element 'app-container' not found. Scroll zoom might occur outside game area.");
    }

    // Add Keyboard Listeners to the window
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Add Mouse Listeners specifically to the canvas
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove); // Tracks mouse position for aiming

    // Add Wheel Listener to the window (handler checks if inside appContainer)
    window.addEventListener('wheel', handleWheel, { passive: false }); // Need passive: false to allow preventDefault

    // --- Touch controls are now handled by UI buttons in ui.js ---

    // Expose the state object globally so UI button handlers can modify it directly.
    window.Input = { state: state };

    console.log("Input Initialized: Listening for Keyboard, Mouse (on Canvas), Wheel.");
}

/**
 * Returns the current input state object.
 * This state reflects combined input from keyboard and UI buttons.
 * @returns {object} The input state object.
 */
export function getState() {
    return state;
}

/**
 * Returns the current mouse position relative to the INTERNAL canvas resolution.
 * THIS IS THE CRITICAL FIX.
 * @returns {{x: number, y: number}} Mouse coordinates.
 */
export function getMousePosition() {
    // *** FIX: Return the internal coordinates ***
    return { x: state.internalMouseX, y: state.internalMouseY };
}