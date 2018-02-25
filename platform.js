const persistentState = require('./helpers/persistentState')
const semver = require('semver');

if (semver.lt(process.version, '7.6.0')) throw new Error(`Homebridge plugins that use the "homebridge-easy-platform" library require your node version to be at least v7.6.0. Current version: ${process.version}`)

class HomebridgePlatform {

  constructor (log, config = {}) {
    this.log = log;
    this.config = config;

    const { homebridgeDirectory } = config;

    persistentState.init({ homebridgeDirectory });
  }

  addAccessories (accessories) {
    throw new Error('The addAccessories method must be overridden.')
  };

  accessories (callback) {
    const { config, log } = this;
    const { name } = config;

    const accessories = [];

    this.addAccessories(accessories);

    // Check for no accessories
    if (!config.accessories || config.accessories.length === 0) {
      log(`No accessories have been added to the "${name}" platform config.`);
      return callback(accessories);
    }

    // Let accessories know about one-another if they wish
    accessories.forEach((accessory) => {
      if (accessory.updateAccessories) accessory.updateAccessories(accessories);
    })

    callback(accessories);
  }
}

module.exports = HomebridgePlatform;
