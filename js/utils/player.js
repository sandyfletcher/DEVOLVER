// =============================================================================
// root/js/utils/player.js
// =============================================================================

import * as Config from './config.js';
import * as GridCollision from './gridCollision.js';
import * as WorldManager from '../worldManager.js';
import * as World from './world.js';
import * as DebugLogger from './debugLogger.js';
import * as ProjectileManager from '../projectileManager.js';

export class Player {
    constructor(x, y, width, height) { // 'color' param is now effectively ignored
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
        this.hasBow = false;
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
        this.jabOffset = 0;
        this.currentAttackAngle = 0; // Angle used for the current attack (center for swipe, direction for jab)
        this.currentSwipeProgress = 0; // For sword swipe animation (0 to 1)
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
            this._lastValidTargetGridCell = { ...this.targetGridCell };
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
        if (this.isAttacking && this.isWeaponSelected()) {
            const weaponStats = Config.WEAPON_STATS[this.selectedItem];
            if (weaponStats) {
                this.currentSwipeProgress = Math.min(1, Math.max(0, (weaponStats.attackDuration - this.attackTimer) / weaponStats.attackDuration));
                if (weaponStats.jabDistanceBlocks && weaponStats.jabDistanceBlocks > 0) {
                    const JAB_DISTANCE_PIXELS = weaponStats.jabDistanceBlocks * Config.BLOCK_WIDTH;
                    // Jab motion is out and back
                    this.jabOffset = JAB_DISTANCE_PIXELS * Math.sin(this.currentSwipeProgress * Math.PI);
                } else {
                    this.jabOffset = 0;
                }
            }
        } else {
            this.jabOffset = 0;
            this.currentSwipeProgress = 0;
        }
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
                this.jabOffset = 0;
                this.currentSwipeProgress = 0;
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
                        const playerCenterX = this.x + this.width / 2;
                        const playerCenterY = this.y + this.height / 2;
                        const rawTargetWorldPos = this.targetWorldPos || this._lastValidTargetWorldPos || {x: playerCenterX + this.lastDirection * 50, y: playerCenterY};
                        this.currentAttackAngle = Math.atan2(rawTargetWorldPos.y - playerCenterY, rawTargetWorldPos.x - playerCenterX);
                        this.currentSwipeProgress = 0; // Reset swipe progress at start of attack

                        if (this.selectedItem === Config.WEAPON_TYPE_BOW) {
                            if ((this.inventory['arrows'] || 0) > 0) {
                                this.decrementInventory('arrows', 1);
                                const arrowSpeed = Config.PROJECTILE_STATS[Config.PROJECTILE_TYPE_ARROW].speed;
                                const vx = Math.cos(this.currentAttackAngle) * arrowSpeed;
                                const vy = Math.sin(this.currentAttackAngle) * arrowSpeed;
                                ProjectileManager.spawnProjectile(playerCenterX, playerCenterY, vx, vy, Config.PROJECTILE_TYPE_ARROW, this);
                            } else {
                                // "Dry fire" sound could go here
                                this.isAttacking = false; // Cancel attack if no ammo
                            }
                        }
                    } else {
                        this.attackTimer = 0.1;
                        this.attackCooldown = 0.2;
                        this.currentAttackAngle = (this.lastDirection === 1) ? 0 : Math.PI;
                        this.currentSwipeProgress = 0;
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
        const overlap = playerRect.x < blockRect.x + blockRect.width && playerRect.x + playerRect.width > blockRect.x && playerRect.y < blockRect.y + blockRect.height && playerRect.y + playerRect.height > blockRect.y;
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
    draw(ctx, highlightColor) {
        if (!this.isActive && !this.isDying || !ctx) return;
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Player DRAW ERROR: Preventing draw due to NaN coordinates!`);
            return;
        }
        const pivotX = this.x + this.width / 2;
        const pivotY = this.y + this.height / 2;
        ctx.save();
        ctx.translate(pivotX, pivotY); // Move origin to player's center for transformations
        // Handle death animation transformations (spin and swell)
        let deathRotationAngle = 0;
        let deathScale = 1.0;
        if (this.isDying) {
            const totalAnimationDuration = Config.PLAYER_DEATH_ANIMATION_DURATION;
            const spinDuration = Config.PLAYER_SPIN_DURATION;
            const timeElapsed = totalAnimationDuration - this.deathAnimationTimer;
            if (timeElapsed >= 0 && timeElapsed < spinDuration) {
                deathRotationAngle = (this.deathAnimationFrame / Config.PLAYER_SPIN_FRAMES) * 2 * Math.PI;
            } else if (timeElapsed >= spinDuration && timeElapsed < totalAnimationDuration) {
                const swellProgressTime = timeElapsed - spinDuration;
                const swellPhaseDuration = totalAnimationDuration - spinDuration;
                if (swellPhaseDuration > 0) {
                    const swellProgress = swellProgressTime / swellPhaseDuration;
                    deathScale = 1.0 + (Config.ENEMY_SWELL_SCALE - 1.0) * swellProgress; // Using ENEMY_SWELL_SCALE
                }
            }
            ctx.rotate(deathRotationAngle);
            ctx.scale(deathScale, deathScale);
        }
        // Handle orientation based on lastDirection (flip if facing left)
        if (this.lastDirection === -1 && !this.isDying) { // Don't apply normal flip if spinning
            ctx.scale(-1, 1);
        }
        // --- Draw Player Body Parts (local coordinates relative to pivotX, pivotY) ---
        let drawPlayerBody = true;
        if (this.isInvulnerable && !this.isDying && Math.floor(performance.now() / 100) % 2 !== 0) {
            drawPlayerBody = false; // Skip drawing body for invulnerability flash
        }
        if (drawPlayerBody) {
            // Torso (local coords, (0,0) is player center)
            const torsoHeight = this.height * 0.65;
            const torsoWidth = this.width * 0.7;
            const torsoYOffset = this.height * 0.05; // Torso slightly lower than exact center
            ctx.fillStyle = Config.PLAYER_BODY_COLOR;
            ctx.fillRect(-torsoWidth / 2, -torsoHeight / 2 + torsoYOffset, torsoWidth, torsoHeight);
            // Head (local coords)
            const headRadius = this.width * 0.35; // Head as a circle
            const headYOffset = -torsoHeight / 2 + torsoYOffset - headRadius * 0.8; // Head on top of torso
            ctx.fillStyle = Config.PLAYER_HEAD_COLOR;
            ctx.beginPath();
            ctx.arc(0, headYOffset, headRadius, 0, Math.PI * 2);
            ctx.fill();
            // Simple Eye (always faces "screen forward" if player is flipped, so draw after flip)
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(headRadius * 0.4, headYOffset - headRadius * 0.1, headRadius * 0.2, 0, Math.PI * 2); // Eye on the "right" side of local head
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(headRadius * 0.45, headYOffset - headRadius * 0.08, headRadius * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }
        // Restore player-specific body transforms (orientation, death animation part)
        // so that arms/weapon can be drawn relative to the un-transformed, un-rotated world space player center
        ctx.restore(); // This undoes translate(pivotX,pivotY), rotate, scale(-1,1) etc.
        // --- Draw Arms and Weapon (logic remains similar, but ensure correct pivot for death animation) ---
        // If dying, arms and weapon also need to be transformed by the death animation.
        // We can re-apply the death transform here, or draw them inside the previous save/restore block
        // by transforming their target points into the player's local rotated space.
        // For simplicity, let's re-apply a similar transform for arms/weapon if dying.
        ctx.save(); // New save for arms/weapon, possibly with death animation transform
        if (this.isDying) {
            ctx.translate(pivotX, pivotY);
            ctx.rotate(deathRotationAngle);
            ctx.scale(deathScale, deathScale);
            ctx.translate(-pivotX, -pivotY); // Translate back, arm/weapon coords are world-based
        }
        let showWeapon = false;
        let weaponIsAnimated = false;
        if (this.isAttacking && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED && !this.isDying) {
            showWeapon = true;
            weaponIsAnimated = true;
        } else if (!this.isAttacking && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED && !this.isDying) {
            showWeapon = true;
            weaponIsAnimated = false;
        }
        if (showWeapon) {
            const playerCenterX = this.x + this.width / 2; // World coords
            const playerCenterY = this.y + this.height / 2; // World coords
            const rawTargetWorldPos = this.targetWorldPos || this._lastValidTargetWorldPos || {x: playerCenterX + this.lastDirection * 50, y: playerCenterY};
            let weaponStats = Config.WEAPON_STATS[this.selectedItem];
            if (!weaponStats || !weaponStats.shape || !weaponStats.visualAnchorOffset) {
                console.warn(`Player.draw: Missing weapon stats or shape/anchor for ${this.selectedItem}.`);
                ctx.restore(); return;
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
            let displayAngle = this.currentAttackAngle;
            let effectiveJabOffset = this.jabOffset;
            if (weaponIsAnimated) {
                if (this.selectedItem === Config.WEAPON_TYPE_SWORD) {
                    const swipeArcRad = (weaponStats.swipeArcDegrees || 120) * (Math.PI / 180);
                    const swipeStartOffsetRad = (weaponStats.swipeStartOffsetDegrees || -60) * (Math.PI / 180);
                    displayAngle = this.currentAttackAngle + swipeStartOffsetRad + (swipeArcRad * this.currentSwipeProgress);
                    effectiveJabOffset = 0;
                }
            } else {
                displayAngle = Math.atan2(clampedTargetY - playerCenterY, clampedTargetX - playerCenterX);
                effectiveJabOffset = 0;
            }
            const rotatedAnchorOffsetX = visualAnchorOffsetX * Math.cos(displayAngle) - visualAnchorOffsetY * Math.sin(displayAngle);
            const rotatedAnchorOffsetY = visualAnchorOffsetX * Math.sin(displayAngle) + visualAnchorOffsetY * Math.cos(displayAngle);
            let finalWeaponPivotX = clampedTargetX - rotatedAnchorOffsetX;
            let finalWeaponPivotY = clampedTargetY - rotatedAnchorOffsetY;
            if (effectiveJabOffset !== 0 && (this.selectedItem === Config.WEAPON_TYPE_SHOVEL || this.selectedItem === Config.WEAPON_TYPE_SPEAR)) {
                finalWeaponPivotX += effectiveJabOffset * Math.cos(this.currentAttackAngle); // Use this.currentAttackAngle
                finalWeaponPivotY += effectiveJabOffset * Math.sin(this.currentAttackAngle); // Use this.currentAttackAngle
            }
            const shoulderOffsetPxX = this.width * Config.PLAYER_SHOULDER_OFFSET_X_FACTOR;
            const shoulderOffsetPxY = this.height * Config.PLAYER_SHOULDER_OFFSET_Y_FACTOR;
            const shoulderRightX = this.x + (this.width - shoulderOffsetPxX); // World coords
            const shoulderRightY = this.y + shoulderOffsetPxY; // World coords
            const shoulderLeftX = this.x + shoulderOffsetPxX;   // World coords
            const shoulderLeftY = this.y + shoulderOffsetPxY;  // World coords
            let frontShoulderX, frontShoulderY;
            let backShoulderX, backShoulderY;
            if (this.lastDirection === 1) {
                frontShoulderX = shoulderRightX; frontShoulderY = shoulderRightY;
                backShoulderX = shoulderLeftX; backShoulderY = shoulderLeftY;
            } else {
                frontShoulderX = shoulderLeftX; frontShoulderY = shoulderLeftY;
                backShoulderX = shoulderRightX; backShoulderY = shoulderRightY;
            }
            let frontHandWorldX, frontHandWorldY;
            let backHandWorldX, backHandWorldY;
            if (weaponStats.handPositions && weaponStats.handPositions.front && weaponStats.handPositions.back) {
                const localFrontHand = weaponStats.handPositions.front;
                const localBackHand = weaponStats.handPositions.back;
                frontHandWorldX = finalWeaponPivotX + (localFrontHand.x * Math.cos(displayAngle) - localFrontHand.y * Math.sin(displayAngle));
                frontHandWorldY = finalWeaponPivotY + (localFrontHand.x * Math.sin(displayAngle) + localFrontHand.y * Math.cos(displayAngle));
                backHandWorldX = finalWeaponPivotX + (localBackHand.x * Math.cos(displayAngle) - localBackHand.y * Math.sin(displayAngle));
                backHandWorldY = finalWeaponPivotY + (localBackHand.x * Math.sin(displayAngle) + localBackHand.y * Math.cos(displayAngle));
            } else {
                frontHandWorldX = finalWeaponPivotX; frontHandWorldY = finalWeaponPivotY;
                backHandWorldX = finalWeaponPivotX; backHandWorldY = finalWeaponPivotY;
            }
            const frontArmAngle = Math.atan2(frontHandWorldY - frontShoulderY, frontHandWorldX - frontShoulderX);
            let frontArmLength = Math.sqrt(Math.pow(frontHandWorldX - frontShoulderX, 2) + Math.pow(frontHandWorldY - frontShoulderY, 2));
            const backArmAngle = Math.atan2(backHandWorldY - backShoulderY, backHandWorldX - backShoulderX);
            let backArmLength = Math.sqrt(Math.pow(backHandWorldX - backShoulderX, 2) + Math.pow(backHandWorldY - backShoulderY, 2));
            const maxArmLength = this.width * 2;
            frontArmLength = Math.min(frontArmLength, maxArmLength);
            backArmLength = Math.min(backArmLength, maxArmLength * 0.9);
            frontArmLength = Math.max(0, frontArmLength);
            backArmLength = Math.max(0, backArmLength);
            // Draw back arm (relative to its shoulder)
            ctx.save(); ctx.translate(backShoulderX, backShoulderY); ctx.rotate(backArmAngle);
            ctx.fillStyle = Config.ARM_COLOR; ctx.fillRect(0, -Config.ARM_THICKNESS / 2, backArmLength, Config.ARM_THICKNESS);
            ctx.restore();
            // Draw weapon (relative to its pivot)
            ctx.save();
            ctx.translate(finalWeaponPivotX, finalWeaponPivotY);
            ctx.rotate(displayAngle);
            weaponStats.shape.forEach(shapeDef => {
                const fillColor = shapeDef.isBlade ? highlightColor : (shapeDef.color || weaponStats.color || 'magenta');
                ctx.fillStyle = fillColor;
                if (shapeDef.type === 'rect') {
                    ctx.fillRect(Math.floor(shapeDef.x), Math.floor(shapeDef.y), Math.ceil(shapeDef.w), Math.ceil(shapeDef.h));
                    if (weaponStats.outlineColor && weaponStats.outlineWidth) {
                        ctx.strokeStyle = weaponStats.outlineColor; ctx.lineWidth = weaponStats.outlineWidth;
                        const inset = ctx.lineWidth / 2;
                        ctx.strokeRect( Math.floor(shapeDef.x) + inset, Math.floor(shapeDef.y) + inset, Math.ceil(shapeDef.w) - ctx.lineWidth, Math.ceil(shapeDef.h) - ctx.lineWidth);
                    }
                } else if (shapeDef.type === 'triangle') {
                    ctx.beginPath();
                    ctx.moveTo(Math.floor(shapeDef.p1.x), Math.floor(shapeDef.p1.y));
                    ctx.lineTo(Math.floor(shapeDef.p2.x), Math.floor(shapeDef.p2.y));
                    ctx.lineTo(Math.floor(shapeDef.p3.x), Math.floor(shapeDef.p3.y));
                    ctx.closePath(); ctx.fill();
                    if (weaponStats.outlineColor && weaponStats.outlineWidth) {
                        ctx.strokeStyle = weaponStats.outlineColor; ctx.lineWidth = weaponStats.outlineWidth; ctx.stroke();
                    }
                } else if (shapeDef.type === 'polygon' && shapeDef.points) {
                    ctx.beginPath();
                    shapeDef.points.forEach((p, index) => {
                        if (index === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    });
                    ctx.closePath();
                    ctx.fill();
                    if (weaponStats.outlineColor && weaponStats.outlineWidth) {
                        ctx.strokeStyle = weaponStats.outlineColor;
                        ctx.lineWidth = weaponStats.outlineWidth;
                        ctx.stroke();
                    }
                }
            });
            ctx.restore();
            // Draw front arm (relative to its shoulder)
            ctx.save();
            ctx.translate(frontShoulderX, frontShoulderY); ctx.rotate(frontArmAngle);
            ctx.fillStyle = Config.ARM_COLOR; ctx.fillRect(0, -Config.ARM_THICKNESS / 2, frontArmLength, Config.ARM_THICKNESS);
            ctx.restore();
        }
        ctx.restore(); // Restore from death animation transform or main arm/weapon save
        // Draw attack hitbox (for debugging, outside player transforms)
        if (this.isAttacking && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED && !this.isDying) {
            const hitboxData = this.getAttackHitbox();
            if (hitboxData) {
                const weaponStats = Config.WEAPON_STATS[this.selectedItem];
                let hitboxColor = weaponStats?.attackColor || 'rgba(255, 0, 0, 0.5)';
                ctx.fillStyle = hitboxColor;

                if (hitboxData.type === 'rect') {
                    const { x, y, width, height } = hitboxData.bounds;
                    if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof height === 'number' && !isNaN(x) && !isNaN(y) && !isNaN(width) && !isNaN(height)) {
                        ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(width), Math.ceil(height));
                    }
                } else if (hitboxData.type === 'triangle') {
                    const v = hitboxData.vertices;
                    if (v && v.length === 3 && v.every(p => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y))) {
                        ctx.beginPath();
                        ctx.moveTo(Math.floor(v[0].x), Math.floor(v[0].y));
                        ctx.lineTo(Math.floor(v[1].x), Math.floor(v[1].y));
                        ctx.lineTo(Math.floor(v[2].x), Math.floor(v[2].y));
                        ctx.closePath();
                        ctx.fill();
                    }
                } else if (hitboxData.type === 'polygon' && hitboxData.vertices.length === 4) {
                    const v = hitboxData.vertices;
                    if (v && v.length === 4 && v.every(p => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y))) {
                        ctx.beginPath();
                        ctx.moveTo(Math.floor(v[0].x), Math.floor(v[0].y));
                        for (let i = 1; i < v.length; i++) {
                            ctx.lineTo(Math.floor(v[i].x), Math.floor(v[i].y));
                        }
                        ctx.closePath();
                        ctx.fill();
                    }
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
        if (this.selectedItem === Config.WEAPON_TYPE_BOW) {
            return null; // Bow doesn't have a melee hitbox
        }
        const weaponStats = Config.WEAPON_STATS[this.selectedItem];
        if (!weaponStats) return null;
        const playerCenterX = this.x + this.width / 2;
        const playerCenterY = this.y + this.height / 2;
        const baseAttackAngle = this.currentAttackAngle;
        let effectiveJabOffset = this.jabOffset;
        let currentVisualAngle = baseAttackAngle;
        const rawTargetWorldPos = this.targetWorldPos || this._lastValidTargetWorldPos || {x: playerCenterX + this.lastDirection * 50, y: playerCenterY};
        const visualAnchorOffsetX = weaponStats.visualAnchorOffset.x;
        const visualAnchorOffsetY = weaponStats.visualAnchorOffset.y;
        const dx_to_raw = rawTargetWorldPos.x - playerCenterX;
        const dy_to_raw = rawTargetWorldPos.y - playerCenterY;
        const dist_to_raw = Math.sqrt(dx_to_raw * dx_to_raw + dy_to_raw * dy_to_raw);
        let maxVisualReach;
        if (weaponStats.attackReachY === undefined) {
            maxVisualReach = weaponStats.attackReachX;
        } else {
            maxVisualReach = Math.sqrt((weaponStats.attackReachX**2) + (weaponStats.attackReachY**2));
        }
        maxVisualReach = Math.max(maxVisualReach, weaponStats.width, weaponStats.height, Config.BLOCK_WIDTH * 2);
        let clampedTargetX = rawTargetWorldPos.x;
        let clampedTargetY = rawTargetWorldPos.y;
        if (dist_to_raw > maxVisualReach + GridCollision.E_EPSILON) {
            if (dist_to_raw > GridCollision.E_EPSILON) {
                clampedTargetX = playerCenterX + (dx_to_raw / dist_to_raw) * maxVisualReach;
                clampedTargetY = playerCenterY + (dy_to_raw / dist_to_raw) * maxVisualReach;
            } else {
                clampedTargetX = playerCenterX + this.lastDirection * maxVisualReach;
                clampedTargetY = playerCenterY;
            }
        } else if (dist_to_raw < GridCollision.E_EPSILON) {
            clampedTargetX = playerCenterX + this.lastDirection * (maxVisualReach * 0.1);
            clampedTargetY = playerCenterY;
        }
        if (this.selectedItem === Config.WEAPON_TYPE_SWORD) {
            const swipeArcRad = (weaponStats.swipeArcDegrees || 120) * (Math.PI / 180);
            const swipeStartOffsetRad = (weaponStats.swipeStartOffsetDegrees || -60) * (Math.PI / 180);
            currentVisualAngle = baseAttackAngle + swipeStartOffsetRad + (swipeArcRad * this.currentSwipeProgress);
            effectiveJabOffset = 0;
        }
        const rotatedAnchorOffsetX = visualAnchorOffsetX * Math.cos(currentVisualAngle) - visualAnchorOffsetY * Math.sin(currentVisualAngle);
        const rotatedAnchorOffsetY = visualAnchorOffsetX * Math.sin(currentVisualAngle) + visualAnchorOffsetY * Math.cos(currentVisualAngle);
        let weaponPivotX = clampedTargetX - rotatedAnchorOffsetX;
        let weaponPivotY = clampedTargetY - rotatedAnchorOffsetY;
        if (effectiveJabOffset !== 0 && (this.selectedItem === Config.WEAPON_TYPE_SHOVEL || this.selectedItem === Config.WEAPON_TYPE_SPEAR)) {
            weaponPivotX += effectiveJabOffset * Math.cos(baseAttackAngle);
            weaponPivotY += effectiveJabOffset * Math.sin(baseAttackAngle);
        }
        const bladeShape = weaponStats.shape.find(s => s.isBlade === true);
        if (!bladeShape) {
            console.warn(`No 'isBlade' shape found for weapon ${this.selectedItem}`);
            return null;
        }
        if (bladeShape.type === 'triangle') {
            const worldVertices = [bladeShape.p1, bladeShape.p2, bladeShape.p3].map(pLocal => {
                const rotatedX = pLocal.x * Math.cos(currentVisualAngle) - pLocal.y * Math.sin(currentVisualAngle);
                const rotatedY = pLocal.x * Math.sin(currentVisualAngle) + pLocal.y * Math.cos(currentVisualAngle);
                return {
                    x: weaponPivotX + rotatedX,
                    y: weaponPivotY + rotatedY
                };
            });
            return { type: 'triangle', vertices: worldVertices };
        } else if (bladeShape.type === 'rect') {
            const { x: localX, y: localY, w, h } = bladeShape;
            const localCorners = [
                { x: localX, y: localY },
                { x: localX + w, y: localY },
                { x: localX + w, y: localY + h },
                { x: localX, y: localY + h }
            ];
            const worldVertices = localCorners.map(pLocal => {
                const rotatedX = pLocal.x * Math.cos(currentVisualAngle) - pLocal.y * Math.sin(currentVisualAngle);
                const rotatedY = pLocal.x * Math.sin(currentVisualAngle) + pLocal.y * Math.cos(currentVisualAngle);
                return {
                    x: weaponPivotX + rotatedX,
                    y: weaponPivotY + rotatedY
                };
            });
            return { type: 'polygon', vertices: worldVertices };
        }
        return null;
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
            } else if (materialType === Config.WEAPON_TYPE_BOW) {
                if (!this.hasBow) { this.hasBow = true; pickedUp = true; }
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
            case Config.WEAPON_TYPE_BOW: return this.hasBow;
            default: return false;
        }
    }
    equipItem(itemType) {
        if (this.isDying) return false;
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
        if (!recipe || recipe.length === 0) {
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
            case Config.WEAPON_TYPE_SWORD: this.hasSword = true; craftedSuccessfully = true; break;
            case Config.WEAPON_TYPE_SPEAR: this.hasSpear = true; craftedSuccessfully = true; break;
            case Config.WEAPON_TYPE_BOW: this.hasBow = true; craftedSuccessfully = true; break;
            default: console.error(`Crafting logic for item type ${itemType} not implemented.`); return false;
        }
        return craftedSuccessfully;
    }
    craftAmmo(weaponType) {
        const weaponStats = Config.WEAPON_STATS[weaponType];
        if (!weaponStats || !weaponStats.ammoType || !weaponStats.ammoRecipe) {
            return false;
        }

        const ammoType = weaponStats.ammoType;
        const recipe = weaponStats.ammoRecipe;

        let hasMaterials = true;
        for (const ingredient of recipe) {
            if ((this.inventory[ingredient.type] || 0) < ingredient.amount) {
                hasMaterials = false;
                break;
            }
        }

        if (hasMaterials) {
            for (const ingredient of recipe) {
                this.decrementInventory(ingredient.type, ingredient.amount);
            }
            this.inventory[ammoType] = (this.inventory[ammoType] || 0) + 1;
            return true;
        }
        return false;
    }
    getPartialCollection(materialType) { return this.partialCollection[materialType] || 0;    }
    isWeaponType(itemType) { return [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL, Config.WEAPON_TYPE_BOW].includes(itemType); }
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
    getCurrentWeaponKnockback() {
        if (!this.isWeaponSelected() || this.isDying) return 0;
        const weaponStats = Config.WEAPON_STATS[this.selectedItem];
        return weaponStats?.knockbackStrength ?? 0;
    }
    getCurrentWeaponKnockbackStunDuration() {
        if (!this.isWeaponSelected() || this.isDying) return 0;
        const weaponStats = Config.WEAPON_STATS[this.selectedItem];
        return weaponStats?.knockbackStunDuration ?? 0;
    }
    setActiveInventoryMaterial(materialType) {
        if (this.isDying) return false;
        if (Config.INVENTORY_MATERIALS.includes(materialType)) {
            // Arrows are not a placeable material
            if (materialType === 'arrows') return false;
            
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
            // Special case for Bow: if already selected, craft ammo instead of unequipping
            if (this.selectedItem === Config.WEAPON_TYPE_BOW && weaponType === Config.WEAPON_TYPE_BOW) {
                return this.craftAmmo(Config.WEAPON_TYPE_BOW);
            }

            if (this.selectedItem === weaponType) {
                if (weaponType !== Config.WEAPON_TYPE_UNARMED) {
                    return this.equipItem(Config.WEAPON_TYPE_UNARMED);
                }
                return false;
            }
            if (this.hasWeapon(weaponType)) {
                return this.equipItem(weaponType);
            } else {
                const weaponStats = Config.WEAPON_STATS[weaponType];
                const recipe = weaponStats?.recipe;
                if (recipe && recipe.length > 0) {
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
        this.hasBow = false;
        this.selectedItem = Config.WEAPON_TYPE_UNARMED;
        this.lastDirection = 1;
        this._lastValidTargetWorldPos = null;
        this._lastValidTargetGridCell = null;
        this.isDying = false;
        this.deathAnimationTimer = 0;
        this.deathAnimationFrame = 0;
        this.isActive = true;
        this.jabOffset = 0;
        this.currentAttackAngle = 0;
        this.currentSwipeProgress = 0;
        if (Config.DEBUG_MODE) {
            DebugLogger.log(">>> Player DEBUG MODE: Granting starting materials and weapons.");
            Config.INVENTORY_MATERIALS.forEach(materialType => {
                if (materialType !== 'arrows') {
                    this.inventory[materialType] = Config.DEBUG_STARTING_MATERIALS_COUNT;
                }
            });
            this.inventory['arrows'] = Config.DEBUG_STARTING_ARROWS;
            this.hasShovel = true;
            this.hasSword = true;
            this.hasSpear = true;
            this.hasBow = true;
            if (this.selectedItem === Config.WEAPON_TYPE_UNARMED) {
                this.equipItem(Config.WEAPON_TYPE_SHOVEL); // Equip shovel by default in debug
            }
        }
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Player RESET POSITION ERROR: NaN final coordinates! Resetting to center.`);
            this.x = Config.CANVAS_WIDTH / 2 - this.width / 2;
            this.y = Config.CANVAS_HEIGHT / 2 - this.height / 2;
        }
    }
    resetPosition() { this.die(); }
}