// root/js/utils/player.js

import * as Config from './config.js';
import * as GridCollision from './gridCollision.js';
import * as WorldManager from '../worldManager.js';
import * as World from './world.js';

export class Player {
    constructor(x, y, width, height, color) { // 'color' param is now effectively ignored
        this.x = x; 
        this.y = y; 
        this.width = Config.PLAYER_WIDTH;
        this.height = Config.PLAYER_HEIGHT;
        this.vx = 0; 
        this.vy = 0;
        this.isOnGround = false;
        this.isInWater = false;
        this.waterJumpCooldown = 0;
        this.isOnRope = false;
        this.ropeCol = -1;
        this.canGrabRopeTimer = 0;
        this.hasShovel = false; 
        this.hasSword = false;
        this.hasSpear = false;
        this.selectedItem = Config.WEAPON_TYPE_UNARMED;
        this.inventory = {};
        this.partialCollection = {};
        this.placementCooldown = 0; 
        this.isAttacking = false; 
        this.attackTimer = 0; 
        this.attackCooldown = 0; 
        this.hitEnemiesThisSwing = [];
        this.hitBlocksThisSwing = [];
        this.maxHealth = Config.PLAYER_MAX_HEALTH_DISPLAY;
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        this.targetWorldPos = { x: 0, y: 0 };
        this.targetGridCell = { col: 0, row: 0 };
        this.lastDirection = 1; 
        this._lastValidTargetWorldPos = null;
        this._lastValidTargetGridCell = null;
        this.isDying = false;
        this.deathAnimationTimer = 0;
        this.deathAnimationFrame = 0;
        this.isActive = true;
        // Initial position validation
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(">>> Player CONSTRUCTOR ERROR: NaN initial coordinates! Resetting to center.");
            this.x = Config.CANVAS_WIDTH / 2 - this.width / 2;
            this.y = Config.CANVAS_HEIGHT / 2 - this.height / 2;
        }
    }
    update(dt, inputState, targetWorldPos, targetGridCell) {
        if (this.isDying) {
            if (typeof dt !== 'number' || isNaN(dt) || dt < 0) {
                console.warn("Player Update: Invalid delta time during dying.", dt);
                if (this.deathAnimationTimer <= 0) {
                    this.isActive = false;
                    this.isDying = false;
                    this.deathAnimationFrame = 0;
                }
                return; 
            }
            this.deathAnimationTimer -= dt; 
            const totalAnimationDuration = Config.PLAYER_DEATH_ANIMATION_DURATION; 
            const spinDuration = Config.PLAYER_SPIN_DURATION; 
            const timeElapsedInAnimation = totalAnimationDuration - this.deathAnimationTimer;
            if (timeElapsedInAnimation >= 0 && timeElapsedInAnimation < spinDuration) { 
                const totalSpinTime = spinDuration;
                const timePerFrame = totalSpinTime / Config.PLAYER_SPIN_FRAMES;
                this.deathAnimationFrame = Math.min(
                    Config.PLAYER_SPIN_FRAMES - 1, 
                    Math.floor(timeElapsedInAnimation / timePerFrame)
                );
            } else {
                this.deathAnimationFrame = 0; 
            }
            if (this.deathAnimationTimer <= 0) {
                this.isActive = false; 
                this.isDying = false; 
                this.deathAnimationFrame = 0; 
            }
            return;
        }
        if (typeof dt !== 'number' || isNaN(dt) || dt < 0) {
            console.warn("Player Update: Invalid delta time.", dt);
            if (this.currentHealth <= 0 && !this.isDying && this.isActive) { 
                this.die(); 
            }
            return; 
        }
        if (typeof targetWorldPos !== 'object' || targetWorldPos === null || typeof targetWorldPos.x !== 'number' || typeof targetWorldPos.y !== 'number' || isNaN(targetWorldPos.x) || isNaN(targetWorldPos.y)) {
            // Fallback: If targetWorldPos is invalid, use player's facing direction to estimate a target
            const playerCenterX = this.x + this.width / 2;
            const playerCenterY = this.y + this.height / 2;
            this.targetWorldPos = this._lastValidTargetWorldPos || { x: playerCenterX + this.lastDirection * 50, y: playerCenterY }; 
        } else {
            this.targetWorldPos = targetWorldPos;
            this._lastValidTargetWorldPos = { ...targetWorldPos }; 
        }
        if (typeof targetGridCell !== 'object' || targetGridCell === null || typeof targetGridCell.col !== 'number' || typeof targetGridCell.row !== 'number' || isNaN(targetGridCell.col) || isNaN(targetGridCell.row)) {
            this.targetGridCell = GridCollision.worldToGridCoords(this.targetWorldPos.x, this.targetWorldPos.y);
            this._lastValidTargetGridCell = { ...this.targetGridCell }; 
        } else {
            this.targetGridCell = targetGridCell;
            this._lastValidTargetGridCell = { ...targetGridCell }; 
        }
        const playerCenterX = this.x + this.width / 2;
        const targetDeltaX = this.targetWorldPos.x - playerCenterX;
        if (Math.abs(targetDeltaX) > 1) { 
            this.lastDirection = Math.sign(targetDeltaX);
        }
        this.isInWater = GridCollision.isEntityInWater(this); 
        if (!this.isInWater && this.waterJumpCooldown > 0) {
            this.waterJumpCooldown = 0;
        }
        this._updateTimers(dt);
        const activeInputState = this.isActive && !this.isDying ? inputState : {};
        this._handleInput(dt, activeInputState);
        this._applyPhysics(dt);
        this._checkBoundaries();
        this.currentHealth = Math.max(0, this.currentHealth);
    }
    _updateTimers(dt) {
        if (this.canGrabRopeTimer > 0) this.canGrabRopeTimer -= dt;
        if (this.canGrabRopeTimer < 0) this.canGrabRopeTimer = 0;
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.attackCooldown < 0) this.attackCooldown = 0;
        if (this.waterJumpCooldown > 0) this.waterJumpCooldown -= dt;
        if (this.waterJumpCooldown < 0) this.waterJumpCooldown = 0;
        if (this.placementCooldown > 0) this.placementCooldown -= dt;
        if (this.placementCooldown < 0) this.placementCooldown = 0;
        if (this.isAttacking) { 
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) { 
                this.isAttacking = false;
                this.hitEnemiesThisSwing = []; 
                this.hitBlocksThisSwing = [];
            }
        }
        if (this.isInvulnerable) {
            this.invulnerabilityTimer -= dt;
            if (this.invulnerabilityTimer <= 0) { 
                this.isInvulnerable = false;
            }
        }
    }
    _handleInput(dt, inputState) {
        this._handleMovement(dt, inputState); 
        if (inputState.attack) { 
            if (this.isMaterialSelected()) {
                this._handlePlacementHold(); 
            } else if (this.isWeaponSelected()) {
                if (this.attackCooldown <= 0 && !this.isAttacking) {
                    this.isAttacking = true; 
                    this.hitEnemiesThisSwing = []; 
                    this.hitBlocksThisSwing = [];

                    const weaponStats = Config.WEAPON_STATS[this.selectedItem];
                    if (weaponStats) {
                        this.attackTimer = weaponStats.attackDuration;
                        this.attackCooldown = weaponStats.attackCooldown;
                    } else { // fallback for unknown weapon
                        this.attackTimer = 0.1;
                        this.attackCooldown = 0.2;
                    }
                }
            }
        }
    }
    _handleMovement(dt, inputState) {
        if (this.isOnRope) {
            this.vx = 0; 
            if (inputState.jump) { 
                if (inputState.left || inputState.right) {
                    this.isOnRope = false;
                    this.canGrabRopeTimer = 0.3; 
                    this.vx = (inputState.left ? -1 : 1) * Config.PLAYER_ROPE_DETACH_IMPULSE_X;
                    this.vy = -Config.PLAYER_JUMP_VELOCITY * Config.PLAYER_ROPE_DETACH_JUMP_MULTIPLIER; 
                    this.isOnGround = false;
                } else { 
                    this.vy = -Config.PLAYER_ROPE_CLIMB_SPEED;
                }
            } else if (inputState.downAction) { 
                this.vy = Config.PLAYER_ROPE_SLIDE_SPEED;
            } else if (inputState.left || inputState.right) { 
                 this.isOnRope = false;
                 this.canGrabRopeTimer = 0.3;
                 this.vx = (inputState.left ? -1 : 1) * Config.PLAYER_ROPE_DETACH_IMPULSE_X;
                 this.vy = Math.max(this.vy, Config.PLAYER_ROPE_SLIDE_SPEED * 0.1); 
                 this.isOnGround = false;
            } else { 
                this.vy = 0; 
            }
        } else {
            let targetVx = 0;
            if (inputState.left) targetVx -= Config.PLAYER_MAX_SPEED_X;
            if (inputState.right) targetVx += Config.PLAYER_MAX_SPEED_X;

            const acceleration = this.isInWater ? Config.PLAYER_MOVE_ACCELERATION * Config.WATER_ACCELERATION_FACTOR : Config.PLAYER_MOVE_ACCELERATION;
            if (targetVx !== 0) {
                this.vx += Math.sign(targetVx) * acceleration * dt;
                const currentMaxSpeedX = this.isInWater ? Config.PLAYER_MAX_SPEED_X * Config.WATER_MAX_SPEED_FACTOR : Config.PLAYER_MAX_SPEED_X;
                this.vx = Math.max(-currentMaxSpeedX, Math.min(currentMaxSpeedX, this.vx));
                if (Math.sign(this.vx) !== Math.sign(targetVx) && targetVx !== 0) {
                    const brakingFactor = this.isInWater ? Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt) : Math.pow(Config.PLAYER_FRICTION_BASE * 10, dt);
                    this.vx *= brakingFactor;
                }
            } else {
                const frictionFactor = this.isInWater ? Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt) : Math.pow(Config.PLAYER_FRICTION_BASE, dt);
                this.vx *= frictionFactor;
                if (Math.abs(this.vx) < GridCollision.E_EPSILON) {
                    this.vx = 0;
                }
            }
            if (inputState.jump && this.waterJumpCooldown <= 0) {
                if (this.isInWater) {
                    this.vy = -Config.WATER_SWIM_VELOCITY;
                    this.waterJumpCooldown = Config.WATER_JUMP_COOLDOWN_DURATION;
                    this.isOnGround = false;
                } else if (this.isOnGround) {
                    this.vy = -Config.PLAYER_JUMP_VELOCITY;
                    this.isOnGround = false;
                }
            }
        }
    }
    _handlePlacementHold() {
        if (this.placementCooldown > 0) return;
        const selectedMaterialType = this.selectedItem;
        if ((this.inventory[selectedMaterialType] || 0) <= 0) return;
        const targetForPlacement = this.targetWorldPos || this._lastValidTargetWorldPos;
        if (!targetForPlacement || !this._isTargetWithinRange(targetForPlacement)) return;
        const targetCellForPlacement = this.targetGridCell || this._lastValidTargetGridCell;
        if (!targetCellForPlacement || typeof targetCellForPlacement.col !== 'number' || typeof targetCellForPlacement.row !== 'number' || isNaN(targetCellForPlacement.col) || isNaN(targetCellForPlacement.row)) return;
        const targetCol = targetCellForPlacement.col;
        const targetRow = targetCellForPlacement.row;
        const targetBlockType = World.getBlockType(targetCol, targetRow);
        if (targetBlockType === null) return; 
        const canPlaceInTargetCell = targetBlockType === Config.BLOCK_AIR;
        if (!canPlaceInTargetCell) return;
        if (this.checkPlacementOverlap(targetCol, targetRow)) return;
        if (selectedMaterialType === 'vegetation') {
            const blockAboveType = World.getBlockType(targetCol, targetRow - 1);
            const blockAboveData = World.getBlock(targetCol, targetRow - 1); 
            const canAttachToSolid = blockAboveData !== null && GridCollision.isSolid(targetCol, targetRow - 1);
            const canExtendRope = blockAboveType === Config.BLOCK_ROPE;
            if (canAttachToSolid || canExtendRope) {
                if (WorldManager.placePlayerBlock(targetCol, targetRow, Config.BLOCK_ROPE)) {
                    this.decrementInventory(selectedMaterialType);
                    this.placementCooldown = Config.PLAYER_PLACEMENT_COOLDOWN;
                }
            }
        } else { 
            if (GridCollision.hasSolidNeighbor(targetCol, targetRow)) {
                const blockTypeToPlace = Config.MATERIAL_TO_BLOCK_TYPE[selectedMaterialType];
                if (blockTypeToPlace !== undefined) {
                    if (WorldManager.placePlayerBlock(targetCol, targetRow, blockTypeToPlace)) {
                        this.decrementInventory(selectedMaterialType);
                        this.placementCooldown = Config.PLAYER_PLACEMENT_COOLDOWN;
                    }
                } else {
                    console.warn(`Placement failed: Material type "${selectedMaterialType}" has no block type mapping.`);
                }
            }
        }
    }
    _applyPhysics(dt) {
        if (!this.isOnRope && this.canGrabRopeTimer <= 0) { 
            const playerRect = this.getRect();
            const minCheckCol = Math.max(0, Math.floor(playerRect.x / Config.BLOCK_WIDTH));
            const maxCheckCol = Math.min(Config.GRID_COLS - 1, Math.floor((playerRect.x + playerRect.width - GridCollision.E_EPSILON) / Config.BLOCK_WIDTH));
            const minCheckRow = Math.max(0, Math.floor(playerRect.y / Config.BLOCK_HEIGHT));
            const maxCheckRow = Math.min(Config.GRID_ROWS - 1, Math.floor((playerRect.y + playerRect.height - GridCollision.E_EPSILON) / Config.BLOCK_HEIGHT));
            let foundRope = false;
            for (let r = minCheckRow; r <= maxCheckRow; r++) {
                for (let c = minCheckCol; c <= maxCheckCol; c++) {
                    if (GridCollision.isRope(c, r)) {
                        this.isOnRope = true;
                        this.ropeCol = c;
                        this.x = this.ropeCol * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2) - (this.width / 2); 
                        this.vx = 0; 
                        this.isOnGround = false; 
                        foundRope = true;
                        break;
                    }
                }
                if (foundRope) break;
            }
        } else if (this.isOnRope) {
            this.x = this.ropeCol * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2) - (this.width / 2);
            this.vx = 0; 
            const playerCenterY = this.y + this.height / 2;
            const playerRowAtCenter = Math.floor(playerCenterY / Config.BLOCK_HEIGHT);
            if (!GridCollision.isRope(this.ropeCol, playerRowAtCenter) &&
                !GridCollision.isRope(this.ropeCol, playerRowAtCenter + 1) && 
                !GridCollision.isRope(this.ropeCol, playerRowAtCenter - 1)) { 
                this.isOnRope = false;
                this.canGrabRopeTimer = 0.1; 
            }
        }
        if (this.isOnRope) { 
            this.y += this.vy * dt;
            const headCheckY = this.y;
            const feetCheckY = this.y + this.height;
            const headRow = Math.floor(headCheckY / Config.BLOCK_HEIGHT);
            const feetRow = Math.floor(feetCheckY / Config.BLOCK_HEIGHT);
            if (this.vy < 0 && GridCollision.isSolid(this.ropeCol, headRow)) {
                this.y = (headRow + 1) * Config.BLOCK_HEIGHT; 
                this.vy = 0;
            }
            if (this.vy > 0 && GridCollision.isSolid(this.ropeCol, feetRow)) {
                this.y = feetRow * Config.BLOCK_HEIGHT - this.height; 
                this.vy = 0;
                this.isOnGround = true; 
                this.isOnRope = false; 
            }
            if (this.vy > 0 && !GridCollision.isRope(this.ropeCol, feetRow) && !GridCollision.isSolid(this.ropeCol, feetRow)) {
                if (!GridCollision.isRope(this.ropeCol, Math.floor((this.y + this.height / 2) / Config.BLOCK_HEIGHT))) {
                    this.isOnRope = false;
                }
            }
        } else { 
            const currentGravity = this.isInWater ? Config.GRAVITY_ACCELERATION * Config.WATER_GRAVITY_FACTOR : Config.GRAVITY_ACCELERATION;
            const verticalDampingFactor = this.isInWater ? Math.pow(Config.WATER_VERTICAL_DAMPING, dt) : 1;
            if (!this.isOnGround) {
                this.vy += currentGravity * dt;
            } else {
                if (this.vy > 0.1) this.vy = 0;
            }
            if (this.isInWater) {
                this.vy *= verticalDampingFactor;
                this.vy = Math.max(this.vy, -Config.WATER_MAX_SWIM_UP_SPEED);
                this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED);
            } else {
                if (this.vy > Config.MAX_FALL_SPEED) {
                    this.vy = Config.MAX_FALL_SPEED;
                }
            }
            const potentialMoveX = this.vx * dt;
            const potentialMoveY = this.vy * dt;
            const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
            this.isOnGround = collisionResult.isOnGround; 
        }
        this._checkBoundaries();
        this.currentHealth = Math.max(0, this.currentHealth);
    }
    _checkBoundaries() {
        if (this.x < 0) {
            this.x = 0;
            if (this.vx < 0) this.vx = 0; 
        }
        if (this.x + this.width > Config.CANVAS_WIDTH) {
            this.x = Config.CANVAS_WIDTH - this.width;
            if (this.vx > 0) this.vx = 0; 
        }
        if (this.y > Config.CANVAS_HEIGHT + 200) { 
            this.die(); 
        }
    }
    _isTargetWithinRange(targetWorldPos) {
        if (!targetWorldPos) return false;
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
        return distSq <= Config.PLAYER_INTERACTION_RANGE_SQ;
    }
    checkPlacementOverlap(targetCol, targetRow) {
        if (targetCol < 0 || targetRow < 0 || targetCol >= Config.GRID_COLS || targetRow >= Config.GRID_ROWS) return true; 
        const blockRect = {
            x: targetCol * Config.BLOCK_WIDTH,
            y: targetRow * Config.BLOCK_HEIGHT,
            width: Config.BLOCK_WIDTH,
            height: Config.BLOCK_HEIGHT
        };
        const playerRect = this.getRect();
        const overlap = playerRect.x < blockRect.x + blockRect.width &&
                        playerRect.x + playerRect.width > blockRect.x &&
                        playerRect.y < blockRect.y + blockRect.height &&
                        playerRect.y + playerRect.height > blockRect.y;
        return overlap; 
    }
    getGhostBlockInfo() {
        if (!this.isMaterialSelected()) return null;
        const targetCell = this.targetGridCell || this._lastValidTargetGridCell;
        if (!targetCell || typeof targetCell.col !== 'number' || typeof targetCell.row !== 'number' || isNaN(targetCell.col) || isNaN(targetCell.row)) return null;
        const { col, row } = targetCell;
        const targetWorldPosForCheck = this.targetWorldPos || this._lastValidTargetWorldPos;
        if (!targetWorldPosForCheck || !this._isTargetWithinRange(targetWorldPosForCheck)) return null;
        const targetBlockType = World.getBlockType(col, row);
        if (targetBlockType === null) return null;
        const canPlaceInTargetCell = targetBlockType === Config.BLOCK_AIR;
        if (!canPlaceInTargetCell) return null;
        if (this.checkPlacementOverlap(col, row)) return null;
        const selectedMaterialType = this.selectedItem;
        if (selectedMaterialType === 'vegetation') {
            const blockAboveType = World.getBlockType(col, row - 1);
            const blockAboveData = World.getBlock(col, row - 1); 
            const canAttachToSolid = blockAboveData !== null && GridCollision.isSolid(col, row - 1);
            const canExtendRope = blockAboveType === Config.BLOCK_ROPE;
            if (canAttachToSolid || canExtendRope) {
                const ropeProps = Config.BLOCK_PROPERTIES[Config.BLOCK_ROPE];
                return { col: col, row: row, color: ropeProps?.color || Config.PLAYER_BODY_COLOR }; // Use a fallback color
            }
            return null; 
        } else { 
            if (!GridCollision.hasSolidNeighbor(col, row)) return null;
            const blockTypeToPlace = Config.MATERIAL_TO_BLOCK_TYPE[selectedMaterialType];
            if (blockTypeToPlace === undefined) return null;
            const blockProps = Config.BLOCK_PROPERTIES[blockTypeToPlace];
            const blockColor = blockProps?.color;
            if (!blockColor) return null;
            return { col: col, row: row, color: blockColor };
        }
    }
    draw(ctx) {
        if (!this.isActive && !this.isDying || !ctx) return;
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Player DRAW ERROR: Preventing draw due to NaN coordinates!`);
            return;
        }
        if (this.isDying) {
            ctx.save(); 
            const pivotX = this.x + this.width / 2; // death animation
            const pivotY = this.y + this.height / 2;
            const totalAnimationDuration = Config.PLAYER_DEATH_ANIMATION_DURATION;
            const spinDuration = Config.PLAYER_SPIN_DURATION;
            const timeElapsed = totalAnimationDuration - this.deathAnimationTimer; 
            let currentScale = 1.0;
            let rotationAngle = 0; 
            if (timeElapsed >= 0 && timeElapsed < spinDuration) { 
                rotationAngle = (this.deathAnimationFrame / Config.PLAYER_SPIN_FRAMES) * 2 * Math.PI; 
            } else if (timeElapsed >= spinDuration && timeElapsed < totalAnimationDuration) { 
                const swellDuration = totalAnimationDuration - spinDuration;
                if (swellDuration > 0) {
                    const swellProgress = (timeElapsed - spinDuration) / swellDuration; // progress calculation
                    currentScale = 1.0 + (Config.ENEMY_SWELL_SCALE - 1.0) * swellProgress; 
                } else {
                    currentScale = 1.0; 
                }
                rotationAngle = 0; 
            } else {
                currentScale = 1.0; rotationAngle = 0;
            } 
            ctx.translate(pivotX, pivotY);
            ctx.rotate(rotationAngle);
            ctx.scale(currentScale, currentScale);
            ctx.translate(-pivotX, -pivotY);
            ctx.fillStyle = Config.PLAYER_BODY_COLOR;
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
            ctx.restore(); 
            return; 
        }
        if (this.isInvulnerable && Math.floor(performance.now() / 100) % 2 !== 0) { // Draw player body, with invulnerability flashing // Skip drawing player body to create flash effect
        } else {
            ctx.fillStyle = Config.PLAYER_BODY_COLOR; // --- Normal Active Drawing (Player Body, Arms, Weapon) ---
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
        }
        // Check if a weapon is selected and not in attack animation
        if (!this.isAttacking && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED) {
            const playerCenterX = this.x + this.width / 2;
            const playerCenterY = this.y + this.height / 2;
            const rawTargetWorldPos = this.targetWorldPos || this._lastValidTargetWorldPos || {x: playerCenterX + this.lastDirection * 50, y: playerCenterY}; 
            let weaponStats = Config.WEAPON_STATS[this.selectedItem];

            if (!weaponStats || !weaponStats.shape || !weaponStats.visualAnchorOffset) {
                console.warn(`Player.draw: Missing weapon stats or shape/anchor for ${this.selectedItem}.`);
                return;
            }

            const visualAnchorOffsetX = weaponStats.visualAnchorOffset.x;
            const visualAnchorOffsetY = weaponStats.visualAnchorOffset.y;
            const dx_to_raw = rawTargetWorldPos.x - playerCenterX;
            const dy_to_raw = rawTargetWorldPos.y - playerCenterY;
            
            let maxVisualReach;
            if (weaponStats.attackReachY === undefined) { 
                maxVisualReach = weaponStats.attackReachX;
            } else { 
                maxVisualReach = Math.sqrt(
                    (weaponStats.attackReachX * weaponStats.attackReachX) +
                    (weaponStats.attackReachY * weaponStats.attackReachY)
                );
            }
            maxVisualReach = Math.max(maxVisualReach, weaponStats.width, weaponStats.height, Config.BLOCK_WIDTH * 2); 
            
            let clampedTargetX = rawTargetWorldPos.x;
            let clampedTargetY = rawTargetWorldPos.y;
            const dist_to_raw = Math.sqrt(dx_to_raw * dx_to_raw + dy_to_raw * dy_to_raw);

            if (dist_to_raw > maxVisualReach + GridCollision.E_EPSILON) {
                if (dist_to_raw > GridCollision.E_EPSILON) {
                    const normalizedDx = dx_to_raw / dist_to_raw;
                    const normalizedDy = dy_to_raw / dist_to_raw;
                    clampedTargetX = playerCenterX + normalizedDx * maxVisualReach;
                    clampedTargetY = playerCenterY + normalizedDy * maxVisualReach;
                } else {
                    clampedTargetX = playerCenterX + this.lastDirection * maxVisualReach;
                    clampedTargetY = playerCenterY;
                }
            } else if (dist_to_raw < GridCollision.E_EPSILON) {
                 clampedTargetX = playerCenterX + this.lastDirection * (maxVisualReach * 0.1);
                 clampedTargetY = playerCenterY;
            }

            let angle = Math.atan2(clampedTargetY - playerCenterY, clampedTargetX - playerCenterX);
            
            const rotatedAnchorOffsetX = visualAnchorOffsetX * Math.cos(angle) - visualAnchorOffsetY * Math.sin(angle);
            const rotatedAnchorOffsetY = visualAnchorOffsetX * Math.sin(angle) + visualAnchorOffsetY * Math.cos(angle);
            const weaponPivotX = clampedTargetX - rotatedAnchorOffsetX; // Weapon's rotational center in world space
            const weaponPivotY = clampedTargetY - rotatedAnchorOffsetY;
            
            // --- Arm Calculations ---
            const shoulderOffsetPxX = this.width * Config.PLAYER_SHOULDER_OFFSET_X_FACTOR;
            const shoulderOffsetPxY = this.height * Config.PLAYER_SHOULDER_OFFSET_Y_FACTOR;
            const shoulderRightX = this.x + (this.width - shoulderOffsetPxX);
            const shoulderRightY = this.y + shoulderOffsetPxY;
            const shoulderLeftX = this.x + shoulderOffsetPxX;
            const shoulderLeftY = this.y + shoulderOffsetPxY;
        
            let frontShoulderX, frontShoulderY; // Player's shoulder for the "front" hand
            let backShoulderX, backShoulderY;   // Player's shoulder for the "back" hand

            if (this.lastDirection === 1) { // Player facing right
                frontShoulderX = shoulderRightX;
                frontShoulderY = shoulderRightY;
                backShoulderX = shoulderLeftX;
                backShoulderY = shoulderLeftY;
            } else { // Player facing left
                frontShoulderX = shoulderLeftX;
                frontShoulderY = shoulderLeftY;
                backShoulderX = shoulderRightX;
                backShoulderY = shoulderRightY;
            }

            // Get target points for hands on the weapon (in world coordinates)
            let frontHandWorldX, frontHandWorldY;
            let backHandWorldX, backHandWorldY;

            if (weaponStats.handPositions && weaponStats.handPositions.front && weaponStats.handPositions.back) {
                const localFrontHand = weaponStats.handPositions.front; // {x, y} relative to weapon pivot
                const localBackHand = weaponStats.handPositions.back;   // {x, y} relative to weapon pivot

                // Rotate local hand positions by weapon's current angle and add weapon's world pivot
                frontHandWorldX = weaponPivotX + (localFrontHand.x * Math.cos(angle) - localFrontHand.y * Math.sin(angle));
                frontHandWorldY = weaponPivotY + (localFrontHand.x * Math.sin(angle) + localFrontHand.y * Math.cos(angle));
                
                backHandWorldX = weaponPivotX + (localBackHand.x * Math.cos(angle) - localBackHand.y * Math.sin(angle));
                backHandWorldY = weaponPivotY + (localBackHand.x * Math.sin(angle) + localBackHand.y * Math.cos(angle));
            } else {
                // Fallback: if no handPositions defined, both hands aim at weapon's pivot
                frontHandWorldX = weaponPivotX;
                frontHandWorldY = weaponPivotY;
                backHandWorldX = weaponPivotX;
                backHandWorldY = weaponPivotY;
            }
            
            // Calculate angle and length for the front arm (connects frontShoulder to frontHandWorld)
            const frontArmAngle = Math.atan2(frontHandWorldY - frontShoulderY, frontHandWorldX - frontShoulderX);
            let frontArmLength = Math.sqrt(
                Math.pow(frontHandWorldX - frontShoulderX, 2) + 
                Math.pow(frontHandWorldY - frontShoulderY, 2)
            );
            
            // Calculate angle and length for the back arm (connects backShoulder to backHandWorld)
            const backArmAngle = Math.atan2(backHandWorldY - backShoulderY, backHandWorldX - backShoulderX);
            let backArmLength = Math.sqrt(
                Math.pow(backHandWorldX - backShoulderX, 2) + 
                Math.pow(backHandWorldY - backShoulderY, 2)
            );

            const maxArmLength = this.width * 2; // Max arm stretch
            frontArmLength = Math.min(frontArmLength, maxArmLength);
            backArmLength = Math.min(backArmLength, maxArmLength * 0.9); // Back arm can be a bit shorter
            frontArmLength = Math.max(0, frontArmLength);
            backArmLength = Math.max(0, backArmLength);
            
            // --- Drawing Order for Arms and Weapon ---
            // Draw back arm
            ctx.save();
            ctx.translate(backShoulderX, backShoulderY);
            ctx.rotate(backArmAngle);
            ctx.fillStyle = Config.ARM_COLOR;
            ctx.fillRect(0, -Config.ARM_THICKNESS / 2, backArmLength, Config.ARM_THICKNESS);
            ctx.restore();

            // Draw Weapon
            ctx.save(); 
            ctx.translate(weaponPivotX, weaponPivotY); // Translate to weapon's rotational center
            ctx.rotate(angle); // Rotate around its center
            
            weaponStats.shape.forEach(shapeDef => {
                const fillColor = shapeDef.color || weaponStats.color || 'magenta';
                ctx.fillStyle = fillColor;

                if (shapeDef.type === 'rect') {
                    ctx.fillRect(Math.floor(shapeDef.x), Math.floor(shapeDef.y), Math.ceil(shapeDef.w), Math.ceil(shapeDef.h));
                    if (weaponStats.outlineColor && weaponStats.outlineWidth) {
                        ctx.strokeStyle = weaponStats.outlineColor;
                        ctx.lineWidth = weaponStats.outlineWidth;
                        const inset = ctx.lineWidth / 2;
                        ctx.strokeRect(
                            Math.floor(shapeDef.x) + inset, 
                            Math.floor(shapeDef.y) + inset, 
                            Math.ceil(shapeDef.w) - ctx.lineWidth, 
                            Math.ceil(shapeDef.h) - ctx.lineWidth
                        );
                    }
                } else if (shapeDef.type === 'triangle') {
                    ctx.beginPath();
                    ctx.moveTo(Math.floor(shapeDef.p1.x), Math.floor(shapeDef.p1.y));
                    ctx.lineTo(Math.floor(shapeDef.p2.x), Math.floor(shapeDef.p2.y));
                    ctx.lineTo(Math.floor(shapeDef.p3.x), Math.floor(shapeDef.p3.y));
                    ctx.closePath();
                    ctx.fill();
                    if (weaponStats.outlineColor && weaponStats.outlineWidth) {
                        ctx.strokeStyle = weaponStats.outlineColor;
                        ctx.lineWidth = weaponStats.outlineWidth;
                        ctx.stroke(); 
                    }
                }
            });
            ctx.restore(); // Restore from weapon's transformations
            
            // Draw front arm
            ctx.save(); 
            ctx.translate(frontShoulderX, frontShoulderY);
            ctx.rotate(frontArmAngle);
            ctx.fillStyle = Config.ARM_COLOR;
            ctx.fillRect(0, -Config.ARM_THICKNESS / 2, frontArmLength, Config.ARM_THICKNESS);
            ctx.restore();
        }
        // --- Attack Hitbox ---
        if (this.isAttacking && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED) {
            const hitbox = this.getAttackHitbox(); 
            if (hitbox) {
                if (typeof hitbox.x === 'number' && typeof hitbox.y === 'number' &&
                    typeof hitbox.width === 'number' && typeof hitbox.height === 'number' &&
                    !isNaN(hitbox.x) && !isNaN(hitbox.y) && !isNaN(hitbox.width) && !isNaN(hitbox.height))
                {
                    const weaponStats = Config.WEAPON_STATS[this.selectedItem];
                    let hitboxColor = weaponStats?.attackColor || 'rgba(255, 0, 0, 0.5)'; // Fallback color
                    
                    ctx.fillStyle = hitboxColor;
                    ctx.fillRect(Math.floor(hitbox.x), Math.floor(hitbox.y), Math.ceil(hitbox.width), Math.ceil(hitbox.height));
                } else {
                    console.warn(`Player.draw: Invalid hitbox coordinates/dimensions for ${this.selectedItem}`, hitbox);
                }
            }
        }
    }
    drawGhostBlock(ctx) {
        if (!ctx) return; 
        const ghostInfo = this.getGhostBlockInfo(); 
        if (ghostInfo) {
            const ghostX = ghostInfo.col * Config.BLOCK_WIDTH;
            const ghostY = ghostInfo.row * Config.BLOCK_HEIGHT;
            if (typeof ghostX !== 'number' || typeof ghostY !== 'number' || isNaN(ghostX) || isNaN(ghostY)) {
                console.warn("Player.drawGhostBlock: Invalid ghost coordinates.", ghostX, ghostY);
                return;
            }
            ctx.save(); 
            ctx.globalAlpha = Config.GHOST_BLOCK_ALPHA; 
            ctx.fillStyle = ghostInfo.color;
            ctx.fillRect(
                Math.floor(ghostX),
                Math.floor(ghostY),
                Math.ceil(Config.BLOCK_WIDTH),  
                Math.ceil(Config.BLOCK_HEIGHT)
            );
            ctx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
            ctx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS; 
            const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
            ctx.strokeRect(
                Math.floor(ghostX) + outlineInset,
                Math.floor(ghostY) + outlineInset,
                Math.ceil(Config.BLOCK_WIDTH) - Config.PLAYER_BLOCK_OUTLINE_THICKNESS,
                Math.ceil(Config.BLOCK_HEIGHT) - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
            );
            ctx.restore(); 
        }
    }
    drawPlacementRange(ctx) {
        if (!ctx || !this.isMaterialSelected() || this.isDying || !this.isActive) {
            return; 
        }
        if (typeof this.x !== 'number' || typeof this.y !== 'number' ||
            typeof this.width !== 'number' || typeof this.height !== 'number' ||
            isNaN(this.x) || isNaN(this.y) || isNaN(this.width) || isNaN(this.height) ||
            typeof Config.PLAYER_INTERACTION_RANGE !== 'number' || isNaN(Config.PLAYER_INTERACTION_RANGE)) {
            console.warn("Player.drawPlacementRange: Invalid player data or range config.", this, Config.PLAYER_INTERACTION_RANGE);
            return;
        }
        const playerCenterX = this.x + this.width / 2;
        const playerCenterY = this.y + this.height / 2;
        const rangeRadius = Config.PLAYER_INTERACTION_RANGE; 
        ctx.save();
        ctx.strokeStyle = Config.PLAYER_PLACEMENT_RANGE_COLOR;
        ctx.lineWidth = Config.PLAYER_PLACEMENT_RANGE_LINE_WIDTH;
        ctx.beginPath();
        ctx.arc(playerCenterX, playerCenterY, rangeRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    takeDamage(amount) {
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
            return;
        }
        if (this.isInvulnerable || this.isDying || this.currentHealth <= 0) return;
        this.currentHealth -= amount;
        if (this.currentHealth <= 0) {
            this.currentHealth = 0; 
            this.die(); 
        } else {
            this.isInvulnerable = true;
            this.invulnerabilityTimer = Config.PLAYER_INVULNERABILITY_DURATION;
        }
    }
    die() {
        if (!this.isActive || this.isDying) {
            if (this.currentHealth <= 0 && !this.isActive && !this.isDying) {
                console.warn("Player death requested but already inactive/dying. State:", {isActive: this.isActive, isDying: this.isDying, health: this.currentHealth});
            }
            return; 
        }
        console.log(">>> Player is dying! <<<");
        this.vx = 0;
        this.vy = 0;
        this.isAttacking = false; 
        this.attackTimer = 0;
        this.placementCooldown = 0; 
        this.isDying = true;
        this.deathAnimationTimer = Config.PLAYER_DEATH_ANIMATION_DURATION;
        this.deathAnimationFrame = 0; 
    }
    getAttackHitbox() {
        if (!this.isAttacking || !this.isWeaponSelected() || this.selectedItem === Config.WEAPON_TYPE_UNARMED || this.isDying) {
            return null;
        }
        const playerCenterX = this.x + this.width / 2;
        const playerCenterY = this.y + this.height / 2;
        const targetForHitbox = this.targetWorldPos || this._lastValidTargetWorldPos || {x: playerCenterX + this.lastDirection * 50, y: playerCenterY};
        const targetX = targetForHitbox.x;
        const targetY = targetForHitbox.y;
        const dx = targetX - playerCenterX;
        const dy = targetY - playerCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy); 
        
        const weaponStats = Config.WEAPON_STATS[this.selectedItem];
        if (!weaponStats) return null; // Should not happen if isWeaponSelected() is true

        const hitboxWidth = weaponStats.attackWidth;
        const hitboxHeight = weaponStats.attackHeight;
        const attackReachX = weaponStats.attackReachX;
        const attackReachY = weaponStats.attackReachY; // Can be undefined for direct vector

        let tempHitboxCenterX, tempHitboxCenterY; 
        
        // Calculate the center of the hitbox based on weapon type logic
        if (attackReachY === undefined) { // For weapons that use a direct vector to target (e.g., spear)
            const reachDistance = attackReachX; // attackReachX is the full distance for this type
            if (dist > GridCollision.E_EPSILON) {
                const normX = dx / dist;
                const normY = dy / dist;
                tempHitboxCenterX = playerCenterX + normX * reachDistance;
                tempHitboxCenterY = playerCenterY + normY * reachDistance; 
            } else {
                tempHitboxCenterX = playerCenterX + this.lastDirection * reachDistance;
                tempHitboxCenterY = playerCenterY; 
            }
        } else { // For weapons that use a fixed offset relative to player (e.g., sword, shovel)
            if (dist > GridCollision.E_EPSILON) {
                const normX = dx / dist;
                // AttackReachX is the horizontal offset from player center along the normalized vector
                tempHitboxCenterX = playerCenterX + normX * attackReachX; 
                // AttackReachY is a fixed vertical offset from playerCenterY
                tempHitboxCenterY = playerCenterY + attackReachY; 
            } else {
                // If cursor is on player, use lastDirection for horizontal offset
                tempHitboxCenterX = playerCenterX + this.lastDirection * attackReachX;
                tempHitboxCenterY = playerCenterY + attackReachY;
            }
        }

        const hitboxX = tempHitboxCenterX - hitboxWidth / 2;
        const hitboxY = tempHitboxCenterY - hitboxHeight / 2;

        if (typeof hitboxX !== 'number' || typeof hitboxY !== 'number' ||
            typeof hitboxWidth !== 'number' || typeof hitboxHeight !== 'number' ||
            isNaN(hitboxX) || isNaN(hitboxY) || isNaN(hitboxWidth) || isNaN(hitboxHeight)) {
            console.warn("Player.getAttackHitbox: Calculated invalid hitbox, returning null.", {hitboxX, hitboxY, hitboxWidth, hitboxHeight, selectedItem: this.selectedItem});
            return null;
        }
        return { x: hitboxX, y: hitboxY, width: hitboxWidth, height: hitboxHeight };
    }
    hasHitEnemyThisSwing(enemy) { return this.hitEnemiesThisSwing.includes(enemy); }
    registerHitEnemy(enemy) { if (!this.hasHitEnemyThisSwing(enemy)) { this.hitEnemiesThisSwing.push(enemy); } }
    hasHitBlockThisSwing(col, row) { const blockKey = `${col},${row}`; return this.hitBlocksThisSwing.includes(blockKey); }
    registerHitBlock(col, row) { const blockKey = `${col},${row}`; if (!this.hitBlocksThisSwing.includes(blockKey)) { this.hitBlocksThisSwing.push(blockKey); } }
    pickupItem(item) {
        if (!item || !item.type) return false;
        let pickedUp = false;
        const materialType = item.type;
        const GATHER_REQUIREMENT = 4; 
        if (materialType === 'dirt' || materialType === 'vegetation') {
            this.partialCollection[materialType] = (this.partialCollection[materialType] || 0) + 1;
            pickedUp = true; 
            if (this.partialCollection[materialType] >= GATHER_REQUIREMENT) {
                this.partialCollection[materialType] = 0; 
                this.inventory[materialType] = (this.inventory[materialType] || 0) + 1; 
            }
        } else if (this.isWeaponType(materialType)) { 
            if (materialType === Config.WEAPON_TYPE_SWORD) {
                if (!this.hasSword) { this.hasSword = true; pickedUp = true; }
            } else if (materialType === Config.WEAPON_TYPE_SPEAR) {
                if (!this.hasSpear) { this.hasSpear = true; pickedUp = true; }
            } else if (materialType === Config.WEAPON_TYPE_SHOVEL) {
                if (!this.hasShovel) { this.hasShovel = true; pickedUp = true; }
            }
            if (pickedUp && this.selectedItem === Config.WEAPON_TYPE_UNARMED) {
                this.equipItem(materialType);
            }
        } else if (Config.INVENTORY_MATERIALS.includes(materialType)) { 
            this.inventory[materialType] = (this.inventory[materialType] || 0) + 1;
            pickedUp = true;
        } else {
            console.warn(`Player encountered unknown item type: ${materialType}`);
        }
        return pickedUp;
    }    
    hasWeapon(weaponType) {
        switch (weaponType) {
            case Config.WEAPON_TYPE_SWORD: return this.hasSword;
            case Config.WEAPON_TYPE_SPEAR: return this.hasSpear;
            case Config.WEAPON_TYPE_SHOVEL: return this.hasShovel;
            default: return false; 
        }
    }
    equipItem(itemType) {
        if (itemType === Config.WEAPON_TYPE_UNARMED) {
            this.selectedItem = Config.WEAPON_TYPE_UNARMED;
            this.isAttacking = false; 
            this.attackTimer = 0;
            this.placementCooldown = 0; 
            return true;
        }
        let canEquip = false;
        if (this.isWeaponType(itemType)) {
            canEquip = this.hasWeapon(itemType); 
        } else if (Config.INVENTORY_MATERIALS.includes(itemType)) {
            canEquip = (this.inventory[itemType] || 0) > 0; 
        }
        if (canEquip && this.selectedItem !== itemType) {
            this.selectedItem = itemType;
            this.isAttacking = false;
            this.attackTimer = 0;
            this.placementCooldown = 0; 
            return true;
        }
        return false; 
    }
    decrementInventory(itemType, amount = 1) { 
        if (Config.INVENTORY_MATERIALS.includes(itemType) && (this.inventory[itemType] || 0) >= amount) {
            this.inventory[itemType] -= amount;
            if (this.inventory[itemType] === 0 && this.selectedItem === itemType) {
                this.equipItem(Config.WEAPON_TYPE_UNARMED); 
            }
            return true; 
        }
        return false; 
    }
    craftItem(itemType) {
        const weaponStats = Config.WEAPON_STATS[itemType];
        const recipe = weaponStats?.recipe;
        if (!recipe || recipe.length === 0) { // Check if recipe exists and is not empty
            console.warn(`Attempted to craft non-craftable item type or item with no recipe: ${itemType}`);
            return false; 
        }
        if (this.isWeaponType(itemType) && this.hasWeapon(itemType)) {
            return false; 
        }
        let hasMaterials = true;
        for (const ingredient of recipe) {
            const requiredType = ingredient.type;
            const requiredAmount = ingredient.amount;
            const possessedAmount = this.inventory[requiredType] || 0; 
            if (possessedAmount < requiredAmount) {
                hasMaterials = false;
                break; 
            }
        }
        if (!hasMaterials) {
            return false; 
        }
        for (const ingredient of recipe) {
            if (!this.decrementInventory(ingredient.type, ingredient.amount)) {
                console.error(`Failed to consume materials while crafting ${itemType}. Inventory state may be inconsistent.`);
                return false; 
            }
        }
        let craftedSuccessfully = false;
        switch (itemType) {
            case Config.WEAPON_TYPE_SWORD:
                this.hasSword = true;
                craftedSuccessfully = true;
                break;
            case Config.WEAPON_TYPE_SPEAR:
                this.hasSpear = true;
                craftedSuccessfully = true;
                break;
            default:
                console.error(`Crafting logic for item type ${itemType} not implemented.`);
                return false; 
        }
        return craftedSuccessfully;
    }
    getPartialCollection(materialType) { return this.partialCollection[materialType] || 0;    }
    isWeaponType(itemType) { return [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL].includes(itemType); }
    isWeaponSelected() { return this.selectedItem !== Config.WEAPON_TYPE_UNARMED && this.isWeaponType(this.selectedItem); }
    isMaterialSelected() { return Config.INVENTORY_MATERIALS.includes(this.selectedItem); }
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
    getActiveInventoryMaterial() { return this.isMaterialSelected() ? this.selectedItem : null; }
    getActiveWeaponType() { return this.isWeaponSelected() || this.selectedItem === Config.WEAPON_TYPE_UNARMED ? this.selectedItem : null; }
    getCurrentAttackDamage() {
        if (!this.isWeaponSelected() || this.isDying) return 0;
        const weaponStats = Config.WEAPON_STATS[this.selectedItem];
        return weaponStats?.attackDamage ?? 0;
    }
    getCurrentBlockDamage() {
        if (this.isDying) return 0;
        const weaponStats = Config.WEAPON_STATS[this.selectedItem];
        return weaponStats?.blockDamage ?? 0;
    }
    setActiveInventoryMaterial(materialType) {
        if (this.isDying) return false;
        if (Config.INVENTORY_MATERIALS.includes(materialType)) {
            if ((this.inventory[materialType] || 0) > 0) {
                return this.equipItem(materialType);
            }
        } else {
            console.warn(`Attempted to set invalid material type via UI: ${materialType}`);
        }
        return false; 
    }
    setActiveWeapon(weaponType) {
        if (this.isDying) return false;
        if (this.isWeaponType(weaponType) || weaponType === Config.WEAPON_TYPE_UNARMED) {
            if (this.selectedItem === weaponType) {
                if (weaponType !== Config.WEAPON_TYPE_UNARMED) { 
                    return this.equipItem(Config.WEAPON_TYPE_UNARMED); 
                }
                return false;
            }
            if (this.hasWeapon(weaponType)) {
                return this.equipItem(weaponType); 
            } else {
                const weaponStats = Config.WEAPON_STATS[weaponType]; // Use correct weapon type to get stats
                const recipe = weaponStats?.recipe; // Get recipe from weaponStats
                if (recipe && recipe.length > 0) { // Check if recipe exists and is not empty
                    const crafted = this.craftItem(weaponType); 
                    if (crafted) {
                        return this.equipItem(weaponType);
                    } else {
                        return false; 
                    }
                } else {
                    return false; 
                }
            }
        } else {
            console.warn(`Attempted to set invalid weapon type via UI: ${weaponType}`);
        }
        return false; 
    }
    reset() {
        console.log("Resetting player state...");
        this.x = Config.PLAYER_START_X;
        this.y = Config.PLAYER_START_Y;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.isInWater = false;
        this.waterJumpCooldown = 0;
        this.isOnRope = false;
        this.ropeCol = -1;
        this.canGrabRopeTimer = 0;
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
        this.maxHealth = Config.PLAYER_MAX_HEALTH_DISPLAY;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.placementCooldown = 0; 
        this.hitEnemiesThisSwing = [];
        this.hitBlocksThisSwing = [];
        this.inventory = {}; 
        this.partialCollection = {};
        this.hasShovel = false;
        this.hasSword = false;
        this.hasSpear = false;
        this.selectedItem = Config.WEAPON_TYPE_UNARMED; 
        this.lastDirection = 1; 
        this._lastValidTargetWorldPos = null;
        this._lastValidTargetGridCell = null;
        this.isDying = false;
        this.deathAnimationTimer = 0;
        this.deathAnimationFrame = 0;
        this.isActive = true;
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Player RESET POSITION ERROR: NaN final coordinates! Resetting to center.`);
            this.x = Config.CANVAS_WIDTH / 2 - this.width / 2;
            this.y = Config.CANVAS_HEIGHT / 2 - this.height / 2;
        }
    }
    resetPosition() { this.die(); }
    isActive() { return this.isActive; }
}