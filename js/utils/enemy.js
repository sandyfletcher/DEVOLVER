// -----------------------------------------------------------------------------
// root/js/enemy.js - Enemy Class (Refactored for Config & AI Strategy)
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as ItemManager from '../itemManager.js';
import * as GridCollision from './gridCollision.js'; // E_EPSILON is used here
import { E_EPSILON } from './gridCollision.js'; // Explicitly import if not relying on wildcard
import { SeekCenterAI } from './ai/seekCenterAI.js';
import { ChasePlayerAI } from './ai/chasePlayerAI.js';
import { FlopAI } from './ai/flopAI.js';
import { DunkleosteusAI } from './ai/dunkleosteusAI.js';
import { FishAI } from './ai/fishAI.js';
import * as AudioManager from '../audioManager.js';

const aiStrategyMap = {
    'seekCenter': SeekCenterAI,
    'chasePlayer': ChasePlayerAI,
    'flopAI': FlopAI,
    'dunkleosteusAI': DunkleosteusAI,
    'fishAI': FishAI,
};
export class Enemy {
    constructor(x, y, enemyType) {
        this.type = enemyType;
        const stats = Config.ENEMY_STATS[this.type];
        let rawStats;
        if (!stats) {
            console.error(`>>> Enemy CONSTRUCTOR: Unknown enemy type "${enemyType}". Using fallback stats.`);
            const fallbackStats = Config.ENEMY_STATS[Config.ENEMY_TYPE_CENTER_SEEKER] || {};
            rawStats = {
                displayName: "Unknown (Fallback)",
                aiType: 'seekCenter',
                color: 'purple',
                width_BLOCKS: Config.DEFAULT_ENEMY_WIDTH,
                height_BLOCKS: Config.DEFAULT_ENEMY_HEIGHT,
                maxSpeedX_BLOCKS_PER_SEC: 30,
                maxSpeedY_BLOCKS_PER_SEC: 50,
                swimSpeed_BLOCKS_PER_SEC: 50,
                health: 1,
                contactDamage: 1,
                applyGravity: true,
                gravityFactor: 1.0,
                canJump: false,
                jumpVelocity_BLOCKS_PER_SEC: 0,
                canSwim: false,
                canFly: false,
                separationFactor: Config.DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR,
                separationStrength_BLOCKS_PER_SEC: Config.DEFAULT_ENEMY_SEPARATION_STRENGTH / Config.BLOCK_WIDTH,
                landHopHorizontalVelocity_BLOCKS_PER_SEC: 0,
                dropTable: [],
                ...fallbackStats
            };
        } else {
            rawStats = { ...stats };
        }
        this.stats = rawStats;

        this.width = this.stats.width_BLOCKS * Config.BLOCK_WIDTH;
        this.height = this.stats.height_BLOCKS * Config.BLOCK_HEIGHT;
        this.x = x;
        this.y = y;
        this.color = this.stats.color;
        this.health = this.stats.health;
        this.displayName = this.stats.displayName;
        this.maxSpeedX = this.stats.maxSpeedX_BLOCKS_PER_SEC * Config.BLOCK_WIDTH;
        this.maxSpeedY = this.stats.maxSpeedY_BLOCKS_PER_SEC * Config.BLOCK_HEIGHT;
        this.swimSpeed = this.stats.swimSpeed_BLOCKS_PER_SEC * Config.BLOCK_HEIGHT;
        this.jumpVelocity = this.stats.jumpVelocity_BLOCKS_PER_SEC * Config.BLOCK_HEIGHT;
        this.separationStrength = this.stats.separationStrength_BLOCKS_PER_SEC * Config.BLOCK_WIDTH;
        this.landHopHorizontalVelocity = this.stats.landHopHorizontalVelocity_BLOCKS_PER_SEC * Config.BLOCK_WIDTH;
        this.canSwim = this.stats.canSwim ?? false;
        this.canFly = this.stats.canFly ?? false;
        this.applyGravityDefault = this.stats.applyGravity ?? !(this.canFly);
        this.canJump = this.stats.canJump ?? false;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.isActive = true;
        this.isInWater = false;
        this.waterJumpCooldown = 0;
        this.isFlopAttacking = false;
        this.isFlashing = false;
        this.flashTimer = 0;
        this.flashDuration = Config.ENEMY_FLASH_DURATION;
        this.isDying = false;
        this.deathAnimationTimer = 0;
        this.isBeingAbsorbed = false;
        this.absorptionProgress = 0;
        this.lastDirection = (Math.random() < 0.5) ? -1 : 1;

        // New properties for stun
        this.isStunned = false;
        this.stunTimer = 0;

        const AIStrategyClass = aiStrategyMap[this.stats.aiType];
        if (AIStrategyClass) {
            this.aiStrategy = new AIStrategyClass(this);
        } else {
            console.error(`>>> Enemy CONSTRUCTOR: AI strategy type "${this.stats.aiType}" not found for enemy "${this.displayName}".`);
            this.aiStrategy = {
                decideMovement: () => ({ targetVx: 0, jump: false, targetVy: 0 }),
                reactToCollision: () => {},
            };
        }

        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Enemy CONSTRUCTOR ERROR: NaN coordinates! Type: ${this.type}. Resetting.`);
            this.x = Config.CANVAS_WIDTH / 2;
            this.y = 50;
        }
    }

    update(dt, playerPosition, allEnemies) {
        if (!this.isActive && !this.isDying) return;
        if (this.isBeingAbsorbed) {
            return;
        }

        const validDt = (typeof dt === 'number' && !isNaN(dt) && dt >= 0) ? dt : 0;

        if (this.isDying) {
            this.deathAnimationTimer -= validDt;
            if (this.deathAnimationTimer <= 0) {
                this.isActive = false;
                this.isDying = false;
            }
            return;
        }
        
        if (this.isStunned) {
            this.stunTimer -= validDt;
            if (this.stunTimer <= 0) {
                this.isStunned = false;
                this.stunTimer = 0;
            } else {
                // Apply minimal physics during stun
                if (this.applyGravityDefault && !this.isOnGround && !this.canFly && !(this.canSwim && this.isInWater)) {
                     let currentGravity = Config.GRAVITY_ACCELERATION * (this.stats.gravityFactor ?? 1.0);
                     const gravityMultiplier = (this.isInWater && !this.canSwim) ? Config.WATER_GRAVITY_FACTOR : 1.0;
                     this.vy += currentGravity * gravityMultiplier * validDt;
                     this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED);
                }
                if (this.isInWater) { // Apply damping if in water
                    this.vx *= Math.pow(Config.WATER_HORIZONTAL_DAMPING, validDt);
                    this.vy *= Math.pow(Config.WATER_VERTICAL_DAMPING, validDt);
                }

                const potentialMoveX = this.vx * validDt;
                const potentialMoveY = this.vy * validDt;
                const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
                this.isOnGround = collisionResult.isOnGround;

                if (collisionResult.collidedX) this.vx *= -0.3; // Dampen and bounce
                if (collisionResult.collidedY) this.vy *= -0.3; // Dampen and bounce
                
                // Boundary checks
                if (this.x < 0) { this.x = 0; if (this.vx < 0) this.vx = 0; }
                if (this.x + this.width > Config.CANVAS_WIDTH) { this.x = Config.CANVAS_WIDTH - this.width; if (this.vx > 0) this.vx = 0; }
                if (this.y > Config.CANVAS_HEIGHT + 200) { this.die(false); } // Despawn if falls out of world
                return; // Skip normal AI and physics updates while stunned
            }
        }
        
        // If dt was originally invalid and we used validDt = 0, skip the rest of the update for this frame.
        if (dt !== validDt) {
            console.warn(`Enemy(${this.displayName}) Update: Invalid delta time (${dt}). Using 0 for this frame's main logic.`);
            return;
        }

