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
export const PLAYER_START_X = HILL_CENTER_X - (PLAYER_WIDTH / 2);
export const PLAYER_START_Y = GROUND_BASE_LEVEL - HILL_MAX_HEIGHT - PLAYER_HEIGHT - 50;
// Health & Damage
export const PLAYER_INITIAL_HEALTH = 3;
export const PLAYER_MAX_HEALTH = 10;        // Max achievable health
export const PLAYER_INVULNERABILITY_DURATION = 2.0; // Seconds of invincibility after hit
// Attack
export const PLAYER_ATTACK_DURATION = 0.25;
export const PLAYER_ATTACK_COOLDOWN = 0.4;
export const PLAYER_ATTACK_DAMAGE = 1;
export const PLAYER_ATTACK_REACH_X = 18;
export const PLAYER_ATTACK_REACH_Y = 5;
export const PLAYER_ATTACK_WIDTH = 10;
export const PLAYER_ATTACK_HEIGHT = 25;
export const PLAYER_ATTACK_COLOR = 'rgba(255, 255, 255, 0.5)';

// --- Enemy Constants ---
export const ENEMY_WIDTH = 12;
export const ENEMY_HEIGHT = 18;
export const ENEMY_COLOR = 'rgb(80, 150, 80)';
export const ENEMY_SPEED = 1.5;
export const ENEMY_HEALTH = 1;
export const ENEMY_TARGET_X = HILL_CENTER_X;
// Damage & Drops
export const ENEMY_GRAVITY = 0.4; // Or some other number
export const ENEMY_CONTACT_DAMAGE = 1;      // Damage dealt by enemy touching player
export const ENEMY_DROP_TYPE = 'wood';
export const ENEMY_DROP_AMOUNT = 1;
export const ENEMY_DROP_CHANCE = 1.0;
// Spawning Control (Managed by Wave System now)
export const MAX_ENEMIES = 20; // Increase max slightly for waves

// --- Wave System Constants ---
// *** THIS CONSTANT WAS LIKELY MISSING ***
export const WAVE_START_DELAY = 3.0; // Seconds before first wave
// ****************************************
export const WAVE_INTERMISSION_DURATION = 60.0; // Seconds between waves
export const WAVE_1_ENEMY_COUNT = 15;
export const WAVE_ENEMY_SPAWN_DELAY = 0.5; // Seconds between enemy spawns in a wave

// --- Item Constants ---
export const ITEM_GRAVITY = 0.3; // Items might fall slower/faster than player
export const SWORD_WIDTH = 25;
export const SWORD_HEIGHT = 8; // Simple horizontal rectangle for now
export const SWORD_COLOR = 'rgb(180, 180, 190)'; // Silvery color
export const ITEM_BOBBLE_AMOUNT = 0.15; // How much items bob up and down slightly when idle
export const ITEM_BOBBLE_SPEED = 0.05; // How fast items bob
export const WOOD_ITEM_WIDTH = 8;
export const WOOD_ITEM_HEIGHT = 8;
export const WOOD_ITEM_COLOR = 'rgb(139, 69, 19)'; // Brown

// --- Physics Constants ---
export const GRAVITY = 0.4;
export const PLAYER_MOVE_SPEED = 4;
export const PLAYER_JUMP_FORCE = 9;

// --- UI Constants ---
export const UI_AREA_HEIGHT = 40; // Height reserved for UI at the top
export const UI_HEALTH_BOX_SIZE = 20;
export const UI_HEALTH_BOX_PADDING = 5;
export const UI_HEALTH_LABEL_X = 10;
export const UI_HEALTH_BOX_START_X = 100; // X position where health boxes start
export const UI_Y_POSITION = 10;          // Y position for UI elements within the top area

// Game Over Screen
export const UI_GAMEOVER_OVERLAY_COLOR = 'rgba(0, 0, 0, 0.75)'; // Dark semi-transparent
export const UI_GAMEOVER_TEXT_COLOR = 'red';
export const UI_GAMEOVER_STATS_COLOR = 'white';
export const UI_GAMEOVER_BUTTON_COLOR = 'darkred';
export const UI_GAMEOVER_BUTTON_TEXT_COLOR = 'white';
export const UI_GAMEOVER_BUTTON_WIDTH = 180;
export const UI_GAMEOVER_BUTTON_HEIGHT = 50;


// --- Rendering & Colors ---
export const GROUND_COLOR = 'rgb(100, 180, 80)'; // Dirt/Grass
export const SAND_COLOR = 'rgb(210, 180, 140)';   // Tan Sand
export const WATER_COLOR = 'rgb(50, 100, 200)';   // Blue Water
export const PLAYER_COLOR = 'rgb(200, 50, 50)';   // Red Player
export const BACKGROUND_COLOR = 'black';        // Background color
// UI Colors
export const UI_HEALTH_BOX_COLOR_EMPTY = 'rgb(80, 80, 80)';
export const UI_HEALTH_BOX_COLOR_FULL = 'rgb(220, 40, 40)';
export const UI_TEXT_COLOR = 'white';

// --- Game Loop ---
export const MAX_DELTA_TIME = 0.05; // Max time step (seconds) to prevent physics glitches (e.g. ~1/20th second)

// --- Future Constants (Examples) ---
// export const ENEMY_SPAWN_RATE = 2; // seconds
// export const ENEMY_HEALTH = 10;
// export const BLOCK_SIZE = 20;
// export const WOOD_DROP_CHANCE = 0.5; // 50%