export type Status = 'ok' | 'outdated' | 'vulnerable' | 'unscanned';
export type Sev = 'low' | 'moderate' | 'high' | 'critical';
export type Tech = 'Node.js' | 'Python' | 'Java';
export type PStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export interface Dep { name: string; current: string; latest: string; type: 'prod' | 'dev'; status: Status; adv?: { id: string; severity: Sev; fixed: string } }
export interface Project { id: string; name: string; repo: string; tech: Tech; deps: Dep[]; lastScan: string | null; created: string; remote?: { description: string; stars: number; branch: string; language: string; url: string; pushed: string } }
export interface Stage { name: string; status: PStatus; log: string[] }
export interface Pipeline { id: string; projectId: string; branch: string; commit: string; status: PStatus; stages: Stage[]; time: string; trigger: string }
export interface Scan { id: string; projectId: string; time: string; total: number; outdated: number; vulnerable: number; ms: number }
export interface Ev { id: string; kind: string; msg: string; level: 'success' | 'warn' | 'error' | 'info'; time: string }
export interface State { projects: Project[]; pipelines: Pipeline[]; scans: Scan[]; events: Ev[] }

export const uid = () => Math.random().toString(36).slice(2, 9);
export const hash = () => Math.random().toString(16).slice(2, 9);
export const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();

// Mock package registry + advisory database. Replace with npm/PyPI/OSV calls when you add a backend.
type Adv = { id: string; severity: Sev; below: string };
export const REGISTRY: Record<string, { latest: string; adv?: Adv[] }> = {
  next: { latest: '15.0.3', adv: [{ id: 'CVE-2024-46982', severity: 'high', below: '14.2.10' }] },
  react: { latest: '18.3.1' }, 'react-dom': { latest: '18.3.1' },
  axios: { latest: '1.7.7', adv: [{ id: 'CVE-2024-39338', severity: 'high', below: '1.7.4' }] },
  lodash: { latest: '4.17.21', adv: [{ id: 'CVE-2021-23337', severity: 'high', below: '4.17.21' }] },
  express: { latest: '4.21.1', adv: [{ id: 'CVE-2024-29041', severity: 'moderate', below: '4.19.2' }] },
  jsonwebtoken: { latest: '9.0.2', adv: [{ id: 'CVE-2022-23529', severity: 'critical', below: '9.0.0' }] },
  zod: { latest: '3.23.8' }, typescript: { latest: '5.6.3' }, tailwindcss: { latest: '3.4.14' }, eslint: { latest: '9.14.0' },
  jest: { latest: '29.7.0' }, mongoose: { latest: '8.7.3' }, prisma: { latest: '5.21.1' }, moment: { latest: '2.30.1' },
  vite: { latest: '5.4.10', adv: [{ id: 'CVE-2024-23331', severity: 'moderate', below: '5.0.12' }] },
  numpy: { latest: '2.1.2' }, flask: { latest: '3.0.3' }, pytest: { latest: '8.3.3' }, pyyaml: { latest: '6.0.2' },
  requests: { latest: '2.32.3', adv: [{ id: 'CVE-2024-35195', severity: 'moderate', below: '2.32.0' }] },
  gunicorn: { latest: '23.0.0', adv: [{ id: 'CVE-2024-1135', severity: 'high', below: '22.0.0' }] },
  django: { latest: '5.1.2', adv: [{ id: 'CVE-2024-41989', severity: 'high', below: '4.2.15' }] },
  'spring-boot': { latest: '3.3.5' }, 'jackson-databind': { latest: '2.18.0' },
  'log4j-core': { latest: '2.24.1', adv: [{ id: 'CVE-2021-44228', severity: 'critical', below: '2.17.1' }] }, 'junit-jupiter': { latest: '5.11.3' },
};
export const cmp = (a: string, b: string) => {
  const x = a.split('.').map((n) => parseInt(n) || 0), y = b.split('.').map((n) => parseInt(n) || 0);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
};
export function evaluate(name: string, current: string, type: 'prod' | 'dev'): Dep {
  const r = REGISTRY[name]; const c = current.replace(/^[^\d]*/, '') || '0.0.0';
  if (!r) return { name, current: c, latest: c, type, status: 'ok' };
  const a = r.adv?.find((x) => cmp(c, x.below) < 0);
  const status: Status = a ? 'vulnerable' : cmp(c, r.latest) < 0 ? 'outdated' : 'ok';
  return { name, current: c, latest: r.latest, type, status, adv: a ? { id: a.id, severity: a.severity, fixed: a.below } : undefined };
}
type M = [string, string, 'prod' | 'dev'];
export const TEMPLATES: Record<Tech, M[]> = {
  'Node.js': [['react', '18.2.0', 'prod'], ['express', '4.18.2', 'prod'], ['axios', '1.6.2', 'prod'], ['lodash', '4.17.20', 'prod'], ['typescript', '5.4.5', 'dev'], ['eslint', '9.14.0', 'dev']],
  Python: [['flask', '3.0.0', 'prod'], ['requests', '2.31.0', 'prod'], ['numpy', '1.26.4', 'prod'], ['pytest', '8.3.3', 'dev']],
  Java: [['spring-boot', '3.2.0', 'prod'], ['jackson-databind', '2.17.0', 'prod'], ['log4j-core', '2.14.1', 'prod'], ['junit-jupiter', '5.11.3', 'dev']],
};
export function parseManifest(txt: string): { deps: { name: string; current: string; type: 'prod' | 'dev' }[]; error?: string } {
  const src = txt.trim(); const out: { name: string; current: string; type: 'prod' | 'dev' }[] = [];
  if (src.startsWith('{')) {
    try {
      const j = JSON.parse(src);
      for (const [k, ty] of [['dependencies', 'prod'], ['devDependencies', 'dev']] as const)
        for (const [n, v] of Object.entries<string>(j[k] || {})) out.push({ name: n, current: String(v).replace(/^[^\d]*/, '') || '0.0.0', type: ty });
    } catch { return { deps: [], error: 'Invalid JSON. Paste a package.json, or one "name@version" per line.' }; }
    return { deps: out };
  }
  for (const l of src.split('\n')) { const m = l.trim().match(/^([\w.\-\/]+)\s*(?:==|@|:|\s)\s*v?(\d[\w.\-]*)/); if (m) out.push({ name: m[1], current: m[2], type: 'prod' }); }
  return out.length ? { deps: out } : { deps: [], error: 'No dependencies found. Use one "name@version" per line.' };
}
export const health = (p: Project) => {
  const n = p.deps.length; if (!n || p.deps.every((d) => d.status === 'unscanned')) return null;
  return Math.round((100 * p.deps.reduce((a, d) => a + (d.status === 'ok' ? 1 : d.status === 'outdated' ? 0.5 : 0), 0)) / n);
};
export const count = (p: Project, s: Status) => p.deps.filter((d) => d.status === s).length;

