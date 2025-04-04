// -----------------------------------------------------------------------------
// js/config.js - Centralized Game Configuration
// -----------------------------------------------------------------------------

console.log("config.js loaded");

// --- World Parameters ---
export const CANVAS_WIDTH = 800; // Match canvas element width
export const CANVAS_HEIGHT = 800; // Match canvas element height

// --- NEW: Grid & Block Constants ---
export const GRID_COLS = 200; // Updated size
export const GRID_ROWS = 200; // Updated size
export const BLOCK_WIDTH = CANVAS_WIDTH / GRID_COLS;   // Now 8 pixels wide
export const BLOCK_HEIGHT = CANVAS_HEIGHT / GRID_ROWS; // Now 8 pixels high

// Block Type IDs
export const BLOCK_AIR = 0;
export const BLOCK_WATER = 1;
export const BLOCK_SAND = 2;
export const BLOCK_DIRT = 3;
export const BLOCK_GRASS = 4;
export const BLOCK_STONE = 5;
export const BLOCK_WOOD_WALL = 6;
export const BLOCK_METAL = 7;
// Add more later: GLASS, specific ores, etc.

// Block Orientation IDs - // Implement drawing/collision later
export const ORIENTATION_FULL = 0;
export const ORIENTATION_SLOPE_BL = 1; // Bottom-Left triangle solid
export const ORIENTATION_SLOPE_BR = 2; // Bottom-Right triangle solid
export const ORIENTATION_SLOPE_TR = 3; // Top-Right triangle solid
export const ORIENTATION_SLOPE_TL = 4; // Top-Left triangle solid

// Block Base Health Points (HP)
export const BLOCK_HP = {
    [BLOCK_WATER]: Infinity,
    [BLOCK_SAND]: 30,
    [BLOCK_DIRT]: 50,
    [BLOCK_GRASS]: 50,
    [BLOCK_STONE]: 300,
    [BLOCK_WOOD_WALL]: 100,
    [BLOCK_METAL]: 500,
    // Add HP for other types later
};

// Block Colors (Adjust as needed)
export const BLOCK_COLORS = {
    // BLOCK_AIR is handled by background color
    [BLOCK_WATER]: 'rgb(50, 100, 200)',
    [BLOCK_SAND]: 'rgb(210, 180, 140)',
    [BLOCK_DIRT]: 'rgb(130, 82, 45)',
    [BLOCK_GRASS]: 'rgb(80, 180, 80)',
    [BLOCK_STONE]: 'rgb(140, 140, 140)',
    [BLOCK_WOOD_WALL]: 'rgb(160, 110, 70)',
    [BLOCK_METAL]: 'rgb(190, 190, 200)',
};

// --- Procedural Generation Parameters ---

// Define water level as percentage from the bottom
export const WORLD_WATER_LEVEL_PERCENT_FROM_BOTTOM = 0.04; // Target 4% water height (adjust between 0.02 and 0.06)
// Calculate the actual row index (0 = top, GRID_ROWS-1 = bottom) Water will fill UP TO (and including) this row.
export const WORLD_WATER_LEVEL_ROW_TARGET = Math.floor(GRID_ROWS * (1.0 - WORLD_WATER_LEVEL_PERCENT_FROM_BOTTOM));

// Adjust ground/stone levels relative to the NEW water level concept
// Example: Mean ground level slightly above the target water level
export const WORLD_GROUND_LEVEL_MEAN = WORLD_WATER_LEVEL_ROW_TARGET - Math.floor(GRID_ROWS * 0.05); // e.g., 5% of height above water
export const WORLD_STONE_LEVEL_MEAN = WORLD_WATER_LEVEL_ROW_TARGET + Math.floor(GRID_ROWS * 0.1); // e.g., 10% of height below water (ensure it's below ground mean)

// DRASTICALLY REDUCE variation for flatter terrain
export const WORLD_GROUND_VARIATION = 2; // Max +/- rows variation (Try small values like 2, 3, 4)
export const WORLD_STONE_VARIATION = 1; // Max +/- rows variation (Try small values like 1, 2, 3)

export const WORLD_ISLAND_WIDTH_PERCENT = 0.8; // Keep this - we can use it to lower terrain outside this zone
export const WORLD_NOISE_SCALE = 0.06; // Slightly smaller scale might work better with low variation, adjust as needed (0.05 - 0.1 range)

// --- Player Constants ---
export const PLAYER_WIDTH = Math.max(5, Math.floor(1.25 * BLOCK_WIDTH));
export const PLAYER_HEIGHT = Math.max(8, Math.floor(2.5 * BLOCK_HEIGHT));
export const PLAYER_START_X = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2;
// Start slightly above the *new* mean ground level
export const PLAYER_START_Y = (WORLD_GROUND_LEVEL_MEAN * BLOCK_HEIGHT) - PLAYER_HEIGHT - (3 * BLOCK_HEIGHT); // Adjusted buffer
export const PLAYER_COLOR = 'rgb(200, 50, 50)';
export const PLAYER_INITIAL_HEALTH = 3;
export const PLAYER_MAX_HEALTH = 10;
export const PLAYER_INVULNERABILITY_DURATION = 2.0;
export const PLAYER_ATTACK_DURATION = 0.25;
export const PLAYER_ATTACK_COOLDOWN = 0.4;
export const PLAYER_ATTACK_DAMAGE = 1;
export const PLAYER_ATTACK_REACH_X = Math.floor(2.25 * BLOCK_WIDTH);
export const PLAYER_ATTACK_REACH_Y = 0;
export const PLAYER_ATTACK_WIDTH = Math.floor(1.25 * BLOCK_WIDTH);
export const PLAYER_ATTACK_HEIGHT = PLAYER_HEIGHT;
export const PLAYER_ATTACK_COLOR = 'rgba(255, 255, 255, 0.5)';

