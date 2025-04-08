// -----------------------------------------------------------------------------
// js/utils/noise.js - Perlin Noise Generator Implementation
// -----------------------------------------------------------------------------

// console.log("utils/noise loaded");

/**
 * A classic Perlin noise generator implementation (1D focus for this project).
 * Based on Ken Perlin's algorithm.
 */
export class PerlinNoise {
    constructor(seed = Math.random()) {
        this.permutation = [];
        this.p = new Array(512);
        this.seed(seed);
    }

    /**
     * Seeds the noise generator using a deterministic pseudo-random number generator (PRNG)
     * derived from the input seed. This ensures repeatable noise patterns for the same seed.
     * @param {number} seed - The seed value (a number).
     */
    seed(seed) {
        // Simple Linear Congruential Generator (LCG) for deterministic randomness
        const random = (() => {
            let state = Math.floor(seed * 2 ** 32); // Initialize state from seed
            return () => {
                // LCG parameters (commonly used, e.g., glibc)
                state = (1103515245 * state + 12345) | 0; // Ensure 32-bit integer math
                // Normalize output to [0, 1) range
                return (state >>> 16) / 65536;
            };
        })();

        // Initialize the permutation table with values 0-255
        this.permutation = Array.from({ length: 256 }, (_, i) => i);

        // Shuffle the permutation table using the seeded PRNG (Fisher-Yates shuffle)
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            // Swap elements
            [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
        }

        // Duplicate the permutation array to avoid modulo operations in the noise function
        // p[i] = permutation[i % 256] is replaced by p[i] = p[i & 255]
        for (let i = 0; i < 512; i++) {
            this.p[i] = this.permutation[i & 255];
        }
    }

    /**
     * The fade function (smoothstep: 6t^5 - 15t^4 + 10t^3).
     * It smooths the interpolation factor, avoiding sharp corners in the noise.
     * @param {number} t - A value typically between 0 and 1.
     * @returns {number} The smoothed value.
     */
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    /**
     * Linear interpolation between two values.
     * @param {number} t - The interpolation factor (usually 0 to 1).
     * @param {number} a - The starting value.
     * @param {number} b - The ending value.
     * @returns {number} The interpolated value.
     */
    lerp(t, a, b) {
        return a + t * (b - a);
    }

    /**
     * Calculates the gradient function for 1D noise. It selects a pseudo-random
     * gradient direction based on the hash value and computes the dot product (simplified for 1D).
     * @param {number} hash - An integer hash value derived from the permutation table.
     * @param {number} x - The fractional distance from the integer grid point.
     * @returns {number} The gradient contribution.
     */
    grad(hash, x) {
        const h = hash & 15;        // Use lower 4 bits of hash to select one of 16 gradients (simplified for 1D)
        const grad = 1 + (h & 7);   // Generate gradient value (1 to 8). For 1D, it's just a magnitude.
        // Apply sign based on the 8th bit (h & 8). If non-zero, make it negative.
        return ((h & 8) !== 0 ? -grad : grad) * x; // Dot product in 1D is just multiplication
    }

    /**
     * Computes the 1D Perlin noise value for a given coordinate x.
     * @param {number} x - The input coordinate.
     * @returns {number} The Perlin noise value, typically scaled to be roughly within [-1, 1].
     */
    noise(x) {
        const X = Math.floor(x) & 255;      // Integer part of x, masked to wrap around 0-255
        const xf = x - Math.floor(x);       // Fractional part of x [0, 1)

        // Compute the fade curve value for the fractional part
        const u = this.fade(xf);

        // Get hash values for the two integer grid points surrounding x using the permutation table
        // this.p[X] = hash for integer point X
        // this.p[X + 1] = hash for integer point X+1
        const n0 = this.grad(this.p[X], xf);      // Gradient contribution from point X
        const n1 = this.grad(this.p[X + 1], xf - 1); // Gradient contribution from point X+1

        // Interpolate the two gradient contributions using the faded fractional part
        // The scaling factor (e.g., 2.2) is empirical, adjusting the output range.
        // Classic Perlin noise can slightly exceed [-1, 1].
        return this.lerp(u, n0, n1) * 2.2;
    }
}