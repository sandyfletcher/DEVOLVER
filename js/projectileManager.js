// =============================================================================
// root/js/projectileManager.js - Manages all active projectiles
// =============================================================================

import { Projectile } from './utils/projectile.js';
import * as DebugLogger from './utils/debugLogger.js';

let projectiles = [];

export function init() {
    projectiles = [];
    DebugLogger.log("ProjectileManager initialized.");
}
export function spawnProjectile(x, y, vx, vy, type, owner) {
    const newProjectile = new Projectile(x, y, vx, vy, type, owner);
    if (newProjectile.isActive) {
        projectiles.push(newProjectile);
    }
}
export function update(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if (!p) {
            projectiles.splice(i, 1);
            continue;
        }
        p.update(dt);
        if (!p.isActive) {
            projectiles.splice(i, 1);
        }
    }
}
export function draw(ctx, highlightColor) {
    projectiles.forEach(p => {
        if (p && p.isActive) {
            p.draw(ctx, highlightColor);
        }
    });
}
export function getProjectiles() {
    return projectiles;
}
export function clearAllProjectiles() {
    projectiles = [];
    DebugLogger.log("ProjectileManager: Cleared all projectiles.");
}
export function clearProjectilesOutsideRadius(centerX, centerY, radius) {
    const radiusSq = radius * radius;
    const initialCount = projectiles.length;
    projectiles = projectiles.filter(p => {
        if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || isNaN(p.x) || isNaN(p.y)) {
            DebugLogger.warn("ProjectileManager: Found invalid projectile data during cleanup, removing.", p);
            return false;
        }
        const pCenterX = p.x; // use projectile's center for distance check
        const pCenterY = p.y;
        const dx = pCenterX - centerX;
        const dy = pCenterY - centerY;
        const distSq = dx * dx + dy * dy;
        return distSq <= radiusSq;
    });
    const removedCount = initialCount - projectiles.length;
    DebugLogger.log(`ProjectileManager: Cleared ${removedCount} projectiles outside radius ${radius}.`);
}