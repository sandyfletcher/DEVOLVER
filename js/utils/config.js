// =============================================================================
// root/js/config.js - Centralized Game Configuration
// =============================================================================

// --- Debug ---

export const DEBUG_MODE = true; // toggle debug functionality
export const DEBUG_STARTING_MATERIALS_COUNT = 11;
export const DEBUG_STARTING_ARROWS = 25;

// --- Cutscene ---

export const CUTSCENE_IMAGE_DURATION = 3.0; // seconds each is displayed
export const CUTSCENE_SLIDES = [
    { imagePath: 'assets/cut1.png', text: "In the near future, dolphins master nuclear fusion and seize control of the planet." },
    { imagePath: 'assets/cut2.jpg', text: "You're an elite SEAL team 6 operative, infiltrating their laboratory and harnessing the technology to send yourself back in time." },
    { imagePath: 'assets/cut3.png', text: "Use your knowledge of modern technology and military tactics to defeat those who threaten humanity's stranglehold on Earth." },
    { imagePath: 'assets/cut4.png', text: "Only one thing has followed you back in time: a simple shovel.  Will that be enough?" }
];

// --- Camera ---

export const MIN_CAMERA_SCALE = 0.2; // min zoom (1/5x)
export const MAX_CAMERA_SCALE = 3.0; // max zoom (3x)
export const ZOOM_SPEED_FACTOR = 0.001; // mouse wheel sensitivity

// --- Game Grid ---

export const BACKGROUND_COLOR = 'rgb(135, 206, 235)'; // TODO: develop background images with moving parts
export const BASE_BLOCK_PIXEL_SIZE = 16; // pixel size - one side of square block
export const BLOCK_WIDTH = BASE_BLOCK_PIXEL_SIZE;
export const BLOCK_HEIGHT = BASE_BLOCK_PIXEL_SIZE;
export const GRID_COLS = 400; // # of columns in world grid
export const GRID_ROWS = 200; // # of rows
export const CANVAS_WIDTH = GRID_COLS * BLOCK_WIDTH; // internal canvas dimensions in pixels
export const CANVAS_HEIGHT = GRID_ROWS * BLOCK_HEIGHT;

// --- Block Parameters ---

export const BLOCK_DAMAGE_INDICATOR_COLOR = 'rgba(0, 0, 0, 0.9)';
export const BLOCK_DAMAGE_INDICATOR_LINE_WIDTH = 2;
export const BLOCK_DAMAGE_THRESHOLD_SLASH = 0.7;     // / <= 70% 
export const BLOCK_DAMAGE_THRESHOLD_X = 0.3;         // X <= 30%
export const GHOST_BLOCK_ALPHA = 0.5;                // placement preview transparency
export const PLAYER_BLOCK_OUTLINE_COLOR = 'rgba(255, 255, 255, 0.8)';
export const PLAYER_BLOCK_OUTLINE_THICKNESS = 3;     // in pixels
export const VEGETATION_PIXEL_DENSITY = 0.6;

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
export const BLOCK_ROCK = 10;
export const BLOCK_DIAMOND = 11;
export const BLOCK_GRAVEL = 12; // NEW

