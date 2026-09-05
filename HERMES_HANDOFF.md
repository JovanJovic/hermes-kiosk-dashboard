# Hermes: review, test and install the kiosk hub

## Exact identity

Repository: **https://github.com/JovanJovic/hermes-kiosk-dashboard**

Git URL: **https://github.com/JovanJovic/hermes-kiosk-dashboard.git**

Branch: **main**

Tag: **v1.0.0**

New aggregator: **127.0.0.1:9121**

Live kiosk URL: **http://127.0.0.1:9121/?source=live&view=kiosk**

This is a new repository, distinct from `hermes-case-dashboard`. Verify the exact URL, refs and full commit before installation. Use an explicit working directory for every command if your session's current directory is unreliable. No deployment was performed from the development computer.

## 1. Download matching source and release

Run as the existing desktop user. Use a new directory; do not clone into either the Hermes agent or case-dashboard installations. Commands below use a subshell with `set -eu`, so a failure stops the sequence.

```sh
(
  set -eu
  cd "$HOME"
  test ! -e hermes-kiosk-dashboard
  git ls-remote https://github.com/JovanJovic/hermes-kiosk-dashboard.git refs/heads/main refs/tags/v1.0.0
  git clone --branch v1.0.0 https://github.com/JovanJovic/hermes-kiosk-dashboard.git hermes-kiosk-dashboard
  cd "$HOME/hermes-kiosk-dashboard"
  git remote -v
  git rev-parse HEAD
  mkdir -p .release
  cd .release
  curl -fLO https://github.com/JovanJovic/hermes-kiosk-dashboard/releases/download/v1.0.0/hermes-kiosk-dashboard-v1.0.0.tar.gz
  curl -fLO https://github.com/JovanJovic/hermes-kiosk-dashboard/releases/download/v1.0.0/SHA256SUMS
  sha256sum -c SHA256SUMS
  tar -xzf hermes-kiosk-dashboard-v1.0.0.tar.gz -C .. dist BUILD_INFO.json
  cd ..
  /usr/bin/python3 -c 'import json, subprocess; b=json.load(open("BUILD_INFO.json")); assert b["commit"]==subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(); print("Source/build identity matches")'
)
```

A tag clone is intentionally detached at the release. `main` is the delivery branch; do not switch the source to a newer commit while keeping an older `dist/`. For updates, use the matching release or rebuild that source. Never force-reset an existing checkout with local changes.

## 2. Read-only preflight

```sh
cd "$HOME/hermes-kiosk-dashboard"
/usr/bin/python3 --version
ss -ltn 'sport = :9121'
systemctl --user status dashboard-kiosk.service --no-pager
xrandr --query
/usr/bin/python3 -m unittest discover -s server -v
```

Python **3.11+ standard library only**: no apt dependency changes, no pip and no Node are needed for the release. Port 9121 must be free; do not stop an unrelated listener. The upstream dashboard must be available locally on port 9119 in its existing loopback authentication mode. Inspect the stock dashboard on desktop without fetching or printing its injected session token.

Record the current service/display health using your existing local inventory. Preserve the agent gateways, notes API, case monitor, case browser, Freenove tasks/controller and display rotation. Do not publish that inventory, raw status payloads or logs to GitHub.

## 3. Manual run before any kiosk change

```sh
cd "$HOME/hermes-kiosk-dashboard"
/usr/bin/python3 server/hub.py
```

In a second terminal, inspect only a small summary:

```sh
/usr/bin/python3 -c 'import json, urllib.request; d=json.load(urllib.request.urlopen("http://127.0.0.1:9121/api/hub",timeout=20)); print({"source":d["source"],"availability":d["availability"],"sessions":len(d["sessions"]),"jobs":len(d["jobs"])})'
```

Open **http://127.0.0.1:9121/?source=live&view=kiosk** in a temporary desktop browser window. It must show `Live · read only` when all three sources are available. `Demo data` is not installation acceptance. `Partial data` requires identifying the unavailable section. `Disconnected` means the aggregator itself cannot be read.

The aggregator automatically handles session-token discovery/rotation, exclusively in memory. Do not supply a token in a command, environment file, query string or browser storage. If the HTML stops exposing a token, or the upstream switches authentication modes, protected sections should remain unavailable; do not work around this by broadening the proxy or requesting secret endpoints.

## 4. Optional user unit

After manual validation, stop only this foreground process with Ctrl+C. Inspect `deploy/hermes-kiosk-dashboard.service`. It uses `%h/hermes-kiosk-dashboard` and `%u` (the current desktop user); install from that user's session, never as a system/root unit. It launches no browser.

