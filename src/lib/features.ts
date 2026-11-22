/**
 * Features that need the database update in supabase/migrations
 * (20261122160000_watchlists_contact_messages_job_applications.sql and
 * 20261123100000_pnl_adjustments.sql). Until those tables exist, the site
 * keeps the old behaviour: contact form and job applications open the
 * visitor's email app, the Terminal watchlist stays in the browser, and
 * Payout Sheet adjustments are hidden.
 *
 * Set to true once the database has been updated.
 */
export const DB_UPDATE_APPLIED = true;
