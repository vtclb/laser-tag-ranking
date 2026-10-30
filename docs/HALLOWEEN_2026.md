# Halloween 2026: Review-Only Reader

Owner authorized a separate branch/PR on 2026-10-30. No merge or deployment.

This adds `#halloween` to the current v2 router and a card within the homepage's
existing supplementary events/tournament area. Bottom navigation, profiles,
league calculations, balance/admin, GAS and normal data integrations are unchanged.

The page reads only `v2/data/events/halloween-2026.json` using a bounded GET.
Pending/empty, current/final, unavailable, retry and nickname-search states are
explicit. Mobile details expose collections, sets, artifacts, coins, wins and
awards; known players link to the current `#player?league=...&nick=...` route.
Guests do not receive invented profile links. All user data is rendered through
textContent/DOM nodes; no task answers or admin secrets belong in this artifact.

The checked-in file is deliberately pending with no fake results. For a reviewed
real snapshot, project the `varta-halloween-results` export from HELL MASTER to
the same allowlisted schema and replace this JSON through an approved review.
Do not upload a `varta-hell-backup`, bank backup, task bank, raw Sheets rows or a
write token. The reader strips unknown fields, but that cannot undo disclosure
of a secret already committed to a public JSON file.

This PR does not implement authenticated writes, automatic synchronization,
server-side revision/idempotency enforcement or secure remote hosting of HELL
MASTER. Those require a separate authorized server stage. Export is not sync.
No ordinary league points, ranks, MVP, matches or seasonal archives are updated.

Checks: `node --test tests/halloween.test.mjs`, existing `node --test tests/*.test.mjs`,
and a browser review of the actual root and /v2 router at mobile/desktop widths,
pending results, 13-person fixture, search, detail disclosure, profile URL and
failure/retry. Fixtures remain local test data, not event statistics.