// --- Enemy Constants ---
// Size relative to blocks
export const ENEMY_WIDTH = Math.floor(1.5 * BLOCK_WIDTH);
export const ENEMY_HEIGHT = Math.floor(2.25 * BLOCK_HEIGHT);
export const ENEMY_COLOR = 'rgb(80, 150, 80)';
export const ENEMY_SPEED = 0.75; // Pixels per frame - adjust relative to player
export const ENEMY_HEALTH = 1;
export const ENEMY_TARGET_X = CANVAS_WIDTH / 2; // Still target center for now
// Damage & Drops
export const ENEMY_CONTACT_DAMAGE = 1;
export const ENEMY_DROP_TYPE = 'wood'; // Item type string must match key in ItemManager/Player
export const ENEMY_DROP_AMOUNT = 1;
export const ENEMY_DROP_CHANCE = 1.0;
export const MAX_ENEMIES = 25; // Increase slightly maybe?
export const ENEMY_GRAVITY = 0.25; // Match player gravity?
// --- ENEMY SPAWN POSITIONING --- <<< ADD THIS SECTION BACK (or similar)
export const ENEMY_SPAWN_EDGE_MARGIN = 80; // Approx pixels from edge to start spawning
// --- END ENEMY SPAWN ---

// --- Wave System Constants ---
export const WAVE_START_DELAY = 3.0; // Seconds before first wave
export const WAVE_INTERMISSION_DURATION = 60.0; // Seconds between waves
export const WAVE_1_ENEMY_COUNT = 15;
export const WAVE_ENEMY_SPAWN_DELAY = 0.5; // Seconds between enemy spawns in a wave

// --- Item Constants ---
export const ITEM_GRAVITY = 0.3; // Items might fall slower/faster than player
export const SWORD_WIDTH = Math.floor(3 * BLOCK_WIDTH);
export const SWORD_HEIGHT = Math.floor(1 * BLOCK_HEIGHT); // Simple horizontal rectangle for now
export const SWORD_COLOR = 'rgb(180, 180, 190)'; // Silvery color
export const WOOD_ITEM_WIDTH = Math.floor(1 * BLOCK_WIDTH);
export const WOOD_ITEM_HEIGHT = Math.floor(1 * BLOCK_HEIGHT);
export const WOOD_ITEM_COLOR = 'rgb(139, 69, 19)'; // Brown
export const ITEM_BOBBLE_AMOUNT = 0.15; // How much items bob up and down slightly when idle
export const ITEM_BOBBLE_SPEED = 0.05; // How fast items bob

// --- Physics Constants ---
// Adjust physics based on smaller block size / potentially faster feel needed
export const GRAVITY = 0.25; // Might need adjustment
export const PLAYER_MOVE_SPEED = 2; // Pixels per frame - adjust for feel
export const PLAYER_JUMP_FORCE = 6; // Adjust for feel with new gravity/scale

// --- UI Constants ---
export const UI_AREA_HEIGHT = 30; // Height reserved for UI at the top
export const UI_HEALTH_BOX_SIZE = 15;
export const UI_HEALTH_BOX_PADDING = 4;
export const UI_HEALTH_LABEL_X = 10;
export const UI_HEALTH_BOX_START_X = 80; // X position where health boxes start
export const UI_Y_POSITION = 8;          // Y position for UI elements within the top area

// --- Rendering & Colors ---
export const BACKGROUND_COLOR = 'rgb(135, 206, 235)'; // Sky Blue
export const UI_HEALTH_BOX_COLOR_EMPTY = 'rgb(80, 80, 80)';
export const UI_HEALTH_BOX_COLOR_FULL = 'rgb(220, 40, 40)';
export const UI_TEXT_COLOR = 'black'; // Black text might be more visible on blue sky
// Game Over Screen
export const UI_GAMEOVER_OVERLAY_COLOR = 'rgba(0, 0, 0, 0.75)';
export const UI_GAMEOVER_TEXT_COLOR = 'red';
export const UI_GAMEOVER_STATS_COLOR = 'white';
export const UI_GAMEOVER_BUTTON_COLOR = 'darkred';
export const UI_GAMEOVER_BUTTON_TEXT_COLOR = 'white';
export const UI_GAMEOVER_BUTTON_WIDTH = 180;
export const UI_GAMEOVER_BUTTON_HEIGHT = 50;

// --- Game Loop ---
export const MAX_DELTA_TIME = 0.05; // Max time step (seconds) to prevent physics glitches (e.g. ~1/20th second)

// --- Future Constants (Examples) ---
// export const ENEMY_SPAWN_RATE = 2; // seconds
// export const ENEMY_HEALTH = 10;
// export const BLOCK_SIZE = 20;
// export const WOOD_DROP_CHANCE = 0.5; // 50%