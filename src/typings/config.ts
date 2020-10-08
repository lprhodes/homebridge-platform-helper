import HomebridgeAccessory from "../accessory";

export type ConfigData = {[key: string]: any}

export interface MQTTObject {
    identifier: string
    topic: string
}

export interface PluginConfig {
    host: string
    name: string
    data: ConfigData
    accessories: HomebridgeAccessory[]
    disableLogs?: boolean
    homebridgeDirectory?: string
}

export interface AccessoryConfig {
    serviceType: HAPNodeJS.PredefinedService
    host: string
    name: string
    data: ConfigData
    disableLogs?: boolean
    persistState?: boolean
    resendDataAfterReload?: boolean
    resendDataAfterReloadDelay?: number
    delay: number
    allowResend: boolean
    
    mqttTopic: Array<MQTTObject> | string
    mqttURL: string
    mqttUsername: string
    mqttPassword: string
}