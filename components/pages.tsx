'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as D from '@/lib/data';
import type { Store } from '@/lib/store';
import { Badge, Bars, Btn, Card, Donut, Empty, H, Modal, cx, inputCls, rel } from './ui';

export type Nav = { page: string; id?: string };
type Go = (n: Nav) => void;
const lastPipe = (s: D.State, pid: string) => s.pipelines.find((p) => p.projectId === pid);
const Stat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <Card className="px-4 py-3"><p className="text-sm text-mute">{label}</p><p className={cx('mt-1 text-2xl font-semibold tabular-nums', tone)}>{value}</p></Card>
);
const Health = ({ p }: { p: D.Project }) => {
  const h = D.health(p);
  return h === null ? <span className="text-mute">—</span> : (
    <div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded bg-line"><div className={cx('h-full', h >= 80 ? 'bg-ok' : h >= 50 ? 'bg-warn' : 'bg-bad')} style={{ width: `${h}%` }} /></div><span className="text-xs tabular-nums text-mute">{h}</span></div>
  );
};

/* ---------- Dashboard ---------- */
export function Dashboard({ s, go, scan }: { s: Store; go: Go; scan: (id: string) => void }) {
  const { projects, scans, pipelines } = s.s;
  const all = projects.flatMap((p) => p.deps);
  const n = (st: D.Status) => all.filter((d) => d.status === st).length;
  const days = [...Array(7)].map((_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5); return { label: d.toLocaleDateString(undefined, { weekday: 'short' }), key: d.toDateString(), v: 0 }; });
  scans.forEach((x) => { const k = new Date(x.time).toDateString(); const b = days.find((d) => d.key === k); if (b) b.v++; });
  const scored = projects.map(D.health).filter((h): h is number => h !== null);
  const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Projects" value={projects.length} /><Stat label="Dependencies" value={all.length} />
        <Stat label="Outdated" value={n('outdated')} tone="text-warn" /><Stat label="Vulnerable" value={n('vulnerable')} tone="text-bad" />
        <Stat label="Health score" value={avg ?? '—'} tone={avg !== null && avg >= 80 ? 'text-ok' : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card><H>Dependency health</H><div className="flex items-center justify-around p-4">
          <Donut parts={[{ v: n('ok'), c: 'stroke-ok' }, { v: n('outdated'), c: 'stroke-warn' }, { v: n('vulnerable'), c: 'stroke-bad' }]} label={avg === null ? '—' : `${avg}%`} sub="healthy" />
          <ul className="space-y-1.5 text-sm"><li><Badge s="ok" /> <b>{n('ok')}</b></li><li><Badge s="outdated" /> <b>{n('outdated')}</b></li><li><Badge s="vulnerable" /> <b>{n('vulnerable')}</b></li></ul></div></Card>
        <Card className="lg:col-span-2"><H>Scans, last 7 days</H><div className="p-4"><Bars data={days} /></div></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><H right={<Btn v="ghost" onClick={() => go({ page: 'projects' })}>All projects</Btn>}>Recent scans</H>
          {scans.length === 0 ? <Empty title="No scans yet" text="Scan a project to see its results here." /> : scans.slice(0, 6).map((x) => (
            <button key={x.id} onClick={() => go({ page: 'project', id: x.projectId })} className="flex w-full items-center justify-between border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-line/30">
              <span><span className="font-medium">{x.projectId}</span><span className="block text-xs text-mute">{x.total} deps · {rel(x.time)}</span></span>
              <span className="flex gap-1.5">{x.vulnerable > 0 && <Badge s="vulnerable" label={`${x.vulnerable} vulnerable`} />}{x.outdated > 0 && <Badge s="outdated" label={`${x.outdated} outdated`} />}{!x.vulnerable && !x.outdated && <Badge s="ok" />}</span>
            </button>))}</Card>
        <Card><H right={<Btn v="ghost" onClick={() => go({ page: 'pipelines' })}>All pipelines</Btn>}>Recent pipeline activity</H>
          {pipelines.slice(0, 6).map((p) => (
            <button key={p.id} onClick={() => go({ page: 'pipelines', id: p.id })} className="flex w-full items-center justify-between border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-line/30">
              <span><span className="font-medium">{p.projectId}</span><span className="mono block text-xs text-mute">{p.branch} · {p.commit} · {rel(p.time)}</span></span><Badge s={p.status} />
            </button>))}</Card>
      </div>
      {projects.length > 0 && <Card><H>Needs attention</H>{projects.filter((p) => D.count(p, 'vulnerable') > 0 || p.lastScan === null).slice(0, 4).map((p) => (
        <div key={p.id} className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-0"><span><b>{p.name}</b> <span className="text-sm text-mute">{p.lastScan ? `${D.count(p, 'vulnerable')} vulnerable dependencies` : 'Not scanned yet'}</span></span><Btn onClick={() => scan(p.id)}>Scan dependencies</Btn></div>
      )) || null}{projects.every((p) => D.count(p, 'vulnerable') === 0 && p.lastScan) && <p className="px-4 py-6 text-sm text-mute">Nothing needs attention.</p>}</Card>}
    </div>
  );
}

