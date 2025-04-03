// -----------------------------------------------------------------------------
// js/world.js - Handles Grid-Based Terrain Data and Drawing (with Procedural Gen)
// -----------------------------------------------------------------------------
console.log("world.js loaded");

import * as Config from './config.js';
import * as Renderer from './renderer.js';

// --- Module State ---
let worldGrid = []; // 2D Array: worldGrid[row][col] = blockObject or BLOCK_AIR(0)
let noiseGenerator = null; // Will hold our noise instance
let gridCanvas = null; // Reference to the off-screen grid canvas

// --- Perlin Noise Implementation (Basic) ---
class PerlinNoise {
    constructor(seed = Math.random()) { this.permutation = []; this.p = new Array(512); this.seed(seed); }
    seed(seed) {
        const random = (() => { let state = Math.floor(seed * 2 ** 32); return () => { state = (1103515245 * state + 12345) | 0; return (state >>> 16) / 65536; }; })();
        this.permutation = Array.from({ length: 256 }, (_, i) => i);
        for (let i = 255; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]]; }
        for (let i = 0; i < 512; i++) { this.p[i] = this.permutation[i & 255]; }
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x) { const h = hash & 15; const grad = 1 + (h & 7); return ((h & 8) !== 0 ? -grad : grad) * x; }
    noise(x) {
        const X = Math.floor(x) & 255; const xf = x - Math.floor(x); const u = this.fade(xf);
        const n0 = this.grad(this.p[X], xf); const n1 = this.grad(this.p[X + 1], xf - 1);
        return this.lerp(u, n0, n1) * 2.2;
    }
}

// --- Helper functions ---

/**
 * Creates a block object with default properties for a given type.
 * @param {number} type - Block type ID (e.g., Config.BLOCK_DIRT).
 * @param {number} [orientation=Config.ORIENTATION_FULL] - Orientation ID.
 * @returns {object} The block data object { type, orientation, hp, maxHp }.
 */
function createBlock(type, orientation = Config.ORIENTATION_FULL) {
    const baseHp = Config.BLOCK_HP[type] ?? 0;
    const currentHp = (type === Config.BLOCK_WATER) ? Infinity : baseHp;
    return {
        type: type,
        orientation: orientation,
        hp: currentHp,
        maxHp: baseHp
    };
}

/**
 * Gets the block object or BLOCK_AIR at specific grid coordinates - HELPER for initializeGrid.
 * This is a simplified version used ONLY during initialization BEFORE the main getBlock is ready/exported.
 * @param {number} col
 * @param {number} row
 * @returns {object | number | null} Block object, BLOCK_AIR (0), or null if out of bounds.
 */
function getBlockDuringInit(c, r) {
     if (r >= 0 && r < worldGrid.length && c >= 0 && c < (worldGrid[r]?.length ?? 0)) {
        return worldGrid[r][c];
    }
    return null; // Out of bounds or row doesn't exist yet
}

/**
 * Gets the block *type* ID at specific grid coordinates - HELPER for initializeGrid.
 * @param {number} col
 * @param {number} row
 * @returns {number | null} Block type ID or null if out of bounds.
 */
function getBlockTypeDuringInit(c, r) {
    const block = getBlockDuringInit(c, r);
    if (block === null) return null;
    return (block === Config.BLOCK_AIR) ? Config.BLOCK_AIR : block.type;
}

/**
 * Initializes the world grid using procedural generation.
 */
