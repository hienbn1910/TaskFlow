# ADR-0019: Co-locate in one region; no application cache until a measurement asks for one

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
- Every workspace request runs at least three database queries: reload user (Decision #15), membership (WorkspaceGuard), business query.
- In one region each costs ~2 ms. Across regions (Singapore ↔ us-east-1, ~220 ms round trip) the same three cost ~660 ms and break the latency target alone (WORKFLOW.md §3 latency budget).
- RULE.md §4 asked for caching of read-heavy data without a strategy. Caching the user or the membership would break Decision #15 (a blocked user loses access at once) unless every write invalidates it.
- Vercel caches proxied responses when the upstream sends cache headers.

## Decision
1. **One region for everything stateful:** Render web service, Render Key Value and Neon in **Singapore**. If a provider lacks it, choose the closest region shared by all three.
2. **No application cache** (Redis or in-memory) for M2–M6. User, membership and role are read from PostgreSQL on every request.
3. **Every API response sends `Cache-Control: no-store`.** The Vercel proxy (ADR-0020) and browsers never cache user data.
4. A cache is added only when a measured endpoint misses its NFR target, and then:
   - key prefixed by tenant: `ws:{workspaceId}:…` for tenant data;
   - invalidated in the same service method that writes the data;
   - TTL ≤ 60 s as a safety net;
   - never for authentication or authorization state (user status, membership, role).

## Alternatives considered
| Option | Rejected because |
|---|---|
| Redis cache for user + membership | Saves ~4 ms per request, costs invalidation logic and the Decision #15 guarantee |
| In-memory LRU | Wrong as soon as there are two instances (ADR-0018) |

## Consequences
- Two cheap primary-key / unique lookups per workspace request: within budget.
- RULE.md §4 "caching" item replaced by these rules.
