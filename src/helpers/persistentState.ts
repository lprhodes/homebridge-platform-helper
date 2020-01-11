import nodePersist from 'node-persist'
import { AccessoryState } from '../typings'
import { API as Homebridge } from '../@types/homebridge'

interface PersistentStateInitArgs {
  homebridgeDirectory: string
  homebridge: Homebridge
}

const init = (args: PersistentStateInitArgs) => {
  let { homebridgeDirectory, homebridge } = args

  if (!homebridgeDirectory) {
    homebridgeDirectory = homebridge.user.storagePath()
  }

  nodePersist.initSync({
    dir: `${homebridgeDirectory}/plugin-persist/homebridge-broadlink-rm`,
    forgiveParseErrors: true
  })
}

interface PersistentStateArgs {
  host: string
  name: string
  state?: AccessoryState
}

const clear = (args: PersistentStateArgs) => {
  let { host, name } = args

  if (!host) host = 'default'

  return nodePersist.removeItemSync(`${host}-${name}`)
}

const load = (args: PersistentStateArgs) => {
  let { host, name } = args

  if (!host) host = 'default'

  return nodePersist.getItemSync(`${host}-${name}`)
}

const save = (args: PersistentStateArgs) => {
  let { host, name, state } = args

  if (!host) host = 'default'

  return nodePersist.setItemSync(`${host}-${name}`, state)
}

export {
  init,
  clear,
  load,
  save
}