```sh
(
  set -eu
  cd "$HOME/hermes-kiosk-dashboard"
  mkdir -p "$HOME/.config/systemd/user"
  test ! -e "$HOME/.config/systemd/user/hermes-kiosk-dashboard.service"
  cp deploy/hermes-kiosk-dashboard.service "$HOME/.config/systemd/user/hermes-kiosk-dashboard.service"
  systemctl --user daemon-reload
  systemctl --user enable --now hermes-kiosk-dashboard.service
  systemctl --user status hermes-kiosk-dashboard.service --no-pager
)
```

If the destination already exists, stop and inspect it rather than overwriting. If a different free port is necessary, change `--port` in this new unit and the new dashboard URL consistently; leave upstream 9119 and existing services unchanged.

## 5. Pi acceptance

1. Verify live connectivity state, last-update times and error indicators against the stock 9119 dashboard. Missing expected platforms must say `unknown`; errors may show safe codes, with raw error text omitted.
2. Compare session titles/source/model/times and cron names/next-run/last-result against the stock UI. The list is limited to the latest 20 sessions and 100 jobs. Session detail uses metadata already in the list. Missing `is_active` is `Unknown`, not `Inactive`. An absent next run is `Not reported`, not a calculated schedule.
3. Observe for at least two minutes. Verify samples update and activity events appear when source metadata actually changes. Activity is observed since this aggregator started; it is not historical conversation content. No changes means no new events. Check CPU/load locally.
4. Verify source failures are independent. A failed cron/session read must not fabricate an empty successful list or clear valid platform status. No raw errors, prompts, messages, credentials, delivery destinations or paths should appear.
5. Test stop/start of **only** `hermes-kiosk-dashboard.service`: `systemctl --user stop hermes-kiosk-dashboard.service`, confirm `Disconnected`, then `systemctl --user start hermes-kiosk-dashboard.service` and confirm automatic recovery. Do not restart production gateways merely to test token rotation; that case is covered by fixture tests, and can be observed during a later planned gateway restart.
6. Confirm all existing services and both other screens retain their previous state. Record exact upstream version and any schema differences locally. Current upstream source compatibility does not prove this installed version's runtime behaviour.

## 6. Repoint the existing kiosk after acceptance

Inspect the current `dashboard-kiosk.service` and its launcher first. If it uses `$HOME/.local/bin/dashboard-kiosk.sh`, make this backup before editing:

```sh
(
  set -eu
  test -f "$HOME/.local/bin/dashboard-kiosk.sh"
  test ! -e "$HOME/.local/bin/dashboard-kiosk.sh.before-hermes-kiosk-v1.0.0"
  cp -p "$HOME/.local/bin/dashboard-kiosk.sh" "$HOME/.local/bin/dashboard-kiosk.sh.before-hermes-kiosk-v1.0.0"
)
```

Edit only the launcher's existing URL from `http://127.0.0.1:9119` to **`http://127.0.0.1:9121/?source=live&view=kiosk`**. Keep the new URL quoted so its `&` is not interpreted by the shell. Preserve every other browser flag, profile, relaunch loop and dynamic output-detection rule. If the URL is supplied elsewhere, back up and edit that actual source instead; do not create a second kiosk launcher. Validate the script syntax with `bash -n "$HOME/.local/bin/dashboard-kiosk.sh"` if it is a Bash script.

```sh
systemctl --user restart dashboard-kiosk.service
```

Verify the actual **400×1280** panel at **100% browser zoom**, touch navigation, and no Overview scrolling. Longer session/job/activity views can scroll. Confirm output placement from the live system; do not hardcode geometry from older notes. Do not alter DSI rotation, the separate case dashboard, either main desktop window or any other Chromium profile.

## 7. Exact rollback for the backed-up launcher

Restore the original URL/launcher and restart only the kiosk, then disable the new aggregator:

```sh
(
  set -eu
  test -f "$HOME/.local/bin/dashboard-kiosk.sh.before-hermes-kiosk-v1.0.0"
  cp -p "$HOME/.local/bin/dashboard-kiosk.sh.before-hermes-kiosk-v1.0.0" "$HOME/.local/bin/dashboard-kiosk.sh"
  systemctl --user restart dashboard-kiosk.service
  systemctl --user disable --now hermes-kiosk-dashboard.service
)
```

Confirm the panel is back at **http://127.0.0.1:9119**. If the launch URL was stored elsewhere, restore the corresponding backup instead. Keep files for diagnosis. No gateway, notes, case or rotation service needs restoration because none was changed.

## Report back privately

Exact repo URL, branch/tag and full commit; verified archive checksum; install directory; upstream version; read-only acceptance results; aggregator service state; actual kiosk URL/geometry/zoom; unavailable fields; and unchanged services/screens. Keep screenshots containing real session titles or other operational data out of the public repository. Distinguish downloaded, running, validated and kiosk repointed.
