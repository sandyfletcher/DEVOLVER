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

    // --- 1D Noise ---
    grad1D(hash, x) { // calculate gradient function for 1D noise - select pseudo-random gradient direction based on the hash value and computes dot product
        const h = hash & 15; // use lower 4 bits of hash to select one of 16 gradients
        const grad = 1 + (h & 7); // generate gradient value
        return ((h & 8) !== 0 ? -grad : grad) * x; // apply sign based on 8th bit (h & 8) - if non-zero, make it negative
    }

    noise1D(x) { // computes 1D Perlin noise value for given coordinate x
        const X = Math.floor(x) & 255; // integer part of x, masked to wrap around 0-255
        const xf = x - Math.floor(x); // fractional part of x [0, 1)
        const u = this.fade(xf); // compute the fade curve value for the fractional part
        const n0 = this.grad1D(this.p[X], xf); // get hash values for two integer grid points surrounding x using the permutation table
        const n1 = this.grad1D(this.p[X + 1], xf - 1); // gradient contribution from point X+1
        // Original scale was 2.2. Output is roughly in [-1, 1] before this.
        // Let's keep it consistent for now, or aim for a strict [-1, 1] by adjusting multiplier.
        // A standard Perlin 1D output range is often [-sqrt(1)/2, sqrt(1)/2] = [-0.5, 0.5].
        // To make it closer to [-1, 1], we multiply by 2.
        // The 2.2 was arbitrary, let's make it 2.0 for 1D to be more standard.
        return this.lerp(u, n0, n1) * 2.0;
    }

    // --- 2D Noise ---
    // Gradients for 2D noise (normalized vectors for the 8 directions)
    // (1,1), (-1,1), (1,-1), (-1,-1), (1,0), (-1,0), (0,1), (0,-1)
    // Simplified to 4 diagonal gradients for classic Perlin noise:
    // (1,1), (-1,1), (1,-1), (-1,-1)
    // For Ken Perlin's improved noise, specific gradient sets are used.
    // Here we'll use 8 common gradients for better quality than just 4.
    grad2D(hash, x, y) {
        const h = hash & 7; // Use lower 3 bits for 8 directions
        const u = h < 4 ? x : y;
        const v = h < 4 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise2D(x, y) {
        const X = Math.floor(x) & 255; // Integer part of x, wrapped
        const Y = Math.floor(y) & 255; // Integer part of y, wrapped

        const xf = x - Math.floor(x); // Fractional part of x
        const yf = y - Math.floor(y); // Fractional part of y

        const u = this.fade(xf); // Fade curve for x
        const v = this.fade(yf); // Fade curve for y

        // Hash coordinates of the 4 square corners
        const aa = this.p[this.p[X] + Y];
        const ab = this.p[this.p[X] + Y + 1];
        const ba = this.p[this.p[X + 1] + Y];
        const bb = this.p[this.p[X + 1] + Y + 1];

        // Add contributions from each corner
        const n00 = this.grad2D(aa, xf, yf);
        const n01 = this.grad2D(ab, xf, yf - 1);
        const n10 = this.grad2D(ba, xf - 1, yf);
        const n11 = this.grad2D(bb, xf - 1, yf - 1);

        // Interpolate
        const nx0 = this.lerp(u, n00, n10);
        const nx1 = this.lerp(u, n01, n11);
        const nxy = this.lerp(v, nx0, nx1);

        // The theoretical output range of 2D Perlin noise is [-sqrt(2)/2, sqrt(2)/2] approx [-0.707, 0.707].
        // To map it to roughly [-1, 1], we can multiply by sqrt(2) or a bit more.
        // Let's use 1.414 (sqrt(2)) for a standard [-1, 1] mapping.
        return nxy * 1.414;
    }
}