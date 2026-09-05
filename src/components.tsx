import {
  Activity,
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  MessageSquare,
  NotebookPen,
  Send,
  Webhook,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import {
  age,
  when,
  platformName,
  type HubData,
  type Session,
  type Job,
  type Platform,
  type Event,
} from "./data";
export function SourceIcon({ source }: { source: string }) {
  const Icon =
    source === "telegram"
      ? Send
      : source === "webhook"
        ? Webhook
        : source === "notetaker:telegram"
          ? NotebookPen
          : MessageSquare;
  return (
    <span className={`source-icon ${source === "webhook" ? "blue" : ""}`}>
      <Icon size={19} />
    </span>
  );
}
export function Gateway({
  data,
  loading,
}: {
  data: HubData | null;
  loading: boolean;
}) {
  const g = data?.gateway;
  const connected =
    g?.platforms.filter((p) => p.state === "connected" && !p.error).length ?? 0;
  const state = !g
    ? "unknown"
    : g.running === false
      ? "offline"
      : g.running === true
        ? "online"
        : "unknown";
  return (
    <section className={`gateway panel ${state}`} aria-label="Gateway health">
      <div className="orbit" aria-hidden="true">
        <svg viewBox="0 0 280 235">
          <circle cx="140" cy="129" r="98" className="orbit-track" />
          <circle cx="140" cy="129" r="73" className="orbit-inner" />
          <circle cx="140" cy="129" r="41" className="orbit-halo" />
          <path d="M140 129V37M140 129L58 180M140 129L222 180" />
          <circle cx="140" cy="129" r="15" className="orbit-core" />
          <circle cx="140" cy="129" r="28" className="orbit-pulse" />
        </svg>
        <span className="satellite telegram">
          <Send size={23} />
        </span>
        <span className="satellite webhook">
          <Webhook size={24} />
        </span>
        <span className="satellite notes">
          <NotebookPen size={23} />
        </span>
      </div>
      <h2>
        {loading
          ? "Connecting to your hub"
          : state === "online"
            ? "Gateway online"
            : state === "offline"
              ? "Gateway offline"
              : "Gateway unavailable"}
      </h2>
      <p>
        {g
          ? `${connected} of ${g.platforms.length} platforms connected`
          : "Waiting for local status"}
      </p>
      <span className="hero-note">
        {data?.source === "demo"
          ? "Example state"
          : data
            ? "Read-only state"
            : "No current readings"}{" "}
        · refreshed every 8s
      </span>
    </section>
  );
}
export function Connections({
  platforms,
  onSelect,
}: {
  platforms: Platform[] | undefined;
  onSelect: (p: Platform) => void;
}) {
  return (
    <section className="panel connections">
      <h2>Connections</h2>
      {platforms?.map((p) => (
        <button
          className="connection-row"
          key={p.id}
          onClick={() => onSelect(p)}
        >
          <SourceIcon source={p.id} />
          <span className="row-copy">
            <strong>{platformName(p.id)}</strong>
            <small>Updated {age(p.updatedAt)}</small>
          </span>
          <span
            className={`state ${p.error || p.state !== "connected" ? "warning" : ""}`}
          >
            <i />
            {p.error ? "Error" : p.state}
          </span>
          <ChevronRight size={14} />
        </button>
      )) ?? <Empty text="Platform status unavailable" />}
    </section>
  );
}
export function Sessions({
  sessions,
  onSelect,
  available = true,
  compact = false,
}: {
  sessions: Session[];
  onSelect: (s: Session) => void;
  available?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="session-list">
      {!available ? (
        <Empty text="Sessions unavailable" />
      ) : !sessions.length ? (
        <Empty text="No sessions to show" />
      ) : (
        sessions.map((s) => (
          <button
            className="session-row"
            key={s.id}
            onClick={() => onSelect(s)}
          >
            <SourceIcon source={s.source} />
            <span className="row-copy">
              <strong>{s.title}</strong>
              <small>
                {platformName(s.source)} · {s.model} ·{" "}
                {age(s.lastActive ?? s.startedAt)}
              </small>
              {!compact && (
                <span className="session-state">
                  {s.active === true
                    ? "Active"
                    : s.active === false
                      ? "Inactive"
                      : "Activity unknown"}
                </span>
              )}
            </span>
            <ChevronRight size={17} />
          </button>
        ))
      )}
    </div>
  );
}
export function Jobs({
  jobs,
  onSelect,
  available = true,
}: {
  jobs: Job[];
  onSelect: (j: Job) => void;
  available?: boolean;
}) {
  return (
    <div className="job-list">
      {!available ? (
        <Empty text="Scheduled jobs unavailable" />
      ) : !jobs.length ? (
        <Empty text="No scheduled jobs" />
      ) : (
        jobs.map((j) => (
          <button className="job-row" key={j.id} onClick={() => onSelect(j)}>
            <span className="source-icon calendar">
              <CalendarClock size={21} />
            </span>
            <span className="row-copy">
              <strong>{j.name}</strong>
              <small>
                {j.enabled === false ? (
                  "Paused"
                ) : j.error ? (
                  "Error reported"
                ) : (
                  <>
                    Next <span className="mint">{when(j.nextRun)}</span>
                  </>
                )}
              </small>
            </span>
            <ChevronRight size={17} />
          </button>
        ))
      )}
    </div>
  );
}
export function Events({ events }: { events: Event[] }) {
  return (
    <div className="event-list">
      {!events.length ? (
        <Empty text="Activity appears as the hub observes changes." />
      ) : (
        events.map((e) => (
          <article className="event" key={e.id}>
            <span
              className={`event-dot ${e.category === "job" ? "blue" : ""}`}
            />
            <div>
              <strong>{e.title}</strong>
              <p>{e.detail}</p>
              <small>
                {age(e.timestamp)} · {e.category}
              </small>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <WifiOff size={20} />
      <p>{text}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => old?.focus();
  }, []);
  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog panel"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const elements = [
              ...e.currentTarget.querySelectorAll<HTMLElement>(
                'button,input,select,[tabindex="0"]',
              ),
            ];
            const first = elements[0],
              last = elements.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="section-title">
          <h2 id="dialog-title">{title}</h2>
          <button
            className="icon-button"
            aria-label="Close detail"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function SessionDetail({
  session,
  events,
  onBack,
}: {
  session: Session;
  events: Event[];
  onBack: () => void;
}) {
  return (
    <section className="panel detail">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={17} />
        All sessions
      </button>
      <SourceIcon source={session.source} />
      <h2>{session.title}</h2>
      <p className="muted">Session metadata</p>
      <dl>
        <div>
          <dt>Source</dt>
          <dd>{platformName(session.source)}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{session.model}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>{when(session.startedAt)}</dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd>{when(session.lastActive)}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>
            {session.active === true
              ? "Active"
              : session.active === false
                ? "Inactive"
                : "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Session ID</dt>
          <dd>{session.id}</dd>
        </div>
      </dl>
      <h3>
        <Activity size={17} />
        Activity log
      </h3>
      <p className="muted small">
        Observed metadata changes. Message bodies are not fetched.
      </p>
      <Events events={events.filter((e) => e.sessionId === session.id)} />
    </section>
  );
}
