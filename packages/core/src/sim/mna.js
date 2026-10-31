/**
 * Modified Nodal Analysis (MNA)
 * Решает систему G * V = I для линейных элементов.
 *
 * Узлы (nets) получают индексы 0..n-1, земля (GND) = узел последний (или любой выбранный).
 * Каждый элемент добавляет вклад в матрицу проводимостей G и вектор токов I.
 */
/**
 * Решает MNA.
 * @param nodeCount Количество узлов (не считая земли). Земля — индекс nodeCount.
 * @param elements Элементы схемы
 */
export function solveMna(nodeCount, elements) {
    // Размер системы: nodeCount узлов + количество источников напряжения (каждый даёт дополнительный ток-неизвестное)
    const voltageSources = elements.filter(e => e.type === 'voltageSource');
    const n = nodeCount + voltageSources.length;
    // Матрица A (n x n) и вектор b (n)
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    const b = new Array(n).fill(0);
    // Счётчик для источников напряжения — их токи становятся неизвестными (n + k)
    let vsIndex = 0;
    // Карта: элемент -> номер строки для источника напряжения
    const vsRowMap = new Map();
    elements.forEach((el, idx) => {
        if (el.type === 'resistor') {
            const g = 1 / (el.resistance || 1e-9);
            // Стандартный шаблон для резистора
            if (el.nodeA < nodeCount)
                A[el.nodeA][el.nodeA] += g;
            if (el.nodeB < nodeCount)
                A[el.nodeB][el.nodeB] += g;
            if (el.nodeA < nodeCount && el.nodeB < nodeCount) {
                A[el.nodeA][el.nodeB] -= g;
                A[el.nodeB][el.nodeA] -= g;
            }
        }
        else if (el.type === 'voltageSource') {
            const row = nodeCount + vsIndex;
            vsRowMap.set(idx, row);
            vsIndex++;
            // Уравнение: V_A - V_B = voltage
            if (el.nodeA < nodeCount) {
                A[row][el.nodeA] += 1;
                A[el.nodeA][row] += 1;
            }
            if (el.nodeB < nodeCount) {
                A[row][el.nodeB] -= 1;
                A[el.nodeB][row] -= 1;
            }
            b[row] = el.voltage;
        }
    });
    // Решаем систему методом Гаусса
    const x = gaussianSolve(A, b);
    // Напряжения узлов — первые nodeCount значений, земля = 0
    const voltages = x.slice(0, nodeCount);
    voltages.push(0); // земля
    // Токи через элементы
    const currents = elements.map((el, idx) => {
        if (el.type === 'resistor') {
            const va = voltages[el.nodeA] ?? 0;
            const vb = voltages[el.nodeB] ?? 0;
            return (va - vb) / (el.resistance || 1e-9);
        }
        else {
            // Для источника напряжения ток — это неизвестное из системы
            const row = vsRowMap.get(idx);
            return row !== undefined ? x[row] : 0;
        }
    });
    return { voltages, currents };
}
/**
 * Решение СЛАУ методом Гаусса с частичным выбором ведущего элемента.
 * Возвращает вектор x.
 */
function gaussianSolve(A, b) {
    const n = A.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        // Поиск ведущего элемента
        let pivot = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(M[row][col]) > Math.abs(M[pivot][col]))
                pivot = row;
        }
        if (Math.abs(M[pivot][col]) < 1e-12) {
            // Сингулярная матрица — пропускаем (цепь не замкнута)
            continue;
        }
        // Меняем строки
        [M[col], M[pivot]] = [M[pivot], M[col]];
        // Нормируем
        const div = M[col][col];
        for (let j = col; j <= n; j++)
            M[col][j] /= div;
        // Вычитаем из остальных строк
        for (let row = 0; row < n; row++) {
            if (row === col)
                continue;
            const factor = M[row][col];
            if (factor === 0)
                continue;
            for (let j = col; j <= n; j++) {
                M[row][j] -= factor * M[col][j];
            }
        }
    }
    const x = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        x[i] = M[i][n] || 0;
    }
    return x;
}
