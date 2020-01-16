"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const hap_nodejs_1 = require("hap-nodejs");
const uuid_1 = __importDefault(require("uuid"));
const helpers_1 = require("./helpers");
const mqtt = __importStar(require("mqtt"));
const serviceManager_1 = __importDefault(require("./serviceManager"));
const addSaveProxy = (target, saveFunc) => {
    const handler = {
        set(target, key, value) {
            target[key] = value;
            saveFunc(target);
            return true;
        }
    };
    return new Proxy(target, handler);
};
class HomebridgeAccessory {
    constructor(log, config) {
        this.debug = false;
        this.serialNumber = uuid_1.default.v4();
        this.isMQTTConnecting = false;
        this.isReloadingState = false;
        let { disableLogs, host, name, data } = config;
        this.log = (!disableLogs && log) ? log : () => { };
        this.config = config;
        this.host = host;
        this.name = name;
        this.data = data;
        this.state = {};
        this.checkConfig(config);
        this.serviceManager = this.createServiceManager();
        this.configureServiceManager(this.serviceManager);
        this.loadState();
        this.setDefaults();
        this.subscribeToMQTT();
    }
    serviceType() {
        throw new Error('The "serviceType" method must be overridden.');
    }
    createServiceManager() {
        const { log, name, serviceType } = this;
        return new serviceManager_1.default(name, serviceType(), log);
    }
    configureServiceManager(serviceManager) {
        throw new Error('The "configureServiceManager" method must be overridden.');
    }
    setDefaults() { }
    restoreStateOrder() { }
    correctReloadedState(_state) { }
    updateAccessories(accessories) { }
    checkConfig(config) {
        const { name, log } = this;
        if (typeof config !== 'object')
            return;
        // Forgo type checks here
        const untypedConfig = config;
        Object.keys(untypedConfig).forEach((key) => {
            const value = untypedConfig[key];
            if (value === 'true' || value === 'false') {
                log(`\x1b[31m[CONFIG ERROR]\x1b[0m ${name}Boolean values should look like this: \x1b[32m"${key}": ${value}\x1b[0m not this \x1b[31m"${key}": "${value}"\x1b[0m`);
                process.exit(0);
            }
            else if (Array.isArray(value)) {
                value.forEach((item) => {
                    this.checkConfig(item);
                });
            }
            else if (typeof value === 'object') {
                this.checkConfig(value);
            }
            else if (value === '0' || (typeof value === 'string' && parseInt(value) !== 0 && !isNaN(parseInt(value)))) {
                if (typeof value === 'string' && value.split('.').length - 1 > 1)
                    return;
                if (typeof value === 'string' && !value.match(/^\d\.{0,1}\d*$/))
                    return;
                log(`\x1b[31m[CONFIG ERROR]\x1b[0m ${name}Numeric values should look like this: \x1b[32m"${key}": ${value}\x1b[0m not this \x1b[31m"${key}": "${value}"\x1b[0m`);
                process.exit(0);
            }
        });
    }
    identify(callback) {
        const { name } = this;
        this.log(`Identify requested for ${name}`);
        callback();
    }
    performSetValueAction(args) {
        throw new Error('The "performSetValueAction" method must be overridden.');
    }
    async setCharacteristicValue(props, value, callback) {
        const { config, host, log, name, debug } = this;
        try {
            const { delay, resendDataAfterReload, allowResend } = config;
            const { propertyName, onData, offData, setValuePromise, ignorePreviousValue } = props;
            const capitalizedPropertyName = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
            if (delay) {
                log(`${name} set${capitalizedPropertyName}: ${value} (delaying by ${delay}s)`);
                await helpers_1.delayForDuration(delay);
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
                previousValue = undefined;
            }
            this.state[propertyName] = value;
            // Set toggle data if this is a toggle
            const data = value ? onData : offData;
            if (setValuePromise) {
                setValuePromise(data, previousValue);
            }
            else if (data) {
                this.performSetValueAction({ host, data, log, name });
            }
            callback(null, this.state[propertyName]);
        }
        catch (err) {
            log('setCharacteristicValue error:', err.message);
            if (debug)
                log(`\x1b[33m[DEBUG]\x1b[0m ${name} setCharacteristicValue error`, err);
            callback(err);
        }
    }
    async getCharacteristicValue(props, callback) {
        const { propertyName } = props;
        const { log, name } = this;
        const capitalizedPropertyName = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
        let value = this.state[propertyName];
        log(`${name} get${capitalizedPropertyName}: ${value}`);
        callback(null, value);
    }
    loadState() {
        const { config, log, name, serviceManager } = this;
        let { host, resendDataAfterReload, resendDataAfterReloadDelay, persistState } = config;
        // Set defaults
        if (persistState === undefined)
            persistState = true;
        if (!resendDataAfterReloadDelay)
            resendDataAfterReloadDelay = 2;
        if (!persistState)
            return;
        // Load state from file
        this.restoreStateOrder();
        const state = helpers_1.persistentState.load({ host, name }) || {};
        // Allow each accessory to correct the state if necessary
        this.correctReloadedState(state);
        // Proxy so that whenever this.state is changed, it will persist to disk
        this.state = addSaveProxy(state, (state) => {
            helpers_1.persistentState.save({ host, name, state });
        });
        // Refresh the UI and resend data based on existing state
        Object.keys(serviceManager.characteristics).forEach((name) => {
            if (this.state[name] === undefined)
                return;
            const characteristicType = serviceManager.characteristics[name];
            // Refresh the UI for any state that's been set once the init has completed
            // Use timeout as we want to make sure this doesn't happen until after all child contructor code has run
            setTimeout(() => {
                if (persistState)
                    serviceManager.refreshCharacteristicUI(characteristicType);
            }, 200);
            // Re-set the value in order to resend
            if (resendDataAfterReload && resendDataAfterReloadDelay) {
                // Delay to allow Broadlink to be discovered
                setTimeout(() => {
                    const value = this.state[name];
                    serviceManager.setCharacteristic(characteristicType, value);
                }, (resendDataAfterReloadDelay * 1000));
            }
        });
        if (resendDataAfterReload) {
            this.isReloadingState = true;
            setTimeout(() => {
                this.isReloadingState = false;
                log(`${name} Accessory Ready`);
            }, (resendDataAfterReloadDelay * 1000) + 300);
        }
        else {
            log(`${name} Accessory Ready`);
        }
    }
    getInformationServices() {
        const informationService = new hap_nodejs_1.Service.AccessoryInformation();
        informationService
            .setCharacteristic(hap_nodejs_1.Characteristic.Manufacturer, this.manufacturer || 'Homebridge Easy Platform')
            .setCharacteristic(hap_nodejs_1.Characteristic.Model, this.model || 'Unknown')
            .setCharacteristic(hap_nodejs_1.Characteristic.SerialNumber, this.serialNumber || 'Unknown');
        return [informationService];
    }
    getServices() {
        const services = [];
        services.push(this.serviceManager.service);
        return services;
    }
    // MQTT Support
    subscribeToMQTT() {
        const { config, log, name } = this;
        let { mqttTopic, mqttURL, mqttUsername, mqttPassword } = config;
        if (!mqttTopic || !mqttURL)
            return;
        this.mqttValues = {};
        this.mqttValuesTemp = {};
        let mqttTopicArr;
        // Perform some validation of the mqttTopic option in the config. 
        if (typeof mqttTopic !== 'string' && !Array.isArray(mqttTopic)) {
            log(`\x1b[31m[CONFIG ERROR]\x1b[0m ${name} \x1b[33mmqttTopic\x1b[0m value is incorrect. Please check out the documentation for more details.`);
            return;
        }
        if (Array.isArray(mqttTopic)) {
            const erroneousTopics = mqttTopic.filter((mqttTopicObj) => {
                if (typeof mqttTopic !== 'object')
                    return true;
                const { identifier, topic } = mqttTopicObj;
                if (!identifier || !topic)
                    return true;
                if (typeof identifier !== 'string')
                    return true;
                if (typeof topic !== 'string')
                    return true;
                return false;
            });
            if (erroneousTopics.length > 0) {
                log(`\x1b[31m[CONFIG ERROR]\x1b[0m ${name} \x1b[33mmqttTopic\x1b[0m value is incorrect. Please check out the documentation for more details.`);
                return;
            }
            mqttTopicArr = mqttTopic;
        }
        else {
            // mqqtTopic may be an array or an array of objects. Add to a new array if string.
            const mqttTopicObj = {
                identifier: 'unknown',
                topic: mqttTopic
            };
            mqttTopicArr = [mqttTopicObj];
        }
        // Create an easily referenced instance variable
        const mqttTopicIdentifiersByTopic = {};
        mqttTopicArr.forEach(({ identifier, topic }) => {
            mqttTopicIdentifiersByTopic[topic] = identifier;
        });
        // Connect to mqtt
        const mqttClientID = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
        const options = {
            keepalive: 10,
            clientId: mqttClientID,
            protocolId: 'MQTT',
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
            username: mqttUsername,
            password: mqttPassword,
            will: {
                topic: 'WillMsg',
                payload: 'Connection Closed abnormally..!',
                qos: 0,
                retain: false
            },
            rejectUnauthorized: false
        };
        const mqttClient = mqtt.connect(mqttURL, options);
        this.mqttClient = mqttClient;
        // Subscribe to topics
        this.isMQTTConnecting = true;
        // Timeout isMQTTConnecting - it's used to prevent error messages about not being connected.
        setTimeout(() => {
            this.isMQTTConnecting = false;
        }, 2000);
        mqttClient.on('connect', () => {
            this.isMQTTConnecting = false;
            log(`\x1b[35m[INFO]\x1b[0m ${name} MQTT client connected.`);
            mqttTopicArr.forEach(({ topic }) => {
                mqttClient.subscribe(topic);
            });
        });
        mqttClient.on('error', () => {
            this.isMQTTConnecting = false;
        });
        mqttClient.on('message', (topic, message) => {
            const identifier = mqttTopicIdentifiersByTopic[topic];
            this.onMQTTMessage(identifier, message);
        });
    }
    onMQTTMessage(identifier, message) {
        if (this.mqttValuesTemp)
            this.mqttValuesTemp[identifier] = message.toString();
    }
    mqttValueForIdentifier(identifier) {
        let { log, mqttClient, mqttValues, name } = this;
        mqttValues = mqttValues || {};
        let value = mqttValues[identifier];
        // No identifier may have been set in the user's config so let's try "unknown" too
        if (value === undefined)
            value = mqttValues['unknown'];
        if (!mqttClient || !mqttClient.connected) {
            if (!this.isMQTTConnecting)
                log(`\x1b[31m[ERROR]\x1b[0m ${name} MQTT client is not connected. Value could not be found for topic with identifier "${identifier}".`);
            return;
        }
        if (value === undefined) {
            log(`\x1b[31m[ERROR]\x1b[0m ${name} No MQTT value could be found for topic with identifier "${identifier}".`);
            return;
        }
        return value;
    }
}
exports.default = HomebridgeAccessory;
//# sourceMappingURL=accessory.js.map