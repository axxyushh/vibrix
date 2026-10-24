import { NextResponse } from 'next/server';
import { cmp, type Dep, type Sev } from '@/lib/data';
export const dynamic = 'force-dynamic';
type In = { name: string; current: string; type: 'prod' | 'dev' };
const SEV: Record<string, Sev> = { low: 'low', moderate: 'moderate', medium: 'moderate', high: 'high', critical: 'critical' };

export async function POST(req: Request) {
  const { tech, deps } = (await req.json()) as { tech: string; deps: In[] };
  if (tech === 'Java') return NextResponse.json({ error: 'Live scanning supports Node.js and Python projects only.' }, { status: 400 });
  const eco = tech === 'Python' ? 'PyPI' : 'npm', list = deps.slice(0, 150);
  try {
    const latest = await Promise.all(list.map(async (d) => {
      try {
        const u = eco === 'npm' ? `https://registry.npmjs.org/${d.name.replace('/', '%2F')}/latest` : `https://pypi.org/pypi/${d.name}/json`;
        const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) return d.current;
        const j = await r.json(); return (eco === 'npm' ? j.version : j.info.version) as string;
      } catch { return d.current; }
    }));
    const osv = await fetch('https://api.osv.dev/v1/querybatch', { method: 'POST', body: JSON.stringify({ queries: list.map((d) => ({ package: { name: d.name, ecosystem: eco }, version: d.current })) }) });
    if (!osv.ok) throw new Error(`OSV.dev returned ${osv.status}`);
    const hits: { id: string }[][] = (await osv.json()).results.map((r: { vulns?: { id: string }[] }) => r.vulns || []);
    const adv = await Promise.all(hits.map(async (v) => {
      if (!v.length) return undefined;
      try {
        const j = await (await fetch(`https://api.osv.dev/v1/vulns/${v[0].id}`)).json();
        const fixed = JSON.stringify(j.affected || []).match(/"fixed":"([^"]+)"/)?.[1] || '?';
        const cve = (j.aliases as string[] | undefined)?.find((a) => a.startsWith('CVE-'));
        return { id: cve || (j.id as string), severity: SEV[String(j.database_specific?.severity || '').toLowerCase()] || 'moderate', fixed };
      } catch { return { id: v[0].id, severity: 'moderate' as Sev, fixed: '?' }; }
    }));
    const out: Dep[] = list.map((d, i) => ({
      name: d.name, current: d.current, latest: latest[i], type: d.type, adv: adv[i],
      status: adv[i] ? 'vulnerable' : cmp(d.current, latest[i]) < 0 ? 'outdated' : 'ok',
    }));
    return NextResponse.json({ deps: out });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Registry lookup failed.' }, { status: 502 }); }
}
