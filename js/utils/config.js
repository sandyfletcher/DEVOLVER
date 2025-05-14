// -----------------------------------------------------------------------------
// root/js/config.js - Centralized Game Configuration
// -----------------------------------------------------------------------------

// --- Audio Constants ---

export const AUDIO_SFX_POOL_SIZE = 8;
export const AUDIO_DEFAULT_GAME_VOLUME = 0.4;
export const AUDIO_DEFAULT_UI_VOLUME = 0.6;
export const AUDIO_DEFAULT_SFX_VOLUME = 0.8;
export const AUDIO_TRACKS = {
    // title: 'assets/audio/title_music.mp3',
    pause: 'assets/audio/music/Pause.mp3',
    // gameOver: 'assets/audio/gameover_music.mp3',
    victory: 'assets/audio/music/Victory.mp3',
    // introMusic: 'assets/audio/music/Intro.mp3',
    wave1: 'assets/audio/music/Wave1-350.mp3',
    wave2: 'assets/audio/music/Wave2-300.mp3',
    wave3: 'assets/audio/music/wave3.mp3',
    // SFX placeholders
    // player_hit: 'assets/audio/sfx/player_hit.wav',
};

// --- Camera / Viewport ---

export const MIN_CAMERA_SCALE = 0.25; // Min zoom level (e.g., 0.25 means zoomed out to 1/4 size).
export const MAX_CAMERA_SCALE = 3.0;  // Max zoom level (e.g., 3.0 means zoomed in 3x).
export const ZOOM_SPEED_FACTOR = 0.001; // Sensitivity of mouse wheel zoom.

// --- Cutscene Parameters ---

export const CUTSCENE_IMAGE_DURATION = 3.0; // seconds image displayed
export const CUTSCENE_SLIDES = [
    { imagePath: 'assets/cut1.png', text: "In the near future, dolphins master nuclear fusion and seize control of the planet." },
    { imagePath: 'assets/cut2.jpg', text: "As an elite triple-agent SEAL team 7 operative, you inflitrated their lab compound and harnessed their technology to send yourself back in time." },
    { imagePath: 'assets/cut3.png', text: "Use your military and ballet training, along with knowledge of modern technology, to defeat any threats to humanity that attempt to breach your position." },
    { imagePath: 'assets/cut4.png', text: "Only one thing has followed you back in time - a simple shovel.  Will that be enough?" }
];

// --- Game Grid ---

export const BACKGROUND_COLOR = 'rgb(135, 206, 235)'; // TODO: develop background images with moving parts
export const BASE_BLOCK_PIXEL_SIZE = 16; // size in pixels of one side of square block
export const BLOCK_WIDTH = BASE_BLOCK_PIXEL_SIZE;
export const BLOCK_HEIGHT = BASE_BLOCK_PIXEL_SIZE;
export const GRID_COLS = 400; // # of columns in world grid
export const GRID_ROWS = 200; // # of rows
export const CANVAS_WIDTH = GRID_COLS * BLOCK_WIDTH; // internal canvas dimensions in pixels
export const CANVAS_HEIGHT = GRID_ROWS * BLOCK_HEIGHT;

// --- Block Parameters ---

export const BLOCK_DAMAGE_INDICATOR_COLOR = 'rgba(0, 0, 0, 0.9)';
export const BLOCK_DAMAGE_INDICATOR_LINE_WIDTH = 2; // fixed pixel thickness for visual consistency
export const BLOCK_DAMAGE_THRESHOLD_SLASH = 0.7; // show slash when HP <= 70%
export const BLOCK_DAMAGE_THRESHOLD_X = 0.3; // show X when HP <= 30%
export const GHOST_BLOCK_ALPHA = 0.5; // transparency for placement preview
export const CAN_PLACE_IN_WATER = false;
export const PLAYER_BLOCK_OUTLINE_COLOR = 'rgba(255, 255, 255, 0.8)';
export const PLAYER_BLOCK_OUTLINE_THICKNESS = 2; // fixed pixel thickness
// Block Type IDs (numeric constants)
export const BLOCK_AIR = 0; 
export const BLOCK_WATER = 1;
export const BLOCK_SAND = 2;
export const BLOCK_DIRT = 3;
export const BLOCK_VEGETATION = 4;
export const BLOCK_STONE = 5;
export const BLOCK_WOOD = 6;
export const BLOCK_METAL = 7;
export const BLOCK_BONE = 8;
export const BLOCK_ROPE = 9;
export const BLOCK_HP = {
    [BLOCK_WATER]: Infinity, [BLOCK_SAND]: 30, [BLOCK_DIRT]: 50, [BLOCK_VEGETATION]: 25,
    [BLOCK_STONE]: 300, [BLOCK_WOOD]: 100, [BLOCK_METAL]: 500, [BLOCK_BONE]: 120,
};
export const BLOCK_COLORS = {
    [BLOCK_WATER]: 'rgb(50, 100, 200)', [BLOCK_SAND]: 'rgb(210, 180, 140)', [BLOCK_DIRT]: 'rgb(130, 82, 45)',
    [BLOCK_VEGETATION]: 'rgb(80, 180, 80)', [BLOCK_STONE]: 'rgb(140, 140, 140)', [BLOCK_WOOD]: 'rgb(160, 110, 70)',
    [BLOCK_METAL]: 'rgb(190, 190, 200)', [BLOCK_BONE]: 'rgb(200, 190, 170)',
    [BLOCK_ROPE]: 30,
};
export const AGING_MATERIAL_CONVERSION_FACTORS = {
    [BLOCK_DIRT]: 1.0, [BLOCK_VEGETATION]: 1.0, [BLOCK_STONE]: 1.0,
    [BLOCK_BONE]: 1.0, [BLOCK_WOOD]: 1.0, [BLOCK_METAL]: 1.0,
};
export const INVENTORY_MATERIALS = [ 'dirt', 'vegetation', 'sand', 'stone', 'wood', 'bone', 'metal'];
export const MATERIAL_TO_BLOCK_TYPE = {
    'dirt': BLOCK_DIRT, 'stone': BLOCK_STONE, 'wood': BLOCK_WOOD,
    'sand': BLOCK_SAND, 'metal': BLOCK_METAL, 'bone': BLOCK_BONE,
    'vegetation': BLOCK_VEGETATION,
};

