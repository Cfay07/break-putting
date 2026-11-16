import type { ReactNode } from 'react';

const UPDATED = 'November 16, 2026';
const CONTACT = 'https://conorfayard.com/contact';

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="legal">
      <h1 className="page-title">{title}</h1>
      <p className="small muted">Last updated {UPDATED}</p>
      {children}
      <p>
        Questions, or something here looks wrong: <a href={CONTACT}>conorfayard.com/contact</a>.
      </p>
    </article>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy">
      <p>
        BREAK! is made by Conor Fayard, an independent developer in Northern Illinois. This page says what the app
        stores, who can see it, and how to delete it.
      </p>

      <h2>Without an account</h2>
      <p>Everything you log stays on your phone. Nothing is sent anywhere except course searches, described below.</p>

      <h2>With an account</h2>
      <p>
        Your email and password sign you in. The password is checked by the database's sign-in service and is never
        stored or seen in plain text. Your rounds, practice, putters, drills and settings are stored so they back up and
        follow you to a new phone. Only you can read them.
      </p>

      <h2>On a team</h2>
      <p>Your teammates, and the team's coaches, can see:</p>
      <ul>
        <li>The name you set for the team.</li>
        <li>
          Your summary numbers: putts, three-putts and strokes gained per round, and the others on the leaderboard.
        </li>
        <li>
          Each finished round's course, date, score, putts, and for every hole the number of putts, the first putt's
          length and the score against par.
        </li>
        <li>Each practice set's drill, date and score.</li>
        <li>While you are playing, which hole you are on and the course.</li>
        <li>Who tapped Nice on what.</li>
      </ul>
      <p>
        They cannot see your putt-by-putt detail beyond that: reads, misses, putter or notes. Leave a team and its
        players can no longer see any of it.
      </p>

      <h2>Shared rounds</h2>
      <p>A round you share by link can be opened by anyone who has the link.</p>

      <h2>Course searches</h2>
      <p>
        When you search for a course, the search text goes to two public golf course databases. No account details go
        with it.
      </p>

      <h2>What does not happen</h2>
      <p>
        No ads, no analytics, no trackers. Your data is not sold or shared with anyone for marketing. The servers that
        deliver the app see your IP address, as any website does.
      </p>

      <h2>Age</h2>
      <p>BREAK! is not for children under 13. If you are under 13, do not make an account.</p>

      <h2>Deleting your account</h2>
      <p>
        Settings, then Account, then Delete my account. It removes your account and everything stored in it, including
        everything your teams could see. Deleted data can stay in the database's backups for up to seven days. If you
        own a team with other players on it, ask for it to be handed over first so the team is not deleted with you.
      </p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms">
      <p>Using BREAK! means agreeing to these terms.</p>

      <h2>What it costs</h2>
      <p>
        Free for players: logging, stats, practice, the team feed and the leaderboard. A team plan adds the Coach view
        and the week's practice. Team plans are paid per season by invoice, run through the date on the invoice, and do
        not renew on their own.
      </p>

      <h2>Your data</h2>
      <p>
        What you log is yours. You let BREAK! store it and show it to your teams as the{' '}
        <a href="#/privacy">privacy page</a> describes. You can delete it any time.
      </p>

      <h2>Fair use</h2>
      <p>
        Do not get into anyone else's account, log rounds for someone without their permission, copy the app's data in
        bulk, or use it to harass anyone. Accounts that do can be closed.
      </p>

      <h2>The numbers</h2>
      <p>
        Strokes gained, make chances and every other stat are estimates from what was logged, measured against PGA Tour
        averages. They can be wrong. Use them to decide what to practice, not as a guarantee of anything.
      </p>

      <h2>No warranty</h2>
      <p>
        BREAK! is provided as it is. It can go down or lose data, so back up rounds you care about from Settings.
        Liability is limited to what you paid for BREAK! in the last twelve months.
      </p>

      <h2>Changes</h2>
      <p>
        These terms can change. The date at the top says when. Using the app after a change means agreeing to the new
        version.
      </p>

      <p>These terms are governed by the laws of Illinois.</p>
    </Page>
  );
}
