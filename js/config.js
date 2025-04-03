// -----------------------------------------------------------------------------
// config.js - Centralized Game Configuration
// -----------------------------------------------------------------------------
console.log("config.js loaded");

// --- World Parameters ---
export const CANVAS_WIDTH = 800; // Match canvas element width
export const CANVAS_HEIGHT = 800; // Match canvas element height

export const WATER_WIDTH = 100; // Width of water body on each side
export const SAND_WIDTH = 30;   // Width of the sand transition zone
export const GROUND_START_X = WATER_WIDTH + SAND_WIDTH;
export const GROUND_END_X = CANVAS_WIDTH - WATER_WIDTH - SAND_WIDTH;
export const GROUND_WIDTH = GROUND_END_X - GROUND_START_X;

// --- Level Heights ---
export const GROUND_BASE_LEVEL = CANVAS_HEIGHT - 100; // Flat ground level
export const WATER_LEVEL = CANVAS_HEIGHT - 80;    // Water surface level
export const HILL_MAX_HEIGHT = 150; // Max height of the hill *above* GROUND_BASE_LEVEL

// --- Hill Parameters ---
export const HILL_CENTER_X = CANVAS_WIDTH / 2;
export const HILL_EFFECTIVE_WIDTH = GROUND_WIDTH * 0.8; // Hill spreads across 80% of the ground

// --- Player Constants ---
export const PLAYER_WIDTH = 10;
export const PLAYER_HEIGHT = 20;
export const PLAYER_START_X = HILL_CENTER_X - (PLAYER_WIDTH / 2); // Centered horizontally
export const PLAYER_START_Y = GROUND_BASE_LEVEL - HILL_MAX_HEIGHT - PLAYER_HEIGHT - 50; // Start well above peak

// --- Physics Constants ---
export const GRAVITY = 0.4;
export const PLAYER_MOVE_SPEED = 4;
export const PLAYER_JUMP_FORCE = 9;

// --- Rendering & Colors ---
export const GROUND_COLOR = 'rgb(100, 180, 80)'; // Dirt/Grass
export const SAND_COLOR = 'rgb(210, 180, 140)';   // Tan Sand
export const WATER_COLOR = 'rgb(50, 100, 200)';   // Blue Water
export const PLAYER_COLOR = 'rgb(200, 50, 50)';   // Red Player
export const BACKGROUND_COLOR = 'black';        // Background color

// --- Game Loop ---
export const MAX_DELTA_TIME = 0.05; // Max time step (seconds) to prevent physics glitches (e.g. ~1/20th second)

// --- Future Constants (Examples) ---
// export const ENEMY_SPAWN_RATE = 2; // seconds
// export const ENEMY_HEALTH = 10;
// export const BLOCK_SIZE = 20;
// export const WOOD_DROP_CHANCE = 0.5; // 50%