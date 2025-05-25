// -----------------------------------------------------------------------------
// root/js/utils/portal.js - The core structure that needs defending
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as WaveManager from '../waveManager.js'; // to check game state

export class Portal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = Config.PORTAL_WIDTH;
        this.height = Config.PORTAL_HEIGHT;
        this.baseColor = Config.PORTAL_COLOR; // Renamed for clarity
        this.maxHealth = Config.PORTAL_INITIAL_HEALTH;
        this.currentHealth = this.maxHealth;
        this.safetyRadius = Config.PORTAL_SAFETY_RADIUS;
        this.isActive = true;
        this.absorbingEnemies = [];

        // Visual enhancement properties
        this.pulseTimer = Math.random() * Math.PI * 2; // Start pulse at a random point
        this.particles = [];
        this._initParticles();

        if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Portal CONSTRUCTOR ERROR: NaN initial coordinates! Resetting to center.`);
             this.x = Config.CANVAS_WIDTH / 2 - this.width/2;
             this.y = Config.CANVAS_HEIGHT / 2 - this.height/2;
         }
         console.log(`Portal created at [${this.x.toFixed(1)}, ${this.y.toFixed(1)}] with HP ${this.maxHealth} and safety radius ${this.safetyRadius}`);
    }

    _initParticles() {
        this.particles = [];
        for (let i = 0; i < Config.PORTAL_PARTICLE_COUNT; i++) {
            this.particles.push(this._createParticle());
        }
    }

    _createParticle() {
        const size = Config.PORTAL_PARTICLE_MIN_SIZE + Math.random() * (Config.PORTAL_PARTICLE_MAX_SIZE - Config.PORTAL_PARTICLE_MIN_SIZE);
        const speed = Config.PORTAL_PARTICLE_MIN_SPEED + Math.random() * (Config.PORTAL_PARTICLE_MAX_SPEED - Config.PORTAL_PARTICLE_MIN_SPEED);
        const angle = Math.random() * Math.PI * 2; // Initial random direction (can be made to swirl)
        
        // Spawn inside the portal, with a bit of margin
        const spawnMarginX = this.width * 0.1;
        const spawnMarginY = this.height * 0.1;

        return {
            x: this.x + spawnMarginX + Math.random() * (this.width - 2 * spawnMarginX),
            y: this.y + spawnMarginY + Math.random() * (this.height - 2 * spawnMarginY),
            vx: Math.cos(angle) * speed * 0.3 + (Math.random() - 0.5) * speed * 0.2, // Base drift + slight random swirl
            vy: Math.sin(angle) * speed * 0.7 + (Math.random() - 0.5) * speed * 0.4, // Tend to drift upwards
            size: size,
            opacity: 0.5 + Math.random() * 0.5,
            color: Math.random() < 0.7 ? Config.PORTAL_PARTICLE_COLOR_PRIMARY : Config.PORTAL_PARTICLE_COLOR_SECONDARY,
        };
    }

    update(dt) {
        if (!this.isActive) return;

        // Update pulse timer
        this.pulseTimer = (this.pulseTimer + Config.PORTAL_PULSE_SPEED * dt) % (Math.PI * 2);

        // Update particles
        this.particles.forEach((p, index) => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.opacity -= Config.PORTAL_PARTICLE_FADE_SPEED * dt;

            // Make particles swirl towards center slightly and drift upwards
            const dxToCenter = (this.x + this.width / 2) - p.x;
            const dyToCenter = (this.y + this.height / 2) - p.y; // Towards vertical center
            
            // Gentle pull towards horizontal center
            p.vx += dxToCenter * 0.05 * dt; 
            // Gentle upward drift and pull towards vertical center
            p.vy += dyToCenter * 0.02 * dt - Config.PORTAL_PARTICLE_MAX_SPEED * 0.1 * dt;


            // Reset particle if it's out of bounds or faded
            if (p.opacity <= 0 ||
                p.x < this.x - p.size || p.x > this.x + this.width + p.size ||
                p.y < this.y - p.size || p.y > this.y + this.height + p.size) {
                this.particles[index] = this._createParticle();
                // Reset position to be within portal bounds immediately
                this.particles[index].x = this.x + this.width * 0.1 + Math.random() * (this.width * 0.8);
                this.particles[index].y = this.y + this.height * 0.8 + Math.random() * (this.height * 0.15); // Spawn near bottom
            }
        });


        // Update absorbing enemies
        for (let i = this.absorbingEnemies.length - 1; i >= 0; i--) {
            const absorptionInfo = this.absorbingEnemies[i];
            absorptionInfo.timer -= dt;
            if (absorptionInfo.timer <= 0) {
                if (absorptionInfo.enemyRef) {
                    absorptionInfo.enemyRef.isActive = false; 
                }
                this.absorbingEnemies.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        if (!this.isActive || !ctx) return;
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Portal DRAW ERROR: Preventing draw due to NaN coordinates!`);
            return;
        }
        
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const waveInfo = WaveManager.getWaveInfo();
        const isIntermission = waveInfo.state === 'BUILDPHASE' || waveInfo.state === 'WARP_ANIMATING';

        if (isIntermission) {
             ctx.save();
             ctx.fillStyle = 'rgba(100, 100, 255, 0.1)'; 
             ctx.strokeStyle = 'rgba(100, 100, 255, 0.5)'; 
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.arc(centerX, centerY, this.safetyRadius, 0, Math.PI * 2);
             ctx.fill();
             ctx.stroke();
             ctx.restore();
        }

        // --- Base Portal Rectangle ---
        ctx.fillStyle = this.baseColor;
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);

        // --- Pulsating Inner Glow ---
        const pulseProgress = (Math.sin(this.pulseTimer) + 1) / 2; // 0 to 1
        const currentPulseAlpha = Config.PORTAL_PULSE_MIN_ALPHA + pulseProgress * (Config.PORTAL_PULSE_MAX_ALPHA - Config.PORTAL_PULSE_MIN_ALPHA);
        
        // Create a gradient for the pulse
        const pulseGradient = ctx.createRadialGradient(
            centerX, centerY, 0, 
            centerX, centerY, Math.min(this.width, this.height) * 0.45 * (0.8 + pulseProgress * 0.2) // Radius also pulses slightly
        );
        const basePulseColor = Config.PORTAL_PULSE_COLOR; // e.g., 'rgba(150, 150, 255, 0.7)'
        const pulseColorMatch = basePulseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        
        if (pulseColorMatch) {
            const r = pulseColorMatch[1];
            const g = pulseColorMatch[2];
            const b = pulseColorMatch[3];
            pulseGradient.addColorStop(0, `rgba(${r},${g},${b},${currentPulseAlpha})`);
            pulseGradient.addColorStop(0.7, `rgba(${r},${g},${b},${currentPulseAlpha * 0.5})`);
            pulseGradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        } else {
            pulseGradient.addColorStop(0, `rgba(150, 150, 255, ${currentPulseAlpha})`); // Fallback
            pulseGradient.addColorStop(1, `rgba(150, 150, 255, 0)`);
        }

        ctx.fillStyle = pulseGradient;
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);


        // --- Draw Particles ---
        this.particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(Math.floor(p.x), Math.floor(p.y), Math.ceil(p.size), 0, Math.PI * 2);
            ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${p.opacity.toFixed(2)})`); // Update alpha in color string
            ctx.fill();
        });


        // --- Border ---
        if (Config.PORTAL_BORDER_WIDTH > 0) {
            ctx.strokeStyle = Config.PORTAL_BORDER_COLOR;
            ctx.lineWidth = Config.PORTAL_BORDER_WIDTH;
            const inset = Config.PORTAL_BORDER_WIDTH / 2;
            ctx.strokeRect(
                Math.floor(this.x) + inset,
                Math.floor(this.y) + inset,
                this.width - Config.PORTAL_BORDER_WIDTH,
                this.height - Config.PORTAL_BORDER_WIDTH
            );
        }

        // Draw absorbing enemies (same as before)
        if (this.absorbingEnemies.length > 0) {
            this.absorbingEnemies.forEach(absorptionInfo => {
                const enemy = absorptionInfo.enemyRef;
                if (!enemy || !enemy.isActive) return;

                const fullDuration = Config.PORTAL_ABSORB_ANIMATION_DURATION;
                const timeRemaining = absorptionInfo.timer;
                const progress = Math.max(0, 1.0 - (timeRemaining / fullDuration)); 
                const easedProgress = progress * progress;

                const startEnemyCenterX = absorptionInfo.startX + absorptionInfo.startWidth / 2;
                const startEnemyCenterY = absorptionInfo.startY + absorptionInfo.startHeight / 2;

                const currentEnemyCenterX = startEnemyCenterX + (centerX - startEnemyCenterX) * easedProgress;
                const currentEnemyCenterY = startEnemyCenterY + (centerY - startEnemyCenterY) * easedProgress;

                const currentWidth = absorptionInfo.startWidth * (1.0 - easedProgress);
                const currentHeight = absorptionInfo.startHeight * (1.0 - easedProgress);

                const drawX = currentEnemyCenterX - currentWidth / 2;
                const drawY = currentEnemyCenterY - currentHeight / 2;

                if (currentWidth >= 1 && currentHeight >= 1) { 
                    ctx.fillStyle = enemy.color; // Use enemy's original color
                    ctx.fillRect(
                        Math.floor(drawX),
                        Math.floor(drawY),
                        Math.ceil(currentWidth),
                        Math.ceil(currentHeight)
                    );
                }
            });
        }
    }
    takeDamage(amount) {
        if (!this.isActive || this.currentHealth <= 0) return;
        const damage = Math.max(0, amount); 
        this.currentHealth -= damage;
        console.log(`Portal took ${damage} damage. Health: ${this.currentHealth}/${this.maxHealth}`);
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die(); 
        }
    }
    die() {
        if (!this.isActive) return;
        console.log("The Portal has been destroyed!");
        this.isActive = false;
    }
    reset() {
        console.log("Resetting portal state...");
        this.safetyRadius = Config.PORTAL_SAFETY_RADIUS; 
        this.currentHealth = this.maxHealth; 
        this.isActive = true; 
        this.absorbingEnemies = [];
        this.pulseTimer = Math.random() * Math.PI * 2;
        this._initParticles(); // Re-initialize particles

         if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Portal RESET ERROR: NaN initial coordinates! Resetting to center.`);
             this.x = Config.CANVAS_WIDTH / 2 - this.width/2;
             this.y = Config.CANVAS_HEIGHT / 2 - this.height/2;
         }
    }
    setSafetyRadius(radius) {
        this.safetyRadius = radius;
    }
    getRect() {
        const safeX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
        const safeY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
        return { x: safeX, y: safeY, width: this.width, height: this.height };
    }
    getPosition() {
         const safeX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
         const safeY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
         return { x: safeX + this.width / 2, y: safeY + this.height / 2 };
    }
    isAlive() {
        return this.isActive && this.currentHealth > 0;
    }
    startAbsorbing(enemy) {
        if (!enemy || enemy.isBeingAbsorbed || !enemy.isActive || enemy.isDying) {
            return; 
        }
        enemy.isBeingAbsorbed = true; 
        enemy.vx = 0; 
        enemy.vy = 0;
        this.absorbingEnemies.push({
            enemyRef: enemy,
            timer: Config.PORTAL_ABSORB_ANIMATION_DURATION,
            startX: enemy.x,
            startY: enemy.y,
            startWidth: enemy.width,
            startHeight: enemy.height,
        });
    }
}