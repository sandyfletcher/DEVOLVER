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

export function draw(ctx) {
    projectiles.forEach(p => {
        if (p && p.isActive) {
            p.draw(ctx);
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