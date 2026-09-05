# Hermes Kiosk Dashboard

A portrait agent-activity hub for a **400×1280** kiosk. Matches the dark/mint design of the [Hermes case dashboard](https://github.com/JovanJovic/hermes-case-dashboard).

**Exact repository:** https://github.com/JovanJovic/hermes-kiosk-dashboard

**Delivery branch:** `main`

**Release:** `v1.0.0`

- [Public demo](https://jovanjovic.github.io/hermes-kiosk-dashboard/?view=kiosk) — synthetic data only.
- [Prebuilt release](https://github.com/JovanJovic/hermes-kiosk-dashboard/releases/tag/v1.0.0) — Python 3.11 standard library; **no Node or pip needed on the Pi**.
- [Hermes installation and rollback guide](HERMES_HANDOFF.md) — start here on the Pi.

## Features

Connectivity for Telegram, Webhook and Notetaker; latest 20 sessions with platform filtering, search and metadata detail; up to 100 cron jobs with next-run times and status; an in-memory activity log of changes observed by the aggregator. Touch navigation: Overview, Sessions, Jobs, Activity. Overview fits 400×1280 at 100% zoom; longer detail/list screens scroll. A wider desktop layout is also available by omitting `?view=kiosk`.

This dashboard is **read-only by construction**. It never fetches message bodies, job prompts/scripts, notes, hardware telemetry or credentials endpoints. Its activity log records observed metadata changes, not conversation transcripts or historic gateway logs. It is not an official Nous Research product.

## Runtime

```sh
/usr/bin/python3 server/hub.py
# http://127.0.0.1:9121/?source=live&view=kiosk
```

The aggregator serves the compiled `dist/` frontend and `GET /api/hub` on **127.0.0.1:9121**. The upstream is fixed at **127.0.0.1:9119**. A short-lived dashboard session token is discovered from its HTML at startup and refreshed once after a 401. It remains in Python memory; it is never passed to the browser, logged, written to disk or committed.

The stock dashboard remains running. Installing this package does not repoint a kiosk or modify existing services. The handoff explains the single URL change after manual acceptance, and its reversal.

The default is **Demo data**. Use `?source=live&view=kiosk` for installation. A failed live request never falls back to demo. Unavailable sources are marked separately; available sections continue updating. The browser polls every eight seconds after the preceding request completes; samples are cached for five seconds. Failed requests have bounded timeouts. No background files, notes database, API keys, analytics or external fonts are used.

## Development and checks

Node 22.12+ and Python 3.11+:

```sh
npm ci
npm run dev -- --port 5174
npm run build
npm test
```

The Vite development server is demo-only. To test the actual local aggregator, build and serve with `server/hub.py`; it requires the real upstream on that machine. Do not accidentally connect a development machine to a different Hermes instance. See [API contract](docs/API_CONTRACT.md) and [source evidence](docs/SOURCES.md).

After committing a tested build, `python tools/package_release.py` creates `.release/hermes-kiosk-dashboard-v1.0.0.tar.gz` and `SHA256SUMS`. The archive includes compiled assets, Python service/tests, user-unit template, docs and build identity.

## Privacy and licensing

This public repository contains synthetic examples only. Keep operational metadata and acceptance screenshots local. Session titles can themselves be private: do not expose the aggregator through a public bind, proxy, tunnel or static upload. No credentials are needed for public demos.

DM Sans and Space Grotesk are bundled through Fontsource; icons are from Lucide. Redistributed dependency notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No upstream Hermes source or private environment description is redistributed. Design references are in `design/`; all UI is native React, CSS and SVG.
