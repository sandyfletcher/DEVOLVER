// -----------------------------------------------------------------------------
// root/js/worldManager.js - Manages world state, drawing, and interactions
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as Renderer from './renderer.js';
import * as WorldData from './utils/worldData.js';
import * as ItemManager from './itemManager.js';
import { generateInitialWorld } from './utils/worldGenerator.js';
import * as GridCollision from './utils/gridCollision.js';
import { PerlinNoise } from './utils/noise.js'; // Import Perlin Noise

// -----------------------------------------------------------------------------
// --- World State & Simulation ---
// -----------------------------------------------------------------------------

// --- Water Simulation ---
// --- Use a Map to store coordinates that need checking, preventing duplicates ---
let waterUpdateQueue = new Map(); // Map: "col,row" -> {c, r}
let waterPropagationTimer = 0;     // Timer to control spread speed

// --- Aging Logic ---
let agingNoiseGenerator = null; // Dedicated noise instance for aging

// --- Initialize World Manager ---
// NOW ACCEPTS PORTAL REFERENCE FOR INITIAL AGING
export function init(portalRef) {
    console.time("WorldManager initialized");
    WorldData.initializeGrid();
    // generateInitialWorld now handles filling water and ensuring underwater integrity
    generateInitialWorld(); // World generator now handles landmass + flood fill

    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCanvas) {
        console.error("FATAL: Grid Canvas not found! Ensure Renderer.createGridCanvas() runs before World.init().");
        console.warn("Attempting fallback grid canvas creation.");
        Renderer.createGridCanvas();
        if (!Renderer.getGridCanvas()) {
            throw new Error("Fallback grid canvas creation failed.");
        }
    }
    // Initial rendering *before* aging is useful for debugging generation results
    renderStaticWorldToGridCanvas();

    // --- Initialize aging noise ---
    // Use a consistent seed or a different seed calculation for aging noise
    agingNoiseGenerator = new PerlinNoise(12345); // Example fixed seed

    // --- Apply initial aging after generation ---
    // Call aging with the provided portal reference and a specific wave number/intensity for initial state
    // Pass the BASE aging intensity for the initial aging pass before Wave 1 starts.
    console.log("Applying initial world aging...");
    applyAging(portalRef, Config.AGING_BASE_INTENSITY); // Apply aging with base intensity
    console.log("Initial world aging complete.");

    // IMPORTANT: Re-render static world after aging, as aging changes blocks.
    renderStaticWorldToGridCanvas();

    seedWaterUpdateQueue(); // Seed the water simulation after world generation AND initial aging
    // console.timeEnd("WorldManager initialized");
}

// --- Add coordinates to the water update queue ---
// Only adds cells that are within bounds, at or below the water line threshold,
// not already in the queue, AND are types that participate in water simulation (AIR or WATER).
function addWaterUpdateCandidate(col, row) {
    // Check if within bounds and at or below the water line threshold
    if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        const key = `${col},${row}`;
        // Check if the cell is already in the queue to avoid duplicates
        if (!waterUpdateQueue.has(key)) {
            // Get the block type to check if it's a type that participates in water simulation
            const blockType = WorldData.getBlockType(col, row);

            // Add to queue only if it's BLOCK_AIR or BLOCK_WATER
            if (blockType !== null && (blockType === Config.BLOCK_AIR || blockType === Config.BLOCK_WATER))
            {
                waterUpdateQueue.set(key, {c: col, r: row});
            } // else: console.log(`[WaterQ] Did NOT add [${col}, ${r}]: Already in queue or Solid/Non-WaterSimulation Type (${blockType}).`);
        }
    }
}

// --- Internal function to set a block in grid data AND update the static visual cache ---
// Handles creating the block object with HP etc., and immediately triggers redraw.
function internalSetBlock(col, row, blockType, isPlayerPlaced = false) {
    // Use setBlock from WorldData to update the underlying data structure
    const success = WorldData.setBlock(col, row, blockType, isPlayerPlaced);

    if (success) {
        // Always update the static visual cache on block data change
        // Pass the *new* block type to updateStaticWorldAt
        updateStaticWorldAt(col, row); // MODIFIED: No longer need to pass blockTypeAfterUpdate here

        // Trigger Water Simulation Update for Changed Area if below Waterline ---
        // If the change is at or below the water level threshold, queue this cell and its neighbors
        // for potential re-evaluation by the water simulation. addWaterUpdateCandidate
        // handles the checks for bounds and block type (only queues AIR/WATER).
        if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
            let addedToQueue = false;
            // Helper to add candidate and track if anything was actually added
            const tryAddCandidate = (c, r) => {
                const initialSize = waterUpdateQueue.size;
                addWaterUpdateCandidate(c, r); // This handles bounds, type, and existence checks
                if (waterUpdateQueue.size > initialSize) {
                    addedToQueue = true; // Set flag if queue size increased
                }
            };

            // Add the changed cell itself
            tryAddCandidate(col, row);

            // Add neighbors - necessary to propagate water away from a new solid block,
            // or into/away from a newly created AIR/WATER block.
            const neighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // Cardinal neighbors
            neighbors.forEach(neighbor => tryAddCandidate(col + neighbor.dc, row + neighbor.dr));

            // --- CRITICAL FIX: Reset the propagation timer IF any candidates were added ---
            // This ensures the water simulation loop processes the change very soon.
            if (addedToQueue) {
                waterPropagationTimer = 0; // Force the timer to zero
                // console.log(`[WaterMgr] Block change at [${col}, ${row}] triggered water queue update. Resetting propagation timer.`);
            }
        }
    } else {
        console.log(`[WaterMgr] Failed to set block data at [${col}, ${row}].`);
    }
    return success;
}


