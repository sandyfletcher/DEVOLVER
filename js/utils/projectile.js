// =============================================================================
// root/js/utils/projectile.js - Projectile Class
// =============================================================================

import * as Config from './config.js';
import * as GridCollision from './gridCollision.js';
import * as DebugLogger from './debugLogger.js';
import * as WorldManager from '../worldManager.js';

export class Projectile {
    constructor(x, y, vx, vy, type, owner) {
        this.type = type;
        this.owner = owner; // The entity that fired it (e.g., the player)

        const stats = Config.PROJECTILE_STATS[this.type];
        if (!stats) {
            DebugLogger.error(`Projectile constructor: No stats found for type "${type}".`);
            this.isActive = false;
            return;
        }

        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;

        this.width = stats.width;
        this.height = stats.height;
        this.damage = stats.damage;
        this.gravityFactor = stats.gravityFactor ?? 1.0;
        this.rotation = Math.atan2(vy, vx);

        this.isActive = true;
        this.isInWater = false;
        this.isStuck = false;
        this.stuckInBlock = null; // { c, r }
    }

    update(dt) {
        if (!this.isActive || this.isStuck) return;

        // Apply gravity
        this.isInWater = GridCollision.isEntityInWater(this);
        const effectiveGravity = Config.GRAVITY_ACCELERATION * this.gravityFactor * (this.isInWater ? Config.WATER_GRAVITY_FACTOR : 1.0);
        this.vy += effectiveGravity * dt;

        // Update rotation to match velocity vector
        if (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1) {
            this.rotation = Math.atan2(this.vy, this.vx);
        }

        // Update position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Despawn if out of world bounds
        if (this.y > Config.CANVAS_HEIGHT + 200 || this.x < -200 || this.x > Config.CANVAS_WIDTH + 200) {
            this.isActive = false;
        }
    }

    draw(ctx) {
        if (!this.isActive || !ctx) return;

        const stats = Config.PROJECTILE_STATS[this.type];
        if (!stats || !stats.shape) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        stats.shape.forEach(shapeDef => {
            ctx.fillStyle = shapeDef.color || 'magenta';
            if (shapeDef.outlineColor && shapeDef.outlineWidth) {
                ctx.strokeStyle = shapeDef.outlineColor;
                ctx.lineWidth = shapeDef.outlineWidth;
            } else {
                ctx.strokeStyle = 'transparent';
                ctx.lineWidth = 0;
            }

            if (shapeDef.type === 'rect') {
                ctx.fillRect(shapeDef.x, shapeDef.y, shapeDef.w, shapeDef.h);
                if (ctx.lineWidth > 0) ctx.strokeRect(shapeDef.x, shapeDef.y, shapeDef.w, shapeDef.h);
            } else if (shapeDef.type === 'polygon' && shapeDef.points) {
                ctx.beginPath();
                shapeDef.points.forEach((p, index) => {
                    if (index === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.closePath();
                ctx.fill();
                if (ctx.lineWidth > 0) ctx.stroke();
            }
        });

        ctx.restore();
    }

    getRect() {
        return {
            x: this.x - this.width / 2, // Assuming x,y is center
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }

    stickInBlock(c, r) {
        this.isStuck = true;
        this.stuckInBlock = { c, r };
        this.vx = 0;
        this.vy = 0;
        // Optionally, make it recoverable later by changing isActive to false after a timer
        // For now, it just sticks and stops updating. Collision manager will stop checking it.
    }
}