/** Coalesce button presses while keeping the desired value visible during I/O. */
export class TargetTemperatureQueue {
  constructor(send, changed, failed, delay = 350) {
    this.send = send;
    this.changed = changed;
    this.failed = failed;
    this.delay = delay;
    this.pending = null;
    this.running = false;
  }
  set(value) {
    this.pending = value;
    clearTimeout(this.timer);
    this.readyAt = Date.now() + this.delay;
    this.changed();
    this.timer = setTimeout(() => this.flush(), this.delay);
  }
  async flush() {
    if (this.running || this.pending === null) return;
    this.running = true;
    try {
      while (this.pending !== null) {
        const remaining = this.readyAt - Date.now();
        if (remaining > 0)
          await new Promise((resolve) => setTimeout(resolve, remaining));
        const value = this.pending;
        await this.send(value);
        if (this.pending === value) this.pending = null;
        this.changed();
      }
    } catch (error) {
      this.pending = null;
      this.failed(error);
    } finally {
      this.running = false;
      this.changed();
    }
  }
}
