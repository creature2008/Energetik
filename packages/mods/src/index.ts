import { registry } from '@electro/core';
import { supply } from './supply';
import { supply_3ph } from './supply_3ph';
import { supply_3ph_delta } from './supply_3ph_delta';
import { supply_us_2ph } from './supply_us_2ph';
import { lamp } from './lamp';
import { led_strip } from './led_strip';
import { breaker_1p, breaker_2p, breaker_3p, breaker_4p } from './breaker';
import { rcd_2p, rcd_4p, dif_2p, dif_4p } from './rcd';
import { contactor } from './contactor';
import { button } from './button';
import { button_2p } from './button_2p';
import { relay } from './relay';
import { timer_relay } from './timer_relay';
import { signal_lamp } from './signal_lamp';
import { switch_1, switch_2, switch_3 } from './switch';
import {
  socket_10a_pe, socket_10a,
  socket_16a, socket_16a_2p,
  socket_32a, socket_63a,
  socket_3ph_16a, socket_3ph_32a,
} from './socket';
import { psu_12v } from './psu_12v';
import { motor_1ph } from './motor_1ph';
import { motor_3ph } from './motor_3ph';
import { terminal } from './terminal';

export function registerAllMods() {
  registry.register(supply);
  registry.register(supply_3ph);
  registry.register(supply_3ph_delta);
  registry.register(supply_us_2ph);
  registry.register(lamp);
  registry.register(led_strip);
  registry.register(breaker_1p);
  registry.register(breaker_2p);
  registry.register(breaker_3p);
  registry.register(breaker_4p);
  registry.register(rcd_2p);
  registry.register(rcd_4p);
  registry.register(dif_2p);
  registry.register(dif_4p);
  registry.register(contactor);
  registry.register(button);
  registry.register(button_2p);
  registry.register(relay);
  registry.register(timer_relay);
  registry.register(signal_lamp);
  registry.register(switch_1);
  registry.register(switch_2);
  registry.register(switch_3);
  registry.register(socket_10a_pe);
  registry.register(socket_10a);
  registry.register(socket_16a);
  registry.register(socket_16a_2p);
  registry.register(socket_32a);
  registry.register(socket_63a);
  registry.register(socket_3ph_16a);
  registry.register(socket_3ph_32a);
  registry.register(psu_12v);
  registry.register(motor_1ph);
  registry.register(motor_3ph);
  registry.register(terminal);
}
