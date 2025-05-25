import * as Config from '../config.js';
import * as GridCollision from '../gridCollision.js'; // E_EPSILON might be useful

export class FishAI {
    constructor(enemy) {
        this.enemy = enemy;
        this.wanderDirectionX = (Math.random() < 0.5) ? -1 : 1;
        this.wanderDirectionY = (Math.random() - 0.5); // Initial vertical tendency (-0.5 to 0.5)
        this.wanderTimer = Math.random() * 2 + 1.5; // Wander for 1.5-3.5 seconds
        this.bobbleAngle = Math.random() * Math.PI * 2;
    }

    decideMovement(playerPosition, allEnemies, dt) {
        let targetVx = 0;
        let targetVy = 0;

        if (!this.enemy.isInWater) {
            // Minimal movement on land, let gravity do its work
            return { targetVx: 0, targetVy: 0, jump: false };
        }

        // --- Threat Detection ---
        const fleeDistancePixels = this.enemy.stats.fleeDistance_BLOCKS * Config.BLOCK_WIDTH;
        const fleeDistanceSq = fleeDistancePixels * fleeDistancePixels;
        let fleeFromThreat = null;

        const defaultFacesLeft = this.enemy.type === Config.ENEMY_TYPE_SMALL_FISH;
        const fishVisualDirection = defaultFacesLeft ? -1 : 1;
        const orientationAngle = (this.enemy.lastDirection === fishVisualDirection) ? 0 : Math.PI;

        const headConfig = this.enemy.stats.visualShape?.head;
        let headWorldX = this.enemy.x + this.enemy.width / 2; 
        let headWorldY = this.enemy.y + this.enemy.height / 2;

        if (headConfig && headConfig.offset_BLOCKS) {
            const headLocalOffsetX = headConfig.offset_BLOCKS.x * Config.BLOCK_WIDTH;
            const headLocalOffsetY = headConfig.offset_BLOCKS.y * Config.BLOCK_HEIGHT; 
            
            // Correct rotation based on current enemy orientation (this.lastDirection)
            // If the fish asset itself now defaults to facing left, and lastDirection is -1 (moving left), no visual rotation (angle=0)
            // If lastDirection is 1 (moving right), visual rotation is PI.
            const effectiveOrientationAngle = (this.enemy.lastDirection === -1 && defaultFacesLeft) ? 0 : 
                                             ((this.enemy.lastDirection === 1 && !defaultFacesLeft) ? 0 : Math.PI);


            const rotatedHeadOffsetX = headLocalOffsetX * Math.cos(effectiveOrientationAngle) - headLocalOffsetY * Math.sin(effectiveOrientationAngle);
            const rotatedHeadOffsetY = headLocalOffsetX * Math.sin(effectiveOrientationAngle) + headLocalOffsetY * Math.cos(effectiveOrientationAngle);
            
            // If the asset *isn't* rotated (angle = 0), this simplifies to:
            // rotatedHeadOffsetX = headLocalOffsetX
            // rotatedHeadOffsetY = headLocalOffsetY
            // If the asset *is* rotated by PI (angle = PI), cos(PI) = -1, sin(PI) = 0:
            // rotatedHeadOffsetX = -headLocalOffsetX
            // rotatedHeadOffsetY = -headLocalOffsetY
            // This means the local offset is effectively flipped if the visual is rotated.
            // The visual offset defined in config is relative to the *unrotated asset*.
            // We need to add the *world-oriented* offset.

            // Simpler: head is always at `this.lastDirection * localHeadOffsetX` from fish center if localHeadOffsetY is 0
            if (defaultFacesLeft) { // asset's front is -X
                 headWorldX += this.enemy.lastDirection * Math.abs(headLocalOffsetX); // if lastDir is -1, head is at -abs(localX), if 1, head is at +abs(localX)
            } else { // asset's front is +X
                 headWorldX += this.enemy.lastDirection * headLocalOffsetX;
            }
            // Assuming headLocalOffsetY is 0 for simplicity here or handle Y rotation similarly if head has Y offset
            headWorldY += headLocalOffsetY; // Simpler, assuming Y offset is relative to asset's up
        }

        const potentialThreats = [];
        if (playerPosition && playerPosition.x !== undefined) { 
            potentialThreats.push({
                x: playerPosition.x, y: playerPosition.y,
                width: Config.PLAYER_WIDTH, height: Config.PLAYER_HEIGHT, 
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
                break; 
            }
        }

        if (fleeFromThreat) {
            if (fleeFromThreat.dist > GridCollision.E_EPSILON) {
                const fleeDirX = -fleeFromThreat.x / fleeFromThreat.dist; 
                const fleeDirY = -fleeFromThreat.y / fleeFromThreat.dist;
                targetVx = fleeDirX * this.enemy.swimSpeed * (this.enemy.stats.fleeSpeedFactor || 1.0);
                targetVy = fleeDirY * this.enemy.swimSpeed * (this.enemy.stats.fleeSpeedFactor || 1.0);
            } else { 
                const randomAngle = Math.random() * Math.PI * 2;
                targetVx = Math.cos(randomAngle) * this.enemy.swimSpeed * (this.enemy.stats.fleeSpeedFactor || 1.0);
                targetVy = Math.sin(randomAngle) * this.enemy.swimSpeed * (this.enemy.stats.fleeSpeedFactor || 1.0);
            }
        } else {
            // --- Wandering Behavior ---
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderDirectionX = (Math.random() < 0.5) ? -1 : 1;
                this.wanderDirectionY = (Math.random() - 0.5); // -0.5 to 0.5 for vertical tendency
                this.wanderTimer = Math.random() * 2 + 1.5; // Wander for 1.5-3.5 seconds
            }
            targetVx = this.wanderDirectionX * this.enemy.swimSpeed * 0.6; // Slightly faster base wander

            // Vertical wander component
            targetVy = this.wanderDirectionY * this.enemy.swimSpeed * 0.4;

            // Gentle vertical bobbing, added to the wander Vy
            this.bobbleAngle = (this.bobbleAngle + dt * Config.ITEM_BOBBLE_SPEED * 0.5) % (Math.PI * 2);
            targetVy += Math.sin(this.bobbleAngle) * (this.enemy.height * 0.1); // Smaller bobble amplitude
        }

        return { targetVx, targetVy, jump: false };
    }

    reactToCollision(collisionResult) {
        if (this.enemy.isInWater) {
            if (collisionResult.collidedX && Math.abs(this.enemy.vx) > GridCollision.E_EPSILON) {
                this.wanderDirectionX *= -1; // Reverse horizontal
                // When hitting a side wall, also try to move slightly up to escape potential corners
                this.wanderDirectionY = -0.3 - Math.random() * 0.4; // Prefer upward movement (-0.3 to -0.7 strength)
                this.wanderTimer = Math.random() * 1 + 0.5; // Quick re-evaluation
            }
            if (collisionResult.collidedY && Math.abs(this.enemy.vy) > GridCollision.E_EPSILON) {
                this.wanderDirectionY *= -1; // Reverse vertical tendency
                // If hit floor, strongly prefer swimming up
                if (this.enemy.vy >= 0) { // Was moving down or still when hit floor
                    this.wanderDirectionY = -0.5 - Math.random() * 0.5; // Strong preference for upwards (-0.5 to -1.0 strength)
                }
                this.wanderTimer = Math.random() * 1 + 0.5; // Quick re-evaluation
            }
        }
    }
}
