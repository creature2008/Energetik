export type PinDef = { id: string; side: 'left' | 'right'; color: string };
export type ParamDef = { key: string; label: string; type: 'number' | 'select'; options?: { label: string; value: any }[] };

export type DeviceDef = {
  id: string;
  category: string;
  name: string;
  icon?: string;
  w: number;
  h: number;
  params: Record<string, any>;
  pins: PinDef[];
  paramsConfig?: ParamDef[];
};

export const DEVICES: DeviceDef[] = [
  {
    id: 'supply', category: 'power', name: 'Источник 220В', icon: 'supply.svg', w: 80, h: 60,
    params: {},
    pins: [ { id: 'L', side: 'left', color: '#fff' }, { id: 'N', side: 'right', color: '#3498db' } ]
  },
  {
    id: 'breaker', category: 'protection', name: 'Автомат', icon: 'breaker.svg', w: 80, h: 60,
    params: { ratedCurrent: 16, tripped: false },
    pins: [ { id: 'L', side: 'left', color: '#fff' }, { id: 'N', side: 'right', color: '#3498db' } ],
    paramsConfig: [{ key: 'ratedCurrent', label: 'Номинал (А)', type: 'select', options: [
      { label: '6 А', value: 6 }, { label: '10 А', value: 10 }, { label: '16 А', value: 16 }, { label: '25 А', value: 25 }
    ]}]
  },
  {
    id: 'lamp', category: 'light', name: 'Лампа', icon: 'lamp.svg', w: 80, h: 60,
    params: { power: 100, voltage: 220 },
    pins: [ { id: 'L', side: 'left', color: '#fff' }, { id: 'N', side: 'right', color: '#3498db' } ],
    paramsConfig: [
      { key: 'power', label: 'Мощность (Вт)', type: 'number' },
      { key: 'voltage', label: 'Напряжение (В)', type: 'number' }
    ]
  },
  {
    id: 'switch', category: 'switches', name: 'Выключатель', icon: 'switch.svg', w: 80, h: 60,
    params: { closed: false },
    pins: [ { id: 'L', side: 'left', color: '#fff' }, { id: 'N', side: 'right', color: '#3498db' } ]
  },
  {
    id: 'socket', category: 'sockets', name: 'Розетка', w: 80, h: 60,
    params: { voltage: 220 },
    pins: [ { id: 'L', side: 'left', color: '#fff' }, { id: 'N', side: 'right', color: '#3498db' } ]
  },
  {
    id: 'psu_12v', category: 'psu', name: 'БП 12В', w: 80, h: 60,
    params: { outputVoltage: 12, maxOutputAmps: 8, inputAmps: 1.5 },
    pins: [
      { id: 'L', side: 'left', color: '#fff' },
      { id: 'N', side: 'left', color: '#3498db' },
      { id: 'V+', side: 'right', color: '#e74c3c' },
      { id: 'V-', side: 'right', color: '#111' }
    ],
    paramsConfig: [
      { key: 'outputVoltage', label: 'Выходное напряжение (В)', type: 'select', options: [
        { label: '5 В', value: 5 }, { label: '12 В', value: 12 }, { label: '24 В', value: 24 }, { label: '48 В', value: 48 }
      ]},
      { key: 'maxOutputAmps', label: 'Макс. ток (А)', type: 'number' }
    ]
  },
  {
    id: 'motor_1ph', category: 'motors', name: 'Мотор 1-ф', w: 80, h: 60,
    params: { power: 1000, voltage: 220 },
    pins: [ { id: 'L', side: 'left', color: '#fff' }, { id: 'N', side: 'right', color: '#3498db' } ],
    paramsConfig: [{ key: 'power', label: 'Мощность (Вт)', type: 'number' }]
  },
  {
    id: 'motor_3ph', category: 'motors', name: 'Мотор 3-ф', w: 80, h: 60,
    params: { power: 3000, voltage: 380 },
    pins: [
      { id: 'L1', side: 'left', color: '#fff' },
      { id: 'L2', side: 'left', color: '#fff' },
      { id: 'L3', side: 'left', color: '#fff' },
      { id: 'N', side: 'right', color: '#3498db' }
    ],
    paramsConfig: [{ key: 'power', label: 'Мощность (Вт)', type: 'number' }]
  },
  {
    id: 'terminal', category: 'boxes', name: 'Клеммник', w: 80, h: 60,
    params: { lanes: 4 },
    pins: [
      { id: '1', side: 'left', color: '#7f8c8d' },
      { id: '2', side: 'left', color: '#7f8c8d' },
      { id: '3', side: 'right', color: '#7f8c8d' },
      { id: '4', side: 'right', color: '#7f8c8d' }
    ]
  }
];
