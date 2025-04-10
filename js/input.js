// -----------------------------------------------------------------------------
// root/js/input.js - Handles Keyboard and Touch Input
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as UI from './ui.js'; // not used currently

let canvas = null;
let appContainer = null;

// --- Input State, holds the current state of actionable inputs ---
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
        // For continuous actions like move/jump, set to true on key down
        if (action === 'left' || action === 'right' || action === 'jump') {
             state[action] = true;
        }
        // For single-press actions like attack
        if (action === 'attack' && !state.attack) {
             state.attack = true;
        }
        e.preventDefault();
    }
};

const handleKeyUp = (e) => {
    const action = keyMap[e.key];
    if (action) {
        // Set continuous actions to false on key up
        if (action === 'left' || action === 'right' || action === 'jump') {
            state[action] = false;
        }
        // Do NOT set state.attack = false here
        e.preventDefault();
    }
};

// --- MOUSE/TOUCH INPUT ---
const handleMouseDown = (e) => {
    if (e.target === canvas) {
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
                } else { // Covers jump, left, right
                    state[buttonName] = true; // Simply set the state flag
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
            touchState.buttons[buttonName].pressed = false;
            // Set corresponding state to false (except attack)
            if (buttonName !== 'attack') {
                state[buttonName] = false;
            }
        }
        delete touchState.activeTouches[touchId];
    }
    // Safety check (ensure states match button states)
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
            if (buttonName !== 'attack') {
                // Ensure state is false if button is no longer pressed by any touch
                if (state[buttonName]) {
                    state[buttonName] = false;
                }
            }
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
                    state[buttonName] = false; // Deactivate state if finger slides off
                }
                delete touchState.activeTouches[touchId]; // Stop tracking this touch for this button
            }
        }
    }
};

// --- Wheel Handler ---
const handleWheel = (e) => {
    // Check if the event originated within the app container (or specifically canvas)
    // This prevents zooming when scrolling elsewhere on the page.
    if (!appContainer || !appContainer.contains(e.target)) {
         return; // Ignore scroll events outside the container
    }

    e.preventDefault(); // Prevent default page scroll

    // Calculate scale change (deltaY is usually +/- 100 or similar)
    // Negative deltaY means scroll up (zoom in), Positive means scroll down (zoom out)
    const deltaScale = -e.deltaY * Config.ZOOM_SPEED_FACTOR; // Use ZOOM_SPEED_FACTOR from Config

    // Trigger a function in main.js or directly update a shared state
    // For simplicity, let's assume we have access to update a global camera scale
    // (A better approach might use callbacks or an event system)
    // We'll define updateCameraScale in main.js later
    if (typeof window.updateCameraScale === 'function') {
        window.updateCameraScale(deltaScale);
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
    appContainer = document.getElementById('app-container');
    if (!canvas) { console.error("Input: Canvas element not found!"); return; }
    if (!appContainer) { console.warn("Input: App container element not found for scroll bounds check."); }
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
    // Listen on the container or window, but check target inside handler
    window.addEventListener('wheel', handleWheel, { passive: false }); // Listen globally, check target
    // Alternatively, listen only on the container:
    // if (appContainer) {
    //    appContainer.addEventListener('wheel', handleWheel, { passive: false });
    // }
}

export function getState() {
    return state;
}

export function drawControls(ctx) {
    const touchSupported = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (!touchSupported) return;
    ctx.save();
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
             case 'attack': label = '⚔'; break;
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
         ctx.font = 'bold 24px sans-serif'; // Make sure font is set before fillText
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
        ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
    }
    ctx.restore();
}