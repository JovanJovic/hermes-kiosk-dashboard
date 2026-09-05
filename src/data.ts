export type Platform = {
  id: string;
  state: string;
  updatedAt: number | null;
  error: boolean;
  errorCode: string | null;
};
export type Session = {
  id: string;
  title: string;
  source: string;
  model: string;
  startedAt: number | null;
  lastActive: number | null;
  endedAt: number | null;
  active: boolean | null;
};
export type Job = {
  id: string;
  name: string;
  enabled: boolean | null;
  state: string;
  schedule: string;
  nextRun: number | null;
  lastRun: number | null;
  lastStatus: string;
  error: boolean;
};
export type Event = {
  id: string;
  category: string;
  title: string;
  detail: string;
  timestamp: number;
  sessionId: string | null;
};
export type HubData = {
  schema: 1;
  source: "demo" | "live";
  timestamp: number;
  gateway: {
    running: boolean | null;
    state: string;
    version: string;
    platforms: Platform[];
  } | null;
  sessions: Session[];
  jobs: Job[];
  activity: Event[];
  availability: { gateway: boolean; sessions: boolean; jobs: boolean };
};
const started = Date.now();
const morning = new Date(started);
morning.setHours(8, 0, 0, 0);
if (morning.getTime() <= started) morning.setDate(morning.getDate() + 1);
const weekly = new Date(started);
weekly.setHours(9, 0, 0, 0);
weekly.setDate(weekly.getDate() + ((1 - weekly.getDay() + 7) % 7));
if (weekly.getTime() <= started) weekly.setDate(weekly.getDate() + 7);
export function demoData(): HubData {
  const now = Date.now();
  return {
    schema: 1,
    source: "demo",
    timestamp: now,
    gateway: {
      running: true,
      state: "running",
      version: "Example",
      platforms: ["telegram", "webhook", "notetaker:telegram"].map((id) => ({
        id,
        state: "connected",
        updatedAt: now,
        error: false,
        errorCode: null,
      })),
    },
    sessions: [
      ["Morning planning", "telegram", 2],
      ["Project check-in", "webhook", 12],
      ["Ideas for the week", "notetaker:telegram", 28],
      ["A fresh perspective", "telegram", 48],
      ["Weekly priorities", "webhook", 82],
    ].map(([title, source, minutes], i) => ({
      id: `example-${i}`,
      title: String(title),
      source: String(source),
      model: "demo-model",
      startedAt: started - Number(minutes) * 60000 - 60000,
      lastActive: started - Number(minutes) * 60000,
      endedAt: i === 0 ? null : started - Number(minutes) * 60000,
      active: i === 0,
    })),
    jobs: [
      {
        id: "example-morning",
        name: "Morning digest",
        enabled: true,
        state: "scheduled",
        schedule: "Every morning at 08:00",
        nextRun: morning.getTime(),
        lastRun: morning.getTime() - 24 * 3600000,
        lastStatus: "success",
        error: false,
      },
      {
        id: "example-weekly",
        name: "Weekly review",
        enabled: true,
        state: "scheduled",
        schedule: "Every Monday at 09:00",
        nextRun: weekly.getTime(),
        lastRun: weekly.getTime() - 7 * 24 * 3600000,
        lastStatus: "success",
        error: false,
      },
    ],
    activity: [
      {
        id: "sample-1",
        category: "session",
        title: "Morning planning",
        detail: "Session metadata changed",
        timestamp: started - 120000,
        sessionId: "example-0",
      },
      {
        id: "sample-2",
        category: "connection",
        title: "Telegram connected",
        detail: "Example connectivity event",
        timestamp: started - 240000,
        sessionId: null,
      },
      {
        id: "sample-3",
        category: "job",
        title: "Morning digest",
        detail: "Schedule metadata changed",
        timestamp: started - 360000,
        sessionId: null,
      },
    ],
    availability: { gateway: true, sessions: true, jobs: true },
  };
}
export function age(time: number | null) {
  if (!time) return "Time unavailable";
  const secs = Math.max(0, Math.floor((Date.now() - time) / 1000));
  return secs < 60
    ? "just now"
    : secs < 3600
      ? `${Math.floor(secs / 60)}m ago`
      : secs < 86400
        ? `${Math.floor(secs / 3600)}h ago`
        : `${Math.floor(secs / 86400)}d ago`;
}
export function when(time: number | null) {
  return time
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(time)
    : "Not reported";
}
export function platformName(id: string) {
  return id === "notetaker:telegram"
    ? "Notetaker"
    : id === "telegram"
      ? "Telegram"
      : id === "webhook"
        ? "Webhook"
        : id;
}
export function validHub(value: unknown): value is HubData {
  if (!value || typeof value !== "object") return false;
  const v = value as HubData;
  const stamp = (x: unknown) =>
    x === null || (typeof x === "number" && Number.isFinite(x));
  const str = (x: unknown) => typeof x === "string";
  return (
    v.schema === 1 &&
    v.source === "live" &&
    typeof v.timestamp === "number" &&
    Number.isFinite(v.timestamp) &&
    !!v.availability &&
    ["gateway", "sessions", "jobs"].every(
      (k) =>
        typeof v.availability[k as keyof typeof v.availability] === "boolean",
    ) &&
    (v.gateway === null ||
      (!!v.gateway &&
        [true, false, null].includes(v.gateway.running) &&
        str(v.gateway.state) &&
        str(v.gateway.version) &&
        Array.isArray(v.gateway.platforms) &&
        v.gateway.platforms.every(
          (p) =>
            p &&
            str(p.id) &&
            str(p.state) &&
            stamp(p.updatedAt) &&
            typeof p.error === "boolean" &&
            (p.errorCode === null || str(p.errorCode)),
        ))) &&
    Array.isArray(v.sessions) &&
    v.sessions.every(
      (s) =>
        s &&
        [s.id, s.title, s.source, s.model].every(str) &&
        [s.startedAt, s.lastActive, s.endedAt].every(stamp) &&
        [true, false, null].includes(s.active),
    ) &&
    Array.isArray(v.jobs) &&
    v.jobs.every(
      (j) =>
        j &&
        [j.id, j.name, j.schedule, j.state, j.lastStatus].every(str) &&
        [j.nextRun, j.lastRun].every(stamp) &&
        [true, false, null].includes(j.enabled) &&
        typeof j.error === "boolean",
    ) &&
    Array.isArray(v.activity) &&
    v.activity.every(
      (e) =>
        e &&
        [e.id, e.title, e.detail, e.category].every(str) &&
        typeof e.timestamp === "number" &&
        Number.isFinite(e.timestamp) &&
        (e.sessionId === null || str(e.sessionId)),
    )
  );
}