function initializeGrid() {
    console.log(`Initializing ${Config.GRID_ROWS}x${Config.GRID_COLS} world grid (Procedural)...`);
    worldGrid = []; // Initialize as empty
    noiseGenerator = new PerlinNoise();

    const islandWidth = Math.floor(Config.GRID_COLS * Config.WORLD_ISLAND_WIDTH_PERCENT);
    const islandStartCol = Math.floor((Config.GRID_COLS - islandWidth) / 2);
    const islandEndCol = islandStartCol + islandWidth;

    // --- Generation Loop (Row-major) ---
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        const row = [];
        for (let c = 0; c < Config.GRID_COLS; c++) {
            let surfaceRow = Config.WORLD_GROUND_LEVEL_MEAN;
            let stoneRow = Config.WORLD_STONE_LEVEL_MEAN;
            let blockData = Config.BLOCK_AIR;

            if (c >= islandStartCol && c < islandEndCol) {
                // Inside island
                const noiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE);
                const heightVariation = Math.round(noiseVal * Config.WORLD_GROUND_VARIATION);
                surfaceRow = Config.WORLD_GROUND_LEVEL_MEAN + heightVariation;
                const stoneNoiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE * 0.5 + 100);
                const stoneVariation = Math.round(stoneNoiseVal * Config.WORLD_STONE_VARIATION);
                stoneRow = Config.WORLD_STONE_LEVEL_MEAN + stoneVariation;
                stoneRow = Math.max(surfaceRow + 3, stoneRow);
                surfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, surfaceRow));
                stoneRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, stoneRow));

                 if (r >= stoneRow) { blockData = createBlock(Config.BLOCK_STONE); } // << Uses createBlock
                 else if (r > surfaceRow) { blockData = createBlock(Config.BLOCK_DIRT); } // << Uses createBlock
                 else if (r === surfaceRow) { blockData = createBlock(Config.BLOCK_GRASS); } // << Uses createBlock
            } else {
                // Outside island
                if (r >= Config.WORLD_WATER_LEVEL_ROW) { blockData = createBlock(Config.BLOCK_WATER); } // << Uses createBlock
            }
            row.push(blockData);
        }
        worldGrid.push(row); // Add the completed row
    }

     // --- Post-processing Pass for Sand ---
     console.log("Applying sand generation pass...");
     let changes = [];
     for (let r = Config.WORLD_WATER_LEVEL_ROW - 2; r < Config.GRID_ROWS; r++) {
         for (let c = 0; c < Config.GRID_COLS; c++) {
             // Use the dedicated helper here as setBlock isn't ready/exported yet
             const block = getBlockDuringInit(c, r);
             if (block && block !== Config.BLOCK_AIR && block.type !== Config.BLOCK_WATER && block.type !== Config.BLOCK_SAND) {
                 const neighbors = [
                     getBlockTypeDuringInit(c, r - 1), getBlockTypeDuringInit(c, r + 1),
                     getBlockTypeDuringInit(c - 1, r), getBlockTypeDuringInit(c + 1, r)
                 ];
                 if (neighbors.includes(Config.BLOCK_WATER)) {
                     changes.push({r, c});
                 }
             }
         }
     }
      // Apply the changes by directly modifying the grid (setBlock isn't exported yet)
      changes.forEach(change => {
           if (change.r >= 0 && change.r < Config.GRID_ROWS && change.c >= 0 && change.c < Config.GRID_COLS) {
                worldGrid[change.r][change.c] = createBlock(Config.BLOCK_SAND); // << Uses createBlock
           }
      });
     // --- End Sand Pass ---

    console.log("Procedural world grid generated.");
} // --- End initializeGrid ---


/**
 * Draws the static grid lines onto the off-screen grid canvas (once).
 */
function drawGridLayerOnce() {
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx || !gridCanvas) { console.error("World.drawGridLayerOnce: Grid context/canvas missing!"); return; }
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.save();
    gridCtx.strokeStyle = 'rgba(50, 50, 50, 0.1)';
    gridCtx.lineWidth = 0.5;
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            gridCtx.strokeRect(c * Config.BLOCK_WIDTH, r * Config.BLOCK_HEIGHT, Config.BLOCK_WIDTH, Config.BLOCK_HEIGHT);
        }
    }
    gridCtx.restore();
    console.log("Static grid layer drawn.");
}

// --- PUBLIC EXPORTED FUNCTIONS ---

export function init() {
    initializeGrid(); // Call the internal function that uses createBlock
    gridCanvas = Renderer.getGridCanvas();
    drawGridLayerOnce();
    console.log("World initialized with procedural grid.");
}