// --- Landmass Generation ---

export const ISLAND_WIDTH_MIN = 0.75; // minimum width of island
export const ISLAND_WIDTH_MAX = 0.85; // as percentage of GRID_COLS
export const WATER_LEVEL_FRACTION = 0.25; // % of bottom GRID_ROWS water covers
export const WATER_LEVEL = Math.floor(GRID_ROWS * (1.0 - WATER_LEVEL_FRACTION)); // calculate target row for water surface
export const MEAN_GROUND_LEVEL = WATER_LEVEL - Math.floor(GRID_ROWS * 0.20); // mean row for ground surface
export const AVERAGE_SUBSURFACE_LANDMASS_THICKNESS = (GRID_ROWS - 1) - MEAN_GROUND_LEVEL;
export const DIRT_LAYER_THICKNESS_FACTOR = 0.7;
export const STONE_DEPTH_BELOW_GROUND = Math.max(3, Math.round(DIRT_LAYER_THICKNESS_FACTOR * AVERAGE_SUBSURFACE_LANDMASS_THICKNESS)); // # of rows deep stone starts below average ground level
export const MEAN_STONE_LEVEL = MEAN_GROUND_LEVEL + STONE_DEPTH_BELOW_GROUND; // mean row for top of stone layer
export const WORLD_GROUND_VARIATION = 4; // Variation in rows for ground level noise
export const WORLD_STONE_VARIATION = 2; // Variation in rows for stone level noise
export const WORLD_NOISE_SCALE = 0.03; // Scale factor for Perlin noise used in terrain generation
export const GROUND_NOISE_OCTAVES = 4;        // Number of octaves for ground surface noise
export const GROUND_NOISE_PERSISTENCE = 0.5;  // Amplitude multiplier for each subsequent octave
export const GROUND_NOISE_LACUNARITY = 2.0;   // Frequency multiplier for each subsequent octave
export const STONE_NOISE_OCTAVES = 3;         // Number of octaves for stone layer noise
export const STONE_NOISE_PERSISTENCE = 0.45;
export const STONE_NOISE_LACUNARITY = 2.2;

// --- Cave Generation ---

export const ENABLE_CAVES = true;
export const CAVE_NOISE_SCALE_X = 0.08; // Scale for 2D Perlin noise for caves (adjust for smaller/larger caves)
export const CAVE_NOISE_SCALE_Y = 0.07; // Can be different for X and Y to stretch caves
export const CAVE_THRESHOLD = 0.5; // Noise values above this threshold become air (range typically [-1,1] or [0,1] - adjust based on noise2D output) - If noise2D outputs roughly [-1,1], a threshold of 0.6 means ~20% of area could be caves.
export const CAVE_MIN_ROWS_BELOW_SURFACE = 0; // Caves start at least this many rows below the generated surface
export const CAVE_MIN_ROWS_ABOVE_BOTTOM = 15; // Caves stop at least this many rows above the grid bottom
export const CAVE_EDGE_ZONE_PERCENTAGE = 0.20; // Percentage of map width for edge zones (0.0 to 0.5)
export const CAVE_EDGE_WATER_PROTECTION_DEPTH = 3; // How many blocks above/below water level to protect in edge zones

// --- Beach Smoothing ---

export const OCEAN_FLOOR_ROW_NEAR_ISLAND = WATER_LEVEL + 5; // Target row for ocean floor near the island
export const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8; // Target row for ocean stone near the island
export const DEEP_OCEAN_BASE_ROW_OFFSET = Math.floor(GRID_ROWS * 0.1); // Offset in rows for deep ocean from water level
export const DEEP_OCEAN_MAX_ROW = GRID_ROWS - 3; // Maximum row depth for the deep ocean floor
export const DEEP_OCEAN_FLOOR_START_ROW = Math.min(DEEP_OCEAN_MAX_ROW, WATER_LEVEL + DEEP_OCEAN_BASE_ROW_OFFSET); // Starting row for deep ocean floor
export const DEEP_OCEAN_STONE_START_ROW = DEEP_OCEAN_FLOOR_START_ROW + 8; // Starting row for deep ocean stone
export const EDGE_TAPER_WIDTH_FACTOR = 0.15; // Percentage of GRID_COLS for edge tapering
export const EDGE_STONE_LEVEL_TARGET_ROW_OFFSET = 15; // Target stone level offset (in rows) at the absolute world edge
export const EDGE_FLOOR_LEVEL_TARGET_ROW_OFFSET = 20; // Target floor level offset (in rows) at the absolute world edge
export const ISLAND_CENTER_TAPER_WIDTH_COLS = 80; // Width in columns for tapering from island edge inward

