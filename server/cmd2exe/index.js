const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const STUB_PATH = path.join(__dirname, 'stub.exe');
const STUB_SOURCE = path.join(__dirname, 'stub.c');
const MAGIC = Buffer.from('CMD2EXE1');

function ensureCrLf(buf) {
  if (buf.includes(Buffer.from('\r\n'))) return buf;
  return Buffer.from(buf.toString('binary').replace(/\n/g, '\r\n'), 'binary');
}

function findGcc() {
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['gcc'], {
    encoding: 'utf8',
  });
  if (which.status === 0) {
    const first = String(which.stdout || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean);
    if (first) return first;
  }

  const candidates = [
    String.raw`C:\Program Files (x86)\Embarcadero\Dev-Cpp\TDM-GCC-64\bin\gcc.exe`,
    String.raw`C:\Program Files\mingw-w64\x86_64-8.1.0-posix-seh-rt_v6-rev0\mingw64\bin\gcc.exe`,
    String.raw`C:\msys64\mingw64\bin\gcc.exe`,
    'x86_64-w64-mingw32-gcc',
  ];

  for (const candidate of candidates) {
    if (candidate.includes('\\') || candidate.includes('/')) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function buildStub(gccPath) {
  const gcc = gccPath || findGcc();
  if (!gcc) {
    throw new Error('gcc not found; cannot rebuild stub.exe');
  }

  const result = spawnSync(
    gcc,
    [STUB_SOURCE, '-o', STUB_PATH, '-mwindows', '-municode', '-O2', '-s'],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    throw new Error(
      `Failed to build stub.exe:\n${result.stderr || result.stdout || 'unknown error'}`
    );
  }
}

/**
 * Pack a .cmd/.bat script into a silent Windows GUI .exe.
 * Uses a prebuilt PE stub with an appended script trailer (no compiler needed at runtime).
 */
function cmdToExe(cmdContent) {
  if (!fs.existsSync(STUB_PATH)) {
    throw new Error(
      'Missing server/cmd2exe/stub.exe. Run server/cmd2exe/build-stub.cmd once to generate it.'
    );
  }

  let script = Buffer.isBuffer(cmdContent)
    ? Buffer.from(cmdContent)
    : Buffer.from(String(cmdContent), 'utf8');
  script = ensureCrLf(script);

  const length = Buffer.alloc(4);
  length.writeUInt32LE(script.length, 0);

  const stub = fs.readFileSync(STUB_PATH);
  return Buffer.concat([stub, script, length, MAGIC]);
}

module.exports = {
  STUB_PATH,
  cmdToExe,
  buildStub,
  findGcc,
};
