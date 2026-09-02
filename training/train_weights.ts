/**
 * train_weights.ts — fit the threat-score weights on real labelled traffic.
 * =========================================================================
 * The four weights in shared/config.py (0.30 / 0.20 / 0.20 / 0.20) were chosen
 * by hand. This fits them instead, on the NSL-KDD labelled intrusion dataset,
 * and reports how the hand-set weights compare with the learned ones on data
 * neither of them has seen.
 *
 *   Run:  npx esbuild training/train_weights.ts --bundle --platform=node \
 *           --format=esm --outfile=/tmp/tw.mjs && node /tmp/tw.mjs <data-dir>
 *
 * Feature mapping — NSL-KDD is connection-level, our engine is window-level,
 * so these are the closest honest analogues rather than identical quantities:
 *
 *   half-finished connections  <-  serror_rate     (share with SYN errors)
 *   requests arriving          <-  count           (connections in last 2s)
 *   machines connecting        <-  dst_host_srv_diff_host_rate (spread across hosts)
 *   failed attempts            <-  rerror_rate     (share rejected)
 */

import { readFileSync } from 'node:fs';

// NSL-KDD column indices
const C = { count: 22, serror: 24, rerror: 26, hostDiversity: 37, label: 41 };

const LABELS = ['syn', 'traffic', 'source', 'conn'] as const;
/** The weights currently shipped in shared/config.py, renormalised over the four channels. */
const HAND_SET = [0.30, 0.20, 0.20, 0.20].map((w) => w / 0.9);

interface Row { x: number[]; y: number; kind: string; }

function load(path: string): Row[] {
  const out: Row[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const f = line.split(',');
    if (f.length < 43) continue;
    out.push({
      x: [
        +f[C.serror],                          // already 0..1
        Math.min(1, +f[C.count] / 511),        // normalise to 0..1
        +f[C.hostDiversity],                    // already 0..1
        +f[C.rerror],                          // already 0..1
      ],
      y: f[C.label] === 'normal' ? 0 : 1,
      kind: f[C.label],
    });
  }
  return out;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Plain full-batch logistic regression. Four features — no library needed. */
function fit(rows: Row[], epochs = 400, lr = 1.2) {
  const w = [0, 0, 0, 0];
  let b = 0;
  const n = rows.length;
  for (let e = 0; e < epochs; e++) {
    const g = [0, 0, 0, 0];
    let gb = 0;
    for (const r of rows) {
      const err = sigmoid(w[0] * r.x[0] + w[1] * r.x[1] + w[2] * r.x[2] + w[3] * r.x[3] + b) - r.y;
      for (let i = 0; i < 4; i++) g[i] += err * r.x[i];
      gb += err;
    }
    for (let i = 0; i < 4; i++) w[i] -= (lr * g[i]) / n;
    b -= (lr * gb) / n;
  }
  return { w, b };
}

interface Metrics { acc: number; prec: number; rec: number; f1: number; }

function evaluate(rows: Row[], score: (x: number[]) => number, threshold: number): Metrics {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of rows) {
    const pred = score(r.x) >= threshold ? 1 : 0;
    if (pred === 1 && r.y === 1) tp++;
    else if (pred === 1 && r.y === 0) fp++;
    else if (pred === 0 && r.y === 0) tn++;
    else fn++;
  }
  const prec = tp / Math.max(1, tp + fp);
  const rec = tp / Math.max(1, tp + fn);
  return {
    acc: (tp + tn) / rows.length,
    prec, rec,
    f1: (2 * prec * rec) / Math.max(1e-9, prec + rec),
  };
}

/** Best threshold for a scoring function, swept on the training set only. */
function bestThreshold(rows: Row[], score: (x: number[]) => number) {
  let best = { t: 0.5, f1: -1 };
  for (let t = 0.02; t < 1; t += 0.02) {
    const m = evaluate(rows, score, t);
    if (m.f1 > best.f1) best = { t, f1: m.f1 };
  }
  return best.t;
}

// ---------------------------------------------------------------------------

const dir = process.argv[2] ?? '.';
const train = load(`${dir}/train.csv`);
const test = load(`${dir}/test.csv`);

console.log(`train ${train.length.toLocaleString()} rows · test ${test.length.toLocaleString()} rows`);
console.log(`train attack share ${(train.filter(r => r.y).length / train.length * 100).toFixed(1)}%`);
console.log();

// --- what the hand-set weights do ------------------------------------------
const handScore = (x: number[]) => HAND_SET.reduce((s, w, i) => s + w * x[i], 0);
const handT = bestThreshold(train, handScore);
const handM = evaluate(test, handScore, handT);

// --- what fitting gives -----------------------------------------------------
const { w, b } = fit(train);
const learnedScore = (x: number[]) => sigmoid(w.reduce((s, wi, i) => s + wi * x[i], 0) + b);
const learnT = bestThreshold(train, learnedScore);
const learnM = evaluate(test, learnedScore, learnT);

// weights normalised to sum to 1 so they are comparable with config.py
const pos = w.map((v) => Math.max(0, v));
const total = pos.reduce((a, c) => a + c, 0) || 1;
const norm = pos.map((v) => v / total);

console.log('WEIGHTS  (share of the score each signal carries)');
console.log('  signal                     hand-set    fitted');
LABELS.forEach((k, i) => {
  const name = ({ syn: 'half-finished conns', traffic: 'requests arriving', source: 'machines connecting', conn: 'failed attempts' } as Record<string, string>)[k];
  console.log(`  ${name.padEnd(24)}   ${(HAND_SET[i] * 0.9).toFixed(2)}       ${(norm[i] * 0.9).toFixed(2)}`);
});
console.log();
console.log('HELD-OUT PERFORMANCE (test set, never trained on)');
console.log(`  hand-set weights   acc ${(handM.acc * 100).toFixed(1)}%  precision ${(handM.prec * 100).toFixed(1)}%  recall ${(handM.rec * 100).toFixed(1)}%  F1 ${handM.f1.toFixed(3)}`);
console.log(`  fitted weights     acc ${(learnM.acc * 100).toFixed(1)}%  precision ${(learnM.prec * 100).toFixed(1)}%  recall ${(learnM.rec * 100).toFixed(1)}%  F1 ${learnM.f1.toFixed(3)}`);
console.log();

// --- per attack family, using the fitted model ------------------------------
const families: Record<string, string[]> = {
  'SYN flood (neptune)': ['neptune'],
  'Port scan': ['satan', 'ipsweep', 'portsweep', 'nmap', 'mscan', 'saint'],
  'Other DoS': ['smurf', 'back', 'teardrop', 'pod', 'land', 'apache2', 'udpstorm', 'processtable', 'mailbomb'],
  'Credential / R2L': ['guess_passwd', 'warezclient', 'warezmaster', 'ftp_write', 'imap', 'multihop', 'phf', 'spy', 'sendmail', 'named', 'snmpgetattack', 'snmpguess', 'xlock', 'xsnoop', 'httptunnel'],
};
console.log('DETECTION RATE BY ATTACK FAMILY (fitted model, test set)');
for (const [name, kinds] of Object.entries(families)) {
  const rows = test.filter((r) => kinds.includes(r.kind));
  if (!rows.length) continue;
  const caught = rows.filter((r) => learnedScore(r.x) >= learnT).length;
  console.log(`  ${name.padEnd(22)} ${String(rows.length).padStart(6)} samples   caught ${(caught / rows.length * 100).toFixed(1)}%`);
}
