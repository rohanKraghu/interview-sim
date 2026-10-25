// Page side of code running: one worker, replaced when a run times out.
let worker, seq = 0, pyLoaded = false;

export function measure(problemId, lang, code) {
  if (lang !== 'python' && lang !== 'javascript') return Promise.resolve(null);
  if (!code.trim()) return Promise.resolve(null);
  worker ||= new Worker(new URL('./runner.js', import.meta.url), { type: 'module' });
  const id = ++seq;
  // The first Python run downloads Pyodide, so it gets longer.
  const limit = lang === 'python' && !pyLoaded ? 40000 : 10000;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      worker.terminate();
      worker = null;
      if (lang === 'python') pyLoaded = false;
      resolve({ error: `still running after ${limit / 1000}s, probably an infinite loop` });
    }, limit);
    const w = worker;
    w.addEventListener('message', function done({ data }) {
      if (data.id !== id) return;
      w.removeEventListener('message', done);
      clearTimeout(timer);
      if (lang === 'python') pyLoaded = true;
      resolve(data);
    });
    w.postMessage({ id, lang, code, problemId });
  });
}
