'use client';
import React, { useEffect } from 'react';

export const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(' ');
const T = { ok: 'bg-ok/15 text-ok', warn: 'bg-warn/15 text-warn', bad: 'bg-bad/15 text-bad', info: 'bg-info/15 text-info', mute: 'bg-mute/15 text-mute' };
const MAP: Record<string, keyof typeof T> = { ok: 'ok', passed: 'ok', success: 'ok', outdated: 'warn', warn: 'warn', moderate: 'warn', vulnerable: 'bad', failed: 'bad', error: 'bad', high: 'bad', critical: 'bad', running: 'info', info: 'info' };
const LABEL: Record<string, string> = { ok: 'Up to date', unscanned: 'Not scanned', passed: 'Passed', failed: 'Failed', running: 'Running', pending: 'Pending', skipped: 'Skipped' };
export function Badge({ s, label }: { s: string; label?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', T[MAP[s] ?? 'mute'])}>
      <i className={cx('h-1.5 w-1.5 rounded-full bg-current', s === 'running' && 'animate-pulse')} />
      {label ?? LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}
export function Btn({ v = 'default', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { v?: 'default' | 'primary' | 'ghost' }) {
  const c = { default: 'border border-line bg-panel hover:bg-line/50', primary: 'bg-accent font-medium text-bg hover:opacity-90', ghost: 'hover:bg-line/50' }[v];
  return <button {...p} className={cx('inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', c, p.className)} />;
}
export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => <div className={cx('rounded-lg border border-line bg-panel', className)}>{children}</div>;
export const H = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">{children}</h2>{right}</div>
);
export const inputCls = 'w-full rounded-md border border-line bg-bg px-3 py-1.5 text-sm placeholder:text-mute focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={title} className={cx('w-full rounded-lg border border-line bg-panel shadow-xl', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-semibold">{title}</h2><Btn v="ghost" onClick={onClose} aria-label="Close">✕</Btn></div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
export const Empty = ({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) => (
  <div className="px-6 py-12 text-center"><p className="font-medium">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm text-mute">{text}</p>{action && <div className="mt-4">{action}</div>}</div>
);
export const rel = (t: string | null) => {
  if (!t) return 'Never';
  const m = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
export function Donut({ parts, label, sub }: { parts: { v: number; c: string }[]; label: string; sub: string }) {
  const tot = parts.reduce((a, p) => a + p.v, 0) || 1; let off = 0; const R = 42, C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36" role="img" aria-label={`${label} ${sub}`}>
      <circle cx="60" cy="60" r={R} fill="none" strokeWidth="12" className="stroke-line" />
      {parts.map((p, i) => { const len = (p.v / tot) * C; const el = <circle key={i} cx="60" cy="60" r={R} fill="none" strokeWidth="12" className={p.c} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />; off += len; return el; })}
      <text x="60" y="58" textAnchor="middle" className="fill-ink text-xl font-semibold">{label}</text>
      <text x="60" y="74" textAnchor="middle" className="fill-mute text-[8px]">{sub}</text>
    </svg>
  );
}
export function Bars({ data }: { data: { label: string; v: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="flex h-36 items-end gap-2 px-1">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs text-mute">{d.v}</span>
          <div className="w-full rounded-t bg-accent/70" style={{ height: `${(d.v / max) * 80 + 2}px` }} title={`${d.label}: ${d.v}`} />
          <span className="text-xs text-mute">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
