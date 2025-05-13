// -----------------------------------------------------------------------------
// root/js/ai/seekCenterAI.js - AI Strategy for seeking the center of the map
// -----------------------------------------------------------------------------
import * as GridCollision from '../gridCollision.js';
import * as World from '../world.js';
import * as Config from '../config.js';

export class SeekCenterAI {
constructor(enemy) {
this.enemy = enemy;
this.jumpCooldown = 0; // Time-based, in seconds
}
decideMovement(playerPosition, allEnemies, dt) {
    let targetVx = 0;
    let jump = false;
    let targetVy = this.enemy.vy; // Default to current vertical velocity

    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

    const worldCenterX = Config.CANVAS_WIDTH / 2;
    const dxToCenter = worldCenterX - (this.enemy.x + this.enemy.width / 2);

    // Horizontal Movement towards center
    if (Math.abs(dxToCenter) > this.enemy.width * 0.5) { // Only move if not too close to center
        targetVx = Math.sign(dxToCenter) * this.enemy.maxSpeedX; // Use scaled maxSpeedX from enemy
    }

    // Simple Jumping Logic: Jump if facing an obstacle while moving towards center
    if (this.enemy.canJump && targetVx !== 0 && this.jumpCooldown <= 0 && this.isFacingObstacle(Math.sign(targetVx)) && this.enemy.isOnGround) {
        jump = true;
        this.jumpCooldown = 0.8; // Cooldown after a jump (time-based)
    }

    // Water Stroke Logic (if applicable and in water)
    // This AI doesn't specifically aim up/down in water, but might jump if "stuck" at water edge
    if (this.enemy.isInWater && this.enemy.canJump && this.enemy.waterJumpCooldown <= 0) {
        // A simple check: if moving towards center but blocked by water edge (e.g. a 1-block high lip)
        // This is a very basic "stuck in water" check.
        const frontX = (targetVx > 0) ? (this.enemy.x + this.enemy.width + Config.BLOCK_WIDTH / 2) : (this.enemy.x - Config.BLOCK_WIDTH / 2);
        const {col: frontCol, row: frontRow} = GridCollision.worldToGridCoords(frontX, this.enemy.y + this.enemy.height - Config.BLOCK_HEIGHT*0.1); // Check near feet

        if (targetVx !== 0 && GridCollision.isSolid(frontCol, frontRow)) {
            jump = true; // Attempt a water stroke
        }
    }


    return { targetVx, jump, targetVy }; // Return vy as well if AI wants to control it
}

reactToCollision(collisionResult) {
    // If collided horizontally and was trying to move, might trigger a jump next frame
}

// Helper to check for obstacles in the direction of movement
isFacingObstacle(directionX) {
    if (!this.enemy.isOnGround) return false;

    // Check slightly ahead and slightly up (1 block high obstacle)
    // All dimensions/distances are scaled
    const checkDistHorizontal = this.enemy.width * 0.1; // Look a bit ahead (scaled)
    const checkHeight = this.enemy.height * 0.9; // Check near the top of the enemy's body (scaled)

    const frontX = (directionX > 0) ? (this.enemy.x + this.enemy.width + checkDistHorizontal) : (this.enemy.x - checkDistHorizontal);
    const checkY = this.enemy.y + this.enemy.height - checkHeight; // Check for obstacle at this height

    const {col, row} = GridCollision.worldToGridCoords(frontX, checkY);

    // Check if the cell in front is solid
    if (GridCollision.isSolid(col, row)) {
        // Optional: Check if the space *above* the obstacle is clear for a jump
        const {col: colAbove, row: rowAbove} = GridCollision.worldToGridCoords(frontX, checkY - this.enemy.height); // Check space needed for enemy height (scaled)
        if (!GridCollision.isSolid(col, row - 1) && !GridCollision.isSolid(colAbove, rowAbove)) { // Cell above obstacle and space for enemy height
            return true;
        }
    }
    return false;
}
}