// js/input.js
// -----------------------------------------------------------------------------
// input.js - Handles Keyboard and Touch Input
// -----------------------------------------------------------------------------
console.log("input.js loaded");

import * as Config from './config.js'; // For button positioning if needed

import * as UI from './ui.js'; // <-- Import UI to get button rect

// --- Input State ---
// This object holds the current state of actionable inputs
const state = {
    left: false,
    right: false,
    jump: false,
    attack: false, // Player component consumes this once triggered
};

// --- Keyboard Mapping ---
const keyMap = {
    ArrowLeft: 'left',
    a: 'left',
    A: 'left',
    ArrowRight: 'right',
    d: 'right',
    D: 'right',
    ArrowUp: 'jump',
    w: 'jump',
    W: 'jump',
    ' ': 'jump',
    'f': 'attack',
    'F': 'attack',
};

// --- Touch Control State ---
const touchState = {
    activeTouches: {},
    buttons: {}
};

let canvas = null;

// --- Touch Button Definitions ---
const defineTouchButtons = () => {
    const btnSize = 80;
    const margin = 20;

    touchState.buttons = {
        left: {
            rect: { x: margin, y: Config.CANVAS_HEIGHT - btnSize - margin, width: btnSize, height: btnSize },
            pressed: false
        },
        right: {
            rect: { x: margin + btnSize + margin / 2, y: Config.CANVAS_HEIGHT - btnSize - margin, width: btnSize, height: btnSize },
            pressed: false
        },
        jump: {
            rect: { x: Config.CANVAS_WIDTH - btnSize - margin, y: Config.CANVAS_HEIGHT - btnSize - margin, width: btnSize, height: btnSize },
            pressed: false
        },
        attack: {
            rect: { x: Config.CANVAS_WIDTH - btnSize * 2 - margin * 1.5, y: Config.CANVAS_HEIGHT - btnSize - margin, width: btnSize, height: btnSize },
            pressed: false
        }
    };
};

// --- Event Handlers ---

// Keyboard Handlers (Your existing logic is correct for attack)
const handleKeyDown = (e) => {
    const action = keyMap[e.key];
    if (action) {
        if (!state[action] || action === 'left' || action === 'right' || action === 'jump') { // Allow holding move/jump
            state[action] = true;
        }
        e.preventDefault();
    }
};

const handleKeyUp = (e) => {
    const action = keyMap[e.key];
    if (action) {
        // Only set continuous actions to false on keyup
        if (action === 'left' || action === 'right' || action === 'jump') {
            state[action] = false;
        }
        // Do NOT set state.attack = false here
        e.preventDefault();
    }
};

// Keep track if a click/touch just happened for restart check
let justClicked = false;
let clickPos = { x: 0, y: 0 };

// --- MOUSE INPUT --- (Your existing logic is correct)
// Modify Mouse/Touch handlers to record click position
const handleMouseDown = (e) => {
    if (e.target === canvas) {
         clickPos = { x: e.clientX - canvas.getBoundingClientRect().left, y: e.clientY - canvas.getBoundingClientRect().top };
         justClicked = true; // Mark that a click happened this frame

         // Handle regular attack click if NOT game over
         if (e.button === 0) { // Left click
             // We check game state in main loop now before processing attack
             // Only set state if needed for attack logic
             if (!state.attack) {
                 state.attack = true; // Set attack flag for player update check
             }
             e.preventDefault();
         }
    }
};

// --- Touch Handlers ---

const handleTouchStart = (e) => {
    e.preventDefault();
    const touches = e.changedTouches;
    const canvasRect = canvas.getBoundingClientRect();

    // Use only the first touch for potential UI interaction / restart click
    if (touches.length > 0) {
        const touch = touches[0];
        clickPos = { x: touch.clientX - canvasRect.left, y: touch.clientY - canvasRect.top };
        justClicked = true; // Mark that a touch happened
    }


    // Handle regular gameplay buttons
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const touchId = touch.identifier;
        const touchX = touch.clientX - canvasRect.left;
        const touchY = touch.clientY - canvasRect.top;

        let buttonHit = false; // Flag to see if touch hit *any* gameplay button
        for (const buttonName in touchState.buttons) {
            const button = touchState.buttons[buttonName];
            if (touchX >= button.rect.x && touchX <= button.rect.x + button.rect.width &&
                touchY >= button.rect.y && touchY <= button.rect.y + button.rect.height)
            {
                buttonHit = true; // This touch is on a gameplay button
                button.pressed = true;
                touchState.activeTouches[touchId] = buttonName;
                if (buttonName === 'attack') {
                    if (!state.attack) { state.attack = true; }
                } else {
                    state[buttonName] = true;
                }
                break;
            }
        }
         // If touch didn't hit a gameplay button, it might be for the restart button
         // We check that separately using justClicked flag and clickPos
    }
}

