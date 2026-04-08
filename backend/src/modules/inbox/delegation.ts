import { CONNECTPLUS_KEEPER_EMAIL } from "../settings/keeperEmail";

/** Mailboxes the keeper account may view via ?mailbox= when calling inbox APIs. */
export const INBOX_DELEGATABLE_MAILBOXES: readonly string[] = [CONNECTPLUS_KEEPER_EMAIL];

export function resolveInboxMailbox(authUserEmail: string, requestedMailbox: unknown): string {
  const auth = authUserEmail.trim().toLowerCase();
  if (auth !== CONNECTPLUS_KEEPER_EMAIL.toLowerCase()) {
    return authUserEmail;
  }
  if (requestedMailbox == null || typeof requestedMailbox !== "string") {
    return authUserEmail;
  }
  const req = requestedMailbox.trim().toLowerCase();
  for (const allowed of INBOX_DELEGATABLE_MAILBOXES) {
    if (allowed.toLowerCase() === req) {
      return allowed;
    }
  }
  return authUserEmail;
}
