import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

const CONNECTPLUS_KEEPER_EMAIL = "connectplus@cachedigitech.com";

type MailFolderId = "inbox" | "drafts" | "sentitems" | "deleteditems" | "junkemail";

const MAIL_FOLDERS: { id: MailFolderId; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "drafts", label: "Drafts" },
  { id: "sentitems", label: "Sent" },
  { id: "junkemail", label: "Junk email" },
  { id: "deleteditems", label: "Deleted" },
];

type InboxListMessage = {
  id: string;
  subject?: string;
  sender?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  receivedDateTime?: string;
  sentDateTime?: string;
  lastModifiedDateTime?: string;
  isRead?: boolean;
  hasAttachments?: boolean;
  bodyPreview?: string;
  importance?: string;
};

const INBOX_DELEGATION_MAILBOX_OPTIONS: { value: string; label: string }[] = [
  { value: CONNECTPLUS_KEEPER_EMAIL, label: "Connectplus" },
];

function uint8ToBase64(u8: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)) as unknown as number[]);
  }
  return btoa(binary);
}

async function filesToAttachments(files: FileList | null) {
  if (!files?.length) {
    return undefined;
  }
  const out: { name: string; contentType: string; contentBase64: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const buf = await f.arrayBuffer();
    out.push({
      name: f.name,
      contentType: f.type || "application/octet-stream",
      contentBase64: uint8ToBase64(new Uint8Array(buf)),
    });
  }
  return out;
}

