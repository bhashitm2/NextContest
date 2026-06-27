# LeetCode rating prediction (early, ~minutes after a contest)

LeetCode only publishes official ratings **~a day** after a contest. NextContest
already shows that official number automatically (no setup). To show a **predicted**
delta within minutes of a contest ending, NextContest consumes a self-hosted
predictor via the `LCCN_PREDICTOR_URL` env var.

**Deployed service:** https://lccn-predictor.onrender.com
(fork: https://github.com/bhashitm2/lccn-predictor)

The NextContest integration is wired up in `src/server/predictions/leetcode/fetch.ts`.
It calls:

```
GET {LCCN_PREDICTOR_URL}/api/v1/contest/{slug}/user/{username}
→ { rank, old_rating, delta_rating, new_rating, … }   (HTTP 404 = not predicted yet)
```

Our LeetCode `Contest.externalId` already IS the slug (e.g. `weekly-contest-507`).
Any failure (no URL, cold/down service, 404, missing delta) → silent fallback to
LeetCode's official rating, so the page never breaks.

## To turn it on

1. **Set the env var** on Vercel (Production + Preview) and in local `.env`:
   ```
   LCCN_PREDICTOR_URL=https://lccn-predictor.onrender.com
   ```
   Redeploy NextContest (push to `main`).

2. **Populate predictions.** A freshly-deployed service has no data until it crawls a
   contest (every contest shows `status: pending` until then). Two ways:
   - **Automatic:** its scheduler predicts each new weekly/biweekly contest going forward.
   - **Manual (to backfill the latest now):**
     ```bash
     curl -X POST https://lccn-predictor.onrender.com/api/v1/admin/predict-latest
     ```
     (then check `GET /api/v1/contest/{slug}/status` until `status` is done).

3. **Use it:** open **Ratings**, search a handle right after a LeetCode contest → the
   "Predicted · live" row appears; it flips to the official delta ~a day later.

## Render free-tier caveats (this deployment)
- The service **spins down after 15 min idle** and cold-starts (~1 min) on the next
  request. NextContest's call waits up to 25s, so the *first* lookup after the service
  has been idle may fall back to the official rating while it wakes — try again shortly.
- The **scheduler must be awake at contest end** to auto-predict. If the instance is
  asleep then, use the manual `predict-latest` afterwards, or keep it warm.
- 512 MB RAM / 0.1 CPU is tight for big contests; if a predict run OOMs, Render's paid
  Starter (~$7/mo) fixes it.

## Health / debugging
- `GET /healthz` — service up.
- `GET /api/v1/contest/{slug}/status` — `{ status, total_records, resolved_ratings, predicted_at }`.
- `GET /api/v1/contest/{slug}/user/{username}` — a single user's prediction.
