import React, { useState, useEffect } from 'react';
import { Stage, Layer, Rect, Group, Circle, Line, Image as KonvaImage, Text, Arc } from 'react-konva';
import { runSimulation, measure, registry, lintProtection } from '@electro/core';
import { registerAllMods } from '@electro/mods';
import { useStore, buildProjectForSimulation, loadProjectData } from './store';
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
  const [compMenuPos, setCompMenuPos] = useState<{x: number, y: number, compId: string} | null>(null);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [rotation, setRotation] = useState(0);
  
  const [probeA, setProbeA] = useState<ProbePoint | null>(null);
  const [probeB, setProbeB] = useState<ProbePoint | null>(null);
  const [measureResult, setMeasureResult] = useState<{ x: number, y: number, text: string } | null>(null);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<string[]>(['power']);

  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  const { components, wires, addComponent, updatePosition, activePin, setActivePin, addWire, removeWire, updateComponentParam, removeComponent, insertWaypoint, updateWaypoint, removeWaypoint, setWireColor } = useStore();

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const handleAdd = (deviceId: string) => {
    addComponent(deviceId, snap(100 + Math.random() * 300), snap(100 + Math.random() * 200));
    addLog('[UI] Добавлено: ' + deviceId);
  };

  const toggleCategory = (id: string) => setOpenCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handlePinClick = (compId: string, pinId: string, x: number, y: number, e: any) => {
    e.cancelBubble = true;
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
        let text = 'OL';
        if (r.kind === 'ok') text = r.volts.toFixed(2) + (r.isAC ? ' В ~' + r.freq + 'Гц' : ' В DC');
        else if (r.kind === 'isolated') text = 'OL (разные цепи)';
        const pos = e.target.getStage()?.getPointerPosition();
        if (pos) setMeasureResult({ x: pos.x, y: pos.y - 40, text });
      } else {
        const pos = e.target.getStage()?.getPointerPosition();
        if (pos) setMeasureResult({ x: pos.x, y: pos.y - 40, text: 'Выберите 2-ю точку' });
      }
      return;
    }
    if (!activePin) setActivePin({ compId, pinId });
    else {
      if (activePin.compId !== compId || activePin.pinId !== pinId) addWire(activePin, { compId, pinId });
      setActivePin(null);
    }
  };

  const handleWireClick = (wire: any, e: any) => {
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
    if (isAltPressed) {
      e.cancelBubble = true;
      const getPinCurrent = (compId: string, pinId: string) => {
        const comp = components.find(c => c.id === compId);
        if (!comp) return 0;
        const pin = comp.pins[pinId];
        if (!pin) return 0;
        // Если пин N — это нейтраль, показываем ток нейтрали (векторную сумму)
        if (pin.label === 'N' || pin.side === 'right') {
          return simResult?.componentNeutralCurrent?.get(compId) || 0;
        }
        return simResult?.componentCurrents?.get(compId) || 0;
      };
      const curA = getPinCurrent(wire.from.compId, wire.from.pinId);
      const curB = getPinCurrent(wire.to.compId, wire.to.pinId);
      const current = Math.max(curA, curB);
      const pos = e.target.getStage()?.getPointerPosition();
      if (pos) setMeasureResult({ x: pos.x, y: pos.y - 40, text: current.toFixed(3) + ' А' });
      return;
    }
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
    if (!mod) return null;
    const sidePins = Object.values(comp.pins).filter((p: any) => p.side === pin.side);
    const idx = sidePins.findIndex((p: any) => p.id === pinId);
    const count = sidePins.length;
    const frac = (idx + 1) / (count + 1);
    if (pin.side === 'left') return { x: comp.x, y: comp.y + 20 + idx * 15 };
    if (pin.side === 'right') return { x: comp.x + mod.size.w, y: comp.y + 20 + idx * 15 };
    if (pin.side === 'top') return { x: comp.x + mod.size.w * frac, y: comp.y };
    if (pin.side === 'bottom') return { x: comp.x + mod.size.w * frac, y: comp.y + mod.size.h };
    return null;
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
      const res = runSimulation(project as any);
      setSimResult(res);

      if (res.updatedParams.size > 0) {
        res.updatedParams.forEach((params: any, compId: any) => {
          Object.entries(params).forEach(([k, v]) => {
            const comp = components.find(c => c.id === compId);
            if (comp && comp.params[k] !== v) {
              updateComponentParam(compId, k, v);
            }
          });
        });
      }
      
      const lintEvents = lintProtection(project as any);
      if (lintEvents.length > 0) {
        setLogs(prev => {
          const filtered = prev.filter(l => !l.startsWith('[ПУЭ]'));
          return [...filtered, ...lintEvents.map((e: any) => '[ПУЭ] ' + e.message)];
        });
      } else {
        setLogs(prev => prev.filter(l => !l.startsWith('[ПУЭ]')));
      }
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
      loadProjectData({ components: parsed.components || [], wires: parsed.wires || [] });
      addLog('[Система] Загружено');
    } catch (e: any) { addLog('[Ошибка] ' + e.message); }
  };

  useEffect(() => { if (!isPaused) handleRunSimulation(); }, [components, wires, isPaused]);
  useEffect(() => {
    const anim = setInterval(() => setRotation(r => r + 5), 50);
    return () => clearInterval(anim);
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(true);
      if (e.key === 'Control') setIsCtrlPressed(true);
      if (e.key === 'Delete' && selectedCompId) {
        removeComponent(selectedCompId);
        setSelectedCompId(null);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') { setIsAltPressed(false); setMeasureResult(null); }
      if (e.key === 'Control') { setIsCtrlPressed(false); setMeasureResult(null); setProbeA(null); setProbeB(null); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [measureResult, selectedCompId, removeComponent]);

  const renderGrid = (width: number, height: number) => {
    const lines = [];
    const startX = Math.floor((-stagePos.x / stageScale) / GRID_SIZE) * GRID_SIZE;
    const endX = Math.ceil(((width - stagePos.x) / stageScale) / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor((-stagePos.y / stageScale) / GRID_SIZE) * GRID_SIZE;
    const endY = Math.ceil(((height - stagePos.y) / stageScale) / GRID_SIZE) * GRID_SIZE;
    for (let i = startX; i < endX; i += GRID_SIZE) lines.push(<Line key={'v'+i} points={[i, startY, i, endY]} stroke="#333" strokeWidth={1 / stageScale} />);
    for (let i = startY; i < endY; i += GRID_SIZE) lines.push(<Line key={'h'+i} points={[startX, i, endX, i]} stroke="#333" strokeWidth={1 / stageScale} />);
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
      <div key={cfg.key} style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', display: 'block', marginBottom: '3px' }}>{cfg.label}:</label>
        {cfg.type === 'number' && (
          <input type="number" value={comp.params[cfg.key]} onChange={(e) => updateComponentParam(comp.id, cfg.key, Number(e.target.value))} style={{ width: '100%', padding: '4px', background: '#333', color: '#fff', border: '1px solid #555' }} />
        )}
        {cfg.type === 'boolean' && (
          <button onClick={() => updateComponentParam(comp.id, cfg.key, !comp.params[cfg.key])} style={{ width: '100%', padding: '5px', background: comp.params[cfg.key] ? '#2ecc71' : '#555', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px' }}>
            {comp.params[cfg.key] ? 'ВКЛ' : 'ВЫКЛ'}
          </button>
        )}
        {cfg.type === 'select' && (
          <select value={comp.params[cfg.key]} onChange={(e) => {
            const val = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
            updateComponentParam(comp.id, cfg.key, val);
          }} style={{ width: '100%', padding: '4px', background: '#333', color: '#fff', border: '1px solid #555' }}>
            {cfg.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        )}
        {cfg.type === 'loads' && (() => {
          const loads = (comp.params[cfg.key] as any[]) || [];
          const totalPower = loads.reduce((s, l) => s + (Number(l.power) || 0), 0);
          
          const addLoad = (presetValue: string) => {
            if (!presetValue) return;
            const preset = cfg.options?.find(o => String(o.value) === presetValue);
            if (!preset) return;
            const newLoads = [...loads, { id: Date.now(), name: preset.label, power: preset.power || 0 }];
            updateComponentParam(comp.id, cfg.key, newLoads);
          };
          
          const removeLoad = (idx: number) => {
            const newLoads = loads.filter((_, i) => i !== idx);
            updateComponentParam(comp.id, cfg.key, newLoads);
          };
          
          return (
            <div>
              <select
                value=""
                onChange={(e) => { addLoad(e.target.value); e.target.value = ''; }}
                style={{ width: '100%', padding: '4px', background: '#333', color: '#fff', border: '1px solid #555', marginBottom: '6px', fontSize: '12px' }}
              >
                <option value="">+ Добавить прибор...</option>
                {cfg.options?.map(opt => (
                  <option key={opt.value} value={String(opt.value)}>{opt.label} ({opt.power}Вт)</option>
                ))}
              </select>
              {loads.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', marginBottom: '6px' }}>Пусто</div>
              ) : (
                <div style={{ marginBottom: '6px' }}>
                  {loads.map((load, idx) => (
                    <div key={load.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2a2a2a', padding: '4px 6px', borderRadius: '3px', marginBottom: '3px', fontSize: '11px' }}>
                      <span>{load.name}: <b>{load.power}Вт</b></span>
                      <button onClick={() => removeLoad(idx)} style={{ background: '#c0392b', color: '#fff', border: 'none', cursor: 'pointer', padding: '1px 6px', borderRadius: '2px', fontSize: '11px' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: '12px', color: totalPower > 3520 ? '#e74c3c' : '#f1c40f', fontWeight: 'bold' }}>
                Сумма: {totalPower} Вт ({totalPower > 0 ? (totalPower / 220).toFixed(1) : 0} А)
              </div>
            </div>
          );
        })()}
      </div>
    ));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <div className="topbar">
        <div className="topbar-title">⚡ Electro Studio</div>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={handleSaveProject} title="Сохранить">💾</button>
          <button className="icon-btn" onClick={handleLoadProject} title="Загрузить">📂</button>
          <button className="icon-btn" onClick={() => setIsPaused(!isPaused)} title={isPaused ? 'Продолжить' : 'Пауза'}>
            {isPaused ? '▶' : '⏸'}
          </button>
        </div>
      </div>

      <div className="app">
        <div className="sidebar">
          <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '6px', marginBottom: '10px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '12px' }} />
          {categories.map(cat => (
            <div key={cat.id} className="category">
              <div className="category-header" onClick={() => toggleCategory(cat.id)}>
                <span>{cat.name}</span><span>{openCategories.includes(cat.id) ? '▼' : '▶'}</span>
              </div>
              {openCategories.includes(cat.id) && (
                <div className="category-items">
                  {cat.devices.map(dev => (
                    <button key={dev.id} className="device-btn" onClick={() => handleAdd(dev.id)}>{dev.name}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="canvas-area" onClick={() => { setWireMenuPos(null); setSelectedCompId(null); setCompMenuPos(null); }}>
          <Stage 
            width={window.innerWidth - 220} 
            height={window.innerHeight - 40 - 140} 
            draggable 
            onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
            onWheel={(e) => {
              e.evt.preventDefault(); const stage = e.target.getStage(); if (!stage) return;
              const oldScale = stage.scaleX(); const pointer = stage.getPointerPosition(); if (!pointer) return;
              const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
              const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
              stage.scale({ x: newScale, y: newScale }); 
              stage.position({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
              setStageScale(newScale);
              setStagePos(stage.position());
            }}
          >
            <Layer>
              {renderGrid(window.innerWidth - 220, window.innerHeight - 40 - 140)}
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
                const topPins = Object.values(comp.pins).filter((p: any) => p.side === 'top');
                const bottomPins = Object.values(comp.pins).filter((p: any) => p.side === 'bottom');
                
                const isBreaker = comp.deviceId.startsWith('breaker');
                const poles = topPins.length > 0 ? topPins.length : 1;
                const breakerCurrent = simResult?.componentCurrents?.get(comp.id) || 0;
                const rated = Number(comp.params.ratedCurrent) || 16;
                const isTripped = comp.params.tripped === true;
                const isOverloaded = isBreaker && !isTripped && breakerCurrent > rated * 0.9;

                return (
                  <Group key={comp.id} x={comp.x} y={comp.y} draggable
                    onClick={(e) => { e.cancelBubble = true; setSelectedCompId(comp.id); setWireMenuPos(null); setCompMenuPos(null); }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      setCompMenuPos({ x: comp.x + mod.size.w + 5, y: comp.y, compId: comp.id });
                      setSelectedCompId(comp.id);
                      setWireMenuPos(null);
                    }}
                    onDragMove={(e) => { e.target.x(snap(e.target.x())); e.target.y(snap(e.target.y())); }}
                    onDragEnd={(e) => { e.cancelBubble = true; updatePosition(comp.id, e.target.x(), e.target.y()); }}>
                    
                    {glow > 0 ? <Circle x={mod.size.w/2} y={mod.size.h/2} radius={50} fill="yellow" opacity={glow * 0.8} /> : null}

                    {isBreaker ? (
                      <>
                        <Rect width={mod.size.w} height={mod.size.h} fill="#e8e8e8" stroke="#555" strokeWidth={2} cornerRadius={3} />
                        {Array.from({ length: poles }).map((_, i) => {
                          const segW = mod.size.w / poles;
                          const toggleW = segW - 10;
                          const toggleH = 36;
                          const handleH = 16;
                          const toggleY = mod.size.h / 2 - toggleH / 2;
                          const handleY = isTripped ? toggleY + toggleH - handleH - 2 : toggleY + 2;
                          const onClick = (e: any) => {
                            e.cancelBubble = true;
                            updateComponentParam(comp.id, 'tripped', !comp.params.tripped);
                          };
                          return (
                            <Group key={i}>
                              <Rect
                                x={segW * i + 5}
                                y={toggleY}
                                width={toggleW}
                                height={toggleH}
                                fill="#1a1a1a"
                                stroke="#000"
                                strokeWidth={1}
                                cornerRadius={2}
                                onClick={onClick}
                              />
                              <Rect
                                x={segW * i + 7}
                                y={handleY}
                                width={toggleW - 4}
                                height={handleH}
                                fill={isTripped ? '#7a7a7a' : '#e8e8e8'}
                                stroke="#333"
                                strokeWidth={1}
                                cornerRadius={1}
                                onClick={onClick}
                              />
                            </Group>
                          );
                        })}
                        <Rect
                          x={mod.size.w - 14}
                          y={mod.size.h - 22}
                          width={9}
                          height={14}
                          fill={isTripped ? '#e74c3c' : isOverloaded ? '#f39c12' : '#2ecc71'}
                          stroke="#000"
                          strokeWidth={1}
                          cornerRadius={1}
                        />
                        <Text
                          text={(comp.params.curve || 'C') + (comp.params.ratedCurrent || 16)}
                          x={5}
                          y={mod.size.h - 20}
                          width={mod.size.w - 25}
                          align="left"
                          fill="#000"
                          fontSize={13}
                          fontStyle="bold"
                        />
                      </>
                    ) : imgSrc ? (
                      <DeviceImage src={imgSrc} x={0} y={0} width={mod.size.w} height={mod.size.h} />
                    ) : (
                      <Rect width={mod.size.w} height={mod.size.h} fill={visual?.tint || '#2a6'} cornerRadius={4} />
                    )}

                    {spinning === true ? <Arc x={mod.size.w/2} y={mod.size.h/2} innerRadius={10} outerRadius={25} angle={90} rotation={rotation} fill="#f1c40f" opacity={0.8} /> : null}
                    
                    {/* Индикатор предупреждения (восклицательный знак) */}
                    {visual?.warning ? (
                      <Group x={mod.size.w - 8} y={8}>
                        <Circle radius={9} fill="#e74c3c" stroke="#fff" strokeWidth={1.5} />
                        <Text text="!" x={-2.5} y={-6} fill="#fff" fontSize={14} fontStyle="bold" />
                      </Group>
                    ) : null}

                    {/* Клеммы left/right для обычных компонентов */}
                    {leftPins.map((pin: any, idx: number) => (
                      <Circle key={pin.id} x={0} y={20 + idx * 15} radius={7} fill={activePin?.compId === comp.id && activePin?.pinId === pin.id ? '#f1c40f' : pin.color} stroke="#000" 
                        onClick={(e) => { const pos = getPinPos(comp.id, pin.id); if (pos) handlePinClick(comp.id, pin.id, pos.x, pos.y, e); }} />
                    ))}
                    {rightPins.map((pin: any, idx: number) => (
                      <Circle key={pin.id} x={mod.size.w} y={20 + idx * 15} radius={7} fill={activePin?.compId === comp.id && activePin?.pinId === pin.id ? '#f1c40f' : pin.color} stroke="#000" 
                        onClick={(e) => { const pos = getPinPos(comp.id, pin.id); if (pos) handlePinClick(comp.id, pin.id, pos.x, pos.y, e); }} />
                    ))}

                    {/* Клеммы top/bottom для автоматов */}
                    {topPins.map((pin: any, idx: number) => (
                      <Circle key={pin.id} x={mod.size.w * (idx + 1) / (topPins.length + 1)} y={0} radius={7} fill={activePin?.compId === comp.id && activePin?.pinId === pin.id ? '#f1c40f' : pin.color} stroke="#000" 
                        onClick={(e) => { const pos = getPinPos(comp.id, pin.id); if (pos) handlePinClick(comp.id, pin.id, pos.x, pos.y, e); }} />
                    ))}
                    {bottomPins.map((pin: any, idx: number) => (
                      <Circle key={pin.id} x={mod.size.w * (idx + 1) / (bottomPins.length + 1)} y={mod.size.h} radius={7} fill={activePin?.compId === comp.id && activePin?.pinId === pin.id ? '#f1c40f' : pin.color} stroke="#000" 
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

          {compMenuPos ? (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', left: compMenuPos.x, top: compMenuPos.y, background: '#333', border: '1px solid #555', borderRadius: '6px', padding: '8px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <button onClick={() => { removeComponent(compMenuPos.compId); setCompMenuPos(null); setSelectedCompId(null); }} style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', borderRadius: '3px' }}>🗑 Удалить</button>
              <button onClick={() => setCompMenuPos(null)} style={{ background: '#555', color: '#fff', border: 'none', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', borderRadius: '3px' }}>Отмена</button>
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
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: '20px', top: '20px', background: '#252526', border: '1px solid #444', padding: '12px', borderRadius: '8px', color: '#fff', zIndex: 100, minWidth: '200px' }}>
                <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>{mod?.name || comp.deviceId}</h4>
                {renderInspectorFields(comp)}
                {comp.deviceId === 'led_strip' ? (
                  <div style={{ marginBottom: '8px', fontSize: '12px', color: '#f1c40f', fontWeight: 'bold' }}>
                    Итого: {(comp.params.powerPerMeter * comp.params.length).toFixed(1)} Вт
                  </div>
                ) : null}
                <button onClick={() => setSelectedCompId(null)} style={{ background: '#555', color: '#fff', border: 'none', padding: '4px 8px', cursor: 'pointer', width: '100%', fontSize: '12px', marginTop: '5px' }}>Закрыть</button>
              </div>
            );
          })() : null}
        </div>
      </div>
      
      <div className="logs">
        <h4 style={{ marginBottom: '5px', fontSize: '12px' }}>События:</h4>
        {logs.map((log, i) => <div key={i} className="log-entry" style={{ color: log.startsWith('[ПУЭ]') ? '#f39c12' : undefined }}>{log}</div>)}
      </div>
    </div>
  );
}

export default App;
