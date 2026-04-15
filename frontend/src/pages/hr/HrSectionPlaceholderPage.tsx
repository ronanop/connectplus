import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { HR_MODULES_STATIC } from "../../lib/hrModules";

export function HrSectionPlaceholderPage() {
  const { section } = useParams<{ section: string }>();
  const label =
    HR_MODULES_STATIC.find(m => m.id === section)?.label ??
    (section ? section.replace(/-/g, " ") : "This area");

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <Link
        to="/hr"
        className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to HR home
      </Link>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-12 shadow-sm">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{label}</h1>
        <p className="mt-3 text-sm text-neutral-500">
          This HR module is planned but not implemented yet. APIs will be added incrementally.
        </p>
      </div>
    </div>
  );
}
