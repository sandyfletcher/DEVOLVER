// -----------------------------------------------------------------------------
// root/js/player.js - Player Character Class
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js'; // Import GridCollision for physics and solid checks
import { hasSolidNeighbor } from './utils/gridCollision.js'; // Import the moved helper
import * as WorldManager from './worldManager.js';
import * as WorldData from './utils/worldData.js';
import * as AudioManager from './audioManager.js'; // Import AudioManager

export class Player {
    constructor(x, y, width, height, color) {
        // Initialize all properties with default or starting values
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        // Physics state (velocity)
        this.vx = 0; // Velocity in pixels per second
        this.vy = 0; // Velocity in pixels per second
        this.isOnGround = false;
        this.isInWater = false;
        this.waterJumpCooldown = 0; // Cooldown timer for water jumps/strokes
        // --- Weapon & Inventory State ---
        this.hasShovel = false;
        this.hasSword = false;
        this.hasSpear = false;
        this.selectedItem = Config.WEAPON_TYPE_UNARMED; // Start unarmed
        this.inventory = {}; // Stores counts of materials: { 'dirt': 10, 'stone': 5 }
        this.placementCooldown = 0; // Timer for delaying consecutive block placements
        // --- Combat State ---
        this.isAttacking = false;    // Is the attack animation/hitbox active? (Controlled by attackTimer now)
        this.attackTimer = 0;        // Duration timer for the current attack
        this.attackCooldown = 0;     // Cooldown timer until the next weapon attack is possible
        this.hitEnemiesThisSwing = []; // Tracks enemies hit during the current attack swing
        this.hitBlocksThisSwing = [];  // Tracks blocks hit during the current attack swing ("col,row" keys)
        // --- Health State ---
        this.maxHealth = Config.PLAYER_MAX_HEALTH_DISPLAY; // Max health for UI display
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH; // Starting health
        this.isInvulnerable = false; // Is the player currently immune to damage?
        this.invulnerabilityTimer = 0; // Timer for invulnerability duration
        // --- Targeting State ---
        this.targetWorldPos = { x: 0, y: 0 }; // Mouse position in world coordinates
        this.targetGridCell = { col: 0, row: 0 }; // Grid cell the mouse is over
        this.lastDirection = 1; // Facing direction (1 for right, -1 for left), used as fallback for aiming
        // NEW: Store last valid target positions/cells for fallback
        this._lastValidTargetWorldPos = null;
        this._lastValidTargetGridCell = null;

        // --- Animation State ---
        this.isDying = false; // New flag: Is the death animation playing?
        this.deathAnimationTimer = 0; // Timer for the death animation duration
        this.deathAnimationFrame = 0; // For discrete spin animation steps


        // Player is active by default at start
        this.isActive = true;


        // Initial position validation
         if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Player CONSTRUCTOR ERROR: NaN initial coordinates! Resetting to center.`);
             this.x = Config.CANVAS_WIDTH / 2 - this.width/2;
             this.y = Config.CANVAS_HEIGHT / 2 - this.height/2;
         }
    }

    /**
     * Updates the player's state based on input, physics, and environment interactions.
     * This method orchestrates the update process by calling private helper methods.
     * @param {number} dt - Delta time (time elapsed since last frame in seconds).
     * @param {object} inputState - Current input state (left, right, jump, attack flags).
     * @param {object} targetWorldPos - Current mouse position in world coordinates {x, y}.
     * @param {object} targetGridCell - Current grid cell under mouse {col, row}.
     */
    update(dt, inputState, targetWorldPos, targetGridCell) {
         // If player is currently dying or inactive, only update the death timer.
         if (this.isDying) {
             // Ensure dt is valid for timer update
             if (typeof dt !== 'number' || isNaN(dt) || dt < 0) {
                  console.warn("Player Update: Invalid delta time during dying.", dt);
                  // If dt is bad and timer is already done, force inactive
                  if (this.deathAnimationTimer <= 0) {
                       this.isActive = false;
                       this.isDying = false;
                       this.deathAnimationFrame = 0;
                  }
                  return; // Skip other updates if dt is bad while dying
             }

             this.deathAnimationTimer -= dt; // Decrement death timer

             // Calculate spin frame based on time elapsed in the spin phase
             const totalAnimationDuration = Config.PLAYER_DEATH_ANIMATION_DURATION;
             const spinDuration = Config.PLAYER_SPIN_DURATION;
             const timeElapsedInAnimation = totalAnimationDuration - this.deathAnimationTimer;


             if (timeElapsedInAnimation >= 0 && timeElapsedInAnimation < spinDuration) { // Still in the spin phase
                 const totalSpinTime = spinDuration;
                 const timePerFrame = totalSpinTime / Config.PLAYER_SPIN_FRAMES;
                 this.deathAnimationFrame = Math.min(
                     Config.PLAYER_SPIN_FRAMES - 1, // Clamp to max frame index (0 to N-1)
                     Math.floor(timeElapsedInAnimation / timePerFrame)
                 );
                 // Optional: Play spin sound effect on frame change? Requires tracking previous frame.
                 // if (this.deathAnimationFrame !== lastAnimationFrame) AudioManager.playSound(...)
             } else {
                // After spin, frame is 0 (or irrelevant)
                this.deathAnimationFrame = 0; // Reset frame visual state
             }

            if (this.deathAnimationTimer <= 0) {
                // Animation is finished, mark as inactive for removal
                this.isActive = false; // This is the flag main.js checks for Game Over
                this.isDying = false; // Clear dying flag
                this.deathAnimationFrame = 0; // Reset frame
                // console.log("[Player] Death animation finished. Marking inactive.");
            }
            // Stop any other updates while dying
            return;
        }

        // --- Normal Active Update Logic (Only if NOT dying) ---
        // This block only runs if !this.isDying and !this.isActive initially (which shouldn't happen if logic is correct)

        // Ensure dt is valid
        if (typeof dt !== 'number' || isNaN(dt) || dt < 0) {
            console.warn("Player Update: Invalid delta time.", dt);
             if (this.currentHealth <= 0 && !this.isDying && this.isActive) { // If health is zero but somehow not dying, force die
                 this.die(); // This will set isDying = true and prevent further normal update
             }
            return; // Exit if dt is bad and not dying
        }

        // --- Update Targeting ---
         // Ensure target positions are valid objects with numbers
        if (typeof targetWorldPos !== 'object' || targetWorldPos === null || typeof targetWorldPos.x !== 'number' || typeof targetWorldPos.y !== 'number' || isNaN(targetWorldPos.x) || isNaN(targetWorldPos.y)) {
             console.warn("Player Update: Invalid targetWorldPos object.", targetWorldPos);
             // Fallback: use last known position or position slightly in front of player
             this.targetWorldPos = this._lastValidTargetWorldPos || { x: this.x + this.width / 2 + this.lastDirection * 50, y: this.y + this.height / 2 };
         } else {
              this.targetWorldPos = targetWorldPos;
              this._lastValidTargetWorldPos = { ...targetWorldPos }; // Store valid position
         }
         if (typeof targetGridCell !== 'object' || targetGridCell === null || typeof targetGridCell.col !== 'number' || typeof targetGridCell.row !== 'number' || isNaN(targetGridCell.col) || isNaN(targetGridCell.row)) {
             console.warn("Player Update: Invalid targetGridCell object.", targetGridCell);
             // Fallback: calculate from valid world pos
             this.targetGridCell = GridCollision.worldToGridCoords(this.targetWorldPos.x, this.targetWorldPos.y);
             this._lastValidTargetGridCell = { ...this.targetGridCell }; // Store valid cell
         } else {
             this.targetGridCell = targetGridCell;
             this._lastValidTargetGridCell = { ...targetGridCell }; // Store valid cell
         }

        // Update Player Facing Direction based on Target Position relative to player center
        const playerCenterX = this.x + this.width / 2;
        const targetDeltaX = this.targetWorldPos.x - playerCenterX;
        // Only update direction if the target isn't extremely close horizontally to avoid rapid flipping
        if (Math.abs(targetDeltaX) > 1) { // Use a small threshold
             this.lastDirection = Math.sign(targetDeltaX);
        }

        // Update environment state (water)
        this.isInWater = GridCollision.isEntityInWater(this);
        // Reset water jump cooldown if just exited water (for non-swimmers)
        if (!this.isInWater && this.waterJumpCooldown > 0) {
            this.waterJumpCooldown = 0;
        }

        // Update timers (attack, invulnerability, water jump, placement cooldown)
        this._updateTimers(dt);

        // Handle Player Input (movement, jump, attack, placement)
        // Pass input state *only* if player is active and not dying.
        const activeInputState = this.isActive && !this.isDying ? inputState : {};
        this._handleInput(dt, activeInputState);

        // Apply Physics (gravity, damping, velocity calculation, collision resolution)
        this._applyPhysics(dt);

        // Check Screen Boundaries and Falling Out
        this._checkBoundaries();

        // Ensure health doesn't go negative
        this.currentHealth = Math.max(0, this.currentHealth);

        // --- Game Over Check (Moved to main.js) ---
        // The check for this.currentHealth <= 0 leading to game over
        // is now primarily handled in main.js's gameLoop, which calls this.die() first
        // if health drops, transitioning to the dying state.
        // main.js then checks !this.isActive to trigger the final game over screen.
    }

    // --- Private Update Helper Methods ---

    /** Updates various timers for cooldowns and effects. */
    _updateTimers(dt) {
        // Decrement cooldowns, ensure they don't go negative
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.attackCooldown < 0) this.attackCooldown = 0;
        if (this.waterJumpCooldown > 0) this.waterJumpCooldown -= dt;
        if (this.waterJumpCooldown < 0) this.waterJumpCooldown = 0;
        //  Decrement placement cooldown
        if (this.placementCooldown > 0) this.placementCooldown -= dt;
        if (this.placementCooldown < 0) this.placementCooldown = 0;
        // Update attack duration timer and related state
        if (this.isAttacking) { // Only count down if an attack is active
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) { // Attack duration ended
                this.isAttacking = false;
                this.hitEnemiesThisSwing = []; // Clear hit targets for the next swing
                this.hitBlocksThisSwing = [];
            }
        }
        // Update invulnerability timer
        if (this.isInvulnerable) {
            this.invulnerabilityTimer -= dt;
            if (this.invulnerabilityTimer <= 0) { // Invulnerability ended
                this.isInvulnerable = false;
            }
        }
    }

    /** Handles player input and sets desired movement/action flags/velocities. */
    _handleInput(dt, inputState) { // dt is now passed for placement cooldown
        // This method now assumes inputState only contains active inputs
        // (handled by the caller in update if player is dying)

        this._handleMovement(dt, inputState); // Movement & Jump/Swim Stroke handled here

        // --- Handle Attack / Use Input (Activated by inputState.attack being true) ---
        // This logic now handles both weapon attacks and block placement based on the selected item.
        // It triggers repeatedly as long as inputState.attack is true and respective cooldowns are ready.
        if (inputState.attack) {
            if (this.isMaterialSelected()) {
                 // If a material is selected, attempt to place a block continuously while 'attack' is held
                 this._handlePlacementHold(); // Call the new method for placement (dt is handled by internal cooldown)
            } else if (this.isWeaponSelected()) {
                 // If a weapon is selected, attempt to START an attack if not on cooldown and not already attacking
                 // The attack duration is handled by attackTimer, and the cooldown by attackCooldown.
                 // We only *initiate* the attack here if the input is held AND cooldown is ready.
                 if (this.attackCooldown <= 0 && !this.isAttacking) {
                      this.isAttacking = true; // Start the attack state
                      this.hitEnemiesThisSwing = []; // Reset hit lists for this swing
                      this.hitBlocksThisSwing = [];

                      // Set attack duration and cooldown based on the equipped weapon type
                      switch (this.selectedItem) {
                          case Config.WEAPON_TYPE_SWORD:
                              this.attackTimer = Config.PLAYER_SWORD_ATTACK_DURATION;
                              this.attackCooldown = Config.PLAYER_SWORD_ATTACK_COOLDOWN;
                              break;
                          case Config.WEAPON_TYPE_SPEAR:
                              this.attackTimer = Config.PLAYER_SPEAR_ATTACK_DURATION;
                              this.attackCooldown = Config.PLAYER_SPEAR_ATTACK_COOLDOWN;
                              break;
                          case Config.WEAPON_TYPE_SHOVEL:
                              this.attackTimer = Config.PLAYER_SHOVEL_ATTACK_DURATION;
                              this.attackCooldown = Config.PLAYER_SHOVEL_ATTACK_COOLDOWN;
                              break;
                          default:
                              // Fallback
                              this.attackTimer = 0.1;
                              this.attackCooldown = 0.2;
                              break;
                      }
                      // IMPORTANT: We do NOT set inputState.attack = false here.
                      // The input state should reflect the button being held.
                 }
            }
             // If inputState.attack is true but neither material nor weapon is selected,
             // or if weapon is selected but on cooldown/already attacking, nothing happens,
             // but inputState.attack remains true. This is correct.
        }
         // If inputState.attack is false, no attack/placement attempt occurs this frame from this block.
    }

    // Handles horizontal movement and jumping/water stroke
    _handleMovement(dt, inputState) {
        // Horizontal Movement
        let targetVx = 0;
        if (inputState.left) targetVx -= Config.PLAYER_MAX_SPEED_X;
        if (inputState.right) targetVx += Config.PLAYER_MAX_SPEED_X;

        // Apply acceleration and damping
        if (targetVx !== 0) {
             // Accelerate towards target speed
             // Check if currently in water (affects acceleration)
             const acceleration = this.isInWater ? Config.PLAYER_MOVE_ACCELERATION * Config.WATER_ACCELERATION_FACTOR : Config.PLAYER_MOVE_ACCELERATION;
             this.vx += Math.sign(targetVx) * acceleration * dt;
             // Clamp velocity to max speed (considering water speed factor if applicable)
             const currentMaxSpeedX = this.isInWater ? Config.PLAYER_MAX_SPEED_X * Config.WATER_MAX_SPEED_FACTOR : Config.PLAYER_MAX_SPEED_X;
             this.vx = Math.max(-currentMaxSpeedX, Math.min(currentMaxSpeedX, this.vx));

             // Optional: Apply friction if changing direction or overshooting target speed
             if (Math.sign(this.vx) !== Math.sign(targetVx) && targetVx !== 0) {
                  // Braking friction when changing direction
                  const brakingFactor = this.isInWater ? Math.pow(0.9, dt) : Math.pow(Config.PLAYER_FRICTION_BASE * 10, dt); // Stronger braking friction
                  this.vx *= brakingFactor;
             }

        } else {
            // Apply friction when no input is given (slowing down)
             const frictionFactor = this.isInWater ? Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt) : Math.pow(Config.PLAYER_FRICTION_BASE, dt); // Water vs air friction
             this.vx *= frictionFactor;
             // Snap to zero if velocity is very small to prevent infinite sliding
             if (Math.abs(this.vx) < GridCollision.E_EPSILON) {
                 this.vx = 0;
             }
        }

        // Jump / Water Stroke
        // Only allow jump/stroke if jump input is true AND cooldown is ready
        // Water stroke is a separate check from isOnGround because it doesn't require being on ground.
        if (inputState.jump && this.waterJumpCooldown <= 0) {
            if (this.isInWater) { // Perform water stroke if in water
                 this.vy = -Config.WATER_SWIM_VELOCITY; // Apply upward velocity
                 this.waterJumpCooldown = Config.WATER_JUMP_COOLDOWN_DURATION; // Start cooldown
                 this.isOnGround = false; // Ensure not marked as on ground during water stroke
            } else if (this.isOnGround) { // Perform ground jump if on ground and not in water
                this.vy = -Config.PLAYER_JUMP_VELOCITY; // Apply upward velocity
                this.isOnGround = false; // Player is now airborne
                 // Ground jumps don't use waterJumpCooldown, they just require isOnGround
            }
             // If inputState.jump is true but neither in water nor on ground, nothing happens (no double jump etc.)
        }
    } // END UNCOMMENTED METHOD


    /**
     * Handles continuous block placement when the 'attack' input is held AND a material is selected.
     * Attempts to place a block if the placement cooldown is ready.
     */
    _handlePlacementHold() {
        // This method is called when inputState.attack is true and a material is selected.
        // The placementCooldown is decremented in _updateTimers.
        // Check if cooldown is ready for another placement attempt
        if (this.placementCooldown <= 0) {
            const materialType = this.selectedItem; // Get the selected material (already confirmed isMaterialSelected in _handleInput)

            // Check if player has the material in inventory
            if ((this.inventory[materialType] || 0) > 0) {
                // Check if the target location is within interaction range
                const targetForPlacement = this.targetWorldPos || this._lastValidTargetWorldPos;
                if (!targetForPlacement || !this._isTargetWithinRange(targetForPlacement)) {
                     // console.log("Placement failed: Target out of range.");
                     return; // Out of range
                }

                // Check if the target grid cell is valid for placement
                 // Use the stored lastValidTargetGridCell if targetGridCell is bad
                const targetCellForPlacement = this.targetGridCell || this._lastValidTargetGridCell;
                if (!targetCellForPlacement || typeof targetCellForPlacement.col !== 'number' || typeof targetCellForPlacement.row !== 'number' || isNaN(targetCellForPlacement.col) || isNaN(targetCellForPlacement.row)) {
                     console.warn("Placement failed: Invalid target grid cell.");
                     return; // Invalid target cell
                }

                const targetCol = targetCellForPlacement.col;
                const targetRow = targetCellForPlacement.row;
                const targetBlockType = WorldData.getBlockType(targetCol, targetRow); // Handles out of bounds

                // Cannot place out of bounds (targetBlockType will be null)
                 if (targetBlockType === null) {
                     // console.log("Placement failed: Target out of bounds.");
                     return; // Out of bounds
                 }


                // Can place in Air, or in Water if config allows
                const canPlaceHere = targetBlockType === Config.BLOCK_AIR || (Config.CAN_PLACE_IN_WATER && targetBlockType === Config.BLOCK_WATER);

                if (canPlaceHere) {
                    // Check if placing the block would overlap the player
                    if (!this.checkPlacementOverlap(targetCol, targetRow)) {
                        // Check if the target cell has an adjacent solid block for support
                        if (GridCollision.hasSolidNeighbor(targetCol, targetRow)) { // Use imported GridCollision helper
                            // ALL CHECKS PASSED - PLACE THE BLOCK!
                            const blockTypeToPlace = Config.MATERIAL_TO_BLOCK_TYPE[materialType];
                            if (blockTypeToPlace !== undefined) { // Ensure material maps to a block type
                                // Attempt to place the block using WorldManager's player-specific method
                                // WorldManager.placePlayerBlock handles grid bounds internally and visual/water updates.
                                if (WorldManager.placePlayerBlock(targetCol, targetRow, blockTypeToPlace)) {
                                    this.decrementInventory(materialType); // Reduce inventory count
                                    // Placement successful, reset cooldown
                                    this.placementCooldown = Config.PLAYER_PLACEMENT_COOLDOWN;
                                    // console.log(`Placed ${materialType} at [${targetCol}, ${targetRow}]`);
                                } // else: Placement failed at the WorldManager level (e.g., already solid - unlikely after checks)
                            } else {
                                console.warn(`Placement failed: Material type "${materialType}" has no block type mapping.`);
                            }
                        } else {
                             // console.log("Placement failed: No adjacent support.");
                        }
                    } else {
                         // console.log("Placement failed: Overlaps player.");
                    }
                } else {
                     // console.log(`Placement failed: Target cell [${targetCol}, ${targetRow}] is not air or placeable water.`);
                }
            } // else: Not enough material handled by UI visibility/disabled state.
             // If checks fail, the cooldown is NOT reset, allowing the player to continue holding
             // and attempt placement again once conditions are met (e.g., move into range, collect material, cooldown ready).
        }
        // If placementCooldown > 0, the check `if (this.placementCooldown <= 0)` fails, and this block does nothing.
    }


    /** Applies gravity, damping, and resolves collisions with the grid. */
    _applyPhysics(dt) {
        const currentGravity = this.isInWater ? Config.GRAVITY_ACCELERATION * Config.WATER_GRAVITY_FACTOR : Config.GRAVITY_ACCELERATION;
        // Damping factors approach 0 as dt increases, causing velocity reduction. Factor of 1 means no damping.
        const verticalDampingFactor = this.isInWater ? Math.pow(Config.WATER_VERTICAL_DAMPING, dt) : 1;

        // --- Apply Gravity ---
        // Apply gravity if the player is not considered on the ground
        if (!this.isOnGround) { // Only apply gravity if not on ground from previous step
             this.vy += currentGravity * dt; // Add gravity acceleration
        } else {
             // If player is on ground but has slight downward velocity (e.g., from previous frame), reset it
            // Use a small threshold to avoid micro-adjustments
            if (this.vy > 0.1) this.vy = 0;
        }

        // --- Apply Vertical Damping & Clamp Speed in Water ---
        if (this.isInWater) {
            this.vy *= verticalDampingFactor; // Apply vertical drag
            // Clamp vertical speed while swimming/sinking
            this.vy = Math.max(this.vy, -Config.WATER_MAX_SWIM_UP_SPEED); // Limit upward speed
            this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED);   // Limit downward speed (sinking)
        } else {
            // Clamp maximum falling speed in air
            if (this.vy > Config.MAX_FALL_SPEED) {
                this.vy = Config.MAX_FALL_SPEED;
            }
        }

        // --- Calculate Potential Movement based on current velocities ---
        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;

        // --- Grid Collision Detection and Resolution ---
        // Use the utility function to handle collisions with the world grid
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);

        // Update ground status based on collision result
        this.isOnGround = collisionResult.isOnGround;

        // Zero out velocity component if a collision occurred on that axis, UNLESS stepped up horizontally
        if (collisionResult.collidedX && !collisionResult.didStepUp) {
             this.vx = 0;
             // entity.x is already snapped by collideAndResolve
        }
        // Only zero vy if a Y collision occurred and velocity was significant, prevents micro-bouncing
        // Use a small threshold (could be E_EPSILON or a slightly larger value like 0.1)
        if (collisionResult.collidedY && Math.abs(this.vy) > 0.1) {
             this.vy = 0;
             // entity.y is already snapped by collideAndResolve
        }

         // If player stepped up, adjust vertical position slightly if they ended up *just* above ground
         // This is a final check to ensure they land cleanly if the step-up put them slightly off the ground surface.
         if (collisionResult.didStepUp && !this.isOnGround) {
            const checkDist = 2.0; // Check a few pixels below
            const yBelow = this.y + this.height + checkDist;
            const rowBelow = Math.floor(yBelow / Config.BLOCK_HEIGHT);
            const colCheck = Math.floor((this.x + this.width/2) / Config.BLOCK_WIDTH); // Check center column
            // Check for solid ground right below the stepped-up position
            if (GridCollision.isSolid(colCheck, rowBelow)) {
                 // If player bottom is within checkDist of the potential ground surface
                 if ((this.y + this.height) < groundSurfaceY + checkDist) {
                     this.y = groundSurfaceY - this.height; // Snap down
                     this.isOnGround = true;
                     this.vy = 0; // Stop vertical movement after snapping
                     // console.log("Player snapped to ground after step-up."); // Debug log
                 }
            }
         }

    }

    /** Checks and enforces screen boundaries and falling out of world. */
    _checkBoundaries() {
        // Prevent moving outside the horizontal bounds of the world
        if (this.x < 0) {
            this.x = 0;
            if (this.vx < 0) this.vx = 0; // Stop velocity if hitting left edge
        }
        if (this.x + this.width > Config.CANVAS_WIDTH) {
            this.x = Config.CANVAS_WIDTH - this.width;
            if (this.vx > 0) this.vx = 0; // Stop velocity if hitting right edge
        }

        // --- Reset if Falling Out of World ---
        // If player falls too far below the screen, trigger death (now starts animation)
        if (this.y > Config.CANVAS_HEIGHT + 200) { // Check against a buffer below the canvas
            console.warn("Player fell out of world!");
            // Trigger death sequence when falling out
            this.die(); // Call die() to start the animation
        }
    }

    // --- Helper Methods ---

    /**
     * Checks if a target world position is within the player's interaction range.
     * Made this a private method as it's specific to the player instance.
     * @param {object} targetWorldPos - The target world position {x, y}.
     * @returns {boolean} True if target is within range.
     */
    _isTargetWithinRange(targetWorldPos) {
        if (!targetWorldPos) return false;
        // Ensure player position and target position are valid numbers
         if (typeof this.x !== 'number' || typeof this.y !== 'number' ||
             typeof this.width !== 'number' || typeof this.height !== 'number' ||
             typeof targetWorldPos.x !== 'number' || typeof targetWorldPos.y !== 'number' ||
             isNaN(this.x) || isNaN(this.y) || isNaN(this.width) || isNaN(this.height) ||
             isNaN(targetWorldPos.x) || isNaN(targetWorldPos.y)) {
              console.warn("_isTargetWithinRange: Invalid player or target data.", this, targetWorldPos);
              return false;
         }
        const playerCenterX = this.x + this.width / 2;
        const playerCenterY = this.y + this.height / 2;
        const dx = targetWorldPos.x - playerCenterX;
        const dy = targetWorldPos.y - playerCenterY;
        const distSq = dx * dx + dy * dy;
        // Compare squared distance to avoid square root calculation
        return distSq <= Config.PLAYER_INTERACTION_RANGE_SQ;
    }

    /** Checks if placing a block at target coordinates would overlap the player's bounding box. */
    checkPlacementOverlap(targetCol, targetRow) {
        // Check for invalid grid coordinates first
        if (targetCol < 0 || targetRow < 0 || targetCol >= Config.GRID_COLS || targetRow >= Config.GRID_ROWS) return true; // Overlap if placing out of bounds

        // Define the rectangle for the block to be placed
        const blockRect = {
            x: targetCol * Config.BLOCK_WIDTH,
            y: targetRow * Config.BLOCK_HEIGHT,
            width: Config.BLOCK_WIDTH,
            height: Config.BLOCK_HEIGHT
        };
        // Get the player's current rectangle
        const playerRect = this.getRect();

        // Standard Axis-Aligned Bounding Box (AABB) overlap check
        const overlap = playerRect.x < blockRect.x + blockRect.width &&
                        playerRect.x + playerRect.width > blockRect.x &&
                        playerRect.y < blockRect.y + blockRect.height &&
                        playerRect.y + playerRect.height > blockRect.y;
        return overlap; // Return true if overlapping, false otherwise
    }

    // --- Drawing Methods ---

    /**
     * Calculates information needed to draw the placement ghost block preview.
     * @returns {object | null} Object { col, row, color } or null if placement is invalid.
     */
    getGhostBlockInfo() {
        // Can only show ghost if a material is selected
        if (!this.isMaterialSelected()) return null;
        // Need valid target grid cell data (fall back to last valid if current is bad)
        const targetCell = this.targetGridCell || this._lastValidTargetGridCell;
        if (!targetCell || typeof targetCell.col !== 'number' || typeof targetCell.row !== 'number' || isNaN(targetCell.col) || isNaN(targetCell.row)) return null;

        const { col, row } = targetCell;

        // Perform the same checks as actual placement:
        // Use the stored lastValidTargetWorldPos if targetWorldPos is bad
        const targetWorldPosForCheck = this.targetWorldPos || this._lastValidTargetWorldPos;
        if (!targetWorldPosForCheck || !this._isTargetWithinRange(targetWorldPosForCheck)) return null; // Must be in range

        // Get the block type at the target cell, handling out of bounds
        const targetBlockType = WorldData.getBlockType(col, row);

        // Cannot place out of bounds (targetBlockType will be null)
        if (targetBlockType === null) return null;

        // Can place in Air, or in Water if config allows
        const canPlaceHere = targetBlockType === Config.BLOCK_AIR || (Config.CAN_PLACE_IN_WATER && targetBlockType === Config.BLOCK_WATER);
        if (!canPlaceHere) return null; // Target must be empty (or water if allowed)

        if (this.checkPlacementOverlap(col, row)) return null; // Cannot place overlapping player

        // Must have adjacent solid support
        if (!GridCollision.hasSolidNeighbor(col, row)) return null; // Use imported GridCollision helper

        // If all checks pass, determine the block type and color
        const materialType = this.selectedItem; // This is the material string
        const blockTypeToPlace = Config.MATERIAL_TO_BLOCK_TYPE[materialType]; // Map string to block constant
        if (blockTypeToPlace === undefined) return null; // Invalid material mapping

        const blockColor = Config.BLOCK_COLORS[blockTypeToPlace]; // Get color from block constant
        if (!blockColor) return null; // No color defined for this block type

        // Return information needed for drawing
        return { col: col, row: row, color: blockColor };
    }

    /**
     * Draws the player character, held weapon visual, and attack hitbox/ghost block if applicable.
     * @param {CanvasRenderingContext2D} ctx - The drawing context.
     */
    draw(ctx) {
        // Only draw if the player is active OR currently dying
        if (!this.isActive && !this.isDying || !ctx) return;

         // Ensure coordinates are valid before drawing
         if (isNaN(this.x) || isNaN(this.y)) {
              console.error(`>>> Player DRAW ERROR: Preventing draw due to NaN coordinates!`);
              return;
         }

        // --- Handle Dying Animation Drawing ---
        if (this.isDying) {
            ctx.save(); // Save context before transformations

            // Calculate pivot point (center of the entity)
            const pivotX = this.x + this.width / 2;
            const pivotY = this.y + this.height / 2;

            const timeElapsed = Config.PLAYER_DEATH_ANIMATION_DURATION - this.deathAnimationTimer;

            let currentScale = 1.0;
            let rotationAngle = 0; // Radians

            const spinDuration = Config.PLAYER_SPIN_DURATION;
            const totalAnimationDuration = Config.PLAYER_DEATH_ANIMATION_DURATION;
            const swellDuration = totalAnimationDuration - spinDuration; // Time dedicated to swelling after spin

            // Spin phase
            if (timeElapsed < spinDuration) {
                // Calculate rotation angle based on the current frame (0 to PLAYER_SPIN_FRAMES-1)
                // Each frame represents a step in rotation. Total 360 degrees / #frames.
                // Example: 6 frames -> 60 degrees per frame. Frame 0=0deg, 1=60deg, ..., 5=300deg.
                rotationAngle = (this.deathAnimationFrame / Config.PLAYER_SPIN_FRAMES) * 2 * Math.PI; // 360 degrees in radians

            } else if (swellDuration > 0 && timeElapsed < totalAnimationDuration) { // Swell phase (only if swell duration is > 0)
                 // Calculate time elapsed *within* the swell phase
                const swellElapsed = timeElapsed - spinDuration;

                 const swellProgress = swellElapsed / swellDuration; // 0 to <1

                 // Use enemy swell parameters for consistency
                 currentScale = 1.0 + (Config.ENEMY_SWELL_SCALE - 1.0) * swellProgress; // Lerp scale

                rotationAngle = 0; // Reset rotation during swell for simplicity
            } else {
                // After total animation duration, it should be gone.
                // The update loop should set isActive=false, preventing draw().
                // If we reach here with isDying=true but timeElapsed >= totalAnimationDuration, it's a fallback.
                // We should just not draw anything further.
                 ctx.restore(); // Restore context if saved
                 return; // Do not draw after animation duration
            }

            // Apply transformations: translate to pivot, rotate, scale, translate back
            ctx.translate(pivotX, pivotY);
            ctx.rotate(rotationAngle);
            ctx.scale(currentScale, currentScale);
            ctx.translate(-pivotX, -pivotY);

            // Draw the player rectangle
            // Handle invulnerability flashing (draw player only on even intervals)
            // Don't flash while dying. Draw the dying animation regardless of invulnerability state.
            ctx.fillStyle = this.color;
            // Note: fillRect needs the original x, y, width, height. Transformations handle the rest.
            ctx.fillRect(Math.floor(this.x), Math.floor(this.height), this.width, this.height);


            ctx.restore(); // Restore context
            return; // Drawing handled, exit
        }

        // --- Normal Active Drawing Logic (Only if NOT dying) ---
        // This block is only reached if !this.isDying

        // Handle invulnerability flashing (draw player only on even intervals)
        let shouldDrawPlayer = true;
        if (this.isInvulnerable) {
            // Simple flash effect: draw every other 100ms interval
            shouldDrawPlayer = Math.floor(performance.now() / 100) % 2 === 0;
        }

        // Draw Player Body
        if (shouldDrawPlayer) {
            ctx.fillStyle = this.color;
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);

            // Draw Held Weapon Visual
             // ... existing weapon visual drawing logic ...
             if (!this.isAttacking && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED) {
                 ctx.save(); // Save context state before transformations

                 const playerCenterX = this.x + this.width / 2;
                 const playerCenterY = this.y + this.height / 2;
                 let weaponConfig = Config.ITEM_CONFIG[this.selectedItem];
                 let visualOffsetX = 0; // Distance from player center to weapon visual pivot

                 // Determine offset based on weapon type (adjust as needed for visuals)
                 if (this.selectedItem === Config.WEAPON_TYPE_SWORD) visualOffsetX = this.width * 0.6;
                 else if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) visualOffsetX = this.width * 0.7;
                 else if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) visualOffsetX = this.width * 0.5;

                 if (weaponConfig) {
                     const weaponWidth = weaponConfig.width * 0.8; // Slightly smaller visual representation
                     const weaponHeight = weaponConfig.height * 0.8;
                     const weaponColor = weaponConfig.color;

                     // Calculate angle towards the target mouse position (using last valid target if current is bad)
                     const targetForDrawing = this.targetWorldPos || this._lastValidTargetWorldPos || {x: playerCenterX + this.lastDirection * 50, y: playerCenterY}; // Fallback if all target data is bad
                     const targetDeltaX = targetForDrawing.x - playerCenterX;
                     const targetDeltaY = targetForDrawing.y - playerCenterY;
                     const angle = Math.atan2(targetDeltaY, targetDeltaX); // Angle in radians

                     // Calculate position for the weapon visual based on angle and offset
                     const weaponPosX = playerCenterX + Math.cos(angle) * visualOffsetX;
                     const weaponPosY = playerCenterY + Math.sin(angle) * visualOffsetX; // Keep offset along the same axis

                     // Apply transformations: translate to position, rotate
                     ctx.translate(weaponPosX, weaponPosY);
                     ctx.rotate(angle); // Rotate context to point weapon towards target

                     // Draw the weapon centered at the new (0,0) relative origin
                     ctx.fillStyle = weaponColor;
                     ctx.fillRect(Math.floor(-weaponWidth / 2), Math.floor(-weaponHeight / 2), Math.ceil(weaponWidth), Math.ceil(weaponHeight));
                 }
                 ctx.restore(); // Restore context state (removes translation/rotation)
             }
        } // End if(shouldDrawPlayer)

        // Draw Attack Hitbox Visual
         // ... existing hitbox drawing logic ...
         if (this.isAttacking && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED) {
             const hitbox = this.getAttackHitbox(); // Calculate current hitbox position/size
             if (hitbox) {
                  // Ensure hitbox coordinates and dimensions are valid before drawing
                  if (typeof hitbox.x === 'number' && typeof hitbox.y === 'number' &&
                      typeof hitbox.width === 'number' && typeof hitbox.height === 'number' &&
                      !isNaN(hitbox.x) && !isNaN(hitbox.y) && !isNaN(hitbox.width) && !isNaN(hitbox.height))
                  {
                     // Determine hitbox color based on weapon
                     let hitboxColor = Config.PLAYER_SWORD_ATTACK_COLOR; // Default
                     if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) hitboxColor = Config.PLAYER_SPEAR_ATTACK_COLOR;
                     else if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) hitboxColor = Config.PLAYER_SHOVEL_ATTACK_COLOR;

                     // Draw the semi-transparent hitbox rectangle
                     ctx.fillStyle = hitboxColor;
                     ctx.fillRect(Math.floor(hitbox.x), Math.floor(hitbox.y), Math.ceil(hitbox.width), Math.ceil(hitbox.height));
                  } else {
                       console.warn(`Player.draw: Invalid hitbox coordinates/dimensions for ${this.selectedItem}`, hitbox);
                  }
             }
         }
        // Draw ghost block if material is selected and not dying
        // Note: Calling drawGhostBlock is handled in main.js now based on player state.
        // if (this.isMaterialSelected() && !this.isDying) { // Check isDying here too
        //    this.drawGhostBlock(ctx);
        // }
    }

    /**
     * Draws the semi-transparent ghost block preview if placement is valid.
     * @param {CanvasRenderingContext2D} ctx - The drawing context.
     */
    drawGhostBlock(ctx) {
        if (!ctx) return; // Don't draw if no context

        const ghostInfo = this.getGhostBlockInfo(); // Check if/where ghost should be drawn

        if (ghostInfo) {
            // Calculate pixel coordinates from grid coordinates
            const ghostX = ghostInfo.col * Config.BLOCK_WIDTH;
            const ghostY = ghostInfo.row * Config.BLOCK_HEIGHT;

             // Ensure ghost coordinates are valid before drawing
             if (typeof ghostX !== 'number' || typeof ghostY !== 'number' || isNaN(ghostX) || isNaN(ghostY)) {
                 console.warn("Player.drawGhostBlock: Invalid ghost coordinates.", ghostX, ghostY);
                 return;
             }

            ctx.save(); // Save context state before changing alpha

            // Set alpha and color for the ghost block
            ctx.globalAlpha = Config.GHOST_BLOCK_ALPHA; // Use config value for transparency
            ctx.fillStyle = ghostInfo.color;

            // Draw the semi-transparent rectangle
            ctx.fillRect(
                Math.floor(ghostX),
                Math.floor(ghostY),
                Math.ceil(Config.BLOCK_WIDTH),  // Use ceil for width/height for pixel snapping
                Math.ceil(Config.BLOCK_HEIGHT)
            );

            // Draw outline on the ghost block
            ctx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
            ctx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
            const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
            ctx.strokeRect(
                Math.floor(ghostX) + outlineInset,
                Math.floor(ghostY) + outlineInset,
                Math.ceil(Config.BLOCK_WIDTH) - Config.PLAYER_BLOCK_OUTLINE_THICKNESS,
                Math.ceil(Config.BLOCK_HEIGHT) - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
            );


            ctx.restore(); // Restore context state (resets globalAlpha)
        }
    }


    // --- Combat and Health Methods ---

    /**
     * Applies damage to the player, handles invulnerability, and triggers death.
     * @param {number} amount - The amount of damage to take.
     */
    takeDamage(amount) {
         // Ensure amount is a valid number
         if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
             // console.warn("Player takeDamage: Invalid damage amount.", amount); // Keep console less noisy
             return;
         }

        // Ignore damage if already invulnerable, dying, or already dead
        if (this.isInvulnerable || this.isDying || this.currentHealth <= 0) return;

        this.currentHealth -= amount;
        // console.log(`Player took ${amount} damage. Health: ${this.currentHealth}/${this.maxHealth}`);

        if (this.currentHealth <= 0) {
            this.currentHealth = 0; // Prevent negative health
            this.die(); // Trigger death sequence (now starts animation)
        } else {
            // Apply invulnerability period after taking damage
            this.isInvulnerable = true;
            this.invulnerabilityTimer = Config.PLAYER_INVULNERABILITY_DURATION;
        }
    }

    /** Handles the player's death state. */
    die() {
        // Prevent death animation from starting multiple times
        // Check isActive here too - if health dropped to 0 while inactive (shouldn't happen), don't start dying state
        if (!this.isActive || this.isDying) {
             // If health is 0 but not dying/inactive, somehow not dying, maybe force dying state?
             if (this.currentHealth <= 0 && !this.isActive && !this.isDying) {
                  console.warn("Player death requested but already inactive/dying. State:", {isActive: this.isActive, isDying: this.isDying, health: this.currentHealth});
             }
             return; // Already inactive or dying
        }

        console.log(">>> Player is dying! <<<");

        // Stop movement immediately
        this.vx = 0;
        this.vy = 0;
        this.isAttacking = false; // Cancel any active attack
        this.attackTimer = 0;
        this.placementCooldown = 0; // Cancel any pending placement

        // Set dying state and timer
        this.isDying = true;
        this.deathAnimationTimer = Config.PLAYER_DEATH_ANIMATION_DURATION;
        this.deathAnimationFrame = 0; // Start at frame 0 for the spin

        // Keep isActive = true *during* the animation so it's updated and drawn.
        // It will be set to false in update() when the timer expires.

        // Optional: Play player death sound effect here (maybe different sounds for spin and pop?)
        // AudioManager.playSound(Config.AUDIO_TRACKS.player_pop); // Or a general death sound
    }

    // Calculates the position and dimensions of the attack hitbox based on the equipped weapon and target direction.
    getAttackHitbox() {
        // Cannot have a hitbox if not attacking or not using a weapon OR if dying
        if (!this.isAttacking || !this.isWeaponSelected() || this.selectedItem === Config.WEAPON_TYPE_UNARMED || this.isDying) {
            return null;
        }
        // Player center coordinates
        const playerCenterX = this.x + this.width / 2;
        const playerCenterY = this.y + this.height / 2;
        // Target world coordinates (from mouse) - use last valid target if current is bad
        const targetForHitbox = this.targetWorldPos || this._lastValidTargetWorldPos || {x: playerCenterX + this.lastDirection * 50, y: playerCenterY}; // Fallback if all target data is bad
        const targetX = targetForHitbox.x;
        const targetY = targetForHitbox.y;

        // Vector from player center to target
        const dx = targetX - playerCenterX;
        const dy = targetY - playerCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy); // Distance to target

        // Get hitbox dimensions and reach offsets from config based on equipped weapon
        let hitboxWidth, hitboxHeight, reachX, reachY;
        switch (this.selectedItem) {
            case Config.WEAPON_TYPE_SWORD:
                hitboxWidth = Config.PLAYER_SWORD_ATTACK_WIDTH; hitboxHeight = Config.PLAYER_SWORD_ATTACK_HEIGHT;
                reachX = Config.PLAYER_SWORD_ATTACK_REACH_X; reachY = Config.PLAYER_SWORD_ATTACK_REACH_Y;
                break;
            case Config.WEAPON_TYPE_SPEAR:
                hitboxWidth = Config.PLAYER_SPEAR_ATTACK_WIDTH; hitboxHeight = Config.PLAYER_SPEAR_ATTACK_HEIGHT;
                reachX = Config.PLAYER_SPEAR_ATTACK_REACH_X; reachY = Config.PLAYER_SPEAR_ATTACK_REACH_Y;
                break;
            case Config.WEAPON_TYPE_SHOVEL:
                hitboxWidth = Config.PLAYER_SHOVEL_ATTACK_WIDTH; hitboxHeight = Config.PLAYER_SHOVEL_ATTACK_HEIGHT;
                reachX = Config.PLAYER_SHOVEL_ATTACK_REACH_X; reachY = Config.PLAYER_SHOVEL_ATTACK_REACH_Y;
                break;
            default: return null; // Should not happen if checks passed, but safety first
        }
        // Calculate hitbox center position
        let hitboxCenterX, hitboxCenterY;
        // Use a small epsilon for distance check to avoid division by zero or erratic behavior when mouse is exactly on player center
        const E_EPSILON = 1e-6; // Define locally or import if needed elsewhere
        if (dist > E_EPSILON) {
            const normX = dx / dist; // Normalized direction vector X component
            const normY = dy / dist; // Normalized direction vector Y component
            // Position hitbox center along the direction vector based on horizontal reach (reachX)
            hitboxCenterX = playerCenterX + normX * reachX;
            // Position hitbox center vertically based on the fixed vertical offset (reachY)
            hitboxCenterY = playerCenterY + reachY; // Keep offset along the same vertical axis
        } else {
            // Fallback: If target is too close, use last known facing direction for X, and fixed Y offset
            hitboxCenterX = playerCenterX + this.lastDirection * reachX;
            hitboxCenterY = playerCenterY + reachY;
        }
        // Calculate top-left corner of the hitbox from its center and dimensions
        const hitboxX = hitboxCenterX - hitboxWidth / 2;
        const hitboxY = hitboxCenterY - hitboxHeight / 2;

        // Ensure hitbox coordinates and dimensions are valid numbers before returning
        if (typeof hitboxX !== 'number' || typeof hitboxY !== 'number' ||
            typeof hitboxWidth !== 'number' || typeof hitboxHeight !== 'number' ||
            isNaN(hitboxX) || isNaN(hitboxY) || isNaN(hitboxWidth) || isNaN(hitboxHeight)) {
             console.warn("Player.getAttackHitbox: Calculated invalid hitbox, returning null.", {hitboxX, hitboxY, hitboxWidth, hitboxHeight, selectedItem: this.selectedItem});
             return null;
        }

        return { x: hitboxX, y: hitboxY, width: hitboxWidth, height: hitboxHeight };
    }

    // --- Collision Tracking Helpers ---
    /** Checks if a specific enemy has already been hit during the current attack swing. */
    hasHitEnemyThisSwing(enemy) { return this.hitEnemiesThisSwing.includes(enemy); }
    /** Registers an enemy as hit during the current swing to prevent multiple hits. */
    registerHitEnemy(enemy) { if (!this.hasHitEnemyThisSwing(enemy)) { this.hitEnemiesThisSwing.push(enemy); } }
    /** Checks if a specific block has already been hit during the current attack swing. */
    hasHitBlockThisSwing(col, row) { const blockKey = `${col},${row}`; return this.hitBlocksThisSwing.includes(blockKey); }
    /** Registers a block as hit during the current swing. */
    registerHitBlock(col, row) { const blockKey = `${col},${row}`; if (!this.hitBlocksThisSwing.includes(blockKey)) { this.hitBlocksThisSwing.push(blockKey); } }

    // --- Inventory & Item Methods ---

    // Handles picking up an item. Updates inventory or weapon possession state.
    pickupItem(item) {
        if (!item || !item.type) return false; // Invalid item
        let pickedUp = false;
        // Check item type and update player state accordingly
        if (item.type === Config.WEAPON_TYPE_SWORD) {
            if (!this.hasSword) { this.hasSword = true; /* console.log("Player picked up the sword!"); */ pickedUp = true; }
        } else if (item.type === Config.WEAPON_TYPE_SPEAR) {
            if (!this.hasSpear) { this.hasSpear = true; /* console.log("Player picked up the spear!"); */ pickedUp = true; }
        } else if (item.type === Config.WEAPON_TYPE_SHOVEL) {
            if (!this.hasShovel) { this.hasShovel = true; /* console.log("Player picked up the shovel!"); */ pickedUp = true; }
        } else if (Config.INVENTORY_MATERIALS.includes(item.type)) {
            // Add material to inventory, initializing count if necessary
            this.inventory[item.type] = (this.inventory[item.type] || 0) + 1;
            // console.log(`Player picked up ${item.type}. Count: ${this.inventory[item.type]}`);
            pickedUp = true;
        } else {
            console.warn(`Player encountered unknown item type: ${item.type}`);
        }
        // If a weapon was just picked up, equip it immediately ONLY if player is currently unarmed
        if (pickedUp && this.isWeaponType(item.type) && this.selectedItem === Config.WEAPON_TYPE_UNARMED) {
            this.equipItem(item.type); // Equip the newly picked up weapon TODO: should this be changed to equip after assembling a new weapon?
        }
        return pickedUp; // Return whether the item was processed
    }
    /** Checks if the player possesses a specific weapon type. */
    hasWeapon(weaponType) {
        switch (weaponType) {
            case Config.WEAPON_TYPE_SWORD: return this.hasSword;
            case Config.WEAPON_TYPE_SPEAR: return this.hasSpear;
            case Config.WEAPON_TYPE_SHOVEL: return this.hasShovel;
            default: return false; // Not a known weapon type
        }
    }
    /**
     * Equips an item (weapon or material) if the player possesses it / has stock.
     * @param {string} itemType - The type of item to equip.
     */
    equipItem(itemType) {
        // Allow equipping unarmed state anytime
        if (itemType === Config.WEAPON_TYPE_UNARMED) {
            // console.log("Player equipped unarmed.");
             this.selectedItem = Config.WEAPON_TYPE_UNARMED;
             this.isAttacking = false; // Cancel attack if unequipping
             this.attackTimer = 0;
             this.placementCooldown = 0; // Reset cooldown
            return true;
        }

        let canEquip = false;
        // Check if the item type is valid and if the player can equip it
        if (this.isWeaponType(itemType)) {
            canEquip = this.hasWeapon(itemType); // Check possession for weapons
        } else if (Config.INVENTORY_MATERIALS.includes(itemType)) {
            canEquip = (this.inventory[itemType] || 0) > 0; // Check inventory count for materials
        }

        // Equip the item if possible and not already equipped
        if (canEquip && this.selectedItem !== itemType) {
            this.selectedItem = itemType;
            // console.log(`Player equipped ${itemType}.`); // Optional log
            // Cancel current action states on equip
            this.isAttacking = false;
            this.attackTimer = 0;
            this.placementCooldown = 0; // Reset placement cooldown when switching items
             // UI update to show the new selection happens in the main loop via updatePlayerInfo
            return true;
        }
        // Return false if cannot equip (e.g., don't have it, or trying to equip something unknown)
        // console.log(`Cannot equip ${itemType}. Player possession/count check failed.`);
        return false;
    }

    /** Decrements the inventory count for a given material type. */
    decrementInventory(itemType, amount = 1) { // Added optional amount parameter
        if (Config.INVENTORY_MATERIALS.includes(itemType) && (this.inventory[itemType] || 0) >= amount) {
            this.inventory[itemType] -= amount;
            // console.log(`Decremented ${itemType} by ${amount}. New count: ${this.inventory[itemType]}.`);
            // If the count reaches 0 and this material was the selected item, switch to unarmed
            if (this.inventory[itemType] === 0 && this.selectedItem === itemType) {
                 this.equipItem(Config.WEAPON_TYPE_UNARMED); // Switch to unarmed
                 // console.log(`${itemType} depleted, switching to unarmed.`);
            }
            return true; // Decrement successful
        }
        // console.log(`Cannot decrement ${itemType} by ${amount}. Not enough stock or invalid type.`);
        return false; // Material not found, count too low, or invalid type
    }

        // NEW: Crafting Method
    /**
     * Attempts to craft a specific item if the player has the required materials.
     * @param {string} itemType - The type of item to craft (must be in CRAFTING_RECIPES).
     * @returns {boolean} True if crafting was successful, false otherwise.
     */
    craftItem(itemType) {
        // Ensure it's a craftable item type first
        const recipe = Config.CRAFTING_RECIPES[itemType];
        if (!recipe) {
            console.warn(`Attempted to craft non-craftable item type: ${itemType}`);
            return false; // Not a craftable item
        }

        // Ensure player doesn't already have the weapon (can't craft duplicates)
        // NOTE: This assumes weapons are unique items, not stackable.
        if (this.isWeaponType(itemType) && this.hasWeapon(itemType)) {
            // console.log(`Already possess ${itemType}. Cannot craft.`);
            return false; // Already have this weapon
        }


        // 1. Check if player has all required materials
        let hasMaterials = true;
        for (const ingredient of recipe) {
            const requiredType = ingredient.type;
            const requiredAmount = ingredient.amount;
            const possessedAmount = this.inventory[requiredType] || 0;

            if (possessedAmount < requiredAmount) {
                hasMaterials = false;
                // console.log(`Not enough ${requiredType}. Need ${requiredAmount}, have ${possessedAmount}.`);
                break; // Stop checking if one ingredient is missing
            }
        }

        if (!hasMaterials) {
            // console.log(`Cannot craft ${itemType}. Missing materials.`);
            return false; // Cannot craft - missing materials
        }

        // 2. Consume materials
        for (const ingredient of recipe) {
            // Use the decrementInventory method to remove materials
            if (!this.decrementInventory(ingredient.type, ingredient.amount)) {
                // This should ideally not happen if the check passed, but defensive programming
                console.error(`Failed to consume materials while crafting ${itemType}. Inventory state may be inconsistent.`);
                return false; // Crafting failed mid-process
            }
        }

        // 3. Grant the crafted item (for weapons, set possession flag)
        let craftedSuccessfully = false;
        switch (itemType) {
            case Config.WEAPON_TYPE_SWORD:
                this.hasSword = true;
                craftedSuccessfully = true;
                // console.log(`Crafted Sword!`);
                break;
            case Config.WEAPON_TYPE_SPEAR:
                this.hasSpear = true;
                craftedSuccessfully = true;
                // console.log(`Crafted Spear!`);
                break;
            // Add cases for other craftable items here (e.g., placeables like metal blocks if they were crafted)
            default:
                console.error(`Crafting logic for item type ${itemType} not implemented.`);
                return false; // Crafting logic missing
        }

        // 4. Return success status
        return craftedSuccessfully;
   }

    // --- State/Type Check Helpers ---
    /** Checks if an item type string corresponds to a known weapon type. */
    isWeaponType(itemType) {
         return [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL].includes(itemType);
    }
    /** Checks if the currently selected item is a weapon (and not unarmed). */
    isWeaponSelected() {
        return this.selectedItem !== Config.WEAPON_TYPE_UNARMED && this.isWeaponType(this.selectedItem);
    }
    /** Checks if the currently selected item is a placeable material. */
    isMaterialSelected() {
        return Config.INVENTORY_MATERIALS.includes(this.selectedItem);
    }
    // --- Getters for Player State and Properties ---
    getRect() {
         const safeX = (typeof this.x === 'number' && !isNaN(this.x)) ? this.x : 0;
         const safeY = (typeof this.y === 'number' && !isNaN(this.y)) ? this.y : 0;
         const safeWidth = (typeof this.width === 'number' && !isNaN(this.width)) ? this.width : 1;
         const safeHeight = (typeof this.height === 'number' && !isNaN(this.height)) ? this.height : 1;
         return { x: safeX, y: safeY, width: safeWidth, height: safeHeight };
    }
    getPosition() {
         const safeX = (typeof this.x === 'number' && !isNaN(this.x)) ? this.x : 0;
         const safeY = (typeof this.y === 'number' && !isNaN(this.y)) ? this.y : 0;
         return { x: safeX, y: safeY };
    }
    getCurrentHealth() { return this.currentHealth; }
    getMaxHealth() { return this.maxHealth; }
    getInventory() { return this.inventory; }
    getShovelStatus() { return this.hasShovel; }
    getSwordStatus() { return this.hasSword; }
    getSpearStatus() { return this.hasSpear; }
    getCurrentlySelectedItem() { return this.selectedItem; }

    /** Returns the selected material type if a material is selected, otherwise null. Used by UI. */
    getActiveInventoryMaterial() {
        return this.isMaterialSelected() ? this.selectedItem : null;
    }
    /** Returns the selected weapon type if a weapon is selected, otherwise null. Used by UI. */
    getActiveWeaponType() {
        // Return unarmed if selected, as it's a valid selection state
        return this.isWeaponSelected() || this.selectedItem === Config.WEAPON_TYPE_UNARMED ? this.selectedItem : null;
    }


    // --- Get Damage Output Based on Equipped Item ---
    /** Returns the damage dealt to enemies by the currently equipped weapon. */
    getCurrentAttackDamage() {
        // No damage if unarmed, material selected, OR if dying
        if (!this.isWeaponSelected() || this.isDying) return 0;
        switch (this.selectedItem) {
            case Config.WEAPON_TYPE_SWORD: return Config.PLAYER_SWORD_ATTACK_DAMAGE;
            case Config.WEAPON_TYPE_SPEAR: return Config.PLAYER_SPEAR_ATTACK_DAMAGE;
            case Config.WEAPON_TYPE_SHOVEL: return Config.PLAYER_SHOVEL_ATTACK_DAMAGE; // Shovel does low enemy damage
            default: return 0;
        }
    }
    /** Returns the damage dealt to blocks by the currently equipped item (usually tools). */
    getCurrentBlockDamage() {
        // Only certain items damage blocks, AND cannot damage if dying
        if (this.isDying) return 0;
        if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) return Config.PLAYER_SHOVEL_BLOCK_DAMAGE;
        // Add other tools like pickaxes here later
        // Weapons (Sword, Spear) and unarmed do 0 block damage
        return 0;
    }

    // --- Methods for UI Interaction (called by UI event listeners) ---
    /** Equips a material if available. Called when a material slot is clicked in the UI. */
    setActiveInventoryMaterial(materialType) {
        // Cannot change selection if dying
        if (this.isDying) return false;

        if (Config.INVENTORY_MATERIALS.includes(materialType)) {
            // Check if player actually has the material before equipping
            if ((this.inventory[materialType] || 0) > 0) {
                // Use the main equip logic
                return this.equipItem(materialType);
            } else {
                // console.log(`Cannot select ${materialType}, count is 0.`);
                // Optionally switch to unarmed if trying to select an empty slot?
                // this.equipItem(Config.WEAPON_TYPE_UNARMED);
            }
        } else {
            console.warn(`Attempted to set invalid material type via UI: ${materialType}`);
        }
        return false; // Selection failed
    }

     /** Equips a weapon if possessed. Called when a weapon slot is clicked in the UI. */
     setActiveWeapon(weaponType) {
         // Cannot change selection if dying
         if (this.isDying) return false;

        // Check if it's a valid weapon type (including unarmed)
        if (this.isWeaponType(weaponType) || weaponType === Config.WEAPON_TYPE_UNARMED) {
            // --- Handle clicking the currently equipped weapon ---
            if (this.selectedItem === weaponType) {
                // If the player clicks the already selected weapon (and it's not unarmed),
                // unequip it to go back to unarmed state. Shovel is an exception - maybe keep shovel equipped?
                // Let's allow unequipping any equipped weapon by clicking its slot.
                if (weaponType !== Config.WEAPON_TYPE_UNARMED) { // Don't unequip unarmed by clicking unarmed
                    // console.log(`UI Click: Unequipping ${weaponType} to become unarmed.`);
                    return this.equipItem(Config.WEAPON_TYPE_UNARMED); // Switch to unarmed
                }
                 // Clicking unarmed slot while unarmed does nothing
                 // console.log("UI Click: Already unarmed.");
                 return false;
            }
            // --- Handle clicking a DIFFERENT weapon slot ---
            // 1. Check if the player already possesses the weapon
            if (this.hasWeapon(weaponType)) {
                // Possessed, just equip it
                 // console.log(`UI Click: Possess ${weaponType}. Equipping.`);
                return this.equipItem(weaponType); // Use main equip logic
            } else {
                // 2. Player does NOT possess the weapon. Check if it's craftable and they have the materials.
                 const recipe = Config.CRAFTING_RECIPES[weaponType];
                 if (recipe) { // Is it a craftable item? (Only weapons are craftable for now)
                     // Attempt to craft it
                      // console.log(`UI Click: Do not possess ${weaponType}. Attempting to craft.`);
                      const crafted = this.craftItem(weaponType); // Attempt crafting using the player's method

                      if (crafted) {
                          // Crafting successful! Now equip the newly crafted weapon.
                          // console.log(`UI Click: Crafting successful! Equipping ${weaponType}.`);
                          return this.equipItem(weaponType);
                      } else {
                           // Crafting failed (not enough materials)
                          // console.log(`UI Click: Crafting failed for ${weaponType}.`);
                           // UI might need to provide feedback (e.g. shake slot) - this will be handled in ui.js
                           return false; // Indicate selection/crafting failed
                      }
                 } else {
                      // Not a craftable item, and not possessed (e.g., shovel not spawned, or unknown weapon)
                      // console.log(`UI Click: Cannot select ${weaponType}. Not possessed and not craftable.`);
                      return false; // Cannot select
                 }
            }

        } else {
            console.warn(`Attempted to set invalid weapon type via UI: ${weaponType}`);
        }
        return false; // Invalid type or failed to process
    }
    // --- Reset Methods (Update to reflect starting shovel) ---
    /** Resets the player's state completely for a new game or restart. */
    reset() {
        console.log("Resetting player state...");
        // Position & Physics
        this.x = Config.PLAYER_START_X;
        this.y = Config.PLAYER_START_Y;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.isInWater = false;
        this.waterJumpCooldown = 0;
        // Health
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
        this.maxHealth = Config.PLAYER_MAX_HEALTH_DISPLAY;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        // Combat & Placement
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.placementCooldown = 0; // Reset placement cooldown
        this.hitEnemiesThisSwing = [];
        this.hitBlocksThisSwing = [];
        // Inventory & Weapons
        this.inventory = {}; // Clear inventory
        // Reset weapon possession flags - Shovel is a starting item again
        this.hasShovel = true; // Player starts with shovel on reset
        this.hasSword = false;
        this.hasSpear = false;
        this.selectedItem = Config.WEAPON_TYPE_UNARMED; // Player starts with unarmed, but possessing the shovel.

        // Targeting
        this.lastDirection = 1; // Reset facing direction
        // Reset last valid target positions
        this._lastValidTargetWorldPos = null;
        this._lastValidTargetGridCell = null;

        // Animation state (for death)
        this.isDying = false;
        this.deathAnimationTimer = 0;
        this.deathAnimationFrame = 0;

        // Set player back to active
        this.isActive = true;


        // Initial position validation after reset
         if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Player RESET POSITION ERROR: NaN final coordinates! Resetting to center.`);
             this.x = Config.CANVAS_WIDTH / 2 - this.width/2;
             this.y = Config.CANVAS_HEIGHT / 2 - this.height/2;
         }
         // console.log(`Player state reset. Has Shovel: ${this.hasShovel}, Equipped: ${this.selectedItem}`);
    }

    // --- Resets only the player's position and physics state (e.g., after falling out) ---
    // Modify to trigger die() instead of just resetting position.
    // The die() method will then handle stopping movement and starting the animation.
    resetPosition() {
        // Falling out now triggers the death animation
        this.die(); // This will set isDying, stop movement, etc.
        // No need to reset x, y, vx, vy, isOnGround, etc. here, die() handles stopping movement,
        // and the death animation will play from wherever the player fell out.
        // The actual player object removal/replacement happens via main.js checking !this.isActive
        // after the animation completes, followed by a game restart.
    }

    // Add isActive getter for clarity, though main.js checks the property directly
    isActive() {
        return this.isActive;
    }
} // End of Player Class