import { describe, it, expect } from 'vitest';
import { runSimulation } from '../src/sim/simulator';
function emptyProject() {
    return {
        schemaVersion: 1,
        meta: { id: 'p', name: 't', createdAt: '', updatedAt: '', appVersion: '0.1.0' },
        components: [{ id: '__supply__', deviceId: 'supply', params: {}, pins: {
                    L: { id: 'L', voltage: null, current: null }, N: { id: 'N', voltage: null, current: null }
                } }],
        wires: [], nets: [], layout: { schematic: {}, realistic: {} },
        settings: { supply: { type: '220' }, units: 'metric' }
    };
}
describe('Короткое замыкание', () => {
    it('прямое соединение L-N даёт КЗ и выбивает автомат', () => {
        const p = emptyProject();
        p.components.push({ id: 'br1', deviceId: 'breaker', params: { ratedCurrent: 16, tripped: false }, pins: {
                '1': { id: '1', voltage: null, current: null }, '2': { id: '2', voltage: null, current: null }
            } });
        p.wires.push({ id: 'w1', number: 1, from: { compId: '__supply__', pinId: 'L' }, to: { compId: 'br1', pinId: '1' }, color: 'brown', crossSection: 2.5, waypoints: [], routing: 'auto45' });
        p.wires.push({ id: 'w2', number: 2, from: { compId: 'br1', pinId: '2' }, to: { compId: '__supply__', pinId: 'N' }, color: 'blue', crossSection: 2.5, waypoints: [], routing: 'auto45' });
        const r = runSimulation(p);
        const shortCircuit = r.events.find(e => e.type === 'short-circuit');
        expect(shortCircuit).toBeDefined();
        expect(shortCircuit?.message).toContain('КЗ');
    });
});
