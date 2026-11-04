import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Group, Circle, Line, Image as KonvaImage, Text, Arc } from 'react-konva';
import { runSimulation, measure, registry, lintProtection } from '@electro/core';
import { registerAllMods } from '@electro/mods';
import { useStore, buildProjectForSimulation, loadProjectData } from './store';
import { CABLES, getCableById, CableSpec } from './cables';
import useImage from 'use-image';
import { Calculator } from './Calculator';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

registerAllMods();

const GRID_SIZE = 10;
const CATEGORY_NAMES: Record<string, string> = {
  power: '⚡ Питание', protection: '🛑 Защита', automation: '⚙️ Автоматика', light: '💡 Свет', sockets: '🔌 Розетки',
  switches: '🔘 Выключатели', psu: '🔋 Блоки питания', motors: '⚙️ Моторы', boxes: '📦 Разное',
};

const DeviceImage = ({ src, x, y, width, height }: any) => {
  const [img] = useImage(src);
  return <KonvaImage image={img} x={x} y={y} width={width} height={height} />;
};
const snap = (v: number) => Math.round(v / GRID_SIZE) * GRID_SIZE;
type ProbePoint = { compId: string, pinId: string, x: number, y: number };

function formatPower(w: number): string {
  if (w >= 1e6) return (w / 1e6).toFixed(2) + ' МВт';
  if (w >= 1e3) return (w / 1e3).toFixed(2) + ' кВт';
  if (w >= 1) return w.toFixed(2) + ' Вт';
  return (w * 1000).toFixed(1) + ' мВт';
}

