import type { DeviceMod } from '@electro/core';
export const terminal: DeviceMod = {
  id: 'terminal', name: 'Клемма', category: 'boxes',
  size: { w: 40, h: 40 },
  icon: 'terminal_1.svg',
  pins: [
    { id: 'T', label: 'T', side: 'top', color: '#7f8c8d' },
  ],
  params: [],
  stamp() {
    // Все провода, подключённые к пину T, автоматически объединяются
    // в один net через buildNetlist (Union-Find). Резистор не нужен.
    return [];
  },
};
