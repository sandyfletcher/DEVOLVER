console.log("Build-a-Tower TD script loaded!");

// --- Get Canvas and Context ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// --- World Parameters ---
const WATER_WIDTH = 100; // Width of water body on each side
const SAND_WIDTH = 30;   // Width of the sand transition zone
const GROUND_START_X = WATER_WIDTH + SAND_WIDTH;
const GROUND_END_X = canvas.width - WATER_WIDTH - SAND_WIDTH;
const GROUND_WIDTH = GROUND_END_X - GROUND_START_X;

// --- Level Heights ---
const GROUND_BASE_LEVEL = canvas.height - 100; // Flat ground level (higher up now)
const WATER_LEVEL = canvas.height - 80;    // Water surface level (slightly below ground)
const HILL_MAX_HEIGHT = 150; // Max height of the hill *above* GROUND_BASE_LEVEL

// --- Hill Parameters ---
const HILL_CENTER_X = canvas.width / 2;
// Adjust hill width calculation to fit within the ground area
const HILL_EFFECTIVE_WIDTH = GROUND_WIDTH * 0.8; // Hill spreads across 80% of the ground

// --- Player Constants ---
const GRAVITY = 0.4; // Adjusted slightly for scale
const PLAYER_MOVE_SPEED = 4; // Adjusted slightly for scale
const PLAYER_JUMP_FORCE = 9; // Adjusted slightly for scale
const PLAYER_WIDTH = 10; // Much smaller
const PLAYER_HEIGHT = 20; // Much smaller

// --- Colors ---
const GROUND_COLOR = 'rgb(100, 180, 80)'; // Dirt/Grass
const SAND_COLOR = 'rgb(210, 180, 140)';   // Tan Sand
const WATER_COLOR = 'rgb(50, 100, 200)';   // Blue Water
const PLAYER_COLOR = 'rgb(200, 50, 50)';   // Red Player

// --- Game State ---
const player = {
    // Start closer to the middle of the actual ground area
    x: HILL_CENTER_X - PLAYER_WIDTH / 2,
    y: GROUND_BASE_LEVEL - HILL_MAX_HEIGHT - PLAYER_HEIGHT - 50, // Start well above the peak
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    vx: 0, // Velocity x
    vy: 0, // Velocity y
    isOnGround: false,
    color: PLAYER_COLOR
};

const keys = {
    left: false,
    right: false,
    up: false
};

// --- Input Handling (same as before) ---
window.addEventListener('keydown', (e) => {
    // ... (code is unchanged) ...
    switch (e.key) {
        case 'ArrowLeft':
        case 'a': // Allow WASD too
            keys.left = true;
            break;
        case 'ArrowRight':
        case 'd':
            keys.right = true;
            break;
        case 'ArrowUp':
        case 'w':
        case ' ': // Space bar for jump
            keys.up = true;
            break;
    }
});

window.addEventListener('keyup', (e) => {
    // ... (code is unchanged) ...
    switch (e.key) {
        case 'ArrowLeft':
        case 'a':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'd':
            keys.right = false;
            break;
        case 'ArrowUp':
        case 'w':
        case ' ':
            keys.up = false;
            break;
    }
});


