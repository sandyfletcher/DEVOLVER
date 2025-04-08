import * as Config from '../config.js';

export class SeekCenterAI {
    constructor(enemy) {
        this.enemy = enemy; // Store reference to the enemy using this AI
    }

    decideMovement(playerPosition, allEnemies, dt) {
        const targetX = Config.CANVAS_WIDTH / 2;
        const currentCenterX = this.enemy.x + this.enemy.width / 2;
        let targetVx = 0;
        // Simple check to move towards center if far enough away
        if (Math.abs(currentCenterX - targetX) > this.enemy.maxSpeedX * dt * 1.5) {
             targetVx = Math.sign(targetX - currentCenterX) * this.enemy.maxSpeedX;
        }
        return { targetVx: targetVx, jump: false }; // Return movement intent
    }

    reactToCollision(collisionResult) {
        // Seekers don't really react to collisions in a special way currently
        if (collisionResult.collidedX) {
            // Maybe reverse direction briefly? (Optional)
        }
    }
}