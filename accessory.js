const persistentState = require('./helpers/persistentState');

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

  constructor (log, config = {}) {
    let { disableLogs, host, name, data, persistState, resendDataAfterReload } = config;


    this.log = !disableLogs ? log : () => {};
    this.config = config;

    this.host = host;
    this.name = name;
    this.data = data;

    // Set defaults
    if (persistState === undefined) persistState = true;

    if (persistState) {
      if (resendDataAfterReload) this.isReloadingState = true;

      const restoreStateOrder = this.restoreStateOrder();
      const state = persistentState.load({ host, name }) || {};

      this.correctReloadedState(state);

      this.state = addSaveProxy(name, state, (state) => {
        persistentState.save({ host, name, state });
      });

      if (resendDataAfterReload) {
        setTimeout(() => {
          this.isReloadingState = false;
          
          log(`${name} Accessory Ready`);
        }, 2300);
      } else {
        log(`${name} Accessory Ready`);
      }
    } else {
      this.state = {};
    }
  }

  restoreStateOrder () { }

  correctReloadedState () { }

  identify (callback) {
    const { name } = this

    this.log(`Identify requested for ${name}`);

    callback();
  }

  getName (callback) {
    const { name } = this

		this.log(`${name} getName: ${name}`);

		callback(null, name);
	}

  addNameService (service) {
    service.getCharacteristic(Characteristic.Name).on('get', this.getName.bind(this));
  }

  performSetValueAction ({ host, data, log, name }) {
    throw new Error('The "performSetValueAction" method must be overridden.');
  }

  async setCharacteristicValue (props, value, callback) {    
    try {
      const { service, propertyName, onData, offData, setValuePromise, ignorePreviousValue } = props;
      const { config, host, log, name } = this; 
      const { delay, resendDataAfterReload, allowResend } = config;

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

      const previousValue = this.state[propertyName];
      this.state[propertyName] = value;

      // Set toggle data if this is a toggle
      const data = value ? onData : offData;

      if (setValuePromise) {

        await setValuePromise(data, previousValue);

      } else if (data) {
        this.performSetValueAction({ host, data, log, name });
      }

      callback(null, this.state[propertyName]);
    } catch (err) {
      console.log('setCharacteristicValue err', err)

      callback(err)
    }
  }

  async getCharacteristicValue (props, callback) {
    const { propertyName, defaultValue, getValuePromise } = props;
    const { log, name } = this;

    const capitalizedPropertyName = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);

    let value = this.state[propertyName];

    if (value === undefined) {
      value = (defaultValue !== undefined) ? defaultValue : 0;

      if (value === 'undefined') value = undefined;
    }

    if (getValuePromise) {
      const promiseValue = await getValuePromise();

      if (promiseValue !== undefined) value = promiseValue;
    }

    log(`${name} get${capitalizedPropertyName}: ${value}`);
    callback(null, value);
  }

  createToggleCharacteristic ({ service, characteristicType, onData, offData, propertyName, getValuePromise, setValuePromise, defaultValue, ignorePreviousValue, delay }) {
    const { config } = this;

    service.getCharacteristic(characteristicType)
      .on('set', this.setCharacteristicValue.bind(this, { propertyName, onData, offData, setValuePromise, ignorePreviousValue, service, delay }))
      .on('get', this.getCharacteristicValue.bind(this, { propertyName, defaultValue, getValuePromise }));

      // If there's already a default loaded from persistent state then set the value
      if (this.state[propertyName] !== undefined) {
        const value = this.state[propertyName]
        // this.state[propertyName] = undefined;

        if (config.persistState) {
          service.getCharacteristic(characteristicType).getValue();
        }
        

        if (config.resendDataAfterReload) {
          setTimeout(() => {
            service.setCharacteristic(characteristicType, value);
          }, 2000)
        }
      }
  }

  createDefaultValueGetCharacteristic ({ service, characteristicType, propertyName }) {
    service.getCharacteristic(characteristicType)
      .on('get', (callback) => {
        const value = this.data[propertyName] || 0;

        callback(null, value);
      });
  }

  getInformationServices () {
    const informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer || 'Homebridge Easy Platform')
      .setCharacteristic(Characteristic.Model, this.model || 'Unknown')
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber || 'Unknown');

    return [ informationService ];
  }
}

module.exports = HomebridgeAccessory;

const delayForDuration = (duration) => {
  return new Promise((resolve) => {
    setTimeout(resolve, duration * 1000)
  })
}