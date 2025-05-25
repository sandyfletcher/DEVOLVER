// =============================================================================
// js/utils/debugLogger.js
// =============================================================================

import * as Config from './config.js';

export function log(...args) {
    if (Config.DEBUG_MODE) {
        console.log(...args);
    }
}
export function warn(...args) {
    if (Config.DEBUG_MODE) {
        console.warn(...args);
    }
}
export function error(...args) { // real errors always show, regardless of DEBUG, but could create separate function if more granularity is wanted
    console.error(...args);
}
export function time(label) {
    if (Config.DEBUG_MODE) {
        console.time(label);
    }
}
export function timeEnd(label) {
    if (Config.DEBUG_MODE) {
        console.timeEnd(label);
    }
}