const handleTouchEndOrCancel = (e) => {
    e.preventDefault();
    const touches = e.changedTouches;

    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const touchId = touch.identifier;
        const buttonName = touchState.activeTouches[touchId];

        if (buttonName && touchState.buttons[buttonName]) {
            touchState.buttons[buttonName].pressed = false; // Always mark button visually as not pressed

            // *** CHANGE HERE: Only set state false for non-attack buttons ***
            if (buttonName !== 'attack') {
                state[buttonName] = false; // Stop moving/jumping
            }
            // *** END CHANGE ***
        }
        delete touchState.activeTouches[touchId];
    }

    // Safety check (Good to keep)
    for (const buttonName in touchState.buttons) {
        let stillPressedByAnotherTouch = false;
        for(const id in touchState.activeTouches) {
            if(touchState.activeTouches[id] === buttonName) {
                stillPressedByAnotherTouch = true;
                break;
            }
        }
        if (!stillPressedByAnotherTouch) {
            touchState.buttons[buttonName].pressed = false;
             // *** CHANGE HERE: Only set state false for non-attack buttons ***
            if (buttonName !== 'attack') {
                 if (state[buttonName]) { // Only if it was true
                     state[buttonName] = false;
                 }
            }
             // *** END CHANGE ***
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

        if (buttonName && touchState.buttons[buttonName]) {
            const button = touchState.buttons[buttonName];
            const touchX = touch.clientX - canvasRect.left;
            const touchY = touch.clientY - canvasRect.top;

            const isOutside = !(touchX >= button.rect.x && touchX <= button.rect.x + button.rect.width &&
                                touchY >= button.rect.y && touchY <= button.rect.y + button.rect.height);

            if (isOutside) {
                button.pressed = false;
                // *** CHANGE HERE: Only set state false for non-attack buttons ***
                if (buttonName !== 'attack') {
                    state[buttonName] = false; // Stop moving/jumping if dragged off
                }
                 // *** END CHANGE ***
                delete touchState.activeTouches[touchId]; // Stop tracking this touch for this button
            }
        }
         // Optional: Check if touch moved INTO a button (less common need)
    }
};

// Add a function to reset the click flag after it's checked
export function consumeClick() {
    justClicked = false;
}


// --- NEW: Check for Restart Click ---
/**
 * Checks if a click/touch occurred within the Play Again button bounds.
 * IMPORTANT: This should only be called when the game state is GAME_OVER.
 * @returns {boolean} True if the click was on the button.
 */
export function didClickPlayAgain() {
    if (!justClicked) {
        return false; // No click happened this frame
    }

    const buttonRect = UI.getPlayAgainButtonRect();
    if (!buttonRect) {
        return false; // Button isn't being drawn (not game over?)
    }

    // Check if clickPos is within buttonRect
    const clickedOnButton = (
        clickPos.x >= buttonRect.x &&
        clickPos.x <= buttonRect.x + buttonRect.width &&
        clickPos.y >= buttonRect.y &&
        clickPos.y <= buttonRect.y + buttonRect.height
    );

    return clickedOnButton;
}

// --- Public Interface ---

export function init() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) {console.error("Input: Canvas element not found!");
        return;
    }
    defineTouchButtons();
    // Keyboard Listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    // Touch Listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEndOrCancel, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEndOrCancel, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    console.log("Input system initialized (with attack & click check).");
}

export function getState() {
    return state;
}

export function drawControls(ctx) { /* ... as before, ensure attack button label exists ... */
    const touchSupported = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (!touchSupported) return;
    ctx.save();
    // ... styles ...
    for (const buttonName in touchState.buttons) {
        const button = touchState.buttons[buttonName];
        const rect = button.rect;
        ctx.fillStyle = button.pressed ? 'rgba(255, 255, 255, 0.6)' : 'rgba(128, 128, 128, 0.4)';
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        let label = '';
        switch (buttonName) {
             case 'left': label = '◀'; break;
             case 'right': label = '▶'; break;
             case 'jump': label = '▲'; break;
             case 'attack': label = '⚔'; break; // Ensure this is here
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
         ctx.font = 'bold 24px sans-serif'; // Make sure font is set before fillText
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
        ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
    }
    ctx.restore();
}