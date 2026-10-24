import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
const H: Record<string, string> = { 'User-Agent': 'vibrix', Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url') || '';
  const m = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$/.exec(url);
  if (!m) return fail('Enter a GitHub URL like https://github.com/owner/repo', 400);
  const [, owner, repo] = m;
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: H, cache: 'no-store' });
    if (r.status === 404) return fail('Repository not found. Private repos need a GITHUB_TOKEN env var.', 404);
    if (!r.ok) return fail(`GitHub returned ${r.status}. If this is a rate limit, set a GITHUB_TOKEN env var.`, 502);
    const j = await r.json();
    const raw = async (f: string) => { const x = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${j.default_branch}/${f}`, { cache: 'no-store', headers: H }); return x.ok ? x.text() : ''; };
    let manifest = await raw('package.json'), tech = 'Node.js';
    if (!manifest) {
      tech = 'Python';
      manifest = (await raw('requirements.txt')).split('\n').map((l) => {
        const x = /^([A-Za-z0-9_.\-]+)\s*(?:==|>=|~=|<=|>|<)\s*(\d[\w.]*)/.exec(l.split('#')[0].trim());
        return x ? `${x[1].toLowerCase()}==${x[2]}` : '';
      }).filter(Boolean).join('\n');
    }
    if (!manifest) return fail('No package.json or requirements.txt found in the repository root.', 422);
    return NextResponse.json({ name: j.name, description: j.description || '', stars: j.stargazers_count, branch: j.default_branch, language: j.language || '', pushed: j.pushed_at, url: `github.com/${owner}/${repo}`, tech, manifest });
  } catch { return fail('Could not reach GitHub. Check your internet connection.', 502); }
}
