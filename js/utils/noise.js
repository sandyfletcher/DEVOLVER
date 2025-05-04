// -----------------------------------------------------------------------------
// js/utils/noise.js - Perlin Noise Generator Implementation
// -----------------------------------------------------------------------------

export class PerlinNoise { // classic Perlin noise generator implementation
    constructor(seed = Math.random()) {
        this.permutation = [];
        this.p = new Array(512);
        this.seed(seed);
    }
    seed(seed) { // seed noise generator using a deterministic pseudo-random number generator derived from the input seed, ensureing repeatable noise patterns
        const random = (() => { // linear congruential generator for deterministic randomness
            let state = Math.floor(seed * 2 ** 32); // initialize state from seed
            return () => {
                state = (1103515245 * state + 12345) | 0; // ensure 32-bit integer math
                return (state >>> 16) / 65536; // normalize output to [0, 1) range
            };
        })();
        this.permutation = Array.from({ length: 256 }, (_, i) => i); // initialize the permutation table with values 0-255
        for (let i = 255; i > 0; i--) { // shuffle the permutation table using seeded PRNG for Fisher-Yates shuffle
            const j = Math.floor(random() * (i + 1));
            [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]]; // swap elements

        }
        for (let i = 0; i < 512; i++) { // duplicate the permutation array to avoid modulo operations in noise function
            this.p[i] = this.permutation[i & 255]; // p[i] = permutation[i % 256] is replaced by p[i] = p[i & 255]
        }
    }
    fade(t) { // fade function (6t^5 - 15t^4 + 10t^3) smooths interpolation factor, avoids sharp corners
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    lerp(t, a, b) { // linear interpolation between two values
        return a + t * (b - a);
    }
    grad(hash, x) { // calculate gradient function for 1D noise - select pseudo-random gradient direction based on the hash value and computes dot product
        const h = hash & 15; // use lower 4 bits of hash to select one of 16 gradients
        const grad = 1 + (h & 7); // generate gradient value
        return ((h & 8) !== 0 ? -grad : grad) * x; // apply sign based on 8th bit (h & 8) - if non-zero, make it negative
    }
    noise(x) { // computes 1D Perlin noise value for given coordinate x
        const X = Math.floor(x) & 255; // integer part of x, masked to wrap around 0-255
        const xf = x - Math.floor(x); // fractional part of x [0, 1)
        const u = this.fade(xf); // compute the fade curve value for the fractional part
        const n0 = this.grad(this.p[X], xf); // get hash values for two integer grid points surrounding x using the permutation table
        const n1 = this.grad(this.p[X + 1], xf - 1); // gradient contribution from point X+1
        return this.lerp(u, n0, n1) * 2.2; // interpolate two gradient contributions using faded fractional part
    }
}