/** longest-path ranks of keys along directed pairs, ignoring pairs that close a cycle */
export const rankKeys = (
  keys: readonly string[],
  pairs: readonly (readonly [string, string])[],
) => {
  const out = new Map<string, string[]>(keys.map((key) => [key, []]));
  for (const [from, to] of pairs) {
    if (out.has(from) && out.has(to) && from !== to) {
      out.get(from)!.push(to);
    }
  }
  const state = new Map<string, 0 | 1 | 2>();
  const dag = new Map<string, string[]>(keys.map((key) => [key, []]));
  const visit = (key: string) => {
    state.set(key, 1);
    for (const target of out.get(key)!) {
      const visitState = state.get(target) ?? 0;
      if (visitState === 1) {
        continue; // back edge
      }
      dag.get(key)!.push(target);
      if (visitState === 0) {
        visit(target);
      }
    }
    state.set(key, 2);
  };
  const hasIncoming = new Set(pairs.map(([, to]) => to));
  for (const key of keys.filter(
    (candidateKey) => !hasIncoming.has(candidateKey),
  )) {
    if (!state.get(key)) {
      visit(key);
    }
  }
  for (const key of keys) {
    if (!state.get(key)) {
      visit(key);
    }
  }
  const rank = new Map<string, number>(keys.map((key) => [key, 0]));
  // relax along the DAG until stable (small graphs)
  for (let pass = 0; pass < keys.length; pass++) {
    let changed = false;
    for (const [key, targets] of dag) {
      for (const target of targets) {
        if (rank.get(target)! < rank.get(key)! + 1) {
          rank.set(target, rank.get(key)! + 1);
          changed = true;
        }
      }
    }
    if (!changed) {
      break;
    }
  }
  return rank;
};
