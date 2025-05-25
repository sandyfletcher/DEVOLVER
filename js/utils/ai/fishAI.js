// -----------------------------------------------------------------------------
// root/js/utils/ai/fishAI.js - AI Strategy for Scurrying Fish
// -----------------------------------------------------------------------------

import * as Config from '../config.js';
import * as GridCollision from '../gridCollision.js'; // E_EPSILON might be useful

export class FishAI {
    constructor(enemy) {
        this.enemy = enemy;
        this.wanderDirectionX = (Math.random() < 0.5) ? -1 : 1;
        this.wanderTimer = Math.random() * 3 + 2; // Wander for 2-5 seconds
        this.bobbleAngle = Math.random() * Math.PI * 2;
    }

    decideMovement(playerPosition, allEnemies, dt) {
        let targetVx = 0;
        let targetVy = 0;

        if (!this.enemy.isInWater) {
            // Minimal movement on land, let gravity do its work
            // It might try to flop back towards water if we add that later
            return { targetVx: 0, targetVy: 0, jump: false };
        }

        // --- Threat Detection ---
        const fleeDistancePixels = this.enemy.stats.fleeDistance_BLOCKS * Config.BLOCK_WIDTH;
        const fleeDistanceSq = fleeDistancePixels * fleeDistancePixels;
        let fleeFromThreat = null;

        // Calculate fish's head position
        const orientationAngle = (this.enemy.lastDirection === 1) ? 0 : Math.PI;
        const headConfig = this.enemy.stats.visualShape?.head;
        let headWorldX = this.enemy.x + this.enemy.width / 2; // Default to center
        let headWorldY = this.enemy.y + this.enemy.height / 2;

        if (headConfig && headConfig.offset_BLOCKS) {
            const headLocalOffsetX = headConfig.offset_BLOCKS.x * Config.BLOCK_WIDTH;
            const headLocalOffsetY = headConfig.offset_BLOCKS.y * Config.BLOCK_HEIGHT; // Assuming non-uniform blocks for head Y offset
            const rotatedHeadOffsetX = headLocalOffsetX * Math.cos(orientationAngle) - headLocalOffsetY * Math.sin(orientationAngle);
            const rotatedHeadOffsetY = headLocalOffsetX * Math.sin(orientationAngle) + headLocalOffsetY * Math.cos(orientationAngle);
            headWorldX += rotatedHeadOffsetX;
            headWorldY += rotatedHeadOffsetY;
        }

        const potentialThreats = [];
        if (playerPosition && playerPosition.x !== undefined) { // Ensure playerPosition is valid
            potentialThreats.push({
                x: playerPosition.x, y: playerPosition.y,
                width: Config.PLAYER_WIDTH, height: Config.PLAYER_HEIGHT, // Use actual player dimensions
                isPlayer: true
            });
        }
        if (allEnemies) {
            allEnemies.forEach(e => {
                if (e !== this.enemy && e.isActive && !e.isDying) {
                    potentialThreats.push(e);
                }
            });
        }

        for (const threat of potentialThreats) {
            const threatCenterX = threat.x + threat.width / 2;
            const threatCenterY = threat.y + threat.height / 2;
            const dx = threatCenterX - headWorldX;
            const dy = threatCenterY - headWorldY;
            const distSq = dx * dx + dy * dy;

            const isThreatLarger = (threat.width * threat.height) > (this.enemy.width * this.enemy.height);

            if (isThreatLarger && distSq < fleeDistanceSq) {
                fleeFromThreat = { x: dx, y: dy, dist: Math.sqrt(distSq) };
                break; // Flee from the first detected threat
            }
        }

        if (fleeFromThreat) {
            if (fleeFromThreat.dist > GridCollision.E_EPSILON) {
                const fleeDirX = -fleeFromThreat.x / fleeFromThreat.dist; // Away from threat
                const fleeDirY = -fleeFromThreat.y / fleeFromThreat.dist;
                targetVx = fleeDirX * this.enemy.swimSpeed * (this.enemy.stats.fleeSpeedFactor || 1.0);
                targetVy = fleeDirY * this.enemy.swimSpeed * (this.enemy.stats.fleeSpeedFactor || 1.0);
            } else { // Threat is exactly on top (or very close) - pick a random flee direction
                const randomAngle = Math.random() * Math.PI * 2;
                targetVx = Math.cos(randomAngle) * this.enemy.swimSpeed * (this.enemy.stats.fleeSpeedFactor || 1.0);
                targetVy = Math.sin(randomAngle) * this.enemy.swimSpeed * (this.enemy.stats.fleeSpeedFactor || 1.0);
            }
        } else {
            // --- Wandering Behavior ---
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderDirectionX = (Math.random() < 0.5) ? -1 : 1;
                this.wanderTimer = Math.random() * 3 + 2; // Wander for 2-5 seconds
            }
            targetVx = this.wanderDirectionX * this.enemy.swimSpeed * 0.5; // Slower wander

            // Gentle vertical bobbing
            this.bobbleAngle = (this.bobbleAngle + dt * Config.ITEM_BOBBLE_SPEED * 0.5) % (Math.PI * 2);
            targetVy = Math.sin(this.bobbleAngle) * (this.enemy.height * 0.2);
        }

        return { targetVx, targetVy, jump: false };
    }

    reactToCollision(collisionResult) {
        if (this.enemy.isInWater && collisionResult.collidedX && Math.abs(this.enemy.vx) > GridCollision.E_EPSILON) {
            this.wanderDirectionX *= -1; // Reverse horizontal wander direction
            this.wanderTimer = 0; // Force new wander decision soon
        }
    }
}