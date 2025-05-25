// js/utils/debugLogger.js

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

// Keep console.error for actual errors, or create a debugError for non-fatal debug issues
export function error(...args) {
    console.error(...args); // Real errors should always show
}