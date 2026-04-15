import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { Award, Pencil, Plus, Trash2 } from "lucide-react";
import {
  certificationFileAbsoluteUrl,
  skillsApi,
  type UserCertificationRow,
  type UserSkillRow,
} from "../../lib/skillsApi";
import { skillsKeys } from "../../lib/queryKeys";

function fmtDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  try {
    return format(new Date(iso + "T12:00:00"), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

export default function SkillsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: skillsKeys.mine(),
    queryFn: () => skillsApi.loadAll(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: skillsKeys.all });
  };

  const [skillModal, setSkillModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; row: UserSkillRow }
    | null
  >(null);
  const [certModal, setCertModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; row: UserCertificationRow }
    | null
  >(null);

  const createSkillMut = useMutation({
    mutationFn: skillsApi.createSkill,
    onSuccess: () => {
      toast.success("Skill added");
      invalidate();
      setSkillModal(null);
    },
    onError: () => toast.error("Could not save skill"),
  });

  const patchSkillMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof skillsApi.patchSkill>[1] }) =>
      skillsApi.patchSkill(id, body),
    onSuccess: () => {
      toast.success("Skill updated");
      invalidate();
      setSkillModal(null);
    },
    onError: () => toast.error("Could not update skill"),
  });

  const deleteSkillMut = useMutation({
    mutationFn: skillsApi.deleteSkill,
    onSuccess: () => {
      toast.success("Skill removed");
      invalidate();
    },
    onError: () => toast.error("Could not delete skill"),
  });

  const createCertMut = useMutation({
    mutationFn: ({
      body,
      certificateFile,
    }: {
      body: Parameters<typeof skillsApi.createCertification>[0];
      certificateFile?: File | null;
    }) => skillsApi.createCertification(body, certificateFile ?? undefined),
    onSuccess: () => {
      toast.success("Certification added");
      invalidate();
      setCertModal(null);
    },
    onError: () => toast.error("Could not save certification"),
  });

  const patchCertMut = useMutation({
    mutationFn: ({
      id,
      body,
      opts,
    }: {
      id: number;
      body: Parameters<typeof skillsApi.patchCertification>[1];
      opts?: Parameters<typeof skillsApi.patchCertification>[2];
    }) => skillsApi.patchCertification(id, body, opts),
    onSuccess: () => {
      toast.success("Certification updated");
      invalidate();
      setCertModal(null);
    },
    onError: () => toast.error("Could not update certification"),
  });

  const deleteCertMut = useMutation({
    mutationFn: skillsApi.deleteCertification,
    onSuccess: () => {
      toast.success("Certification removed");
      invalidate();
    },
    onError: () => toast.error("Could not delete certification"),
  });

  const skills = query.data?.skills ?? [];
  const certifications = query.data?.certifications ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">People &amp; workplace</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Skills</h1>
        <p className="mt-1 text-sm text-neutral-500">Skills and certifications</p>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-600">Could not load your profile. Try again later.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)]/80 px-5 py-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Skills</h2>
              <button
                type="button"
                onClick={() => setSkillModal({ mode: "create" })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
              >
                <Plus className="h-4 w-4" />
                Add skill
              </button>
            </div>
            <div className="p-5">
              {skills.length === 0 ? (
                <p className="text-sm text-neutral-500">No skills yet. Add your strengths and tools you use.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]/60">
                  {skills.map(s => (
                    <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--text-primary)]">{s.name}</p>
                        {s.proficiency ? (
                          <p className="mt-0.5 text-xs text-neutral-500">{s.proficiency}</p>
                        ) : null}
                        {s.notes ? (
                          <p className="mt-1 text-sm text-neutral-600">{s.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => setSkillModal({ mode: "edit", row: s })}
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-[var(--text-primary)] dark:hover:bg-neutral-800"
                          aria-label="Edit skill"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove “${s.name}” from your skills?`)) {
                              deleteSkillMut.mutate(s.id);
                            }
                          }}
                          className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                          aria-label="Delete skill"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)]/80 px-5 py-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-[var(--accent)]" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Certifications</h2>
              </div>
              <button
                type="button"
                onClick={() => setCertModal({ mode: "create" })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <Plus className="h-4 w-4" />
                Add certification
              </button>
            </div>
            <div className="p-5">
              {certifications.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No certifications yet. Add licenses, credentials, and exam passes.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)]/60">
                  {certifications.map(c => (
                    <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--text-primary)]">{c.name}</p>
                        {c.issuer ? (
                          <p className="mt-0.5 text-xs text-neutral-500">{c.issuer}</p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                          {c.credentialId ? <span>ID: {c.credentialId}</span> : null}
                          <span>Issued: {fmtDate(c.issuedOn)}</span>
                          <span>Expires: {fmtDate(c.expiresOn)}</span>
                        </div>
                        {c.notes ? (
                          <p className="mt-1 text-sm text-neutral-600">{c.notes}</p>
                        ) : null}
                        {c.certificateDownloadUrl && certificationFileAbsoluteUrl(c) ? (
                          <a
                            href={certificationFileAbsoluteUrl(c)!}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs font-medium text-[var(--accent-primary)] underline"
                          >
                            View certificate
                            {c.certificateOriginalName ? ` (${c.certificateOriginalName})` : ""}
                          </a>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => setCertModal({ mode: "edit", row: c })}
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-[var(--text-primary)] dark:hover:bg-neutral-800"
                          aria-label="Edit certification"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove “${c.name}” from your certifications?`)) {
                              deleteCertMut.mutate(c.id);
                            }
                          }}
                          className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                          aria-label="Delete certification"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      {skillModal ? (
        <SkillFormModal
          mode={skillModal.mode}
          initial={skillModal.mode === "edit" ? skillModal.row : undefined}
          busy={createSkillMut.isPending || patchSkillMut.isPending}
          onClose={() => setSkillModal(null)}
          onSave={body => {
            if (skillModal.mode === "create") {
              createSkillMut.mutate(body);
            } else {
              patchSkillMut.mutate({ id: skillModal.row.id, body });
            }
          }}
        />
      ) : null}

      {certModal ? (
        <CertFormModal
          mode={certModal.mode}
          initial={certModal.mode === "edit" ? certModal.row : undefined}
          busy={createCertMut.isPending || patchCertMut.isPending}
          onClose={() => setCertModal(null)}
          onSave={payload => {
            if (certModal.mode === "create") {
              createCertMut.mutate({
                body: payload.body,
                certificateFile: payload.certificateFile,
              });
            } else {
              patchCertMut.mutate({
                id: certModal.row.id,
                body: payload.body,
                opts:
                  payload.certificateFile || payload.clearCertificate
                    ? {
                        certificateFile: payload.certificateFile,
                        clearCertificate: payload.clearCertificate,
                      }
                    : undefined,
              });
            }
          }}
        />
      ) : null}
    </div>
  );
}

