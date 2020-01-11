"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const delayForDuration = (duration) => {
    return new Promise((resolve) => {
        setTimeout(resolve, duration * 1000);
    });
};
exports.default = delayForDuration;
//# sourceMappingURL=delayForDuration.js.map