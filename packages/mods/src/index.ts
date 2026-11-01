import { registry } from '@electro/core';
import { supply } from './supply';
import { lamp } from './lamp';
import { breaker } from './breaker';
import { switchMod } from './switch';
import { socket } from './socket';
import { psu_12v } from './psu_12v';
import { motor_1ph } from './motor_1ph';
import { motor_3ph } from './motor_3ph';
import { terminal } from './terminal';

export function registerAllMods() {
  registry.register(supply);
  registry.register(lamp);
  registry.register(breaker);
  registry.register(switchMod);
  registry.register(socket);
  registry.register(psu_12v);
  registry.register(motor_1ph);
  registry.register(motor_3ph);
  registry.register(terminal);
}