function App() {
  const [logs, setLogs] = useState<string[]>(['[Система] Приложение запущено.']);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [wireMenuPos, setWireMenuPos] = useState<{x: number, y: number} | null>(null);
  const [compMenuPos, setCompMenuPos] = useState<{x: number, y: number, compId: string} | null>(null);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [blink, setBlink] = useState(true);

  const [probeA, setProbeA] = useState<ProbePoint | null>(null);
  const [probeB, setProbeB] = useState<ProbePoint | null>(null);
  const [measureResult, setMeasureResult] = useState<{ x: number, y: number, text: string } | null>(null);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  const [showCalculator, setShowCalculator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<string[]>(['power']);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  // Выделение рамкой
  const [selStart, setSelStart] = useState<{x: number, y: number} | null>(null);
  const [selEnd, setSelEnd] = useState<{x: number, y: number} | null>(null);

  // Панель проблем
  const [showProblems, setShowProblems] = useState(false);

  // Верхняя панель кабеля
  const [cableMenuOpen, setCableMenuOpen] = useState(false);
  const [cableFilterMat, setCableFilterMat] = useState<'all' | 'copper' | 'aluminum'>('all');
  const [cableFilterFlex, setCableFilterFlex] = useState<'all' | 'solid' | 'stranded'>('all');
  const [cableFilterCores, setCableFilterCores] = useState<number | null>(null);

  const {
    components, wires, addComponent, updatePosition, activePin, setActivePin,
    addWire, removeWire, updateWire, updateComponentParam, removeComponent, removeSelected,
    insertWaypoint, updateWaypoint, removeWaypoint, setWireColor,
    selectedCompIds, selectedWireIds, setSelection, toggleSelection, clearSelection,
    copySelection, pasteSelection, undo, redo, resetAllPower, importProject,
    selectedCable, setSelectedCable, applyCableToWires,
  } = useStore();

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);
  const addHistory = useStore(s => s.pushHistory);

  // === Авто-пуск моторов ===
  const prevMotorVoltagesRef = useRef<Map<string, number>>(new Map());
  const motorsInStartupRef = useRef<Set<string>>(new Set());
  const startupTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const handleRunSimulationRef = useRef<() => void>(() => {});

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
        if (r.kind === 'ok') {
          if (r.isShorted) {
            text = '0 В | Замкнуто';
          } else if (r.isAC) {
            text = r.volts.toFixed(2) + ' В ~' + r.freq + 'Гц';
          } else {
            text = r.volts.toFixed(2) + ' В DC';
          }
        }
        else if (r.kind === 'isolated') text = 'OL | Обрыв';
        else if (r.kind === 'open') text = 'OL | Не подключено';
        const pos = e.target.getStage()?.getPointerPosition();
        if (pos) setMeasureResult({ x: pos.x, y: pos.y - 40, text });
      } else {
        const pos = e.target.getStage()?.getPointerPosition();
        if (pos) setMeasureResult({ x: pos.x, y: pos.y - 40, text: 'Выберите 2-ю точку' });
      }
      return;
    }
    if (!activePin) {
      setActivePin({ compId, pinId });
    } else {
      // Клик по той же клемме — просто отмена
      if (activePin.compId === compId && activePin.pinId === pinId) {
        setActivePin(null);
        return;
      }
      // Защита от замыкания клемм одного прибора
      if (activePin.compId === compId) {
        addLog('[!] Нельзя соединить две клеммы одного прибора — это КЗ');
        setActivePin(null);
        return;
      }
      // Соединяем с любой клеммой другого прибора (даже если pinId совпадает)
      addWire(activePin, { compId, pinId });
      setActivePin(null);
    }
  };

  const handleWireClick = (wire: any, e: any) => {
    if (e.evt.shiftKey) {
      e.cancelBubble = true;
      const stage = e.target.getStage();
      const pointer = stage?.getRelativePointerPosition();
      if (pointer) {
        const pts = getWirePointsArray(wire);
        let idx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i]; const p2 = pts[i + 1];
          const dx = p2.x - p1.x, dy = p2.y - p1.y;
          const lenSq = dx * dx + dy * dy;
          let t = lenSq > 0 ? ((pointer.x - p1.x) * dx + (pointer.y - p1.y) * dy) / lenSq : 0;
          t = Math.max(0, Math.min(1, t));
          const px = p1.x + t * dx, py = p1.y + t * dy;
          const dist = Math.hypot(pointer.x - px, pointer.y - py);
          if (dist < bestDist) { bestDist = dist; idx = i; }
        }
        if (bestDist < 20) {
          insertWaypoint(wire.id, snap(pointer.x), snap(pointer.y), idx);
        }
      }
      return;
    }
    if (isAltPressed) {
      e.cancelBubble = true;
      const getCur = (compId: string, pinId: string) => {
        return simResult?.pinCurrents?.get(compId + ':' + pinId) || 0;
      };
      const getVolt = (compId: string, pinId: string) => {
        const re = simResult?.pinVRe?.get(compId)?.get(pinId) || 0;
        const im = simResult?.pinVIm?.get(compId)?.get(pinId) || 0;
        return Math.hypot(re, im);
      };
      const curA = getCur(wire.from.compId, wire.from.pinId);
      const curB = getCur(wire.to.compId, wire.to.pinId);
      const volA = getVolt(wire.from.compId, wire.from.pinId);
      const volB = getVolt(wire.to.compId, wire.to.pinId);
      const current = Math.min(curA, curB);
      const voltage = Math.max(volA, volB);
      const power = voltage * current;
      const text = current.toFixed(3) + ' А | ' + power.toFixed(1) + ' Вт';
      const pos = e.target.getStage()?.getPointerPosition();
      if (pos) setMeasureResult({ x: pos.x, y: pos.y - 40, text });
      return;
    }
    e.cancelBubble = true;
    setSelectedWireId(wire.id);
    setWireMenuPos({ x: e.evt.clientX - 250, y: e.evt.clientY - 50 });
    setSelectedCompId(null);
    setCompMenuPos(null);
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
    const frac = (idx + 1) / (sidePins.length + 1);
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
    const pts: any[] = [{x: start.x, y: start.y}];
    (wire.waypoints || []).forEach((wp: any) => pts.push(wp));
    pts.push({x: end.x, y: end.y});
    return pts;
  };

  const handleRunSimulation = () => {
    try {
      const project = buildProjectForSimulation();

      // Применяем режим пуска к моторам, которые сейчас в процессе
      for (const comp of project.components) {
        if (comp.deviceId === 'motor_1ph' || comp.deviceId === 'motor_3ph') {
          (comp.params as any).startup = motorsInStartupRef.current.has(comp.id);
        }
      }

      const res = runSimulation(project as any);
      setSimResult(res);

      // Отслеживаем переходы моторов (выкл → вкл)
      for (const comp of project.components) {
        if (comp.deviceId !== 'motor_1ph' && comp.deviceId !== 'motor_3ph') continue;
        const pinId = comp.deviceId === 'motor_3ph' ? 'L1' : 'L';
        const re = res.pinVRe?.get(comp.id)?.get(pinId) || 0;
        const im = res.pinVIm?.get(comp.id)?.get(pinId) || 0;
        const v = Math.hypot(re, im);
        const prevV = prevMotorVoltagesRef.current.get(comp.id) || 0;
        prevMotorVoltagesRef.current.set(comp.id, v);

        if (prevV < 50 && v > 50 && !motorsInStartupRef.current.has(comp.id)) {
          // Мотор только что включился — начинаем пуск
          motorsInStartupRef.current.add(comp.id);
          const timer = setTimeout(() => {
            motorsInStartupRef.current.delete(comp.id);
            startupTimersRef.current.delete(comp.id);
            handleRunSimulationRef.current();
          }, 1000);
          startupTimersRef.current.set(comp.id, timer);
          // Сразу пересчитываем с пусковым режимом
          setTimeout(() => handleRunSimulationRef.current(), 0);
        } else if (v < 50 && motorsInStartupRef.current.has(comp.id)) {
          // Мотор отключился — сбрасываем пуск
          const t = startupTimersRef.current.get(comp.id);
          if (t) clearTimeout(t);
          startupTimersRef.current.delete(comp.id);
          motorsInStartupRef.current.delete(comp.id);
        }
      }
      if (res.updatedParams.size > 0) {
        res.updatedParams.forEach((params: any, compId: any) => {
          Object.entries(params).forEach(([k, v]) => {
            const comp = components.find(c => c.id === compId);
            if (comp && comp.params[k] !== v) updateComponentParam(compId, k, v);
          });
        });
      }
      // Выводим debug-логи в панель событий
      if (res.debugLogs && res.debugLogs.length > 0) {
        setLogs(prev => {
          const filtered = prev.filter(l => !l.startsWith('[DBG]'));
          return [...filtered, ...res.debugLogs];
        });
      }
      
      const lintEvents = lintProtection(project as any);
      const allEvents = [...(res.events || []), ...lintEvents];
      setLogs(prev => {
        const filtered = prev.filter(l => !l.startsWith('[ПРОБЛЕМА]'));
        return [...filtered, ...allEvents.map((e: any) => '[ПРОБЛЕМА] ' + e.message)];
      });
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

  const handlePasteFromClipboard = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      const data = JSON.parse(txt);
      if (data && data.components) {
        importProject({ components: data.components, wires: data.wires || [] });
        addLog('[Система] Импортировано из буфера');
      } else {
        addLog('[Ошибка] В буфере не проект');
      }
    } catch (e: any) { addLog('[Ошибка импорта] ' + e.message); }
  };

  // Автосохранение черновика в localStorage (упрощённый аналог IndexedDB)
  useEffect(() => {
    const t = setTimeout(() => {
      if (components.length === 0 && wires.length === 0) return;
      try {
        localStorage.setItem('electro-draft', JSON.stringify({ components, wires, savedAt: Date.now() }));
      } catch {}
    }, 2000);
    return () => clearTimeout(t);
  }, [components, wires]);

  // Загрузка черновика при старте
  useEffect(() => {
    const raw = localStorage.getItem('electro-draft');
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.components?.length || d.wires?.length) {
        loadProjectData({ components: d.components || [], wires: d.wires || [] });
        setLogs(prev => [...prev, '[Система] Черновик восстановлен']);
      }
    } catch {}
  }, []);

  // Обновляем реф на каждом рендере (для таймеров)
  handleRunSimulationRef.current = handleRunSimulation;

  useEffect(() => { if (!isPaused) handleRunSimulation(); }, [components, wires, isPaused]);
  useEffect(() => {
    const anim = setInterval(() => setRotation(r => r + 5), 50);
    const blinkT = setInterval(() => setBlink(b => !b), 500);
    return () => { clearInterval(anim); clearInterval(blinkT); };
  }, []);

  // Хоткеи
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(true);
      if (e.key === 'Control') setIsCtrlPressed(true);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); handleSaveProject(); }
      if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); handleLoadProject(); }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      if (mod && e.key.toLowerCase() === 'c') { copySelection(); }
      if (mod && e.key.toLowerCase() === 'v') {
        if (useStore.getState().clipboard) { e.preventDefault(); pasteSelection(20, 20); }
      }
      if (e.key === 'Delete') { removeSelected(); }
      if (e.key === 'Escape') {
        clearSelection();
        setSelectedCompId(null);
        setWireMenuPos(null);
        setCompMenuPos(null);
        setProbeA(null); setProbeB(null); setMeasureResult(null);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') { setIsAltPressed(false); setMeasureResult(null); }
      if (e.key === 'Control') { setIsCtrlPressed(false); setMeasureResult(null); setProbeA(null); setProbeB(null); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [measureResult, selectedCompId]);

  const renderGrid = (width: number, height: number) => {
    const lines = [];
    const sx = Math.floor((-stagePos.x / stageScale) / GRID_SIZE) * GRID_SIZE;
    const ex = Math.ceil(((width - stagePos.x) / stageScale) / GRID_SIZE) * GRID_SIZE;
    const sy = Math.floor((-stagePos.y / stageScale) / GRID_SIZE) * GRID_SIZE;
    const ey = Math.ceil(((height - stagePos.y) / stageScale) / GRID_SIZE) * GRID_SIZE;
    for (let i = sx; i < ex; i += GRID_SIZE) lines.push(<Line key={'v'+i} points={[i, sy, i, ey]} stroke="#333" strokeWidth={1 / stageScale} />);
    for (let i = sy; i < ey; i += GRID_SIZE) lines.push(<Line key={'h'+i} points={[sx, i, ex, i]} stroke="#333" strokeWidth={1 / stageScale} />);
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
            const v = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
            updateComponentParam(comp.id, cfg.key, v);
          }} style={{ width: '100%', padding: '4px', background: '#333', color: '#fff', border: '1px solid #555' }}>
            {cfg.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        )}
        {cfg.type === 'loads' && (() => {
          const loads = (comp.params[cfg.key] as any[]) || [];
          const total = loads.reduce((s, l) => s + (Number(l.power) || 0), 0);
          return (
            <div>
              <select value="" onChange={(e) => {
                const pv = e.target.value; if (!pv) return;
                const preset = cfg.options?.find(o => String(o.value) === pv);
                if (preset) updateComponentParam(comp.id, cfg.key, [...loads, { id: Date.now(), name: preset.label, power: preset.power || 0 }]);
                e.target.value = '';
              }} style={{ width: '100%', padding: '4px', background: '#333', color: '#fff', border: '1px solid #555', marginBottom: '6px', fontSize: '12px' }}>
                <option value="">+ Добавить прибор...</option>
                {cfg.options?.map(opt => <option key={opt.value} value={String(opt.value)}>{opt.label} ({opt.power}Вт)</option>)}
              </select>
              {loads.map((l, idx) => (
                <div key={l.id || idx} style={{ display: 'flex', justifyContent: 'space-between', background: '#2a2a2a', padding: '4px 6px', borderRadius: '3px', marginBottom: '3px', fontSize: '11px' }}>
                  <span>{l.name}: <b>{l.power}Вт</b></span>
                  <button onClick={() => updateComponentParam(comp.id, cfg.key, loads.filter((_, i) => i !== idx))} style={{ background: '#c0392b', color: '#fff', border: 'none', cursor: 'pointer', padding: '1px 6px', borderRadius: '2px' }}>×</button>
                </div>
              ))}
              <div style={{ fontSize: '12px', color: total > 3520 ? '#e74c3c' : '#f1c40f', fontWeight: 'bold' }}>Сумма: {total} Вт ({(total / 220).toFixed(1)} А)</div>
            </div>
          );
        })()}
      </div>
    ));
  };

  // Фильтр кабелей
  const filteredCables = CABLES.filter(c => {
    if (cableFilterMat !== 'all' && c.material !== cableFilterMat) return false;
    if (cableFilterFlex !== 'all' && c.flexibility !== cableFilterFlex) return false;
    if (cableFilterCores !== null && c.cores !== cableFilterCores) return false;
    return true;
  });

  const problems = logs.filter(l => l.startsWith('[ПРОБЛЕМА]'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <div className="topbar">
        <div className="topbar-title">⚡ Electro Studio</div>
        <div className="topbar-actions">
          {/* Кнопка кабеля */}
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => setCableMenuOpen(!cableMenuOpen)} title="Выбор кабеля" style={{ color: selectedCable ? '#f1c40f' : '#ccc', fontSize: '13px', padding: '4px 8px' }}>
              🔌 {selectedCable ? selectedCable.display : 'Кабель'}
            </button>
            {cableMenuOpen && (
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, background: '#252526', border: '1px solid #444', borderRadius: '6px', padding: '10px', zIndex: 1000, width: '420px', maxHeight: '500px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => setCableFilterMat('all')} style={{ padding: '3px 8px', background: cableFilterMat === 'all' ? '#3498db' : '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>Все</button>
                  <button onClick={() => setCableFilterMat('copper')} style={{ padding: '3px 8px', background: cableFilterMat === 'copper' ? '#e67e22' : '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>Медь</button>
                  <button onClick={() => setCableFilterMat('aluminum')} style={{ padding: '3px 8px', background: cableFilterMat === 'aluminum' ? '#95a5a6' : '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>Алюминий</button>
                  <span style={{ width: '1px', background: '#444', margin: '0 4px' }} />
                  <button onClick={() => setCableFilterFlex('all')} style={{ padding: '3px 8px', background: cableFilterFlex === 'all' ? '#3498db' : '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>Все жилы</button>
                  <button onClick={() => setCableFilterFlex('solid')} style={{ padding: '3px 8px', background: cableFilterFlex === 'solid' ? '#2ecc71' : '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>Моножила</button>
                  <button onClick={() => setCableFilterFlex('stranded')} style={{ padding: '3px 8px', background: cableFilterFlex === 'stranded' ? '#f39c12' : '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>Многожилка</button>
                </div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                  <button onClick={() => setCableFilterCores(null)} style={{ padding: '3px 8px', background: cableFilterCores === null ? '#3498db' : '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>Любые</button>
                  {[2,3,4,5].map(n => (
                    <button key={n} onClick={() => setCableFilterCores(n)} style={{ padding: '3px 8px', background: cableFilterCores === n ? '#3498db' : '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>{n} жилы</button>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid #444', paddingTop: '8px' }}>
                  {filteredCables.map(c => (
                    <div key={c.id} onClick={() => { setSelectedCable(c); setCableMenuOpen(false); }}
                      style={{ padding: '4px 8px', background: selectedCable?.id === c.id ? '#2c3e50' : 'transparent', color: '#ddd', cursor: 'pointer', fontSize: '12px', borderRadius: '3px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{c.display}</span>
                      <span style={{ color: '#888', fontSize: '11px' }}>{c.currentRating}А</span>
                    </div>
                  ))}
                  {filteredCables.length === 0 && <div style={{ color: '#888', fontSize: '11px', padding: '5px' }}>Нет подходящих кабелей</div>}
                </div>
                <button onClick={() => setSelectedCable(null)} style={{ marginTop: '8px', width: '100%', padding: '5px', background: '#555', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>Сбросить кабель</button>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={() => setShowCalculator(true)} title="Калькулятор">🧮</button>`n          <button className="icon-btn" onClick={handleSaveProject} title="Сохранить (Ctrl+S)">💾</button>
          <button className="icon-btn" onClick={handleLoadProject} title="Загрузить (Ctrl+O)">📂</button>
          <button className="icon-btn" onClick={handlePasteFromClipboard} title="Импорт из буфера">📋</button>
          <button className="icon-btn" onClick={() => setIsPaused(!isPaused)} title={isPaused ? 'Продолжить' : 'Пауза'}>
            {isPaused ? '▶' : '⏸'}
          </button>
          <button className="icon-btn" onClick={resetAllPower} title="Сбросить питание (все автоматы и выключатели)">🔄</button>
          <button className="icon-btn" onClick={() => setShowProblems(!showProblems)} title="Проблемы ПУЭ">
            ⚠{problems.length > 0 ? ' ' + problems.length : ''}
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

        <div className="canvas-area"
          onClick={() => { setWireMenuPos(null); setSelectedCompId(null); setCompMenuPos(null); setCableMenuOpen(false); }}
          onDrop={async (e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0]; if (!f) return;
            try {
              const txt = await f.text();
              const data = JSON.parse(txt);
              if (data.components) { importProject({ components: data.components, wires: data.wires || [] }); addLog('[Система] Файл загружен'); }
            } catch (err: any) { addLog('[Ошибка файла] ' + err.message); }
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          <Stage
            width={window.innerWidth - 220}
            height={window.innerHeight - 40 - 140}
            draggable={!selStart}
            onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
            onWheel={(e) => {
              e.evt.preventDefault(); const stage = e.target.getStage(); if (!stage) return;
              const oldScale = stage.scaleX(); const pointer = stage.getPointerPosition(); if (!pointer) return;
              const mp = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
              const ns = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
              stage.scale({ x: ns, y: ns });
              stage.position({ x: pointer.x - mp.x * ns, y: pointer.y - mp.y * ns });
              setStageScale(ns); setStagePos(stage.position());
            }}
            onMouseDown={(e) => {
              const stage = e.target.getStage(); if (!stage) return;
              if (e.target === stage && e.evt.shiftKey) {
                const p = stage.getRelativePointerPosition();
                if (p) { setSelStart(p); setSelEnd(p); }
              }
            }}
            onMouseMove={(e) => {
              if (!selStart) return;
              const stage = e.target.getStage(); if (!stage) return;
              const p = stage.getRelativePointerPosition();
              if (p) setSelEnd(p);
            }}
            onMouseUp={() => {
              if (selStart && selEnd && (Math.abs(selStart.x - selEnd.x) > 5 || Math.abs(selStart.y - selEnd.y) > 5)) {
                const x1 = Math.min(selStart.x, selEnd.x), x2 = Math.max(selStart.x, selEnd.x);
                const y1 = Math.min(selStart.y, selEnd.y), y2 = Math.max(selStart.y, selEnd.y);
                const hit = components.filter(c => {
                  const mod = registry.get(c.deviceId);
                  if (!mod) return false;
                  const cx1 = c.x, cy1 = c.y, cx2 = c.x + mod.size.w, cy2 = c.y + mod.size.h;
                  return cx2 >= x1 && cx1 <= x2 && cy2 >= y1 && cy1 <= y2;
                }).map(c => c.id);
                setSelection(hit, []);
              }
              setSelStart(null); setSelEnd(null);
            }}
          >
            <Layer>
              {renderGrid(window.innerWidth - 220, window.innerHeight - 40 - 140)}

              {wires.map(wire => {
                const pts = getWirePointsArray(wire); if (pts.length < 2) return null;
                const flat = pts.flatMap(p => [p.x, p.y]);
                const cable = getCableById(wire.cableId || '');
                const isSel = selectedWireIds.includes(wire.id);
                return (
                  <Group key={wire.id}>
                    <Line points={flat} stroke={isSel ? '#f1c40f' : (wire.color || '#3498db')} strokeWidth={cable ? Math.max(3, cable.crossSection) : 5} lineCap="round" lineJoin="round" hitStrokeWidth={20}
                      onClick={(e) => handleWireClick(wire, e)} />
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
                const mod = registry.get(comp.deviceId); if (!mod) return null;
                const imgSrc = getImagePath(comp.deviceId);
                const visual = simResult?.visuals?.get(comp.id);
                const glow = Number(visual?.glow) || 0;
                const spinning = visual?.spinning === true;
                const leftPins = Object.values(comp.pins).filter((p: any) => p.side === 'left');
                const rightPins = Object.values(comp.pins).filter((p: any) => p.side === 'right');
                const topPins = Object.values(comp.pins).filter((p: any) => p.side === 'top');
                const bottomPins = Object.values(comp.pins).filter((p: any) => p.side === 'bottom');
                const isBreaker = comp.deviceId.startsWith('breaker');
                const isSwitch = comp.deviceId.startsWith('switch');
                const isSelected = selectedCompIds.includes(comp.id);
                const breakerCurrent = simResult?.componentCurrents?.get(comp.id) || 0;
                const rated = Number(comp.params.ratedCurrent) || 16;
                const isTripped = comp.params.tripped === true;
                const isOverloaded = isBreaker && !isTripped && breakerCurrent > rated * 0.9;

                return (
                  <Group key={comp.id} x={comp.x} y={comp.y} draggable
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (e.evt.ctrlKey || e.evt.shiftKey) { toggleSelection(comp.id); return; }
                      setSelection([comp.id], []);
                      setSelectedCompId(comp.id); setWireMenuPos(null);
                      if (comp.deviceId === 'contactor') {
                        const cur = Number(comp.params._manualOverride) || 0;
                        updateComponentParam(comp.id, '_manualOverride', cur === 0 ? 1 : 0);
                      }
                    }}
                    onDragMove={(e) => { e.target.x(snap(e.target.x())); e.target.y(snap(e.target.y())); }}
                    onDragEnd={(e) => { e.cancelBubble = true; updatePosition(comp.id, e.target.x(), e.target.y()); }}>

                    {isSelected && <Rect x={-4} y={-4} width={mod.size.w + 8} height={mod.size.h + 8} stroke="#f1c40f" strokeWidth={2} dash={[6, 4]} cornerRadius={6} listening={false} />}
                    {glow > 0 ? <Circle x={mod.size.w/2} y={mod.size.h/2} radius={50} fill="yellow" opacity={glow * 0.8} listening={false} /> : null}

                    {isSwitch ? (() => {
                      const keys = comp.deviceId === 'switch_1' ? 1 : comp.deviceId === 'switch_2' ? 2 : 3;
                      const totalCurrent = simResult?.componentCurrents?.get(comp.id) || 0;
                      const isWarning = totalCurrent > 10;
                      const segW = (mod.size.w - 10) / keys;
                      return (
                        <Group>
                          <Rect width={mod.size.w} height={mod.size.h} fill="#d8d8d8" stroke="#555" strokeWidth={2} cornerRadius={4} />
                          <Rect x={5} y={5} width={mod.size.w - 10} height={mod.size.h - 10} fill="#f5f5f5" stroke="#333" strokeWidth={1} cornerRadius={2} />
                          {Array.from({ length: keys }).map((_, k) => {
                            const isClosed = comp.params['closed' + (k + 1)] === true;
                            let ledColor = '#e74c3c', ledGlow = true;
                            if (!isClosed) { ledColor = '#e74c3c'; ledGlow = true; }
                            else if (totalCurrent > 0.01) { ledColor = '#2ecc71'; ledGlow = true; }
                            else { ledColor = '#f1c40f'; ledGlow = true; }
                            return (
                              <Group key={k} x={5 + segW * k} y={5}>
                                <Rect width={segW - 2} height={mod.size.h - 10} fill={isClosed ? '#ffffff' : '#b8b8b8'} stroke="#333" strokeWidth={1} cornerRadius={2}
                                  onClick={(e) => { e.cancelBubble = true; updateComponentParam(comp.id, 'closed' + (k + 1), !isClosed); }} />
                                <Group x={segW / 2 - 1} y={mod.size.h - 22} listening={false}>
                                  {ledGlow ? <Circle radius={14} fill={ledColor} opacity={0.35} listening={false} /> : null}
                                  <Circle radius={6} fill={ledColor} stroke="#111" strokeWidth={1.5} listening={false} />
                                  <Circle x={-1.5} y={-1.5} radius={1.8} fill="#fff" opacity={0.8} listening={false} />
                                </Group>
                              </Group>
                            );
                          })}
                          {isWarning ? (
                            <Group x={mod.size.w - 10} y={10} listening={false}>
                              <Circle radius={8} fill="#e74c3c" stroke="#fff" strokeWidth={1.5} />
                              <Text text="!" x={-2.5} y={-6} fill="#fff" fontSize={13} fontStyle="bold" />
                            </Group>
                          ) : null}
                        </Group>
                      );
                    })() : null}

                    {isBreaker ? (() => {
                      const poles = topPins.length > 0 ? topPins.length : 1;
                      return (
                        <>
                          <Rect width={mod.size.w} height={mod.size.h} fill="#e8e8e8" stroke="#555" strokeWidth={2} cornerRadius={3} />
                          {Array.from({ length: poles }).map((_, i) => {
                            const segW = mod.size.w / poles;
                            const toggleW = segW - 10, toggleH = 36, handleH = 16;
                            const toggleY = mod.size.h / 2 - toggleH / 2;
                            const handleY = isTripped ? toggleY + toggleH - handleH - 2 : toggleY + 2;
                            const onClick = (e: any) => { e.cancelBubble = true; updateComponentParam(comp.id, 'tripped', !comp.params.tripped); };
                            return (
                              <Group key={i}>
                                <Rect x={segW * i + 5} y={toggleY} width={toggleW} height={toggleH} fill="#1a1a1a" stroke="#000" strokeWidth={1} cornerRadius={2} onClick={onClick} />
                                <Rect x={segW * i + 7} y={handleY} width={toggleW - 4} height={handleH} fill={isTripped ? '#7a7a7a' : '#e8e8e8'} stroke="#333" strokeWidth={1} cornerRadius={1} onClick={onClick} />
                              </Group>
                            );
                          })}
                          <Rect x={mod.size.w - 14} y={mod.size.h - 22} width={9} height={14} fill={isTripped ? '#e74c3c' : isOverloaded ? '#f39c12' : '#2ecc71'} stroke="#000" strokeWidth={1} cornerRadius={1} />
                          <Text text={(comp.params.curve || 'C') + (comp.params.ratedCurrent || 16)} x={5} y={mod.size.h - 20} width={mod.size.w - 25} align="left" fill="#000" fontSize={13} fontStyle="bold" />
                        </>
                      );
                    })() : null}

                    {!isSwitch && !isBreaker ? (
                      imgSrc ? <DeviceImage src={imgSrc} x={0} y={0} width={mod.size.w} height={mod.size.h} /> : <Rect width={mod.size.w} height={mod.size.h} fill={visual?.tint || '#2a6'} cornerRadius={4} />
                    ) : null}

                    {comp.deviceId === 'psu_12v' ? (
                      <Group x={mod.size.w - 20} y={mod.size.h - 18} listening={false}>
                        <Circle radius={7} fill={visual?.tint || '#333'} opacity={0.4} listening={false} />
                        <Circle radius={4} fill={visual?.tint || '#333'} stroke="#111" strokeWidth={1} listening={false} />
                      </Group>
                    ) : null}

                    {spinning === true ? <Arc x={mod.size.w/2} y={mod.size.h/2} innerRadius={10} outerRadius={25} angle={90} rotation={rotation} fill="#f1c40f" opacity={0.8} listening={false} /> : null}
                    {visual?.warning && !isSwitch && !isBreaker ? (
                      <Group x={mod.size.w - 8} y={8} listening={false}>
                        <Circle radius={9} fill="#e74c3c" stroke="#fff" strokeWidth={1.5} />
                        <Text text="!" x={-2.5} y={-6} fill="#fff" fontSize={14} fontStyle="bold" />
                      </Group>
                    ) : null}

                    {!isBreaker && visual?.label && visual.label.length > 0 ? (
                      <Text
                        text={visual.label}
                        x={0}
                        y={comp.deviceId === 'led_strip' ? mod.size.h - 14 : (isSwitch ? mod.size.h - 12 : mod.size.h/2 - 5)}
                        width={mod.size.w}
                        align="center"
                        fill={isSwitch ? '#333' : '#fff'}
                        fontSize={isSwitch ? 10 : (comp.deviceId === 'led_strip' ? 10 : 11)}
                        fontStyle="bold"
                        listening={false}
                      />
                    ) : null}

                    {leftPins.map((pin: any, idx: number) => {
                      const isActive = activePin?.compId === comp.id && activePin?.pinId === pin.id;
                      const isSameComp = activePin?.compId === comp.id && activePin?.pinId !== pin.id;
                      const fillColor = isActive ? '#f1c40f' : isSameComp ? '#e74c3c' : pin.color;
                      return (
                        <Circle key={pin.id} x={0} y={20 + idx * 15} radius={7} fill={fillColor} stroke="#000" onClick={(e) => { const pos = getPinPos(comp.id, pin.id); if (pos) handlePinClick(comp.id, pin.id, pos.x, pos.y, e); }} />
                      );
                    })}
                    {rightPins.map((pin: any, idx: number) => {
                      const isActive = activePin?.compId === comp.id && activePin?.pinId === pin.id;
                      const isSameComp = activePin?.compId === comp.id && activePin?.pinId !== pin.id;
                      const fillColor = isActive ? '#f1c40f' : isSameComp ? '#e74c3c' : pin.color;
                      return (
                        <Circle key={pin.id} x={mod.size.w} y={20 + idx * 15} radius={7} fill={fillColor} stroke="#000" onClick={(e) => { const pos = getPinPos(comp.id, pin.id); if (pos) handlePinClick(comp.id, pin.id, pos.x, pos.y, e); }} />
                      );
                    })}
                    {topPins.map((pin: any, idx: number) => {
                      const isActive = activePin?.compId === comp.id && activePin?.pinId === pin.id;
                      const isSameComp = activePin?.compId === comp.id && activePin?.pinId !== pin.id;
                      const fillColor = isActive ? '#f1c40f' : isSameComp ? '#e74c3c' : pin.color;
                      return (
                        <Circle key={pin.id} x={mod.size.w * (idx + 1) / (topPins.length + 1)} y={0} radius={7} fill={fillColor} stroke="#000" onClick={(e) => { const pos = getPinPos(comp.id, pin.id); if (pos) handlePinClick(comp.id, pin.id, pos.x, pos.y, e); }} />
                      );
                    })}
                    {bottomPins.map((pin: any, idx: number) => {
                      const isActive = activePin?.compId === comp.id && activePin?.pinId === pin.id;
                      const isSameComp = activePin?.compId === comp.id && activePin?.pinId !== pin.id;
                      const fillColor = isActive ? '#f1c40f' : isSameComp ? '#e74c3c' : pin.color;
                      return (
                        <Circle key={pin.id} x={mod.size.w * (idx + 1) / (bottomPins.length + 1)} y={mod.size.h} radius={7} fill={fillColor} stroke="#000" onClick={(e) => { const pos = getPinPos(comp.id, pin.id); if (pos) handlePinClick(comp.id, pin.id, pos.x, pos.y, e); }} />
                      );
                    })}
                  </Group>
                );
              })}

              {probeA !== null ? <Circle x={probeA.x} y={probeA.y} radius={10} stroke="#00ff00" strokeWidth={3} listening={false} /> : null}
              {probeB !== null ? <Circle x={probeB.x} y={probeB.y} radius={10} stroke="#00ff00" strokeWidth={3} listening={false} /> : null}

              {selStart && selEnd ? <Rect x={Math.min(selStart.x, selEnd.x)} y={Math.min(selStart.y, selEnd.y)} width={Math.abs(selEnd.x - selStart.x)} height={Math.abs(selEnd.y - selStart.y)} fill="rgba(241,196,15,0.15)" stroke="#f1c40f" strokeWidth={1} listening={false} /> : null}
            </Layer>
          </Stage>

          {measureResult !== null ? (
            <div style={{ position: 'absolute', left: measureResult.x, top: measureResult.y, background: '#000', color: '#00ff00', padding: '5px 10px', borderRadius: '4px', border: '1px solid #00ff00', fontSize: '14px', fontWeight: 'bold', pointerEvents: 'none', zIndex: 1000 }}>
              {measureResult.text}
            </div>
          ) : null}


          {wireMenuPos && selectedWireId ? (() => {
            const w = wires.find(x => x.id === selectedWireId); if (!w) return null;
            const cable = getCableById(w.cableId || '');
            return (
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', left: wireMenuPos.x, top: wireMenuPos.y, background: '#333', border: '1px solid #555', borderRadius: '6px', padding: '10px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
                <div style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>Провод</div>
                <div style={{ color: '#ccc', fontSize: '11px' }}>{cable ? cable.display : ((w.material === 'aluminum' ? 'Al' : 'Cu') + ' ' + (w.crossSection || 2.5) + ' мм²')}</div>
                <div style={{ display: 'flex', gap: '5px' }}>{['#3498db', '#e74c3c', '#f1c40f', '#2ecc71'].map(c => <div key={c} onClick={() => { setWireColor(selectedWireId, c); setWireMenuPos(null); }} style={{ width: '20px', height: '20px', background: c, cursor: 'pointer', borderRadius: '3px' }} />)}</div>
                <label style={{ fontSize: '11px', color: '#ccc' }}>Материал:</label>
                <select value={w.material || 'copper'} onChange={(e) => updateWire(selectedWireId, { material: e.target.value as 'copper' | 'aluminum', cableId: undefined })} style={{ width: '100%', padding: '4px', background: '#222', color: '#fff', border: '1px solid #555', borderRadius: '3px' }}>
                  <option value="copper">Медь (ρ=0.0175)</option>
                  <option value="aluminum">Алюминий (ρ=0.028)</option>
                </select>
                <label style={{ fontSize: '11px', color: '#ccc' }}>Сечение (мм²):</label>
                <select value={w.crossSection || 2.5} onChange={(e) => updateWire(selectedWireId, { crossSection: Number(e.target.value), cableId: undefined })} style={{ width: '100%', padding: '4px', background: '#222', color: '#fff', border: '1px solid #555', borderRadius: '3px' }}>
                  {[0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95].map(s => <option key={s} value={s}>{s} мм²</option>)}
                </select>
                <label style={{ fontSize: '11px', color: '#ccc' }}>Длина (м):</label>
                <input type="number" value={w.length || 1} onChange={(e) => updateWire(selectedWireId, { length: Number(e.target.value) })} style={{ width: '100%', padding: '4px', background: '#222', color: '#fff', border: '1px solid #555', borderRadius: '3px' }} />
                {selectedCable && (
                  <button onClick={() => { applyCableToWires([selectedWireId], selectedCable); setWireMenuPos(null); }} style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '5px', cursor: 'pointer', borderRadius: '3px', fontSize: '11px' }}>Применить {selectedCable.display}</button>
                )}
                <button onClick={() => { removeWire(selectedWireId); setWireMenuPos(null); }} style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '4px 8px', cursor: 'pointer', fontSize: '10px', borderRadius: '3px' }}>Удалить провод</button>
              </div>
            );
          })() : null}

          {selectedCompId !== null ? (() => {
            const comp = components.find(c => c.id === selectedCompId); if (!comp) return null;
            const mod = registry.get(comp.deviceId);
            return (
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: '20px', top: '20px', background: '#252526', border: '1px solid #444', padding: '12px', borderRadius: '8px', color: '#fff', zIndex: 100, minWidth: '200px' }}>
                <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>{mod?.name || comp.deviceId}</h4>
                {renderInspectorFields(comp)}
                <button onClick={() => setSelectedCompId(null)} style={{ background: '#555', color: '#fff', border: 'none', padding: '4px 8px', cursor: 'pointer', width: '100%', fontSize: '12px', marginTop: '5px' }}>Закрыть</button>
              </div>
            );
          })() : null}

          {showProblems ? (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: '20px', bottom: '20px', background: '#252526', border: '1px solid #f39c12', padding: '10px', borderRadius: '6px', color: '#fff', zIndex: 100, width: '360px', maxHeight: '300px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <b style={{ color: '#f39c12', fontSize: '13px' }}>Проблемы ПУЭ ({problems.length})</b>
                <button onClick={() => setShowProblems(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}>×</button>
              </div>
              {problems.length === 0 ? <div style={{ color: '#888', fontSize: '11px' }}>Нет проблем</div> :
                problems.map((p, i) => <div key={i} style={{ fontSize: '11px', color: '#f39c12', marginBottom: '4px' }}>{p}</div>)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="logs">
        <h4 style={{ marginBottom: '5px', fontSize: '12px' }}>События:</h4>
        {logs.filter(l => !l.startsWith('[ПРОБЛЕМА]')).map((log, i) => <div key={i} className="log-entry">{log}</div>)}
      </div>
      
      <Calculator open={showCalculator} onClose={() => setShowCalculator(false)} />
    </div>
  );
}

export default App;
