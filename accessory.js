const persistentState = require('./helpers/persistentState');
const assert = require('assert')

const addSaveProxy = (name, target, saveFunc) => {
  const handler = {
    set (target, key, value) {
      target[key] = value;

      // console.log(`${name} save ${key} ${value}`, target)
      saveFunc(target);

      return true
    }
  }

  return new Proxy(target, handler);
}

class HomebridgeAccessory {

  constructor (log, config = {}, serviceManagerType = 'ServiceManager') {
    this.serviceManagerType = serviceManagerType;

    let { disableLogs, host, name, data, persistState, resendDataAfterReload, resendDataAfterReloadDelay } = config;

    this.log = (!disableLogs && log) ? log : () => {};
    this.config = config;

    this.host = host;
    this.name = name;
    this.data = data;

    this.state = {}

    this.checkConfig(config)
    this.setupServiceManager()
    this.loadState()

    this.setDefaults();
  }

  setDefaults () { }

  restoreStateOrder () { }

  correctReloadedState () { }

  checkConfig (config) {
    if (typeof config !== 'object') return;

    Object.keys(config).forEach((key) => {
      const value = config[key];
      
      if (value === 'true' || value === 'false') {
        console.log(`\x1b[31m[CONFIG ERROR] \x1b[30mBoolean values should look like this: \x1b[32m"${key}": ${value}\x1b[30m not this \x1b[31m"${key}": "${value}"\x1b[30m`);

        process.exit(0);
      } else if (Array.isArray(value)) {
        value.forEach((item) => {
          this.checkConfig(item);
        })
      } else if (typeof value === 'object') {
        this.checkConfig(value);
      } else if (value === '0' || (typeof value === 'string' && parseInt(value) !== 0 && !isNaN(parseInt(value)))) {

        if (typeof value === 'string' && value.split('.').length - 1 > 1) return;
        if (typeof value === 'string' && !value.match(/^\d\.{0,1}\d*$/)) return;

        console.log(`\x1b[31m[CONFIG ERROR] \x1b[30mNumeric values should look like this: \x1b[32m"${key}": ${value}\x1b[30m not this \x1b[31m"${key}": "${value}"\x1b[30m`);

        process.exit(0);
      }
    })
  }

  identify (callback) {
    const { name } = this

    this.log(`Identify requested for ${name}`);

    callback();
  }

  performSetValueAction ({ host, data, log, name }) {
    throw new Error('The "performSetValueAction" method must be overridden.');
  }

  async setCharacteristicValue (props, value, callback) {   
    const { config, host, log, name } = this; 
    try {
      const { delay, resendDataAfterReload, allowResend } = config;
      const { service, propertyName, onData, offData, setValuePromise, ignorePreviousValue } = props;

      const capitalizedPropertyName = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);

      if (delay) {
        log(`${name} set${capitalizedPropertyName}: ${value} (delaying by ${delay}s)`);

        await delayForDuration(delay);
      }

      log(`${name} set${capitalizedPropertyName}: ${value}`);

      if (this.isReloadingState && !resendDataAfterReload) {
        this.state[propertyName] = value;

        log(`${name} set${capitalizedPropertyName}: already ${value} (no data sent - A)`);

        callback(null, value);

        return;
      }

      if (!ignorePreviousValue && this.state[propertyName] == value && !this.isReloadingState) {
        if (!allowResend) {
          log(`${name} set${capitalizedPropertyName}: already ${value} (no data sent - B)`);

          callback(null, value);

          return;
        }
      }

      let previousValue = this.state[propertyName];
      if (this.isReloadingState && resendDataAfterReload) {
        previousValue = undefined
      }

      this.state[propertyName] = value;

      // Set toggle data if this is a toggle
      const data = value ? onData : offData;

      if (setValuePromise) {
         setValuePromise(data, previousValue);
      } else if (data) {
        this.performSetValueAction({ host, data, log, name });
      }

      callback(null, this.state[propertyName]);
    } catch (err) {

      throw err
      log('setCharacteristicValue err', err)

      callback(err)
    }
  }

  async getCharacteristicValue (props, callback) {
    const { propertyName } = props;
    const { log, name } = this;

    const capitalizedPropertyName = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);

    let value = this.state[propertyName];

    log(`${name} get${capitalizedPropertyName}: ${value}`);
    callback(null, value);
  }

  loadState () {
    const { config, log, name, serviceManager } = this;
    let { host, resendDataAfterReload, resendDataAfterReloadDelay, persistState } = config;

    // Set defaults
    if (persistState === undefined) persistState = true;
    if (!resendDataAfterReloadDelay) resendDataAfterReloadDelay = 2

    if (!persistState) return;

    // Load state from file
    const restoreStateOrder = this.restoreStateOrder();
    const state = persistentState.load({ host, name }) || {};

    // Allow each accessory to correct the state if necessary
    this.correctReloadedState(state);

    // Proxy so that whenever this.state is changed, it will persist to disk
    this.state = addSaveProxy(name, state, (state) => {
      persistentState.save({ host, name, state });
    });

    // Refresh the UI and resend data based on existing state
    Object.keys(serviceManager.characteristics).forEach((name) => {
      if (this.state[name] === undefined) return;

      const characteristcType = serviceManager.characteristics[name];

      // Refresh the UI for any state that's been set once the init has completed
      // Use timeout as we want to make sure this doesn't happen until after all child contructor code has run
      setTimeout(() => {
        if (persistState) serviceManager.refreshCharacteristicUI(characteristcType);
      }, 200);

      // Re-set the value in order to resend
      if (resendDataAfterReload) {

        // Delay to allow Broadlink to be discovered
        setTimeout(() => {
          const value = this.state[name];

          serviceManager.setCharacteristic(characteristcType, value);
        }, (resendDataAfterReloadDelay * 1000));
      }
    })

    if (resendDataAfterReload) {
      this.isReloadingState = true;

      setTimeout(() => {
        this.isReloadingState = false;
        
        log(`${name} Accessory Ready`);
      }, (resendDataAfterReloadDelay * 1000) + 300);
    } else {
      log(`${name} Accessory Ready`);
    }
  }

  getInformationServices () {
    const informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer || 'Homebridge Easy Platform')
      .setCharacteristic(Characteristic.Model, this.model || 'Unknown')
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber || 'Unknown');

    return [ informationService ];
  }


  getServices () {
    const services = this.getInformationServices();

    services.push(this.serviceManager.service);

    return services;
  }
}

module.exports = HomebridgeAccessory;

const delayForDuration = (duration) => {
  return new Promise((resolve) => {
    setTimeout(resolve, duration * 1000)
  })
}