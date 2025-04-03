// -----------------------------------------------------------------------------
// input.js - Handles Keyboard and Touch Input
// -----------------------------------------------------------------------------
console.log("input.js loaded");

import * as Config from './config.js'; // For button positioning if needed

// --- Input State ---
// This object holds the current state of actionable inputs
const state = {
    left: false,
    right: false,
    jump: false,
    // Add more actions as needed (e.g., attack, build)
    // action: false,
};

// --- Keyboard Mapping ---
const keyMap = {
    ArrowLeft: 'left',
    a: 'left',
    A: 'left', // Consider case variations if needed
    ArrowRight: 'right',
    d: 'right',
    D: 'right',
    ArrowUp: 'jump',
    w: 'jump',
    W: 'jump',
    ' ': 'jump', // Spacebar
    // Example for future action key:
    // ArrowDown: 'action',
    // s: 'action',
    // S: 'action',
};

// --- Touch Control State ---
const touchState = {
    activeTouches: {}, // Stores { touchId: 'buttonName' } for active touches
    buttons: {}        // Will hold button definitions { name: { rect, pressed } }
};

let canvas = null; // Reference to the canvas element for touch events

// --- Touch Button Definitions ---
// Define rectangles for on-screen buttons (coordinates relative to canvas)
// Example layout: Left/Right bottom-left, Jump bottom-right
const defineTouchButtons = () => {
    const btnSize = 80; // Size of square buttons
    const margin = 20;  // Margin from edges

    touchState.buttons = {
        left: {
            rect: {
                x: margin,
                y: Config.CANVAS_HEIGHT - btnSize - margin,
                width: btnSize,
                height: btnSize
            },
            pressed: false
        },
        right: {
            rect: {
                x: margin + btnSize + margin / 2,
                y: Config.CANVAS_HEIGHT - btnSize - margin,
                width: btnSize,
                height: btnSize
            },
            pressed: false
        },
        jump: {
            rect: {
                x: Config.CANVAS_WIDTH - btnSize - margin,
                y: Config.CANVAS_HEIGHT - btnSize - margin,
                width: btnSize,
                height: btnSize
            },
            pressed: false
        }
        // Add more buttons here as needed (e.g., 'action')
    };
};

// --- Event Handlers ---

// Keyboard Handlers
const handleKeyDown = (e) => {
    const action = keyMap[e.key];
    if (action) {
        state[action] = true;
        e.preventDefault(); // Prevent default browser actions (like scrolling with arrows)
    }
};

const handleKeyUp = (e) => {
    const action = keyMap[e.key];
    if (action) {
        state[action] = false;
        e.preventDefault();
    }
};

// Touch Handlers
const handleTouchStart = (e) => {
    e.preventDefault(); // Prevent scrolling/zooming on canvas
    const touches = e.changedTouches;
    const canvasRect = canvas.getBoundingClientRect();

    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const touchId = touch.identifier;
        // Adjust touch coordinates to be relative to the canvas
        const touchX = touch.clientX - canvasRect.left;
        const touchY = touch.clientY - canvasRect.top;

        // Check if touch hits any button
        for (const buttonName in touchState.buttons) {
            const button = touchState.buttons[buttonName];
            if (touchX >= button.rect.x && touchX <= button.rect.x + button.rect.width &&
                touchY >= button.rect.y && touchY <= button.rect.y + button.rect.height)
            {
                // Mark button as pressed and associate touchId
                button.pressed = true;
                touchState.activeTouches[touchId] = buttonName;
                state[buttonName] = true; // Update the main input state
                break; // A touch can only activate one button
            }
        }
    }
};

const handleTouchEndOrCancel = (e) => {
    e.preventDefault();
    const touches = e.changedTouches;

    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const touchId = touch.identifier;

        // Find which button this touch was activating
        const buttonName = touchState.activeTouches[touchId];
        if (buttonName && touchState.buttons[buttonName]) {
            touchState.buttons[buttonName].pressed = false;
            state[buttonName] = false; // Update the main input state
        }
        // Remove the touch from active tracking
        delete touchState.activeTouches[touchId];
    }

    // Safety check: Ensure button state matches tracked touches
    // This handles cases where a touch might end unexpectedly or outside a button
    for (const buttonName in touchState.buttons) {
        let stillPressed = false;
        for(const id in touchState.activeTouches) {
            if(touchState.activeTouches[id] === buttonName) {
                stillPressed = true;
                break;
            }
        }
        if (!stillPressed) {
            touchState.buttons[buttonName].pressed = false;
            state[buttonName] = false;
        }
    }
};

const handleTouchMove = (e) => {
    e.preventDefault();
    const touches = e.changedTouches;
    const canvasRect = canvas.getBoundingClientRect();

    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const touchId = touch.identifier;
        const buttonName = touchState.activeTouches[touchId];

        // If this touch was activating a button...
        if (buttonName && touchState.buttons[buttonName]) {
            const button = touchState.buttons[buttonName];
            const touchX = touch.clientX - canvasRect.left;
            const touchY = touch.clientY - canvasRect.top;

            // ...check if it has moved *outside* the button's bounds
            if (!(touchX >= button.rect.x && touchX <= button.rect.x + button.rect.width &&
                  touchY >= button.rect.y && touchY <= button.rect.y + button.rect.height))
            {
                // Deactivate the button and remove tracking for this touch
                button.pressed = false;
                state[buttonName] = false;
                delete touchState.activeTouches[touchId];
            }
        }
         // Optional: Check if the touch moved *into* a new button (less common for virtual D-pads)
    }
};


// --- Public Interface ---

/**
 * Initializes the input system by adding event listeners.
 */
export function init() {
    // Get canvas reference (assuming Renderer.init() or similar makes it available)
    // A better approach might be to pass the canvas element to init()
    canvas = document.getElementById('game-canvas'); // Or get from Renderer module
    if (!canvas) {
        console.error("Input: Canvas element not found!");
        return;
    }

    // Define button layout
    defineTouchButtons();

    // Keyboard Listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Touch Listeners (attach to canvas)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEndOrCancel, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEndOrCancel, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false }); // Handle dragging off buttons

    console.log("Input system initialized.");
}

/**
 * Returns the current state of all defined inputs.
 * @returns {object} Object with boolean flags for each action (e.g., { left: false, right: true, jump: false })
 */
export function getState() {
    // Return a copy to prevent external modification? For now, return direct reference.
    return state;
}

/**
 * Draws the virtual touch controls onto the canvas.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 */
export function drawControls(ctx) {
    // Check if touch is likely supported (basic check)
    const touchSupported = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (!touchSupported) return; // Don't draw buttons on desktop

    ctx.save(); // Save current context state

    // Semi-transparent fill for buttons
    ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
    // Highlight color when pressed
    const pressedFill = 'rgba(255, 255, 255, 0.6)';
    // Simple text style
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';


    for (const buttonName in touchState.buttons) {
        const button = touchState.buttons[buttonName];
        const rect = button.rect;

        // Draw button background
        ctx.fillStyle = button.pressed ? pressedFill : 'rgba(128, 128, 128, 0.4)';
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        // Draw button label (optional, could use icons)
         let label = '';
         switch (buttonName) {
             case 'left': label = '◀'; break; // Use arrows or text
             case 'right': label = '▶'; break;
             case 'jump': label = '▲'; break; // Or '↑', 'JUMP'
         }
         ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
         ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
    }

    ctx.restore(); // Restore context state
}