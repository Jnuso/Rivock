import { Link } from "react-router-dom";
export function PrivacyPage() {
  return (
    <div className="stack">
      <h1>Privacy and participation</h1>
      <section className="card stack">
        <h2>Public conversations</h2>
        <p>
          Anyone can read published threads, replies and profiles without an
          account. Use a pseudonym and avoid posting names, addresses or other
          identifying information. Blocking changes your signed-in experience;
          it cannot make public text private.
        </p>
      </section>
      <section className="card stack">
        <h2>Checks before publication</h2>
        <p>
          Submitted text is checked for spam and abuse before it appears
          publicly. When AI moderation is enabled, submitted text is sent to the
          configured third-party AI provider. Rivock does not send your sign-in
          token, email or password with that check. Pending drafts stay visible
          only to you and administrators.
        </p>
        <p>
          The provider’s exact data-retention terms must be published here
          before the live service enables that provider.
        </p>
        <p>
          Completed submission text expires after seven days; unresolved
          submissions expire after thirty days. Report and admin-note text
          expires after ninety days. Moderation-attempt, report and audit
          records expire after one year. Minimal identity, replay and deletion
          markers remain to preserve account linkage and prevent old retries or
          restored backups from undoing deletions.
        </p>
      </section>
      <section className="card stack">
        <h2>Your controls</h2>
        <p>
          You can delete your contribution text, remove saved threads, block
          users and report abuse. Deleting text leaves a placeholder so other
          people’s replies remain readable. Deactivation hides your profile,
          clears your bio/saves/notifications and prevents participation. Your
          existing public contributions remain under [deleted]; delete their
          text first if you want it removed.
        </p>
        <p>
          Deactivation does not delete your Clerk sign-in account. Backups
          have a separate retention period; the deployment operator must publish
          contact and recovery details before public launch.
        </p>
        <Link to="/settings">Account settings</Link>
      </section>
      <section className="card stack">
        <h2>Browser drafts and demonstration content</h2>
        <p>
          Drafts recover from this tab’s session storage for up to 24 hours,
          including through sign-in redirects. If browser storage is blocked,
          drafts stay in memory during navigation within this tab and cannot
          survive a reload or redirect; closing the tab prompts a warning.
          Submitting, discarding, signing out, changing accounts or deactivating
          clears the corresponding drafts. Fictional demo accounts are labeled;
          their original example conversations are not scraped Reddit content.
        </p>
      </section>
    </div>
  );
}
