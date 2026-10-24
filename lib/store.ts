'use client';
import { useEffect, useRef, useState } from 'react';
import * as D from './data';

const KEY = 'vibrix:v1';
export function useStore() {
  const [state, setState] = useState<D.State | null>(null);
  const ref = useRef<D.State | null>(null);
  useEffect(() => {
    let s: D.State | null = null;
    try { const raw = localStorage.getItem(KEY); if (raw) s = JSON.parse(raw); } catch {}
    setState(s ?? D.seed());
  }, []);
  useEffect(() => {
    ref.current = state;
    if (state) try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);
  const set = (f: (s: D.State) => D.State) => setState((s) => (s ? f(s) : s));
  const ev = (s: D.State, kind: string, msg: string, level: D.Ev['level']): D.State => ({
    ...s, events: [{ id: D.uid(), kind, msg, level, time: new Date().toISOString() }, ...s.events].slice(0, 100),
  });

  const addProject = async (name: string, repo: string, tech: D.Tech, manifest: string): Promise<{ id?: string; error?: string }> => {
    let remote: D.Project['remote'], text = manifest, nm = name, tc = tech;
    if (/github\.com\/[^/\s]+\/[^/\s]+/.test(repo)) {
      try {
        const r = await fetch('/api/repo?url=' + encodeURIComponent(repo)); const j = await r.json();
        if (!r.ok) return { error: j.error || 'Could not read the repository.' };
        remote = { description: j.description, stars: j.stars, branch: j.branch, language: j.language, url: j.url, pushed: j.pushed };
        if (!text.trim()) text = j.manifest; if (!nm.trim()) nm = j.name; tc = j.tech;
      } catch { return { error: 'Could not reach the import API. Is the dev server running?' }; }
    }
    const slug = nm.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) return { error: 'Enter a project name or a GitHub URL.' };
    if (ref.current?.projects.some((p) => p.id === slug)) return { error: `A project named "${slug}" already exists.` };
    let list: { name: string; current: string; type: 'prod' | 'dev' }[];
    if (text.trim()) { const r = D.parseManifest(text); if (r.error) return { error: r.error }; list = r.deps; }
    else list = D.TEMPLATES[tc].map(([n, v, t]) => ({ name: n, current: v, type: t }));
    const p: D.Project = {
      id: slug, name: slug, tech: tc, repo: remote?.url || repo.trim() || `github.com/acme/${slug}`, remote, lastScan: null, created: new Date().toISOString(),
      deps: list.map((d) => ({ ...d, latest: '—', status: 'unscanned' as D.Status })),
    };
    set((s) => ev({ ...s, projects: [p, ...s.projects] }, 'project', `Project created: ${slug}${remote ? ' (imported from GitHub)' : ''}`, 'info'));
    return { id: slug };
  };

  const completeScan = async (pid: string): Promise<{ ok: boolean; error?: string }> => {
    const t0 = Date.now(); const p = ref.current?.projects.find((x) => x.id === pid);
    if (!p) return { ok: false, error: 'Project not found.' };
    const failScan = (msg: string) => { set((s) => ev(s, 'scan', `Dependency scan failed for ${p.name}: ${msg}`, 'error')); return { ok: false, error: msg }; };
    if (!p.deps.length) return failScan('no dependencies found. Add dependencies and try again.');
    let deps: D.Dep[];
    if (p.remote) {
      try {
        const r = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tech: p.tech, deps: p.deps.map(({ name, current, type }) => ({ name, current, type })) }) });
        const j = await r.json(); if (!r.ok) return failScan(j.error || 'registry lookup failed.'); deps = j.deps;
      } catch { return failScan('could not reach the scan API.'); }
    } else deps = p.deps.map((d) => D.evaluate(d.name, d.current, d.type));
    const ms = Date.now() - t0;
    const out = deps.filter((d) => d.status === 'outdated').length, vul = deps.filter((d) => d.status === 'vulnerable').length;
    const now = new Date().toISOString();
    set((s) => {
      let n: D.State = {
        ...s, projects: s.projects.map((x) => (x.id === pid ? { ...x, deps, lastScan: now } : x)),
        scans: [{ id: D.uid(), projectId: pid, time: now, total: deps.length, outdated: out, vulnerable: vul, ms }, ...s.scans],
      };
      n = ev(n, 'scan', `Dependency scan completed for ${p.name}`, 'success');
      if (vul) n = ev(n, 'vuln', `${vul} vulnerable ${vul === 1 ? 'dependency' : 'dependencies'} detected in ${p.name}`, 'warn');
      return n;
    });
    return { ok: true };
  };

  const applyUpdates = (pid: string) => {
    const p = ref.current?.projects.find((x) => x.id === pid); if (!p) return;
    const n = p.deps.filter((d) => d.status === 'outdated' || d.status === 'vulnerable').length;
    set((s) => ev({
      ...s, projects: s.projects.map((x) => x.id === pid ? { ...x, deps: x.deps.map((d) => d.status === 'outdated' || d.status === 'vulnerable' ? { ...d, current: d.latest, status: 'ok' as D.Status, adv: undefined } : d) } : x),
    }, 'update', `Dependency updated: ${n} packages in ${p.name}`, 'info'));
  };

  const runPipeline = (pid: string): string => {
    const p = ref.current?.projects.find((x) => x.id === pid); if (!p) return '';
    const id = D.uid();
    const stages: D.Stage[] = D.STAGES.map((name) => ({ name, status: 'pending', log: [] }));
    set((s) => ev({ ...s, pipelines: [{ id, projectId: pid, branch: 'main', commit: D.hash(), status: 'running', stages, time: new Date().toISOString(), trigger: 'manual' }, ...s.pipelines] }, 'pipeline', `Pipeline started for ${p.name}`, 'info'));
    const patch = (i: number, st: D.PStatus, log: string[]) => set((s) => ({
      ...s, pipelines: s.pipelines.map((x) => x.id === id ? { ...x, stages: x.stages.map((g, k) => k === i ? { ...g, status: st, log } : g) } : x),
    }));
    const finish = (ok: boolean, failedAt?: number) => set((s) => {
      const n = { ...s, pipelines: s.pipelines.map((x) => x.id === id ? { ...x, status: (ok ? 'passed' : 'failed') as D.PStatus, stages: x.stages.map((g, k) => !ok && k > (failedAt ?? 99) ? { ...g, status: 'skipped' as D.PStatus } : g) } : x) };
      return ev(n, 'pipeline', ok ? `Pipeline completed for ${p.name}` : `Build failed on ${p.name} (${D.STAGES[failedAt ?? 0]})`, ok ? 'success' : 'error');
    });
    const step = (i: number) => {
      if (i >= D.STAGES.length) return finish(true);
      patch(i, 'running', [D.stageCmd(i)]);
      setTimeout(() => {
        const o = D.stageOutcome(i, ref.current?.projects.find((x) => x.id === pid));
        patch(i, o.ok ? 'passed' : 'failed', [D.stageCmd(i), ...o.log]);
        o.ok ? step(i + 1) : finish(false, i);
      }, 1100);
    };
    setTimeout(() => step(0), 300);
    return id;
  };

  const removeProject = (pid: string) => set((s) => ev({ ...s, projects: s.projects.filter((p) => p.id !== pid), pipelines: s.pipelines.filter((p) => p.projectId !== pid), scans: s.scans.filter((x) => x.projectId !== pid) }, 'project', `Project deleted: ${pid}`, 'info'));
  const reset = () => setState(D.seed());
  const log = (kind: string, msg: string, level: D.Ev['level']) => set((s) => ev(s, kind, msg, level));
  return { s: state, addProject, completeScan, applyUpdates, runPipeline, reset, log, removeProject };
}
export type Store = ReturnType<typeof useStore> & { s: D.State };