function parseEmailList(s: string): string[] {
  return s
    .split(/[,;]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

function plainTextToHtmlBody(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${esc.replace(/\r\n/g, "\n").replace(/\n/g, "<br/>")}</p>`;
}

export function InboxPage() {
  const user = useAuthStore(s => s.user);
  const { data: userDetails } = useQuery({
    queryKey: ["user-details"],
    enabled: !!user && (!user.name || !user.email),
    queryFn: async () => {
      const response = await api.get("/api/auth/me");
      return response.data?.data?.user;
    },
  });

  const displayUser = userDetails || user;
  const userEmail = displayUser?.email;
  const canDelegateInbox =
    !!userEmail && userEmail.trim().toLowerCase() === CONNECTPLUS_KEEPER_EMAIL.toLowerCase();

  const [delegateMailbox, setDelegateMailbox] = useState<string>(CONNECTPLUS_KEEPER_EMAIL);
  const [folder, setFolder] = useState<MailFolderId>("inbox");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBodyText, setComposeBodyText] = useState("");
  const [composeFiles, setComposeFiles] = useState<FileList | null>(null);

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyKind, setReplyKind] = useState<"reply" | "replyAll">("reply");
  const [replyText, setReplyText] = useState("");

  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardComment, setForwardComment] = useState("");

  const activeMailbox = canDelegateInbox ? delegateMailbox : userEmail ?? "";

  const mailboxParams = useMemo(
    () => (canDelegateInbox ? { mailbox: delegateMailbox } : undefined),
    [canDelegateInbox, delegateMailbox],
  );

  useEffect(() => {
    setPage(1);
    setSelectedEmail(null);
  }, [canDelegateInbox, delegateMailbox, folder]);

  const queryClient = useQueryClient();

  const { data: inboxData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["inbox", page, folder, userEmail, canDelegateInbox ? delegateMailbox : null],
    enabled: !!userEmail,
    queryFn: async () => {
      const params: Record<string, string | number> = {
        top: pageSize,
        skip: (page - 1) * pageSize,
        folder,
      };
      if (canDelegateInbox) {
        params.mailbox = delegateMailbox;
      }
      const response = await api.get("/api/inbox", { params });
      const raw = response.data?.data;
      if (!raw || typeof raw !== "object") {
        return { value: [] as InboxListMessage[], "@odata.count": 0 };
      }
      const value = Array.isArray((raw as { value?: unknown }).value)
        ? (raw as { value: InboxListMessage[] }).value
        : [];
      const count = (raw as { "@odata.count"?: number })["@odata.count"];
      return {
        value,
        "@odata.count": typeof count === "number" ? count : value.length,
      };
    },
  });

  const { data: emailDetail, isLoading: emailLoading, isError: emailDetailError, error: emailDetailQueryError } = useQuery({
    queryKey: ["email-detail", selectedEmail, folder, canDelegateInbox ? delegateMailbox : null],
    enabled: !!selectedEmail,
    queryFn: async () => {
      const response = await api.get(`/api/inbox/${encodeURIComponent(selectedEmail!)}`, {
        params: mailboxParams,
      });
      return response.data?.data?.email as {
        id: string;
        subject: string;
        sender: { emailAddress: { name: string; address: string } };
        toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
        ccRecipients?: Array<{ emailAddress: { name: string; address: string } }>;
        receivedDateTime: string;
        isRead: boolean;
        hasAttachments: boolean;
        body: { content: string; contentType: string };
        importance: string;
      };
    },
  });

  const { data: attachmentsData } = useQuery({
    queryKey: ["inbox-attachments", selectedEmail, canDelegateInbox ? delegateMailbox : null],
    enabled: !!selectedEmail && !!emailDetail?.hasAttachments,
    queryFn: async () => {
      const response = await api.get(`/api/inbox/${encodeURIComponent(selectedEmail!)}/attachments`, {
        params: mailboxParams,
      });
      return response.data?.data?.attachments as Array<{
        id: string;
        name?: string;
        size?: number;
        contentType?: string;
        "@odata.type"?: string;
      }>;
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await api.patch(`/api/inbox/${encodeURIComponent(messageId)}/read`, undefined, {
        params: mailboxParams,
      });
    },
    onSuccess: (_, messageId) => {
      refetch();
      if (selectedEmail === messageId) {
        queryClient.invalidateQueries({ queryKey: ["email-detail", messageId] });
      }
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const path =
        replyKind === "replyAll"
          ? `/api/inbox/${encodeURIComponent(selectedEmail!)}/replyAll`
          : `/api/inbox/${encodeURIComponent(selectedEmail!)}/reply`;
      await api.post(path, { bodyHtml: plainTextToHtmlBody(replyText) }, { params: mailboxParams });
    },
    onSuccess: async () => {
      setReplyOpen(false);
      setReplyText("");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["email-detail", selectedEmail] });
    },
  });

  const forwardMutation = useMutation({
    mutationFn: async () => {
      await api.post(
        `/api/inbox/${encodeURIComponent(selectedEmail!)}/forward`,
        { to: parseEmailList(forwardTo), comment: forwardComment || undefined },
        { params: mailboxParams },
      );
    },
    onSuccess: async () => {
      setForwardOpen(false);
      setForwardTo("");
      setForwardComment("");
      await refetch();
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (destination: "junkemail" | "deleteditems" | "inbox") => {
      await api.post(
        `/api/inbox/${encodeURIComponent(selectedEmail!)}/move`,
        { destination },
        { params: mailboxParams },
      );
    },
    onSuccess: async () => {
      setSelectedEmail(null);
      await refetch();
    },
  });

  const sendComposeMutation = useMutation({
    mutationFn: async () => {
      const attachments = await filesToAttachments(composeFiles);
      await api.post(
        "/api/inbox/compose/send",
        {
          subject: composeSubject.trim(),
          bodyHtml: plainTextToHtmlBody(composeBodyText),
          to: parseEmailList(composeTo),
          cc: composeCc.trim() ? parseEmailList(composeCc) : undefined,
          attachments,
        },
        { params: mailboxParams },
      );
    },
    onSuccess: async () => {
      setComposeOpen(false);
      setComposeSubject("");
      setComposeTo("");
      setComposeCc("");
      setComposeBodyText("");
      setComposeFiles(null);
      await refetch();
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      await api.post(
        "/api/inbox/compose/draft",
        {
          subject: composeSubject.trim() || undefined,
          bodyHtml: composeBodyText ? plainTextToHtmlBody(composeBodyText) : undefined,
          to: composeTo.trim() ? parseEmailList(composeTo) : undefined,
        },
        { params: mailboxParams },
      );
    },
    onSuccess: async () => {
      setComposeOpen(false);
      setFolder("drafts");
      await refetch();
    },
  });

  const handleEmailClick = (messageId: string, isRead: boolean) => {
    setSelectedEmail(messageId);
    if (!isRead) {
      markAsReadMutation.mutate(messageId);
    }
  };

  const formatDate = (m: InboxListMessage) => {
    const dateString = m.sentDateTime || m.receivedDateTime || m.lastModifiedDateTime;
    if (!dateString) {
      return "—";
    }
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (diffDays === 1) {
      return "Yesterday";
    }
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (!userEmail) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-neutral-500">Loading user information...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Communication</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Mail</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setComposeOpen(true);
                setComposeSubject("");
                setComposeTo("");
                setComposeCc("");
                setComposeBodyText("");
                setComposeFiles(null);
              }}
              className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              New mail
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
            >
              Refresh
            </button>
            {canDelegateInbox ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Mailbox</span>
                <select
                  value={delegateMailbox}
                  onChange={e => {
                    setDelegateMailbox(e.target.value);
                    setSelectedEmail(null);
                    setPage(1);
                  }}
                  className="min-w-[220px] rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-primary)] shadow-sm"
                >
                  {INBOX_DELEGATION_MAILBOX_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.value})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-sm text-neutral-500">Viewing {activeMailbox}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(140px,11rem)_minmax(280px,22rem)_1fr]">
        <nav className="flex flex-row flex-wrap gap-1 lg:flex-col lg:gap-0 lg:rounded-2xl lg:border lg:border-[var(--border)]/80 lg:bg-[var(--bg-surface)]/95 lg:p-2 lg:shadow-sm">
          {MAIL_FOLDERS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFolder(f.id);
                setPage(1);
                setSelectedEmail(null);
              }}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition lg:w-full ${
                folder === f.id
                  ? "bg-[var(--accent-primary)] text-white"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </nav>

        <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 shadow-sm">
          <div className="border-b border-[var(--border)]/50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Messages</h2>
              {inboxData && !isError && (
                <span className="text-xs text-neutral-500">
                  {inboxData["@odata.count"]} {inboxData["@odata.count"] === 1 ? "item" : "items"}
                </span>
              )}
            </div>
          </div>
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-neutral-500">Loading…</div>
            ) : isError ? (
              <div className="space-y-3 p-8 text-center text-sm">
                <p className="font-medium text-red-600">Couldn&apos;t load this folder</p>
                <p className="text-xs text-neutral-600">
                  {axios.isAxiosError(error)
                    ? String(
                        (error.response?.data as { message?: string } | undefined)?.message ||
                          error.message ||
                          "",
                      )
                    : error instanceof Error
                      ? error.message
                      : "Check Microsoft Graph permissions (Mail.Read) and try again."}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-medium text-[var(--text-primary)]"
                >
                  Try again
                </button>
              </div>
            ) : !inboxData?.value?.length ? (
              <div className="p-8 text-center text-sm text-neutral-500">No messages</div>
            ) : (
              <div className="divide-y divide-[var(--border)]/50">
                {inboxData.value.filter(e => e.id).map(email => (
                  <button
                    key={email.id}
                    type="button"
                    onClick={() => handleEmailClick(email.id, Boolean(email.isRead))}
                    className={`w-full p-4 text-left transition ${
                      selectedEmail === email.id
                        ? "bg-[var(--bg-elevated)]/60 ring-1 ring-[var(--text-primary)]/20"
                        : "hover:bg-[var(--bg-elevated)]/40"
                    } ${email.isRead === false ? "bg-[var(--bg-elevated)]/25" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                            {email.sender?.emailAddress?.name ||
                              email.sender?.emailAddress?.address ||
                              "(No sender)"}
                          </p>
                          {email.isRead === false && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent-primary)]" title="Unread" />
                          )}
                          {email.importance === "high" && <span className="text-xs text-red-500">!</span>}
                        </div>
                        <p className="mt-1 truncate text-sm text-[var(--text-primary)]">
                          {email.subject || "(No subject)"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{email.bodyPreview ?? ""}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
                          <span>{formatDate(email)}</span>
                          {email.hasAttachments && (
                            <span className="flex items-center gap-1" title="Has attachments">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                />
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {inboxData && !isError && inboxData["@odata.count"] > pageSize && (
            <div className="border-t border-[var(--border)]/50 p-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-neutral-500">
                  Page {page} of {Math.ceil(inboxData["@odata.count"] / pageSize)}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(inboxData["@odata.count"] / pageSize)}
                  className="rounded-lg px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="min-h-[320px] rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 shadow-sm">
          {selectedEmail ? (
            emailLoading ? (
              <div className="p-8 text-center text-sm text-neutral-500">Loading message…</div>
            ) : emailDetailError ? (
              <div className="space-y-3 p-8 text-center text-sm">
                <p className="font-medium text-red-600">Couldn&apos;t load this message</p>
                <p className="text-xs text-neutral-600">
                  {axios.isAxiosError(emailDetailQueryError)
                    ? String(
                        (emailDetailQueryError.response?.data as { message?: string } | undefined)?.message ||
                          emailDetailQueryError.message ||
                          "",
                      )
                    : emailDetailQueryError instanceof Error
                      ? emailDetailQueryError.message
                      : ""}
                </p>
              </div>
            ) : emailDetail ? (
              <div className="flex h-full min-h-[480px] flex-col">
                <div className="flex flex-wrap gap-2 border-b border-[var(--border)]/50 p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyKind("reply");
                      setReplyText("");
                      setReplyOpen(true);
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyKind("replyAll");
                      setReplyText("");
                      setReplyOpen(true);
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    Reply all
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForwardTo("");
                      setForwardComment("");
                      setForwardOpen(true);
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    Forward
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Move this message to Junk?")) {
                        moveMutation.mutate("junkemail");
                      }
                    }}
                    disabled={moveMutation.isPending}
                    className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 disabled:opacity-50"
                  >
                    Junk
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Move to Deleted items?")) {
                        moveMutation.mutate("deleteditems");
                      }
                    }}
                    disabled={moveMutation.isPending}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50"
                  >
                    Delete
                  </button>
                  {folder === "junkemail" && (
                    <button
                      type="button"
                      onClick={() => moveMutation.mutate("inbox")}
                      disabled={moveMutation.isPending}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 disabled:opacity-50"
                    >
                      Not junk
                    </button>
                  )}
                </div>

                {replyOpen && (
                  <div className="border-b border-[var(--border)]/50 bg-[var(--bg-elevated)]/40 p-4">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      {replyKind === "replyAll" ? "Reply all" : "Reply"}
                    </p>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      rows={5}
                      className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
                      placeholder="Write your reply…"
                    />
                    <p className="mt-1 text-[10px] text-neutral-500">Sends as HTML. Original thread is included by Outlook.</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={replyMutation.isPending || !replyText.trim()}
                        onClick={() => replyMutation.mutate()}
                        className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {replyMutation.isPending ? "Sending…" : "Send"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyOpen(false)}
                        className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {forwardOpen && (
                  <div className="border-b border-[var(--border)]/50 bg-[var(--bg-elevated)]/40 p-4">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">Forward</p>
                    <input
                      value={forwardTo}
                      onChange={e => setForwardTo(e.target.value)}
                      placeholder="To (comma-separated emails)"
                      className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
                    />
                    <textarea
                      value={forwardComment}
                      onChange={e => setForwardComment(e.target.value)}
                      rows={3}
                      placeholder="Optional message…"
                      className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={forwardMutation.isPending || !forwardTo.trim()}
                        onClick={() => forwardMutation.mutate()}
                        className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {forwardMutation.isPending ? "Sending…" : "Send"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setForwardOpen(false)}
                        className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="border-b border-[var(--border)]/50 p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {emailDetail.subject || "(No subject)"}
                  </h2>
                  <div className="mt-3 space-y-2 text-sm">
                    <div>
                      <span className="text-neutral-500">From: </span>
                      <span className="text-[var(--text-primary)]">
                        {emailDetail.sender?.emailAddress?.name || emailDetail.sender?.emailAddress?.address || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">To: </span>
                      <span className="text-[var(--text-primary)]">
                        {(emailDetail.toRecipients ?? [])
                          .map(r => r.emailAddress?.address)
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </span>
                    </div>
                    {(emailDetail.ccRecipients?.length ?? 0) > 0 && (
                      <div>
                        <span className="text-neutral-500">Cc: </span>
                        <span className="text-[var(--text-primary)]">
                          {(emailDetail.ccRecipients ?? [])
                            .map(r => r.emailAddress?.address)
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-neutral-500">Date: </span>
                      <span className="text-[var(--text-primary)]">
                        {new Date(emailDetail.receivedDateTime).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {emailDetail.hasAttachments && attachmentsData && attachmentsData.length > 0 && (
                    <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-elevated)]/50 p-3">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Attachments</p>
                      <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                        {attachmentsData.map(att => (
                          <li key={att.id}>
                            {att.name ?? "file"}{" "}
                            {typeof att.size === "number" ? `(${Math.round(att.size / 1024)} KB)` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <div
                    className="prose prose-sm max-w-none text-[var(--text-primary)]"
                    dangerouslySetInnerHTML={{
                      __html: emailDetail.body?.content || "",
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-neutral-500">Failed to load</div>
            )
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center p-8">
              <p className="text-sm text-neutral-500">Select a message to read</p>
            </div>
          )}
        </div>
      </div>

      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">New mail</h3>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-sm text-neutral-600"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={composeTo}
                onChange={e => setComposeTo(e.target.value)}
                placeholder="To (comma-separated)"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/50 px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
              />
              <input
                value={composeCc}
                onChange={e => setComposeCc(e.target.value)}
                placeholder="Cc (optional)"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/50 px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
              />
              <input
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                placeholder="Subject"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/50 px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
              />
              <textarea
                value={composeBodyText}
                onChange={e => setComposeBodyText(e.target.value)}
                rows={10}
                placeholder="Message"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/50 px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
              />
              <div>
                <label className="text-xs font-medium text-neutral-600">Attachments</label>
                <input
                  type="file"
                  multiple
                  onChange={e => setComposeFiles(e.target.files)}
                  className="mt-1 block w-full text-xs text-neutral-600"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sendComposeMutation.isPending || !composeSubject.trim() || !composeTo.trim()}
                onClick={() => sendComposeMutation.mutate()}
                className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sendComposeMutation.isPending ? "Sending…" : "Send"}
              </button>
              <button
                type="button"
                disabled={saveDraftMutation.isPending}
                onClick={() => saveDraftMutation.mutate()}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] disabled:opacity-50"
              >
                {saveDraftMutation.isPending ? "Saving…" : "Save draft"}
              </button>
            </div>
            {(sendComposeMutation.isError || saveDraftMutation.isError) && (
              <p className="mt-2 text-xs text-red-600">
                {String(
                  (sendComposeMutation.error as Error)?.message ||
                    (saveDraftMutation.error as Error)?.message ||
                    "Request failed. Ensure Azure app has Mail.Send and Mail.ReadWrite.",
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