// --- Aging Parameters ---

export const AGING_NOISE_SCALE = 0.03;   // Scale for Perlin noise used in aging.
export const AGING_STONEIFICATION_DEPTH_THRESHOLD_ROWS = Math.floor(GRID_ROWS * 0.45); // Threshold in rows for stoneification.
export const AGING_STONEIFICATION_DEPTH_THRESHOLD = AGING_STONEIFICATION_DEPTH_THRESHOLD_ROWS * BLOCK_HEIGHT; // Threshold in pixels.
export const AGING_WATER_DEPTH_INFLUENCE_MAX_DEPTH = 4; // Max contiguous water depth (in blocks) influencing probabilities.
export const AGING_INITIAL_PASSES = 50; // Number of aging passes on initial world generation.
export const AGING_DEFAULT_PASSES_PER_WAVE = 5; // Default aging passes between waves.
export const AGING_PROB_WATER_EROSION_SAND = 0.0001; // Probabilities (chance per eligible block per pass)
export const AGING_PROB_AIR_EROSION_SAND = 0.0001;
export const AGING_PROB_WATER_EROSION_DIRT_VEGETATION = 0.9;
export const AGING_PROB_STONEIFICATION_DEEP = 0.000001;
export const AGING_PROB_HORIZONTAL_SAND_SPREAD = 0.85; // Chance for dirt/VEGETATION/stone next to "wet" sand to become sand
export const AGING_PROB_EROSION_SURFACE_STONE = 0.00001;
export const AGING_PROB_SEDIMENTATION_UNDERWATER_AIR_WATER = 0.9;
export const AGING_PROB_SAND_SEDIMENTATION_BELOW = 0.9;
export const AGING_PROB_VEGETATION_GROWTH_BASE = 0.1;         // Base probability if ANY side is exposed to air
export const AGING_PROB_VEGETATION_GROWTH_PER_AIR_SIDE = 0.2; // Additional probability per air-exposed side
export const AGING_MAX_AIR_SIDES_FOR_VEGETATION_BONUS = 3;    // Max number of air sides that contribute to bonus probability (e.g., 1-3 sides 
export const AGING_PROB_VEGETATION_GROW_UP = 0.05; // Chance for existing VEGETATION to grow upwards into AIR
export const TREE_MIN_HEIGHT_TO_FORM = 5;         // Minimum contiguous VEGETATION blocks required to form a tree
export const TREE_INITIAL_CANOPY_RADIUS = 2;      // Radius (in blocks) of the initial VEGETATION canopy when a tree forms (0=just top, 1=3x3, 2=5x5)
export const AGING_PROB_TREE_CANOPY_GROW = 0.1;  // Chance for a tree canopy block to expand into adjacent AIR
export const TREE_MAX_CANOPY_RADIUS = 4;          // Maximum radius (in blocks) a tree canopy can reach
export const AGING_PROB_TREE_TRUNK_DECAY = 0.005; // Chance for a tree WOOD block (part of a trunk) to decay into AIR
export const AGING_PROB_TREE_CANOPY_DECAY = 0.01; // Chance for a tree VEGETATION block (part of canopy) to decay
export const AGING_PROB_VEGETATION_TO_WOOD_SURROUNDED = 0.02; // NEW: Chance for VEG surrounded by VEG to become WOOD
export const AGING_PROB_WOOD_GROWS_WOOD_UP = 0.1; // NEW: Chance for WOOD to grow WOOD upwards (if supported and air above)
export const TREE_MIN_HEIGHT_TO_FORM_ORGANIC = 4;   // NEW or Repurpose: Min trunk height for organic canopy formation
export const MAX_NATURAL_TRUNK_HEIGHT_BEFORE_COLLAPSE = 15; // Keep this: Max height before trunk collapses

// --- Animation Parameters ---

export const AGING_ANIMATION_BLOCKS_AT_ONCE = 5; // Max number of blocks animating simultaneously
export const AGING_ANIMATION_NEW_BLOCK_DELAY = 0.05; // Delay (seconds) before starting the next block animation in the queue
export const AGING_ANIMATION_SWELL_DURATION = 0.25; // Duration (seconds) of the "swell" part
export const AGING_ANIMATION_POP_DURATION = 0.1;  // Duration (seconds) of the "pop" (e.g., quick shrink/disappear of old, appear of new)
export const AGING_ANIMATION_SWELL_SCALE = 1.8;   // Max scale factor during swell (e.g., 1.5x size)
export const AGING_ANIMATION_OLD_BLOCK_COLOR = 'rgba(200, 200, 200, 0.7)'; // Color for swelling old block
export const AGING_ANIMATION_NEW_BLOCK_COLOR = 'rgba(255, 255, 150, 0.8)'; // Color for appearing new block (bddriefly)
export const WARPPHASE_DURATION = 8.0; // Fixed duration of WARP PHASE in seconds (time-based).
export const ENEMY_DEATH_ANIMATION_DURATION = 0.5; // Total time in seconds for enemy death animation.
export const ENEMY_SWELL_DURATION = 0.3;        // Time in seconds for the swell part of enemy death.
export const ENEMY_SWELL_SCALE = 1.5;           // Max scale factor during enemy swell (e.g., 1.5x size).
export const PLAYER_DEATH_ANIMATION_DURATION = 1.5; // Total time in seconds for player death animation.
export const PLAYER_SPIN_DURATION = 1.0;        // Time in seconds for the spin part of player death.
export const PLAYER_SPIN_FRAMES = 6;            // Number of visual steps in the player spin animation.