/* ---------- Projects ---------- */
export function Projects({ s, go, scan, onNew }: { s: Store; go: Go; scan: (id: string) => void; onNew: () => void }) {
  const [q, setQ] = useState('');
  const rows = s.s.projects.filter((p) => (p.name + p.repo + p.tech).toLowerCase().includes(q.toLowerCase()));
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <input className={cx(inputCls, 'max-w-xs')} placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
        <div className="ml-auto"><Btn v="primary" onClick={onNew}>New project</Btn></div>
      </div>
      {s.s.projects.length === 0 ? <Empty title="No projects yet" text="Create a project and paste its manifest to start tracking dependencies." action={<Btn v="primary" onClick={onNew}>New project</Btn>} />
        : rows.length === 0 ? <Empty title="No matching projects" text={`Nothing matches "${q}".`} action={<Btn onClick={() => setQ('')}>Clear search</Btn>} /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-mute"><tr>{['Project', 'Tech', 'Deps', 'Vulnerable', 'Outdated', 'Last scan', 'Pipeline', 'Health', ''].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{rows.map((p) => { const lp = lastPipe(s.s, p.id); return (
            <tr key={p.id} className="cursor-pointer border-t border-line hover:bg-line/30" onClick={() => go({ page: 'project', id: p.id })}>
              <td className="px-4 py-2.5"><b>{p.name}</b><div className="mono text-xs text-mute">{p.repo}</div></td><td className="px-4">{p.tech}</td><td className="px-4 tabular-nums">{p.deps.length}</td>
              <td className={cx('px-4 tabular-nums', D.count(p, 'vulnerable') > 0 && 'font-medium text-bad')}>{p.lastScan ? D.count(p, 'vulnerable') : '—'}</td><td className="px-4 tabular-nums">{p.lastScan ? D.count(p, 'outdated') : '—'}</td>
              <td className="px-4 text-mute">{rel(p.lastScan)}</td><td className="px-4">{lp ? <Badge s={lp.status} /> : <Badge s="pending" label="No runs" />}</td><td className="px-4"><Health p={p} /></td>
              <td className="px-4 text-right"><div className="flex justify-end gap-1.5"><Btn onClick={(e) => { e.stopPropagation(); scan(p.id); }}>Scan</Btn><Btn aria-label={`Delete ${p.name}`} className="text-bad" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${p.name}" and its scans and pipeline runs?`)) s.removeProject(p.id); }}>Delete</Btn></div></td></tr>); })}</tbody>
        </table></div>)}
    </Card>
  );
}

