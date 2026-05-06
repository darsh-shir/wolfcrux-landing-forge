# Final QA Pass — Wolfcrux

You've asked for a thorough end-to-end check across the whole site (mobile + desktop), test every feature, find UI/functional problems, and fix them. Here's how I'll approach it so credits aren't wasted on aimless poking.

## Phase 1 — Discovery (read-only, cheap)

1. Skim every route and key component for obvious issues (dead imports, broken conditionals, missing keys, responsive classes).
2. Run the Supabase linter and security scan to catch backend/RLS issues.
3. Check dev-server logs for build warnings/errors.

## Phase 2 — Live testing in the browser

I'll drive the preview at two viewports and walk through every page.

**Desktop (1366×768)** and **Mobile (390×844)** for each:

```text
Public:
  /                Landing — hero, animations, CTAs, footer links
  /about           Layout, scroll, images
  /technology      Same
  /testimonials    Carousel works, autoplay, mobile swipe
  /careers         Form (if any), layout
  /contact         Submit form → confirm email goes to info@wolfcrux.com

Auth:
  /auth            Login, validation, error states

Logged-in user:
  /my-data         Tabs: Progress, Analytics, Payouts, LTO, Leaves, Password
                   - Charts render
                   - Calendar heatmap
                   - Leave application submit
                   - Password change
  /dashboard       Terminal — index cards, ticker tape, market clock,
                   movers, news, earnings, economic calendar, sentiment,
                   sectors, splits, peers, compare stocks
  /practice        Level 2 box, tape, hotkey trainer game,
                   H toggle, top-row digits for qty, instant price

Admin (if I have access; otherwise note for you):
  /admin           Dashboard, Users, Trader Config, Trader Progress (mobile!),
                   Trading Data Entry/View, Payout Sheet/Tracker/Calendar,
                   Monthly + Single-day PnL, Pool, LTO, Desk Cost, Leaves,
                   Salary Backup, Seat Editor, Baseline Seeder
```

For each screen I check: layout at both viewports, console errors, network failures, that the primary action actually works (not just that the button clicks).

## Phase 3 — Fix what I find

Group fixes into sensible commits:
- **Critical** (broken feature, crash, data wrong) — fix immediately
- **UI/responsive** (overflow, unreadable text, overlap) — fix in batch
- **Polish** (spacing, copy, hover states) — only if time allows

After each fix I re-test that screen.

## Phase 4 — Report

Final message with: what I tested, what I fixed (file-by-file), what I couldn't fix (and why), and anything that needs your decision.

---

## Things I need from you up front

1. **Admin login** — the browser shares your preview's session. Please log in to the preview as an admin **before I start** so I can test admin pages. If you're already logged in, great.
2. **Destructive actions** — for things like "delete user", "release LTO", "submit payout", I will **not** click them on real data. I'll verify the UI opens correctly and tell you. Confirm that's what you want, or tell me a safe test user/account I can use.
3. **Contact form** — okay if I send 1 test submission to info@wolfcrux.com? (yes/no)
4. **Scope of fixes** — for anything bigger than a localized fix (e.g. "this whole component needs a rewrite"), should I:
   - (a) just do it, or
   - (b) stop and ask first?

If you reply "approve, do everything, contact form ok, just fix it" I'll run the whole pass without further interruption. Otherwise tell me which of the above to change and I'll adjust.