// --- Delta-Time Physics ---

export const GRAVITY_ACCELERATION_BLOCKS_PER_SEC_SQ = 100; // Base acceleration in block heights per second squared.
export const GRAVITY_ACCELERATION = GRAVITY_ACCELERATION_BLOCKS_PER_SEC_SQ * BLOCK_HEIGHT; // Pixels per second squared.
export const MAX_FALL_SPEED_BLOCKS_PER_SEC = 120; // Base max fall speed in block heights per second.
export const MAX_FALL_SPEED = MAX_FALL_SPEED_BLOCKS_PER_SEC * BLOCK_HEIGHT; // Pixels per second.
export const MAX_DELTA_TIME = 0.05; // Max time step in seconds to prevent physics glitches (~20fps min simulation).
export const ENTITY_STEP_TIER1_MAX_HEIGHT_FACTOR = 1/3; // Entity step-up allowance, defined as factors of entity height (already relative to scaled entity).
export const ENTITY_STEP_TIER2_MAX_HEIGHT_FACTOR = 1/2;
export const ENTITY_STEP_TIER2_HORIZONTAL_FRICTION = 0.7; // Factor to multiply horizontal velocity by after a tier 2 step.
export const WATER_GRAVITY_FACTOR = 0.4; // Water physics factors (unitless multipliers).
export const WATER_HORIZONTAL_DAMPING = 0.1; // Lower values mean stronger damping.
export const WATER_VERTICAL_DAMPING = 0.05;
export const WATER_MAX_SPEED_FACTOR = 0.6;
export const WATER_ACCELERATION_FACTOR = 0.5;
export const WATER_SWIM_VELOCITY_BLOCKS_PER_SEC = 50; // Base upward speed from a swim 'stroke' in block heights/sec.
export const WATER_SWIM_VELOCITY = WATER_SWIM_VELOCITY_BLOCKS_PER_SEC * BLOCK_HEIGHT; // Pixels per second.
export const WATER_MAX_SWIM_UP_SPEED_BLOCKS_PER_SEC = 20; // Base max upward swim speed in block heights/sec.
export const WATER_MAX_SWIM_UP_SPEED = WATER_MAX_SWIM_UP_SPEED_BLOCKS_PER_SEC * BLOCK_HEIGHT; // Pixels per second.
export const WATER_MAX_SINK_SPEED_BLOCKS_PER_SEC = 25; // Base max downward speed in water in block heights/sec.
export const WATER_MAX_SINK_SPEED = WATER_MAX_SINK_SPEED_BLOCKS_PER_SEC * BLOCK_HEIGHT; // Pixels per second.
export const ENEMY_WATER_BUOYANCY_ACCEL_BLOCKS_PER_SEC_SQ = 45; // Base buoyancy acceleration in block heights/sec^2.
export const ENEMY_WATER_BUOYANCY_ACCEL = ENEMY_WATER_BUOYANCY_ACCEL_BLOCKS_PER_SEC_SQ * BLOCK_HEIGHT; // Pixels/sec^2.
export const WATER_JUMP_COOLDOWN_DURATION = 0.2; // Time in seconds.
export const WATER_PROPAGATION_DELAY = 0.05;    // Time in seconds between water simulation ticks.
export const WATER_UPDATES_PER_FRAME = 500;   // Max number of water cells to process per simulation tick.

// --- Portal Parameters ---

export const PORTAL_COLOR = 'rgb(100, 100, 255)';
export const PORTAL_WIDTH_BLOCKS = 6;  // Portal width in block units.
export const PORTAL_HEIGHT_BLOCKS = 8; // Portal height in block units
export const PORTAL_BORDER_COLOR = 'silver';
export const PORTAL_BORDER_WIDTH = 10; // Pixel width of the border
export const PORTAL_WIDTH = PORTAL_WIDTH_BLOCKS * BLOCK_WIDTH;   // Pixel width.
export const PORTAL_HEIGHT = PORTAL_HEIGHT_BLOCKS * BLOCK_HEIGHT; // Pixel height.
export const PORTAL_INITIAL_HEALTH = 500;
export const PORTAL_ABSORB_ANIMATION_DURATION = 0.75; // seconds
export const PORTAL_SAFETY_RADIUS_BLOCKS = 30; // Radius in block units.
export const PORTAL_SAFETY_RADIUS = PORTAL_SAFETY_RADIUS_BLOCKS * BASE_BLOCK_PIXEL_SIZE; // Pixel radius.
export const PORTAL_RADIUS_GROWTH_PER_WAVE_BLOCKS = 5; // Radius growth in block units per intermission.
export const PORTAL_RADIUS_GROWTH_PER_WAVE = PORTAL_RADIUS_GROWTH_PER_WAVE_BLOCKS * BASE_BLOCK_PIXEL_SIZE; // Pixel growth.
export const PORTAL_SPAWN_Y_OFFSET_BLOCKS = 8; // Offset in block units above mean ground for portal top.

// --- Player Parameters ---