const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block text-sm"><span className="mb-1 block text-mute">{t}</span>{children}</label>;
export function NewProject({ s, onClose, go }: { s: Store; onClose: () => void; go: Go }) {
  const [f, setF] = useState({ name: '', repo: '', tech: 'Node.js' as D.Tech, manifest: '' }); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setErr(''); const r = await s.addProject(f.name, f.repo, f.tech, f.manifest); setBusy(false); if (r.error) return setErr(r.error); onClose(); go({ page: 'project', id: r.id }); };
  return (
    <Modal title="New project" onClose={onClose}><div className="space-y-3">
      <L t="GitHub repository URL (details and manifest are imported)"><input autoFocus className={inputCls} value={f.repo} onChange={(e) => setF({ ...f, repo: e.target.value })} placeholder="https://github.com/owner/repo" /></L>
      <L t="Project name (optional when importing)"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="checkout-service" /></L>
      <L t="Technology"><select className={inputCls} value={f.tech} onChange={(e) => setF({ ...f, tech: e.target.value as D.Tech })}>{(['Node.js', 'Python', 'Java'] as D.Tech[]).map((t) => <option key={t}>{t}</option>)}</select></L>
      <L t="Manifest (optional)"><textarea className={cx(inputCls, 'mono h-28')} value={f.manifest} onChange={(e) => setF({ ...f, manifest: e.target.value })} placeholder={'Paste package.json, or one per line:\nexpress@4.17.1\nlodash@4.17.15\nLeave empty to use a sample manifest.'} /></L>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>Cancel</Btn><Btn v="primary" disabled={busy} onClick={submit}>{busy ? 'Importing…' : 'Create project'}</Btn></div></div></Modal>
  );
}

/* ---------- Dependency table (shared) ---------- */
export function DepTable({ rows, showProject, go }: { rows: { d: D.Dep; p: D.Project }[]; showProject?: boolean; go?: Go }) {
  const [q, setQ] = useState(''), [st, setSt] = useState('all'), [ty, setTy] = useState('all');
  const order: Record<string, number> = { vulnerable: 0, outdated: 1, unscanned: 2, ok: 3 };
  const list = useMemo(() => rows.filter(({ d }) => d.name.toLowerCase().includes(q.toLowerCase()) && (st === 'all' || d.status === st) && (ty === 'all' || d.type === ty)).sort((a, b) => order[a.d.status] - order[b.d.status] || a.d.name.localeCompare(b.d.name)), [rows, q, st, ty]);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <input className={cx(inputCls, 'max-w-xs')} placeholder="Search packages…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search packages" />
        <select className={cx(inputCls, 'w-auto')} value={st} onChange={(e) => setSt(e.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="ok">Up to date</option><option value="outdated">Outdated</option><option value="vulnerable">Vulnerable</option><option value="unscanned">Not scanned</option></select>
        <select className={cx(inputCls, 'w-auto')} value={ty} onChange={(e) => setTy(e.target.value)} aria-label="Filter by type"><option value="all">All types</option><option value="prod">Production</option><option value="dev">Development</option></select>
        <span className="ml-auto text-sm text-mute">{list.length} of {rows.length}</span>
      </div>
      {list.length === 0 ? <Empty title="No dependencies match" text="Try a different search or clear the filters." action={<Btn onClick={() => { setQ(''); setSt('all'); setTy('all'); }}>Clear filters</Btn>} /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-mute"><tr>{['Package', ...(showProject ? ['Project'] : []), 'Current', 'Latest', 'Type', 'Status', 'Security'].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{list.map(({ d, p }) => (
            <tr key={p.id + d.name} className="border-t border-line">
              <td className="px-4 py-2 font-medium">{d.name}</td>
              {showProject && <td className="px-4"><button className="text-accent hover:underline" onClick={() => go?.({ page: 'project', id: p.id })}>{p.name}</button></td>}
              <td className="mono px-4">{d.current}</td><td className="mono px-4 text-mute">{d.latest}</td><td className="px-4 text-mute">{d.type === 'prod' ? 'Production' : 'Development'}</td>
              <td className="px-4"><Badge s={d.status} /></td>
              <td className="px-4 text-xs">{d.adv ? <span><Badge s={d.adv.severity} /> <span className="mono text-mute">{d.adv.id}</span></span> : <span className="text-mute">{d.status === 'unscanned' ? 'Unknown' : 'No known issues'}</span>}</td>
            </tr>))}</tbody>
        </table></div>)}
    </>
  );
}
export const Deps = ({ s, go }: { s: Store; go: Go }) => <Card><DepTable showProject go={go} rows={s.s.projects.flatMap((p) => p.deps.map((d) => ({ d, p })))} /></Card>;

