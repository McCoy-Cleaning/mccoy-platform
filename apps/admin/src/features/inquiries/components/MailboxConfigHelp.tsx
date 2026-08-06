/** Graph/IMAP configuration help shown inside ErrorState when list load returns `code: config`. */
export function MailboxConfigHelp() {
  return (
    <p className="mx-auto max-w-md text-sm leading-relaxed text-white/55">
      Zet <code className="text-white/75">FORM_INBOX_PROVIDER=imap</code> terwijl Graph nog niet klaar
      is, plus SMTP_* / FORM_INBOX_* (IMAP lezen + SMTP versturen). Of configureer Microsoft Graph. Zie
      docs/apps-and-hosts.md.
    </p>
  );
}
