# Source evidence and compatibility

The supplied integration brief described locally verified Hermes 0.20.5 loopback authentication and sample endpoint envelopes. It is intentionally not redistributed because it includes a private environment inventory. A public `v0.20.5` Git tag could not be resolved during development.

Current upstream source was separately inspected at commit **1e69c12b64dba4090eddffeae27f5a147068d34b**:

- [web/src/lib/api.ts](https://github.com/NousResearch/hermes-agent/blob/1e69c12b64dba4090eddffeae27f5a147068d34b/web/src/lib/api.ts): injected session-token header, session query paths and `SessionInfo`, `StatusResponse`, `PlatformStatus`, `CronJob` schemas.
- [hermes_cli/web_server.py](https://github.com/NousResearch/hermes-agent/blob/1e69c12b64dba4090eddffeae27f5a147068d34b/hermes_cli/web_server.py): token validation/loopback mode. Current upstream also has other authentication modes; this adapter intentionally supports the brief's loopback token flow only.
- [Official web dashboard documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard).
- [Prior case-dashboard architecture](https://github.com/JovanJovic/hermes-case-dashboard/tree/4b4dfb7ac0f2a78b20a11307790b79eb9a414563): independent local Python service, static React frontend and release/handoff approach.

Confirmed: the supplied live samples and those source contracts. Inference: compatible additional metadata fields on the installed version. Unknown: the full installed payloads and physical kiosk behaviour. Missing fields remain unknown. Pi-side acceptance compares each displayed field against the stock dashboard without publishing private payloads. No code in this repository reads private Pi files or manages existing services.
