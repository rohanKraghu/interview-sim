// Running candidate code: hidden tests, growth measurement, and the per-problem
// specs both need. No DOM here; the browser runs this inside runner.js (a worker)
// and test.mjs runs it under Node.

export const LANGS = {
  python: { label: 'Python' },
  javascript: { label: 'JavaScript' },
  other: { label: 'Other (not run)' },
};

// Seeded so every measurement of the same problem uses the same inputs.
export function rng(seed = 1) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
const int = (rand, hi) => Math.floor(rand() * hi);

// kind: fn (call entry with args), ops (class with a list of method calls),
// linked (lists in, linked lists to the entry, linked list out).
export const RUNS = {
  'meeting-rooms': {
    kind: 'fn', py: 'min_rooms', js: 'minRooms', params: 'meetings',
    tests: [
      [[[[0, 30], [5, 10], [15, 20]]], 2],
      [[[]], 0],
      [[[[7, 10]]], 1],
      [[[[1, 2], [2, 3]]], 1],
      [[[[1, 5], [1, 5], [1, 5]]], 3],
      [[[[1, 10], [2, 3], [4, 5], [6, 7]]], 2],
      [[[[5, 8], [1, 3], [2, 6], [7, 9]]], 2],
      [[[[0, 1], [0, 2], [0, 3], [1, 4]]], 3],
    ],
    gen: (n, r) => [Array.from({ length: n }, () => { const s = int(r, 10 * n); return [s, s + 1 + int(r, 50)]; })],
    sizeNote: 'n = number of meetings',
  },
  'longest-substring': {
    kind: 'fn', py: 'length_of_longest_substring', js: 'lengthOfLongestSubstring', params: 's',
    tests: [['abcabcbb', 3], ['', 0], ['bbbbb', 1], ['pwwkew', 3], ['abba', 2], ['dvdf', 3], [' ', 1], ['tmmzuxt', 5]].map(([s, e]) => [[s], e]),
    // Few repeats, so a brute force that stops at the first repeat still does n^2 work.
    gen: (n) => { const m = Math.min(n, 50000); return [Array.from({ length: n }, (_, i) => String.fromCharCode(0x100 + ((i * 7919) % m))).join('')]; },
    sizeNote: 'n = string length, almost no repeated characters',
  },
  'lru-cache': {
    kind: 'ops', py: 'LRUCache', js: 'LRUCache', params: 'capacity',
    tests: [
      [[[['LRUCache', 2], ['put', 1, 1], ['put', 2, 2], ['get', 1], ['put', 3, 3], ['get', 2], ['put', 4, 4], ['get', 1], ['get', 3], ['get', 4]]],
        [null, null, null, 1, null, -1, null, -1, 3, 4]],
      [[[['LRUCache', 2], ['put', 1, 1], ['put', 2, 2], ['put', 1, 10], ['put', 3, 3], ['get', 2], ['get', 1]]], [null, null, null, null, null, -1, 10]],
      [[[['LRUCache', 2], ['put', 1, 1], ['put', 2, 2], ['get', 1], ['put', 3, 3], ['get', 1], ['get', 2]]], [null, null, null, 1, null, 1, -1]],
      [[[['LRUCache', 1], ['put', 1, 1], ['put', 2, 2], ['get', 1], ['get', 2]]], [null, null, null, -1, 2]],
      [[[['LRUCache', 1], ['get', 5]]], [null, -1]],
    ],
    gen: (n, r) => [[['LRUCache', Math.max(1, Math.floor(n / 10))],
      ...Array.from({ length: n }, () => (r() < 0.5 ? ['put', int(r, n >> 1), 1] : ['get', int(r, n >> 1)]))]],
    sizeNote: 'n = number of get/put calls, capacity n/10',
  },
  islands: {
    kind: 'fn', py: 'num_islands', js: 'numIslands', params: 'grid',
    tests: [
      [[[['1', '1', '0', '0'], ['1', '0', '0', '1'], ['0', '0', '1', '1']]], 2],
      [[[['0']]], 0],
      [[[['1']]], 1],
      [[[['1', '0'], ['0', '1']]], 2],
      [[[['1', '1', '1'], ['1', '1', '1'], ['1', '1', '1']]], 1],
      [[[['1', '0', '1', '0', '1']]], 3],
      [[[['1', '0', '1'], ['1', '0', '1'], ['1', '1', '1']]], 1],
    ],
    gen: (n, r) => { const w = Math.max(2, Math.round(Math.sqrt(n))); return [Array.from({ length: w }, () => Array.from({ length: w }, () => (r() < 0.45 ? '1' : '0')))]; },
    sizeNote: 'n = number of grid cells (square grid, 45% land)',
  },
  'top-k': {
    kind: 'fn', py: 'top_k_frequent', js: 'topKFrequent', params: 'nums, k', unordered: true,
    tests: [
      [[[1, 1, 1, 2, 2, 3], 2], [1, 2]],
      [[[1], 1], [1]],
      [[[4, 4, -1, -1, -1, 2], 1], [-1]],
      [[[5, 5, 6, 6, 6, 7, 7, 7, 7], 3], [5, 6, 7]],
      [[[3, 0, 1, 0], 1], [0]],
    ],
    gen: (n, r) => [Array.from({ length: n }, () => int(r, Math.max(4, n >> 2))), 10],
    sizeNote: 'n = array length, n/4 distinct values, k = 10',
  },
  'merge-k': {
    kind: 'linked', py: 'merge_k_lists', js: 'mergeKLists', params: 'lists',
    tests: [
      [[[[1, 4, 5], [1, 3, 4], [2, 6]]], [1, 1, 2, 3, 4, 4, 5, 6]],
      [[[]], []],
      [[[[]]], []],
      [[[[], [1]]], [1]],
      [[[[2, 2], [2], [1, 2]]], [1, 2, 2, 2, 2]],
      [[[[-3, 0], [-5], [10]]], [-5, -3, 0, 10]],
    ],
    gen: (n, r) => {
      const k = Math.max(1, Math.round(Math.sqrt(n)));
      return [Array.from({ length: k }, () => Array.from({ length: Math.ceil(n / k) }, () => int(r, 1e6)).sort((a, b) => a - b))];
    },
    sizeNote: 'n = total nodes, k = sqrt(n) lists',
  },
};