export const STAGES = ['Dependency scan', 'Security scan', 'Tests', 'Build', 'Docker build'];
const CMDS = ['vibrix scan --manifest', 'vibrix audit --fail-on high', 'npm test -- --ci', 'npm run build', 'docker build -t app:latest .'];
export function stageOutcome(i: number, p?: Project): { ok: boolean; log: string[] } {
  const vs = p?.deps.filter((d) => d.status === 'vulnerable') ?? [];
  const bad = vs.filter((d) => d.adv && (d.adv.severity === 'high' || d.adv.severity === 'critical'));
  if (i === 0) return { ok: true, log: [`Resolved ${p?.deps.length ?? 0} dependencies`, `${p?.deps.filter((d) => d.status === 'outdated').length ?? 0} outdated, ${vs.length} vulnerable`] };
  if (i === 1) return bad.length
    ? { ok: false, log: [...bad.map((d) => `✖ ${d.name}@${d.current} ${d.adv!.id} (${d.adv!.severity}) — fixed in ${d.adv!.fixed}`), 'Policy: high/critical vulnerabilities are not allowed', 'Exit code 1'] }
    : { ok: true, log: ['No high or critical vulnerabilities found', 'Policy check passed'] };
  if (i === 2) return { ok: true, log: ['Test suites: 12 passed, 12 total', 'Tests: 84 passed, 84 total'] };
  if (i === 3) return { ok: true, log: ['Compiled successfully', 'Output size: 2.4 MB'] };
  return { ok: true, log: [`Image built: ${p?.name ?? 'app'}:latest`, 'Pushed 7 layers'] };
}
export const stageCmd = (i: number) => `$ ${CMDS[i]}`;
function mkPipeline(p: Project, minsAgo: number, trigger: string): Pipeline {
  let failed = false;
  const stages: Stage[] = STAGES.map((name, i) => {
    if (failed) return { name, status: 'skipped' as PStatus, log: [] };
    const o = stageOutcome(i, p); if (!o.ok) failed = true;
    return { name, status: (o.ok ? 'passed' : 'failed') as PStatus, log: [stageCmd(i), ...o.log] };
  });
  return { id: uid(), projectId: p.id, branch: 'main', commit: hash(), status: failed ? 'failed' : 'passed', stages, time: ago(minsAgo), trigger };
}
const mk = (name: string, tech: Tech, m: M[], scanned: number | null, created: number): Project => ({
  id: name, name, repo: `github.com/acme/${name}`, tech, created: ago(created), lastScan: scanned === null ? null : ago(scanned),
  deps: m.map(([n, v, t]) => evaluate(n, v, t)),
});
export function seed(): State {
  const projects = [
    mk('storefront-web', 'Node.js', [['next', '14.2.3', 'prod'], ['react', '18.2.0', 'prod'], ['axios', '1.6.8', 'prod'], ['lodash', '4.17.20', 'prod'], ['zod', '3.22.4', 'prod'], ['tailwindcss', '3.4.1', 'dev'], ['typescript', '5.4.5', 'dev'], ['eslint', '8.57.0', 'dev'], ['jest', '29.7.0', 'dev']], 35, 9000),
    mk('payments-api', 'Node.js', [['express', '4.18.2', 'prod'], ['jsonwebtoken', '8.5.1', 'prod'], ['mongoose', '8.7.3', 'prod'], ['zod', '3.23.8', 'prod'], ['prisma', '5.10.0', 'prod'], ['moment', '2.29.4', 'prod'], ['jest', '29.7.0', 'dev']], 130, 7000),
    mk('ml-pipeline', 'Python', [['numpy', '1.26.4', 'prod'], ['requests', '2.31.0', 'prod'], ['pyyaml', '6.0.1', 'prod'], ['flask', '3.0.3', 'prod'], ['gunicorn', '21.2.0', 'prod'], ['pytest', '8.3.3', 'dev']], 600, 5000),
    mk('ledger-service', 'Java', [['spring-boot', '3.3.5', 'prod'], ['jackson-databind', '2.17.0', 'prod'], ['log4j-core', '2.24.1', 'prod'], ['junit-jupiter', '5.11.3', 'dev']], 1500, 3000),
  ];
  const pipelines = [mkPipeline(projects[0], 28, 'push'), mkPipeline(projects[1], 125, 'push'), mkPipeline(projects[2], 590, 'schedule'), mkPipeline(projects[3], 1490, 'push'), mkPipeline(projects[0], 2900, 'push')];
  const scans: Scan[] = [];
  [35, 130, 600, 1500, 1800, 2900, 3300, 4400, 5800, 7300, 8700].forEach((m, i) => { const p = projects[i % 4]; scans.push({ id: uid(), projectId: p.id, time: ago(m), total: p.deps.length, outdated: count(p, 'outdated'), vulnerable: count(p, 'vulnerable'), ms: 2100 + i * 130 }); });
  const events: Ev[] = [
    { id: uid(), kind: 'scan', msg: 'Dependency scan completed for storefront-web', level: 'success', time: ago(35) },
    { id: uid(), kind: 'vuln', msg: '2 vulnerable dependencies detected in storefront-web', level: 'warn', time: ago(35) },
    { id: uid(), kind: 'pipeline', msg: 'Build failed on storefront-web (Security scan)', level: 'error', time: ago(28) },
    { id: uid(), kind: 'scan', msg: 'Dependency scan completed for payments-api', level: 'success', time: ago(130) },
    { id: uid(), kind: 'vuln', msg: 'Critical advisory CVE-2022-23529 detected in payments-api', level: 'error', time: ago(131) },
    { id: uid(), kind: 'update', msg: 'Dependency updated: pyyaml in ml-pipeline', level: 'info', time: ago(700) },
    { id: uid(), kind: 'pipeline', msg: 'Pipeline completed for ledger-service', level: 'success', time: ago(1490) },
    { id: uid(), kind: 'project', msg: 'Project created: ledger-service', level: 'info', time: ago(3000) },
  ];
  return { projects, pipelines, scans, events };
}