// --- Draw the entire static world to the off-screen canvas ---
function renderStaticWorldToGridCanvas() {
    // console.log("Rendering initial static world blocks to off-screen canvas...");
    const gridCtx = Renderer.getGridContext();
    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCtx || !gridCanvas) {
        console.error("WorldManager: Cannot render static world - grid canvas/context missing!");
        return;
    }
// clear the entire off-screen canvas first
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
// iterate through grid data
    const worldGrid = WorldData.getGrid();
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const block = worldGrid[r][c];
            // Directly check for BLOCK_AIR (number 0) or null/undefined
            if (!block || typeof block === 'number' && block === Config.BLOCK_AIR) continue;

            const blockType = typeof block === 'object' ? block.type : block; // Get type property or use block value
            const blockColor = Config.BLOCK_COLORS[blockType];
            if (!blockColor) {
                console.error(`No color defined for block type ${blockType} at [${c}, ${r}]`);
                continue;
            }
            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            const blockW = Math.ceil(Config.BLOCK_WIDTH); // Use Math.ceil for robustness
            const blockH = Math.ceil(Config.BLOCK_HEIGHT);

            // draw block body onto GRID CANVAS using gridCtx
            gridCtx.fillStyle = blockColor;
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH); // Use Math.floor for origin

            // draw Outline if Player Placed ---
            const isPlayerPlaced = block && typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false; // default to false if property is missing
            if (isPlayerPlaced) {
                 gridCtx.save(); // save context state
                 gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                 gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
                // adjust coordinates for stroke to be inside the block boundaries
                const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
                 gridCtx.strokeRect(
                     Math.floor(blockX) + outlineInset,
                     Math.floor(blockY) + outlineInset,
                     blockW - Config.PLAYER_BLOCK_OUTLINE_THICKNESS, // Subtract stroke width from both sides
                     blockH - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
                 );
                 gridCtx.restore(); // restore context state
            }

            // --- Draw Damage Indicators ---
            // Check if the block object exists, has HP and maxHp properties, and is potentially damaged
            if (block && typeof block === 'object' && block.maxHp > 0 && block.hp < block.maxHp) {
                 const hpRatio = block.hp / block.maxHp;

                 gridCtx.save(); // Save context state before drawing lines
                 gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                 gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                 gridCtx.lineCap = 'square'; // Use square cap

                 // Calculate the effective inset for the line path points
                 // The stroke's center should be LINE_WIDTH / 2 from the edge.
                 // The path point should be LINE_WIDTH from the edge.
                 const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;


                 // Draw Slash (\) if HP is <= 70%
                 if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) {
                      gridCtx.beginPath();
                      // Move to inset top-left, draw to inset bottom-right
                      gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset); // MODIFIED: Use pathInset
                      gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset); // MODIFIED: Use pathInset
                      gridCtx.stroke();
                 }

                 // Draw Second Line (/) if HP is <= 30% (creating an 'X')
                 if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_X) {
                      gridCtx.beginPath();
                       // Move to inset top-right, draw to inset bottom-left
                      gridCtx.moveTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY) + pathInset); // MODIFIED: Use pathInset
                      gridCtx.lineTo(Math.floor(blockX) + pathInset, Math.floor(blockY + blockH) - pathInset); // MODIFIED: Use pathInset
                      gridCtx.stroke();
                 }

                 gridCtx.restore(); // Restore context state
            }
        }
    }
    // console.log("Initial static world rendered."); // Keep logs quieter
}