export function starter(problemId, lang) {
  const r = RUNS[problemId];
  if (!r || lang === 'other') return '';
  const linked = lang === 'python'
    ? '# class ListNode:\n#     def __init__(self, val=0, next=None): ...\n\n'
    : '// class ListNode { constructor(val = 0, next = null) { ... } }\n\n';
  if (r.kind === 'ops') {
    return lang === 'python'
      ? 'class LRUCache:\n    def __init__(self, capacity):\n        pass\n\n    def get(self, key):\n        pass\n\n    def put(self, key, value):\n        pass\n'
      : 'class LRUCache {\n  constructor(capacity) {\n  }\n\n  get(key) {\n  }\n\n  put(key, value) {\n  }\n}\n';
  }
  return (r.kind === 'linked' ? linked : '') + (lang === 'python'
    ? `def ${r.py}(${r.params}):\n    pass\n`
    : `function ${r.js}(${r.params}) {\n}\n`);
}

// JavaScript: the candidate's code runs in its own function scope so it can
// declare anything, including its own ListNode.
class ListNode { constructor(val = 0, next = null) { this.val = val; this.next = next; } }
const toList = (h) => { const out = []; for (let i = 0; h && i < 1e7; i++, h = h.next) out.push(h.val); return out; };
const fromList = (a) => a.reduceRight((next, val) => new ListNode(val, next), null);

export function loadJs(code, run) {
  const name = run.js;
  // eslint-disable-next-line no-new-func
  const get = new Function('ListNode', `return (function () {\n${code}\n;return typeof ${name} === 'undefined' ? undefined : ${name};\n})();`);
  const entry = get(ListNode);
  if (typeof entry !== 'function') throw new Error(`${name} is not defined`);
  return (args) => {
    if (run.kind === 'fn') return entry(...args);
    if (run.kind === 'linked') return toList(entry(args[0].map(fromList)));
    const [[, ...ctor], ...ops] = args[0];
    const obj = new entry(...ctor);
    return [null, ...ops.map(([m, ...a]) => { const v = obj[m](...a); return v === undefined ? null : v; })];
  };
}

// Python: a prelude, the candidate's code, then adapters with dunder names.
export function pySource(code, run) {
  return `from typing import *
import json as __json, time as __time

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

${code}

def __to_list(h):
    out = []
    while h is not None and len(out) < 10**7:
        out.append(h.val)
        h = h.next
    return out

def __from_list(a):
    head = None
    for v in reversed(a):
        head = ListNode(v, head)
    return head

def __call(args):
    kind, name = ${JSON.stringify(run.kind)}, ${JSON.stringify(run.py)}
    entry = globals()[name]
    if kind == 'fn':
        return entry(*args)
    if kind == 'linked':
        return __to_list(entry([__from_list(a) for a in args[0]]))
    ops = args[0]
    obj = entry(*ops[0][1:])
    return [None] + [getattr(obj, op[0])(*op[1:]) for op in ops[1:]]

def __tests(cases_json):
    out = []
    for args in __json.loads(cases_json):
        try:
            out.append({'got': __call(args)})
        except BaseException as e:
            out.append({'error': type(e).__name__ + ': ' + str(e)})
    return __json.dumps(out)

def __timed(args_json):
    args = __json.loads(args_json)
    t = __time.perf_counter()
    __call(args)
    return (__time.perf_counter() - t) * 1000
`;
}

