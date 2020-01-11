import { Characteristic } from "hap-nodejs"
import { LogFunction, GetNameCallback, AddCharacteristicArgs, GetSetCharacteristicArgs, AddToggleCharacteristicArgs, ServiceType } from "./typings"
import assert from 'assert'

class ServiceManager {

  name: string
  log: LogFunction
  service: HAPNodeJS.Service
  characteristics: {[key: string]: HAPNodeJS.Characteristic}

  constructor(
    name: string, serviceType: ServiceType, log: LogFunction) {
    assert(name, 'ServiceManager requires a "name" to be provided.')
    assert(serviceType, 'ServiceManager requires the "type" to be provided.')
    assert(log, 'ServiceManager requires "log" to be provided.')
    
    this.name = name
    this.log = log
    
    this.service = new serviceType(name);
    this.characteristics = {}

    this.addNameCharacteristic()
  }

  getCharacteristic(characteristic: HAPNodeJS.Characteristic): HAPNodeJS.Characteristic {
    return this.service.getCharacteristic(characteristic)
  }

  setCharacteristic(characteristic: HAPNodeJS.Characteristic, value: any): void {    
    this.service.setCharacteristic(characteristic, value);
  }

  refreshCharacteristicUI(characteristic: HAPNodeJS.Characteristic): void {
    this.getCharacteristic(characteristic).getValue();
  }

  // Convenience

  addCharacteristic(args: AddCharacteristicArgs): void {
    const { name, type, getSet, method, bind, props } = args
    this.characteristics[name] = type


    if (props) {
      props.propertyName = name

      assert(bind, 'A value for `bind` is required if you are setting `props`')
      this.getCharacteristic(type).on(getSet, method.bind(bind, props));
    } else {
      const boundMethod = bind ? method.bind(bind) : method
      this.getCharacteristic(type).on(getSet, boundMethod);
    }
  }

  addGetCharacteristic(args: GetSetCharacteristicArgs): void {
    const { name, type, method, bind, props } = args
    this.addCharacteristic({ name, type, getSet: 'get', method, bind, props })
  }

  addSetCharacteristic(args: GetSetCharacteristicArgs): void {
    const { name, type, method, bind, props } = args
    this.addCharacteristic({ name, type, getSet: 'set', method, bind, props })
  }

  addToggleCharacteristic(args: AddToggleCharacteristicArgs): void {
    const { name, type, getMethod, setMethod, bind, props } = args
    
    this.addGetCharacteristic({ name, type, method: getMethod, bind, props }) 
    this.addSetCharacteristic({ name, type, method: setMethod, bind, props }) 
  }

  getCharacteristicTypeForName(name: string): HAPNodeJS.Characteristic {
    return this.characteristics[name]
  }

  // Name Characteristic

  addNameCharacteristic(): void {
    this.addCharacteristic({
      name: 'name',
      getSet: 'get',
      type: Characteristic.Name,
      method: this.getName
    });
  }

  getName(callback: GetNameCallback): void {
    const { log, name } = this

    log(`${name} getName: ${name}`);

    callback(null, name);
  }
}

export default ServiceManager