/* ---------- Project detail ---------- */
export function ProjectPage({ s, id, go, scan, test }: { s: Store; id: string; go: Go; scan: (id: string) => void; test: (id: string) => void }) {
  const p = s.s.projects.find((x) => x.id === id);
  const [tab, setTab] = useState('deps');
  if (!p) return <Card><Empty title="Project not found" text="It may have been removed." action={<Btn onClick={() => go({ page: 'projects' })}>Back to projects</Btn>} /></Card>;
  const pipes = s.s.pipelines.filter((x) => x.projectId === id), scans = s.s.scans.filter((x) => x.projectId === id);
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div><button className="text-sm text-mute hover:underline" onClick={() => go({ page: 'projects' })}>← Projects</button><h2 className="text-xl font-semibold">{p.name}</h2>
          <p className="mono text-mute">{p.repo} · {p.tech} · created {rel(p.created)}</p></div>
        <div className="flex gap-2"><Btn className="text-bad" onClick={() => { if (confirm(`Delete "${p.name}" and its scans and pipeline runs?`)) { s.removeProject(id); go({ page: 'projects' }); } }}>Delete</Btn>{p.remote && <Btn onClick={() => test(id)}>Run real tests</Btn>}<Btn onClick={() => { const pid = s.runPipeline(id); go({ page: 'pipelines', id: pid }); }}>Run pipeline</Btn><Btn v="primary" onClick={() => scan(id)}>{p.lastScan ? 'Refresh scan' : 'Scan dependencies'}</Btn></div>
      </Card>
      {p.remote && <Card className="p-4 text-sm"><p>{p.remote.description || 'No description.'}</p><p className="mt-1 text-mute">★ {p.remote.stars} · {p.remote.language || p.tech} · default branch <span className="mono">{p.remote.branch}</span> · last push {rel(p.remote.pushed)} · <a className="text-accent hover:underline" href={`https://${p.remote.url}`} target="_blank" rel="noreferrer">View on GitHub</a></p></Card>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Dependencies" value={p.deps.length} /><Stat label="Vulnerable" value={p.lastScan ? D.count(p, 'vulnerable') : '—'} tone="text-bad" /><Stat label="Outdated" value={p.lastScan ? D.count(p, 'outdated') : '—'} tone="text-warn" />
        <Stat label="Health" value={D.health(p) ?? '—'} /><Stat label="Last scan" value={<span className="text-lg">{rel(p.lastScan)}</span>} />
      </div>
      <Card>
        <div className="flex gap-1 border-b border-line px-3 pt-2">{[['deps', 'Dependencies'], ['pipes', `Pipelines (${pipes.length})`], ['scans', `Scan history (${scans.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cx('border-b-2 px-3 py-2 text-sm', tab === k ? 'border-accent font-medium' : 'border-transparent text-mute hover:text-ink')}>{l}</button>))}</div>
        {tab === 'deps' && (p.deps.length ? <DepTable rows={p.deps.map((d) => ({ d, p }))} /> : <Empty title="No dependencies" text="This project has no manifest entries to scan." />)}
        {tab === 'pipes' && (pipes.length ? pipes.map((x) => <button key={x.id} onClick={() => go({ page: 'pipelines', id: x.id })} className="flex w-full items-center justify-between border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-line/30"><span className="mono">{x.branch} · {x.commit} · {rel(x.time)}</span><Badge s={x.status} /></button>) : <Empty title="No pipeline runs" text="Run a pipeline to build and check this project." />)}
        {tab === 'scans' && (scans.length ? scans.map((x) => <div key={x.id} className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-0"><span>{x.total} deps · {(x.ms / 1000).toFixed(1)}s · {rel(x.time)}</span><span className="flex gap-1.5"><Badge s="vulnerable" label={`${x.vulnerable} vulnerable`} /><Badge s="outdated" label={`${x.outdated} outdated`} /></span></div>) : <Empty title="No scans yet" text="Scan this project to build a history." />)}
      </Card>
    </div>
  );
}

/* ---------- Scan modal ---------- */
const STEPS = ['Reading dependency manifest', 'Resolving latest versions from registry', 'Checking security advisories', 'Building scan report'];
export function ScanModal({ s, pid, onClose }: { s: Store; pid: string; onClose: () => void }) {
  const p = s.s.projects.find((x) => x.id === pid);
  const [step, setStep] = useState(0), [err, setErr] = useState(''), [done, setDone] = useState(false);
  const run = useCallback(() => {
    setStep(0); setErr(''); setDone(false); let i = 0;
    const t = setInterval(() => {
      i++; setStep(Math.min(i, STEPS.length - 1));
      if (i >= STEPS.length) { clearInterval(t); s.completeScan(pid).then((r) => (r.ok ? setDone(true) : setErr(r.error || 'Scan failed.'))); }
    }, 650);
    return t;
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = run(); return () => clearInterval(t); }, [run]);
  if (!p) return null;
  const vul = p.deps.filter((d) => d.status === 'vulnerable'), out = p.deps.filter((d) => d.status === 'outdated');
  return (
    <Modal wide title={`Scan: ${p.name}`} onClose={onClose}>
      {!done && !err && <ul className="space-y-2.5 py-2">{STEPS.map((t, i) => <li key={t} className={cx('flex items-center gap-2 text-sm', i > step && 'text-mute')}><Badge s={i < step ? 'passed' : i === step ? 'running' : 'pending'} label={i < step ? 'Done' : i === step ? 'Running' : 'Queued'} />{t}</li>)}</ul>}
      {err && <div role="alert"><p className="font-medium text-bad">Scan failed</p><p className="mt-1 text-sm text-mute">{err}</p><div className="mt-4 flex gap-2"><Btn v="primary" onClick={run}>Retry scan</Btn><Btn onClick={onClose}>Close</Btn></div></div>}
      {done && <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2 text-center">{[['Scanned', p.deps.length, ''], ['Up to date', p.deps.length - vul.length - out.length, 'text-ok'], ['Outdated', out.length, 'text-warn'], ['Vulnerable', vul.length, 'text-bad']].map(([l, v, c]) => <div key={l as string} className="rounded-md border border-line p-2"><p className={cx('text-xl font-semibold', c as string)}>{v}</p><p className="text-xs text-mute">{l}</p></div>)}</div>
        {vul.length > 0 && <div><h3 className="mb-1 text-sm font-semibold">Vulnerable dependencies</h3>{vul.map((d) => <div key={d.name} className="flex items-center justify-between border-t border-line py-2 text-sm"><span><b>{d.name}</b> <span className="mono text-mute">{d.current} → {d.adv?.fixed}+</span></span><span><Badge s={d.adv!.severity} /> <span className="mono text-xs text-mute">{d.adv!.id}</span></span></div>)}</div>}
        {out.length > 0 && <div><h3 className="mb-1 text-sm font-semibold">Outdated dependencies</h3>{out.map((d) => <div key={d.name} className="flex items-center justify-between border-t border-line py-2 text-sm"><b>{d.name}</b><span className="mono text-mute">{d.current} → {d.latest}</span></div>)}</div>}
        {!vul.length && !out.length && <p className="text-sm text-ok">All dependencies are up to date with no known vulnerabilities.</p>}
        <div className="flex justify-end gap-2"><Btn onClick={onClose}>Close</Btn>{(vul.length > 0 || out.length > 0) && <Btn v="primary" onClick={() => s.applyUpdates(pid)}>Update {vul.length + out.length} packages</Btn>}</div>
      </div>}
    </Modal>
  );
}

/* ---------- Pipelines ---------- */
export function Pipelines({ s, sel, go }: { s: Store; sel?: string; go: Go }) {
  const [pickRaw, setPick] = useState(s.s.projects[0]?.id ?? '');
  const pick = s.s.projects.some((x) => x.id === pickRaw) ? pickRaw : (s.s.projects[0]?.id ?? '');
  const cur = s.s.pipelines.find((x) => x.id === sel) ?? s.s.pipelines[0];
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <div className="flex gap-2 border-b border-line p-3"><select className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Project">{s.s.projects.map((p) => <option key={p.id}>{p.id}</option>)}</select>
          <Btn v="primary" disabled={!pick} onClick={() => go({ page: 'pipelines', id: s.runPipeline(pick) })}>Run</Btn></div>
        {s.s.pipelines.length === 0 ? <Empty title="No pipeline runs" text="Pick a project and run a pipeline." /> : s.s.pipelines.map((x) => (
          <button key={x.id} onClick={() => go({ page: 'pipelines', id: x.id })} className={cx('flex w-full items-center justify-between border-b border-line px-4 py-2.5 text-left hover:bg-line/30', cur?.id === x.id && 'bg-line/40')}>
            <span><b>{x.projectId}</b><span className="mono block text-xs text-mute">{x.branch} · {x.commit} · {x.trigger} · {rel(x.time)}</span></span><Badge s={x.status} /></button>))}
      </Card>
      <Card className="lg:col-span-3">{!cur ? <Empty title="Select a pipeline" text="Open a run to see its stages and logs." /> : (<>
        <H right={<Badge s={cur.status} />}>{cur.projectId} <span className="mono font-normal text-mute">#{cur.commit}</span></H>
        <div className="space-y-3 p-4">{cur.stages.map((g) => (
          <details key={g.name} open={g.status === 'failed' || g.status === 'running'} className="rounded-md border border-line">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-medium">{g.name}<Badge s={g.status} /></summary>
            <pre className="mono overflow-x-auto border-t border-line bg-bg p-3 leading-relaxed text-mute">{g.log.length ? g.log.join('\n') : g.status === 'skipped' ? 'Skipped because an earlier stage failed.' : 'Waiting to start…'}</pre>
          </details>))}</div></>)}
      </Card>
    </div>
  );
}

/* ---------- Monitoring ---------- */
export function Monitoring({ s }: { s: Store }) {
  const [tick, setTick] = useState(0);
  const { scans, pipelines, events, projects } = s.s;
  const scanFail = events.filter((e) => e.kind === 'scan' && e.level === 'error').length;
  const done = pipelines.filter((p) => p.status === 'passed' || p.status === 'failed'), pass = done.filter((p) => p.status === 'passed').length;
  const running = pipelines.some((p) => p.status === 'running');
  const jit = (b: number) => (b + ((tick * 7) % 5) * 0.01).toFixed(2);
  const svc = [['API', `${jit(99.9)}% uptime`, 'ok'], ['Scanner worker', `${scans.length} scans`, 'ok'], ['Registry mirror', `${(110 + ((tick * 13) % 40))} ms latency`, 'ok'], ['Pipeline runner', running ? 'Busy' : 'Idle', running ? 'running' : 'ok']];
  const all = projects.flatMap((p) => p.deps), n = (st: D.Status) => all.filter((d) => d.status === st).length;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Btn onClick={() => setTick((t) => t + 1)}>Refresh</Btn></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{svc.map(([a, b, c]) => <Card key={a} className="p-4"><div className="flex items-center justify-between"><p className="text-sm text-mute">{a}</p><Badge s={c} label={c === 'running' ? 'Active' : 'Healthy'} /></div><p className="mt-2 font-semibold">{b}</p></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-mute">Scan success rate</p><p className="mt-1 text-2xl font-semibold">{scans.length + scanFail ? Math.round((100 * scans.length) / (scans.length + scanFail)) : 100}%</p><p className="text-sm text-mute">{scans.length} succeeded · {scanFail} failed</p></Card>
        <Card className="p-4"><p className="text-sm text-mute">Pipeline pass rate</p><p className="mt-1 text-2xl font-semibold">{done.length ? Math.round((100 * pass) / done.length) : '—'}{done.length ? '%' : ''}</p><p className="text-sm text-mute">{pass} passed · {done.length - pass} failed</p></Card>
        <Card className="p-4"><p className="text-sm text-mute">Dependency health</p><div className="mt-2 flex h-2 overflow-hidden rounded bg-line"><div className="bg-ok" style={{ flex: n('ok') }} /><div className="bg-warn" style={{ flex: n('outdated') }} /><div className="bg-bad" style={{ flex: n('vulnerable') }} /></div><p className="mt-2 text-sm text-mute">{n('ok')} ok · {n('outdated')} outdated · {n('vulnerable')} vulnerable</p></Card>
      </div>
      <Card><H>Recent system activity</H><Feed events={events.slice(0, 8)} /></Card>
    </div>
  );
}

/* ---------- Activity ---------- */
const Feed = ({ events }: { events: D.Ev[] }) => (
  <>{events.map((e) => <div key={e.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0"><span className="flex items-center gap-3"><Badge s={e.level} label={e.kind} />{e.msg}</span><time className="shrink-0 text-xs text-mute" title={new Date(e.time).toLocaleString()}>{rel(e.time)}</time></div>)}</>
);
export function Activity({ s }: { s: Store }) {
  const [f, setF] = useState('all');
  const list = s.s.events.filter((e) => f === 'all' || e.level === f);
  return (
    <Card>
      <div className="flex gap-2 border-b border-line p-3">{['all', 'success', 'info', 'warn', 'error'].map((k) => <Btn key={k} v={f === k ? 'primary' : 'default'} onClick={() => setF(k)}>{k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1)}</Btn>)}</div>
      {list.length ? <Feed events={list} /> : <Empty title="No events" text="Nothing has been logged with this status yet." action={<Btn onClick={() => setF('all')}>Show all</Btn>} />}
    </Card>
  );
}

/* ---------- Real test run (local only) ---------- */
export function TestModal({ s, pid, onClose }: { s: Store; pid: string; onClose: () => void }) {
  const p = s.s.projects.find((x) => x.id === pid);
  const [log, setLog] = useState(''), [state, setState] = useState<'idle' | 'running' | 'passed' | 'failed' | 'error'>('idle'), [err, setErr] = useState('');
  const box = useRef<HTMLPreElement>(null);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [log]);
  const start = async () => {
    if (!p?.remote) return; setLog(''); setErr(''); setState('running');
    try {
      const r = await fetch('/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: p.repo }) });
      if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'The test run could not start.'); }
      const rd = r.body.getReader(), dec = new TextDecoder(); let all = '';
      for (;;) { const { done, value } = await rd.read(); if (done) break; all += dec.decode(value, { stream: true }); setLog(all.replace(/\n*__EXIT__:\d*$/, '')); }
      const ok = /__EXIT__:0$/.test(all.trim()); setState(ok ? 'passed' : 'failed');
      s.log('pipeline', ok ? `Tests passed for ${p.name}` : `Tests failed for ${p.name}`, ok ? 'success' : 'error');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Test run failed.'); setState('error'); }
  };
  if (!p) return null;
  return (
    <Modal wide title={`Run tests: ${p.name}`} onClose={onClose}>
      <p className="text-sm text-mute">This clones <span className="mono">{p.repo}</span> into a temp folder and runs its <span className="mono">npm install</span> and <span className="mono">npm test</span> on your machine. Only run repositories you trust.</p>
      <div className="my-3 flex items-center gap-2"><Btn v="primary" disabled={state === 'running'} onClick={start}>{state === 'idle' ? 'Clone and run tests' : 'Run again'}</Btn>{state !== 'idle' && <Badge s={state === 'error' ? 'failed' : state} label={state === 'error' ? 'Could not run' : undefined} />}</div>
      {err && <p role="alert" className="mb-2 text-sm text-bad">{err}</p>}
      {state !== 'idle' && <pre ref={box} className="mono h-72 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-bg p-3 text-mute">{log || 'Starting…'}</pre>}
    </Modal>
  );
}