export const PLAYER_COLOR = 'rgb(200, 50, 50)';
export const PLAYER_WIDTH_BLOCKS = 3;  // Player width in block units.
export const PLAYER_HEIGHT_BLOCKS = 6; // Player height in block units.
export const PLAYER_WIDTH = PLAYER_WIDTH_BLOCKS * BLOCK_WIDTH;   // Pixel width.
export const PLAYER_HEIGHT = PLAYER_HEIGHT_BLOCKS * BLOCK_HEIGHT; // Pixel height.
export const PLAYER_START_X = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2; // Player start position (pixels, derived from block-based world constants).
export const PLAYER_START_Y = (MEAN_GROUND_LEVEL * BLOCK_HEIGHT) - PLAYER_HEIGHT - (5 * BLOCK_HEIGHT);
export const PLAYER_INITIAL_HEALTH = 100;       // Unitless.
export const PLAYER_MAX_HEALTH_DISPLAY = 100;   // Unitless, for UI.
export const PLAYER_INVULNERABILITY_DURATION = 1.5; // Seconds.
export const PLAYER_MOVE_ACCELERATION_BLOCKS_PER_SEC_SQ = 200; // Base acceleration in block widths/sec^2.
export const PLAYER_MOVE_ACCELERATION = PLAYER_MOVE_ACCELERATION_BLOCKS_PER_SEC_SQ * BLOCK_WIDTH; // Pixels/sec^2.
export const PLAYER_MAX_SPEED_X_BLOCKS_PER_SEC = 30; // Base max horizontal speed in block widths/sec.
export const PLAYER_MAX_SPEED_X = PLAYER_MAX_SPEED_X_BLOCKS_PER_SEC * BLOCK_WIDTH; // Pixels/sec.
export const PLAYER_FRICTION_BASE = 0.01; // Factor for ground friction (lower means stronger friction).
export const PLAYER_JUMP_VELOCITY_BLOCKS_PER_SEC = 50; // Base initial upward velocity in block heights/sec.
export const PLAYER_JUMP_VELOCITY = PLAYER_JUMP_VELOCITY_BLOCKS_PER_SEC * BLOCK_HEIGHT; // Pixels/sec.
export const PLAYER_INTERACTION_RANGE_BLOCKS = 12; // Max interaction distance in block units.
export const PLAYER_INTERACTION_RANGE = PLAYER_INTERACTION_RANGE_BLOCKS * BLOCK_WIDTH; // Pixel range.
export const PLAYER_INTERACTION_RANGE_SQ = PLAYER_INTERACTION_RANGE * PLAYER_INTERACTION_RANGE; // Squared pixel range.
export const PLAYER_ITEM_ATTRACT_RADIUS_BLOCKS = 25; // Item attraction distance in block units.
export const PLAYER_ITEM_ATTRACT_RADIUS = PLAYER_ITEM_ATTRACT_RADIUS_BLOCKS * BLOCK_WIDTH; // Pixel radius.
export const PLAYER_ITEM_ATTRACT_RADIUS_SQ = PLAYER_ITEM_ATTRACT_RADIUS * PLAYER_ITEM_ATTRACT_RADIUS; // Squared pixel radius.
export const PLAYER_ITEM_ATTRACT_SPEED_BLOCKS_PER_SEC = 60; // Base speed for attracted items in block widths/sec.
export const PLAYER_ITEM_ATTRACT_SPEED = PLAYER_ITEM_ATTRACT_SPEED_BLOCKS_PER_SEC * BLOCK_WIDTH; // Pixels/sec.
export const PLAYER_PLACEMENT_COOLDOWN = 0.01; // seconds between block placement
export const PLAYER_ROPE_CLIMB_SPEED_BLOCKS_PER_SEC = 30; // Player rope interaction
export const PLAYER_ROPE_CLIMB_SPEED = PLAYER_ROPE_CLIMB_SPEED_BLOCKS_PER_SEC * BLOCK_HEIGHT; // pixels/sec
export const PLAYER_ROPE_SLIDE_SPEED_BLOCKS_PER_SEC = 45;
export const PLAYER_ROPE_SLIDE_SPEED = PLAYER_ROPE_SLIDE_SPEED_BLOCKS_PER_SEC * BLOCK_HEIGHT; // pixels/sec
export const PLAYER_ROPE_HORIZONTAL_DAMPING = 0.001; // Very strong damping while on rope
export const PLAYER_ROPE_DETACH_IMPULSE_X_BLOCKS_PER_SEC = 20;
export const PLAYER_ROPE_DETACH_IMPULSE_X = PLAYER_ROPE_DETACH_IMPULSE_X_BLOCKS_PER_SEC * BLOCK_WIDTH; // pixels/sec
export const PLAYER_ROPE_DETACH_JUMP_MULTIPLIER = 0.6; // e.g., 60% of normal jump velocity

// --- Items & Weapons ---

