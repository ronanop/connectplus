import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";

type CrmDepartment = { id: number; name: string; employeeCount: number };
type DeptUser = { id: number; name: string; email: string; isActive: boolean; roleName: string };

export function DepartmentManagementPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [usersModalDept, setUsersModalDept] = useState<{ id: number; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-crm-departments"],
    queryFn: async () => {
      const res = await api.get("/api/hr/crm-departments");
      return res.data?.data?.departments as CrmDepartment[];
    },
  });

  const departments = data ?? [];

  const usersModalQuery = useQuery({
    queryKey: ["hr-crm-department-users", usersModalDept?.id],
    queryFn: async () => {
      const id = usersModalDept?.id;
      if (id == null) return [];
      const res = await api.get(`/api/hr/crm-departments/${id}/users`);
      return res.data?.data?.users as DeptUser[];
    },
    enabled: usersModalDept != null,
  });

  useEffect(() => {
    if (!usersModalDept) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUsersModalDept(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [usersModalDept]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["hr-crm-departments"] });
    await queryClient.invalidateQueries({ queryKey: ["settings-departments"] });
  };

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      await api.post("/api/hr/crm-departments", { name });
    },
    onSuccess: async () => {
      setNewName("");
      setFormError(null);
      await invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setFormError(msg ?? "Could not create department");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      await api.patch(`/api/hr/crm-departments/${id}`, { name });
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditName("");
      await invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setFormError(msg ?? "Could not update");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/hr/crm-departments/${id}`);
    },
    onSuccess: async () => {
      await invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setFormError(msg ?? "Could not delete");
    },
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const n = newName.trim();
    if (!n) {
      setFormError("Enter a department name.");
      return;
    }
    createMutation.mutate(n);
  };

  const startEdit = (d: CrmDepartment) => {
    setFormError(null);
    setEditingId(d.id);
    setEditName(d.name);
  };

  const saveEdit = () => {
    if (editingId == null) return;
    const n = editName.trim();
    if (!n) {
      setFormError("Name cannot be empty.");
      return;
    }
    setFormError(null);
    updateMutation.mutate({ id: editingId, name: n });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to="/hr"
          className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to HR home
        </Link>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          Department management
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          These are the same CRM departments used in Settings → Users when assigning a user&apos;s department. Renaming a
          department updates all users who were assigned the previous name.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <label className="text-xs font-medium text-neutral-500">New department</label>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Sales, HR Department"
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {createMutation.isPending ? "Adding…" : "Add department"}
        </button>
      </form>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      {usersModalDept && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dept-users-title"
          onClick={() => setUsersModalDept(null)}
        >
          <div
            className="max-h-[min(80vh,560px)] w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h2 id="dept-users-title" className="text-sm font-semibold text-[var(--text-primary)]">
                {usersModalDept.name}
              </h2>
              <button
                type="button"
                onClick={() => setUsersModalDept(null)}
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[min(60vh,480px)] overflow-auto p-4">
              {usersModalQuery.isLoading ? (
                <p className="text-sm text-neutral-500">Loading users…</p>
              ) : usersModalQuery.isError ? (
                <p className="text-sm text-red-600">Could not load users.</p>
              ) : (usersModalQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-neutral-500">No users assigned to this department.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {usersModalQuery.data!.map(u => (
                    <li key={u.id} className="first:pt-0">
                      <Link
                        to={`/hr/users/${u.id}`}
                        onClick={() => setUsersModalDept(null)}
                        className="-mx-1 block rounded-lg px-1 py-3 text-left outline-none ring-[var(--accent-primary)] transition hover:bg-[var(--bg-elevated)] focus-visible:ring-2"
                      >
                        <p className="font-medium text-[var(--text-primary)]">{u.name}</p>
                        <p className="text-xs text-neutral-500">{u.email}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {u.roleName}
                          {u.isActive ? "" : " · Inactive"}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading departments…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="w-40 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-neutral-500">
                    No departments yet. Add one above.
                  </td>
                </tr>
              ) : (
                departments.map(d => (
                  <tr key={d.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      {editingId === d.id ? (
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 text-sm"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setUsersModalDept({ id: d.id, name: d.name })}
                          className="text-left font-medium text-[var(--text-primary)] hover:underline"
                          title="View users in this department"
                        >
                          {d.name}{" "}
                          <span className="font-normal text-neutral-500">({d.employeeCount})</span>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === d.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditName("");
                            }}
                            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={updateMutation.isPending}
                            className="rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-xs text-white disabled:opacity-60"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(d)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs text-neutral-600 hover:bg-[var(--bg-elevated)]"
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete "${d.name}"? This is only allowed if no users use this department.`,
                                )
                              ) {
                                setFormError(null);
                                deleteMutation.mutate(d.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
