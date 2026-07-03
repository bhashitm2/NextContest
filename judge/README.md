# nc-judge

Minimal self-hosted code-execution judge for NextContest `/practice` (and,
later, in-house duels). Node + Hono; every run happens in a short-lived,
locked-down Docker container spawned via the docker CLI.

- **Languages:** Python 3.12, C++ 17 (gcc 14), Java 21 — official multi-arch
  images, so the same code runs on an arm64 VM and an amd64 dev machine.
- **Sandbox:** `--network none`, hard memory (no swap), 1 CPU, `--pids-limit
  64`, read-only rootfs, `nobody` user, all capabilities dropped,
  `no-new-privileges`. Wall-clock kill → TLE; container OOM (137) → MLE.
- **Throughput:** 2 concurrent judgings (semaphore), 10 waiting, then 429.
  Per-submission global budget 45s so the Vercel caller (60s) always fits.

## API

`GET /healthz` → `{ ok, running, queued }` (unauthenticated — used by the
keep-warm cron).

`POST /judge` — `Authorization: Bearer $JUDGE_SECRET`

```jsonc
{
  "language": "PYTHON | CPP | JAVA",
  "source": "...",                       // ≤ 64KB
  "tests": [{ "input": "…", "expected": "…" }],  // ≤ 12
  "timeLimitMs": 2000,                   // 250–3000, C++-calibrated (×2 Java, ×3 Python)
  "memoryMb": 256,                       // 64–512
  "returnOutput": false                  // authoring mode: include each test's stdout
}
```

→ `{ verdict, tests: [{ status, timeMs, output? }], compileOutput?, timeMs }`
with verdict `AC WA TLE MLE RE CE JUDGE_ERROR`; `429` when the queue is full.
Tests after the first failure are `SKIPPED`.

## Local development (Windows/Mac dev machine)

Docker Desktop running, then:

```sh
cd judge
npm install
npm run self-test                      # full verdict matrix vs local Docker
JUDGE_SECRET=dev npm run dev           # serves :8080
```

Point the Next app at it: `JUDGE_URL=http://localhost:8080`, `JUDGE_SECRET=dev`.

## Production (Oracle Always Free ARM VM — $0)

One-time, in the Oracle Cloud console (user account required):

1. Create an **A1.Flex** instance: 2 OCPU / 12 GB, **Ubuntu 24.04 (aarch64)**,
   public IP, your SSH key.
2. In the VCN subnet's **Security List**, add ingress rules for TCP **80** and
   **443** from 0.0.0.0/0 (22 is already there).

Then on the VM:

```sh
git clone <repo> && cd <repo>/judge     # or scp the judge/ folder
bash setup.sh
```

`setup.sh` installs Docker, opens the host firewall, pre-pulls the three
sandbox images, generates `.env` (random `JUDGE_SECRET`,
`JUDGE_DOMAIN=<ip>.sslip.io`), and runs `docker compose up -d --build` —
nc-judge behind Caddy, which auto-provisions the Let's Encrypt cert for the
sslip.io hostname (no DNS needed). It prints the `JUDGE_URL` / `JUDGE_SECRET`
to set on Vercel.

Smoke test: `curl https://<ip-with-dashes>.sslip.io/healthz`.

### Keeping the Always Free VM alive

Oracle reclaims Always Free instances that idle below ~20% CPU for 7 days.
Mitigations, best first:

1. **Convert the account to Pay-As-You-Go** (Always Free resources stay $0 and
   become reclaim-exempt). Recommended.
2. The repo's `judge-healthz.yml` GitHub cron hits `/healthz` every 15 min —
   it alerts on outage and adds a little activity.
3. Fallback: a VM-local cron that burns one core a few minutes per hour.

### Notes

- The judge container mounts the host Docker socket (root-equivalent on the
  VM). Accepted: single-purpose VM, no secrets beyond `JUDGE_SECRET`, and the
  sandboxes themselves are net-less/rootless/capped.
- `WORK_DIR` must be a path the **host** daemon can bind-mount; compose mounts
  `/srv/nc-judge/work` at the same path inside the judge container for this.
- Cold container start adds ~300–500 ms per test. Fine for v1; a warm
  container pool is the documented future optimization if it ever matters.