export const ITEM_BOBBLE_AMOUNT = 0.15; // Factor relative to item height.
export const ITEM_BOBBLE_SPEED = 2.0;   // Radians per second for bobbing cycle (time-based).
export const WEAPON_TYPE_UNARMED = 'unarmed'; // Weapon types (string constants)
export const WEAPON_TYPE_SHOVEL = 'shovel';
export const WEAPON_TYPE_SWORD = 'sword';
export const WEAPON_TYPE_SPEAR = 'spear';
export const SHOVEL_WIDTH_BLOCKS = 1; export const SHOVEL_HEIGHT_BLOCKS = 2; // Weapon dimensions (defined in block units, then scaled to pixels).
export const SHOVEL_WIDTH = SHOVEL_WIDTH_BLOCKS * BLOCK_WIDTH; export const SHOVEL_HEIGHT = SHOVEL_HEIGHT_BLOCKS * BLOCK_HEIGHT;
export const SWORD_WIDTH_BLOCKS = 3; export const SWORD_HEIGHT_BLOCKS = 1;
export const SWORD_WIDTH = SWORD_WIDTH_BLOCKS * BLOCK_WIDTH; export const SWORD_HEIGHT = SWORD_HEIGHT_BLOCKS * BLOCK_HEIGHT;
export const SPEAR_WIDTH_BLOCKS = 4; export const SPEAR_HEIGHT_BLOCKS = 1;
export const SPEAR_WIDTH = SPEAR_WIDTH_BLOCKS * BLOCK_WIDTH; export const SPEAR_HEIGHT = SPEAR_HEIGHT_BLOCKS * BLOCK_HEIGHT;
export const SHOVEL_COLOR = 'rgb(160, 160, 160)'; // Weapon colors (fixed)
export const SWORD_COLOR = 'rgb(180, 180, 190)';
export const SPEAR_COLOR = 'rgb(210, 180, 140)';
export const PLAYER_SHOVEL_ATTACK_DAMAGE = 5; // Player attack damage (unitless), reach/hitbox (block units -> pixels), durations (seconds).
export const PLAYER_SHOVEL_BLOCK_DAMAGE = 25;
export const PLAYER_SHOVEL_ATTACK_REACH_X_BLOCKS = PLAYER_WIDTH_BLOCKS/2 + SHOVEL_WIDTH_BLOCKS*1.5;
export const PLAYER_SHOVEL_ATTACK_REACH_X = PLAYER_SHOVEL_ATTACK_REACH_X_BLOCKS * BLOCK_WIDTH;
export const PLAYER_SHOVEL_ATTACK_REACH_Y_BLOCKS = PLAYER_HEIGHT_BLOCKS*0.4;
export const PLAYER_SHOVEL_ATTACK_REACH_Y = PLAYER_SHOVEL_ATTACK_REACH_Y_BLOCKS * BLOCK_HEIGHT;
export const PLAYER_SHOVEL_ATTACK_WIDTH_BLOCKS = SHOVEL_WIDTH_BLOCKS * 2;
export const PLAYER_SHOVEL_ATTACK_WIDTH = PLAYER_SHOVEL_ATTACK_WIDTH_BLOCKS * BLOCK_WIDTH;
export const PLAYER_SHOVEL_ATTACK_HEIGHT_BLOCKS = SHOVEL_HEIGHT_BLOCKS * 2;
export const PLAYER_SHOVEL_ATTACK_HEIGHT = PLAYER_SHOVEL_ATTACK_HEIGHT_BLOCKS * BLOCK_HEIGHT;
export const PLAYER_SHOVEL_ATTACK_DURATION = 0.3;
export const PLAYER_SHOVEL_ATTACK_COOLDOWN = 0.4;
export const PLAYER_SHOVEL_ATTACK_COLOR = 'rgba(180, 180, 180, 0.5)';
export const PLAYER_SWORD_ATTACK_DAMAGE = 15;
export const PLAYER_SWORD_BLOCK_DAMAGE = 0;
export const PLAYER_SWORD_ATTACK_REACH_X_BLOCKS = PLAYER_WIDTH_BLOCKS * 0.8;
export const PLAYER_SWORD_ATTACK_REACH_X = PLAYER_SWORD_ATTACK_REACH_X_BLOCKS * BLOCK_WIDTH;
export const PLAYER_SWORD_ATTACK_REACH_Y_BLOCKS = PLAYER_HEIGHT_BLOCKS * 0;
export const PLAYER_SWORD_ATTACK_REACH_Y = PLAYER_SWORD_ATTACK_REACH_Y_BLOCKS * BLOCK_HEIGHT;
export const PLAYER_SWORD_ATTACK_WIDTH_BLOCKS = PLAYER_WIDTH_BLOCKS * 1.5;
export const PLAYER_SWORD_ATTACK_WIDTH = PLAYER_SWORD_ATTACK_WIDTH_BLOCKS * BLOCK_WIDTH;
export const PLAYER_SWORD_ATTACK_HEIGHT_BLOCKS = PLAYER_HEIGHT_BLOCKS * 0.9;
export const PLAYER_SWORD_ATTACK_HEIGHT = PLAYER_SWORD_ATTACK_HEIGHT_BLOCKS * BLOCK_HEIGHT;
export const PLAYER_SWORD_ATTACK_DURATION = 0.2;
export const PLAYER_SWORD_ATTACK_COOLDOWN = 0.3;
export const PLAYER_SWORD_ATTACK_COLOR = 'rgba(255, 255, 255, 0.5)';
export const PLAYER_SPEAR_ATTACK_DAMAGE = 8;
export const PLAYER_SPEAR_BLOCK_DAMAGE = 0;
export const PLAYER_SPEAR_ATTACK_REACH_X_BLOCKS = PLAYER_WIDTH_BLOCKS * 1.2;
export const PLAYER_SPEAR_ATTACK_REACH_X = PLAYER_SPEAR_ATTACK_REACH_X_BLOCKS * BLOCK_WIDTH;
export const PLAYER_SPEAR_ATTACK_REACH_Y_BLOCKS = PLAYER_HEIGHT_BLOCKS * 0.1;
export const PLAYER_SPEAR_ATTACK_REACH_Y = PLAYER_SPEAR_ATTACK_REACH_Y_BLOCKS * BLOCK_HEIGHT;
export const PLAYER_SPEAR_ATTACK_WIDTH_BLOCKS = SPEAR_WIDTH_BLOCKS * 0.3;
export const PLAYER_SPEAR_ATTACK_WIDTH = PLAYER_SPEAR_ATTACK_WIDTH_BLOCKS * BLOCK_WIDTH;
export const PLAYER_SPEAR_ATTACK_HEIGHT_BLOCKS = SPEAR_HEIGHT_BLOCKS * 2;
export const PLAYER_SPEAR_ATTACK_HEIGHT = PLAYER_SPEAR_ATTACK_HEIGHT_BLOCKS * BLOCK_HEIGHT;
export const PLAYER_SPEAR_ATTACK_DURATION = 0.3;
export const PLAYER_SPEAR_ATTACK_COOLDOWN = 0.5;
export const PLAYER_SPEAR_ATTACK_COLOR = 'rgba(220, 220, 180, 0.5)';
export const ITEM_CONFIG = { // Item configuration (pixel dimensions are derived from block-unit constants above).
    [WEAPON_TYPE_SHOVEL]: { width: SHOVEL_WIDTH, height: SHOVEL_HEIGHT, color: SHOVEL_COLOR },
    [WEAPON_TYPE_SWORD]: { width: SWORD_WIDTH, height: SWORD_HEIGHT, color: SWORD_COLOR },
    [WEAPON_TYPE_SPEAR]: { width: SPEAR_WIDTH, height: SPEAR_HEIGHT, color: SPEAR_COLOR },
    'dirt': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_DIRT] },
    'vegetation': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_VEGETATION] },
    'sand': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_SAND] },
    'wood': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_WOOD] },
    'stone': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_STONE] },
    'metal': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_METAL] },
    'bone': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_BONE] },
};
export const CRAFTING_RECIPES = { // Crafting recipes (fixed material types and amounts)
    [WEAPON_TYPE_SWORD]: [{ type: 'stone', amount: 5 }],
    [WEAPON_TYPE_SPEAR]: [{ type: 'wood', amount: 2 }, { type: 'stone', amount: 1 }],
};

