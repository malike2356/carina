export interface ScheduledTask {
  name: string;
  hour?: number;
  minute?: number;
  timezone?: string;
  intervalMinutes?: number;
  run: () => Promise<void>;
}

interface TaskRuntime {
  task: ScheduledTask;
  lastRunDate?: string;
  lastRunAt?: number;
}

export class TaskScheduler {
  private readonly tasks: TaskRuntime[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly tickMs = 60_000) {}

  register(task: ScheduledTask): void {
    if (task.intervalMinutes === undefined && (task.hour === undefined || task.minute === undefined)) {
      throw new Error(`Scheduled task ${task.name} needs either intervalMinutes or hour/minute`);
    }
    this.tasks.push({ task });
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.tickMs);
    this.timer.unref();
    void this.tick();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async tick(now = new Date()): Promise<void> {
    for (const runtime of this.tasks) {
      if (!this.shouldRun(runtime, now)) continue;
      runtime.lastRunAt = now.getTime();
      runtime.lastRunDate = localDate(runtime.task.timezone, now);
      await runtime.task.run();
    }
  }

  private shouldRun(runtime: TaskRuntime, now: Date): boolean {
    const { task } = runtime;
    if (task.intervalMinutes !== undefined) {
      if (!runtime.lastRunAt) return true;
      return now.getTime() - runtime.lastRunAt >= task.intervalMinutes * 60_000;
    }

    const parts = localParts(task.timezone, now);
    if (parts.hour !== task.hour || parts.minute !== task.minute) return false;
    const date = localDate(task.timezone, now);
    return runtime.lastRunDate !== date;
  }
}

function localDate(timezone: string | undefined, date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function localParts(timezone: string | undefined, date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? '0'),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? '0'),
  };
}
