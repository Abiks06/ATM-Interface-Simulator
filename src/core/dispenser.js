// Cash dispenser planning: pick notes from the cassettes so the customer gets the fewest notes
// the inventory allows. Bounded knapsack over $10 units, small enough to solve exactly.

export const DEFAULT_CASSETTES = { 100: 20, 50: 40, 20: 80, 10: 60 };

export function planDispense(amountDollars, cassettes = DEFAULT_CASSETTES) {
  if (!Number.isInteger(amountDollars) || amountDollars <= 0 || amountDollars % 10 !== 0) return null;
  const target = amountDollars / 10;
  const denoms = Object.keys(cassettes).map(Number).sort((a, b) => b - a);

  // best[u] = { count, notes } for the cheapest way found to make u * $10
  let best = new Array(target + 1).fill(null);
  best[0] = { count: 0, notes: {} };
  for (const d of denoms) {
    const unit = d / 10;
    const available = cassettes[d];
    const next = best.slice();
    for (let u = 0; u <= target; u++) {
      if (!best[u]) continue;
      for (let k = 1; k <= available && u + k * unit <= target; k++) {
        const v = u + k * unit;
        const count = best[u].count + k;
        if (!next[v] || count < next[v].count) {
          next[v] = { count, notes: { ...best[u].notes, [d]: k } };
        }
      }
    }
    best = next;
  }
  return best[target];
}

export function takeNotes(cassettes, notes) {
  const out = { ...cassettes };
  for (const [d, n] of Object.entries(notes)) out[d] -= n;
  return out;
}

export function describeNotes(notes) {
  return Object.entries(notes)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([d, n]) => `${n} × $${d}`)
    .join(' + ');
}
