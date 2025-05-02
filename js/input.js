// -----------------------------------------------------------------------------
// root/js/input.js - Handles Keyboard and Touch Input
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as UI from './ui.js';

let canvas = null;
let appContainer = null;
// --- Input State holds the *current* state of actions, modified by keyboard events and the UI action buttons ---
export const state = {
    left: false,
    right: false,
    jump: false,
    attack: false, // This will now stay true as long as the button/key is held down
    // Store mouse coordinates relative to the INTERNAL canvas resolution
    internalMouseX: 0,
    internalMouseY: 0,
};
// --- Keyboard Mapping ---
// Maps keyboard keys to action names used in the `state` object.
const keyMap = {
    // Movement
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    // Jump (Holdable)
    ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump',
    // Attack / Use (Holdable for placement/continuous attack)
    f: 'attack', F: 'attack',
    // Pause (Single trigger)
    Escape: 'pause',
};
// --- Keyboard Event Handlers ---
/** Handles keydown events for mapped keys. */
const handleKeyDown = (e) => {
    const action = keyMap[e.key];
    if (action) {
        // Prevent default browser behavior for game keys (like scrolling with arrows/space)
        e.preventDefault();

        // Handle continuous/holdable actions (movement, jump, attack)
        // Set state to true ONLY if it wasn't already true (avoids redundant illumination)
        if (action !== 'pause' && !state[action]) { // Don't set state for pause, handle below
             state[action] = true;
             // Illuminate the button immediately on press
             if (action in UI.actionButtons) { // Check if it's a known UI button action
                 UI.illuminateButton(action);
             }
        }
        // Handle immediate actions (pause)
        else if (action === 'pause') {
            // Pause doesn't use the `state` object, it calls the callback directly.
            if (typeof window.pauseGameCallback === 'function') {
                if ('pause' in UI.actionButtons) { // Check if pause button exists in UI
                    UI.illuminateButton('pause'); // Illuminate UI button
                }
                window.pauseGameCallback(); // Call the pause function exposed by main.js
            } else {
                 console.warn("Input: Pause callback not found or not a function!");
            }
        }
         // Handle Settings button key presses if desired (e.g., G for grid, M for music, N for sfx)
         // Currently only handled via UI buttons. If adding keybinds, handle here.
    }
};
/** Handles keyup events for mapped keys. */
const handleKeyUp = (e) => {
    const action = keyMap[e.key];
    if (action) {
        // Set continuous/holdable actions back to false on key release
        if (action !== 'pause') { // Pause has no state flag to reset
             state[action] = false;
        }
         // No need to prevent default on keyup usually.
    }
};
// --- MOUSE/TOUCH INPUT ---
/** Gets mouse coordinates relative to the internal canvas resolution */
function getInternalMouseCoords(e) {
    if (!canvas) return { x: state.internalMouseX, y: state.internalMouseY };
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
        if (e.button === 0) { // Left click
             // Set attack state to true on mousedown
             if (!state.attack) { // Prevent redundant illumination if already holding via key
                 state.attack = true;
                 if ('attack' in UI.actionButtons) { // Check if attack button exists in UI
                     UI.illuminateButton('attack');
                 }
             }
            e.preventDefault(); // Prevent default behaviors like text selection
        }
    }
};
/** Handles mouseup events ON THE CANVAS to stop attacking. */
const handleMouseUp = (e) => {
    if (e.target === canvas) {
        if (e.button === 0) { // Left click release
             state.attack = false; // Set attack state to false on mouseup
             // No illumination needed on release
        }
    }
};
/** Handles mousemove events over the canvas to update aiming coordinates. */
const handleMouseMove = (e) => {
    if (canvas) {
        const coords = getInternalMouseCoords(e);
        state.internalMouseX = coords.x;
        state.internalMouseY = coords.y;
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
    // e.deltaY is usually 100 or -100 for mouse wheels, can be smaller/larger for trackpads
    const deltaScale = -e.deltaY * Config.ZOOM_SPEED_FACTOR;
    // Call the globally exposed function (from main.js) to update camera scale
    if (typeof window.updateCameraScale === 'function') {
        window.updateCameraScale(deltaScale);
    } else {
        console.warn("Input: window.updateCameraScale function not found!");
    }
};
// --- Touch Input Handlers (Modified to use state flags and preventDefault) ---
let activeTouchId = null; // To track a single touch for movement/attack
const handleTouchStart = (e) => {
     // Prevent default browser actions like scrolling, zooming, or text selection IF it's the first touch on a control or the canvas
     // Check if the touch started on a button or the canvas
     const touchedElement = e.target;
     const isActionButton = touchedElement.classList.contains('action-button');
     const isItemBox = touchedElement.classList.contains('item-box');
     const isCanvas = touchedElement === canvas;
     if (isActionButton || isItemBox || isCanvas) {
        e.preventDefault(); // Prevent default for touches directly on interactive elements
     }
    // If this is the first touch, use it for movement/attack
    if (activeTouchId === null && e.changedTouches.length > 0) {
        activeTouchId = e.changedTouches[0].identifier;
    }
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const touchedEl = document.elementFromPoint(touch.clientX, touch.clientY); // Get the element under the touch point
        if (touchedEl && touchedEl.classList) {
             // Check if the touched element is one of our action buttons
            if (touchedEl.classList.contains('action-button')) {
                const buttonId = touchedEl.id;
                // Find the action name from the button ID
                let actionName = null;
                for (const action in UI.actionButtons) {
                    if (UI.actionButtons[action] === touchedEl) {
                        actionName = action;
                        break;
                    }
                }
                if (actionName) {
                    // Set the corresponding state flag to true
                    // Only set state if not already true to avoid redundant illumination
                    if (actionName !== 'pause' && !(actionName in ['toggleGrid', 'muteMusic', 'muteSfx']) && !state[actionName]) {
                        state[actionName] = true;
                        UI.illuminateButton(actionName); // Illuminate button on press
                    }
                     // Special case for pause and settings buttons (single trigger on press)
                    else if (actionName === 'pause' && typeof window.pauseGameCallback === 'function') {
                        UI.illuminateButton('pause');
                        window.pauseGameCallback(); // Trigger pause immediately
                    }
                    // NEW: Handle settings button presses
                     else if (actionName === 'toggleGrid' || actionName === 'muteMusic' || actionName === 'muteSfx') {
                          if (actionName === 'toggleGrid' && typeof window.toggleGridDisplay === 'function') window.toggleGridDisplay();
                          else if (actionName === 'muteMusic' && typeof window.toggleMusicMute === 'function') window.toggleMusicMute();
                          else if (actionName === 'muteSfx' && typeof window.toggleSfxMute === 'function') window.toggleSfxMute();
                          UI.illuminateButton(actionName); // Illuminate the settings button
                     }
                }
            } else if (touchedEl === canvas) {
                // Touch started on the canvas - treat as 'attack'
                const coords = getInternalMouseCoords(touch);
                 state.internalMouseX = coords.x; // Update mouse coords based on touch
                 state.internalMouseY = coords.y;
                 if (!state.attack) { // Prevent redundant illumination
                     state.attack = true;
                     if ('attack' in UI.actionButtons) {
                         UI.illuminateButton('attack'); // Illuminate attack button on canvas tap
                     }
                 }
            } else if (touchedEl.classList.contains('item-box')) {
                 // Touch started on an item/weapon slot - trigger its click handler
                 touchedEl.click(); // Use the existing click handler for selection
            }
        }
    }
};
const handleTouchMove = (e) => {
    // Update mouse coordinates based on the active touch (if any)
    if (activeTouchId !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === activeTouchId) {
                const coords = getInternalMouseCoords(touch);
                state.internalMouseX = coords.x;
                state.internalMouseY = coords.y;
                break; // Found the active touch, no need to check others
            }
        }
    }
     // Prevent default scrolling/zooming if a touch is active within the app container
     if (activeTouchId !== null && appContainer && appContainer.contains(e.target)) {
         // Check if this touch is potentially a scroll/zoom gesture
         // This is tricky. For now, prevent default for any move IF an activeTouchId is set
         // A more robust solution would distinguish taps from scrolls/zooms
          // e.preventDefault(); // Be careful with preventDefault on touchmove, can break scrolling
     }
};
const handleTouchEnd = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const touchedEl = document.elementFromPoint(touch.clientX, touch.clientY); // Get element under touch end
         // Check if the touch ended on one of our action buttons (except pause/settings which trigger on start)
         if (touchedEl && touchedEl.classList && touchedEl.classList.contains('action-button')) {
              const buttonId = touchedEl.id;
              let actionName = null;
              for (const action in UI.actionButtons) {
                  if (UI.actionButtons[action] === touchedEl) {
                      actionName = action;
                      break;
                  }
              }
              // Reset state flag for movement/attack if the touch ended on the button that set it
              if (actionName && (actionName === 'left' || actionName === 'right' || actionName === 'jump' || actionName === 'attack')) {
                   state[actionName] = false;
              }
         } else if (touchedEl === canvas) {
              // Touch ended on the canvas - treat as 'attack' release
              state.attack = false; // Reset attack state
         }
        // If the released touch was the active touch, clear the active touch ID
        if (touch.identifier === activeTouchId) {
            activeTouchId = null;
             // As a fallback, reset all touch-related state flags if the primary touch is lifted
             // This prevents stuck inputs if a touchend/cancel is missed for secondary touches
            state.left = false;
            state.right = false;
            state.jump = false;
            state.attack = false; // Ensure attack is also reset
        }
    }
};
const handleTouchCancel = (e) => {
     // Treat touchcancel like touchend for state resetting
    handleTouchEnd(e);
};
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
    canvas.addEventListener('mouseup', handleMouseUp); // Added mouseup listener
    canvas.addEventListener('mousemove', handleMouseMove); // Tracks mouse position for aiming
    // Add Touch Listeners to the app container or body for wider coverage
    // Using the app container can help limit the scope of touch controls
    if(appContainer){
        appContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        appContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        appContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
        appContainer.addEventListener('touchcancel', handleTouchCancel, { passive: false });
    } else {
        // Fallback to window if appContainer isn't found
         window.addEventListener('touchstart', handleTouchStart, { passive: false });
         window.addEventListener('touchmove', handleTouchMove, { passive: false });
         window.addEventListener('touchend', handleTouchEnd, { passive: false });
         window.addEventListener('touchcancel', handleTouchCancel, { passive: false });
    }
    // Add Wheel Listener to the window (handler checks if inside appContainer)
    window.addEventListener('wheel', handleWheel, { passive: false }); // Need passive: false to allow preventDefault
    // Expose the state object globally so UI button handlers can modify it directly.
    // UI button handlers now set Input.state directly.
    // window.Input = { state: state }; // Already exposed in main.js for UI button handlers
}
// Returns the current input state object.
export function getState() {
    return state;
}
// Returns the current mouse position relative to the INTERNAL canvas resolution.
// This is also updated by touch input now.
export function getMousePosition() {
    return { x: state.internalMouseX, y: state.internalMouseY };
}