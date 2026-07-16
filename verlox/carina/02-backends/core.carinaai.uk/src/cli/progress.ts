import { pickSpinnerFace } from './theme/faces.js';

export type ProgressHandle = {
  succeed: (message: string) => void;
  fail: (message: string) => void;
  update: (message: string) => void;
  stop: () => void;
};

export function startProgress(label: string): ProgressHandle {
  let tick = 0;
  let current = label;
  let stopped = false;

  const render = () => {
    if (stopped || !process.stdout.isTTY) return;
    const face = pickSpinnerFace('dots', tick);
    process.stdout.write(`\r${face} ${current}`);
  };

  const timer = setInterval(() => {
    tick += 1;
    render();
  }, 120);

  render();

  const stop = () => {
    stopped = true;
    clearInterval(timer);
    if (process.stdout.isTTY) process.stdout.write('\r\x1b[K');
  };

  return {
    update(message: string) {
      current = message;
      render();
    },
    succeed(message: string) {
      stop();
      console.log(message);
    },
    fail(message: string) {
      stop();
      console.error(message);
    },
    stop,
  };
}