// --- Enemy Parameters ---

export const MAX_ENEMIES = 150; // TODO: determine if necessary or if being restrictive for future spawning logic
export const ENEMY_SPAWN_EDGE_MARGIN_BLOCKS = 10; // Distance from screen edge in block units.
export const ENEMY_SPAWN_EDGE_MARGIN = ENEMY_SPAWN_EDGE_MARGIN_BLOCKS * BLOCK_WIDTH; // Pixel margin.
export const ENEMY_FLASH_DURATION = 0.15; // Seconds (time-based).
export const DEFAULT_ENEMY_WIDTH_BLOCKS = 2;
export const DEFAULT_ENEMY_HEIGHT_BLOCKS = 2;
export const DEFAULT_ENEMY_WIDTH = DEFAULT_ENEMY_WIDTH_BLOCKS * BLOCK_WIDTH;   // Pixel width (for reference, Enemy.js calculates its own).
export const DEFAULT_ENEMY_HEIGHT = DEFAULT_ENEMY_HEIGHT_BLOCKS * BLOCK_HEIGHT; // Pixel height.
export const DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR = 0.9; // Factor of enemy's own width.
export const DEFAULT_ENEMY_SEPARATION_STRENGTH_BLOCKS_PER_SEC = 15; // Base push strength in block widths/sec
export const DEFAULT_ENEMY_SEPARATION_STRENGTH = DEFAULT_ENEMY_SEPARATION_STRENGTH_BLOCKS_PER_SEC * BLOCK_WIDTH; // Pixel strength/sec (for reference)
export const ENEMY_TYPE_CENTER_SEEKER = 'center_seeker'; // Enemy types (string constants)
export const ENEMY_TYPE_PLAYER_CHASER = 'player_chaser';
export const ENEMY_TYPE_TETRAPOD = 'tetrapod';
export const TETRAPOD_WATER_CONTACT_DAMAGE = 1; // Tetrapod specific constants (damage is unitless, velocity is block units).
export const TETRAPOD_LAND_FLOP_DAMAGE = 1;
export const TETRAPOD_LAND_STILL_DAMAGE = 0;
export const TETRAPOD_FLOP_ATTACK_DURATION = 0.2; // Seconds (time-based).
export const TETRAPOD_LAND_HOP_COOLDOWN_BASE = 1.5; // Seconds (time-based).
export const TETRAPOD_LAND_HOP_COOLDOWN_VARIATION = 1.0; // Seconds (time-based).
export const ENEMY_STATS = { // Enemy Stats: Speeds/velocities/forces are base values in block units per second (or per sec^2).
    [ENEMY_TYPE_TETRAPOD]: {
        displayName: "Tetrapod", aiType: 'flopAI', color: 'rgb(100, 120, 80)',
        width_BLOCKS: DEFAULT_ENEMY_WIDTH_BLOCKS,     // Width in block units.
        height_BLOCKS: DEFAULT_ENEMY_HEIGHT_BLOCKS,   // Height in block units.
        health: 1, contactDamage: 0, applyGravity: true, gravityFactor: 1.0,
        maxSpeedX_BLOCKS_PER_SEC: 3.75, // Formerly 15 relative to 4px block (15/4 = 3.75 blocks/sec)
        maxSpeedY_BLOCKS_PER_SEC: 12.5, // Formerly 50 relative to 4px block (50/4 = 12.5 blocks/sec)
        swimSpeed_BLOCKS_PER_SEC: 17.5, // Formerly 70 relative to 4px block
        canJump: true,
        jumpVelocity_BLOCKS_PER_SEC: 12.5, // Formerly 50 (200*0.25) relative to 4px block
        canSwim: true, canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR * 1.2,
        separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH_BLOCKS_PER_SEC * 0.8, // Base strength in block units.
        landHopHorizontalVelocity_BLOCKS_PER_SEC: 12.5, // Formerly 50 relative to 4px block
        dropTable: [{ type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 }],
    },
    [ENEMY_TYPE_CENTER_SEEKER]: {
        displayName: "Seeker", aiType: 'seekCenter', color: 'rgb(80, 150, 80)',
        width_BLOCKS: DEFAULT_ENEMY_WIDTH_BLOCKS,
        height_BLOCKS: DEFAULT_ENEMY_HEIGHT_BLOCKS,
        maxSpeedX_BLOCKS_PER_SEC: 10,
        maxSpeedY_BLOCKS_PER_SEC: 12.5,
        swimSpeed_BLOCKS_PER_SEC: 12.5,
        health: 1, contactDamage: 10, applyGravity: true, gravityFactor: 1.0,
        canJump: true,
        jumpVelocity_BLOCKS_PER_SEC: 25, // Formerly 100 (200*0.5) relative to 4px
        canSwim: false, canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR,
        separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH_BLOCKS_PER_SEC,
        dropTable: [{ type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 }],
    },
    [ENEMY_TYPE_PLAYER_CHASER]: {
        displayName: "Chaser", aiType: 'chasePlayer', color: 'rgb(150, 80, 80)',
        width_BLOCKS: DEFAULT_ENEMY_WIDTH_BLOCKS,
        height_BLOCKS: DEFAULT_ENEMY_HEIGHT_BLOCKS,
        maxSpeedX_BLOCKS_PER_SEC: 13.75,
        maxSpeedY_BLOCKS_PER_SEC: 12.5,
        swimSpeed_BLOCKS_PER_SEC: 12.5,
        health: 2, contactDamage: 10, applyGravity: true, gravityFactor: 1.0,
        canJump: true,
        jumpVelocity_BLOCKS_PER_SEC: 37.5,
        canSwim: false, canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR,
        separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH_BLOCKS_PER_SEC,
        dropTable: [{ type: 'wood', chance: 1.0, minAmount: 1, maxAmount: 1 }],
    },
};