const norm = (v, unordered) => JSON.stringify(unordered && Array.isArray(v) ? [...v].sort((a, b) => a - b) : v);

// results: [{got} | {error}] in test order.
export function grade(run, results) {
  const failed = [];
  run.tests.forEach(([args, expected], i) => {
    const r = results[i] || { error: 'no result' };
    if (r.error || norm(r.got, run.unordered) !== norm(expected, run.unordered)) failed.push({ args, expected, ...r });
  });
  return { passed: run.tests.length - failed.length, total: run.tests.length, failed };
}

export function runJsTests(code, run) {
  const call = loadJs(code, run);
  return run.tests.map(([args]) => {
    try { return { got: call(structuredClone(args)) }; } catch (e) { return { error: `${e.name}: ${e.message}` }; }
  });
}

// Times one call per doubling size until a run is slow or the budget is spent.
// time(args) returns milliseconds. Short runs take the fastest of three tries,
// which cuts timer and garbage-collector noise.
export function measureGrowth(time, run, { slowRunMs = 300, budgetMs = 3000, maxN = 1 << 18 } = {}) {
  const points = [];
  let total = 0;
  // Warm up so a JIT compiling mid-run does not bend the curve.
  try { for (let i = 0; i < 3; i++) time(run.gen(256, rng(i + 1))); } catch {}
  for (let n = 256; n <= maxN; n *= 2) {
    let ms;
    try {
      ms = time(run.gen(n, rng(n)));
      for (let i = 0; i < 2 && ms < 100; i++) ms = Math.min(ms, time(run.gen(n, rng(n))));
    } catch (e) {
      points.push({ n, error: String(e.message || e).trim().split('\n').pop() });
      break;
    }
    points.push({ n, ms });
    total += ms;
    if (ms > slowRunMs || total > budgetMs) break;
  }
  return { points, slope: fitSlope(points.filter((p) => !p.error)) };
}

// Slope of log(time) against log(n) over the four largest sizes: the median of
// the pairwise slopes, so one garbage-collector pause cannot bend it. Runs under
// 1 ms are mostly noise, so they are dropped.
export function fitSlope(points) {
  const pts = points.filter((p) => p.ms >= 1).slice(-4);
  if (pts.length < 3) return null;
  const slopes = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    slopes.push(Math.log(pts[j].ms / pts[i].ms) / Math.log(pts[j].n / pts[i].n));
  }
  slopes.sort((x, y) => x - y);
  const m = slopes.length >> 1;
  return slopes.length % 2 ? slopes[m] : (slopes[m - 1] + slopes[m]) / 2;
}

export function describeGrowth(slope) {
  if (slope == null) return 'too fast to measure at these sizes';
  // Linear code on real hardware often fits as high as n^1.5 once its data
  // outgrows the CPU caches, so the linear band is wide.
  if (slope < 1.6) return 'close to linear (n or n log n; timing cannot separate the two)';
  if (slope < 1.85) return 'grows clearly faster than linear (likely n^1.5 or quadratic)';
  if (slope < 2.4) return 'about quadratic';
  return 'worse than quadratic';
}

// One line of evidence for the interviewer's prompt.
export function evidenceText(problemId, m) {
  if (!m) return '';
  if (m.error) return `MEASURED: the code could not be run (${m.error}).`;
  const r = RUNS[problemId];
  const t = m.tests;
  const fails = t.failed.slice(0, 2).map((f) =>
    `input ${JSON.stringify(f.args).slice(0, 120)} expected ${JSON.stringify(f.expected)}, ${f.error ? `raised ${f.error.slice(0, 120)}` : `got ${JSON.stringify(f.got).slice(0, 80)}`}`).join('; ');
  const pts = m.points.filter((p) => p.ms >= 1);
  const growth = m.points.length
    ? ` Timing (${r.sizeNote}): ${pts.map((p) => `n=${p.n} ${p.ms.toFixed(1)}ms`).join(', ') || 'every run under 1 ms'}${m.points.at(-1).error ? `, then failed at n=${m.points.at(-1).n} (${m.points.at(-1).error.slice(0, 80)})` : ''}. Fitted growth n^${m.slope == null ? '?' : m.slope.toFixed(2)}: ${describeGrowth(m.slope)}.`
    : '';
  return `MEASURED on their current code: ${t.passed} of ${t.total} hidden tests passed${fails ? ` (failed: ${fails})` : ''}.${growth}`;
}
