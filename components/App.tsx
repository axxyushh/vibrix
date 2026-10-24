'use client';
import React, { useEffect, useState } from 'react';
import { useStore, type Store } from '@/lib/store';
import { Activity, Dashboard, Deps, Monitoring, NewProject, Pipelines, ProjectPage, Projects, ScanModal, TestModal, type Nav } from './pages';
import { Btn, cx } from './ui';

const ITEMS = [['dashboard', 'Dashboard'], ['projects', 'Projects'], ['deps', 'Dependencies'], ['pipelines', 'Pipelines'], ['monitoring', 'Monitoring'], ['activity', 'Activity']];

export default function App() {
  const store = useStore();
  const [nav, setNav] = useState<Nav>({ page: 'dashboard' });
  const [scanId, setScanId] = useState<string | null>(null);
  const [testId, setTestId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [dark, setDark] = useState(true);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  const toggle = () => { const d = !dark; setDark(d); document.documentElement.classList.toggle('dark', d); try { localStorage.setItem('vibrix:theme', d ? 'dark' : 'light'); } catch {} };

  if (!store.s) return <div className="grid h-screen place-items-center text-mute">Loading workspace…</div>;
  const s = store as Store;
  const active = nav.page === 'project' ? 'projects' : nav.page;
  const title = ITEMS.find(([k]) => k === active)?.[1];
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-line bg-panel md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-3 md:py-4"><span className="grid h-6 w-6 place-items-center rounded bg-accent text-sm font-bold text-bg">V</span><b>Vibrix</b></div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">{ITEMS.map(([k, l]) => (
          <button key={k} onClick={() => setNav({ page: k })} className={cx('whitespace-nowrap rounded-md px-3 py-1.5 text-left text-sm', active === k ? 'bg-line/60 font-medium' : 'text-mute hover:bg-line/30 hover:text-ink')}>{l}</button>))}</nav>
        <div className="hidden px-2 pt-6 md:block"><Btn v="ghost" className="w-full justify-start text-mute" onClick={() => { if (confirm('Reset all data to the sample workspace?')) { s.reset(); setNav({ page: 'dashboard' }); } }}>Reset demo data</Btn></div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-line px-4 py-3 md:px-6"><h1 className="text-lg font-semibold">{title}</h1>
          <div className="flex gap-2"><Btn onClick={toggle} aria-label="Toggle theme">{dark ? 'Light' : 'Dark'}</Btn><Btn v="primary" onClick={() => setNewOpen(true)}>New project</Btn></div></header>
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          {nav.page === 'dashboard' && <Dashboard s={s} go={setNav} scan={setScanId} />}
          {nav.page === 'projects' && <Projects s={s} go={setNav} scan={setScanId} onNew={() => setNewOpen(true)} />}
          {nav.page === 'project' && <ProjectPage s={s} id={nav.id!} go={setNav} scan={setScanId} test={setTestId} />}
          {nav.page === 'deps' && <Deps s={s} go={setNav} />}
          {nav.page === 'pipelines' && <Pipelines s={s} sel={nav.id} go={setNav} />}
          {nav.page === 'monitoring' && <Monitoring s={s} />}
          {nav.page === 'activity' && <Activity s={s} />}
        </div>
      </main>
      {scanId && <ScanModal s={s} pid={scanId} onClose={() => setScanId(null)} />}
      {testId && <TestModal s={s} pid={testId} onClose={() => setTestId(null)} />}
      {newOpen && <NewProject s={s} go={setNav} onClose={() => setNewOpen(false)} />}
    </div>
  );
}