function SkillFormModal({
  mode,
  initial,
  busy,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: UserSkillRow;
  busy: boolean;
  onClose: () => void;
  onSave: (body: { name: string; proficiency?: string | null; notes?: string | null }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [proficiency, setProficiency] = useState(initial?.proficiency ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {mode === "create" ? "Add skill" : "Edit skill"}
        </h3>
        <form
          className="mt-4 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            if (!name.trim()) {
              return;
            }
            onSave({
              name: name.trim(),
              proficiency: proficiency.trim() || null,
              notes: notes.trim() || null,
            });
          }}
        >
          <label className="block text-sm">
            <span className="text-neutral-500">Name</span>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text-primary)]"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-500">Proficiency (optional)</span>
            <input
              value={proficiency}
              onChange={e => setProficiency(e.target.value)}
              placeholder="e.g. Advanced, 5 years"
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text-primary)]"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-500">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text-primary)]"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-neutral-500">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CertFormModal({
  mode,
  initial,
  busy,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: UserCertificationRow;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: {
    body: {
      name: string;
      issuer?: string | null;
      credentialId?: string | null;
      issuedOn?: string | null;
      expiresOn?: string | null;
      notes?: string | null;
    };
    certificateFile?: File | null;
    clearCertificate?: boolean;
  }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [issuer, setIssuer] = useState(initial?.issuer ?? "");
  const [credentialId, setCredentialId] = useState(initial?.credentialId ?? "");
  const [issuedOn, setIssuedOn] = useState(initial?.issuedOn ?? "");
  const [expiresOn, setExpiresOn] = useState(initial?.expiresOn ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [clearCertificate, setClearCertificate] = useState(false);

  useEffect(() => {
    setName(initial?.name ?? "");
    setIssuer(initial?.issuer ?? "");
    setCredentialId(initial?.credentialId ?? "");
    setIssuedOn(initial?.issuedOn ?? "");
    setExpiresOn(initial?.expiresOn ?? "");
    setNotes(initial?.notes ?? "");
    setCertificateFile(null);
    setClearCertificate(false);
  }, [initial?.id, mode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {mode === "create" ? "Add certification" : "Edit certification"}
        </h3>
        <form
          className="mt-4 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            if (!name.trim()) {
              return;
            }
            onSave({
              body: {
                name: name.trim(),
                issuer: issuer.trim() || null,
                credentialId: credentialId.trim() || null,
                issuedOn: issuedOn.trim() || null,
                expiresOn: expiresOn.trim() || null,
                notes: notes.trim() || null,
              },
              certificateFile: certificateFile ?? undefined,
              clearCertificate: clearCertificate || undefined,
            });
          }}
        >
          <label className="block text-sm">
            <span className="text-neutral-500">Name</span>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. AWS Solutions Architect"
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text-primary)]"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-500">Issuer (optional)</span>
            <input
              value={issuer}
              onChange={e => setIssuer(e.target.value)}
              placeholder="e.g. Amazon Web Services"
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text-primary)]"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-500">Credential ID (optional)</span>
            <input
              value={credentialId}
              onChange={e => setCredentialId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text-primary)]"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-neutral-500">Issued on</span>
              <input
                type="date"
                value={issuedOn}
                onChange={e => setIssuedOn(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text-primary)]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-500">Expires on</span>
              <input
                type="date"
                value={expiresOn}
                onChange={e => setExpiresOn(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text-primary)]"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-neutral-500">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text-primary)]"
            />
          </label>
          <div className="block text-sm">
            <span className="text-neutral-500">Certificate file (optional, PDF or image)</span>
            {mode === "edit" && initial?.certificateDownloadUrl && certificationFileAbsoluteUrl(initial) && !clearCertificate ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <a
                  href={certificationFileAbsoluteUrl(initial)!}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--accent-primary)] underline"
                >
                  Open current file
                </a>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border)] px-2 py-0.5 text-[var(--text-muted)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setClearCertificate(true);
                    setCertificateFile(null);
                  }}
                >
                  Remove file
                </button>
              </div>
            ) : null}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={e => {
                const f = e.target.files?.[0] ?? null;
                setCertificateFile(f);
                if (f) {
                  setClearCertificate(false);
                }
              }}
              className="mt-1 w-full text-sm text-[var(--text-primary)] file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:file:bg-neutral-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-neutral-500">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
