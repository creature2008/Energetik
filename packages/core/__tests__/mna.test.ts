import { describe, it, expect } from 'vitest';
import { solveMna, MnaElement } from '../src/sim/mna';

describe('MNA solver', () => {
  it('простой делитель напряжения (2 резистора)', () => {
    // Схема: источник 10В --- R1(10 Ом) --- узел 1 --- R2(10 Ом) --- земля
    // Узлы: 0 = узел 1, 1 = земля (индекс 2, но мы делаем nodeCount=1, земля=1)
    // Используем nodeCount = 1, земля = индекс 1.
    // Источник: между землёй (nodeB=1) и узлом 0... подожди, земля в MNA — это nodeCount.
    // Источник V1: + на узле 0, - на земле (1).
    // R1: между узлом 0 и землёй? Нет. Перепишем правильно.
    //
    // Схема: V1 (10В) --- R1(10) --- Vout --- R2(10) --- земля
    // Узлы: 0 = Vout. Земля = 1 (nodeCount=1).
    // V1: + на узле 0? Нет, V1 последовательно. 
    // Правильнее: узел 0 = средняя точка (Vout).
    // V1 + на узле 0, - на земле — это неверно, потому что V1 последовательно с R1.
    //
    // Возьмём классику: V1 (10В) подключён + к узлу 0, - к земле.
    // R1 между узлом 0 и узлом 1 (нагрузка R2 на земле). 
    // Слишком сложно для "простого" теста. Сделаем ещё проще:
    // Источник 10В + на узле 0, - на земле. R1(10) между узлом 0 и землёй.
    // Ток через R1 = 10/10 = 1А. Напряжение узла 0 = 10В.
    const elements: MnaElement[] = [
      { type: 'voltageSource', nodeA: 0, nodeB: 1, voltage: 10 },
      { type: 'resistor', nodeA: 0, nodeB: 1, resistance: 10 }
    ];
    // nodeCount = 1 (узел 0), земля = 1
    const result = solveMna(1, elements);
    expect(result.voltages[0]).toBeCloseTo(10, 4);
    // Ток через R1: (V0 - V_земли)/R = 10/10 = 1
    expect(result.currents[1]).toBeCloseTo(1, 4);
    // Ток через источник: -1 (отдаёт в цепь) или +1 — зависит от конвенции
    expect(Math.abs(result.currents[0])).toBeCloseTo(1, 4);
  });

  it('делитель напряжения (R1=10, R2=10)', () => {
    // Узлы: 0 = Vout (средняя точка), 1 = земля
    // V1: + на узле 0? Нет. 
    // Классика: V1(+10В) -- R1 -- Vout -- R2 -- земля.
    // Узлы: 0 = Vout, 1 = земля (nodeCount=1).
    // V1: + на узле 0... нет, V1 между +10В и Vout. 
    // Введём узел "Vcc" = узел 1, земля = узел 2. nodeCount = 2.
    // V1: nodeA=1 (Vcc), nodeB=2 (земля), 10В.
    // R1: nodeA=1, nodeB=0, 10 Ом.
    // R2: nodeA=0, nodeB=2, 10 Ом.
    // Ожидание: Vout = 5В.
    const elements: MnaElement[] = [
      { type: 'voltageSource', nodeA: 1, nodeB: 2, voltage: 10 },
      { type: 'resistor', nodeA: 1, nodeB: 0, resistance: 10 },
      { type: 'resistor', nodeA: 0, nodeB: 2, resistance: 10 }
    ];
    const result = solveMna(2, elements);
    // voltages[0] = Vout, voltages[1] = Vcc, voltages[2] = земля (0)
    expect(result.voltages[0]).toBeCloseTo(5, 4);
    expect(result.voltages[1]).toBeCloseTo(10, 4);
    expect(result.voltages[2]).toBe(0);
  });
});
