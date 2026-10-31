/**
 * Строит MNA-модель для линейных элементов.
 * @param nets — список узлов из buildNetlist
 * @param components — компоненты проекта
 * @param wires — провода (нужны для R провода)
 * @param netIndex — карта netId -> индекс
 */
export function buildLinearElements(components, netIndex, getNetOfPin) {
    const elements = [];
    for (const comp of components) {
        if (comp.deviceId === 'lamp') {
            const power = Number(comp.params.power) || 60;
            const voltage = Number(comp.params.voltage) || 220;
            const R = (voltage * voltage) / power;
            const netA = getNetOfPin(comp.id, 'L');
            const netB = getNetOfPin(comp.id, 'N');
            if (netA == null || netB == null)
                continue;
            elements.push({
                type: 'resistor',
                nodeA: netIndex.get(netA),
                nodeB: netIndex.get(netB),
                resistance: R
            });
        }
    }
    return elements;
}
