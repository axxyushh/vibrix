import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// WARNING: this clones a repo and runs its install/test scripts on THIS machine. Local use only.
export async function POST(req: Request) {
  const deny = (error: string, status: number) => Response.json({ error }, { status });
  if (process.env.ALLOW_TEST_EXECUTION !== 'true') return deny('Test execution is disabled. Start the server with ALLOW_TEST_EXECUTION=true (local use only).', 403);
  if (!['localhost', '127.0.0.1'].includes((req.headers.get('host') || '').split(':')[0])) return deny('Test execution is only allowed from localhost.', 403);
  const { url } = await req.json();
  const m = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(String(url));
  if (!m) return deny('Invalid GitHub URL.', 400);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(c) {
      const out = (t: string) => c.enqueue(enc.encode(t));
      const run = (cmd: string, args: string[], cwd: string, ms: number) => new Promise<number>((res) => {
        const p = spawn(cmd, args, { cwd, shell: process.platform === 'win32', env: { ...process.env, CI: 'true' } });
        const t = setTimeout(() => { out('\n[timed out]\n'); p.kill('SIGKILL'); }, ms);
        p.stdout.on('data', (d) => out(String(d))); p.stderr.on('data', (d) => out(String(d)));
        p.on('error', (e) => { out(`${e}\n`); res(1); }); p.on('close', (code) => { clearTimeout(t); res(code ?? 1); });
      });
      const dir = await mkdtemp(path.join(tmpdir(), 'vibrix-')); let code = 1;
      try {
        const repo = path.join(dir, 'repo');
        out(`$ git clone --depth 1 github.com/${m[1]}/${m[2]}\n`);
        if ((await run('git', ['clone', '--depth', '1', `https://github.com/${m[1]}/${m[2]}.git`, repo], dir, 120000)) === 0) {
          if (existsSync(path.join(repo, 'package.json'))) {
            const pkg = JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8'));
            if (!pkg.scripts?.test) out('\nNo "test" script in package.json — nothing to run.\n');
            else {
              out('\n$ npm install\n');
              if ((await run('npm', ['install', '--no-audit', '--no-fund'], repo, 300000)) === 0) { out('\n$ npm test\n'); code = await run('npm', ['test'], repo, 300000); }
            }
          } else out('\nOnly Node.js test execution is supported right now.\n');
        }
      } catch (e) { out(`\n${e instanceof Error ? e.message : e}\n`); }
      finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); out(`\n__EXIT__:${code}`); c.close(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