        // Original dt is now confirmed valid for the rest of the logic
        if (this.isFlashing) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                this.isFlashing = false;
            }
        }
        if (this.waterJumpCooldown > 0) this.waterJumpCooldown -= dt;

        this.isInWater = GridCollision.isEntityInWater(this);

        if (this.type === Config.ENEMY_TYPE_DUNKLEOSTEUS && !this.isInWater && this.health > 0) {
            const damagePerSecond = this.stats.outOfWaterDamagePerSecond ?? 0;
            if (damagePerSecond > 0) {
                const damageThisFrame = damagePerSecond * dt;
                this.takeDamage(damageThisFrame);
                 if (this.isDying) return; // Exit if damage caused death
            }
        }

        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Enemy UPDATE ERROR (${this.displayName}): Skipping update due to NaN coordinates!`);
            return;
        }

        if (Math.abs(this.vx) > E_EPSILON) {
            this.lastDirection = Math.sign(this.vx);
        }

        const aiDecision = this.aiStrategy.decideMovement(playerPosition, allEnemies, dt);
        let targetVx = aiDecision?.targetVx ?? 0;
        let targetVy = aiDecision?.targetVy ?? 0;
        let wantsJump = aiDecision?.jump ?? false;

        let separationForceX = 0;
        let separationForceY = 0;
        let neighborsCount = 0;
        const separationRadius = this.width * (this.stats.separationFactor ?? Config.DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR);
        const separationRadiusSq = separationRadius * separationRadius;

        if (allEnemies) {
            for (const otherEnemy of allEnemies) {
                if (otherEnemy === this || !otherEnemy.isActive || otherEnemy.isDying || otherEnemy.isBeingAbsorbed) continue;
                const dx = this.x - otherEnemy.x;
                const dy = this.y - otherEnemy.y;
                const distSq = dx * dx + dy * dy;
                if (distSq > 0 && distSq < separationRadiusSq) {
                    const dist = Math.sqrt(distSq);
                    if (dist > E_EPSILON) {
                        const repelStrength = (1.0 - (dist / separationRadius));
                        separationForceX += (dx / dist) * repelStrength;
                        separationForceY += (dy / dist) * repelStrength * 0.5;
                        neighborsCount++;
                    }
                }
            }
        }

        if (neighborsCount > 0) {
            const separationBoostX = separationForceX * this.separationStrength * dt;
            const separationBoostY = separationForceY * this.separationStrength * dt;
            this.vx += separationBoostX;
            this.vy += separationBoostY;
        }

        let currentGravity = Config.GRAVITY_ACCELERATION * (this.stats.gravityFactor ?? 1.0);
        let useStandardGravity = this.applyGravityDefault;
        let applyWaterEffects = false;

        if (this.canFly && !this.isOnGround) {
            useStandardGravity = false;
            this.vy = targetVy;
            this.vy = Math.max(-this.maxSpeedY, Math.min(this.maxSpeedY, this.vy));
            this.vx = targetVx;
        } else if (this.canSwim && this.isInWater) {
            useStandardGravity = false;
            this.vy = targetVy;
            this.vy = Math.max(-this.swimSpeed, Math.min(this.swimSpeed, this.vy));
            this.vx = targetVx;
            this.vx *= Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt);
            this.vy *= Math.pow(Config.WATER_VERTICAL_DAMPING, dt);
        } else {
            applyWaterEffects = this.isInWater;
            if (applyWaterEffects) {
                this.vy -= Config.ENEMY_WATER_BUOYANCY_ACCEL * dt;
            }
            if (useStandardGravity && !this.isOnGround) {
                const gravityMultiplier = applyWaterEffects ? Config.WATER_GRAVITY_FACTOR : 1.0;
                this.vy += currentGravity * gravityMultiplier * dt;
            } else if (this.isOnGround && this.vy > E_EPSILON) {
                this.vy = 0;
            }
            if (applyWaterEffects) {
                this.vy *= Math.pow(Config.WATER_VERTICAL_DAMPING, dt);
            }
            if (wantsJump && this.canJump) {
                if (applyWaterEffects) {
                    if (this.waterJumpCooldown <= 0) {
                        this.vy = -(this.jumpVelocity * 0.8);
                        this.waterJumpCooldown = Config.WATER_JUMP_COOLDOWN_DURATION;
                        this.isOnGround = false;
                    }
                } else if (this.isOnGround) {
                    this.vy = -this.jumpVelocity;
                    this.isOnGround = false;
                }
            }
            this.vx = targetVx;
            if (applyWaterEffects) {
                this.vx *= Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt);
            }
        }

        const currentMaxSpeedX = this.isInWater && !this.canSwim ? this.maxSpeedX * Config.WATER_MAX_SPEED_FACTOR : this.maxSpeedX;
        this.vx = Math.max(-currentMaxSpeedX, Math.min(currentMaxSpeedX, this.vx));

        if (applyWaterEffects) {
            this.vy = Math.max(this.vy, -Config.WATER_MAX_SWIM_UP_SPEED);
            this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED);
        } else if (!this.canFly && !this.isInWater) {
            this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED);
        }

        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;

        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround;

        if (this.canFly && targetVy < 0 && collisionResult.collidedY && this.vy >= 0) {
            // Keep existing logic for flyers, if any specific handling is desired.
        } else {
            if (collisionResult.collidedX) this.vx = 0;
            if (collisionResult.collidedY) this.vy = 0;
        }

        this.aiStrategy.reactToCollision(collisionResult);

        if (this.x < 0) { this.x = 0; if (this.vx < 0) this.vx = 0; }
        if (this.x + this.width > Config.CANVAS_WIDTH) { this.x = Config.CANVAS_WIDTH - this.width; if (this.vx > 0) this.vx = 0; }
        if (this.y > Config.CANVAS_HEIGHT + 200) {
            this.die(false);
        }
    }

    applyKnockback(knockbackDirX, knockbackDirY, knockbackStrength, knockbackStunDuration) {
        if (this.isDying || this.isBeingAbsorbed) return;

        const magnitude = Math.sqrt(knockbackDirX * knockbackDirX + knockbackDirY * knockbackDirY);
        let normalizedDirX = 0;
        let normalizedDirY = 0;

        if (magnitude > E_EPSILON) {
            normalizedDirX = knockbackDirX / magnitude;
            normalizedDirY = knockbackDirY / magnitude;
        } else {
            normalizedDirY = -1; // Default to upward if no direction
        }

        this.vx += normalizedDirX * knockbackStrength;
        this.vy += normalizedDirY * knockbackStrength;
        this.isOnGround = false; // Knockback usually lifts off ground

        if (knockbackStunDuration > 0) {
            this.isStunned = true;
            this.stunTimer = knockbackStunDuration;
            // Interrupt AI's current action if it has such a method
            if (this.aiStrategy && typeof this.aiStrategy.interrupt === 'function') {
                 this.aiStrategy.interrupt();
            }
        }
    }

    takeDamage(amount) {
        if (this.isBeingAbsorbed || !this.isActive || this.isDying || this.isFlashing) return;
        const healthBefore = this.health;
        this.health -= amount;
        this.isFlashing = true;
        this.flashTimer = this.flashDuration;
        if (this.health <= 0) {
            this.die(true);
        }
    }
    
    die(killedByPlayer = true) {
        if (!this.isActive || this.isDying) return;
        this.vx = 0;
        this.vy = 0;
        this.isFlopAttacking = false;
        this.isDying = true;
        this.deathAnimationTimer = Config.ENEMY_DEATH_ANIMATION_DURATION;
        if (killedByPlayer && !this.isBeingAbsorbed && this.stats.dropTable && this.stats.dropTable.length > 0) {
            if (typeof this.x !== 'number' || typeof this.y !== 'number' || isNaN(this.x) || isNaN(this.y)) {
                console.error(`>>> ${this.displayName} died with invalid coordinates [${this.x}, ${this.y}], skipping drop spawn.`);
            } else {
                this.stats.dropTable.forEach(dropInfo => {
                    if (Math.random() < (dropInfo.chance ?? 0)) {
                        const min = dropInfo.minAmount ?? 1;
                        const max = dropInfo.maxAmount ?? 1;
                        const amount = Math.floor(Math.random() * (max - min + 1)) + min;
                        for (let i = 0; i < amount; i++) {
                            let dropXBase = this.x + this.width / 2;
                            let dropYBase = this.y + this.height / 2;
                            let dropX = dropXBase + (Math.random() - 0.5) * this.width * 0.5;
                            let dropY = dropYBase + (Math.random() - 0.5) * this.height * 0.5;
                            if (!isNaN(dropX) && !isNaN(dropY) && typeof dropX === 'number' && typeof dropY === 'number') {
                                ItemManager.spawnItem(dropX, dropY, dropInfo.type);
                            } else {
                                console.error(`>>> ITEM SPAWN FAILED: Invalid drop coordinates [${dropX}, ${dropY}] for ${dropInfo.type} from ${this.displayName} death.`);
                            }
                        }
                    }
                });
            }
        }
    }

    getPosition() {
        return { x: this.x, y: this.y };
    }

    getRect() {
        const safeX = (typeof this.x === 'number' && !isNaN(this.x)) ? this.x : 0;
        const safeY = (typeof this.y === 'number' && !isNaN(this.y)) ? this.y : 0;
        return { x: safeX, y: safeY, width: this.width, height: this.height };
    }

    draw(ctx) {
        if (!this.isActive && !this.isDying || !ctx) return;
        if (this.isBeingAbsorbed) { return; }
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Enemy DRAW ERROR (${this.displayName}): Preventing draw due to NaN coordinates!`);
            return;
        }

        if (this.isDying) {
            ctx.save();
            const totalAnimationDuration = Config.ENEMY_DEATH_ANIMATION_DURATION;
            const swellDuration = Config.ENEMY_SWELL_DURATION;
            const timeElapsed = totalAnimationDuration - this.deathAnimationTimer;
            let currentScale = 1.0;
            if (timeElapsed >= 0 && timeElapsed < swellDuration) {
                const swellProgress = timeElapsed / swellDuration;
                currentScale = 1.0 + (Config.ENEMY_SWELL_SCALE - 1.0) * swellProgress;
            } else {
                ctx.restore();
                return;
            }
            const pivotX = this.x + this.width / 2;
            const pivotY = this.y + this.height / 2;
            ctx.translate(pivotX, pivotY);
            ctx.scale(currentScale, currentScale);
            ctx.translate(-pivotX, -pivotY);
            ctx.fillStyle = this.color;
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
            ctx.restore();
            return;
        }
        
        const visualShape = this.stats.visualShape;
        if (visualShape) {
            ctx.save();
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            const orientationAngle = (this.lastDirection === 1) ? 0 : Math.PI;
            ctx.translate(centerX, centerY);
            ctx.rotate(orientationAngle);
            if (visualShape.tail && visualShape.tail.type === 'triangle' && visualShape.tail.points_BLOCKS) {
                ctx.fillStyle = visualShape.tail.color || this.color;
                ctx.beginPath();
                const tailPoints = visualShape.tail.points_BLOCKS.map(p => ({
                    x: p.x * Config.BLOCK_WIDTH,
                    y: p.y * Config.BLOCK_HEIGHT
                }));
                ctx.moveTo(tailPoints[0].x, tailPoints[0].y);
                for (let i = 1; i < tailPoints.length; i++) {
                    ctx.lineTo(tailPoints[i].x, tailPoints[i].y);
                }
                ctx.closePath();
                ctx.fill();
            }
            if (visualShape.head && visualShape.head.type === 'circle' && visualShape.head.radius_BLOCKS) {
                ctx.fillStyle = visualShape.head.color || this.color;
                const headOffsetX = (visualShape.head.offset_BLOCKS?.x || 0) * Config.BLOCK_WIDTH;
                const headOffsetY = (visualShape.head.offset_BLOCKS?.y || 0) * Config.BLOCK_HEIGHT;
                const headRadius = visualShape.head.radius_BLOCKS * Config.BLOCK_WIDTH;
                ctx.beginPath();
                ctx.arc(headOffsetX, headOffsetY, headRadius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            if (this.isFlashing) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
            }
        } else {
            let drawColor = this.color;
            if (this.isFlashing) {
                drawColor = 'white';
            }
            ctx.fillStyle = drawColor;
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.strokeRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
        }
    }

    getCurrentContactDamage() {
        if (this.isDying) return 0;
        let damage = 0;
        if (this.type === Config.ENEMY_TYPE_TETRAPOD) {
            if (this.isInWater) {
                damage = Config.TETRAPOD_WATER_CONTACT_DAMAGE;
            } else if (this.isOnGround) {
                damage = this.isFlopAttacking ? Config.TETRAPOD_LAND_FLOP_DAMAGE : Config.TETRAPOD_LAND_STILL_DAMAGE;
            } else {
                damage = this.isFlopAttacking ? Config.TETRAPOD_LAND_FLOP_DAMAGE : Config.TETRAPOD_LAND_STILL_DAMAGE;
            }
        }
        else if (this.type === Config.ENEMY_TYPE_DUNKLEOSTEUS) {
            damage = this.isInWater ? (this.stats?.contactDamage ?? 0) : 0;
        }
        else {
            damage = this.stats?.contactDamage ?? 0;
        }
        return damage;
    }
}