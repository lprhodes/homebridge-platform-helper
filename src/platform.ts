import * as semver from 'semver'
import { persistentState } from './helpers'

import { LogFunction, AccessoriesCallback } from './typings';
import { ConfigData } from './typings/config';
import HomebridgeAccessory from './accessory';
import { API as Homebridge } from './@types/homebridge';

if (semver.lt(process.version, '7.6.0')) throw new Error(`Homebridge plugins that use the "homebridge-platform-helper" library require your node version to be at least the v12.14.0 LTM. Current version: ${process.version}`)

class HomebridgePlatform {

  private log: LogFunction
  private config: ConfigData

  constructor (log: LogFunction, config: ConfigData, homebridge: Homebridge) {
    this.log = log
    this.config = config

    const { homebridgeDirectory } = config

    persistentState.init({ homebridge, homebridgeDirectory })
  }

  public async addAccessories(_accessories: HomebridgeAccessory[]): Promise<void> {
    throw new Error('The addAccessories method must be overridden.')
  }

  public async accessories(callback: AccessoriesCallback) {
    const { config, log } = this
    const { name, disableLogs } = config

    const accessories: HomebridgeAccessory[] = []

    await this.addAccessories(accessories)

    // Disable logs if requested
    if (disableLogs !== undefined) {
      accessories.forEach((accessory) => {
        if (accessory.config.disableLogs === undefined) {
          accessory.config.disableLogs = disableLogs
        }
      })
    }

    // Check for no accessories
    if (!config.accessories || config.accessories.length === 0) {
      if (!disableLogs) log(`No accessories have been added to the "${name}" platform config.`);
      return callback(accessories);
    }

    // Let accessories know about one-another if they wish
    accessories.forEach((accessory) => {
      if (accessory.updateAccessories) accessory.updateAccessories(accessories);
    })

    callback(accessories)
  }
}

export default HomebridgePlatform
