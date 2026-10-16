# Clerk setup for Rivock

Clerk replaces Entra for authentication as selected October 14, 2026. Azure remains the proposed host for the frontend/API/database. Rivock does not need a Microsoft tenant or an Entra trial to configure sign-in.

## Current local configuration

The user supplied the development publishable key on October 14. The helper configured the three ignored local environment files; native and Compose settings agree on the same instance. Clerk's public JWKS endpoint is reachable and contains an RS256 signing key. The frontend build passes with that configuration. Docker is running the local app at [Rivock](http://localhost:5173), all three migrations executed, and the current 153-test backend suite passed with PostgreSQL. The user confirmed Google sign-in, username creation, sign-out/repeat login, saved-thread persistence and the two-account Question/reply/accepted-answer/Alerts notification-link journey. Earlier read-only database checks confirmed an account, a save and a published reply submission. Email/password/recovery, production URLs and browser layout/CSP behavior remain unverified. [Gemma moderation](GEMMA_SETUP.md) passed a limited isolated evaluation and is now enabled locally with explicit user approval; a subsequent browser-created AI-approved question is verified in the moderation records.

## Configure a new development application

The supplied key is already configured locally. These steps are for replacing it or setting up another checkout.

1. Create a free account in the [Clerk dashboard](https://dashboard.clerk.com/) and create an application named **Rivock**.
2. Enable **email/password** and **Google** sign-in. Keep usernames in Rivock's own onboarding; Clerk's account identity is separate from the public pseudonym.
3. Select the **development** instance and obtain its **publishable key**, beginning `pk_test_`. This key is public. The current integration does not need a Clerk secret key.
4. Use `http://localhost:5173` for the local app URL and the hosted Account Portal for login. Configure return URLs/origins if prompted. Local API URL is `http://localhost:8000/api/v1`.

From the repository root, run:

```powershell
backend/.venv/Scripts/python.exe scripts/configure-clerk.py
```

Paste the publishable key at the prompt. The helper validates its embedded Frontend API hostname and updates **only** the root, backend and frontend ignored `.env` files. It preserves unrelated database/AI settings and removes obsolete Entra variables. It does not contact Clerk, change your provider settings, start services or deploy anything. You can also provide the public key in chat for configuration; API secrets are unnecessary.

Then check:

```powershell
backend/.venv/Scripts/python.exe scripts/check-setup.py
```

Restart the API/frontend after changing configuration. Apply `alembic upgrade head` before using the updated backend; migration `31c7a48a90c1` introduces issuer/subject identity columns. Compose runs migrations through its explicit migration service. Migration and PostgreSQL test execution are verified locally; each new Clerk instance still needs real sign-in checks.

## Manual settings

| File | Setting |
| --- | --- |
| `frontend/.env` | `VITE_CLERK_PUBLISHABLE_KEY=pk_test_<actual-public-key>` |
| `backend/.env` | `CLERK_ISSUER=https://<actual-frontend-api-host>` without a trailing slash |
| `backend/.env` | `CLERK_AUTHORIZED_PARTIES=http://localhost:5173,http://127.0.0.1:5173` |
| `backend/.env` | `CLERK_AUDIENCE=` normally blank; configure only if your session token has a custom audience |
| Root `.env` | Same public Clerk values for Compose |

The setup checker validates that the publishable key and backend issuer name the same instance. Presence/matching is not proof of successful login.

## Verify real accounts

- Anonymous feed/search works; sign-in opens Clerk's portal and returns to Rivock.
- Email/password sign-up, verification, recovery, Google login and sign-out work with real test accounts.
- First login asks for a unique Rivock username; repeat login resolves the same local account.
- Account A posts a question; B replies; A accepts the direct answer; B sees a notification and exact reply link.
- Saves, draft recovery and blocks remain private; sign-out/account switching clears drafts/caches. Invalid credentials do not silently become anonymous requests.
- Inspect phone/desktop layouts and the actual hosting CSP in a browser; component tests are insufficient for this claim.

Use fictional test content. Fresh fixture setups are visibly labeled; the current approved local setup uses Gemma. Verify its post-activation browser journey separately from the earlier identity checks.

## Production and cost review

The current [Hobby pricing page](https://clerk.com/pricing) includes 50,000 monthly retained users and up to three social connections. This is a free-plan allowance, with its own usage/feature limits; review current terms before public launch. No paid upgrade has been selected.

Configure a Clerk **production instance**, its required domain/DNS and Google OAuth credentials before deploying. The [production guide](https://clerk.com/docs/guides/development/deployment/production), checked October 14, requires a domain you own and permission to add DNS records; the user has not purchased one yet. Use `pk_live_...`, the matching production Frontend API issuer, and exact HTTPS frontend origins. The backend and production frontend build refuse development-instance configuration. Include the configured Clerk endpoints and required challenge/fraud-protection hosts in CSP, then verify them in a real browser. No broad script wildcard or `unsafe-eval` is enabled by the template.

Clerk owns credentials and session lifecycle; PostgreSQL owns usernames, status and roles. The API checks RS256, issuer, timestamps, v2, user/session IDs and allowed origin; rejects pending/machine/impersonation sessions; and uses `(issuer, subject)` for linkage. Ordinary session tokens have no audience; a configured custom audience becomes mandatory. Offline token validation observes provider revocation after token expiry (with five seconds of clock tolerance); local suspension/deactivation is checked on each protected request. No webhook or provider-account deletion synchronization is claimed.

Existing Entra rows retain their local UUID/ownership under an inert `legacy-entra:` issuer namespace. They are not automatically linked to Clerk by email, username or a matching subject string. Downgrading the identity migration after new Clerk accounts exist is refused; use a forward fix.

Implementation sources checked through Firecrawl search excerpts and installed SDK types: [React quickstart](https://clerk.com/docs/quickstarts/react), [session tokens](https://clerk.com/docs/guides/sessions/session-tokens), [JWT verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification), [CSP requirements](https://clerk.com/docs/guides/secure/best-practices/csp-headers). Google sign-in and the core two-account journey have user-reported successful checks; remaining account methods and production behavior need separate verification.