export function getBlock(col, row) {
    // This is the safe version for external use
    if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        // Check if row exists before accessing col (important during init maybe)
        return worldGrid[row]?.[col] ?? Config.BLOCK_AIR; // Default to air if row/col undefined
    }
    return null; // Out of bounds
}

export function getBlockType(col, row) {
    const block = getBlock(col, row);
    if (block === null) return null;
    return (block === Config.BLOCK_AIR) ? Config.BLOCK_AIR : block.type;
}

export function setBlock(col, row, blockType, orientation = Config.ORIENTATION_FULL) {
     if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        if (blockType === Config.BLOCK_AIR || blockType === null) {
            worldGrid[row][col] = Config.BLOCK_AIR;
        } else {
             // Use the createBlock helper function defined above
            worldGrid[row][col] = createBlock(blockType, orientation);
        }
         // TODO: Add logic here to mark this block/chunk as "dirty" for optimized drawing
    } else { /* console.warn(`Set block out of bounds: ${row}, ${col}`); */ }
}


export function draw(ctx) {
    if (!ctx) { console.error("World.draw: No context!"); return; }

    // 1. Draw Static Grid Layer
    if (gridCanvas) {
        ctx.drawImage(gridCanvas, 0, 0);
    } else { /* Fallback drawing */ }

    // 2. Draw Dynamic Blocks
    // TODO: Optimize to only draw "dirty" blocks/chunks
    const startCol = 0; const endCol = Config.GRID_COLS;
    const startRow = 0; const endRow = Config.GRID_ROWS;
    for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
            const block = worldGrid[r][c]; // Use internal grid directly is fine here
            const blockType = (block === Config.BLOCK_AIR) ? Config.BLOCK_AIR : block.type;
            const blockColor = Config.BLOCK_COLORS[blockType];
            if (!blockColor) continue;
            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            const orientation = block?.orientation ?? Config.ORIENTATION_FULL;
            if (orientation === Config.ORIENTATION_FULL) {
                ctx.fillStyle = blockColor;
                ctx.fillRect( Math.floor(blockX), Math.floor(blockY), Math.max(1, Config.BLOCK_WIDTH), Math.max(1, Config.BLOCK_HEIGHT) );
            }
            // Slope/Durability drawing later
        }
    }
}

export function isSolid(col, row) {
    const block = getBlock(col, row); // Use the safe public getter
    if (block === null || block === Config.BLOCK_AIR) return false;
    if (block.type === Config.BLOCK_WATER) return false;
    // TODO: Slope logic
    return true;
}

export function worldToGridCoords(worldX, worldY) {
    const col = Math.floor(worldX / Config.BLOCK_WIDTH);
    const row = Math.floor(worldY / Config.BLOCK_HEIGHT);
    return { col, row };
}

export function getCollisionSurfaceY(col) {
    if (col < 0 || col >= Config.GRID_COLS) return Config.CANVAS_HEIGHT;
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        if (isSolid(col, r)) return r * Config.BLOCK_HEIGHT;
    }
    return Config.CANVAS_HEIGHT;
}

