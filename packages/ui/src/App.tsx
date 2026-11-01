import React, { useState, useEffect } from 'react';
import { Stage, Layer, Rect, Group, Circle, Line, Image as KonvaImage, Text, Arc } from 'react-konva';
import { runSimulation, measure, registry } from '@electro/core';
import { registerAllMods } from '@electro/mods';
import { useStore, buildProjectForSimulation } from './store';
import useImage from 'use-image';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

registerAllMods();

const GRID_SIZE = 10;
const CATEGORY_NAMES: Record<string, string> = {
  power: '⚡ Питание', protection: '🛑 Защита', light: '💡 Свет', sockets: '🔌 Розетки',
  switches: '🔘 Выключатели', psu: '🔋 Блоки питания', motors: '⚙️ Моторы', boxes: '📦 Коробки',
};

const DeviceImage = ({ src, x, y, width, height }: any) => {
  const [img] = useImage(src);
  return <KonvaImage image={img} x={x} y={y} width={width} height={height} />;
};
const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;
type ProbePoint = { compId: string, pinId: string, x: number, y: number };

function App() {
  const [logs, setLogs] = useState<string[]>(['[Система] Приложение запущено.']);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [wireMenuPos, setWireMenuPos] = useState<{x: number, y: number} | null>(null);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [rotation, setRotation] = useState(0);
  
  const [probeA, setProbeA] = useState<ProbePoint | null>(null);
  const [probeB, setProbeB] = useState<ProbePoint | null>(null);
  const [measureResult, setMeasureResult] = useState<{ x: number, y: number, text: string, type: 'volt' | 'amp' } | null>(null);
  
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<string[]>(['power']);

  const { components, wires, addComponent, updatePosition, activePin, setActivePin, addWire, removeWire, updateComponentParam, insertWaypoint, updateWaypoint, removeWaypoint, setWireColor } = useStore();

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const handleAdd = (deviceId: string) => {
    addComponent(deviceId, snap(100 + Math.random() * 300), snap(100 + Math.random() * 200));
    addLog('[UI] Добавлено: ' + deviceId);
  };

  const toggleCategory = (id: string) => setOpenCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handlePinClick = (compId: string, pinId: string, x: number, y: number, e: any) => {
    e.cancelBubble = true;
    
    // ВОЛЬТМЕТР (Ctrl)
    if (isCtrlPressed) {
      let newA = probeA;
      let newB = probeB;
      
      if (!newA) newA = { compId, pinId, x, y };
      else if (!newB) newB = { compId, pinId, x, y };
      else { newA = { compId, pinId, x, y }; newB = null; }
      
      setProbeA(newA);
      setProbeB(newB);

      if (newA && newB) {
        const r = measure(simResult, newA, newB);
        let text = 'OL (не подключено)';
        if (r.kind === 'ok') text = r.volts.toFixed(2) + ' В';
        else if (r.kind === 'isolated') text = 'OL (разные цепи)';
        { const pos = e.target.getStage()?.getPointerPosition(); if (pos) setMeasureResult({ x: pos.x, y: pos.y - 40, text, type: 'volt' }); }
      } else {
        { const pos = e.target.getStage()?.getPointerPosition(); if (pos) setMeasureResult({ x: pos.x, y: pos.y - 40, text: 'Выберите 2-ю точку...', type: 'volt' }); }
      }
      return;
    }

    // Обычная работа с клеммами
    if (!activePin) setActivePin({ compId, pinId });
    else {
      if (activePin.compId !== compId || activePin.pinId !== pinId) addWire(activePin, { compId, pinId });
      setActivePin(null);
    }
  };

  const handleWireClick = (wire: any, e: any) => {
    // Излом провода (Shift)
    if (e.evt.shiftKey) {
      e.cancelBubble = true;
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (pointer) {
        const pts = getWirePointsArray(wire);
        let insertIndex = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i]; const p2 = pts[i + 1];
          if (pointer.x >= Math.min(p1.x, p2.x) - 10 && pointer.x <= Math.max(p1.x, p2.x) + 10 && pointer.y >= Math.min(p1.y, p2.y) - 10 && pointer.y <= Math.max(p1.y, p2.y) + 10) { insertIndex = i; break; }
        }
        insertWaypoint(wire.id, snap(pointer.x), snap(pointer.y), insertIndex);
      }
      return;
    }

    // АМПЕРМЕТР (Alt)
    if (isAltPressed) {
      e.cancelBubble = true;
      const curA = simResult?.componentCurrents?.get(wire.from.compId) || 0;
      const curB = simResult?.componentCurrents?.get(wire.to.compId) || 0;
      const current = Math.max(curA, curB);
      { const pos = e.target.getStage()?.getPointerPosition(); if (pos) setMeasureResult({ x: pos.x, y: pos.y - 40, text: current.toFixed(3) + ' А', type: 'amp' }); }
      return;
    }

    // Обычная работа с проводами
    e.cancelBubble = true; 
    setSelectedWireId(wire.id); 
    setWireMenuPos({ x: e.evt.clientX - 250, y: e.evt.clientY - 50 }); 
    setSelectedCompId(null);
  };

  const getPinPos = (compId: string, pinId: string) => {
    const comp = components.find(c => c.id === compId);
    if (!comp) return null;
    const pin = comp.pins[pinId];
    if (!pin) return null;
    const mod = registry.get(comp.deviceId);
    const sidePins = Object.values(comp.pins).filter((p: any) => p.side === pin.side);
    const idx = sidePins.findIndex((p: any) => p.id === pinId);
    return { x: comp.x + (pin.side === 'left' ? 0 : (mod?.size.w || 80)), y: comp.y + 20 + idx * 15 };
  };

  const getImagePath = (deviceId: string) => {
    const mod = registry.get(deviceId);
    if (mod?.icon) return new URL('./assets/' + mod.icon, import.meta.url).href;
    return null;
  };

  const getWirePointsArray = (wire: any) => {
    const start = getPinPos(wire.from.compId, wire.from.pinId);
    const end = getPinPos(wire.to.compId, wire.to.pinId);
    if (!start || !end) return [];
    let pts: any[] = [{x: start.x, y: start.y}];
    (wire.waypoints || []).forEach((wp: any) => pts.push(wp));
    pts.push({x: end.x, y: end.y});
    return pts;
  };

  const handleRunSimulation = () => {
    try {
      const project = buildProjectForSimulation();
      setSimResult(runSimulation(project as any));
    } catch (err: any) {
      addLog('[ОШИБКА СИМУЛЯЦИИ] ' + (err.message || String(err)));
    }
  };

  const handleSaveProject = async () => {
    try {
      const path = await save({ filters: [{ name: 'Electro Project', extensions: ['esproj'] }] });
      if (!path) return;
      await writeTextFile(path, JSON.stringify({ components, wires }, null, 2));
      addLog('[Система] Сохранено: ' + path);
    } catch (e: any) { addLog('[Ошибка] ' + e.message); }
  };

  const handleLoadProject = async () => {
    try {
      const path = await open({ filters: [{ name: 'Electro Project', extensions: ['esproj'] }], multiple: false });
      if (!path) return;
      const parsed = JSON.parse(await readTextFile(path as string));
      useStore.setState({ components: parsed.components || [], wires: parsed.wires || [] });
      addLog('[Система] Загружено');
    } catch (e: any) { addLog('[Ошибка] ' + e.message); }
  };

  useEffect(() => { if (!isPaused) handleRunSimulation(); }, [components, wires, isPaused]);
  
  useEffect(() => {
    const anim = setInterval(() => setRotation(r => r + 5), 50);
    return () => clearInterval(anim);
  }, []);

  // Слушаем клавиши для инструментов
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(true);
      if (e.key === 'Control') setIsCtrlPressed(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(false);
        if (measureResult?.type === 'amp') setMeasureResult(null);
      }
      if (e.key === 'Control') {
        setIsCtrlPressed(false);
        if (measureResult?.type === 'volt') setMeasureResult(null);
        setProbeA(null);
        setProbeB(null);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [measureResult]);

  const renderGrid = (width: number, height: number) => {
    const lines = [];
    for (let i = 0; i < width; i += GRID_SIZE) lines.push(<Line key={'v'+i} points={[i, 0, i, height]} stroke="#333" strokeWidth={1} />);
    for (let i = 0; i < height; i += GRID_SIZE) lines.push(<Line key={'h'+i} points={[0, i, width, i]} stroke="#333" strokeWidth={1} />);
    return lines;
  };

  const allMods = registry.all();
  const categories = Object.entries(CATEGORY_NAMES).map(([id, name]) => ({
    id, name, devices: allMods.filter(d => d.category === id && d.name.toLowerCase().includes(searchQuery.toLowerCase()))
  })).filter(c => c.devices.length > 0);

  const renderInspectorFields = (comp: any) => {
    const mod = registry.get(comp.deviceId);
    if (!mod) return null;
    return mod.params.map(cfg => (
      <div key={cfg.key} style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '12px', display: 'block', marginBottom: '5px' }}>{cfg.label}:</label>
        {cfg.type === 'number' && (
          <input type="number" value={comp.params[cfg.key]} onChange={(e) => updateComponentParam(comp.id, cfg.key, Number(e.target.value))} style={{ width: '100%', padding: '5px', background: '#333', color: '#fff', border: '1px solid #555' }} />
        )}
        {cfg.type === 'boolean' && (
          <button onClick={() => updateComponentParam(comp.id, cfg.key, !comp.params[cfg.key])} style={{ width: '100%', padding: '6px', background: comp.params[cfg.key] ? '#2ecc71' : '#555', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {comp.params[cfg.key] ? 'ВКЛ' : 'ВЫКЛ'}
          </button>
        )}
        {cfg.type === 'select' && (
          <select value={comp.params[cfg.key]} onChange={(e) => updateComponentParam(comp.id, cfg.key, Number(e.target.value))} style={{ width: '100%', padding: '5px', background: '#333', color: '#fff', border: '1px solid #555' }}>
            {cfg.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        )}
      </div>
    ));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <div className="app">
        <div className="sidebar" style={{ padding: '10px', overflowY: 'auto' }}>
          <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '15px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px' }} />
          {categories.map(cat => (
            <div key={cat.id} style={{ marginBottom: '10px' }}>
              <div onClick={() => toggleCategory(cat.id)} style={{ cursor: 'pointer', fontWeight: 'bold', padding: '8px', background: '#2d2d2d', borderRadius: '4px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{cat.name}</span><span>{openCategories.includes(cat.id) ? '▼' : '▶'}</span>
              </div>
              {openCategories.includes(cat.id) && cat.devices.map(dev => (
                <button key={dev.id} className="device-btn" onClick={() => handleAdd(dev.id)} style={{ marginBottom: '3px', fontSize: '12px', padding: '6px' }}>{dev.name}</button>
              ))}
            </div>
          ))}
          <div style={{ marginTop: '20px', borderTop: '1px solid #444', paddingTop: '10px' }}>
            <button className="device-btn" onClick={() => setIsPaused(!isPaused)} style={{ background: isPaused ? '#cc7000' : '#0055aa', marginBottom: '10px', fontWeight: 'bold' }}>{isPaused ? '▶ Продолжить' : '⏸ Пауза'}</button>
            <button className="device-btn" onClick={handleSaveProject} style={{ background: '#2ecc71', marginBottom: '5px' }}>💾 Сохранить</button>
            <button className="device-btn" onClick={handleLoadProject} style={{ background: '#3498db' }}>📂 Загрузить</button>
          </div>
        </div>
        
        <div className="canvas-area" onClick={() => { setWireMenuPos(null); setSelectedCompId(null); }}>
          <Stage width={window.innerWidth - 250} height={window.innerHeight - 180} draggable onWheel={(e) => {
            e.evt.preventDefault(); const stage = e.target.getStage(); if (!stage) return;
            const oldScale = stage.scaleX(); const pointer = stage.getPointerPosition(); if (!pointer) return;
            const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
            const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
            stage.scale({ x: newScale, y: newScale }); stage.position({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
          }}>
            <Layer>
              {renderGrid(window.innerWidth - 250, window.innerHeight - 180)}
              {wires.map(wire => {
                const pts = getWirePointsArray(wire); if (pts.length < 2) return null;
                const flat = pts.flatMap(p => [p.x, p.y]);
                return (
                  <Group key={wire.id}>
                    <Line points={flat} stroke={wire.color || '#3498db'} strokeWidth={5} lineCap="round" lineJoin="round" hitStrokeWidth={20} 
                      onClick={(e) => handleWireClick(wire, e)} 
                    />
                    {(wire.waypoints || []).map((wp: any, i: number) => (
                      <Circle key={i} x={wp.x} y={wp.y} radius={5} fill="#f1c40f" stroke="#000" draggable
                        onDragMove={(e) => { e.target.x(snap(e.target.x())); e.target.y(snap(e.target.y())); }}
                        onDragEnd={(e) => updateWaypoint(wire.id, i, e.target.x(), e.target.y())}
                        onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; removeWaypoint(wire.id, i); }} />
                    ))}
                  </Group>
                );
              })}

              {components.map(comp => {
                const mod = registry.get(comp.deviceId);
                if (!mod) return null;
                const imgSrc = getImagePath(comp.deviceId);
                const visual = simResult?.visuals?.get(comp.id);
                const glow = Number(visual?.glow) || 0;
                const spinning = visual?.spinning === true;
                const leftPins = Object.values(comp.pins).filter((p: any) => p.side === 'left');
                const rightPins = Object.values(comp.pins).filter((p: any) => p.side === 'right');

                return (
                  <Group key={comp.id} x={comp.x} y={comp.y} draggable
                    onClick={(e) => { e.cancelBubble = true; setSelectedCompId(comp.id); setWireMenuPos(null); }}
                    onDragMove={(e) => { e.target.x(snap(e.target.x())); e.target.y(snap(e.target.y())); }}
                    onDragEnd={(e) => { e.cancelBubble = true; updatePosition(comp.id, e.target.x(), e.target.y()); }}>
                    
                    {glow > 0 ? <Circle x={mod.size.w/2} y={mod.size.h/2} radius={50} fill="yellow" opacity={glow * 0.8} /> : null}
                    {imgSrc ? <DeviceImage src={imgSrc} x={0} y={0} width={mod.size.w} height={mod.size.h} /> : (
                      <Rect width={mod.size.w} height={mod.size.h} fill={visual?.tint || '#2a6'} cornerRadius={4} />
                    )}
                    {spinning === true ? <Arc x={mod.size.w/2} y={mod.size.h/2} innerRadius={10} outerRadius={25} angle={90} rotation={rotation} fill="#f1c40f" opacity={0.8} /> : null}
                    {visual?.label && visual.label.length > 0 ? (
                      <Text text={visual.label} x={mod.size.w/2 - 20} y={mod.size.h/2 - 5} fill="#fff" fontSize={11} fontStyle="bold" />
                    ) : null}

                    {leftPins.map((pin: any, idx: number) => (
                      <Circle key={pin.id} x={0} y={20 + idx * 15} radius={7} fill={activePin?.compId === comp.id && activePin?.pinId === pin.id ? '#f1c40f' : pin.color} stroke="#000" 
                        onClick={(e) => { const pos = getPinPos(comp.id, pin.id); if (pos) handlePinClick(comp.id, pin.id, pos.x, pos.y, e); }} />
                    ))}
                    {rightPins.map((pin: any, idx: number) => (
                      <Circle key={pin.id} x={mod.size.w} y={20 + idx * 15} radius={7} fill={activePin?.compId === comp.id && activePin?.pinId === pin.id ? '#f1c40f' : pin.color} stroke="#000" 
                        onClick={(e) => { const pos = getPinPos(comp.id, pin.id); if (pos) handlePinClick(comp.id, pin.id, pos.x, pos.y, e); }} />
                    ))}
                  </Group>
                );
              })}

              {probeA !== null ? <Circle x={probeA.x} y={probeA.y} radius={10} stroke="#00ff00" strokeWidth={3} listening={false} /> : null}
              {probeB !== null ? <Circle x={probeB.x} y={probeB.y} radius={10} stroke="#00ff00" strokeWidth={3} listening={false} /> : null}
            </Layer>
          </Stage>

          {measureResult !== null ? (
            <div style={{ position: 'absolute', left: measureResult.x, top: measureResult.y, background: '#000', color: '#00ff00', padding: '5px 10px', borderRadius: '4px', border: '1px solid #00ff00', fontSize: '14px', fontWeight: 'bold', pointerEvents: 'none', zIndex: 1000 }}>
              {measureResult.text}
            </div>
          ) : null}

          {wireMenuPos && selectedWireId ? (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', left: wireMenuPos.x, top: wireMenuPos.y, background: '#333', border: '1px solid #555', borderRadius: '6px', padding: '10px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ color: '#fff', fontSize: '12px' }}>Провод</div>
              <div style={{ display: 'flex', gap: '5px' }}>{['#3498db', '#e74c3c', '#f1c40f', '#2ecc71'].map(c => <div key={c} onClick={() => { setWireColor(selectedWireId, c); setWireMenuPos(null); }} style={{ width: '20px', height: '20px', background: c, cursor: 'pointer', borderRadius: '3px' }} />)}</div>
              <button onClick={() => { removeWire(selectedWireId); setWireMenuPos(null); }} style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '4px 8px', cursor: 'pointer', fontSize: '10px' }}>Удалить</button>
            </div>
          ) : null}

          {selectedCompId !== null ? (() => {
            const comp = components.find(c => c.id === selectedCompId);
            if (!comp) return null;
            const mod = registry.get(comp.deviceId);
            return (
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: '20px', top: '20px', background: '#252526', border: '1px solid #444', padding: '15px', borderRadius: '8px', color: '#fff', zIndex: 100, minWidth: '220px' }}>
                <h4 style={{ marginBottom: '10px' }}>{mod?.name || comp.deviceId}</h4>
                {renderInspectorFields(comp)}
                <button onClick={() => setSelectedCompId(null)} style={{ background: '#555', color: '#fff', border: 'none', padding: '5px 10px', cursor: 'pointer', width: '100%' }}>Закрыть</button>
              </div>
            );
          })() : null}
        </div>
      </div>
      <div className="logs">
        <h4>События:</h4>
        {logs.map((log, i) => <div key={i} className="log-entry">{log}</div>)}
      </div>
    </div>
  );
}

export default App;
