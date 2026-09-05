# Read-only adapter contract

The Python service exposes one data endpoint: **GET /api/hub**, no query parameters. Static assets come only from `dist/`. Unknown `/api/` paths return 404; write methods are not implemented. Host must exactly match loopback and the current port. Foreign Origin headers are rejected. No CORS access is granted. Bind is always 127.0.0.1; there is no public-host option.

## Upstream allowlist

| GET path on fixed 127.0.0.1:9119               | Purpose                                            |
| ---------------------------------------------- | -------------------------------------------------- |
| `/`                                            | Read the injected short-lived token into memory    |
| `/api/status`                                  | Gateway/version and three expected platform states |
| `/api/sessions?limit=20&offset=0&order=recent` | Recent session metadata                            |
| `/api/cron/jobs`                               | Schedule metadata                                  |

The header name is `X-Hermes-Session-Token`. Startup discovers the token; a protected request receiving 401 refreshes it and retries exactly once. A second failure is surfaced as an unavailable section. No credentials are accepted from the client. Redirects and environment HTTP proxies are disabled; requests cannot leave the fixed loopback origin. Individual upstream operations time out after two seconds and bodies are capped at 2 MiB.

Session detail is a view of metadata already fetched in the bounded recent-session list. No detail/messages endpoint, no analytics, no notes, no local state DB and no raw logs are called. The API is not a generic proxy.

## Fields and freshness

`schema: 1`, `source: live`, timestamp in epoch milliseconds, `gateway`, `sessions`, `jobs`, `availability` and `activity`. Demo fixtures are generated only in the frontend.

- Gateway: running boolean or null, state, version; platforms `{id,state,updatedAt,error,errorCode}`. Only `telegram`, `webhook` and `notetaker:telegram` are selected. Absent platform data becomes unknown. Error messages become a boolean, never raw text; error codes accept a bounded safe character set.
- Sessions: id, title (fallback display_name), source, model, startedAt, lastActive, endedAt and nullable active. No preview/body/tool output/token-usage/config fields.
- Jobs: id, name, enabled, state, schedule label/expression, nextRun, lastRun, lastStatus and error boolean. No prompt/script/path/delivery/provider credential fields. Both a top-level array and `{jobs: [...]}` are accepted.
- Activity: up to 80 metadata events since process start; gateway/source availability changes, platform state changes, newly observed/session metadata changes and job execution/enabled changes. Events are observations, not proof of every underlying event. Changes between polls may be missed.

Malformed collection envelopes are unavailable, not empty-success responses. Section failures clear that section's current values while retaining other valid sections. No raw exception or source payload is logged or returned. Recognised credential patterns and the current/recently retired token values are redacted from bounded display text, but ordinary session titles are still potentially private and must remain local.

Unix seconds and milliseconds and ISO timestamps with explicit timezone are supported. A naive timestamp has unknown timezone and becomes null. Job next-run times are supplied by upstream, not recalculated. Browser local timezone is used for display.

The cache is five seconds; browser requests recur eight seconds after each completed fetch, without overlap. Upstream failures can lengthen the interval. Browser timeout is 18 seconds. Missing API/malformed response clears current data and announces disconnection. No demo fallback or persisted localStorage is used. History and tokens are memory-only and reset on restart.
