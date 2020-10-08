import { ConfigData } from './config'
import { API as Homebridge } from '../@types/homebridge'
import HomebridgeAccessory from '../accessory'

export type LogFunction = (message: string, message2?: string) => void

export declare class HomebridgePlatformHelper {

    constructor(log: LogFunction, config: ConfigData, homebridge: Homebridge)

    addAccessories(_accessories: HomebridgeAccessory[]): Promise<void>
    
    accessories(callback: AccessoriesCallback): Promise<void>
}

export type Characteristics = {[key: string]: HAPNodeJS.Characteristic}

export declare class ServiceManager {

    name: string
    log: LogFunction
    service: HAPNodeJS.Service
    characteristics: Characteristics

    constructor(name: string, serviceType: HAPNodeJS.PredefinedService, log: LogFunction)

    getCharacteristic(characteristic: HAPNodeJS.Characteristic): HAPNodeJS.Characteristic
    setCharacteristic(characteristic: HAPNodeJS.Characteristic, value: any): void
    refreshCharacteristicUI(characteristic: HAPNodeJS.Characteristic): void

    addCharacteristic(args: AddCharacteristicArgs): void 
    addGetCharacteristic(args: GetSetCharacteristicArgs): void
    addSetCharacteristic(args: GetSetCharacteristicArgs): void
    addToggleCharacteristic(args: AddToggleCharacteristicArgs): void
    getCharacteristicTypeForName(name: string): HAPNodeJS.Characteristic

    addNameCharacteristic(): void
    getName(callback: GetNameCallback): void
}

export type ServiceManagerType = new () => ServiceManager

export type AccessoryState = {[key: string]: any}

export type SaveStateFunction = (state: AccessoryState) => void

export type AccessoriesCallback = (accessories: HomebridgeAccessory[]) => void
export type GetNameCallback = (error: Error | null, name: string) => void

// Service Manager

export interface AddCharacteristicArgs {
    name: string
    type: HAPNodeJS.Characteristic
    getSet: HAPNodeJS.EventCharacteristic
    method: Function
    bind?: (self: object) => void
    props?: CharacteristicArgsProps
}

export interface GetSetCharacteristicArgs {
    name: string
    type: HAPNodeJS.Characteristic
    method: Function
    bind?: (self: object) => void
    props?: CharacteristicArgsProps
}

export interface AddToggleCharacteristicArgs {
    name: string
    type: HAPNodeJS.Characteristic
    getMethod: Function
    setMethod: Function
    bind?: (self: object) => void
    props?: CharacteristicArgsProps
}

interface CharacteristicArgsProps {
    propertyName: string
}