export const BLOCK_PROPERTIES = {
    [BLOCK_AIR]: {
        name: 'AIR',
        hp: Infinity,
        color: null,
        translucency: 1.0,
        isSolidForPhysics: false,
        isSolidForPlacementSupport: false,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: null,
        droppedItemConfig: null,
        isPlayerPlaceableAsMaterial: false,
    },
    [BLOCK_WATER]: {
        name: 'WATER',
        hp: Infinity,
        color: 'rgb(38, 77, 154)',
        translucency: 0.9,
        isSolidForPhysics: false,
        isSolidForPlacementSupport: false,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: null,
        droppedItemConfig: null,
        isPlayerPlaceableAsMaterial: false,
    },
    [BLOCK_SAND]: {
        name: 'SAND',
        hp: 30,
        color: 'rgb(210, 180, 140)',
        translucency: 0.1,
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'sand',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(210, 180, 140)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_DIRT]: {
        name: 'DIRT',
        hp: 50,
        color: 'rgb(130, 82, 45)',
        translucency: 0.1,
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'dirt',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(130, 82, 45)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_VEGETATION]: {
        name: 'VEGETATION',
        hp: 25,
        color: 'rgb(80, 180, 80)',
        translucency: 0.5,
        isSolidForPhysics: false,
        isSolidForPlacementSupport: false,
        isRope: false,
        isVegetation: true,
        isWood: false,
        droppedItemType: 'vegetation',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(80, 180, 80)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_STONE]: {
        name: 'STONE',
        hp: 300,
        color: 'rgb(140, 140, 140)',
        translucency: 0.0,
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'stone',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(140, 140, 140)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_ROCK]: {
        name: 'ROCK',
        hp: 150,
        color: 'rgb(155, 145, 135)',
        translucency: 0.0,
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'rock',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(155, 145, 135)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_WOOD]: {
        name: 'WOOD',
        hp: 100,
        color: 'rgb(160, 110, 70)',
        translucency: 0.0,
        isSolidForPhysicsConfig: { base: true, naturalOverride: false }, // player-placed wood is solid, natural is not
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: true,
        droppedItemType: 'wood',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(160, 110, 70)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_METAL]: {
        name: 'METAL',
        hp: 500,
        color: 'rgb(190, 190, 200)',
        translucency: 0.0,
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'metal',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(190, 190, 200)' },
        isPlayerPlaceableAsMaterial: true,
    },
        [BLOCK_DIAMOND]: {
        name: 'DIAMOND',
        hp: 1000, // extremely durable
        color: 'rgb(185, 242, 255)', //bright crystalline blue
        translucency: 0.8, // mostly transparent, glows when lit
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'diamond',
        droppedItemConfig: { width: BLOCK_WIDTH * 0.8, height: BLOCK_HEIGHT * 0.8, color: 'rgb(185, 242, 255)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_BONE]: {
        name: 'BONE',
        hp: 120,
        color: 'rgb(200, 190, 170)',
        translucency: 0.0,
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'bone',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(200, 190, 170)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_ROPE]: {
        name: 'ROPE',
        hp: 25,
        color: 'rgb(197, 228, 20)',
        translucency: 0.9,
        isSolidForPhysics: false,
        isSolidForPlacementSupport: false,
        isRope: true,
        isVegetation: false, // not vegetation, but placed using its material
        isWood: false,
        droppedItemType: 'vegetation', // drops vegetation when destroyed
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(80, 180, 80)' }, // dropped item looks like vegetation
        isPlayerPlaceableAsMaterial: false, // uses vegetation to place
    },
    [BLOCK_GRAVEL]: {
        name: 'GRAVEL',
        hp: 80,
        color: 'rgb(165, 155, 145)', // A mix of rock and sand colors
        translucency: 0.1,
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'gravel', // This item contributes to 'rock' inventory
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(165, 155, 145)' },
        isPlayerPlaceableAsMaterial: false, // Not directly placeable
    },
};
export const AGING_MATERIAL_CONVERSION_FACTORS = {
    [BLOCK_DIRT]: 1.0,
    [BLOCK_VEGETATION]: 1.0,
    [BLOCK_STONE]: 1.0,
    [BLOCK_BONE]: 1.0,
    [BLOCK_WOOD]: 1.0,
    [BLOCK_METAL]: 1.0,
};
export const INVENTORY_MATERIALS = [ 'dirt', 'vegetation', 'sand', 'stone', 'rock', 'wood', 'bone', 'metal', 'diamond', 'arrows'];
export const MATERIAL_TO_BLOCK_TYPE = {
    'dirt': BLOCK_DIRT,
    'stone': BLOCK_STONE,
    'wood': BLOCK_WOOD,
    'sand': BLOCK_SAND,
    'metal': BLOCK_METAL,
    'bone': BLOCK_BONE,
    'vegetation': BLOCK_VEGETATION, // vegetation could be block or rope
    'rock': BLOCK_ROCK,
    'diamond': BLOCK_DIAMOND,
};

// --- Landmass Generation ---

export const ISLAND_WIDTH_MIN = 0.75; // minimum width of island as a percentage of GRID_COLS
export const ISLAND_WIDTH_MAX = 0.85;
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
export const GROUND_NOISE_OCTAVES = 4; // Number of octaves for ground surface noise
export const GROUND_NOISE_PERSISTENCE = 0.5; // Amplitude multiplier for each subsequent octave
export const GROUND_NOISE_LACUNARITY = 2.0; // Frequency multiplier for each subsequent octave
export const STONE_NOISE_OCTAVES = 3; // Number of octaves for stone layer noise
export const STONE_NOISE_PERSISTENCE = 0.45;
export const STONE_NOISE_LACUNARITY = 2.2;

// --- Cave Formation ---

export const ENABLE_CAVES = true;
export const CAVE_NOISE_SCALE_X = 0.08; //  2D noise scale for caves
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
export const ISLAND_CENTER_TAPER_WIDTH_FACTOR = 0.25; // Percentage of the island's width for tapering from island edge inward

// --- Tree Parameters ---

export const MIN_TREE_SPACING_RADIUS = 8; // minimum block distance between tree trunk formation
export const TREE_MIN_HEIGHT_TO_FORM_ORGANIC = 4; // trunk height for canopy formation
export const MAX_NATURAL_TRUNK_HEIGHT_BEFORE_COLLAPSE = 10;
export const TREE_INITIAL_CANOPY_RADIUS = 2; // block radius of initial canopy vegetation
export const TREE_MAX_CANOPY_RADIUS = 4; // max radius canopy can reach

// --- Aging Rules ---

export const AGING_INITIAL_PASSES = 10; // aging passes on initial world generation
export const AGING_DEFAULT_RING_WEIGHTS = {
    3: 1.0,  // 3x3 ring (immediate neighbours)
    5: 0.3,  // 5x5
    7: 0.1   // 7x7
};
export const AGING_RULES = {
    // STONE -> ROCK
    [BLOCK_STONE]: {
        [BLOCK_ROCK]: {
            baseProbability: 0.0001,
            influences: {
                [BLOCK_WATER]: 0.05, // Water is a key catalyst
                [BLOCK_AIR]:   0.03, // Exposure to air
                [BLOCK_DIRT]:  0.01,
            }
        }
    },
    // ROCK -> GRAVEL
    [BLOCK_ROCK]: {
        [BLOCK_GRAVEL]: {
            baseProbability: 0.0003,
            influences: {
                [BLOCK_WATER]: 0.10, // Water is very effective at breaking rock to gravel
                [BLOCK_AIR]:   0.05,
                [BLOCK_SAND]:  0.02,
            }
        }
    },
    // GRAVEL -> SAND
    [BLOCK_GRAVEL]: {
        [BLOCK_SAND]: {
            baseProbability: 0.001,
            influences: {
                [BLOCK_WATER]: 0.25, // Water is extremely effective at turning gravel to sand
                [BLOCK_AIR]:   0.05,
            }
        }
    },
    // DIRT -> SAND / VEG
    [BLOCK_DIRT]: {
        [BLOCK_SAND]: {
            baseProbability: 0.001,
            influences: {
                [BLOCK_WATER]: 0.20,
            }
        },
        [BLOCK_VEGETATION]: {
            baseProbability: 0.0, // Only grows if lit — 'isLit' will be a special condition checked in the aging manager
            influences: {
                [BLOCK_AIR]: 0.10, // Must be exposed to air to grow
            }
        }
    },
    // VEG -> decay / grow
    [BLOCK_VEGETATION]: {
        [BLOCK_AIR]: { // Decay
            baseProbability: 0.005,
            // 'isUnlit' will be a special condition
            influences: {
                [BLOCK_WATER]: 0.05, // Water-logged vegetation dies
            }
        },
        [BLOCK_VEGETATION]: { // grow into adjacent Air
            target: BLOCK_AIR, // Special key: what block type this rule applies TO
            baseProbability: 0.02, // 2% base chance to try and spread
            // 'isLit' will be a special condition
            influences: {
                [BLOCK_DIRT]: 0.10, // Higher chance to grow if near dirt
                [BLOCK_WOOD]: 0.05, // Lower chance if near wood (part of a tree)
            }
        }
    }
};
export const AGING_PROB_DIAMOND_FORMATION = 0.0001;
export const AGING_PROB_VEGETATION_TO_WOOD_SURROUNDED = 0.7; // chance for vegetation chunk to become tree
export const AGING_PROB_WOOD_GROWS_WOOD_UP = 0.3;
export const AGING_PROB_TREE_CANOPY_GROW = 0.1;
export const AGING_PROB_TREE_CANOPY_DECAY = 0.01;
export const AGING_PROB_TREE_TRUNK_DECAY = 0.001;

// --- Animation Constants ---

export const MAX_FALLING_BLOCKS_AT_ONCE = 50;
export const NEW_GRAVITY_ANIM_DELAY = 0.1;
export const GRAVITY_ANIMATION_FALL_SPEED = 400;
export const AGING_ANIMATION_BLOCKS_AT_ONCE = 200; // number of simultaneous animations
export const AGING_ANIMATION_NEW_BLOCK_DELAY = 0.01; // seconds before starting next animation in queue
export const AGING_ANIMATION_SWELL_DURATION = 0.3;
export const AGING_ANIMATION_POP_DURATION = 0.4;
export const AGING_ANIMATION_SWELL_SCALE = 1.5;
export const AGING_ANIMATION_OLD_BLOCK_COLOR = 'rgba(200, 200, 200, 0.7)'; // swell old block
export const AGING_ANIMATION_NEW_BLOCK_COLOR = 'rgba(255, 255, 150, 0.8)'; // briefly flash new block
export const WARPPHASE_DURATION = 8.0; // duration of warp phase
export const ENEMY_DEATH_ANIMATION_DURATION = 0.5; // enemy death animation time in seconds
export const ENEMY_SWELL_DURATION = 0.3;
export const ENEMY_SWELL_SCALE = 1.5;
export const PLAYER_DEATH_ANIMATION_DURATION = 1.5;
export const PLAYER_SPIN_DURATION = 1.0;
export const PLAYER_SPIN_FRAMES = 6;

// --- Lighting Parameters ---

export const MIN_LIGHT_LEVEL_COLOR_FACTOR = 0.7; // 70% of base colour
export const MAX_LIGHT_LEVEL_BRIGHTNESS_FACTOR = 1.3; // 130% of base colour
export const INITIAL_LIGHT_RAY_POWER = 1.0; // starting power of a light ray
export const MIN_LIGHT_THRESHOLD = 0.01; // ray stops if power drops below this
export const SUN_ANIMATION_ENABLED = true; // toggle animation
export const SUN_ANIMATION_COLOR = "rgba(255, 200, 100, 0.9)";
export const SUN_ANIMATION_OUTLINE_COLOR = "rgba(255, 255, 0, 0.7)";
export const SUN_ANIMATION_OUTLINE_WIDTH = 5;
export const SUN_ANIMATION_OUTLINE_BLUR = 15; // blur radius for outline glow
export const SUN_ANIMATION_RADIUS_BLOCKS = 6; // radius of sun
export const SUN_ANIMATION_RAY_COLOR_INNER = "rgba(255, 255, 180, 0.35)";
export const SUN_ANIMATION_RAY_COLOR_OUTER = "rgba(255, 220, 150, 0.15)";
export const SUN_ANIMATION_RAY_LINE_WIDTH = 2;
export const SUN_ANIMATION_RAY_OUTER_WIDTH_FACTOR = 2.0;
export const SUN_ANIMATION_START_X_OFFSET_BLOCKS = 10;
export const SUN_ANIMATION_END_X_OFFSET_BLOCKS = 10;
export const FIXED_SUN_ANIMATION_DURATION = 8.0;
export const SUN_MOVEMENT_Y_ROW_OFFSET = 20;
export const SUN_MOVEMENT_STEP_COLUMNS = 2;
export const MAX_LIGHT_RAY_LENGTH_BLOCKS = Math.floor(GRID_ROWS * 1.2);
export const SUN_RAYS_PER_POSITION = 72;

// --- Delta-Time Physics ---

export const GRAVITY_ACCELERATION = 100 * BLOCK_HEIGHT; // Pixels per second squared.
export const MAX_FALL_SPEED = 120 * BLOCK_HEIGHT; // Pixels per second.
export const MAX_DELTA_TIME = 0.05; // Max time step in seconds to prevent physics glitches (~20fps min simulation).
export const ENTITY_STEP_TIER1_MAX_HEIGHT_FACTOR = 1/3; // Entity step-up allowance, defined as factors of entity height (already relative to scaled entity).
export const ENTITY_STEP_TIER2_MAX_HEIGHT_FACTOR = 1/2;
export const ENTITY_STEP_TIER2_HORIZONTAL_FRICTION = 0.7; // Factor to multiply horizontal velocity by after a tier 2 step.
export const WATER_GRAVITY_FACTOR = 0.4; // Water physics factors (unitless multipliers).
export const WATER_HORIZONTAL_DAMPING = 0.1; // Lower values mean stronger damping.
export const WATER_VERTICAL_DAMPING = 0.05;
export const WATER_MAX_SPEED_FACTOR = 0.6;
export const WATER_ACCELERATION_FACTOR = 0.5;
export const WATER_SWIM_VELOCITY = 50 * BLOCK_HEIGHT; // Pixels per second.
export const WATER_MAX_SWIM_UP_SPEED = 20 * BLOCK_HEIGHT; // Pixels per second.
export const WATER_MAX_SINK_SPEED = 25 * BLOCK_HEIGHT; // Pixels per second.
export const ENEMY_WATER_BUOYANCY_ACCEL = 45 * BLOCK_HEIGHT; // Pixels/sec^2.
export const WATER_JUMP_COOLDOWN_DURATION = 0.2;
export const WATER_PROPAGATION_DELAY = 0.05;
export const WATER_UPDATES_PER_FRAME = 10;

// --- Portal Parameters ---

export const PORTAL_COLOR = 'rgb(80, 80, 200)'; // Slightly darker base
export const PORTAL_BORDER_COLOR = 'rgb(200, 200, 255)'; // Lighter border/glow
export const PORTAL_BORDER_WIDTH = 5; // Pixel width of the outer border
export const PORTAL_WIDTH = 6 * BLOCK_WIDTH; // Pixel width.
export const PORTAL_HEIGHT = 8 * BLOCK_HEIGHT; // Pixel height.
export const PORTAL_INITIAL_HEALTH = 500;
export const PORTAL_ABSORB_ANIMATION_DURATION = 0.75; // seconds
export const PORTAL_SAFETY_RADIUS = 30 * BASE_BLOCK_PIXEL_SIZE; // Pixel radius.
export const PORTAL_RADIUS_GROWTH_PER_WAVE = 5 * BASE_BLOCK_PIXEL_SIZE; // Pixel growth.
export const PORTAL_SPAWN_Y_OFFSET_BLOCKS = 8; // Offset in block units above mean ground for portal top.
export const PORTAL_PULSE_SPEED = 1.5; // Radians per second for pulse cycle
export const PORTAL_PULSE_MIN_ALPHA = 0.4; // Min alpha for the pulsating glow
export const PORTAL_PULSE_MAX_ALPHA = 0.8; // Max alpha for the pulsating glow
export const PORTAL_PULSE_COLOR = 'rgba(150, 150, 255, 0.7)'; // Color of the inner pulsating glow
export const PORTAL_PARTICLE_COUNT = 50;
export const PORTAL_PARTICLE_MIN_SIZE = 1;
export const PORTAL_PARTICLE_MAX_SIZE = 4;
export const PORTAL_PARTICLE_MIN_SPEED = 10 * BLOCK_HEIGHT; // Pixels per second
export const PORTAL_PARTICLE_MAX_SPEED = 30 * BLOCK_HEIGHT;
export const PORTAL_PARTICLE_COLOR_PRIMARY = 'rgba(220, 220, 255, 0.8)';
export const PORTAL_PARTICLE_COLOR_SECONDARY = 'rgba(180, 180, 255, 0.6)';
export const PORTAL_PARTICLE_FADE_SPEED = 0.5; // Opacity reduction per second

// --- Player Parameters ---

export const PLAYER_BODY_COLOR = 'rgb(200, 50, 50)'; // Solid color for player's body
export const PLAYER_HEAD_COLOR = 'rgb(255, 224, 189)'; // Skin tone for head
export const PLAYER_WIDTH = 3 * BLOCK_WIDTH;
export const PLAYER_HEIGHT = 6 * BLOCK_HEIGHT;
export const PLAYER_SHOULDER_OFFSET_X_FACTOR = 0.25; // How far from the player's edge
export const PLAYER_SHOULDER_OFFSET_Y_FACTOR = 0.25; // How far down from the player's top
export const ARM_COLOR = 'rgb(180, 100, 50)'; // Color for the player's arms
export const ARM_THICKNESS = 6; // Thickness of the arm rectangles in pixels
export const PLAYER_START_X = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2; // Player start position (pixels, derived from block-based world constants).
export const PLAYER_START_Y = (MEAN_GROUND_LEVEL * BLOCK_HEIGHT) - PLAYER_HEIGHT - (5 * BLOCK_HEIGHT);
export const PLAYER_INITIAL_HEALTH = 100;
export const PLAYER_MAX_HEALTH_DISPLAY = 100;
export const PLAYER_INVULNERABILITY_DURATION = 1.5; // seconds
export const PLAYER_MOVE_ACCELERATION = 200 * BLOCK_WIDTH; // Pixels/sec^2.
export const PLAYER_MAX_SPEED_X = 30 * BLOCK_WIDTH; // Base max horizontal speed
export const PLAYER_FRICTION_BASE = 0.01; // Factor for ground friction (lower means stronger friction).
export const PLAYER_JUMP_VELOCITY = 50 * BLOCK_HEIGHT; // base initial upward velocity
export const PLAYER_INTERACTION_RANGE = 12 * BLOCK_WIDTH; // Pixel range.
export const PLAYER_INTERACTION_RANGE_SQ = PLAYER_INTERACTION_RANGE * PLAYER_INTERACTION_RANGE; // Squared pixel range.
export const PLAYER_ITEM_ATTRACT_RADIUS = 25 * BLOCK_WIDTH; // Item attraction distance in block units.
export const PLAYER_ITEM_ATTRACT_RADIUS_SQ = PLAYER_ITEM_ATTRACT_RADIUS * PLAYER_ITEM_ATTRACT_RADIUS; // Squared pixel radius.
export const PLAYER_ITEM_ATTRACT_SPEED = 60 * BLOCK_WIDTH; // Base speed for attracted items
export const PLAYER_PLACEMENT_COOLDOWN = 0.01; // seconds between block placement
export const PLAYER_ROPE_CLIMB_SPEED = 30 * BLOCK_HEIGHT;
export const PLAYER_ROPE_SLIDE_SPEED = 45 * BLOCK_HEIGHT;
export const PLAYER_ROPE_HORIZONTAL_DAMPING = 0.001; // very strong damping while on rope
export const PLAYER_ROPE_DETACH_IMPULSE_X = 20 * BLOCK_WIDTH;
export const PLAYER_ROPE_DETACH_JUMP_MULTIPLIER = 0.9; // 90% of normal jump velocity
export const PLAYER_PLACEMENT_RANGE_COLOR = 'rgba(255, 255, 0, 0.3)'; // semi-transparent yellow
export const PLAYER_PLACEMENT_RANGE_LINE_WIDTH = 2; // line thickness in pixels

// --- Audio Constants ---

export const AUDIO_SFX_POOL_SIZE = 8;
export const AUDIO_DEFAULT_GAME_VOLUME = 0.4;
export const AUDIO_DEFAULT_UI_VOLUME = 0.6;
export const AUDIO_DEFAULT_SFX_VOLUME = 0.8;
export const AUDIO_TRACKS = {
    MENU: 'assets/audio/music/Menu.mp3',
    pause: 'assets/audio/music/Pause.mp3',
    gameOver: 'assets/audio/music/GameOver.mp3',
    victory: 'assets/audio/music/Victory.mp3',
    CUTSCENE: 'assets/audio/music/Cutscene.mp3',
    wave1: 'assets/audio/music/Wave1-350.mp3',
    wave2: 'assets/audio/music/Wave2-300.mp3',
    wave3: 'assets/audio/music/wave3.mp3',
    // SFX placeholders
    // player_hit: 'assets/audio/sfx/player_hit.wav',
};

// --- Items & Weapons ---

export const PLAYER_WEAPON_HIGHLIGHT_DEFAULT_COLOR = 'rgb(160, 32, 240)';
export const WEAPON_HIGHLIGHT_PALETTE = [
    'rgb(255, 87, 87)',   // Red
    'rgb(255, 172, 87)',  // Orange
    'rgb(255, 255, 87)',  // Yellow
    'rgb(87, 255, 87)',   // Green
    'rgb(87, 255, 255)',  // Cyan
    'rgb(87, 87, 255)',   // Blue
    'rgb(160, 32, 240)',  // Purple (Default)
    'rgb(255, 87, 255)',  // Magenta
    'rgb(255, 255, 255)', // White
    'rgb(192, 192, 192)', // Silver
    'rgb(255, 215, 0)',   // Gold
    'rgb(0, 255, 127)',   // Spring Green
];
export const ITEM_BOBBLE_AMOUNT = 0.15; // factor relative to item height
export const ITEM_BOBBLE_SPEED = 2.0; // radians per second for bobbing cycle
export const WEAPON_TYPE_UNARMED = 'unarmed';
export const WEAPON_TYPE_SHOVEL = 'shovel';
export const WEAPON_TYPE_SWORD = 'sword';
export const WEAPON_TYPE_SPEAR = 'spear';
export const WEAPON_TYPE_BOW = 'bow';
export const WEAPON_STATS = {
    [WEAPON_TYPE_UNARMED]: {
        displayName: "Unarmed",
        symbol: "👊",
        width: 1 * BLOCK_WIDTH,
        height: 1 * BLOCK_HEIGHT,
        attackDamage: 1,
        blockDamage: 0,
        attackReachX: PLAYER_WIDTH * 0.2,
        attackReachY: 0,
        attackWidth: PLAYER_WIDTH * 0.5,
        attackHeight: PLAYER_HEIGHT * 0.5,
        attackDuration: 0.1,
        attackCooldown: 0.2,
        attackColor: 'rgba(255, 255, 255, 0.2)',
        visualAnchorOffset: { x: 0, y: 0 },
        shape: [{ type: 'rect', x: -0.5 * BLOCK_WIDTH, y: -0.5 * BLOCK_HEIGHT, w: 1 * BLOCK_WIDTH, h: 1 * BLOCK_HEIGHT, color: 'transparent' }],
        knockbackStrength: 50,
        knockbackStunDuration: 0.1,
        jabDistanceBlocks: 0, // Unarmed doesn't jab
    },
    [WEAPON_TYPE_SHOVEL]: {
        displayName: "Shovel",
        symbol: "⛏️",
        width: 5 * BLOCK_WIDTH,
        height: 2 * BLOCK_HEIGHT,
        outlineColor: 'rgb(75, 75, 75)',
        outlineWidth: 2,
        attackDamage: 5,
        blockDamage: 25,
        attackReachX: 3 * BLOCK_WIDTH,
        attackReachY: PLAYER_HEIGHT * 0.4,
        attackWidth: (1 * BLOCK_WIDTH) * 2,
        attackHeight: (2 * BLOCK_HEIGHT) * 2,
        attackDuration: 0.3,
        attackCooldown: 0.4,
        attackColor: 'rgba(180, 180, 180, 0.5)',
        recipe: [],
        visualAnchorOffset: { x: 1.5 * BLOCK_WIDTH, y: 0 }, // anchor at the tip of the shovel head
        handPositions: {
            back: { x: -2.0 * BLOCK_WIDTH, y: 0 },
            front: { x: -0.5 * BLOCK_WIDTH, y: 0 }
        },
        shape: [
            { type: 'rect', x: -2.5 * BLOCK_WIDTH, y: -0.25 * BLOCK_HEIGHT, w: 2.5 * BLOCK_WIDTH, h: 0.5 * BLOCK_HEIGHT, color: 'rgb(139, 69, 19)'}, // Handle
            { type: 'triangle', p1: { x: 0, y: -0.75 * BLOCK_WIDTH }, p2: { x: 0, y: 0.75 * BLOCK_WIDTH }, p3: { x: 1.5 * BLOCK_WIDTH, y: 0 }, color: 'rgb(128, 128, 128)', isBlade: true} // Shovel head
        ],
        knockbackStrength: 150,
        knockbackStunDuration: 0.2,
        jabDistanceBlocks: 0.75,
    },
    [WEAPON_TYPE_SWORD]: {
        displayName: "Sword",
        symbol: "⚔️",
        width: 3.5 * BLOCK_WIDTH, // Adjusted for new shape
        height: 1 * BLOCK_HEIGHT,
        outlineColor: 'rgb(100, 100, 110)',
        outlineWidth: 1, // Thinner outline for a sharper look
        attackDamage: 15, blockDamage: 0,
        attackReachX: PLAYER_WIDTH * 0.8, attackReachY: 0, // Base reach for aiming
        attackWidth: PLAYER_WIDTH * 1.5, attackHeight: PLAYER_HEIGHT * 0.9, // AABB for rough checks, true hitbox is swipe
        attackDuration: 0.25, // Slightly longer for a swipe
        attackCooldown: 0.35,
        attackColor: 'rgba(200, 200, 220, 0.4)', // Lighter color for swipe
        recipe: [ { type: 'stone', amount: 5 } ],
        visualAnchorOffset: {x: -0.5 * BLOCK_WIDTH, y: 0 }, // Pivot near the hilt
        shape: [
            // Blade
            { type: 'rect', x: 0, y: -0.15 * BLOCK_HEIGHT, w: 2.5 * BLOCK_WIDTH, h: 0.3 * BLOCK_HEIGHT, color: 'rgb(180, 180, 190)', isBlade: true},
            // Hilt / Crossguard
            { type: 'rect', x: -0.25 * BLOCK_WIDTH, y: -0.4 * BLOCK_HEIGHT, w: 0.25 * BLOCK_WIDTH, h: 0.8 * BLOCK_HEIGHT, color: 'rgb(100,70,50)'},
            { type: 'rect', x: -0.75 * BLOCK_WIDTH, y: -0.1 * BLOCK_HEIGHT, w: 0.5 * BLOCK_WIDTH, h: 0.2 * BLOCK_HEIGHT, color: 'rgb(139,69,19)'}
        ],
        swipeArcDegrees: 120, // Total arc of the swipe
        swipeStartOffsetDegrees: -60, // Starts -60deg from aim, ends +60deg from aim
        knockbackStrength: 200,
        knockbackStunDuration: 0.25,
        jabDistanceBlocks: 0, // Sword uses swipe, not jab
    },
    [WEAPON_TYPE_SPEAR]: {
        displayName: "Spear",
        symbol: "↑",
        width: 6 * BLOCK_WIDTH,
        height: 1 * BLOCK_HEIGHT,
        outlineColor: 'rgb(100, 80, 50)',
        outlineWidth: 1,
        attackDamage: 8,
        blockDamage: 0, // Spear doesn't damage blocks
        attackReachX: 5 * BLOCK_WIDTH, // For aiming
        attackReachY: undefined,
        attackWidth: BLOCK_WIDTH * 0.5, // Approx AABB
        attackHeight: BLOCK_HEIGHT * 1.5, // Approx AABB
        attackDuration: 0.3,
        attackCooldown: 0.5,
        attackColor: 'rgba(220, 220, 180, 0.5)',
        recipe: [ { type: 'wood', amount: 2 }, { type: 'stone', amount: 1 } ],
        visualAnchorOffset: { x: 0.75 * BLOCK_WIDTH, y: 0 }, // Anchor at the spear tip
        handPositions: {
            back: { x: -4.0 * BLOCK_WIDTH, y: 0 },
            front: { x: -1.5 * BLOCK_WIDTH, y: 0 }
        },
        shape: [
            { type: 'rect', x: -4.75 * BLOCK_WIDTH, y: -0.20 * BLOCK_HEIGHT, w: 4.75 * BLOCK_WIDTH, h: 0.40 * BLOCK_HEIGHT, color: 'rgb(180, 130, 90)'}, // Shaft
            { type: 'triangle', p1: { x: 0, y: -0.25 * BLOCK_HEIGHT }, p2: { x: 0, y: 0.25 * BLOCK_HEIGHT }, p3: { x: 0.75 * BLOCK_WIDTH, y: 0 }, color: 'rgb(160, 160, 170)', isBlade: true} // Spearhead
        ],
        knockbackStrength: 250,
        knockbackStunDuration: 0.3,
        jabDistanceBlocks: 1.0,
    },
    [WEAPON_TYPE_BOW]: {
        displayName: "Bow",
        symbol: "🏹",
        width: 1 * BLOCK_WIDTH,
        height: 5 * BLOCK_HEIGHT,
        attackDamage: 0, // Bow itself does no damage
        blockDamage: 0,
        attackReachX: 2.5 * BLOCK_WIDTH,
        attackReachY: 0,
        attackDuration: 0.1, // Time to fire
        attackCooldown: 0.5, // Time between shots
        recipe: [ { type: 'wood', amount: 2 }, { type: 'vegetation', amount: 2 } ],
        ammoType: 'arrows',
        ammoRecipe: [ { type: 'wood', amount: 1 }, { type: 'stone', amount: 1 } ],
        visualAnchorOffset: { x: 0, y: 0 }, // Pivot at center
        handPositions: { back: { x: 0, y: 0.5 * BLOCK_HEIGHT }, front: { x: 0, y: -0.5 * BLOCK_HEIGHT } }, // Simple grip
        shape: [ // A simple arc shape
            { type: 'polygon', points: [ {x:0, y:-2.5*BLOCK_HEIGHT}, {x:0.5*BLOCK_WIDTH, y:0}, {x:0, y:2.5*BLOCK_HEIGHT} ], color: 'rgb(139, 69, 19)'},
        ]
    }
};

// --- Projectiles ---

export const PROJECTILE_TYPE_ARROW = 'arrow';
export const PROJECTILE_STATS = {
    [PROJECTILE_TYPE_ARROW]: {
        width: 2.5 * BLOCK_WIDTH,
        height: 0.25 * BLOCK_HEIGHT,
        speed: 80 * BLOCK_WIDTH, // pixels per second
        damage: 10,
        gravityFactor: 0.2, // Arrows are light and fly relatively straight
        shape: [
            { type: 'rect', x: -1.25 * BLOCK_WIDTH, y: -0.05 * BLOCK_HEIGHT, w: 2.5 * BLOCK_WIDTH, h: 0.1 * BLOCK_HEIGHT, color: 'rgb(139, 69, 19)' },
            { type: 'polygon', points: [ {x:1.25*BLOCK_WIDTH, y:0}, {x:1*BLOCK_WIDTH, y:-0.125*BLOCK_HEIGHT}, {x:1*BLOCK_WIDTH, y:0.125*BLOCK_HEIGHT} ], color: 'rgb(160,160,170)', isBlade: true },
            { type: 'polygon', points: [ {x:-1.25*BLOCK_WIDTH, y:0}, {x:-1*BLOCK_WIDTH, y:-0.2*BLOCK_HEIGHT}, {x:-1*BLOCK_WIDTH, y:0.2*BLOCK_HEIGHT} ], color: 'rgb(200,200,200)' }
        ]
    }
};

// --- Enemy Parameters ---

export const MAX_ENEMIES = 150; // TODO: determine if necessary or if being restrictive for future spawning logic
export const ENEMY_SPAWN_EDGE_MARGIN = 10 * BLOCK_WIDTH; // Distance from screen edge in block units
export const ENEMY_FLASH_DURATION = 0.15;
export const DEFAULT_ENEMY_WIDTH = 2;
export const DEFAULT_ENEMY_HEIGHT = 2;
export const DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR = 0.9; // Factor of enemy's own width.
export const DEFAULT_ENEMY_SEPARATION_STRENGTH = 15 * BLOCK_WIDTH; // Base push strength
export const ENEMY_TYPE_DUNKLEOSTEUS = 'dunkleosteus';
export const ENEMY_TYPE_CENTER_SEEKER = 'center_seeker';
export const ENEMY_TYPE_PLAYER_CHASER = 'player_chaser';
export const ENEMY_TYPE_TETRAPOD = 'tetrapod';
export const ENEMY_TYPE_SMALL_FISH = 'small_fish';
export const TETRAPOD_WATER_CONTACT_DAMAGE = 1;
export const TETRAPOD_LAND_FLOP_DAMAGE = 1;
export const TETRAPOD_LAND_STILL_DAMAGE = 0;
export const TETRAPOD_FLOP_ATTACK_DURATION = 0.2;
export const TETRAPOD_LAND_HOP_COOLDOWN_BASE = 1.5;
export const TETRAPOD_LAND_HOP_COOLDOWN_VARIATION = 1.0;
export const ENEMY_STATS = {
    [ENEMY_TYPE_TETRAPOD]: {
        displayName: "Tetrapod", aiType: 'flopAI', color: 'rgb(100, 120, 80)', // Base color, overridden by visualShape
        width_BLOCKS: DEFAULT_ENEMY_WIDTH, // 2
        height_BLOCKS: DEFAULT_ENEMY_HEIGHT, // 2
        health: 1, contactDamage: 0, applyGravity: true, gravityFactor: 1.0,
        maxSpeedX_BLOCKS_PER_SEC: 3.75,
        maxSpeedY_BLOCKS_PER_SEC: 12.5,
        swimSpeed_BLOCKS_PER_SEC: 17.5,
        canJump: true,
        jumpVelocity_BLOCKS_PER_SEC: 12.5,
        canSwim: true, canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR * 1.2,
        separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH * 0.8,
        landHopHorizontalVelocity_BLOCKS_PER_SEC: 12.5,
        dropTable: [{ type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 }],
        visualShape: [ // Assuming center (0,0) in local coords
            // Body
            { type: 'rect', xFactor: -0.4, yFactor: -0.3, wFactor: 0.8, hFactor: 0.6, color: 'rgb(80, 100, 60)', outlineColor: 'rgb(50,70,30)', outlineWidth: 2 },
            // Head (slightly in front and raised)
            { type: 'circle', cxFactor: 0.4, cyFactor: -0.25, rFactor: 0.3, color: 'rgb(100, 120, 80)', outlineColor: 'rgb(60,80,40)', outlineWidth: 2 },
            // Eyes (on head)
            { type: 'circle', cxFactor: 0.45, cyFactor: -0.3, rFactor: 0.08, color: 'white' },
            { type: 'circle', cxFactor: 0.45, cyFactor: -0.3, rFactor: 0.04, color: 'black' },
            // Legs (simple stubs for flopping)
            { type: 'rect', xFactor: -0.3, yFactor: 0.15, wFactor: 0.2, hFactor: 0.3, color: 'rgb(70, 90, 50)' }, // back leg
            { type: 'rect', xFactor: 0.1, yFactor: 0.15, wFactor: 0.2, hFactor: 0.3, color: 'rgb(70, 90, 50)' },  // front leg
        ],
    },
    [ENEMY_TYPE_CENTER_SEEKER]: {
        displayName: "Seeker", aiType: 'seekCenter', color: 'rgb(80, 150, 80)',
        width_BLOCKS: DEFAULT_ENEMY_WIDTH, // 2
        height_BLOCKS: DEFAULT_ENEMY_HEIGHT, // 2
        maxSpeedX_BLOCKS_PER_SEC: 10,
        maxSpeedY_BLOCKS_PER_SEC: 12.5,
        swimSpeed_BLOCKS_PER_SEC: 12.5,
        health: 1, contactDamage: 1, applyGravity: true, gravityFactor: 1.0, // Reduced contact damage for Seekers
        canJump: true,
        jumpVelocity_BLOCKS_PER_SEC: 25,
        canSwim: false, canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR,
        separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH,
        dropTable: [{ type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 }],
        visualShape: [
            // Main body
            { type: 'circle', cxFactor: 0, cyFactor: 0, rFactor: 0.45, color: 'rgb(60, 120, 60)', outlineColor: 'rgb(40,90,40)', outlineWidth: 2 },
            // "Eye"
            { type: 'circle', cxFactor: 0.15, cyFactor: -0.1, rFactor: 0.2, color: 'rgb(200, 200, 100)' },
            { type: 'circle', cxFactor: 0.2, cyFactor: -0.12, rFactor: 0.08, color: 'black' },
            // Some spikes/antennae
            { type: 'polygon', points: [ // Top spike
                {xFactor: 0, yFactor: -0.4}, {xFactor: -0.1, yFactor: -0.6}, {xFactor: 0.1, yFactor: -0.6}
            ], color: 'rgb(50,100,50)'},
            { type: 'polygon', points: [ // Side spike
                {xFactor: 0.4, yFactor: 0}, {xFactor: 0.6, yFactor: -0.1}, {xFactor: 0.6, yFactor: 0.1}
            ], color: 'rgb(50,100,50)'},
        ],
    },
    [ENEMY_TYPE_PLAYER_CHASER]: {
        displayName: "Chaser", aiType: 'chasePlayer', color: 'rgb(150, 80, 80)',
        width_BLOCKS: DEFAULT_ENEMY_WIDTH, // 2
        height_BLOCKS: DEFAULT_ENEMY_HEIGHT, // 2
        maxSpeedX_BLOCKS_PER_SEC: 13.75,
        maxSpeedY_BLOCKS_PER_SEC: 12.5,
        swimSpeed_BLOCKS_PER_SEC: 12.5,
        health: 50, contactDamage: 10, applyGravity: true, gravityFactor: 1.0,
        canJump: true,
        jumpVelocity_BLOCKS_PER_SEC: 37.5,
        canSwim: false, canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR,
        separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH,
        dropTable: [{ type: 'wood', chance: 1.0, minAmount: 1, maxAmount: 1 }],
        visualShape: [
            // Body
            { type: 'rect', xFactor: -0.4, yFactor: -0.35, wFactor: 0.8, hFactor: 0.7, color: 'rgb(120, 60, 60)', outlineColor: 'rgb(80,40,40)', outlineWidth: 2 },
            // Head/Mouth area
            { type: 'rect', xFactor: 0.2, yFactor: -0.25, wFactor: 0.3, hFactor: 0.5, color: 'rgb(140, 70, 70)' },
            // Teeth (simple triangles)
            { type: 'polygon', points: [ {xFactor: 0.2, yFactor: -0.25}, {xFactor: 0.5, yFactor: -0.2}, {xFactor: 0.2, yFactor: -0.15} ], color: 'white' },
            { type: 'polygon', points: [ {xFactor: 0.2, yFactor: 0}, {xFactor: 0.5, yFactor: -0.05}, {xFactor: 0.2, yFactor: 0.05} ], color: 'white' },
            { type: 'polygon', points: [ {xFactor: 0.2, yFactor: 0.25}, {xFactor: 0.5, yFactor: 0.2}, {xFactor: 0.2, yFactor: 0.15} ], color: 'white' },
            // Eye
            { type: 'circle', cxFactor: -0.1, cyFactor: -0.15, rFactor: 0.15, color: 'yellow' },
            { type: 'circle', cxFactor: -0.08, cyFactor: -0.16, rFactor: 0.07, color: 'black' },
        ],
    },
    [ENEMY_TYPE_DUNKLEOSTEUS]: {
        displayName: "Dunkleosteus", aiType: 'dunkleosteusAI', color: 'rgb(80, 100, 120)',
        width_BLOCKS: 4, // larger enemy
        height_BLOCKS: 2,
        health: 3, contactDamage: 15, applyGravity: true, gravityFactor: 1.0,
        maxSpeedX_BLOCKS_PER_SEC: 6.5,
        maxSpeedY_BLOCKS_PER_SEC: 0,
        swimSpeed_BLOCKS_PER_SEC: 15,
        canJump: false, jumpVelocity_BLOCKS_PER_SEC: 0,
        canSwim: true, canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR * 1.5,
        separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH * 1.2,
        landHopHorizontalVelocity_BLOCKS_PER_SEC: 0,
        dropTable: [{ type: 'bone', chance: 0.7, minAmount: 2, maxAmount: 3 }, { type: 'metal', chance: 0.2, minAmount: 1, maxAmount: 1 }],
        outOfWaterDamagePerSecond: 15,
        visualShape: [ // assuming center (0,0)
            // Main Body (armored front, softer tail)
            { type: 'polygon', points: [ // Armored head plate
                {xFactor: 0.45, yFactor: -0.3}, {xFactor: 0.1, yFactor: -0.45}, {xFactor: -0.1, yFactor: -0.4},
                {xFactor: -0.1, yFactor: 0.4}, {xFactor: 0.1, yFactor: 0.45}, {xFactor: 0.45, yFactor: 0.3}
            ], color: 'rgb(100, 120, 140)', outlineColor: 'rgb(60,80,100)', outlineWidth: 3 },
            // Jaw plate
            { type: 'polygon', points: [
                {xFactor: 0.48, yFactor: -0.1}, {xFactor: 0.2, yFactor: 0.1}, {xFactor: 0.48, yFactor: 0.15}
            ], color: 'rgb(110, 130, 150)'},
            // Tail section
            { type: 'polygon', points: [
                {xFactor: -0.1, yFactor: -0.3}, {xFactor: -0.48, yFactor: -0.15}, {xFactor: -0.48, yFactor: 0.15}, {xFactor: -0.1, yFactor: 0.3}
            ], color: 'rgb(70, 90, 110)' },
            // Eye
            { type: 'circle', cxFactor: 0.25, cyFactor: -0.2, rFactor: 0.1, color: 'rgb(200,180,50)'}, // rFactor relative to min(W,H)*0.5
            { type: 'circle', cxFactor: 0.26, cyFactor: -0.21, rFactor: 0.05, color: 'black'},
            // Fin
            { type: 'polygon', points: [ {xFactor:0, yFactor:0.4}, {xFactor:-0.1, yFactor:0.6}, {xFactor:0.1, yFactor:0.6}], color:'rgb(60,80,100)'}
        ],
    },
    [ENEMY_TYPE_SMALL_FISH]: {
        displayName: "Fish", aiType: 'fishAI', color: 'rgb(120, 180, 220)',
        width_BLOCKS: 1.5, height_BLOCKS: 0.75,
        health: 1, contactDamage: 0, applyGravity: true, gravityFactor: 1.0,
        maxSpeedX_BLOCKS_PER_SEC: 5,  maxSpeedY_BLOCKS_PER_SEC: 3,  swimSpeed_BLOCKS_PER_SEC: 7,
        canJump: false, jumpVelocity_BLOCKS_PER_SEC: 0,
        canSwim: true, canFly: false,
        separationFactor: 0.5, separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH * 0.5,
        dropTable: [],
        visualShape: [ // Designed for a right-facing fish, center (0,0)
            // Body
            { type: 'polygon', points: [ // Fishy body shape
                {xFactor: 0.4, yFactor: 0},    // Nose
                {xFactor: 0.1, yFactor: -0.4},  // Top-mid
                {xFactor: -0.45, yFactor: -0.2}, // Tail-top
                {xFactor: -0.45, yFactor: 0.2},  // Tail-bottom
                {xFactor: 0.1, yFactor: 0.4}   // Bottom-mid
            ], color: 'rgb(120, 180, 220)', outlineColor: 'rgb(100,160,200)', outlineWidth:1 },
            // Eye
            { type: 'circle', cxFactor: 0.25, cyFactor: -0.05, rFactor: 0.2, color: 'white' }, // rFactor relative to min(W,H)*0.5
            { type: 'circle', cxFactor: 0.28, cyFactor: -0.06, rFactor: 0.1, color: 'black' },
            // Tail Fin
            { type: 'polygon', points: [
                {xFactor: -0.4, yFactor: 0}, {xFactor: -0.25, yFactor: -0.35}, {xFactor: -0.25, yFactor: 0.35}
            ], color: 'rgb(140, 200, 240)'}
        ],
        fleeDistance_BLOCKS: 4, fleeSpeedFactor: 1.8,
    },
};

// --- Wave Scripting ---

export const WAVE_START_DELAY = 5.0; // seconds before first wave
export const EPOCH_DISPLAY_DURATION = 3.0; // seconds epoch text is displayed
export const MYA_TRANSITION_ANIMATION_DURATION = 8.0; // seconds for the MYA number to animate
export const AGING_DEFAULT_PASSES_PER_WAVE = 5; // fallback number of aging passes if not specified
export const WAVES = [
    {
        mainWaveNumber: 1,
        mya: 350,
        duration: 117,
        intermissionDuration: 15.0,
        audioTrack: AUDIO_TRACKS.wave1,
        agingPasses: 5,
        subWaves: [
            { enemyGroups: [
                { type: ENEMY_TYPE_TETRAPOD, count: 10, delayBetween: 1.8, startDelay: 0.0 },
                { type: ENEMY_TYPE_SMALL_FISH, count: 30, delayBetween: 0.8, startDelay: 0.0 },
                { type: ENEMY_TYPE_DUNKLEOSTEUS, count: 3, delayBetween: 3.0, startDelay: 5.0 },
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
        mya: 300,
        duration: 137,
        intermissionDuration: 15.0,
        audioTrack: AUDIO_TRACKS.wave2,
        agingPasses: 5,
        subWaves: [
            { enemyGroups: [
                { type: ENEMY_TYPE_PLAYER_CHASER, count: 4, delayBetween: 1.2, startDelay: 1.0 },
                { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.6, startDelay: 3.0 },
                { type: ENEMY_TYPE_SMALL_FISH, count: 10, delayBetween: 0.8, startDelay: 0.0 },
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
        mya: 250,
        duration: 30,
        intermissionDuration: 15.0,
        audioTrack: AUDIO_TRACKS.wave3,
        agingPasses: 5,
        subWaves: [
            { enemyGroups: [{ type: ENEMY_TYPE_TETRAPOD, count: 20, delayBetween: 0.5, startDelay: 0.0 }] },
            { enemyGroups: [{ type: ENEMY_TYPE_PLAYER_CHASER, count: 8, delayBetween: 1.0, startDelay: 5.0 }] },
        ]
    },
    {
        mainWaveNumber: 4,
        mya: 200,
        duration: 30,
        intermissionDuration: 15.0,
        audioTrack: AUDIO_TRACKS.wave3,
        agingPasses: 5,
        subWaves: [
            { enemyGroups: [{ type: ENEMY_TYPE_TETRAPOD, count: 20, delayBetween: 0.5, startDelay: 0.0 }] },
            { enemyGroups: [{ type: ENEMY_TYPE_PLAYER_CHASER, count: 8, delayBetween: 1.0, startDelay: 5.0 }] },
        ]
    },
    {
        mainWaveNumber: 5,
        customEpochText: "Present Day!", // sub out mya for custom text
        duration: 30,
        intermissionDuration: 15.0,
        audioTrack: AUDIO_TRACKS.wave3,
        agingPasses: 5,
        subWaves: [
            { enemyGroups: [{ type: ENEMY_TYPE_TETRAPOD, count: 20, delayBetween: 0.5, startDelay: 0.0 }] },
            { enemyGroups: [{ type: ENEMY_TYPE_PLAYER_CHASER, count: 8, delayBetween: 1.0, startDelay: 5.0 }] },
        ]
    }
];