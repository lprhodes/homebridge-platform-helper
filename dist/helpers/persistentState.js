"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_persist_1 = __importDefault(require("node-persist"));
const init = (args) => {
    let { homebridgeDirectory, homebridge } = args;
    if (!homebridgeDirectory) {
        homebridgeDirectory = homebridge.user.storagePath();
    }
    node_persist_1.default.initSync({
        dir: `${homebridgeDirectory}/plugin-persist/homebridge-broadlink-rm`,
        forgiveParseErrors: true
    });
};
exports.init = init;
const clear = (args) => {
    let { host, name } = args;
    if (!host)
        host = 'default';
    return node_persist_1.default.removeItemSync(`${host}-${name}`);
};
exports.clear = clear;
const load = (args) => {
    let { host, name } = args;
    if (!host)
        host = 'default';
    return node_persist_1.default.getItemSync(`${host}-${name}`);
};
exports.load = load;
const save = (args) => {
    let { host, name, state } = args;
    if (!host)
        host = 'default';
    return node_persist_1.default.setItemSync(`${host}-${name}`, state);
};
exports.save = save;
//# sourceMappingURL=persistentState.js.map