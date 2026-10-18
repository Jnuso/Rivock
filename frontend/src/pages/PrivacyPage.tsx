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
        <h2>Publication and reports</h2>
        <p>
          Posts, replies and profile changes publish without automated content
          review in this version. Publication does not mean that a moderator or
          AI has checked the text. Account restrictions, posting limits and
          content validation still apply.
        </p>
        <p>
          You can report a post, reply or profile for moderator review. Reports
          are private and do not automatically hide content; a moderator can
          remove content or restrict an account after reviewing it.
        </p>
        <p>
          Gemma reviews are currently disabled. Rivock does not send
          contribution text to an AI provider in this mode. AI assistance with
          reported content is a future design; we will update this notice before
          enabling it.
        </p>
        <p>
          Retention targets for private submission history are seven days after
          completion and thirty days for unresolved submissions. Report and
          admin-note text is targeted for removal after ninety days; moderation,
          report and audit records after one year. Minimal identity, replay and
          deletion markers remain to preserve account linkage and prevent old
          retries or restored backups from undoing deletions.
        </p>
        {import.meta.env.VITE_APP_ENVIRONMENT === "preview" && (
          <p role="status">
            Automatic cleanup is not enabled in this preview yet, so stored
            history may remain longer than these targets. Please use fictional
            content. Published contributions stay public until deleted or
            removed.
          </p>
        )}
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
          Deactivation does not delete your Clerk sign-in account. Backups have
          a separate retention period; the deployment operator must publish
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
          clears the corresponding drafts when storage permits. If storage
          prevents removal, an older stored copy may remain; keep this tab open
          so cleanup can retry when access returns. Fictional demo accounts are
          labeled; their original example conversations are not scraped Reddit
          content.
        </p>
        <p>
          Download draft saves a text copy of the current editor on your device;
          it does not submit or publish it. Downloaded copies are separate from
          Rivock’s browser drafts and remain until you remove them. If browser
          saving fails, Retry saving draft tries again with your current text
          and starts a new recovery window when successful.
        </p>
      </section>
    </div>
  );
}
