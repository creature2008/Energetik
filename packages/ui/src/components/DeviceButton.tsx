import React, { RefObject, useEffect, useRef } from 'react';

const DRAG_THRESHOLD = 5;

type Props = {
  dev: { id: string; name: string };
  canvasAreaRef: RefObject<HTMLDivElement>;
  stageRef: RefObject<any>;
  onSpawn: (deviceId: string, at?: { x: number; y: number }) => void;
};

type DragState = {
  x0: number; y0: number; moved: boolean;
  ghost: HTMLDivElement | null;
  onEsc: (ev: KeyboardEvent) => void;
};

export function DeviceButton({ dev, canvasAreaRef, stageRef, onSpawn }: Props) {
  const drag = useRef<DragState | null>(null);

  const cleanup = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return null;
    d.ghost?.remove();
    window.removeEventListener('keydown', d.onEsc);
    return d;
  };

  useEffect(() => () => { cleanup(); }, []);

  const overCanvas = (cx: number, cy: number) => {
    const area = canvasAreaRef.current;
    const el = document.elementFromPoint(cx, cy);
    return !!area && !!el && area.contains(el);
  };

  const finish = (e: React.PointerEvent, cancelled: boolean) => {
    const d = cleanup();
    if (!d || cancelled) return;
    if (!d.moved) { onSpawn(dev.id); return; }
    if (!overCanvas(e.clientX, e.clientY)) return;
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.container().getBoundingClientRect();
    const scale = stage.scaleX();
    const pos = stage.position();
    onSpawn(dev.id, {
      x: (e.clientX - box.left - pos.x) / scale,
      y: (e.clientY - box.top - pos.y) / scale,
    });
  };

  return (
    <button
      className="device-btn"
      draggable={false}
      style={{ marginBottom: 3, fontSize: 12, padding: 6, cursor: 'grab', userSelect: 'none', touchAction: 'none' }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        cleanup();
        const onEsc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cleanup(); };
        window.addEventListener('keydown', onEsc);
        drag.current = { x0: e.clientX, y0: e.clientY, moved: false, ghost: null, onEsc };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (!d.moved) {
          if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_THRESHOLD) return;
          d.moved = true;
          const g = document.createElement('div');
          g.textContent = dev.name;
          Object.assign(g.style, {
            position: 'fixed', zIndex: '9999', pointerEvents: 'none', padding: '6px 10px',
            color: '#fff', borderRadius: '4px', fontSize: '12px', opacity: '0.9',
            transform: 'translate(-50%, -50%)',
          });
          document.body.appendChild(g);
          d.ghost = g;
        }
        const g = d.ghost!;
        g.style.left = e.clientX + 'px';
        g.style.top = e.clientY + 'px';
        g.style.background = overCanvas(e.clientX, e.clientY) ? '#0055aa' : '#7f8c8d';
      }}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSpawn(dev.id); }
      }}
    >
      {dev.name}
    </button>
  );
}