// --- Surface Calculation ---
function getSurfaceY(xPos) {
    // 1. Check Water Zones
    if (xPos < WATER_WIDTH || xPos > canvas.width - WATER_WIDTH) {
        return WATER_LEVEL;
    }

    // 2. Check Sand Zones (Linear Interpolation for slope)
    if (xPos >= WATER_WIDTH && xPos < GROUND_START_X) { // Left Sand
        const sandProgress = (xPos - WATER_WIDTH) / SAND_WIDTH; // 0 to 1
        return WATER_LEVEL + (GROUND_BASE_LEVEL - WATER_LEVEL) * sandProgress;
    }
    if (xPos <= canvas.width - WATER_WIDTH && xPos > GROUND_END_X) { // Right Sand
        const sandProgress = ((canvas.width - WATER_WIDTH) - xPos) / SAND_WIDTH; // 0 to 1
        return WATER_LEVEL + (GROUND_BASE_LEVEL - WATER_LEVEL) * sandProgress;
    }

    // 3. Check Main Ground Zone (Hill Calculation)
    if (xPos >= GROUND_START_X && xPos <= GROUND_END_X) {
        const halfHillWidth = HILL_EFFECTIVE_WIDTH / 2;
        // Calculate distance from hill center, but only consider points within the ground area
        const distFromCenter = Math.abs(xPos - HILL_CENTER_X);

        if (distFromCenter <= halfHillWidth) {
            // Calculate parabolic height *reduction* from the peak
            // The peak is at GROUND_BASE_LEVEL - HILL_MAX_HEIGHT
            const heightReduction = HILL_MAX_HEIGHT * Math.pow((distFromCenter / halfHillWidth), 2);
            return (GROUND_BASE_LEVEL - HILL_MAX_HEIGHT) + heightReduction;
        } else {
            // Flat ground part within the main ground zone
            return GROUND_BASE_LEVEL;
        }
    }

    // Fallback (shouldn't be reached ideally)
    return canvas.height;
}


// --- Game Loop Functions ---
function update(deltaTime) {
    // 1. Handle Horizontal Movement Input
    if (keys.left && !keys.right) {
        player.vx = -PLAYER_MOVE_SPEED;
    } else if (keys.right && !keys.left) {
        player.vx = PLAYER_MOVE_SPEED;
    } else {
        player.vx = 0;
    }

    // 2. Handle Jump Input
    if (keys.up && player.isOnGround) {
        player.vy = -PLAYER_JUMP_FORCE;
        player.isOnGround = false;
    }

    // 3. Apply Gravity
    if (!player.isOnGround) {
        player.vy += GRAVITY;
    }

    // 4. Update Position
    player.x += player.vx;
    player.y += player.vy;

    // 5. Collision Detection and Resolution

    // --- Horizontal Boundaries (Stop at Water Edge) ---
    if (player.x < WATER_WIDTH) {
        player.x = WATER_WIDTH;
        player.vx = 0; // Stop horizontal movement if hitting water edge
    }
    if (player.x + player.width > canvas.width - WATER_WIDTH) {
        player.x = canvas.width - WATER_WIDTH - player.width;
        player.vx = 0; // Stop horizontal movement
    }

    // --- Ground/Surface Collision ---
    // Check surface level below player center
    const checkX = player.x + player.width / 2;
    const surfaceY = getSurfaceY(checkX);

    player.isOnGround = false; // Assume not on ground

    if (player.y + player.height >= surfaceY) {
        // Check if moving downwards or standing still slightly below surface
        if (player.vy >= 0) {
             // Check if the feet were *above* the surface in the previous frame (or close enough)
             // This prevents tunneling up slopes if moving fast horizontally
             const prevY = player.y - player.vy; // Approximate previous y
             if (prevY + player.height <= surfaceY + 1) { // +1 for tolerance
                player.y = surfaceY - player.height; // Snap to surface
                player.vy = 0; // Stop vertical movement
                player.isOnGround = true;
            }
            // If already too deep (e.g. due to high speed), still snap, but maybe log warning?
             else if (player.y + player.height > surfaceY + player.height/2) { // Significantly embedded
                 player.y = surfaceY - player.height;
                 player.vy = 0;
                 player.isOnGround = true;
                 // console.warn("Corrected deep ground penetration");
             }
        }
    }


    // Prevent falling through floor (safety net) - use surfaceY
     if (player.y + player.height > surfaceY + 5 && player.isOnGround) { // Added tolerance
        player.y = surfaceY - player.height;
        // console.warn("Corrected sinking player");
     }

    // Optional: Reset if falling off world (e.g., through floor glitch)
    if (player.y > canvas.height + 200) { // Give more buffer
       player.y = GROUND_BASE_LEVEL - HILL_MAX_HEIGHT - PLAYER_HEIGHT - 50;
       player.x = HILL_CENTER_X - PLAYER_WIDTH / 2;
       player.vy = 0;
       player.vx = 0;
       player.isOnGround = false;
       console.log("Player fell out of world, resetting.");
    }
}

