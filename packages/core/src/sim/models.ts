import { Component } from '../types';
import { MnaElement } from './mna';

/**
 * Собирает MNA-элементы из проекта.
 * Пока поддерживает только: провод (как резистор с малым R), лампа (резистор по мощности).
 * 
 * Каждый net получает индекс. Земля (GND) — отдельный узел, к нему будем подключать
 * "источник питания" в тестах. В реальном проекте источник будет устройством.
 */
export type MnaBuildContext = {
  /** netId -> index (0..n-1) */
  netIndex: Map<string, number>;
  /** Вектор элементов */
  elements: MnaElement[];
};

/**
 * Строит MNA-модель для линейных элементов.
 * @param nets — список узлов из buildNetlist
 * @param components — компоненты проекта
 * @param wires — провода (нужны для R провода)
 * @param netIndex — карта netId -> индекс
 */
export function buildLinearElements(
  components: Component[],
  netIndex: Map<string, number>,
  getNetOfPin: (compId: string, pinId: string) => string | null
): MnaElement[] {
  const elements: MnaElement[] = [];

  for (const comp of components) {
    if (comp.deviceId === 'lamp') {
      const power = Number(comp.params.power) || 60;
      const voltage = Number(comp.params.voltage) || 220;
      const R = (voltage * voltage) / power;

      const netA = getNetOfPin(comp.id, 'L');
      const netB = getNetOfPin(comp.id, 'N');
      if (netA == null || netB == null) continue;

      elements.push({
        type: 'resistor',
        nodeA: netIndex.get(netA)!,
        nodeB: netIndex.get(netB)!,
        resistance: R
      });
    }
  }

  return elements;
}
