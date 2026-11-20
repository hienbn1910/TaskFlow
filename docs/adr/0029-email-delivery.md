# ADR-0029: Email through an HTTP API, Mailpit locally, links to the frontend

- **Status:** Accepted (one open question: domain, decide before M6)
- **Date:** 2026-11-21

## Context
- Render's free tier blocks outbound SMTP ports 25, 465 and 587. The planned Gmail SMTP would fail in production.
- Resend's free tier: 100 emails/day, 3,000/month. Sending to arbitrary addresses requires a verified domain.
- The plan used `BACKEND_URL` for email links, but invitation and reset links open **pages** of the web app.
- Accepting an invitation checks that the user's email matches, but nothing proves the user owns that email.

## Decision
1. A `MailService` port in `modules/mail` with adapters:
   - production: HTTP API (proposal: Resend);
   - local development: SMTP to **Mailpit** (new `docker-compose` service, web UI on `localhost:8025`);
   - tests: in-memory fake (RULE.md §7, external services mocked).
2. Never SMTP in production.
3. Links use `FRONTEND_URL` (e.g. `${FRONTEND_URL}/invite?token=…`). `BACKEND_URL` is removed. The page reads the token, removes it from the address bar, and sends it in a POST body.
4. Plain HTML + text templates, no tracking pixels.
5. Quota guard: invitations capped at 20 per workspace per day (ADR-0031); the mail adapter stops at 90 emails/day, logs a warning, and the sweep retries the next day.
6. **Email verification** (M6): `users.emailVerifiedAt`, verification email at registration. From M6 on, accepting an invitation requires a verified email equal to the invited one. Before M6 only the match is checked: accepted risk, because the attacker would also need the invitation link, which only the inviter and the invitee have.

## Open question (decide before M6)
| Option | Cost | Effect |
|---|---|---|
| **A (recommended).** Buy a domain (~10 USD/year), verify it in Resend | Money | Emails reach any address with good deliverability. Also allows `app.` / `api.` on one site (ADR-0020 upgrade) |
| B. Provider with single-sender verification (send "from" a personal address) | Free | Often lands in spam (the sender domain does not authorize the provider) |

Until decided, invitations work by copying the link (M3).

## Consequences
`docker-compose.yml` gains `mailpit` in M6 (extends Decision #3). `.env.example` gains `MAIL_PROVIDER`, `MAIL_FROM`, `RESEND_API_KEY`.
