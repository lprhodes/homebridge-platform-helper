"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hap_nodejs_1 = require("hap-nodejs");
const assert_1 = __importDefault(require("assert"));
class ServiceManager {
    constructor(name, serviceType, log) {
        assert_1.default(name, 'ServiceManager requires a "name" to be provided.');
        assert_1.default(serviceType, 'ServiceManager requires the "type" to be provided.');
        assert_1.default(log, 'ServiceManager requires "log" to be provided.');
        this.name = name;
        this.log = log;
        this.service = new serviceType(name, "");
        this.characteristics = {};
        this.addNameCharacteristic();
    }
    getCharacteristic(characteristic) {
        return this.service.getCharacteristic(characteristic);
    }
    setCharacteristic(characteristic, value) {
        this.service.setCharacteristic(characteristic, value);
    }
    refreshCharacteristicUI(characteristic) {
        this.getCharacteristic(characteristic).getValue();
    }
    // Convenience
    addCharacteristic(args) {
        const { name, type, getSet, method, bind, props } = args;
        this.characteristics[name] = type;
        if (props) {
            props.propertyName = name;
            assert_1.default(bind, 'A value for `bind` is required if you are setting `props`');
            this.getCharacteristic(type).on(getSet, method.bind(bind, props));
        }
        else {
            const boundMethod = bind ? method.bind(bind) : method;
            this.getCharacteristic(type).on(getSet, boundMethod);
        }
    }
    addGetCharacteristic(args) {
        const { name, type, method, bind, props } = args;
        this.addCharacteristic({ name, type, getSet: 'get', method, bind, props });
    }
    addSetCharacteristic(args) {
        const { name, type, method, bind, props } = args;
        this.addCharacteristic({ name, type, getSet: 'set', method, bind, props });
    }
    addToggleCharacteristic(args) {
        const { name, type, getMethod, setMethod, bind, props } = args;
        this.addGetCharacteristic({ name, type, method: getMethod, bind, props });
        this.addSetCharacteristic({ name, type, method: setMethod, bind, props });
    }
    getCharacteristicTypeForName(name) {
        return this.characteristics[name];
    }
    // Name Characteristic
    addNameCharacteristic() {
        this.addCharacteristic({
            name: 'name',
            getSet: 'get',
            type: hap_nodejs_1.Characteristic.Name,
            method: this.getName
        });
    }
    getName(callback) {
        const { log, name } = this;
        log(`${name} getName: ${name}`);
        callback(null, name);
    }
}
exports.default = ServiceManager;
//# sourceMappingURL=serviceManager.js.map