// --- Drawing Functions ---

function drawWater() {
    ctx.fillStyle = WATER_COLOR;
    // Left water
    ctx.fillRect(0, WATER_LEVEL, WATER_WIDTH, canvas.height - WATER_LEVEL);
    // Right water
    ctx.fillRect(canvas.width - WATER_WIDTH, WATER_LEVEL, WATER_WIDTH, canvas.height - WATER_LEVEL);
}

function drawSand() {
    ctx.fillStyle = SAND_COLOR;
    // Left Sand (Polygon)
    ctx.beginPath();
    ctx.moveTo(WATER_WIDTH, WATER_LEVEL); // Top left corner (at water edge)
    ctx.lineTo(GROUND_START_X, GROUND_BASE_LEVEL); // Top right corner (at ground edge)
    ctx.lineTo(GROUND_START_X, canvas.height); // Bottom right corner
    ctx.lineTo(WATER_WIDTH, canvas.height); // Bottom left corner
    ctx.closePath();
    ctx.fill();

    // Right Sand (Polygon)
    ctx.beginPath();
    ctx.moveTo(GROUND_END_X, GROUND_BASE_LEVEL); // Top left corner (at ground edge)
    ctx.lineTo(canvas.width - WATER_WIDTH, WATER_LEVEL); // Top right corner (at water edge)
    ctx.lineTo(canvas.width - WATER_WIDTH, canvas.height); // Bottom right corner
    ctx.lineTo(GROUND_END_X, canvas.height); // Bottom left corner
    ctx.closePath();
    ctx.fill();
}


function drawGround() {
    ctx.fillStyle = GROUND_COLOR;
    ctx.beginPath();
    // Start at the bottom-left of the ground area
    ctx.moveTo(GROUND_START_X, canvas.height);
    // Go up to the ground level at the start
    ctx.lineTo(GROUND_START_X, GROUND_BASE_LEVEL);

    // Draw the top surface (flat + hill + flat) using getSurfaceY
    // Sample points across the main ground area for the surface profile
    for (let x = GROUND_START_X; x <= GROUND_END_X; x += 5) { // Sample every 5 pixels
        // We need getSurfaceY here because it handles the hill calculation correctly
        // within the ground bounds.
        ctx.lineTo(x, getSurfaceY(x));
    }
     // Ensure the line reaches the exact end point's surface Y
    ctx.lineTo(GROUND_END_X, getSurfaceY(GROUND_END_X));

    // Go down to the bottom-right of the ground area
    ctx.lineTo(GROUND_END_X, canvas.height);

    // Close the path along the bottom
    ctx.closePath();
    ctx.fill();
}


function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

function draw() {
    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Draw Terrain Layers (order matters for overlap) ---
    // 1. Draw the main ground area (Dirt/Grass)
    drawGround();

    // 2. Draw the sand transitions (will overlap edges of ground)
    drawSand();

    // 3. Draw the water (will overlap edges of sand)
    drawWater();

    // --- Draw Player ---
    drawPlayer();

    // --- Draw UI (later) ---
}

// --- Main Game Loop (now includes basic deltaTime calculation) ---
let lastTime = 0;
function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000; // Delta time in seconds
    lastTime = timestamp;

    // Limit deltaTime to prevent physics glitches if tab is inactive for long
    const maxDeltaTime = 0.05; // e.g., clamp to 20 FPS minimum equivalent
    const dt = Math.min(deltaTime, maxDeltaTime);

    update(dt); // Use clamped deltaTime
    draw();
    requestAnimationFrame(gameLoop);
}

// --- Initialization ---
function init() {
    console.log("Initializing game...");
    // Player starts higher now, ensure it's valid
     const startSurfaceY = getSurfaceY(player.x + player.width / 2);
     player.y = Math.min(player.y, startSurfaceY - player.height - 10); // Ensure starting above ground


    requestAnimationFrame(gameLoop);
}

// --- Start the game ---
init();