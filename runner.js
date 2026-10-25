// Web worker that runs candidate code. The page kills and replaces it on a
// timeout, which is how infinite loops are stopped.
import { RUNS, measureGrowth, grade, runJsTests, loadJs, pySource } from './execute.js';

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
let pyodide;

async function python(code, run) {
  if (!pyodide) {
    const { loadPyodide } = await import(`${PYODIDE}pyodide.mjs`);
    pyodide = await loadPyodide({ indexURL: PYODIDE });
  }
  const ns = pyodide.globals.get('dict')();
  pyodide.runPython(pySource(code, run), { globals: ns });
  return {
    tests: () => JSON.parse(ns.get('__tests')(JSON.stringify(run.tests.map(([a]) => a)))),
    time: (args) => ns.get('__timed')(JSON.stringify(args)),
  };
}

function javascript(code, run) {
  const call = loadJs(code, run);
  return {
    tests: () => runJsTests(code, run),
    time: (args) => { const t = performance.now(); call(args); return performance.now() - t; },
  };
}

self.onmessage = async ({ data: { id, lang, code, problemId } }) => {
  const run = RUNS[problemId];
  try {
    const exec = lang === 'python' ? await python(code, run) : javascript(code, run);
    const tests = grade(run, exec.tests());
    self.postMessage({ id, tests, ...measureGrowth(exec.time, run) });
  } catch (e) {
    self.postMessage({ id, error: String(e.message || e).trim().split('\n').slice(-1)[0] });
  }
};