// --- Helper function to update a single block on the off-screen canvas ---
// Clears the block's area and redraws it if it's not air, INCLUDING DAMAGE INDICATORS.
// MODIFIED: Removed blockTypeAfterUpdate argument.
export function updateStaticWorldAt(col, row) { // EXPORTED for applyAging to use
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx) {
        console.error(`WorldManager: Cannot update static world at [${col}, ${row}] - grid context missing!`);
        return;
    }

    // Get the block data *after* it has been updated in WorldData
    const block = WorldData.getBlock(col, row);

    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    const blockW = Math.ceil(Config.BLOCK_WIDTH); // Use Math.ceil for robustness
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);

    // --- Clear Area ---
    // Always clear the exact block area before redrawing (or not drawing if air)
    // If drawing the damage lines strictly within the block bounds works,
    // we don't need an expanded clear here.
    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

    // 2. If the block is NOT air and NOT null (out of bounds), redraw it
    // WorldData.getBlock returns 0 for AIR and null for out of bounds. Any other value is an object.
    // The drawing logic itself should still draw within the block's original bounds [blockX, blockY, blockW, blockH]
    if (block !== Config.BLOCK_AIR && block !== null) {
        const currentBlockType = typeof block === 'object' ? block.type : block;
        const blockColor = Config.BLOCK_COLORS[currentBlockType];

        if (blockColor) {
            // Draw block body
            gridCtx.fillStyle = blockColor;
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

            // --- Draw Outline if Player Placed ---
            const isPlayerPlaced = block && typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false;
            if (isPlayerPlaced) {
                 gridCtx.save(); // Save context state
                 gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                 gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
                 const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
                  gridCtx.strokeRect(
                     Math.floor(blockX) + outlineInset,
                     Math.floor(blockY) + outlineInset,
                     blockW - Config.PLAYER_BLOCK_OUTLINE_THICKNESS,
                     blockH - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
                 );
                 gridCtx.restore(); // Restore context state
            }

            // --- Draw Damage Indicators (Inset) ---
            // Check if the block object exists, has HP and maxHp properties, and is potentially damaged
            if (block && typeof block === 'object' && block.maxHp > 0 && block.hp < block.maxHp) {
                 const hpRatio = block.hp / block.maxHp;

                 gridCtx.save(); // Save context state before drawing lines
                 gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                 gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                 gridCtx.lineCap = 'square'; // Use square cap

                // Calculate the effective inset for the line path points
                 // The stroke's center should be LINE_WIDTH / 2 from the edge.
                 // The path point should be LINE_WIDTH from the edge.
                 const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;


                 // Draw Slash (\) if HP is <= 70%
                 if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) {
                      gridCtx.beginPath();
                      // Move to inset top-left, draw to inset bottom-right
                      gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset); // MODIFIED: Use pathInset
                      gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset); // MODIFIED: Use pathInset
                      gridCtx.stroke();
                 }

                 // Draw Second Line (/) if HP is <= 30% (creating an 'X')
                 if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_X) {
                      gridCtx.beginPath();
                       // Move to inset top-right, draw to inset bottom-left
                      gridCtx.moveTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY) + pathInset); // MODIFIED: Use pathInset
                      gridCtx.lineTo(Math.floor(blockX) + pathInset, Math.floor(blockY + blockH) - pathInset); // MODIFIED: Use pathInset
                      gridCtx.stroke();
                 }

                 gridCtx.restore(); // Restore context state
            }
        }
    }
    // If block IS AIR (or null), the drawing logic for block body/indicators is skipped,
    // and only the exact clearRect runs, leaving the area empty.
}


// --- Seed water update queue with initial water blocks and adjacent air candidates below the waterline ---
function seedWaterUpdateQueue() {
    waterUpdateQueue.clear(); // start fresh
    // console.log("[WaterMgr] Seeding initial water update queue...");
    for (let r = Config.WORLD_WATER_LEVEL_ROW_TARGET; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            // Add any block AT or below the waterline threshold that is AIR or WATER.
            // The addWaterUpdateCandidate function handles the bounds, queue.has check,
            // and whether the block type is valid for being in the queue.
            addWaterUpdateCandidate(c, r);
        }
    }
    // console.log(`[WaterMgr] Initial water update queue size after seeding: ${waterUpdateQueue.size}`);
}

/**
 * Applies aging effects to the world grid.
 * @param {Portal} portalRef - Reference to the portal for protected zone.
 * @param {number} intensityFactor - The intensity multiplier for this aging pass (1.0 for base).
 */
