// -----------------------------------------------------------------------------
// root/js/ai/chasePlayerAI.js - AI Strategy for chasing the player
// -----------------------------------------------------------------------------

import * as GridCollision from '../gridCollision.js';
import * as World from '../world.js';
import * as Config from '../config.js';

export class ChasePlayerAI {
constructor(enemy) {
this.enemy = enemy;
this.jumpCooldown = 0; // Time-based, in seconds
this.stuckCheckTimer = 0; // Timer for periodic stuck checks
this.STUCK_CHECK_INTERVAL = 1.5; // Time in seconds
this.lastPosition = { x: enemy.x, y: enemy.y };
this.stuckCounter = 0;
this.STUCK_THRESHOLD = 3; // Number of stuck intervals before trying a big jump
}
decideMovement(playerPosition, allEnemies, dt) {
    let targetVx = 0;
    let jump = false;
    let targetVy = this.enemy.vy; // Default to current vertical velocity

    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    this.stuckCheckTimer -= dt;

    // Check if stuck
    if (this.stuckCheckTimer <= 0) {
        const distMovedSq = (this.enemy.x - this.lastPosition.x) ** 2 + (this.enemy.y - this.lastPosition.y) ** 2;
        if (distMovedSq < (this.enemy.width * 0.25) ** 2) { // If moved less than 1/4 of its width
            this.stuckCounter++;
        } else {
            this.stuckCounter = 0; // Reset if moved significantly
        }
        this.lastPosition = { x: this.enemy.x, y: this.enemy.y };
        this.stuckCheckTimer = this.STUCK_CHECK_INTERVAL;
    }


    if (playerPosition) {
        const dx = playerPosition.x - (this.enemy.x + this.enemy.width / 2);
        const dy = playerPosition.y - (this.enemy.y + this.enemy.height / 2);

        // Horizontal Movement
        if (Math.abs(dx) > this.enemy.width * 0.5) { // Only move if not too close
            targetVx = Math.sign(dx) * this.enemy.maxSpeedX; // Use scaled maxSpeedX from enemy
        }

        // --- Jumping Logic ---
        if (this.enemy.canJump && this.jumpCooldown <= 0) {
            // 1. Jump if player is significantly above
            const verticalJumpThreshold = this.enemy.height * 1.5; // e.g., 1.5x enemy height
            if (dy < -verticalJumpThreshold && this.enemy.isOnGround) {
                jump = true;
                this.jumpCooldown = 0.5; // Cooldown after a vertical jump
                this.stuckCounter = 0; // Reset stuck counter after a jump
            }
            // 2. Jump to overcome obstacles if moving towards player and blocked
            else if (targetVx !== 0 && this.isFacingObstacle(Math.sign(targetVx)) && this.enemy.isOnGround) {
                jump = true;
                this.jumpCooldown = 0.7; // Longer cooldown for obstacle jump
                this.stuckCounter = 0;
            }
            // 3. "Desperation" jump if stuck for too long
            else if (this.stuckCounter >= this.STUCK_THRESHOLD && this.enemy.isOnGround) {
                jump = true;
                targetVy = -this.enemy.jumpVelocity * 1.2; // Try a slightly higher jump (use scaled jumpVelocity)
                this.jumpCooldown = 1.0; // Longer cooldown
                this.stuckCounter = 0; // Reset stuck counter
            }
        }
    } else {
        // No player position, default to wandering or idle (could be a separate AI state)
        // For now, just stop.
        targetVx = 0;
    }

    // --- Water Stroke Logic (if applicable and in water) ---
    if (this.enemy.isInWater && this.enemy.canJump && this.enemy.waterJumpCooldown <=0 && playerPosition && playerPosition.y < this.enemy.y ) { // Player above in water
        // Perform a water stroke by setting jump true, physics will handle cooldown
        // This relies on the enemy's physics update to handle waterJumpCooldown.
        // The AI's jumpCooldown is separate.
        jump = true; // Signal to physics to apply water stroke
    }


    return { targetVx, jump, targetVy }; // Return vy as well if AI wants to control it
}

reactToCollision(collisionResult) {
    // If collided horizontally and was trying to move, might trigger a jump next frame if conditions met
    if (collisionResult.collidedX && Math.abs(this.enemy.vx) > GridCollision.E_EPSILON) {
        // AI can use this info, e.g., to attempt a jump if stuck
    }
}

// Helper to check for obstacles in the direction of movement
isFacingObstacle(directionX) {
    if (!this.enemy.isOnGround) return false; // Only check for ground obstacles

    const checkDistHorizontal = this.enemy.width * 0.6; // How far to look ahead (scaled)
    const checkDistVertical = this.enemy.height * 0.5; // How high to check the obstacle (scaled)

    const frontX = (directionX > 0) ? (this.enemy.x + this.enemy.width + checkDistHorizontal) : (this.enemy.x - checkDistHorizontal);

    // Check a point slightly above the enemy's feet
    const checkY = this.enemy.y + this.enemy.height - checkDistVertical;

    const {col, row} = GridCollision.worldToGridCoords(frontX, checkY);
    // Also check the cell at the enemy's exact height at the front
    const {col: colHead, row: rowHead} = GridCollision.worldToGridCoords(frontX, this.enemy.y + this.enemy.height * 0.1);


    // Check if the cell in front is solid, and if the cell above it (for head clearance) is also solid (low ceiling)
    const obstacleAhead = GridCollision.isSolid(col, row);
    const lowCeiling = GridCollision.isSolid(colHead, rowHead -1); // Check one cell above head level

    if (obstacleAhead && !lowCeiling) { // Obstacle present, but head is clear to jump
        return true;
    }
    return false;
}
}