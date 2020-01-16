"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const semver = __importStar(require("semver"));
const helpers_1 = require("./helpers");
if (semver.lt(process.version, '7.6.0'))
    throw new Error(`Homebridge plugins that use the "homebridge-platform-helper" library require your node version to be at least the v12.14.0 LTM. Current version: ${process.version}`);
class HomebridgePlatform {
    constructor(log, config, homebridge) {
        this.log = log;
        this.config = config;
        const { homebridgeDirectory } = config;
        helpers_1.persistentState.init({ homebridge, homebridgeDirectory });
    }
    async addAccessories(_accessories) {
        throw new Error('The addAccessories method must be overridden.');
    }
    async accessories(callback) {
        const { config, log } = this;
        const { name, disableLogs } = config;
        const accessories = [];
        await this.addAccessories(accessories);
        // Disable logs if requested
        if (disableLogs !== undefined) {
            accessories.forEach((accessory) => {
                if (accessory.config.disableLogs === undefined) {
                    accessory.config.disableLogs = disableLogs;
                }
            });
        }
        // Check for no accessories
        if (!config.accessories || config.accessories.length === 0) {
            if (!disableLogs)
                log(`No accessories have been added to the "${name}" platform config.`);
            return callback(accessories);
        }
        // Let accessories know about one-another if they wish
        accessories.forEach((accessory) => {
            if (accessory.updateAccessories)
                accessory.updateAccessories(accessories);
        });
        callback(accessories);
    }
}
exports.default = HomebridgePlatform;
//# sourceMappingURL=platform.js.map