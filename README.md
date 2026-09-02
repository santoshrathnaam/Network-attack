# SIH26153 Predictive Cyber Defence

Built for NTRO / Smart India Hackathon problem statement SIH26153.

The system watches network traffic, notices when it stops behaving the way that
network normally behaves, and — this is the part that matters — works out what
to do about it by playing each possible response forward and comparing how much
danger is left over.

Detecting an anomaly is not the hard part. Deciding whether taking a server
offline is worth the disruption is.


## What it actually does

Four measurements are taken from traffic in fixed time windows:

- the share of connections opened but never completed (SYN ratio)
- how many requests are arriving
- how many distinct machines are connecting
- how many attempts are failing

Each is compared against what that particular network usually does. The
distance from normal, measured in standard deviations and capped at six,
becomes a score between 0 and 1. Those four scores are weighted and added into
a single threat score, which maps onto a five-stage progression from normal to
active attack.

Then each candidate response (do nothing, block the sources, take the server
offline) is projected forward five minutes and the one leaving the least danger
is recommended.

Nothing is compared against a universal threshold. What counts as suspicious on
one network is unremarkable on another, and the baseline is learned from live
traffic rather than configured.


## What it does not do

Worth being direct about this, because the limits are real and a demo that
hides them invites the wrong questions.

- **It never judges an individual connection.** It scores aggregate windows.
  There is no per-host attribution, and nothing in the system can tell you
  which machine is the attacker.
- **It does not read packet contents.** Only flow metadata.
- **It is close to blind to credential attacks.** We measured this (see
  Validation). Password guessing has no distinctive shape in flow metadata;
  catching it needs authentication logs, which is a different data source.
- **It is statistics, not machine learning.** The baseline adapts to the
  network, but the weights and the response model are chosen, not trained.
  That is a deliberate trade: every number can be shown to a person and
  justified, which a trained model cannot do.

Where it is strong is volumetric and scanning attacks. On labelled data it
catches essentially every SYN flood.


## Running it

Requires Node 18+ and Python 3.10+.

    npm install
    npm run dev

That serves the site on http://localhost:5173 and is enough for the whole
demonstration — the detection engine runs in the browser.

The Python pipeline is only needed for the live API path:

    pip install fastapi uvicorn pydantic pytest numpy
    python pipeline.py

It listens on port 8000. Tests:

    pytest test_pipeline.py


## The site

The landing page explains the system to someone with no background in
networking: what normal looks like, how "unusual" becomes a number, how four
numbers become one alarm, and then a game where you play the attacker and try
to bring down the server without being noticed. Most people get caught in a few
seconds, which teaches the weighting better than the weighting does.

Behind it is a technical panel with the working shown: every measurement, every
comparison, the weighted sum, and the projection for each response, all with
live figures. The assumptions behind the decision — how far ahead to judge, how
much each signal counts, how well each response works — can be edited, and the
recommendation re-derives. If it does not change, the choice was robust.


## Layout

    module1_traffic/     feature extraction and the adaptive baseline
    module2_forecast/    threat scoring, attack classification, trajectory
    module3/             counterfactual simulation, ranking, confidence
    shared/              constants shared across modules, audit ledger
    pipeline.py          the four modules wired together behind a REST API
    src/services/engine.ts   the same maths in TypeScript, for the browser
    src/components/site/     the explainer and the attacker game
    training/            weight fitting against labelled data

The TypeScript engine is a direct port of the Python, so the site can run
without a backend. It is kept deliberately faithful rather than convenient.

One divergence to be aware of: the Python now calibrates its weights
adaptively per window, while the TypeScript engine uses the fixed weights from
`shared/config.py`. The site therefore shows fixed weights.


## Validation

`training/train_weights.ts` fits the threat-score weights against NSL-KDD, a
labelled intrusion dataset, and compares them with the hand-chosen ones:

    npx esbuild training/train_weights.ts --bundle --platform=node \
      --format=esm --outfile=/tmp/tw.mjs && node /tmp/tw.mjs <data-dir>

Results on 126,000 training and 22,500 held-out connections:

| signal                    | hand-set | fitted |
|---------------------------|----------|--------|
| half-finished connections | 0.30     | 0.20   |
| requests arriving         | 0.20     | 0.27   |
| machines connecting       | 0.20     | 0.21   |
| failed attempts           | 0.20     | 0.21   |

The hand-set weights held up: F1 0.727 against 0.705 for the fitted ones on
data neither had seen. With only four features there is little for a linear
model to exploit.

Detection by attack family, on the held-out set:

| family                  | samples | caught |
|-------------------------|---------|--------|
| SYN flood               | 4,657   | 99.9%  |
| port scan               | 2,421   | 56.1%  |
| other denial of service | 2,801   | 42.4%  |
| credential attacks      | 2,885   | 0.2%   |

The last row is why the credential-attack claim is not made. NSL-KDD is an old
dataset and connection-level rather than window-level, so its features are
analogues of ours rather than the same quantities. It is evidence, not proof.
