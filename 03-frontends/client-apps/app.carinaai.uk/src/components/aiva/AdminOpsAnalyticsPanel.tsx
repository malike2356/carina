'use client';

import type { ReactElement } from 'react';
import useSWR from 'swr';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Period = '7d' | '30d' | '90d';

const COLORS = ['#1a5f7a', '#f59e0b', '#22c55e', '#ef4444', '#64748b', '#a855f7', '#0ea5e9', '#ec4899'];
const STATUS: Record<string, string> = {
  inbox: '#1a5f7a',
  archived: '#64748b',
  spam: '#ef4444',
  draft_reply: '#f59e0b',
  sent: '#22c55e',
  high: '#ef4444',
  normal: '#1a5f7a',
  low: '#64748b',
  urgent: '#ef4444',
  completed: '#22c55e',
  failed: '#ef4444',
  running: '#f59e0b',
  queued: '#0ea5e9',
  planned: '#64748b',
  active: '#22c55e',
  done: '#1a5f7a',
  attendance: '#a855f7',
  minutes: '#0ea5e9',
};

const fetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null));

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
      <p className="mt-0.5 text-xs text-text-muted">{label}</p>
      {hint ? <p className="mt-1 text-[11px] text-text-muted">{hint}</p> : null}
    </div>
  );
}

function ChartBox({
  title,
  subtitle,
  children,
  empty,
}: {
  title: string;
  subtitle?: string;
  children: ReactElement;
  empty?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {subtitle ? <p className="mb-3 mt-0.5 text-xs text-text-muted">{subtitle}</p> : <div className="mb-3" />}
          {empty ? (
        <p className="py-16 text-center text-sm text-text-muted">
          No rows in the selected period for this chart.
        </p>
      ) : (
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height={256} minWidth={0} debounce={50}>
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function Donut({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  return (
    <PieChart>
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        innerRadius={55}
        outerRadius={85}
        paddingAngle={2}
        isAnimationActive={false}
      >
        {data.map((row, i) => (
          <Cell key={row.name} fill={STATUS[row.name] ?? COLORS[i % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip />
      <Legend />
    </PieChart>
  );
}

export function AdminOpsAnalyticsPanel({ period }: { period: Period }) {
  const { data, isLoading } = useSWR(`/api/analytics/admin-ops?period=${period}`, fetcher);

  if (isLoading || !data) {
    return <p className="text-sm text-text-muted">Loading admin analytics...</p>;
  }

  const email = data.email ?? {};
  const docs = data.documents ?? {};
  const calendar = data.calendar ?? {};
  const research = data.research ?? {};
  const tasks = data.tasks ?? {};
  const projects = data.projects ?? {};
  const assist = data.humanAssist ?? {};
  const drive = data.driveOps ?? {};
  const contacts = data.contacts ?? {};

  const emailPoints = (email.points ?? []) as Array<{ date: string; count: number }>;
  const taskPoints = (tasks.points ?? []) as Array<{ date: string; completed: number; failed: number }>;
  const emailStatus = (email.byStatus ?? []) as Array<{ name: string; value: number }>;
  const emailUrgency = (email.byUrgency ?? []) as Array<{ name: string; value: number }>;
  const researchStatus = (research.byStatus ?? []) as Array<{ name: string; value: number }>;
  const projectStatus = (projects.byStatus ?? []) as Array<{ name: string; value: number }>;
  const assistStatus = (assist.byStatus ?? []) as Array<{ name: string; value: number }>;
  const driveCategory = (drive.byCategory ?? []) as Array<{ name: string; value: number }>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        <Stat label="Emails" value={email.total ?? 0} hint="Received in period" />
        <Stat label="Documents" value={docs.created ?? 0} hint={`${docs.active ?? 0} active total`} />
        <Stat label="Meetings" value={calendar.eventsInPeriod ?? 0} hint="Events starting in period" />
        <Stat label="Research jobs" value={research.total ?? 0} hint={`${research.completed ?? 0} done · ${research.failed ?? 0} failed`} />
        <Stat label="Task runs" value={(tasks.completed ?? 0) + (tasks.failed ?? 0) + (tasks.running ?? 0)} hint={`${tasks.completed ?? 0} ok · ${tasks.failed ?? 0} failed`} />
        <Stat label="Projects" value={projects.total ?? 0} hint={`${projects.items ?? 0} items added`} />
        <Stat label="Staff assist" value={assist.open ?? 0} hint={`${assist.total ?? 0} opened in period`} />
        <Stat label="Drive / attendance" value={drive.attendance ?? 0} hint={`${drive.minutes ?? 0} minutes · ${drive.mappings ?? 0} files`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Contacts linked"
          value={contacts.identities ?? 0}
          hint={
            contacts.lastSyncAt
              ? `Last sync ${new Date(String(contacts.lastSyncAt)).toLocaleString()}`
              : 'Channel identity links'
          }
        />
        <Stat label="Docs updated" value={docs.updated ?? 0} hint="Touched in period" />
        <Stat label="Calendar created" value={calendar.createdInPeriod ?? 0} hint="New events logged" />
        <Stat label="Drive sync runs" value={drive.recentSyncs ?? 0} hint="Workspace ops syncs" />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartBox title="Email volume" subtitle="Messages received per day">
          <AreaChart data={emailPoints}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey="count" stroke="#1a5f7a" fill="#1a5f7a" fillOpacity={0.35} isAnimationActive={false} />
          </AreaChart>
        </ChartBox>

        <ChartBox title="Email status" empty={emailStatus.length === 0}>
          <Donut data={emailStatus} />
        </ChartBox>

        <ChartBox title="Email urgency" empty={emailUrgency.length === 0}>
          <Donut data={emailUrgency} />
        </ChartBox>

        <ChartBox title="Research outcomes" empty={researchStatus.length === 0}>
          <Donut data={researchStatus} />
        </ChartBox>

        <ChartBox title="Task run health" subtitle="Completed vs failed">
          <LineChart data={taskPoints}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ChartBox>

        <ChartBox title="Project status" empty={projectStatus.length === 0}>
          <Donut data={projectStatus} />
        </ChartBox>

        <ChartBox title="Staff / human assist" empty={assistStatus.length === 0}>
          <Donut data={assistStatus} />
        </ChartBox>

        <ChartBox title="Drive ops by category" subtitle="Attendance, minutes, and other captures" empty={driveCategory.length === 0}>
          <BarChart data={driveCategory}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" isAnimationActive={false}>
              {driveCategory.map((row, i) => (
                <Cell key={row.name} fill={STATUS[row.name] ?? COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartBox>
      </div>
    </div>
  );
}
