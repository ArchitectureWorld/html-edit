import { getCdpNodeForLocation } from '../dist/cdp-deep-hit-test.js';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate a free port.'));
        return;
      }
      const { port } = address;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error('Chromium executable not found. Set CHROME_BIN.');
}

async function pollJson(url, attempts = 80) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`Timed out fetching ${url}: ${lastError?.message ?? 'unknown error'}`);
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data));
        if (message.id) {
          const pending = this.pending.get(message.id);
          if (!pending) return;
          this.pending.delete(message.id);
          if (message.error) pending.reject(new Error(message.error.message));
          else pending.resolve(message.result);
          return;
        }
        this.events.push(message);
      });
      socket.addEventListener('close', () => {
        for (const pending of this.pending.values()) {
          pending.reject(new Error('CDP socket closed.'));
        }
        this.pending.clear();
      });
    });
  }

  send(method, params = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('CDP socket is not open.'));
    }
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

function terminate(child) {
  if (!child?.pid) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  try { child.kill('SIGTERM'); } catch {}
  setTimeout(() => {
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    try { child.kill('SIGKILL'); } catch {}
  }, 500).unref();
}

function asClassicScript(source) {
  return source
    .replace(/^import\s+[^;]+;\s*$/gm, '')
    .replace(/^export\s+/gm, '');
}

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const chrome = await findChrome();
const cdpPort = await freePort();
const profile = await mkdtemp(path.join(tmpdir(), 'html-edit-chromium-'));
let browser;
let cdp;
let browserStderr = '';

try {
  const [fixtureSource, rankerSource, hitTestSource] = await Promise.all([
    readFile(path.join(root, 'fixtures/browser/index.html'), 'utf8'),
    readFile(path.join(root, 'dist/rank-candidates.js'), 'utf8'),
    readFile(path.join(root, 'dist/browser-hit-test.js'), 'utf8'),
  ]);
  const browserBundle = `${asClassicScript(rankerSource)}\n${asClassicScript(hitTestSource)}`;
  const fixture = fixtureSource.replace(
    '<script type="module">\n    import { hitTestDocument } from \'/dist/browser-hit-test.js\';',
    `<script>\n${browserBundle}`,
  );

  browser = spawn(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${cdpPort}`,
    'about:blank',
  ], {
    detached: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  browser.stderr.on('data', (chunk) => { browserStderr += chunk; });

  const targets = await pollJson(`http://127.0.0.1:${cdpPort}/json/list`);
  const page = targets.find((target) => target.type === 'page');
  if (!page?.webSocketDebuggerUrl) {
    throw new Error(`No debuggable page target found: ${JSON.stringify(targets)}`);
  }

  cdp = new CdpClient(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 1400,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const frameTree = await cdp.send('Page.getFrameTree');
  const frameId = frameTree.frameTree?.frame?.id;
  if (!frameId) throw new Error('Main frame id not found.');
  await cdp.send('Page.setDocumentContent', { frameId, html: fixture });

  await cdp.send('DOM.enable');
  const cdpPointEvaluation = await cdp.send('Runtime.evaluate', {
    expression: `(() => { const rect = document.querySelector('#pointer-none-text').getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`,
    returnByValue: true,
  });
  const cdpPoint = cdpPointEvaluation.result?.value;
  if (!cdpPoint) throw new Error('Could not read CDP pointer-none test point.');
  const cdpHit = await getCdpNodeForLocation({
    sendCommand: (method, params) => cdp.send(method, params),
  }, cdpPoint);
  if (!cdpHit) throw new Error('CDP did not return a node at the pointer-none test point.');
  const described = await cdp.send('DOM.describeNode', { backendNodeId: cdpHit.backendNodeId });
  const attributes = described.node?.attributes ?? [];
  const attributeMap = Object.fromEntries(Array.from({ length: attributes.length / 2 }, (_, index) => [
    attributes[index * 2],
    attributes[index * 2 + 1],
  ]));
  if (attributeMap['data-he-id'] !== 'pointer-none-text') {
    throw new Error(`CDP pointer-events-none hit selected ${attributeMap['data-he-id'] ?? described.node?.nodeName ?? 'unknown'}.`);
  }

  let resultText = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const evaluation = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelector('#results')?.textContent ?? null`,
      returnByValue: true,
    });
    resultText = evaluation.result?.value ?? null;
    if (typeof resultText === 'string' && resultText !== 'RUNNING') break;
    await sleep(50);
  }

  if (resultText !== 'PASS: browser selection golden cases') {
    const diagnostics = cdp.events
      .filter((event) => event.method === 'Runtime.exceptionThrown' || event.method === 'Log.entryAdded')
      .map((event) => JSON.stringify(event.params))
      .join('\n');
    throw new Error([
      `Browser selection test failed: ${String(resultText)}`,
      diagnostics,
      browserStderr,
    ].filter(Boolean).join('\n---\n'));
  }

  console.log(resultText);
} finally {
  cdp?.close();
  terminate(browser);
  await rm(profile, { recursive: true, force: true });
}
