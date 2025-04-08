// -----------------------------------------------------------------------------
// root/js/utils/waveScripts.js - Dictates pace and contents of each enemy wave
// -----------------------------------------------------------------------------

import {
    ENEMY_TYPE_TETRAPOD,
    ENEMY_TYPE_CENTER_SEEKER,
    ENEMY_TYPE_PLAYER_CHASER
    // Add any other ENEMY_TYPE_... constants that you use in the WAVES array below
} from '../config.js';

export const WAVES = [
    { // ==================== Main Wave 1 ====================
        mainWaveNumber: 1, // For reference/UI
        subWaves: [
            { // --- Sub-Wave 1.1 ---
                enemyGroups: [
                    // Group 1: Spawn 10 Tetrapods, slowly, starting immediately
                    { type: ENEMY_TYPE_TETRAPOD, count: 10, delayBetween: 1.8, startDelay: 0.0 },
                    // Group 2: Original Seeker group 1, delayed slightly to appear after tetrapods start
                    { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.7, startDelay: 8.0 },
                    // Group 3: Original Seeker group 2, delayed further
                    { type: ENEMY_TYPE_CENTER_SEEKER, count: 3, delayBetween: 0.5, startDelay: 15.0 },
                ]
            },
            { // --- Sub-Wave 1.2 ---
                // description: "Introducing Chasers",
                enemyGroups: [
                    // Group 1: Spawn 4 Seekers
                    { type: ENEMY_TYPE_CENTER_SEEKER, count: 4, delayBetween: 0.6, startDelay: 1.0 },
                    // Group 2: Spawn 2 Chasers, slower spawn rate, starting later
                    { type: ENEMY_TYPE_PLAYER_CHASER, count: 2, delayBetween: 1.5, startDelay: 3.0 }
                ]
            },
            { // --- Sub-Wave 1.3 ---
                // description: "Mixed Finish",
                enemyGroups: [
                    // Group 1: Quick burst of Seekers
                    { type: ENEMY_TYPE_CENTER_SEEKER, count: 6, delayBetween: 0.4, startDelay: 0.5 },
                     // Group 2: A single tougher Chaser
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 1, delayBetween: 1.0, startDelay: 4.0 }
                ]
            }
        ]
    },
    { // ==================== Main Wave 2 ====================
        mainWaveNumber: 2,
        subWaves: [
            { // --- Sub-Wave 2.1 ---
                 // description: "Chaser Focus",
                 enemyGroups: [
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 4, delayBetween: 1.2, startDelay: 1.0 },
                     { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.6, startDelay: 3.0 }, // Support seekers
                 ]
            },
            { // --- Sub-Wave 2.2 ---
                 // description: "Dense Pack",
                 enemyGroups: [
                     { type: ENEMY_TYPE_CENTER_SEEKER, count: 10, delayBetween: 0.3, startDelay: 0.0 }, // Tightly packed
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 3, delayBetween: 1.0, startDelay: 5.0 }, // Late chasers
                 ]
            },
            { // --- Sub-Wave 2.3 ---
                // description: "Final Push",
                 enemyGroups: [
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 5, delayBetween: 0.9, startDelay: 0.5 },
                     { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.5, startDelay: 1.5 },
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 2, delayBetween: 1.5, startDelay: 6.0 }, // Elite chasers
                 ]
            }
        ]
    },
    // ==================== Add Main Wave 3, 4, etc. here ====================
];