export function checkGridCollision(entity) {
    let collidedX = false, collidedY = false, isOnGround = false;
    const targetY = entity.y + entity.vy; const isMovingDown = entity.vy > 0; const isMovingUp = entity.vy < 0;
    const checkXLeft = entity.x + 1; const checkXRight = entity.x + entity.width - 1;
    if (isMovingDown) { /* ... vertical down check using isSolid ... */ }
    else if (isMovingUp) { /* ... vertical up check using isSolid ... */ }
    const targetX = entity.x + entity.vx; const isMovingRight = entity.vx > 0; const isMovingLeft = entity.vx < 0;
    const checkYTop = entity.y + 1; const checkYMiddle = entity.y + entity.height / 2; const checkYBottom = entity.y + entity.height - 1;
    if (isMovingRight) { /* ... horizontal right check using isSolid ... */ }
    else if (isMovingLeft) { /* ... horizontal left check using isSolid ... */ }
    if (!isOnGround && entity.vy >= 0) { /* ... final ground check using isSolid ... */ }
    // --- The verbose collision logic is kept the same, just ensure isSolid is called ---
    // --- [ Ensure the verbose collision logic from the previous correct version is here ] ---
     // --- [ including the snapping logic: entity.y = ..., entity.x = ... etc. ] ---
     // --- [ And the final return { collidedX, collidedY, isOnGround }; ] ---
     // --- [ Copying the full collision logic again to be safe: ] ---
     if (isMovingDown) {
         const feetY = targetY + entity.height;
         const checkRow = worldToGridCoords(entity.x, feetY).row;
         const colLeft = worldToGridCoords(checkXLeft, feetY).col;
         const colRight = worldToGridCoords(checkXRight, feetY).col;
         if (isSolid(colLeft, checkRow) || isSolid(colRight, checkRow)) {
             const groundSurfaceY = checkRow * Config.BLOCK_HEIGHT;
             if (entity.y + entity.height <= groundSurfaceY + 0.01) { entity.y = groundSurfaceY - entity.height; entity.vy = 0; collidedY = true; isOnGround = true; }
             else if (entity.y + entity.height > groundSurfaceY && entity.vy > 0){ entity.y = groundSurfaceY - entity.height; entity.vy = 0; collidedY = true; isOnGround = true; }
         }
     } else if (isMovingUp) {
         const headY = targetY;
         const checkRow = worldToGridCoords(entity.x, headY).row;
         const colLeft = worldToGridCoords(checkXLeft, headY).col;
         const colRight = worldToGridCoords(checkXRight, headY).col;
         if (isSolid(colLeft, checkRow) || isSolid(colRight, checkRow)) {
             const ceilingSurfaceY = (checkRow + 1) * Config.BLOCK_HEIGHT;
             if (entity.y >= ceilingSurfaceY - 0.01) { entity.y = ceilingSurfaceY; entity.vy = 0; collidedY = true; }
         }
     }
     if (isMovingRight) {
         const rightEdgeX = targetX + entity.width;
         const checkCol = worldToGridCoords(rightEdgeX, entity.y).col;
         if (isSolid(checkCol, worldToGridCoords(rightEdgeX, checkYTop).row) || isSolid(checkCol, worldToGridCoords(rightEdgeX, checkYMiddle).row) || isSolid(checkCol, worldToGridCoords(rightEdgeX, checkYBottom).row)) {
             const wallSurfaceX = checkCol * Config.BLOCK_WIDTH;
             if (entity.x + entity.width <= wallSurfaceX + 0.01) { entity.x = wallSurfaceX - entity.width; entity.vx = 0; collidedX = true; }
         }
     } else if (isMovingLeft) {
         const leftEdgeX = targetX;
         const checkCol = worldToGridCoords(leftEdgeX, entity.y).col;
         if (isSolid(checkCol, worldToGridCoords(leftEdgeX, checkYTop).row) || isSolid(checkCol, worldToGridCoords(leftEdgeX, checkYMiddle).row) || isSolid(checkCol, worldToGridCoords(leftEdgeX, checkYBottom).row)) {
             const wallSurfaceX = (checkCol + 1) * Config.BLOCK_WIDTH;
             if (entity.x >= wallSurfaceX - 0.01) { entity.x = wallSurfaceX; entity.vx = 0; collidedX = true; }
         }
     }
     if (!isOnGround && entity.vy >= 0) {
          const feetYFinal = entity.y + entity.height;
          const checkRowBelow = worldToGridCoords(entity.x, feetYFinal + 1).row;
          const colLeftFinal = worldToGridCoords(checkXLeft, feetYFinal).col;
          const colRightFinal = worldToGridCoords(checkXRight, feetYFinal).col;
          if (isSolid(colLeftFinal, checkRowBelow) || isSolid(colRightFinal, checkRowBelow)) { isOnGround = true; }
     }
     return { collidedX, collidedY, isOnGround }; // Ensure return is here
}


export function update(dt) {
    // Placeholder for grass spreading etc.
}