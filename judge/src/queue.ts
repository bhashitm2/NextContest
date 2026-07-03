/** Promise semaphore: at most `maxConcurrent` judgings run at once (one core
 * each on the 2-OCPU VM); beyond `maxWaiting` queued callers we fail fast with
 * 429 so the caller (a Vercel lambda on a 60s clock) isn't left hanging. */
export class QueueFullError extends Error {
  constructor() {
    super("judge queue full");
  }
}

export class Semaphore {
  private running = 0;
  private waiting: (() => void)[] = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxWaiting: number,
  ) {}

  get stats() {
    return { running: this.running, queued: this.waiting.length };
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      if (this.waiting.length >= this.maxWaiting) throw new QueueFullError();
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }
}