// --- Wave Scripting ---

export const WAVE_START_DELAY = 5.0; // seconds before first wave
export const EPOCH_DISPLAY_DURATION = 3.0; // seconds epoch text is displayed
export const WAVES = [
    {
        mainWaveNumber: 1,
        epochName: "350 Million Years Ago",
        duration: 117,
        intermissionDuration: 15.0,
        audioTrack: AUDIO_TRACKS.wave1,
        agingPasses: 10,
        subWaves: [
            { enemyGroups: [
                { type: ENEMY_TYPE_TETRAPOD, count: 10, delayBetween: 1.8, startDelay: 0.0 },
                { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.7, startDelay: 8.0 },
                { type: ENEMY_TYPE_CENTER_SEEKER, count: 3, delayBetween: 0.5, startDelay: 15.0 },
            ]},
            { enemyGroups: [
                { type: ENEMY_TYPE_CENTER_SEEKER, count: 4, delayBetween: 0.6, startDelay: 1.0 },
                { type: ENEMY_TYPE_PLAYER_CHASER, count: 2, delayBetween: 1.5, startDelay: 3.0 }
            ]},
            { enemyGroups: [
                { type: ENEMY_TYPE_CENTER_SEEKER, count: 6, delayBetween: 0.4, startDelay: 0.5 },
                { type: ENEMY_TYPE_PLAYER_CHASER, count: 1, delayBetween: 1.5, startDelay: 4.0 }
            ]}
        ]
    },
    {
        mainWaveNumber: 2,
        epochName: "300 Million Years Ago",
        duration: 137,
        intermissionDuration: 15.0,
        audioTrack: AUDIO_TRACKS.wave2,
        agingPasses: 10,
        subWaves: [
            { enemyGroups: [
                { type: ENEMY_TYPE_PLAYER_CHASER, count: 4, delayBetween: 1.2, startDelay: 1.0 },
                { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.6, startDelay: 3.0 },
            ]},
            { enemyGroups: [
                { type: ENEMY_TYPE_CENTER_SEEKER, count: 10, delayBetween: 0.3, startDelay: 0.0 },
                { type: ENEMY_TYPE_PLAYER_CHASER, count: 3, delayBetween: 1.0, startDelay: 5.0 },
            ]},
            { enemyGroups: [
                { type: ENEMY_TYPE_PLAYER_CHASER, count: 5, delayBetween: 0.9, startDelay: 0.5 },
                { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.5, startDelay: 1.5 },
                { type: ENEMY_TYPE_PLAYER_CHASER, count: 2, delayBetween: 1.5, startDelay: 6.0 },
            ]}
        ]
    },
    {
        mainWaveNumber: 3,
        epochName: "250 Million Years Ago",
        duration: 90,
        intermissionDuration: 15.0,
        audioTrack: AUDIO_TRACKS.wave3,
        agingPasses: 10,
        subWaves: [
            { enemyGroups: [{ type: ENEMY_TYPE_TETRAPOD, count: 20, delayBetween: 0.5, startDelay: 0.0 }] },
            { enemyGroups: [{ type: ENEMY_TYPE_PLAYER_CHASER, count: 8, delayBetween: 1.0, startDelay: 5.0 }] },
        ]
    }
];