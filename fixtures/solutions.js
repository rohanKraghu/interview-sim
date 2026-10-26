// Reference solutions for test.mjs: a fast one per problem, plus slow or buggy
// ones that the measurement must tell apart. JavaScript and Python.
export const JS = {
  'meeting-rooms': `function minRooms(m) {
  const s = m.map(x => x[0]).sort((a, b) => a - b), e = m.map(x => x[1]).sort((a, b) => a - b);
  let rooms = 0, best = 0, j = 0;
  for (let i = 0; i < s.length; i++) { while (e[j] <= s[i]) { j++; rooms--; } rooms++; best = Math.max(best, rooms); }
  return best;
}`,
  'longest-substring': `function lengthOfLongestSubstring(s) {
  const last = new Map(); let left = 0, best = 0;
  for (let i = 0; i < s.length; i++) { if (last.has(s[i]) && last.get(s[i]) >= left) left = last.get(s[i]) + 1; last.set(s[i], i); best = Math.max(best, i - left + 1); }
  return best;
}`,
  // Map plus a doubly linked list. (Evicting with map.keys().next() is the usual
  // shortcut, but V8 scans deleted slots there, so it measures superlinear.)
  'lru-cache': `class LRUCache {
  constructor(c) { this.c = c; this.m = new Map(); this.h = { k: null }; this.h.p = this.h.n = this.h; }
  unlink(x) { x.p.n = x.n; x.n.p = x.p; }
  front(x) { x.n = this.h.n; x.p = this.h; this.h.n.p = x; this.h.n = x; }
  get(k) { const x = this.m.get(k); if (!x) return -1; this.unlink(x); this.front(x); return x.v; }
  put(k, v) {
    let x = this.m.get(k);
    if (x) { x.v = v; this.unlink(x); } else { x = { k, v }; this.m.set(k, x); }
    this.front(x);
    if (this.m.size > this.c) { const old = this.h.p; this.unlink(old); this.m.delete(old.k); }
  }
}`,
  islands: `function numIslands(g) {
  let n = 0;
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) if (g[r][c] === '1') {
    n++; const st = [[r, c]]; g[r][c] = '0';
    while (st.length) { const [y, x] = st.pop(); for (const [dy, dx] of [[1,0],[-1,0],[0,1],[0,-1]]) { const a = y + dy, b = x + dx; if (a >= 0 && b >= 0 && a < g.length && b < g[0].length && g[a][b] === '1') { g[a][b] = '0'; st.push([a, b]); } } }
  }
  return n;
}`,
  'top-k': `function topKFrequent(nums, k) {
  const c = new Map(); for (const x of nums) c.set(x, (c.get(x) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]).slice(0, k).map(x => x[0]);
}`,
  'merge-k': `function mergeKLists(lists) {
  const vals = []; for (let h of lists) for (; h; h = h.next) vals.push(h.val);
  vals.sort((a, b) => a - b); let head = null;
  for (let i = vals.length - 1; i >= 0; i--) head = new ListNode(vals[i], head);
  return head;
}`,
};

export const JS_SLOW = {
  // Brute force: O(n^2) or worse.
  'longest-substring': `function lengthOfLongestSubstring(s) {
  let best = 0;
  for (let i = 0; i < s.length; i++) { const seen = new Set(); for (let j = i; j < s.length && !seen.has(s[j]); j++) { seen.add(s[j]); best = Math.max(best, j - i + 1); } }
  return best;
}`,
  'lru-cache': `class LRUCache {
  constructor(c) { this.c = c; this.keys = []; this.vals = {}; }
  touch(k) { const i = this.keys.indexOf(k); if (i >= 0) this.keys.splice(i, 1); this.keys.push(k); }
  get(k) { if (!(k in this.vals)) return -1; this.touch(k); return this.vals[k]; }
  put(k, v) { this.vals[k] = v; this.touch(k); if (this.keys.length > this.c) delete this.vals[this.keys.shift()]; }
}`,
};

export const JS_BUGGY = {
  // Treats back-to-back meetings as overlapping.
  'meeting-rooms': JS['meeting-rooms'].replace('e[j] <= s[i]', 'e[j] < s[i]'),
  // Moves the left edge backwards on "abba".
  'longest-substring': JS['longest-substring'].replace(' && last.get(s[i]) >= left', ''),
};

export const PY = {
  'meeting-rooms': `import heapq
def min_rooms(meetings):
    h = []
    for s, e in sorted(meetings):
        if h and h[0] <= s:
            heapq.heapreplace(h, e)
        else:
            heapq.heappush(h, e)
    return len(h)`,
  'longest-substring': `def length_of_longest_substring(s):
    last, left, best = {}, 0, 0
    for i, ch in enumerate(s):
        if last.get(ch, -1) >= left:
            left = last[ch] + 1
        last[ch] = i
        best = max(best, i - left + 1)
    return best`,
  'lru-cache': `from collections import OrderedDict
class LRUCache:
    def __init__(self, capacity):
        self.c, self.d = capacity, OrderedDict()
    def get(self, key):
        if key not in self.d:
            return -1
        self.d.move_to_end(key)
        return self.d[key]
    def put(self, key, value):
        self.d[key] = value
        self.d.move_to_end(key)
        if len(self.d) > self.c:
            self.d.popitem(last=False)`,
  islands: `def num_islands(grid):
    def sink(r, c):
        if 0 <= r < len(grid) and 0 <= c < len(grid[0]) and grid[r][c] == '1':
            grid[r][c] = '0'
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                sink(r + dr, c + dc)
    n = 0
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            if grid[r][c] == '1':
                n += 1
                sink(r, c)
    return n`,
  'top-k': `from collections import Counter
def top_k_frequent(nums, k):
    return [x for x, _ in Counter(nums).most_common(k)]`,
  'merge-k': `import heapq
def merge_k_lists(lists):
    h = [(node.val, i, node) for i, node in enumerate(lists) if node]
    heapq.heapify(h)
    dummy = tail = ListNode()
    while h:
        _, i, node = heapq.heappop(h)
        tail.next = tail = node
        if node.next:
            heapq.heappush(h, (node.next.val, i, node.next))
    return dummy.next`,
};

export const PY_SLOW = {
  'top-k': `def top_k_frequent(nums, k):
    distinct = list(set(nums))
    distinct.sort(key=lambda x: -nums.count(x))
    return distinct[:k]`,
};
