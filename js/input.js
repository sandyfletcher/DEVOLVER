// -----------------------------------------------------------------------------
// root/js/input.js - Handles Keyboard and Touch Input
// -----------------------------------------------------------------------------

console.log("input loaded");

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

// --- Keyboard Handlers ---
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

// --- MOUSE/TOUCH INPUT ---
// Simplified - only handle attack trigger if needed by game logic
const handleMouseDown = (e) => {
    if (e.target === canvas) {
        // Handle attack click if necessary (check game state in main loop)
        if (e.button === 0 && !state.attack) { // Left click
            state.attack = true; // Set attack flag for player update check
            e.preventDefault();
        }
    }
};

// --- Touch Handlers ---

const handleTouchStart = (e) => {
    e.preventDefault();
    const touches = e.changedTouches;
    const canvasRect = canvas.getBoundingClientRect();

    // Handle gameplay buttons (attack, move, jump)
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const touchId = touch.identifier;
        const touchX = touch.clientX - canvasRect.left;
        const touchY = touch.clientY - canvasRect.top;
        let buttonHit = false;
        for (const buttonName in touchState.buttons) {
            const button = touchState.buttons[buttonName];
            if (touchX >= button.rect.x && touchX <= button.rect.x + button.rect.width &&
                touchY >= button.rect.y && touchY <= button.rect.y + button.rect.height)
            {
                buttonHit = true;
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
                if (buttonName !== 'attack') {
                    state[buttonName] = false; // Stop moving/jumping if dragged off
                }
                delete touchState.activeTouches[touchId]; // Stop tracking this touch for this button
            }
        }
         // Optional: Check if touch moved INTO a button (less common need)
    }
};

// Consume attack flag
export function consumeClick() {
    // This name is a bit misleading now, maybe rename to consumeAttackInput?
    state.attack = false;
}

// --- Public Interface ---
export function init() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) { console.error("Input: Canvas element not found!"); return; }
    defineTouchButtons();
    // Keyboard Listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    // Touch Listeners
    canvas.addEventListener('mousedown', handleMouseDown); // Keep for attack
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEndOrCancel, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEndOrCancel, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    console.log("Input system initialized.");
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