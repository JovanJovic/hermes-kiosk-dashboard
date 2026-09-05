import { useState } from "react";
import {
  Activity,
  CalendarDays,
  ChevronRight,
  LayoutGrid,
  MessageSquare,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import {
  Connections,
  Events,
  Gateway,
  Jobs,
  Modal,
  SessionDetail,
  Sessions,
} from "./components";
import { age, platformName, when, type Job, type Platform } from "./data";
import { useHub } from "./useHub";
const nav = [
  { name: "Overview", icon: LayoutGrid },
  { name: "Sessions", icon: MessageSquare },
  { name: "Jobs", icon: CalendarDays },
  { name: "Activity", icon: Activity },
];
export function App() {
  const [tab, setTab] = useState("Overview");
  const [mode, setMode] = useState<"demo" | "live">(() =>
    new URLSearchParams(location.search).get("source") === "live"
      ? "live"
      : "demo",
  );
  const [settings, setSettings] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const { data, error, loading } = useHub(mode);
  const selectedSession = data?.sessions.find((s) => s.id === sessionId);
  const go = (name: string) => {
    setTab(name);
    setSessionId(null);
    setQuery("");
    setFilter("all");
    window.scrollTo(0, 0);
  };
  const pickSession = (id: string) => {
    setSessionId(id);
    setTab("Sessions");
    window.scrollTo(0, 0);
  };
  const pickMode = (value: "demo" | "live") => {
    setMode(value);
    setSessionId(null);
    setJob(null);
    setPlatform(null);
    const url = new URL(location.href);
    url.searchParams.set("source", value);
    window.history.replaceState({}, "", url);
  };
  const sessions =
    data?.sessions.filter(
      (s) =>
        `${s.title} ${s.model} ${s.source}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === "all" || s.source === filter),
    ) ?? [];
  const jobs = (data?.jobs ?? [])
    .filter(
      (j) =>
        filter === "all" ||
        (filter === "enabled" ? j.enabled === true : j.enabled === false),
    )
    .sort((a, b) => (a.nextRun ?? Infinity) - (b.nextRun ?? Infinity));
  const healthy = data && Object.values(data.availability).every(Boolean);
  return (
    <div
      className={`app ${new URLSearchParams(location.search).get("view") === "kiosk" ? "kiosk" : ""}`}
    >
      <header>
        <div className="brand">
          <Zap size={22} />
          <span>HERMES</span>
        </div>
        <button className="mode-button" onClick={() => setSettings(true)}>
          {mode === "demo"
            ? "Demo data"
            : loading
              ? "Connecting"
              : !data
                ? "Disconnected"
                : healthy
                  ? "Live · read only"
                  : "Partial data"}
        </button>
      </header>
      <main>
        <div className="page-heading">
          <h1>
            {tab === "Overview" ? (
              <>
                Your agents, <span>in view.</span>
              </>
            ) : tab === "Sessions" ? (
              "Every conversation."
            ) : tab === "Jobs" ? (
              "What’s coming next."
            ) : (
              "The latest signals."
            )}
          </h1>
          <p>
            {tab === "Overview"
              ? "A clear picture of what is happening."
              : tab === "Sessions"
                ? "Recent sessions, a little more context."
                : tab === "Jobs"
                  ? "Scheduled work, without the guesswork."
                  : "A timeline of observed activity."}
          </p>
        </div>
        {error && (
          <div role="alert" className="alert">
            {error}
          </div>
        )}
        {data && !healthy && (
          <div role="status" className="alert">
            Some sources are unavailable. Available sections keep updating.
          </div>
        )}
        {tab === "Overview" && (
          <div className="overview">
            <Gateway data={data} loading={loading} />
            <Connections
              platforms={data?.gateway?.platforms}
              onSelect={setPlatform}
            />
            <section className="panel recent">
              <div className="section-title">
                <h2>Recent sessions</h2>
                <button className="text-button" onClick={() => go("Sessions")}>
                  View all
                  <ChevronRight size={13} />
                </button>
              </div>
              <Sessions
                compact
                sessions={data?.sessions.slice(0, 3) ?? []}
                available={!!data?.availability.sessions}
                onSelect={(s) => pickSession(s.id)}
              />
            </section>
            <section className="panel schedule">
              <div className="section-title">
                <h2>Scheduled jobs</h2>
                <button className="text-button" onClick={() => go("Jobs")}>
                  View all
                  <ChevronRight size={13} />
                </button>
              </div>
              <Jobs
                jobs={[...(data?.jobs ?? [])]
                  .filter((j) => j.enabled !== false)
                  .sort(
                    (a, b) => (a.nextRun ?? Infinity) - (b.nextRun ?? Infinity),
                  )
                  .slice(0, 2)}
                available={!!data?.availability.jobs}
                onSelect={setJob}
              />
            </section>
          </div>
        )}
        {tab === "Sessions" &&
          (selectedSession ? (
            <SessionDetail
              session={selectedSession}
              events={data?.activity ?? []}
              onBack={() => setSessionId(null)}
            />
          ) : (
            <section className="panel full-list">
              <div className="search">
                <Search size={17} />
                <input
                  aria-label="Search sessions"
                  placeholder="Find a session…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select
                aria-label="Filter sessions by platform"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All platforms</option>
                {["telegram", "webhook", "notetaker:telegram"].map((s) => (
                  <option key={s} value={s}>
                    {platformName(s)}
                  </option>
                ))}
              </select>
              <p className="list-summary">
                {sessions.length} of {data?.sessions.length ?? 0} recent
                sessions · latest 20
              </p>
              {sessionId && !selectedSession && (
                <p className="muted small">
                  Selected session is no longer in the current sample.
                </p>
              )}
              <Sessions
                sessions={sessions}
                available={!!data?.availability.sessions}
                onSelect={(s) => pickSession(s.id)}
              />
            </section>
          ))}
        {tab === "Jobs" && (
          <section className="panel full-list">
            <div className="section-title">
              <h2>Scheduled jobs</h2>
              <select
                aria-label="Filter jobs"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All jobs</option>
                <option value="enabled">Enabled</option>
                <option value="paused">Paused</option>
              </select>
            </div>
            <Jobs
              jobs={jobs}
              available={!!data?.availability.jobs}
              onSelect={setJob}
            />
            <p className="muted small list-summary">
              Times use this browser’s timezone. Up to 100 jobs. Read only.
            </p>
          </section>
        )}
        {tab === "Activity" && (
          <section className="panel full-list">
            <div className="section-title">
              <h2>Activity log</h2>
              <Activity size={19} />
            </div>
            <p className="muted small">
              {mode === "demo"
                ? "Example events."
                : "Changes observed since this hub started."}{" "}
              Up to 80 events in memory. No message bodies.
            </p>
            <Events events={data?.activity ?? []} />
          </section>
        )}
        <div className="footer">
          <ShieldCheck size={13} />
          <span>
            {data
              ? `Updated ${age(data.timestamp)} · ${mode === "demo" ? "example data" : "local data"}`
              : "Local by design. Read only."}
          </span>
          <button
            aria-label="Connection settings"
            onClick={() => setSettings(true)}
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </main>
      <nav aria-label="Hub navigation">
        {nav.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={tab === name ? "active" : ""}
            aria-current={tab === name ? "page" : undefined}
            onClick={() => go(name)}
          >
            <Icon size={22} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      {settings && (
        <Modal title="Connection settings" onClose={() => setSettings(false)}>
          <p className="muted">
            Demo mode uses example data. Local mode works when this app is
            served by the Pi aggregator on port 9121.
          </p>
          <div className="mode-options">
            <button
              aria-pressed={mode === "demo"}
              onClick={() => pickMode("demo")}
            >
              Demo data
            </button>
            <button
              aria-pressed={mode === "live"}
              onClick={() => pickMode("live")}
            >
              Local Pi
            </button>
          </div>
          <p className="muted small">
            No tokens or credentials are stored in this browser. The stock
            dashboard remains available on the Pi.
          </p>
        </Modal>
      )}
      {platform && (
        <Modal
          title={platformName(platform.id)}
          onClose={() => setPlatform(null)}
        >
          {(() => {
            const current = data?.gateway?.platforms.find(
              (p) => p.id === platform.id,
            );
            return (
              <dl>
                <div>
                  <dt>State</dt>
                  <dd>{current?.state ?? "Unavailable"}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{when(current?.updatedAt ?? null)}</dd>
                </div>
                <div>
                  <dt>Errors</dt>
                  <dd>
                    {!current
                      ? "Unavailable"
                      : current.error
                        ? current.errorCode || "Platform reported an error"
                        : "None reported"}
                  </dd>
                </div>
              </dl>
            );
          })()}
          <p className="muted small">
            Raw error details are omitted to keep sensitive configuration out of
            the kiosk.
          </p>
        </Modal>
      )}
      {job && (
        <Modal title="Scheduled job" onClose={() => setJob(null)}>
          {(() => {
            const current = data?.jobs.find((j) => j.id === job.id);
            return current ? (
              <>
                <h3>{current.name}</h3>
                <dl>
                  <div>
                    <dt>Schedule</dt>
                    <dd>{current.schedule}</dd>
                  </div>
                  <div>
                    <dt>Enabled</dt>
                    <dd>
                      {current.enabled === null
                        ? "Unknown"
                        : current.enabled
                          ? "Yes"
                          : "Paused"}
                    </dd>
                  </div>
                  <div>
                    <dt>Next run</dt>
                    <dd>{when(current.nextRun)}</dd>
                  </div>
                  <div>
                    <dt>Last run</dt>
                    <dd>{when(current.lastRun)}</dd>
                  </div>
                  <div>
                    <dt>Last result</dt>
                    <dd>{current.lastStatus}</dd>
                  </div>
                  <div>
                    <dt>Errors</dt>
                    <dd>
                      {current.error ? "Error reported" : "None reported"}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="muted">Job unavailable in the current sample.</p>
            );
          })()}
          <p className="muted small">
            Read only. Job prompts, scripts and delivery details are never
            shown.
          </p>
        </Modal>
      )}
    </div>
  );
}
