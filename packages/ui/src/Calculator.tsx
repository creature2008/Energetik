import React, { useState, useRef } from 'react';

type ChainType = '1ph' | '3ph' | 'dc';

export function Calculator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [chain, setChain] = useState<ChainType>('1ph');
  const [u, setU] = useState(220);
  const [i, setI] = useState(1);
  const [p, setP] = useState(176);
  const [cosPhi, setCosPhi] = useState(0.8);

  const prevRef = useRef<{ field: 'U' | 'I' | 'P'; value: number } | null>(null);

  if (!open) return null;

  const factor = chain === '3ph' ? Math.sqrt(3) : 1;
  const cosEff = chain === 'dc' ? 1 : cosPhi;
  const isDC = chain === 'dc';

  // Главная функция пересчёта
  const recalc = (edited: 'U' | 'I' | 'P', value: number) => {
    const prev = prevRef.current;
    let newU = u, newI = i, newP = p;

    const calcP = (U: number, I: number) => factor * U * I * cosEff;
    const calcI = (U: number, P: number) => (factor * U * cosEff) === 0 ? 0 : P / (factor * U * cosEff);
    const calcU = (I: number, P: number) => (factor * I * cosEff) === 0 ? 0 : P / (factor * I * cosEff);

    if (edited === 'U') {
      newU = value;
      if (prev && prev.field === 'I') { newI = prev.value; newP = calcP(newU, newI); }
      else if (prev && prev.field === 'P') { newP = prev.value; newI = calcI(newU, newP); }
    } else if (edited === 'I') {
      newI = value;
      if (prev && prev.field === 'U') { newU = prev.value; newP = calcP(newU, newI); }
      else if (prev && prev.field === 'P') { newP = prev.value; newU = calcU(newI, newP); }
    } else if (edited === 'P') {
      newP = value;
      if (prev && prev.field === 'U') { newU = prev.value; newI = calcI(newU, newP); }
      else if (prev && prev.field === 'I') { newI = prev.value; newU = calcU(newI, newP); }
    }

    setU(newU); setI(newI); setP(newP);
    prevRef.current = { field: edited, value };
  };

  // При смене cos φ, factor (тип цепи) — пересчитываем P по U и I
  const handleCosChange = (v: number) => {
    setCosPhi(v);
    if (!isDC && prevRef.current) {
      const newP = factor * u * i * v;
      setP(newP);
    }
  };

  const handleChainChange = (ct: ChainType) => {
    setChain(ct);
    const newFactor = ct === '3ph' ? Math.sqrt(3) : 1;
    const newCos = ct === 'dc' ? 1 : cosPhi;
    setP(newFactor * u * i * newCos);
  };

  // Итоговые расчёты
  const S = factor * u * i;
  const P = S * cosEff;
  const Q = S * Math.sqrt(Math.max(0, 1 - cosEff * cosEff));
  const Z = i > 0 ? u / i : 0;
  const R = Z * cosEff;
  const X = Z * Math.sqrt(Math.max(0, 1 - cosEff * cosEff));

  const btnPreset = (value: number, active: boolean): React.CSSProperties => ({
    flex: 1, padding: '4px', background: active ? '#3498db' : '#333',
    color: active ? '#fff' : '#aaa', border: 'none', borderRadius: '3px',
    cursor: 'pointer', fontSize: '11px',
  });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#252526', border: '1px solid #444', borderRadius: '10px', padding: '20px', width: '460px', color: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <h3 style={{ fontSize: '16px' }}>🧮 Калькулятор</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        {/* Подсказка */}
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px', padding: '8px', background: '#1e1e1e', borderRadius: '4px' }}>
          💡 Введи <b>любые два</b> поля (U, I, P) — третье посчитается автоматически.
        </div>

        {/* Тип цепи */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '15px' }}>
          {(['1ph', '3ph', 'dc'] as ChainType[]).map((c) => (
            <button key={c} onClick={() => handleChainChange(c)} style={{ flex: 1, padding: '8px', background: chain === c ? '#3498db' : '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: chain === c ? 'bold' : 'normal' }}>
              {c === '1ph' ? '1-ф AC' : c === '3ph' ? '3-ф AC' : 'DC'}
            </button>
          ))}
        </div>

        {/* U, I, P */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>U (В)</label>
            <input type="number" step="any" value={u} onChange={(e) => recalc('U', Number(e.target.value))} style={{ width: '100%', padding: '8px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>I (А)</label>
            <input type="number" step="any" value={Number(i.toFixed(4))} onChange={(e) => recalc('I', Number(e.target.value))} style={{ width: '100%', padding: '8px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>P (Вт)</label>
            <input type="number" step="any" value={Number(p.toFixed(2))} onChange={(e) => recalc('P', Number(e.target.value))} style={{ width: '100%', padding: '8px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Быстрые кнопки для U */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '15px' }}>
          {(isDC ? [5, 12, 24, 48] : chain === '3ph' ? [380, 400, 415] : [127, 220, 230]).map((v) => (
            <button key={v} onClick={() => recalc('U', v)} style={btnPreset(v, Math.abs(u - v) < 0.01)}>{v}В</button>
          ))}
        </div>

        {/* cos φ */}
        {!isDC && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>cos φ = <b style={{ color: '#fff' }}>{cosPhi.toFixed(2)}</b></label>
            <input type="range" min={0.1} max={1} step={0.01} value={cosPhi} onChange={(e) => handleCosChange(Number(e.target.value))} style={{ width: '100%' }} />
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              {[0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((v) => (
                <button key={v} onClick={() => handleCosChange(v)} style={btnPreset(v, Math.abs(cosPhi - v) < 0.01)}>{v}</button>
              ))}
            </div>
          </div>
        )}

        {/* Результаты */}
        <div style={{ background: '#1e1e1e', padding: '12px', borderRadius: '6px', border: '1px solid #444' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>РЕЗУЛЬТАТ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
            <div><span style={{ color: '#888' }}>P:</span> <b style={{ color: '#2ecc71' }}>{P.toFixed(2)} Вт</b></div>
            <div><span style={{ color: '#888' }}>S:</span> <b style={{ color: '#3498db' }}>{S.toFixed(2)} ВА</b></div>
            {!isDC && <div><span style={{ color: '#888' }}>Q:</span> <b style={{ color: '#f39c12' }}>{Q.toFixed(2)} вар</b></div>}
            <div><span style={{ color: '#888' }}>cos φ:</span> <b style={{ color: '#9b59b6' }}>{cosEff.toFixed(2)}</b></div>
            <div><span style={{ color: '#888' }}>Z:</span> <b>{Z.toFixed(2)} Ом</b></div>
            <div><span style={{ color: '#888' }}>R:</span> <b>{R.toFixed(2)} Ом</b></div>
            {!isDC && <div><span style={{ color: '#888' }}>X:</span> <b>{X.toFixed(2)} Ом</b></div>}
          </div>
        </div>

        {/* Формулы */}
        <div style={{ marginTop: '12px', fontSize: '10px', color: '#666', fontFamily: 'monospace', lineHeight: '1.6' }}>
          {chain === '3ph' ? (
            <>P = √3·U·I·cos φ &nbsp;|&nbsp; S = √3·U·I &nbsp;|&nbsp; Z = U/I</>
          ) : isDC ? (
            <>P = U·I &nbsp;|&nbsp; R = U/I</>
          ) : (
            <>P = U·I·cos φ &nbsp;|&nbsp; S = U·I &nbsp;|&nbsp; Z = U/I &nbsp;|&nbsp; R = Z·cos φ</>
          )}
        </div>
      </div>
    </div>
  );
}
