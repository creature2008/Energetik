import React, { useState, useEffect } from 'react';
import { Stage, Layer, Rect, Group, Circle, Line, Image as KonvaImage } from 'react-konva';
import { runSimulation } from '@electro/core';
import { useStore, buildProjectForSimulation } from './store';
import useImage from 'use-image';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

const GRID_SIZE = 10;

const DeviceImage = ({ src, x, y, width, height }: any) => {
  const [img] = useImage(src);
  return <KonvaImage image={img} x={x} y={y} width={width} height={height} />;
};

const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

function App() {
  const [logs, setLogs] = useState<string[]>(['[Система] Приложение запущено.']);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [wireMenuPos, setWireMenuPos] = useState<{x: number, y: number} | null>(null);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);

  const { components, wires, addComponent, updatePosition, activePin, setActivePin, addWire, removeWire, updateComponentParam, insertWaypoint, updateWaypoint, removeWaypoint, setWireColor } = useStore();

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const handleAdd = (deviceId: string) => {
    addComponent(deviceId, snap(100 + Math.random() * 300), snap(100 + Math.random() * 200));
    addLog('[UI] Добавлено: ' + deviceId);
  };

  const handlePinClick = (compId: string, pinId: string, e: any) => {
    e.cancelBubble = true;
    if (!activePin) setActivePin({ compId, pinId });
    else {
      if (activePin.compId !== compId || activePin.pinId !== pinId) addWire(activePin, { compId, pinId });
      setActivePin(null);
    }
  };

  const getPinPos = (compId: string, pinId: string) => {
    const comp = components.find(c => c.id === compId);
    if (!comp) return null;
    return { x: comp.x + (pinId === 'L' ? 0 : 80), y: comp.y + 30 };
  };

  const getImagePath = (deviceId: string) => {
    if (deviceId === 'lamp') return new URL('./assets/lamp.svg', import.meta.url).href;
    if (deviceId === 'breaker') return new URL('./assets/breaker.svg', import.meta.url).href;
    if (deviceId === 'supply') return new URL('./assets/supply.svg', import.meta.url).href;
    if (deviceId === 'switch') return new URL('./assets/switch.svg', import.meta.url).href;
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
    const project = buildProjectForSimulation();
    const result = runSimulation(project as any);
    setSimResult(result);
  };

  const handleSaveProject = async () => {
    try {
      const path = await save({ filters: [{ name: 'Electro Project', extensions: ['esproj'] }] });
      if (!path) return;
      const data = JSON.stringify({ components, wires }, null, 2);
      await writeTextFile(path, data);
      addLog('[Система] Проект сохранен: ' + path);
    } catch (e) {
      addLog('[Ошибка] Не удалось сохранить: ' + e);
    }
  };

  const handleLoadProject = async () => {
    try {
      const path = await open({ filters: [{ name: 'Electro Project', extensions: ['esproj'] }], multiple: false });
      if (!path) return;
      const data = await readTextFile(path as string);
      const parsed = JSON.parse(data);
      useStore.setState({ components: parsed.components || [], wires: parsed.wires || [] });
      addLog('[Система] Проект загружен!');
    } catch (e) {
      addLog('[Ошибка] Не удалось загрузить: ' + e);
    }
  };

  useEffect(() => {
    if (!isPaused) handleRunSimulation();
  }, [components, wires, isPaused]);

  const renderGrid = (width: number, height: number, scaleX: number, x: number, y: number) => {
    const lines = [];
    const startX = -x / scaleX;
    const endX = (width - x) / scaleX;
    const startY = -y / scaleX;
    const endY = (height - y) / scaleX;

    for (let i = Math.floor(startX / GRID_SIZE) * GRID_SIZE; i < endX; i += GRID_SIZE) {
      lines.push(<Line key={'v'+i} points={[i, startY, i, endY]} stroke="#333" strokeWidth={1 / scaleX} />);
    }
    for (let i = Math.floor(startY / GRID_SIZE) * GRID_SIZE; i < endY; i += GRID_SIZE) {
      lines.push(<Line key={'h'+i} points={[startX, i, endX, i]} stroke="#333" strokeWidth={1 / scaleX} />);
    }
    return lines;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <div className="app">
        <div className="sidebar">
          <h3 style={{ marginBottom: '10px', fontSize: '16px' }}>Устройства</h3>
          <button className="device-btn" onClick={() => handleAdd('supply')} style={{ background: '#900' }}>⚡ Источник 220В</button>
          <button className="device-btn" onClick={() => handleAdd('lamp')}>💡 Лампа</button>
          <button className="device-btn" onClick={() => handleAdd('breaker')}>🛑 Автомат</button>
          <button className="device-btn" onClick={() => handleAdd('switch')}>🔘 Выключатель</button>
          
          <button className="device-btn" onClick={() => setIsPaused(!isPaused)} style={{ background: isPaused ? '#cc7000' : '#0055aa', marginTop: '20px', fontWeight: 'bold' }}>
            {isPaused ? '▶ Продолжить' : '⏸ Пауза'}
          </button>

          <div style={{ marginTop: '20px', borderTop: '1px solid #444', paddingTop: '10px' }}>
            <button className="device-btn" onClick={handleSaveProject} style={{ background: '#2ecc71', marginBottom: '5px' }}>💾 Сохранить</button>
            <button className="device-btn" onClick={handleLoadProject} style={{ background: '#3498db' }}>📂 Загрузить</button>
          </div>
        </div>
        
        <div className="canvas-area" onClick={() => { setWireMenuPos(null); setSelectedCompId(null); }}>
          <Stage 
            width={window.innerWidth - 250} 
            height={window.innerHeight - 180}
            draggable
            onWheel={(e) => {
              e.evt.preventDefault();
              const stage = e.target.getStage();
              if (!stage) return;
              const oldScale = stage.scaleX();
              const pointer = stage.getPointerPosition();
              if (!pointer) return;
              const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
              const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
              stage.scale({ x: newScale, y: newScale });
              stage.position({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
            }}
          >
            <Layer>
              {renderGrid(window.innerWidth - 250, window.innerHeight - 180, 1, 0, 0)}

              {wires.map(wire => {
                const pts = getWirePointsArray(wire);
                if (pts.length < 2) return null;
                const flat = pts.flatMap(p => [p.x, p.y]);
                return (
                  <Group key={wire.id}>
                    <Line points={flat} stroke={wire.color || '#3498db'} strokeWidth={5} lineCap="round" lineJoin="round" hitStrokeWidth={20}
                      onClick={(e) => {
                        // SHIFT + КЛИК ДОБАВЛЯЕТ ТОЧКУ
                        if (e.evt.shiftKey) {
                          e.cancelBubble = true;
                          const stage = e.target.getStage();
                          const pointer = stage?.getPointerPosition();
                          if (pointer) {
                            let insertIndex = 0;
                            for (let i = 0; i < pts.length - 1; i++) {
                              const p1 = pts[i]; const p2 = pts[i + 1];
                              if (pointer.x >= Math.min(p1.x, p2.x) - 10 && pointer.x <= Math.max(p1.x, p2.x) + 10 &&
                                  pointer.y >= Math.min(p1.y, p2.y) - 10 && pointer.y <= Math.max(p1.y, p2.y) + 10) {
                                insertIndex = i; break;
                              }
                            }
                            insertWaypoint(wire.id, snap(pointer.x), snap(pointer.y), insertIndex);
                            addLog('[UI] Добавлена точка на провод: ' + wire.id);
                          }
                        } else {
                          // Обычный клик открывает меню
                          e.cancelBubble = true;
                          setSelectedWireId(wire.id);
                          setWireMenuPos({ x: e.evt.clientX - 250, y: e.evt.clientY - 50 });
                          setSelectedCompId(null);
                        }
                      }}
                    />
                    {(wire.waypoints || []).map((wp: any, i: number) => (
                      <Circle key={i} x={wp.x} y={wp.y} radius={5} fill="#f1c40f" stroke="#000" draggable
                        onDragMove={(e) => { e.target.x(snap(e.target.x())); e.target.y(snap(e.target.y())); }}
                        onDragEnd={(e) => updateWaypoint(wire.id, i, e.target.x(), e.target.y())}
                        onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; removeWaypoint(wire.id, i); }}
                      />
                    ))}
                  </Group>
                );
              })}

              {components.map(comp => {
                const imgSrc = getImagePath(comp.deviceId);
                const vL = simResult?.pinVoltages?.get(comp.id)?.get('L') || 0;
                const vN = simResult?.pinVoltages?.get(comp.id)?.get('N') || 0;
                const diff = Math.abs(vL - vN);
                const isLampOn = comp.deviceId === 'lamp' && diff > 50;
                const lampOpacity = comp.deviceId === 'lamp' ? Math.min(diff / 220, 1) * 0.6 : 0;
                const isTripped = simResult?.events.find((e: any) => e.type === 'tripped' && e.target?.compId === comp.id);

                return (
                  <Group key={comp.id} x={comp.x} y={comp.y} draggable
                    onClick={(e) => { e.cancelBubble = true; setSelectedCompId(comp.id); setWireMenuPos(null); }}
                    onDragMove={(e) => { e.target.x(snap(e.target.x())); e.target.y(snap(e.target.y())); }}
                    onDragEnd={(e) => { e.cancelBubble = true; updatePosition(comp.id, e.target.x(), e.target.y()); }}
                  >
                    {isLampOn && <Circle x={40} y={30} radius={50} fill="yellow" opacity={lampOpacity} />}
                    {isTripped && <Rect width={80} height={60} fill="red" opacity={0.5} cornerRadius={4} />}
                    {imgSrc ? <DeviceImage src={imgSrc} x={0} y={0} width={80} height={60} /> : <Rect width={80} height={60} fill="#2a6" />}
                    <Circle x={0} y={30} radius={8} fill={activePin?.compId === comp.id && activePin?.pinId === 'L' ? '#f1c40f' : '#00ff00'} stroke="#000" onClick={(e) => handlePinClick(comp.id, 'L', e)} />
                    <Circle x={80} y={30} radius={8} fill={activePin?.compId === comp.id && activePin?.pinId === 'N' ? '#f1c40f' : '#0000ff'} stroke="#000" onClick={(e) => handlePinClick(comp.id, 'N', e)} />
                  </Group>
                );
              })}
            </Layer>
          </Stage>

          {wireMenuPos && selectedWireId && (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', left: wireMenuPos.x, top: wireMenuPos.y, background: '#333', border: '1px solid #555', borderRadius: '6px', padding: '10px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ color: '#fff', fontSize: '12px' }}>Провод</div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {['#3498db', '#e74c3c', '#f1c40f', '#2ecc71'].map(c => (
                  <div key={c} onClick={() => { setWireColor(selectedWireId, c); setWireMenuPos(null); }} style={{ width: '20px', height: '20px', background: c, cursor: 'pointer', borderRadius: '3px' }} />
                ))}
              </div>
              <button onClick={() => { removeWire(selectedWireId); setWireMenuPos(null); }} style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '4px 8px', cursor: 'pointer', fontSize: '10px' }}>Удалить</button>
            </div>
          )}

          {selectedCompId && (() => {
            const comp = components.find(c => c.id === selectedCompId);
            if (!comp) return null;
            return (
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: '20px', top: '20px', background: '#252526', border: '1px solid #444', padding: '15px', borderRadius: '8px', color: '#fff', zIndex: 100, minWidth: '200px' }}>
                <h4 style={{ marginBottom: '10px' }}>{comp.deviceId}</h4>
                {comp.deviceId === 'breaker' && (
                  <div>
                    <label style={{ fontSize: '12px', display: 'block', marginBottom: '5px' }}>Номинал (А):</label>
                    <select value={comp.params.ratedCurrent} onChange={(e) => updateComponentParam(comp.id, 'ratedCurrent', Number(e.target.value))} style={{ width: '100%', padding: '5px', background: '#333', color: '#fff', border: '1px solid #555' }}>
                      <option value={6}>6 А</option><option value={10}>10 А</option><option value={16}>16 А</option><option value={25}>25 А</option>
                    </select>
                  </div>
                )}
                {comp.deviceId === 'lamp' && (
                  <div>
                    <label style={{ fontSize: '12px', display: 'block', marginBottom: '5px' }}>Мощность (Вт):</label>
                    <input type="number" value={comp.params.power} onChange={(e) => updateComponentParam(comp.id, 'power', Number(e.target.value))} style={{ width: '100%', padding: '5px', background: '#333', color: '#fff', border: '1px solid #555' }} />
                  </div>
                )}
                {comp.deviceId === 'switch' && (
                  <button onClick={() => updateComponentParam(comp.id, 'closed', !comp.params.closed)} style={{ width: '100%', padding: '8px', background: comp.params.closed ? '#2ecc71' : '#555', color: '#fff', border: 'none', cursor: 'pointer' }}>
                    {comp.params.closed ? 'ВКЛ' : 'ВЫКЛ'}
                  </button>
                )}
                <button onClick={() => setSelectedCompId(null)} style={{ marginTop: '15px', background: '#555', color: '#fff', border: 'none', padding: '5px 10px', cursor: 'pointer', width: '100%' }}>Закрыть</button>
              </div>
            );
          })()}
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