// MODIFIED: Function now accepts intensityFactor directly instead of waveNumber
export function applyAging(portalRef, intensityFactor) {
    console.time(`World aging with intensity ${intensityFactor.toFixed(2)}`);
    if (!agingNoiseGenerator) {
         console.error("Aging noise generator not initialized!");
         return;
    }
    const grid = WorldData.getGrid(); // Get the actual grid array
    if (!grid || grid.length === 0 || grid[0].length === 0) {
        console.error("World grid is not available or empty for aging.");
        return;
    }

    // MODIFIED: Intensity is now passed in as intensityFactor
    const clampedIntensity = Math.max(0.0, intensityFactor); // Ensure non-negative intensity
    console.log(`Applying Aging (Intensity: ${clampedIntensity.toFixed(2)})`);


    // Get portal position and calculated protected radius
    let portalX = -Infinity, portalY = -Infinity;
    let protectedRadiusSq = 0; // Default to far away/no radius if no portal

    if (portalRef) {
        const portalPos = portalRef.getPosition();
        portalX = portalPos.x;
        portalY = portalPos.y;
        const baseSafetyRadius = portalRef.safetyRadius; // This is the radius from portal.js
        // REMOVED: Config.AGING_PROTECTED_RADIUS_MULTIPLIER
        protectedRadiusSq = baseSafetyRadius * baseSafetyRadius; // Use the radius directly, squared
        // console.log(`Protected Zone: Center (${portalX.toFixed(1)}, ${portalY.toFixed(1)}), Radius ${Math.sqrt(protectedRadiusSq).toFixed(1)}`);
    } else {
         // If no portal ref (e.g. initial aging before portal is created in main), maybe use screen center?
         portalX = Config.CANVAS_WIDTH / 2;
         portalY = Config.CANVAS_HEIGHT / 2;
         // REMOVED: Config.AGING_PROTECTED_RADIUS_MULTIPLIER
         protectedRadiusSq = Config.PORTAL_SAFETY_RADIUS * Config.PORTAL_SAFETY_RADIUS; // Use base portal radius squared
          // console.log(`No Portal Ref: Using Screen Center for Protected Zone: Center (${portalX.toFixed(1)}, ${portalY.toFixed(1)}), Radius ${Math.sqrt(protectedRadiusSq).toFixed(1)}`);
    }

    let changesCount = 0; // Track how many blocks change


    // --- Iterate and Apply Aging Rules ---
    // Iterate through all cells. Could optimize this later (e.g., focus on surface/edges).
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {

            const block = WorldData.getBlock(c, r); // Get the block object or AIR constant
            // Skip out of bounds cells (getBlock handles this, returns null)
            if (block === null) continue;

            const originalType = (typeof block === 'object') ? block.type : block;
            // If block is AIR, it can only potentially become something else (growth/sedimentation)
            // If it's solid/water, it can erode/stoneify etc.
            // If it's already a terminal type like Stone or Metal, maybe it doesn't age?
             // For now, let's allow all types to potentially age according to rules.

            let newType = originalType; // Assume no change initially

            // Calculate depth ONCE per cell, before the switch
            const depth = r * Config.BLOCK_HEIGHT; // <--- MOVED DECLARATION HERE

            // Calculate distance from portal center (squared)
            let distSqToPortal = Infinity;
            const blockCenterX = c * Config.BLOCK_WIDTH + Config.BLOCK_WIDTH / 2;
            const blockCenterY = r * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2;
            const dx = blockCenterX - portalX;
            const dy = blockCenterY - portalY;
            distSqToPortal = dx * dx + dy * dy;

            // Determine if this cell is within the protected zone
            const isInProtectedZone = distSqToPortal <= protectedRadiusSq;
            // MODIFIED: Aging effect multiplier is 0 inside radius, 1 outside
            const agingEffectMultiplier = isInProtectedZone ? 0.0 : 1.0;

            // Get noise value for this cell (can use 2D noise later if needed, 1D for now)
            // Use a different coordinate base for aging noise than world generation noise
            // ADDED: calculate scaledNoise here
            const noiseVal = agingNoiseGenerator.noise(c * Config.AGING_NOISE_SCALE + r * Config.AGING_NOISE_SCALE * 0.1);
            const scaledNoise = (noiseVal + 1) / 2; // Scale noise to [0, 1]

             // If aging is completely disabled (0 intensity or inside 0% multiplier zone), skip rules
            if (clampedIntensity <= 0 || agingEffectMultiplier <= 0) {
                 continue;
             }

            // Check if the block below is solid (for sedimentation) or if this is the bottom row
            const hasSolidBelow = GridCollision.isSolid(c, r + 1) || r + 1 >= Config.GRID_ROWS;


            // --- Apply Rules Based on Block Type ---
            switch (originalType) {
                case Config.BLOCK_AIR:
                    // Check for Growth (if above water) or Sedimentation (if underwater)
                    if (r < Config.WORLD_WATER_LEVEL_ROW_TARGET) { // Above water
                         // Check for solid block below (potential surface growth)
                         // Using GridCollision.isSolid handles bounds and type checks
                         if (GridCollision.isSolid(c, r + 1)) {
                             const growthProb = Config.AGING_PROB_GROWTH_SURFACE_AIR * scaledNoise * clampedIntensity * agingEffectMultiplier;
                              if (Math.random() < growthProb) {
                                   // Grow grass if neighbor below is dirt/grass, else dirt
                                   const blockBelowType = WorldData.getBlockType(c, r+1);
                                    if(blockBelowType === Config.BLOCK_DIRT || blockBelowType === Config.BLOCK_GRASS) {
                                        newType = Config.BLOCK_GRASS;
                                    } else {
                                        newType = Config.BLOCK_DIRT;
                                    }
                              }
                         }
                    } else { // At or below water line - Check for Sedimentation (underwater air)
                         // MODIFIED: ONLY apply sedimentation if there is solid ground below
                         if (hasSolidBelow) {
                             // More likely if adjacent to solids (sheltered) - count solid neighbors using isSolid
                             const adjacentSolids = (GridCollision.isSolid(c, r - 1) ? 1 : 0) + (GridCollision.isSolid(c, r + 1) ? 1 : 0) +
                                                    (GridCollision.isSolid(c - 1, r) ? 1 : 0) + (GridCollision.isSolid(c + 1, r) ? 1 : 0);
                             const sedimentationProb = Config.AGING_PROB_SEDIMENTATION_UNDERWATER_AIR_WATER * scaledNoise * clampedIntensity * agingEffectMultiplier * (1 + adjacentSolids * 0.2); // More solids = slightly higher chance
                             if (Math.random() < sedimentationProb) {
                                 newType = Config.BLOCK_SAND; // Or maybe mix sand/dirt
                             }
                         }
                    }
                    break;

                case Config.BLOCK_WATER:
                     // Check for Sedimentation (underwater water)
                    if (r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) { // Only apply aging to water below the initial surface
                        // MODIFIED: ONLY apply sedimentation if there is solid ground below
                        if (hasSolidBelow) {
                             // More likely if adjacent to solids
                             const adjacentSolids = (GridCollision.isSolid(c, r - 1) ? 1 : 0) + (GridCollision.isSolid(c, r + 1) ? 1 : 0) +
                                                    (GridCollision.isSolid(c - 1, r) ? 1 : 0) + (GridCollision.isSolid(c + 1, r) ? 1 : 0);
                             const sedimentationProb = Config.AGING_PROB_SEDIMENTATION_UNDERWATER_AIR_WATER * scaledNoise * clampedIntensity * agingEffectMultiplier * (1 + adjacentSolids * 0.2);
                             if (Math.random() < sedimentationProb) {
                                newType = Config.BLOCK_SAND; // Water turns into sand/dirt
                             }
                         }
                    }
                    break;

                case Config.BLOCK_DIRT:
                case Config.BLOCK_GRASS: // Treat grass similar to dirt for deep aging
                    // Check for Erosion (if exposed) or Stoneification (if deep)
                    // isExposed check needs to use getBlockType correctly to handle boundaries and AIR/WATER
                    const isExposedDirtGrass = WorldData.getBlockType(c, r - 1) === Config.BLOCK_AIR || WorldData.getBlockType(c, r - 1) === Config.BLOCK_WATER || // Exposed to air/water above
                                      WorldData.getBlockType(c, r + 1) === Config.BLOCK_AIR || WorldData.getBlockType(c, r + 1) === Config.BLOCK_WATER || // Exposed below (e.g., hanging dirt)
                                      WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR || WorldData.getBlockType(c - 1, r) === Config.BLOCK_WATER || // Exposed left
                                      WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR || WorldData.getBlockType(c + 1, r) === Config.BLOCK_WATER; // Exposed right


                    if (isExposedDirtGrass && r < Config.WORLD_WATER_LEVEL_ROW_TARGET) { // Erosion primarily above water for dirt/grass
                         const erosionProb = Config.AGING_PROB_EROSION_EXPOSED_DIRT * scaledNoise * clampedIntensity * agingEffectMultiplier;
                          if (Math.random() < erosionProb) {
                              newType = Config.BLOCK_AIR; // Erodes to air
                          }
                    } else if (depth > Config.AGING_STONEIFICATION_DEPTH_THRESHOLD && scaledNoise > 0.5) { // Stoneification check (only if deep and noise is high)
                        const stoneProb = Config.AGING_PROB_STONEIFICATION_DEEP_DIRT_SAND * scaledNoise * clampedIntensity * agingEffectMultiplier;
                         if (Math.random() < stoneProb) {
                             newType = Config.BLOCK_STONE; // Turns to stone
                         }
                    }
                    // Optional: underwater dirt/grass could also erode to sand/air or turn to sand
                    break;

                case Config.BLOCK_SAND:
                    // Check for Erosion (if exposed, especially underwater) or Stoneification (if deep)
                    // isExposed check needs to use getBlockType correctly
                    const isExposedSand = WorldData.getBlockType(c, r - 1) === Config.BLOCK_AIR || WorldData.getBlockType(c, r - 1) === Config.BLOCK_WATER ||
                                         WorldData.getBlockType(c, r + 1) === Config.BLOCK_AIR || WorldData.getBlockType(c, r + 1) === Config.BLOCK_WATER ||
                                         WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR || WorldData.getBlockType(c - 1, r) === Config.BLOCK_WATER ||
                                         WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR || WorldData.getBlockType(c + 1, r) === Config.BLOCK_WATER;


                     if (isExposedSand) { // Sand erodes more easily
                         const erosionProb = Config.AGING_PROB_EROSION_EXPOSED_SAND * scaledNoise * clampedIntensity * agingEffectMultiplier;
                         if (Math.random() < erosionProb) {
                              newType = r >= Config.WORLD_WATER_LEVEL_ROW_TARGET ? Config.BLOCK_WATER : Config.BLOCK_AIR; // Underwater sand -> water, above -> air
                         }
                     } else if (depth > Config.AGING_STONEIFICATION_DEPTH_THRESHOLD && scaledNoise > 0.5) { // Stoneification check (only if deep and noise is high)
                        const stoneProb = Config.AGING_PROB_STONEIFICATION_DEEP_DIRT_SAND * scaledNoise * clampedIntensity * agingEffectMultiplier;
                        if (Math.random() < stoneProb) {
                            newType = Config.BLOCK_STONE; // Turns to stone
                        }
                    }
                    break;

                // Add rules for other block types (Wood, Metal, Bone, etc.)
                // case Config.BLOCK_WOOD: // Wood could rot over time if exposed
                //     if (isExposed && Math.random() < decayProb * agingEffectMultiplier) newType = Config.BLOCK_AIR;
                //     break;
                // case Config.BLOCK_BONE: // Bone could erode faster than stone
                //     if (isExposed && Math.random() < boneErosionProb * agingEffectMultiplier) newType = Config.BLOCK_SAND;
                //     break;
            }

            // --- Apply Change and Update Visuals ---
            if (newType !== originalType) {
                 // MODIFIED: Removed player-placed resistance check
                const isPlayerPlaced = typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false;

                // Use setBlock which creates the proper block object structure and updates WorldData
                // For aging, assume changes are "natural", so isPlayerPlaced = false for the *new* block,
                // UNLESS you are designing aging that specifically affects player-placed status (unlikely).
                // Let's keep playerPlaced status on the block object if it exists, even if the type changes.
                 const playerPlacedStatusToKeep = isPlayerPlaced; // Keep the original playerPlaced status

                if (WorldData.setBlock(c, r, newType, playerPlacedStatusToKeep)) { // Use setBlock which updates WorldData
                    // setBlock doesn't call updateStaticWorldAt internally. It should just update the data.
                    // We need to explicitly call updateStaticWorldAt here after a successful data change.
                    updateStaticWorldAt(c, r); // Redraw the changed block on the static canvas
                    changesCount++;
                    // Water simulation needs to be re-evaluated around the change
                    // internalSetBlock (called by setBlock) handles queuing for water.
                    // FIX: setBlock doesn't call internalSetBlock. Manual water queue update needed?
                    // Simpler: call addWaterUpdateCandidate after setBlock
                    if (r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                         addWaterUpdateCandidate(c, r); // Queue the changed block itself
                         addWaterUpdateCandidate(c, r - 1); // And neighbors
                         addWaterUpdateCandidate(c, r + 1);
                         addWaterUpdateCandidate(c - 1, r);
                         addWaterUpdateCandidate(c + 1, r);
                         waterPropagationTimer = 0; // Reset timer
                    }
                }
            }
        }
    }
     console.log(`World aging complete. ${changesCount} blocks changed.`);
    console.timeEnd(`World aging with intensity ${intensityFactor.toFixed(2)}`);

    // After aging, re-seed the water queue to ensure flow simulation corrects any new water/air blocks
    // seedWaterUpdateQueue(); // Already done by queuing individual changes above.
}

