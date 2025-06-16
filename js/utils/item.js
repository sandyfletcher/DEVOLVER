// =============================================================================
// root/js/utils/item.js
// =============================================================================

import * as Config from './config.js';
import * as GridCollision from './gridCollision.js';
import * as DebugLogger from './debugLogger.js';

export class Item {
    constructor(x, y, type,) {
        this.x = x;
        this.y = y;
        this.type = type; // e.g., 'shovel', 'dirt', 'stone'
        let itemDefinition = null;
        if (Config.WEAPON_STATS[type]) { // weapon?
            itemDefinition = Config.WEAPON_STATS[type];
        } else {
            for (const blockTypeIdKey in Config.BLOCK_PROPERTIES) { // dropped material?
                const blockProps = Config.BLOCK_PROPERTIES[blockTypeIdKey];
                if (blockProps.droppedItemType === type && blockProps.droppedItemConfig) {
                    itemDefinition = blockProps.droppedItemConfig;
                    break;
                }
            }
        }
        if (!itemDefinition) {
            DebugLogger.warn(`Item constructor: No definition found for type "${type}". Using fallback visual properties.`);
            itemDefinition = {
                width: Config.BLOCK_WIDTH,
                height: Config.BLOCK_HEIGHT,
                color: 'magenta'
            };
        }
        this.width = itemDefinition.width;
        this.height = itemDefinition.height;
        this.color = itemDefinition.color || 'rgba(50,50,50,0.7)'; // used as a fallback if no shape is drawn
        this.bobbleAmount = itemDefinition.bobbleAmount ?? Config.ITEM_BOBBLE_AMOUNT;
        this.bobbleSpeed = itemDefinition.bobbleSpeed ?? Config.ITEM_BOBBLE_SPEED;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.bobbleOffset = Math.random() * Math.PI * 2;
        this.isActive = true;
        this.isInWater = false;
        this.isAttracted = false;
    }
    update(dt, player) {
        if (!this.isActive) return;
        if (typeof dt !== 'number' || isNaN(dt) || dt < 0) {
            DebugLogger.warn("Item Update: Invalid delta time.", dt);
            return;
        }
        this.isInWater = GridCollision.isEntityInWater(this);
        this.isAttracted = false;
        let dx = 0, dy = 0;
        let distSq = Infinity;
        if (player && player.getCurrentHealth() > 0) {
            const playerRect = player.getRect();
            const itemCenterX = this.x + this.width / 2;
            const itemCenterY = this.y + this.height / 2;
            const playerCenterX = playerRect.x + playerRect.width / 2;
            const playerCenterY = playerRect.y + playerRect.height / 2;
            dx = playerCenterX - itemCenterX;
            dy = playerCenterY - itemCenterY;
            distSq = dx * dx + dy * dy;
            const attractRadiusSq = Config.PLAYER_ITEM_ATTRACT_RADIUS_SQ;
            const pickupRangeSq = Config.PLAYER_INTERACTION_RANGE_SQ;
            if (distSq < attractRadiusSq && distSq > pickupRangeSq + GridCollision.E_EPSILON) {
                this.isAttracted = true;
            } else if (distSq <= pickupRangeSq + GridCollision.E_EPSILON) {
                this.isAttracted = false;
            }
        }
        if (this.isAttracted) {
            this.isOnGround = false;
            const dist = Math.sqrt(distSq);
            if (dist > GridCollision.E_EPSILON) {
                const normX = dx / dist;
                const normY = dy / dist;
                this.vx = normX * Config.PLAYER_ITEM_ATTRACT_SPEED;
                this.vy = normY * Config.PLAYER_ITEM_ATTRACT_SPEED;
            } else {
                this.vx = 0;
                this.vy = 0;
            }
            this.x += this.vx * dt;
            this.y += this.vy * dt;
        } else {
            const effectiveGravity = Config.GRAVITY_ACCELERATION * (this.isInWater ? Config.WATER_GRAVITY_FACTOR : 1.0);
            if (!this.isOnGround) {
                this.vy += effectiveGravity * dt;
            } else {
                if (this.vy > 0.1) this.vy = 0;
            }
            if (this.isInWater) {
                const horizontalDampingFactor = Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt);
                const verticalDampingFactor = Math.pow(Config.WATER_VERTICAL_DAMPING, dt);
                this.vx *= horizontalDampingFactor;
                this.vy *= verticalDampingFactor;
            }
            if (this.isInWater) {
                this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED);
                this.vy = Math.max(this.vy, -Config.WATER_MAX_SWIM_UP_SPEED);
            } else {
                this.vy = Math.min(this.vy, Config.MAX_FALL_SPEED);
            }
            const potentialMoveX = this.vx * dt;
            const potentialMoveY = this.vy * dt;
            const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
            this.isOnGround = collisionResult.isOnGround;
            if (collisionResult.collidedX) {
                this.vx = 0;
            }
            if (collisionResult.collidedY) {
                if (Math.abs(this.vy) > 0.1) {
                    this.vy = 0;
                }
            }
        }
        if (!this.isAttracted) {
            if (Math.abs(this.vx) < GridCollision.E_EPSILON) this.vx = 0;
            if (Math.abs(this.vy) < GridCollision.E_EPSILON) this.vy = 0;
        }
        if (this.y > Config.CANVAS_HEIGHT + 100 || this.x < -200 || this.x > Config.CANVAS_WIDTH + 200) {
            this.isActive = false;
        }
    }
    draw(ctx, highlightColor) {
        if (!this.isActive || !ctx) return;
        if (isNaN(this.x) || isNaN(this.y)) {
            DebugLogger.error(`>>> Item DRAW ERROR: NaN coordinates! type: ${this.type}`);
            return;
        }
        let drawY = this.y;
        if (this.isOnGround && !this.isInWater && !this.isAttracted) {
            this.bobbleOffset = (this.bobbleOffset + this.bobbleSpeed * (1 / 60)) % (Math.PI * 2);
            drawY += Math.sin(this.bobbleOffset) * this.bobbleAmount * this.height;
        } else if (this.isAttracted) {
            const attractedBobbleSpeed = this.bobbleSpeed * 3;
            const attractedBobbleAmount = this.bobbleAmount * 0.5;
            this.bobbleOffset = (this.bobbleOffset + attractedBobbleSpeed * (1 / 60)) % (Math.PI * 2);
            drawY += Math.sin(this.bobbleOffset) * attractedBobbleAmount * this.height;
        }
        const weaponStats = Config.WEAPON_STATS[this.type];
        if (weaponStats && Array.isArray(weaponStats.shape) && weaponStats.shape.length > 0) {
            ctx.save(); // draw using weapon shape definition
            const itemCenterX = this.x + this.width / 2;
            const itemCenterY = drawY + this.height / 2; // use bobbing Y for visual center
            ctx.translate(itemCenterX, itemCenterY);
            ctx.rotate(Math.PI / 7); // slight angle to look resting (+/- 26°)
            if (weaponStats.visualAnchorOffset) { // weapon shapes defined relative to their visualAnchorOffset
                ctx.translate(-weaponStats.visualAnchorOffset.x, -weaponStats.visualAnchorOffset.y); // draw centered for item, need to counter-translate by offset
            }
            weaponStats.shape.forEach(shapeDef => {
                // MODIFIED LOGIC FOR FILL COLOR
                // For items on the ground, they are never "actively attacking".
                // All parts (including blades) should use their default defined color.
                const fillColor = shapeDef.color || 'magenta'; // Use the shape's defined color for all parts
                ctx.fillStyle = fillColor;
                // END MODIFIED LOGIC

                if (shapeDef.type === 'rect') {
                    ctx.fillRect(Math.floor(shapeDef.x), Math.floor(shapeDef.y), Math.ceil(shapeDef.w), Math.ceil(shapeDef.h));
                    if (weaponStats.outlineColor && weaponStats.outlineWidth) {
                        ctx.strokeStyle = weaponStats.outlineColor;
                        ctx.lineWidth = weaponStats.outlineWidth;
                        const inset = ctx.lineWidth / 2;
                        ctx.strokeRect(Math.floor(shapeDef.x) + inset, Math.floor(shapeDef.y) + inset, Math.ceil(shapeDef.w) - ctx.lineWidth, Math.ceil(shapeDef.h) - ctx.lineWidth);
                    }
                } else if (shapeDef.type === 'triangle' && shapeDef.p1 && shapeDef.p2 && shapeDef.p3) {
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
                // TODO: add other shape types (e.g., 'circle', 'polygon') here if needed
            });
            ctx.restore();
        } else {
            ctx.fillStyle = this.color; // fallback: Draw simple rectangle for materials or weapons without shapes
            ctx.fillRect(Math.floor(this.x), Math.floor(drawY), this.width, this.height);
        }
    }
    getRect() {
        const safeX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
        const safeY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
        return {
            x: safeX,
            y: safeY, // use non-bobbing Y for collision
            width: this.width,
            height: this.height
        };
    }
}