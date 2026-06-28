'use client';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type HeatmapCell = { dayOfWeek: number; hour: number; count: number };

export function ActivityHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const maxCount = Math.max(...cells.map((c) => c.count), 1);
  const getCount = (day: number, hour: number) =>
    cells.find((c) => c.dayOfWeek === day && c.hour === hour)?.count ?? 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-4 text-sm font-medium text-text-primary">Activity by time of day</p>
      <div className="mb-1 grid" style={{ gridTemplateColumns: '32px repeat(24, 1fr)' }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center text-[9px] text-text-muted">
            {h === 0 ? '0' : h === 6 ? '6' : h === 12 ? '12' : h === 18 ? '18' : ''}
          </div>
        ))}
      </div>
      {DAYS.map((day, dayIdx) => (
        <div
          key={day}
          className="mb-0.5 grid"
          style={{ gridTemplateColumns: '32px repeat(24, 1fr)', gap: '2px' }}
        >
          <div className="flex h-5 items-center justify-end pr-1.5 text-[10px] text-text-muted">
            {day}
          </div>
          {Array.from({ length: 24 }, (_, hour) => {
            const count = getCount(dayIdx, hour);
            const intensity = count === 0 ? 0 : 0.08 + (count / maxCount) * 0.88;
            return (
              <div
                key={hour}
                title={`${day} ${hour}:00 - ${count} messages`}
                className="h-5 rounded-sm"
                style={{ backgroundColor: `rgba(26, 95, 122, ${intensity})` }}
              />
            );
          })}
        </div>
      ))}
      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-[9px] text-text-muted">Less</span>
        {[0.08, 0.3, 0.55, 0.8, 0.96].map((op) => (
          <div
            key={op}
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: `rgba(26, 95, 122, ${op})` }}
          />
        ))}
        <span className="text-[9px] text-text-muted">More</span>
      </div>
    </div>
  );
}