// Sets a player-placed block - assumes validity checks (range, clear, neighbor) are done by the caller (Player class).
export function placePlayerBlock(col, row, blockType) {
    // Use the WorldData.setBlock function, marking it as player placed.
    // WorldData.setBlock calls createBlock internally.
    const success = WorldData.setBlock(col, row, blockType, true); // Set isPlayerPlaced = true

    if (success) {
        // Update the static visual cache
        updateStaticWorldAt(col, row);

        // Trigger Water Simulation Update if below Waterline ---
        if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
             addWaterUpdateCandidate(col, row); // Queue the changed block itself
             addWaterUpdateCandidate(col, row - 1); // And neighbors
             addWaterUpdateCandidate(col, row + 1);
             addWaterUpdateCandidate(col - 1, row);
             addWaterUpdateCandidate(col + 1, row);
             waterPropagationTimer = 0; // Reset timer
        }
    }
    return success;
}
// Applies damage to a block at the given coordinates. If block HP drops to 0, it's replaced with air and drops an item.
export function damageBlock(col, row, damageAmount) {
    if (damageAmount <= 0) return false; // No damage dealt
    const block = WorldData.getBlock(col, row);
    // Check if block is valid, breakable, and not already air/water/out of bounds
    // Also check if it's an object to avoid errors accessing block.hp
    if (!block || typeof block !== 'object' || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || !block.hasOwnProperty('hp') || block.hp === Infinity) {
        return false;
    }
    // Apply damage
    block.hp -= damageAmount;
    // --- Update the visual state of the block on the static canvas ---
    // This redraws the block with the potentially new damage indicator.
    updateStaticWorldAt(col, row);
    let wasDestroyed = false;
    // Check for destruction
    if (block.hp <= 0) {
        wasDestroyed = true;
        // Ensure health doesn't go below zero in data
        block.hp = 0;
        // Determine Drop Type
        let dropType = null;
        switch (block.type) { // Use the current type from the object
            case Config.BLOCK_GRASS: dropType = 'dirt'; break;
            case Config.BLOCK_DIRT:  dropType = 'dirt'; break;
            case Config.BLOCK_STONE: dropType = 'stone'; break;
            case Config.BLOCK_SAND:  dropType = 'sand'; break;
            case Config.BLOCK_WOOD: dropType = 'wood'; break;
             case Config.BLOCK_BONE: dropType = 'bone'; break;
             case Config.BLOCK_METAL: dropType = 'metal'; break;
             // Add cases for other block types that drop items
        }
        // --- Spawn Item Drop (if any) ---
        if (dropType) {
            // position slightly off-center and random within the block bounds
            const dropX = col * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2);
            const dropY = row * Config.BLOCK_HEIGHT + (Config.BLOCK_HEIGHT / 2);
            const offsetX = (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.4; // random offset
            const offsetY = (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.4;
            // Ensure dropX and dropY are valid numbers before spawning
             if (!isNaN(dropX) && !isNaN(dropY) && typeof dropX === 'number' && typeof dropY === 'number') {
                 ItemManager.spawnItem(dropX + offsetX, dropY + offsetY, dropType);
                 // console.log(` > Spawning ${dropType} at ~${(dropX + offsetX).toFixed(1)}, ${(dropY + offsetY).toFixed(1)}`); // Keep logs quieter
             } else {
                 console.error(`>>> ITEM SPAWN FAILED: Invalid drop coordinates [${dropX}, ${dropY}] for ${dropType} from destroyed block at [${col}, ${row}].`);
             }
        }
        // --- Replace Block with Air ---
        // Use WorldData.setBlock to change the block data. WorldData.setBlock calls createBlock internally.
        // Destroyed blocks are naturally occurring or player placed. Keep the playerPlaced status.
        const isPlayerPlaced = typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false;
        const success = WorldData.setBlock(col, row, Config.BLOCK_AIR, isPlayerPlaced); // Pass original isPlayerPlaced status
        if (success) { // success means WorldData.setBlock returned true
            // Update the static visual cache (clears the block area)
            updateStaticWorldAt(col, row);
            // Trigger Water Simulation Update
             if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                 addWaterUpdateCandidate(col, row); // queue changed block itself
                 addWaterUpdateCandidate(col, row - 1); // and neighbors
                 addWaterUpdateCandidate(col, row + 1);
                 addWaterUpdateCandidate(col - 1, row);
                 addWaterUpdateCandidate(col + 1, row);
                 waterPropagationTimer = 0; // Reset timer
             }
        }

    } else {
         // Block damaged but not destroyed: updateStaticWorldAt was already called above
         // to redraw the block with the damage indicator. No further action needed here.
    }
    // Damage was applied, regardless of destruction
    return true;
}

// --- Draw the pre-rendered static world onto main canvas ---
export function draw(ctx) {
    if (!ctx) { console.error("WorldManager.draw: No drawing context provided!"); return; }

    const gridCanvas = Renderer.getGridCanvas();

    if (gridCanvas) { // Draw the entire off-screen canvas containing the pre-rendered static world
        ctx.drawImage(gridCanvas, 0, 0);
    } else {
        console.error("WorldManager.draw: Cannot draw world, grid canvas is not available!");
    }
}

// --- Update World Effects - handles dynamic world state like water flow ---
export function update(dt) {
    // Water flow happens in all states
    // Update water simulation timer
         // Ensure timer doesn't go massively negative if frame rate is very low
         waterPropagationTimer = Math.max(0, waterPropagationTimer - dt);
         // console.log(`[WaterMgr.Update] dt: ${dt.toFixed(4)}, Timer: ${waterPropagationTimer.toFixed(4)}, Queue: ${waterUpdateQueue.size}`);
    // Only process water flow if the timer is ready and there are candidates
        if (waterPropagationTimer <= 0 && waterUpdateQueue.size > 0) {
            waterPropagationTimer = Config.WATER_PROPAGATION_DELAY; // Reset timer

    // Get and process a limited number of candidates from the queue
    // Convert Map values to an array to slice
            const candidatesToProcess = Array.from(waterUpdateQueue.values()).slice(0, Config.WATER_UPDATES_PER_FRAME);
            // Sort candidates to process cells in lower rows (higher 'r' value) first.
            candidatesToProcess.sort((a, b) => b.r - a.r);
            // Remove processed candidates from the queue *before* processing the batch
            // This prevents infinite re-queuing within the same batch update.
            candidatesToProcess.forEach(({c, r}) => {
                const key = `${c},${r}`;
                waterUpdateQueue.delete(key);
            });
            // Process the batch of candidates
            candidatesToProcess.forEach(({c, r}) => {
                 // Re-check bounds, as things might have changed since it was queued (e.e. block placed/destroyed)
                if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) return;
                const currentBlockType = WorldData.getBlockType(c, r);
                // --- Water Propagation: Add Neighbors below waterline that are WATER or AIR to the queue ---
                // This ensures both AIR (can become water) and WATER (can spread water) are queued.
                // NOTE: The order of adding neighbors here (down, up, right, left) doesn't directly
                // control the *processing* order *within* the current batch, but it *does* affect
                // the order they *might* be added to the queue for *future* batches.
                // The sorting step above controls the *processing* order of the current batch.
                const neighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // Cardinal neighbors
                neighbors.forEach(neighbor => {
                     const nc = c + neighbor.dc;
                     const nr = r + neighbor.dr;
                     // Queue neighbor if it's within bounds, AT or below waterline, and IS WATER or AIR.
                     // The addWaterUpdateCandidate function handles the specific type check (non-solid ground) and queue check.
                     // Also important: addWaterUpdateCandidate already checks if nr >= Config.WORLD_WATER_LEVEL_ROW_TARGET
                     addWaterUpdateCandidate(nc, nr); // Call addWaterUpdateCandidate for valid neighbors
                });
                // --- Water Filling: If the candidate is AIR, check if it should BECOME water ---
                // Only process filling if the current cell is still AIR.
                if (currentBlockType === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                    // Check current neighbors for water source *right now* in WorldData
                    let adjacentToWater = false;
                    // To prioritize downward filling, we could specifically check the neighbor ABOVE first
                    // and ONLY fill if there is water ABOVE it, OR if there is water adjacent AND the cell below is solid/water.
                    // For a simple bias, just checking *any* adjacent water is okay, but the sorting helps ensure
                    // that lower air blocks next to water are processed earlier in the *next* batch.
                    const immediateNeighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // Cardinal neighbors again
                     for (const neighbor of immediateNeighbors) {
                        const nc = c + neighbor.dc;
                        const nr = r + neighbor.dr;
                        // Check if neighbor is within bounds and is WATER
                        if (nc >= 0 && nc < Config.GRID_COLS && nr >= 0 && nr < Config.GRID_ROWS && WorldData.getBlockType(nc, nr) === Config.BLOCK_WATER) { // Use WorldData's function directly
                            adjacentToWater = true;
                            // --> DEBUG LOG: Adjacent to Water Found <--
                            // console.log(`[WaterProc] [${c}, ${r}] (AIR) adjacent to WATER at [${nc}, ${nr}]`);
                            break; // Found water neighbor
                        }
                    }
                    if (adjacentToWater) {
                        // console.log(`[WaterFill] Filling [${c}, ${r}]`);
                        // Set to WATER. WorldData.setBlock updates data, updateStaticWorldAt updates visuals.
                        // internalSetBlock handles this, but we are not calling it here.
                        // So we need to call WorldData.setBlock and updateStaticWorldAt explicitly.
                         const success = WorldData.setBlock(c, r, Config.BLOCK_WATER, false); // Water is not player-placed
                         if (success) {
                            updateStaticWorldAt(c, r);
                             // Queue neighbors for water spread
                             addWaterUpdateCandidate(c, r-1); // Queue above (can become water)
                             addWaterUpdateCandidate(c, r+1); // Queue below (can become water)
                             addWaterUpdateCandidate(c-1, r); // Queue left
                             addWaterUpdateCandidate(c+1, r); // Queue right
                             waterPropagationTimer = 0; // Reset timer
                         }
                    }
                }
                // --- Logic for WATER to propagate (from water blocks) ---
                // If the candidate *was* water (and hasn't become air this batch)
                 if (currentBlockType === Config.BLOCK_WATER) {
                    // If there is AIR directly below this water block, queue that AIR block.
                    // Processing water from bottom-up due to sorting helps ensure this check
                    // queues air below which will then be processed sooner in the *next* batch.
                    const blockBelowType = WorldData.getBlockType(c, r + 1);
                    if (blockBelowType === Config.BLOCK_AIR) {
                         addWaterUpdateCandidate(c, r + 1); // Queue the air block below!
                         // console.log(`[WaterQueueBelow] Queueing [${c}, ${r+1}] from [${c}, ${r}]`);
                    }
                    // Check for sideways flow over solid ground: if block below is solid OR water AND side block is air
                    // First, check the block directly below this water cell.
                    const blockBelow = WorldData.getBlock(c, r + 1);
                    const blockBelowResolvedType = blockBelow?.type ?? Config.BLOCK_AIR; // Use resolved type, handle null/0

                    // Is the block below something that would act as a "floor" for sideways flow?
                    // This means it's NOT air AND it exists (not null).
                    const isBelowSolidOrWater = blockBelow !== null && (blockBelowResolvedType !== Config.BLOCK_AIR);

                    if (isBelowSolidOrWater) {
                        // If there's solid ground or water directly below, water can try to flow sideways.
                        // Check left
                        if (WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR) {
                            addWaterUpdateCandidate(c - 1, r); // Queue the air block to the left
                             // --> DEBUG LOG: Queueing Sideways Left <--
                             // console.log(`[WaterQueueSide] Queueing [${c-1}, ${r}] from [${c}, ${r}]`);
                        }
                        // Check right
                        if (WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR) {
                            addWaterUpdateCandidate(c + 1, r); // Queue the air block to the right
                             // --> DEBUG LOG: Queueing Sideways Right <--
                             // console.log(`[WaterQueueSide] Queueing [${c+1}, ${r}] from [${c}, ${r}]`);
                        }
                    }
                }
                // Solid candidates and water candidates (after adding neighbors) are just finished.
                // They served their purpose by potentially adding neighbors to the queue for the NEXT step.
            });
        } else if (waterPropagationTimer <= 0 && waterUpdateQueue.size === 0) {
           // console.log("[WaterMgr] Water update timer ready, but queue is empty.");
        } else if (waterPropagationTimer > 0) {
           // console.log(`[WaterMgr] Water update timer active: ${waterPropagationTimer.toFixed(2)}s remaining.`);
        }
    }