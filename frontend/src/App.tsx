import { FormEvent, useEffect, useState } from "react";
import axios from "axios";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { AppShell } from "./components/layout/AppShell";
import { api } from "./lib/api";
import { useAuthStore } from "./stores/authStore";

type SegmentItem = {
  name: string;
  value: number;
};

type AdminDashboardSummary = {
  summaryCards: {
    leadCount: {
      current: number;
      previous: number;
    };
    opportunityCount: {
      current: number;
      previous: number;
    };
    quotationCount: {
      current: number;
      previous: number;
    };
  };
  segments: {
    leadOwner: SegmentItem[];
    opportunityStage: SegmentItem[];
    leadSource: SegmentItem[];
    opportunityOwner: SegmentItem[];
  };
};

type DashboardPreferenceConfig = {
  showLeadOwner: boolean;
  showOpportunityStage: boolean;
  showLeadSource: boolean;
  showOpportunityOwner: boolean;
};

const chartColors = ["#22c55e", "#38bdf8", "#a855f7", "#f97316", "#eab308", "#64748b"];

type HrmsEmployee = {
  id: string | number;
  name: string;
  email?: string;
  [key: string]: unknown;
};

type LeadStatus = "New" | "Contacted" | "Qualified" | "Proposal" | "Negotiation" | "Won" | "Lost";

type LeadListItem = {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  source: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  status: LeadStatus;
  assignedTo: {
    id: number;
    name: string;
  } | null;
};

type LeadDetail = LeadListItem & {
  requirement: string | null;
  estimatedValue: number | null;
  opportunities: {
    id: number;
    stage: string;
    estimatedValue: number | null;
    createdAt: string;
  }[];
};

const leadStatuses: LeadStatus[] = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
const opportunityStages = ["Qualification", "Proposal", "Negotiation", "Won", "Lost"];

type OpportunityListItem = {
  id: number;
  leadId: number;
  companyName: string;
  contactName: string;
  stage: string;
  estimatedValue: number | null;
  createdAt: string;
  assignedTo: {
    id: number;
    name: string;
  } | null;
};

type OpportunityDetail = OpportunityListItem & {
  lead: {
    id: number;
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    source: string;
    status: LeadStatus;
  } | null;
};

type ApiFetchSession = {
  id: number;
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  response: {
    statusCode?: number;
    headers?: Record<string, unknown>;
    body: unknown;
  };
  createdAt: string;
};

type SuperAdminOrganizationOverview = {
  id: number;
  name: string;
  code: string;
  modules: string[];
  createdAt: string;
  adminCount: number;
  userCount: number;
  totalSeats: number;
};

type SuperAdminOrganizationDetail = {
  id: number;
  name: string;
  code: string;
  modules: string[];
  createdAt: string;
  users: {
    id: number;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    department: string | null;
  }[];
};

type PresalesSummary = {
  activeCount: number;
  byStage: {
    stage: string;
    count: number;
  }[];
  averageStageDurationDays?: number;
  winRatePercent?: number;
  boqPendingReviewCount?: number;
};

type PresalesProjectListItem = {
  id: string;
  leadId: string | null;
  title: string;
  clientName: string;
  assignedTo: string;
  assignedBy: string;
  currentStage: string;
  priority: string;
  estimatedValue: number | null;
  expectedCloseDate: string | null;
  winProbability: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const presalesStages = [
  "INITIATED",
  "LEAD_HANDOVER",
  "REQUIREMENT_ANALYSIS",
  "SOLUTION_DESIGN",
  "SYSTEM_DESIGN",
  "TECH_STACK_FINALIZATION",
  "BOQ_CREATION",
  "POC",
  "PROPOSAL_GENERATION",
  "DEAL_CLOSURE_SUPPORT",
  "CLOSED",
] as const;

const presalesPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

function toCsvValue(input: unknown): string {
  if (input == null) return "";
  const stringValue = String(input);
  if (
    stringValue.includes('"') ||
    stringValue.includes(",") ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

type PresalesStageLog = {
  id: string;
  projectId: string;
  stage: string;
  completedAt: string;
  completedBy: string;
  notes: string | null;
  timeTakenMinutes: number | null;
};

type PresalesRequirementDoc = {
  id: string;
  projectId: string;
  rawNotes: string | null;
  functionalReq: unknown | null;
  technicalReq: unknown | null;
  constraints: string | null;
  stakeholders: unknown | null;
  completedAt: string | null;
};

type PresalesProjectDetail = PresalesProjectListItem & {
  stages: PresalesStageLog[];
  requirements: PresalesRequirementDoc | null;
  solution: {
    id: string;
    projectId: string;
    architectureUrl: string | null;
    diagramUrl: string | null;
    techStack: Record<string, string[]> | null;
    competitors: unknown;
    recommendedOption: string | null;
    justification: string | null;
    completedAt: string | null;
  } | null;
  boq: {
    id: string;
    projectId: string;
    lineItems: unknown;
    totalValue: number | null;
    oemName: string | null;
    validity: string | null;
    attachmentUrl: string | null;
    effortDays: number | null;
    resourceCount: number | null;
    status: string;
    version: number;
    completedAt: string | null;
  } | null;
  poc: {
    id: string;
    projectId: string;
    objective: string | null;
    scope: string | null;
    successCriteria: unknown;
    environment: string | null;
    startDate: string | null;
    endDate: string | null;
    outcome: string | null;
    findings: string | null;
    evidenceUrls: unknown;
    status: string;
  } | null;
  proposal: {
    id: string;
    projectId: string;
    executiveSummary: string | null;
    scopeOfWork: string | null;
    technicalApproach: string | null;
    commercials: unknown;
    timeline: unknown;
    teamStructure: unknown;
    termsConditions: string | null;
    pdfUrl: string | null;
    version: number;
    status: string;
    sentAt: string | null;
    clientFeedback: string | null;
    completedAt: string | null;
  } | null;
  activities: {
    id: string;
    projectId: string;
    type: string;
    description: string;
    createdBy: string;
    fileUrl: string | null;
    createdAt: string;
  }[];
};

type ConnectedPresalesProjectSummary = {
  id: string;
  title: string;
  currentStage: string;
  priority: string;
  winProbability: number;
};

function ConnectedPresalesRecords({ leadId }: { leadId: number }) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["presales-by-lead", leadId],
    queryFn: async () => {
      const response = await api.get("/api/v1/presales/projects", {
        params: {
          linkedLeadId: leadId,
          page: 1,
          pageSize: 10,
        },
      });
      const result = response.data?.data;
      const items = (result?.items ?? []) as PresalesProjectListItem[];
      return items as ConnectedPresalesProjectSummary[];
    },
  });

  if (isLoading) {
    return <p className="text-[11px] text-neutral-500">Loading connected presales projects…</p>;
  }

  const items = data ?? [];

  if (items.length === 0) {
    return <p className="text-[11px] text-neutral-500">No presales projects linked to this lead yet.</p>;
  }

  return (
    <div className="space-y-2 text-[11px]">
      {items.map(project => (
        <button
          key={project.id}
          type="button"
          onClick={() => navigate(`/presales/projects/${project.id}`)}
          className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 px-3 py-2 text-left hover:border-[var(--accent-primary)]"
        >
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-[var(--text-primary)]">{project.title}</p>
            <p className="text-[10px] text-neutral-500">
              Stage {project.currentStage} · {project.priority} priority
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] text-neutral-600">
              Win {project.winProbability}%
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

type PresalesBoqBoardItem = {
  id: string;
  projectId: string;
  lineItems: unknown;
  totalValue: number | null;
  oemName: string | null;
  validity: string | null;
  attachmentUrl: string | null;
  effortDays: number | null;
  resourceCount: number | null;
  status: string;
  version: number;
  project: PresalesProjectListItem;
};

type PresalesPocBoardItem = {
  id: string;
  projectId: string;
  objective: string | null;
  scope: string | null;
  successCriteria: unknown;
  environment: string | null;
  startDate: string | null;
  endDate: string | null;
  outcome: string | null;
  findings: string | null;
  evidenceUrls: unknown;
  status: string;
  project: PresalesProjectListItem;
};

type PresalesProposalBoardItem = {
  id: string;
  projectId: string;
  executiveSummary: string | null;
  scopeOfWork: string | null;
  technicalApproach: string | null;
  commercials: unknown;
  timeline: unknown;
  teamStructure: unknown;
  termsConditions: string | null;
  pdfUrl: string | null;
  version: number;
  status: string;
  sentAt: string | null;
  clientFeedback: string | null;
  project: PresalesProjectListItem;
};

function isArrayOfObjects(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every(item => item && typeof item === "object" && !Array.isArray(item));
}

function ApiFetcherPage() {
  const [name, setName] = useState("Employee directory");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([
    { key: "", value: "" },
  ]);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ApiFetchSession | null>(null);

  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ["api-fetch-sessions"],
    queryFn: async () => {
      const response = await api.get("/api/integrations/fetch/sessions");
      return response.data?.data?.sessions as ApiFetchSession[] | undefined;
    },
  });

  const handleHeaderChange = (index: number, field: "key" | "value", value: string) => {
    setHeaders(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleAddHeaderRow = () => {
    setHeaders(prev => [...prev, { key: "", value: "" }]);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!url) {
      setError("Endpoint URL is required.");
      return;
    }

    let parsedBody: Record<string, unknown> | undefined;
    if (method === "POST" && body.trim()) {
      try {
        parsedBody = JSON.parse(body) as Record<string, unknown>;
      } catch {
        setError("Body must be valid JSON.");
        return;
      }
    }

    const headerObject: Record<string, string> = {};
    headers
      .filter(h => h.key.trim())
      .forEach(h => {
        headerObject[h.key.trim()] = h.value;
      });

    setSubmitting(true);
    try {
      const response = await api.post("/api/integrations/fetch", {
        name: name || "Untitled fetch",
        url,
        method,
        headers: headerObject,
        body: parsedBody,
      });
      const session = response.data?.data?.session as ApiFetchSession | undefined;
      if (session) {
        setActiveSession(session);
        await refetchSessions();
      }
    } catch {
      setError("Unable to execute API fetch. Please verify the endpoint and headers.");
    } finally {
      setSubmitting(false);
    }
  };

  const sessions = sessionsData ?? [];
  const bodyToShow = activeSession?.response?.body;
  const asArray = isArrayOfObjects(bodyToShow);

  const columns = asArray
    ? Array.from(
        new Set(
          bodyToShow.flatMap(item =>
            Object.keys(item).filter(key => ["id", "name", "email"].includes(key) || key === "status"),
          ),
        ),
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Integrations</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">API Fetcher console</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Experiment with external endpoints, capture responses and keep a history of successful fetches.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-full bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_14px_40px_rgba(15,23,42,0.6)] transition hover:bg-[var(--accent-primary)]/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Running fetch…" : "Run fetch and save"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-4 text-xs shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Request builder</p>
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
                <div className="space-y-1.5">
                  <label className="text-neutral-600">Label</label>
                  <input
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder="Short name for this fetch"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-neutral-600">Method</label>
                  <select
                    value={method}
                    onChange={event => setMethod(event.target.value as "GET" | "POST")}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-neutral-600">Endpoint URL</label>
                <input
                  value={url}
                  onChange={event => setUrl(event.target.value)}
                  placeholder="https://example.com/api/v1/resource"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-neutral-600">Headers</label>
                  <button
                    type="button"
                    onClick={handleAddHeaderRow}
                    className="text-[11px] text-[var(--accent-primary)] underline-offset-2 hover:underline"
                  >
                    Add header
                  </button>
                </div>
                <div className="space-y-2">
                  {headers.map((header, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <input
                        value={header.key}
                        onChange={event => handleHeaderChange(index, "key", event.target.value)}
                        placeholder="Header name"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                      />
                      <input
                        value={header.value}
                        onChange={event => handleHeaderChange(index, "value", event.target.value)}
                        placeholder="Header value"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-neutral-600">Body (JSON, for POST)</label>
                <textarea
                  value={body}
                  onChange={event => setBody(event.target.value)}
                  rows={6}
                  disabled={method === "GET"}
                  placeholder={method === "GET" ? "Body disabled for GET" : '{ "example": "value" }'}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)] disabled:opacity-60"
                />
              </div>
              {error && (
                <div className="rounded-xl border border-red-300/70 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-4 text-xs shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Latest response
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  The last successful fetch is stored as a session for this user.
                </p>
              </div>
              {activeSession && (
                <div className="text-right text-[11px] text-neutral-500">
                  <p>{activeSession.method} · {activeSession.name}</p>
                  <p className="mt-0.5">
                    {new Date(activeSession.createdAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-[var(--border)]/70 bg-[var(--bg-elevated)]/60 p-3">
              {!activeSession && (
                <p className="text-[11px] text-neutral-500">
                  Run a fetch to see the response here. The body will be saved in the workspace database.
                </p>
              )}
              {activeSession && asArray && columns.length > 0 && (
                <table className="min-w-full text-left text-[11px]">
                  <thead>
                    <tr>
                      {columns.map(column => (
                        <th key={column} className="px-2 py-1 font-medium text-neutral-500">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bodyToShow.map((row, index) => (
                      <tr key={index} className="border-t border-[var(--border)]/60">
                        {columns.map(column => (
                          <td key={column} className="px-2 py-1 align-top text-neutral-800">
                            {String((row as any)[column] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {activeSession && (!asArray || columns.length === 0) && (
                <pre className="whitespace-pre-wrap text-[11px] text-neutral-800">
                  {JSON.stringify(bodyToShow, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-4 text-xs shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Recent sessions
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Up to ten recent fetches for this user are stored and can be revisited.
            </p>
            <div className="mt-3 max-h-[320px] space-y-2 overflow-auto">
              {sessions.length === 0 && (
                <p className="text-[11px] text-neutral-500">
                  No sessions yet. Configure an endpoint and run a fetch to start building history.
                </p>
              )}
              {sessions.map(session => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveSession(session)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-[11px] ${
                    activeSession && activeSession.id === session.id
                      ? "border-[var(--accent-primary)] bg-[var(--bg-elevated)]"
                      : "border-[var(--border)] bg-[var(--bg-surface)]/80 hover:border-[var(--accent-primary)]/60"
                  }`}
                >
                  <p className="text-xs font-medium text-[var(--text-primary)]">
                    {session.method} · {session.name}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500 truncate">{session.url}</p>
                  <p className="mt-0.5 text-[10px] text-neutral-400">
                    {new Date(session.createdAt).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadsPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"list" | "pipeline">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "All">("All");
  const [page, setPage] = useState(1);

  const pageSize = viewMode === "pipeline" ? 100 : 20;

  const { data, isLoading } = useQuery({
    queryKey: ["leads", { search, statusFilter, page, pageSize }],
    queryFn: async () => {
      const response = await api.get("/api/leads", {
        params: {
          search: search || undefined,
          status: statusFilter === "All" ? undefined : statusFilter,
          page,
          pageSize,
        },
      });
      return response.data?.data as { items: LeadListItem[]; total: number; page: number; pageSize: number };
    },
  });

  const leads = data?.items ?? [];
  const total = data?.total ?? 0;

  const groupedByStatus = leadStatuses.map(status => ({
    status,
    leads: leads.filter(lead => lead.status === status),
  }));

  const handleRowClick = (leadId: number) => {
    navigate(`/crm/leads/${leadId}`);
  };

  const handleCreateClick = () => {
    navigate("/crm/leads/new");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Leads</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Demand canvas for your pipeline</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Glide between list and pipeline views. Every card is wired from the same lead record.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-1 py-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-full px-3 py-1.5 ${
                viewMode === "list"
                  ? "bg-[var(--accent-primary)] text-white shadow-[0_0_0_1px_rgba(15,23,42,0.7)]"
                  : "text-neutral-500"
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("pipeline")}
              className={`rounded-full px-3 py-1.5 ${
                viewMode === "pipeline"
                  ? "bg-[var(--accent-primary)] text-white shadow-[0_0_0_1px_rgba(15,23,42,0.7)]"
                  : "text-neutral-500"
              }`}
            >
              Pipeline
            </button>
          </div>
          <button
            type="button"
            onClick={handleCreateClick}
            className="inline-flex items-center rounded-full bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_14px_40px_rgba(15,23,42,0.6)] transition hover:bg-[var(--accent-primary)]/90"
          >
            Create lead
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-3 text-xs shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Search</span>
          <input
            value={search}
            onChange={event => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Company, contact, email, city…"
            className="w-52 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Status</span>
          <select
            value={statusFilter}
            onChange={event => {
              const value = event.target.value as LeadStatus | "All";
              setStatusFilter(value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent-primary)]"
          >
            <option value="All">All</option>
            {leadStatuses.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2 text-neutral-500">
          <span>Total records</span>
          <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-primary)]">
            {isLoading ? "…" : total}
          </span>
        </div>
      </div>

      {viewMode === "list" && (
        <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 text-xs shadow-sm">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)] border-b border-[var(--border)]/70 px-4 py-2 font-medium text-neutral-500">
            <div>Lead</div>
            <div>Meta</div>
            <div className="text-right">Owner</div>
          </div>
          {isLoading ? (
            <div className="px-4 py-8 text-center text-xs text-neutral-500">Loading leads…</div>
          ) : leads.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-neutral-500">
              No leads yet. Click “Create lead” to capture your first opportunity.
            </div>
          ) : (
            <div>
              {leads.map(lead => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => handleRowClick(lead.id)}
                  className="flex w-full cursor-pointer items-stretch border-t border-[var(--border)]/70 px-4 py-3 text-left hover:bg-[var(--bg-elevated)]/60"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{lead.contactName}</p>
                      <span className="text-[11px] text-neutral-500">·</span>
                      <p className="text-xs text-neutral-500">{lead.companyName}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {lead.email} · {lead.phone}
                    </p>
                  </div>
                  <div className="flex-1 text-[11px] text-neutral-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px]">
                        {lead.source}
                      </span>
                      {lead.industry && (
                        <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px]">
                          {lead.industry}
                        </span>
                      )}
                      {(lead.city || lead.state) && (
                        <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px]">
                          {[lead.city, lead.state].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 inline-flex items-center gap-2">
                      <span
                        className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-neutral-700"
                      >
                        {lead.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex min-w-[160px] flex-col items-end justify-center text-[11px] text-neutral-500">
                    {lead.assignedTo ? (
                      <>
                        <span className="text-xs font-medium text-[var(--text-primary)]">{lead.assignedTo.name}</span>
                        <span>Lead owner</span>
                      </>
                    ) : (
                      <span className="text-xs text-neutral-400">Unassigned</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--border)]/70 px-4 py-3 text-[11px] text-neutral-500">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(old => Math.max(1, old - 1))}
                  className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage(old => Math.min(totalPages, old + 1))}
                  className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === "pipeline" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Pipeline view updates automatically as statuses move forward or backward.</span>
            <span>
              Total cards:{" "}
              <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-primary)]">
                {leads.length}
              </span>
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {groupedByStatus.map(stage => (
              <div
                key={stage.status}
                className="min-w-[220px] flex-1 rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 text-xs shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-[var(--border)]/70 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                      {stage.status}
                    </span>
                  </div>
                  <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-primary)]">
                    {stage.leads.length}
                  </span>
                </div>
                <div className="max-h-[420px] space-y-2 overflow-y-auto px-3 py-2">
                  {stage.leads.length === 0 ? (
                    <p className="py-4 text-center text-[11px] text-neutral-400">No cards in this stage yet.</p>
                  ) : (
                    stage.leads.map(lead => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => handleRowClick(lead.id)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-3 py-2 text-left text-[11px] hover:border-[var(--accent-primary)]"
                      >
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          {lead.contactName} · {lead.companyName}
                        </p>
                        <p className="mt-1 text-[11px] text-neutral-500">{lead.source}</p>
                        {lead.assignedTo && (
                          <p className="mt-1 text-[11px] text-neutral-500">Owner: {lead.assignedTo.name}</p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateLeadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    companyName: "",
    projectTitle: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    source: "",
    industry: "",
    city: "",
    state: "",
    requirement: "",
    estimatedValue: "",
    status: "New" as LeadStatus,
    street: "",
    zipCode: "",
    country: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitIntent, setSubmitIntent] = useState<"save" | "saveAndNew">("save");

  const mutation = useMutation({
    mutationFn: async () => {
      const fullName =
        form.firstName || form.lastName
          ? [form.firstName, form.lastName].filter(Boolean).join(" ")
          : "";
      const contactName = fullName || "";

      const payload = {
        companyName: form.companyName,
        contactName,
        email: form.email,
        phone: form.phone,
        source: form.source,
        industry: form.industry || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        requirement:
          form.requirement || form.projectTitle
            ? [form.projectTitle, form.requirement].filter(Boolean).join(" — ")
            : undefined,
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        status: form.status,
      };
      const response = await api.post("/api/leads", payload);
      return response.data?.data?.lead as LeadDetail;
    },
    onSuccess: async lead => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (submitIntent === "saveAndNew") {
        setForm({
          companyName: "",
          projectTitle: "",
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          source: "",
          industry: "",
          city: "",
          state: "",
          requirement: "",
          estimatedValue: "",
          status: "New",
          street: "",
          zipCode: "",
          country: "",
          description: "",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        navigate(`/crm/leads/${lead.id}`);
      }
    },
    onError: () => {
      setError("Unable to create lead. Please check the details and try again.");
    },
    onSettled: () => {
      setSubmitting(false);
    },
  });

  const handleChange = (field: keyof typeof form, value: string | LeadStatus) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    mutation.mutate();
  };

  const requiredKeys: (keyof typeof form)[] = ["companyName", "firstName", "email", "phone", "source"];
  const completedRequired = requiredKeys.filter(key => String(form[key]).trim().length > 0).length;
  const canSubmit = completedRequired === requiredKeys.length && !submitting;

  const fullPreviewName =
    form.firstName || form.lastName
      ? [form.firstName, form.lastName].filter(Boolean).join(" ")
      : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Leads</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Create lead</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Capture company, contact and requirement in one calm form before handing it to presales.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link
            to="/crm/leads"
            className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-neutral-600"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              setSubmitIntent("saveAndNew");
              const formElement = document.getElementById("create-lead-form") as HTMLFormElement | null;
              formElement?.requestSubmit();
            }}
            className="rounded-full border border-[var(--accent-primary)] bg-[var(--bg-surface)] px-4 py-2 font-semibold uppercase tracking-[0.22em] text-[var(--accent-primary)] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save and new
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              setSubmitIntent("save");
              const formElement = document.getElementById("create-lead-form") as HTMLFormElement | null;
              formElement?.requestSubmit();
            }}
            className="rounded-full bg-[var(--accent-primary)] px-4 py-2 font-semibold uppercase tracking-[0.22em] text-white shadow-[0_14px_40px_rgba(15,23,42,0.6)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <form id="create-lead-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-4 text-xs shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Lead information
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Company
                  </label>
                  <input
                    value={form.companyName}
                    onChange={event => handleChange("companyName", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Customer project title
                  </label>
                  <input
                    value={form.projectTitle}
                    onChange={event => handleChange("projectTitle", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    First name
                  </label>
                  <input
                    value={form.firstName}
                    onChange={event => handleChange("firstName", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Last name
                  </label>
                  <input
                    value={form.lastName}
                    onChange={event => handleChange("lastName", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={event => handleChange("email", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Mobile
                  </label>
                  <input
                    value={form.phone}
                    onChange={event => handleChange("phone", event.target.value)}
                    placeholder="Enter 10 digit phone number"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Lead source
                  </label>
                  <select
                    value={form.source}
                    onChange={event => handleChange("source", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    required
                  >
                    <option value="">Select source</option>
                    <option value="Inbound – Website">Inbound – Website</option>
                    <option value="Outbound – SDR">Outbound – SDR</option>
                    <option value="Partner – Channel">Partner – Channel</option>
                    <option value="Event – Trade Show">Event – Trade Show</option>
                    <option value="Reference">Reference</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Industry
                  </label>
                  <input
                    value={form.industry}
                    onChange={event => handleChange("industry", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    placeholder="Healthcare, logistics…"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    City
                  </label>
                  <input
                    value={form.city}
                    onChange={event => handleChange("city", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    State
                  </label>
                  <input
                    value={form.state}
                    onChange={event => handleChange("state", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Requirement summary
                  </label>
                  <textarea
                    value={form.requirement}
                    onChange={event => handleChange("requirement", event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    placeholder="What business problem is the customer trying to solve?"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-4 text-xs shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Customer address information
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Street</label>
                  <input
                    value={form.street}
                    onChange={event => handleChange("street", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">City</label>
                  <input
                    value={form.city}
                    onChange={event => handleChange("city", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Zip code
                  </label>
                  <input
                    value={form.zipCode}
                    onChange={event => handleChange("zipCode", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Country
                  </label>
                  <input
                    value={form.country}
                    onChange={event => handleChange("country", event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-4 text-xs shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Additional information
              </p>
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                      Estimated business amount (₹)
                    </label>
                    <input
                      type="number"
                      value={form.estimatedValue}
                      onChange={event => handleChange("estimatedValue", event.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                      Lead status
                    </label>
                    <select
                      value={form.status}
                      onChange={event => handleChange("status", event.target.value as LeadStatus)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    >
                      {leadStatuses.map(status => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={event => handleChange("description", event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    placeholder="Any additional context your team should know."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-4 text-xs shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Lead preview
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/70 via-emerald-400/70 to-amber-300/70 text-xs font-semibold text-slate-950">
                  {(form.companyName || fullPreviewName || "L").charAt(0).toUpperCase()}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {fullPreviewName || "Contact name"}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {form.companyName || "Company name"} · {form.industry || "Industry"}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {form.source || "Lead source"} · {form.status}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px]">
                <div className="space-y-1">
                  <p className="text-neutral-500">Core fields</p>
                  <p className="rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[11px] font-medium text-[var(--text-primary)]">
                    {completedRequired}/{requiredKeys.length} filled
                  </p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-elevated)]">
                  <div className="relative h-12 w-12">
                    <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                      <path
                        d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31"
                        className="fill-none stroke-[var(--border)]"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31"
                        className="fill-none"
                        stroke="url(#lead-create-ring)"
                        strokeDasharray={`${(completedRequired / requiredKeys.length) * 97} 97`}
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="lead-create-ring" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="50%" stopColor="#a855f7" />
                          <stop offset="100%" stopColor="#22c55e" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-[var(--text-primary)]">
                      {Math.round((completedRequired / requiredKeys.length) * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-300/70 bg-red-50 px-4 py-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-neutral-500">
          <p>
            Use Save and new when logging multiple leads from the same campaign. Core fields must be filled to save.
          </p>
          <p>
            {completedRequired}/{requiredKeys.length} core fields completed
          </p>
        </div>
      </form>
    </div>
  );
}

type SectionProps = {
  id: string;
  title?: string;
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
};

function CollapsibleSection({ id, title, defaultOpen = true, headerRight, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id={id} className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 text-xs shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)]/70 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          {title && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">{title}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {headerRight}
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[10px] transition-transform ${
              open ? "rotate-180" : ""
            }`}
          >
            ˅
          </span>
        </div>
      </button>
      <div
        className={`px-4 transition-all duration-200 ease-out ${
          open ? "max-h-[2000px] py-4 opacity-100" : "max-h-0 py-0 opacity-0"
        } overflow-hidden`}
      >
        {open && children}
      </div>
    </section>
  );
}

function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "timeline">("overview");

  const leadId = id ? parseInt(id, 10) : NaN;

  const { data, isLoading } = useQuery({
    queryKey: ["lead", leadId],
    enabled: Number.isFinite(leadId),
    queryFn: async () => {
      const response = await api.get(`/api/leads/${leadId}`);
      return response.data?.data?.lead as LeadDetail;
    },
  });

  const mutation = useMutation({
    mutationFn: async (status: LeadStatus) => {
      await api.patch(`/api/leads/${leadId}/status`, { status });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lead", leadId] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
      ]);
    },
    onSettled: () => {
      setStatusUpdating(false);
    },
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/leads/${leadId}/convert-to-opportunity`);
      return response.data?.data as { lead: LeadDetail; opportunity: { id: number } };
    },
    onSuccess: async data => {
      setConvertError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lead", leadId] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
      ]);
      if (data?.opportunity?.id) {
        navigate(`/crm/opportunities/${data.opportunity.id}`);
      }
    },
    onError: () => {
      setConvertError("Unable to convert this lead into an opportunity. Please try again.");
    },
  });

  if (!Number.isFinite(leadId)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">Invalid lead identifier.</p>
      </div>
    );
  }

  const lead = data;

  const hasOpportunity = !!lead && lead.opportunities.length > 0;

  const handleStatusChange = (value: LeadStatus) => {
    setStatusUpdating(true);
    mutation.mutate(value);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-20 border-b border-[var(--border)]/70 bg-[var(--bg-surface)]/95 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            {isLoading || !lead ? (
              <>
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Lead</p>
                <h1 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Loading lead…</h1>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Lead</p>
                <h1 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{lead.contactName}</h1>
                <p className="text-xs text-neutral-500">{lead.companyName}</p>
                <button
                  type="button"
                  className="mt-1 text-[11px] text-[var(--accent-primary)] underline-offset-2 hover:underline"
                >
                  Add Tags
                </button>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-neutral-700"
            >
              Send Email
            </button>
            <button
              type="button"
              disabled={convertMutation.isLoading || hasOpportunity}
              onClick={() => convertMutation.mutate()}
              className="inline-flex items-center rounded-full bg-sky-500 px-3 py-1.5 text-xs font-medium text-white shadow-md transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {hasOpportunity ? "Converted" : convertMutation.isLoading ? "Converting…" : "Convert"}
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-neutral-700"
            >
              Edit
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-xs"
            >
              ⋯
            </button>
            <div className="ml-2 inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-1 py-1">
              <button
                type="button"
                disabled={!Number.isFinite(leadId) || leadId <= 1}
                onClick={() => Number.isFinite(leadId) && leadId > 1 && navigate(`/crm/leads/${leadId - 1}`)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs disabled:opacity-40"
              >
                ←
              </button>
              <button
                type="button"
                disabled={!Number.isFinite(leadId)}
                onClick={() => Number.isFinite(leadId) && navigate(`/crm/leads/${leadId + 1}`)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs disabled:opacity-40"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>

      {!isLoading && lead && (
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto px-4 py-5 text-xs md:px-6">
            <div className="flex items-center justify-between border-b border-[var(--border)]/70 pb-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-elevated)] px-1 py-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={`rounded-full px-3 py-1 ${
                    activeTab === "overview"
                      ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      : "text-neutral-500"
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("timeline")}
                  className={`rounded-full px-3 py-1 ${
                    activeTab === "timeline"
                      ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      : "text-neutral-500"
                  }`}
                >
                  Timeline
                </button>
              </div>
              <p className="text-[11px] text-neutral-500">Last update: 2 days ago</p>
            </div>

            {activeTab === "overview" ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-neutral-500">Current State:</span>
                    <span className="rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-[11px] text-neutral-500">
                      None
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      disabled={convertMutation.isLoading || hasOpportunity}
                      onClick={() => convertMutation.mutate()}
                      className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Convert to Opportunity
                    </button>
                    <button
                      type="button"
                      disabled={statusUpdating}
                      onClick={() => handleStatusChange("Lost" as LeadStatus)}
                      className="inline-flex items-center rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Lead Lost
                    </button>
                  </div>
                </div>

                <CollapsibleSection id="lead-owner" defaultOpen>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Lead Owner</p>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-white">
                          {lead.assignedTo ? lead.assignedTo.name.charAt(0) : "R"}
                        </div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {lead.assignedTo ? lead.assignedTo.name : "Rajat Varshney"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Mobile</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[var(--text-primary)]">{lead.phone}</p>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-white"
                        >
                          📞
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Lead Status</p>
                      <select
                        disabled={statusUpdating}
                        value={lead.status}
                        onChange={event => handleStatusChange(event.target.value as LeadStatus)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                      >
                        {leadStatuses.map(status => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="lead-information" title="Lead Information" defaultOpen>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Company</p>
                      <p className="text-sm text-[var(--text-primary)]">{lead.companyName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Customer&apos;s Project Title</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Email</p>
                      <a href={`mailto:${lead.email}`} className="text-sm text-sky-500">
                        {lead.email}
                      </a>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Lead Source</p>
                      <select
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                        value={lead.source}
                        onChange={() => {}}
                      >
                        <option value={lead.source}>{lead.source}</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Cache Lead ID</p>
                      <p className="text-sm text-neutral-500">CL-{lead.id.toString().padStart(5, "0")}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Lead Name</p>
                      <p className="text-sm text-[var(--text-primary)]">{lead.contactName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Product Type</p>
                      <select
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                        defaultValue="Hardware"
                      >
                        <option value="Hardware">Hardware</option>
                        <option value="Software">Software</option>
                        <option value="Services">Services</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Mobile</p>
                      <p className="text-sm text-[var(--text-primary)]">{lead.phone}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Sub Product Category</p>
                      <select className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]">
                        <option>Not set</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Requirement Type</p>
                      <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-400">
                        New Requirement
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Sub Product</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Purchase Model</p>
                      <select className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]">
                        <option>CAPEX</option>
                        <option>OPEX</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Engagement Score</p>
                      <span className="inline-flex items-center rounded-full bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-400">
                        100%
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Detail</p>
                      <p className="text-sm text-neutral-500">{lead.requirement || "Not captured"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Portal Link</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">DR Number</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Assign To</p>
                      <p className="text-sm text-[var(--text-primary)]">
                        {lead.assignedTo ? lead.assignedTo.name : "Unassigned"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">New DR Number</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Assigned Date</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Type</p>
                      <select className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]">
                        <option>Back to Back</option>
                        <option>Direct</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Expected Business Amount</p>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        ₹ {(lead.estimatedValue ?? 2304740).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Lead Owner</p>
                      <p className="text-sm text-[var(--text-primary)]">
                        {lead.assignedTo ? lead.assignedTo.name : "Not set"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Expected Closure Date</p>
                      <p className="text-sm text-neutral-500">Feb 28, 2026</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Lead Status</p>
                      <p className="text-sm text-[var(--text-primary)]">{lead.status}</p>
                    </div>
                  </div>
                </CollapsibleSection>

              <CollapsibleSection id="linked-opportunities" title="Opportunities">
                {lead.opportunities.length === 0 ? (
                  <p className="text-[11px] text-neutral-500">
                    No opportunities linked yet. Convert this lead to create one.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {lead.opportunities.map(opportunity => (
                      <button
                        key={opportunity.id}
                        type="button"
                        onClick={() => navigate(`/crm/opportunities/${opportunity.id}`)}
                        className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-3 py-2 text-left text-[11px] hover:border-[var(--accent-primary)]"
                      >
                        <div>
                          <p className="text-xs font-semibold text-[var(--text-primary)]">
                            Opportunity #{opportunity.id.toString().padStart(4, "0")}
                          </p>
                          <p className="mt-0.5 text-[11px] text-neutral-500">Stage: {opportunity.stage}</p>
                        </div>
                        <div className="text-right text-[11px] text-neutral-500">
                          <p className="font-medium text-[var(--text-primary)]">
                            ₹{" "}
                            {(opportunity.estimatedValue ?? 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                          <p className="mt-0.5">
                            Created {new Date(opportunity.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CollapsibleSection>

                <CollapsibleSection
                  id="customer-address"
                  title="Customer Address Information"
                  headerRight={
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                    >
                      📍 Locate Map
                    </button>
                  }
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2 space-y-1">
                      <p className="text-[11px] text-neutral-500">Street</p>
                      <p className="text-sm text-[var(--text-primary)]">KPMG, Pune, Maharashtra</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">City</p>
                      <p className="text-sm text-neutral-500">{lead.city || "Pune"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">State</p>
                      <p className="text-sm text-neutral-500">{lead.state || "Maharashtra"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Zip Code</p>
                      <p className="text-sm text-neutral-500">411001</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Country</p>
                      <p className="text-sm text-neutral-500">India</p>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="oem-information" title="OEM Information">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">OEM Name</p>
                      <a href="#" className="text-sm text-sky-500">
                        Dell Technologies
                      </a>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">OEM Contact Person</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">OEM Contact Number</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">OEM Contact Email</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="distributor-information" title="Distributor Information">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Distributor Name</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Distributor Contact Person</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Distributor Contract Number</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Distributor Contact Email</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Department</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="customer-industry" title="Customer & Industry Information">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">End Customer</p>
                      <p className="text-sm text-[var(--text-primary)]">{lead.companyName || "KPMG"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Industry</p>
                      <select className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]">
                        <option>Large Enterprise</option>
                      </select>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="entity-information" title="Entity Information">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Entity Name</p>
                      <a href="#" className="text-sm text-sky-500">
                        Cache Digitech
                      </a>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Entity Email</p>
                      <a href="mailto:sales@cachedigitech.com" className="text-sm text-sky-500">
                        sales@cachedigitech.com
                      </a>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-[11px] text-neutral-500">Entity Address</p>
                      <p className="text-sm text-neutral-500">Pune, Maharashtra, India</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Organization</p>
                      <p className="text-sm text-neutral-500">Cache Digitech</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Entity GST No.</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Entity Contact Number</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-neutral-500">+91-00000-00000</p>
                        <span>📞</span>
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="additional-information" title="Additional Information">
                  <div className="space-y-1">
                    <p className="text-[11px] text-neutral-500">Description</p>
                    <textarea
                      value={lead.requirement ?? "Servers for KPMG Pune"}
                      readOnly
                      className="mt-1 w-full min-h-[80px] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  id="notes"
                  title="Notes"
                  headerRight={
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                    >
                      Add Note
                    </button>
                  }
                >
                  <div className="space-y-2">
                    <input
                      placeholder="Add a note..."
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    />
                    <p className="text-[11px] text-neutral-500">No notes yet.</p>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  id="connected-records"
                  title="Connected Records"
                  headerRight={
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                    >
                      Add New ▾
                    </button>
                  }
                >
                  <ConnectedPresalesRecords leadId={lead.id} />
                </CollapsibleSection>

                <CollapsibleSection
                  id="cadences"
                  title="Cadences"
                  headerRight={
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                    >
                      Enroll
                    </button>
                  }
                >
                  <p className="text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>

                <CollapsibleSection
                  id="attachments"
                  title="Attachments"
                  headerRight={
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                    >
                      Attach ▾
                    </button>
                  }
                >
                  <p className="text-[11px] text-neutral-500">No attachments.</p>
                </CollapsibleSection>

                <CollapsibleSection
                  id="products"
                  title="Products"
                  headerRight={
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                    >
                      Add Products
                    </button>
                  }
                >
                  <p className="text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>

                <CollapsibleSection
                  id="open-activities"
                  title="Open Activities"
                  headerRight={
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                    >
                      Add New ▾
                    </button>
                  }
                >
                  <p className="text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>

                <CollapsibleSection id="closed-activities" title="Closed Activities">
                  <p className="text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>

                <CollapsibleSection id="invited-meetings" title="Invited Meetings">
                  <p className="text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>

                <CollapsibleSection
                  id="emails"
                  title="Emails"
                  headerRight={
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                      >
                        Compose Email
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                      >
                        All Emails ▾
                      </button>
                    </div>
                  }
                >
                  <div className="flex items-center gap-4 border-b border-[var(--border)]/70 pb-2 text-[11px]">
                    <button type="button" className="rounded-full bg-[var(--bg-elevated)] px-3 py-1">
                      Mails
                    </button>
                    <button type="button" className="rounded-full px-3 py-1 text-neutral-500">
                      Drafts
                    </button>
                    <button type="button" className="rounded-full px-3 py-1 text-neutral-500">
                      Scheduled
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>

                <CollapsibleSection id="social" title="Social">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-24 rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-[var(--text-primary)]">
                        Start interacting with your connections on social networks.
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Connect social accounts to see interactions and conversations here.
                      </p>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="related-list-1" title="Related List Label 1">
                  <p className="text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-8 text-center text-[11px] text-neutral-500">
                Timeline view will show a chronological feed of emails, calls, meetings and updates for this lead.
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

function OpportunitiesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string | "All">("All");
  const [page, setPage] = useState(1);

  const pageSize = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["opportunities", { search, stageFilter, page, pageSize }],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await api.get("/api/opportunities", {
        params: {
          search: search || undefined,
          stage: stageFilter === "All" ? undefined : stageFilter,
          page,
          pageSize,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return response.data?.data as {
        items: OpportunityListItem[];
        total: number;
        page: number;
        pageSize: number;
      };
    },
  });

  const opportunities = data?.items ?? [];
  const total = data?.total ?? 0;

  const totalPipeline = opportunities.reduce((sum, opportunity) => sum + (opportunity.estimatedValue ?? 0), 0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Opportunities</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            Pursuit canvas for qualified deals
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Scan stages, owners and commercial value in one calm, scrollable grid.
          </p>
        </div>
        <div className="flex items-end gap-4">
          <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-3 text-right text-xs shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-neutral-500">Open pipeline</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              ₹ {totalPipeline.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">
              {total} opportunity{total === 1 ? "" : "ies"} in view
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-3 text-xs shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Search</span>
          <input
            value={search}
            onChange={event => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Company, contact, owner…"
            className="w-52 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Stage</span>
          <select
            value={stageFilter}
            onChange={event => {
              const value = event.target.value as string | "All";
              setStageFilter(value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent-primary)]"
          >
            <option value="All">All</option>
            {opportunityStages.map(stage => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-neutral-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-1 py-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 text-xs shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)]/70 px-4 py-3">
          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Stage-weighted board</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
            <span>Amount</span>
            <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
              <div className="h-full flex-1 bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] bg-[var(--bg-elevated)]/60 px-4 py-2 text-[11px] font-medium text-neutral-500">
          <div>Opportunity</div>
          <div>Stage</div>
          <div>Owner</div>
          <div className="text-right">Amount</div>
        </div>
        {isLoading ? (
          <div className="px-4 py-8 text-center text-[11px] text-neutral-500">Loading opportunities…</div>
        ) : isError ? (
          <div className="px-4 py-8 text-center text-[11px] text-red-500">
            Unable to load opportunities. Please refresh the page or sign in again.
          </div>
        ) : opportunities.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] text-neutral-500">
            No opportunities found. Convert a lead to see it here.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]/70">
            {opportunities.map(opportunity => (
              <button
                key={opportunity.id}
                type="button"
                onClick={() => navigate(`/crm/opportunities/${opportunity.id}`)}
                className="grid w-full grid-cols-[minmax(0,1.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-elevated)]/60"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {opportunity.companyName}
                    </p>
                    <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-neutral-500">
                      #{opportunity.id.toString().padStart(4, "0")}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {opportunity.contactName} ·{" "}
                    {new Date(opportunity.createdAt).toLocaleDateString(undefined, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    {opportunity.stage}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] text-neutral-500">
                    {opportunity.assignedTo ? opportunity.assignedTo.name : "Unassigned"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                    ₹ {(opportunity.estimatedValue ?? 0).toLocaleString("en-IN", {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CountUpCard(props: {
  label: string;
  suffix?: string;
  value: number;
  previous?: number;
}) {
  const { label, suffix, value, previous } = props;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame: number;
    const duration = 500;
    const start = performance.now();
    const startValue = 0;
    const animate = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const next = startValue + (value - startValue) * progress;
      setDisplay(Math.round(next));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const delta = previous != null ? value - previous : null;
  const isUp = delta != null && delta > 0;
  const isDown = delta != null && delta < 0;

  return (
    <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">
            {display}
            {suffix}
          </p>
        </div>
        {delta != null && (
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
              isUp
                ? "bg-emerald-500/10 text-emerald-500"
                : isDown
                  ? "bg-red-500/10 text-red-500"
                  : "bg-[var(--bg-elevated)] text-neutral-500"
            }`}
          >
            <span>{isUp ? "↑" : isDown ? "↓" : "→"}</span>
            <span>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PresalesDashboardPage() {
  const [page] = useState(1);
  const pageSize = 10;

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ["presales-dashboard-summary"],
    queryFn: async () => {
      const response = await api.get("/api/v1/presales/projects/summary");
      return response.data?.data as PresalesSummary;
    },
  });

  const { data: listData, isLoading: listLoading, isError: listError } = useQuery({
    queryKey: ["presales-dashboard-projects", { page, pageSize }],
    queryFn: async () => {
      const response = await api.get("/api/v1/presales/projects", {
        params: {
          page,
          pageSize,
        },
      });
      return response.data?.data as {
        items: PresalesProjectListItem[];
        total: number;
        page: number;
        pageSize: number;
      };
    },
  });

  const kpiActive = summary?.activeCount ?? 0;
  const kpiAvgStageDuration = summary?.averageStageDurationDays ?? 0;
  const kpiWinRate = summary?.winRatePercent ?? 0;
  const kpiBoqPending = summary?.boqPendingReviewCount ?? 0;
  const projects = listData?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Presales</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Solution pursuit cockpit</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Track presales initiatives before they crystallise into opportunities and proposals.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CountUpCard label="Active Projects" value={kpiActive} />
        <CountUpCard label="Avg Stage Duration" suffix="d" value={kpiAvgStageDuration} />
        <CountUpCard label="Win Rate" suffix="%" value={kpiWinRate} />
        <CountUpCard label="BOQs Pending Review" value={kpiBoqPending} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 text-xs shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border)]/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Projects</p>
            </div>
          </div>
          {listLoading ? (
            <div className="px-4 py-8 text-center text-[11px] text-neutral-500">Loading projects…</div>
          ) : listError ? (
            <div className="px-4 py-8 text-center text-[11px] text-red-500">
              Unable to load presales projects.
            </div>
          ) : projects.length === 0 ? (
            <div className="px-4 py-8 text-center text-[11px] text-neutral-500">
              No presales projects visible yet.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.8fr)] bg-[var(--bg-elevated)]/60 px-4 py-2 text-[11px] font-medium text-neutral-500">
                <div>Title</div>
                <div>Client</div>
                <div>Assigned To</div>
                <div>Stage</div>
                <div className="text-right">Expected Value</div>
                <div className="text-right">Last Updated</div>
              </div>
              <div className="divide-y divide-[var(--border)]/70">
                {projects.map(project => (
                  <div
                    key={project.id}
                    className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-3 px-4 py-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{project.title}</p>
                      <p className="text-[11px] text-neutral-500">
                        {project.status === "active" ? "Active" : project.status}
                      </p>
                    </div>
                    <div className="text-[11px] text-neutral-500">{project.clientName}</div>
                    <div className="text-[11px] text-neutral-500">{project.assignedTo}</div>
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                        {project.currentStage}
                      </span>
                    </div>
                    <div className="text-right text-[11px] font-semibold text-[var(--text-primary)]">
                      {project.estimatedValue != null
                        ? `₹ ${project.estimatedValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                        : "TBD"}
                    </div>
                    <div className="text-right text-[11px] text-neutral-500">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-4 text-xs shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Stage mix</p>
          {summaryLoading ? (
            <div className="mt-4 text-center text-[11px] text-neutral-500">Crunching stages…</div>
          ) : summaryError ? (
            <div className="mt-4 text-center text-[11px] text-red-500">Unable to load stage distribution.</div>
          ) : !summary || summary.byStage.length === 0 ? (
            <div className="mt-4 text-center text-[11px] text-neutral-500">
              Stage distribution will appear once projects are added.
            </div>
          ) : (
            <div className="mt-3 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.byStage}
                    dataKey="count"
                    nameKey="stage"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {summary.byStage.map((row, index) => (
                      <Cell key={row.stage} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip
                    formatter={value => [`${value as number} projects`, "Count"]}
                    labelFormatter={label => String(label)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PresalesProjectsPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<string | "All">("All");
  const [statusFilter, setStatusFilter] = useState<string | "All">("active");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newLeadId, setNewLeadId] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [newPriority, setNewPriority] = useState<string>("MEDIUM");
  const [newEstimatedValue, setNewEstimatedValue] = useState("");
  const [newExpectedCloseDate, setNewExpectedCloseDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [leadQuery, setLeadQuery] = useState("");

  const pageSize = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["presales-projects", { search, stageFilter, priorityFilter, statusFilter, page, pageSize }],
    queryFn: async () => {
      const response = await api.get("/api/v1/presales/projects", {
        params: {
          search: search || undefined,
          stage: stageFilter === "All" ? undefined : stageFilter,
          priority: priorityFilter === "All" ? undefined : priorityFilter,
          status: statusFilter === "All" ? undefined : statusFilter,
          page,
          pageSize,
        },
      });
      return response.data?.data as {
        items: PresalesProjectListItem[];
        total: number;
        page: number;
        pageSize: number;
      };
    },
  });

  const { data: leadSearchData, isLoading: isLeadSearchLoading } = useQuery({
    queryKey: ["lead-search", leadQuery],
    enabled: leadQuery.trim().length >= 2,
    queryFn: async () => {
      const response = await api.get("/api/leads", {
        params: {
          search: leadQuery || undefined,
          status: "All",
          page,
          pageSize: 10,
        },
      });
      const payload = response.data?.data as
        | { items: LeadListItem[]; total: number; page: number; pageSize: number }
        | undefined;
      return payload?.items ?? [];
    },
  });

  const leadOptions = leadSearchData ?? [];

  const projects = data?.items ?? [];
  const total = data?.total ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleSelected = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const allSelected = selected.length > 0 && selected.length === projects.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(projects.map(project => project.id));
    }
  };

  const handleExportCsv = () => {
    if (projects.length === 0) return;

    const headers = [
      "ID",
      "Title",
      "Client",
      "Lead ID",
      "Assigned To",
      "Assigned By",
      "Stage",
      "Priority",
      "Estimated Value",
      "Expected Close Date",
      "Win Probability",
      "Status",
      "Created At",
      "Updated At",
    ];

    const rows = projects.map(project => [
      project.id,
      project.title,
      project.clientName,
      project.leadId ?? "",
      project.assignedTo,
      project.assignedBy,
      project.currentStage,
      project.priority,
      project.estimatedValue ?? "",
      project.expectedCloseDate
        ? new Date(project.expectedCloseDate).toISOString().split("T")[0]
        : "",
      `${project.winProbability}`,
      project.status,
      new Date(project.createdAt).toISOString(),
      new Date(project.updatedAt).toISOString(),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(value => toCsvValue(value)).join(","))
      .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    link.download = `presales-projects-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: newTitle,
        clientName: newClientName,
        leadId: newLeadId ? parseInt(newLeadId, 10) || null : null,
        assignedTo: newAssignedTo || "Unassigned",
        assignedBy: newAssignedTo || "Unassigned",
        priority: newPriority,
        estimatedValue: newEstimatedValue ? parseFloat(newEstimatedValue) : null,
        expectedCloseDate: newExpectedCloseDate || null,
        notes: newNotes || null,
      };
      const response = await api.post("/api/v1/presales/projects", payload);
      return response.data?.data?.project as PresalesProjectListItem;
    },
    onSuccess: async project => {
      await queryClient.invalidateQueries({ queryKey: ["presales-projects"] });
      setShowCreateModal(false);
      setNewTitle("");
      setNewClientName("");
      setNewLeadId("");
      setNewAssignedTo("");
      setNewPriority("MEDIUM");
      setNewEstimatedValue("");
      setNewExpectedCloseDate("");
      setNewNotes("");
      if (project?.id) {
        navigate(`/presales/projects/${project.id}`);
      }
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Presales Projects</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Discovery and solution canvas</h1>
          <p className="mt-1 text-sm text-neutral-500">
            See every presales initiative by stage, priority and assigned owner.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center rounded-full bg-[var(--accent-primary)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)]"
          >
            New Project
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-3 text-xs shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Search</span>
          <input
            value={search}
            onChange={event => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Title, client, owner…"
            className="w-52 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Stage</span>
          <select
            value={stageFilter}
            onChange={event => {
              const value = event.target.value as string | "All";
              setStageFilter(value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent-primary)]"
          >
            <option value="All">All</option>
            {presalesStages.map(stage => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Priority</span>
          <select
            value={priorityFilter}
            onChange={event => {
              const value = event.target.value as string | "All";
              setPriorityFilter(value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent-primary)]"
          >
            <option value="All">All</option>
            {presalesPriorities.map(priority => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Status</span>
          <select
            value={statusFilter}
            onChange={event => {
              const value = event.target.value as string | "All";
              setStatusFilter(value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent-primary)]"
          >
            <option value="All">All</option>
            <option value="active">Active</option>
            <option value="on-hold">On hold</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-neutral-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-1 py-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 text-xs shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)]/70 px-4 py-3">
          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Presales lane</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-neutral-600"
              disabled={selected.length === 0}
            >
              Reassign
            </button>
            <button
              type="button"
              className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-neutral-600"
              disabled={selected.length === 0}
            >
              Change priority
            </button>
            <button
              type="button"
              className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-neutral-600"
              disabled={projects.length === 0}
              onClick={handleExportCsv}
            >
              Export CSV
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="px-4 py-8 text-center text-[11px] text-neutral-500">Loading presales projects…</div>
        ) : isError ? (
          <div className="px-4 py-8 text-center text-[11px] text-red-500">
            Unable to load presales projects. You may not have access or the server is unreachable.
          </div>
        ) : projects.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] text-neutral-500">
            No presales projects found. As discovery work starts, they will appear here.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] bg-[var(--bg-elevated)]/60 px-4 py-2 text-[11px] font-medium text-neutral-500">
              <div>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="h-3 w-3 rounded border-[var(--border)]"
                />
              </div>
              <div>Title</div>
              <div>Client</div>
              <div>Assigned To</div>
              <div>Stage</div>
              <div className="text-right">Expected Value</div>
              <div className="text-right">Last Updated</div>
            </div>
            <div className="divide-y divide-[var(--border)]/70">
              {projects.map(project => {
                const isSelected = selected.includes(project.id);
                return (
                  <div
                    key={project.id}
                    className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-4 py-3"
                  >
                    <div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(project.id)}
                        className="h-3 w-3 rounded border-[var(--border)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{project.title}</p>
                      <p className="text-[11px] text-neutral-500">
                        {project.clientName}
                        {project.leadId ? ` · Lead #${project.leadId}` : ""}
                      </p>
                    </div>
                    <div className="text-[11px] text-neutral-500">{project.assignedTo}</div>
                    <div>
                      <span className="inline-flex items-center rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[11px] text-neutral-600">
                        {project.priority}
                      </span>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                        {project.currentStage}
                      </span>
                    </div>
                    <div className="text-right text-[11px] font-semibold text-[var(--text-primary)]">
                      {project.estimatedValue != null
                        ? `₹ ${project.estimatedValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                        : "TBD"}
                    </div>
                    <div className="flex items-center justify-end gap-2 text-right text-[11px] text-neutral-500">
                      <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                      <button
                        type="button"
                        onClick={() => navigate(`/presales/projects/${project.id}`)}
                        className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-[11px] text-neutral-600"
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-xs shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  New presales project
                </p>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Capture title, client and owner before moving into requirement analysis.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] text-neutral-600"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[11px] text-neutral-500">Title</p>
                <input
                  value={newTitle}
                  onChange={event => setNewTitle(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  placeholder="Customer project label"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-neutral-500">Client Name</p>
                <input
                  value={newClientName}
                  onChange={event => setNewClientName(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  placeholder="Client organisation"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-neutral-500">Linked Lead</p>
                <div className="space-y-1">
                  <input
                    value={leadQuery}
                    onChange={event => setLeadQuery(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    placeholder="Search by company, contact, email…"
                  />
                  {newLeadId && (
                    <p className="text-[11px] text-neutral-500">Selected lead ID: #{newLeadId}</p>
                  )}
                  {leadQuery.trim().length >= 2 && (
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
                      {isLeadSearchLoading ? (
                        <div className="px-3 py-2 text-[11px] text-neutral-500">Searching leads…</div>
                      ) : leadOptions.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-neutral-500">No leads match this search.</div>
                      ) : (
                        leadOptions.map(lead => (
                          <button
                            key={lead.id}
                            type="button"
                            onClick={() => {
                              setNewLeadId(String(lead.id));
                              setLeadQuery(`${lead.contactName} · ${lead.companyName}`);
                            }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] hover:bg-[var(--bg-elevated)]"
                          >
                            <div>
                              <p className="text-xs font-semibold text-[var(--text-primary)]">
                                {lead.contactName || "Unnamed contact"}
                              </p>
                              <p className="text-[11px] text-neutral-500">
                                {lead.companyName}
                                {lead.email ? ` · ${lead.email}` : ""}
                              </p>
                            </div>
                            <div className="text-[11px] text-neutral-500">#{lead.id}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-neutral-500">Assign To</p>
                <input
                  value={newAssignedTo}
                  onChange={event => setNewAssignedTo(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  placeholder="Presales engineer name"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-neutral-500">Priority</p>
                <select
                  value={newPriority}
                  onChange={event => setNewPriority(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                >
                  {presalesPriorities.map(priority => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-neutral-500">Expected Value</p>
                <input
                  type="number"
                  value={newEstimatedValue}
                  onChange={event => setNewEstimatedValue(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-neutral-500">Expected Close Date</p>
                <input
                  type="date"
                  value={newExpectedCloseDate}
                  onChange={event => setNewExpectedCloseDate(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className="text-[11px] text-neutral-500">Notes</p>
                <textarea
                  value={newNotes}
                  onChange={event => setNewNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  placeholder="Any context for this pursuit."
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-1.5 text-neutral-600"
                disabled={createMutation.isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newTitle.trim() || !newClientName.trim() || createMutation.isLoading}
                onClick={() => createMutation.mutate()}
                className="rounded-full bg-[var(--accent-primary)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {createMutation.isLoading ? "Creating…" : "Create project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OpportunityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [activeTab, setActiveTab] = useState<"overview" | "timeline">("overview");

  const opportunityId = id ? parseInt(id, 10) : NaN;

  const { data, isLoading } = useQuery({
    queryKey: ["opportunity", opportunityId],
    enabled: Number.isFinite(opportunityId),
    queryFn: async () => {
      const response = await api.get(`/api/opportunities/${opportunityId}`);
      return response.data?.data?.opportunity as OpportunityDetail;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/opportunities/${opportunityId}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] }),
      ]);
      navigate("/crm/opportunities");
    },
  });

  if (!Number.isFinite(opportunityId)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">Invalid opportunity identifier.</p>
      </div>
    );
  }

  const opportunity = data;
  const canDelete = !!user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-20 border-b border-[var(--border)]/70 bg-[var(--bg-surface)]/95 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            {isLoading || !opportunity ? (
              <>
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Opportunity</p>
                <h1 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  Loading opportunity…
                </h1>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Opportunity</p>
                <h1 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  {opportunity.companyName}
                </h1>
                <p className="text-xs text-neutral-500">
                  {opportunity.contactName} · #{opportunity.id.toString().padStart(4, "0")}
                </p>
              </>
            )}
          </div>
          {opportunity && (
            <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
              <div className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]">
                <span className="mr-2 text-neutral-500">Stage</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {opportunity.stage}
                </span>
              </div>
              <div className="text-right text-[11px]">
                <p className="text-neutral-500">Potential value</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  ₹ {(opportunity.estimatedValue ?? 0).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              {canDelete && (
                <button
                  type="button"
                  disabled={deleteMutation.isLoading}
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this opportunity?")) {
                      deleteMutation.mutate();
                    }
                  }}
                  className="rounded-full border border-red-400/70 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-500/20 disabled:opacity-60"
                >
                  {deleteMutation.isLoading ? "Deleting…" : "Delete"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!isLoading && opportunity && (
        <main className="flex-1 overflow-y-auto px-4 py-5 text-xs md:px-6">
          <div className="flex items-center justify-between border-b border-[var(--border)]/70 pb-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-elevated)] px-1 py-1 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`rounded-full px-3 py-1 ${
                  activeTab === "overview" ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : "text-neutral-500"
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("timeline")}
                className={`rounded-full px-3 py-1 ${
                  activeTab === "timeline" ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : "text-neutral-500"
                }`}
              >
                Timeline
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">
              Last update: {new Date(opportunity.createdAt).toLocaleDateString(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>

          {activeTab === "overview" ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <CollapsibleSection id="opportunity-summary" title="Opportunity Summary" defaultOpen>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-neutral-500">
                        Track stage, commercials and owner before you move to quotation.
                      </p>
                    </div>
                    <div className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px] text-neutral-500">
                      Created{" "}
                      {new Date(opportunity.createdAt).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Company</p>
                      <p className="text-sm text-[var(--text-primary)]">{opportunity.companyName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Primary contact</p>
                      <p className="text-sm text-[var(--text-primary)]">{opportunity.contactName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Stage</p>
                      <p className="text-sm text-[var(--text-primary)]">{opportunity.stage}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Owner</p>
                      <p className="text-sm text-[var(--text-primary)]">
                        {opportunity.assignedTo ? opportunity.assignedTo.name : "Unassigned"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Estimated value</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        ₹ {(opportunity.estimatedValue ?? 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Linked lead status</p>
                      <p className="text-sm text-[var(--text-primary)]">
                        {opportunity.lead ? opportunity.lead.status : "Not available"}
                      </p>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="opportunity-commercials" title="Commercial Notes">
                  <p className="text-[11px] text-neutral-500">
                    Capture key assumptions or approval notes for this pursuit.
                  </p>
                  <textarea
                    rows={4}
                    placeholder="Example: Customer expects phased rollout across 3 locations with go-live in Q3."
                    className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  />
                </CollapsibleSection>

                <CollapsibleSection id="opportunity-customer-address" title="Customer Address Information">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2 space-y-1">
                      <p className="text-[11px] text-neutral-500">Street</p>
                      <p className="text-sm text-[var(--text-primary)]">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">City</p>
                      <p className="text-sm text-neutral-500">{opportunity.lead?.city || "Not set"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">State</p>
                      <p className="text-sm text-neutral-500">{opportunity.lead?.state || "Not set"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Zip Code</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Country</p>
                      <p className="text-sm text-neutral-500">India</p>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="opportunity-customer-industry" title="Customer & Industry Information">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">End Customer</p>
                      <p className="text-sm text-[var(--text-primary)]">
                        {opportunity.companyName || opportunity.lead?.companyName || "Not set"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Industry</p>
                      <select className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]">
                        <option>Large Enterprise</option>
                      </select>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="opportunity-entity-information" title="Entity Information">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Entity Name</p>
                      <a href="#" className="text-sm text-sky-500">
                        Cache Digitech
                      </a>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Entity Email</p>
                      <a href="mailto:sales@cachedigitech.com" className="text-sm text-sky-500">
                        sales@cachedigitech.com
                      </a>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-[11px] text-neutral-500">Entity Address</p>
                      <p className="text-sm text-neutral-500">Pune, Maharashtra, India</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Organization</p>
                      <p className="text-sm text-neutral-500">Cache Digitech</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Entity GST No.</p>
                      <p className="text-sm text-neutral-500">Not set</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-500">Entity Contact Number</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-neutral-500">+91-00000-00000</p>
                        <span>📞</span>
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="opportunity-additional-information" title="Additional Information">
                  <div className="space-y-1">
                    <p className="text-[11px] text-neutral-500">Description</p>
                    <textarea
                      value={opportunity.lead?.requirement ?? "Not captured"}
                      readOnly
                      className="mt-1 w-full min-h-[80px] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  id="opportunity-notes"
                  title="Notes"
                  headerRight={
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                    >
                      Add Note
                    </button>
                  }
                >
                  <div className="space-y-2">
                    <input
                      placeholder="Add a note..."
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                    />
                    <p className="text-[11px] text-neutral-500">No notes yet.</p>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  id="opportunity-connected-records"
                  title="Connected Records"
                  headerRight={
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                    >
                      Add New ▾
                    </button>
                  }
                >
                  <p className="text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>

                <CollapsibleSection
                  id="opportunity-products"
                  title="Products"
                  headerRight={
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                    >
                      Add Products
                    </button>
                  }
                >
                  <p className="text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>

                <CollapsibleSection
                  id="opportunity-open-activities"
                  title="Open Activities"
                  headerRight={
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                    >
                      Add New ▾
                    </button>
                  }
                >
                  <p className="text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>

                <CollapsibleSection id="opportunity-closed-activities" title="Closed Activities">
                  <p className="text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>

                <CollapsibleSection
                  id="opportunity-emails"
                  title="Emails"
                  headerRight={
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                      >
                        Compose Email
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]"
                      >
                        All Emails ▾
                      </button>
                    </div>
                  }
                >
                  <div className="flex items-center gap-4 border-b border-[var(--border)]/70 pb-2 text-[11px]">
                    <button type="button" className="rounded-full bg-[var(--bg-elevated)] px-3 py-1">
                      Mails
                    </button>
                    <button type="button" className="rounded-full px-3 py-1 text-neutral-500">
                      Drafts
                    </button>
                    <button type="button" className="rounded-full px-3 py-1 text-neutral-500">
                      Scheduled
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>

                <CollapsibleSection id="opportunity-social" title="Social">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-24 rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-[var(--text-primary)]">
                        Start interacting with your connections on social networks.
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Connect social accounts to see interactions and conversations here.
                      </p>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="opportunity-related-list-1" title="Related List Label 1">
                  <p className="text-[11px] text-neutral-500">No records found.</p>
                </CollapsibleSection>
              </div>

              <div className="space-y-4">
                <CollapsibleSection
                  id="opportunity-linked-lead"
                  title="Linked Lead"
                  headerRight={
                    opportunity.lead && (
                      <button
                        type="button"
                        onClick={() => navigate(`/crm/leads/${opportunity.lead?.id}`)}
                        className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px]"
                      >
                        Open lead
                      </button>
                    )
                  }
                >
                  {opportunity.lead ? (
                    <div className="mt-3 space-y-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 via-violet-500 to-emerald-500 text-[11px] font-semibold text-slate-950">
                          {opportunity.lead.companyName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            {opportunity.lead.companyName}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {opportunity.lead.contactName} · {opportunity.lead.status}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-neutral-500">
                        {opportunity.lead.email} · {opportunity.lead.phone}
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-500">{opportunity.lead.source}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-neutral-500">
                      This opportunity was created without a linked lead.
                    </p>
                  )}
                </CollapsibleSection>

                <CollapsibleSection id="opportunity-next-steps" title="Next Steps">
                  <ul className="mt-3 space-y-2 text-[11px] text-neutral-500">
                    <li>Align on scope and share first commercial draft.</li>
                    <li>Log meetings and calls as the opportunity progresses.</li>
                    <li>Move to quotation module once scope is frozen.</li>
                  </ul>
                </CollapsibleSection>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-8 text-center text-[11px] text-neutral-500">
              Timeline view will show a chronological feed of emails, calls, meetings and updates for this
              opportunity.
            </div>
          )}
        </main>
      )}
    </div>
  );
}

function WinProbabilityGauge({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 600;
    const animate = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const next = value * progress;
      setDisplayValue(Math.round(next));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, displayValue));
  const offset = circumference - (clamped / 100) * circumference;

  const color =
    clamped < 30 ? "#ef4444" : clamped < 60 ? "#f97316" : "#22c55e";

  return (
    <div
      className="relative flex items-center gap-3 text-xs"
      title="Win probability is derived from POC outcome, proposal status, requirement completeness and proximity to expected close date."
    >
      <svg width={72} height={40} viewBox="0 0 72 40">
        <defs>
          <linearGradient id="presalesGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <g transform="translate(36,36) rotate(-90)">
          <circle
            r={radius}
            fill="transparent"
            stroke="rgba(148,163,184,0.25)"
            strokeWidth={6}
            strokeDasharray={circumference}
            strokeDashoffset={circumference / 2}
            strokeLinecap="round"
          />
          <circle
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={6}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
          />
        </g>
      </svg>
      <div className="space-y-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
          Win Probability
        </p>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {clamped}
          <span className="ml-0.5 text-[11px] text-neutral-500">%</span>
        </p>
      </div>
    </div>
  );
}

function PresalesProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projectId = id ?? "";

  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [stageNotes, setStageNotes] = useState("");
  const [requirementsFunctional, setRequirementsFunctional] = useState<
    { id: string; description: string; priority: string; status: string }[]
  >([]);
  const [requirementsTechnical, setRequirementsTechnical] = useState<
    { id: string; description: string; priority: string; status: string }[]
  >([]);
  const [requirementsStakeholders, setRequirementsStakeholders] = useState<
    { id: string; name: string; role: string; contact: string }[]
  >([]);
  const [requirementsConstraints, setRequirementsConstraints] = useState("");
  const [requirementsRawNotes, setRequirementsRawNotes] = useState("");
  const [requirementsLastSavedAt, setRequirementsLastSavedAt] = useState<Date | null>(null);

  const [architectureUrl, setArchitectureUrl] = useState("");
  const [diagramUrl, setDiagramUrl] = useState("");
  const [recommendedOption, setRecommendedOption] = useState("");
  const [justification, setJustification] = useState("");
  const [techStackTags, setTechStackTags] = useState<{
    frontend: string[];
    backend: string[];
    infrastructure: string[];
    security: string[];
  }>({
    frontend: [],
    backend: [],
    infrastructure: [],
    security: [],
  });
  const [techStackInputs, setTechStackInputs] = useState<{
    frontend: string;
    backend: string;
    infrastructure: string;
    security: string;
  }>({
    frontend: "",
    backend: "",
    infrastructure: "",
    security: "",
  });
  const [competitors, setCompetitors] = useState<
    { id: string; name: string; offering: string; advantage: string; riskLevel: string }[]
  >([]);
  const [boqItems, setBoqItems] = useState<
    {
      id: string;
      category: string;
      item: string;
      spec: string;
      quantity: string;
      unit: string;
      listPrice: string;
      negotiatedPrice: string;
    }[]
  >([]);
  const [boqEffortDays, setBoqEffortDays] = useState("");
  const [boqResourceCount, setBoqResourceCount] = useState("");
  const [boqDailyRate, setBoqDailyRate] = useState("10000");
  const [pocRequired, setPocRequired] = useState(true);
  const [pocObjective, setPocObjective] = useState("");
  const [pocScope, setPocScope] = useState("");
  const [pocEnvironment, setPocEnvironment] = useState("");
  const [pocStartDate, setPocStartDate] = useState("");
  const [pocEndDate, setPocEndDate] = useState("");
  const [pocFindings, setPocFindings] = useState("");
  const [pocSuccessCriteria, setPocSuccessCriteria] = useState<
    { id: string; label: string; completed: boolean }[]
  >([]);
  const [pocOutcome, setPocOutcome] = useState<string | null>(null);
  const [pocEvidence, setPocEvidence] = useState<string>("");
  const [proposalTab, setProposalTab] = useState<"editor" | "preview" | "versions">("editor");
  const [proposalExecutiveSummary, setProposalExecutiveSummary] = useState("");
  const [proposalScopeOfWork, setProposalScopeOfWork] = useState("");
  const [proposalTechnicalApproach, setProposalTechnicalApproach] = useState("");
  const [proposalTerms, setProposalTerms] = useState("");
  const [proposalCommercials, setProposalCommercials] = useState<
    { id: string; item: string; description: string; price: string }[]
  >([]);
  const [proposalTimeline, setProposalTimeline] = useState<{ id: string; name: string; weeks: string }[]>([]);
  const [proposalTeam, setProposalTeam] = useState<{ id: string; role: string; count: string }[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["presales", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const response = await api.get(`/api/v1/presales/projects/${projectId}`);
      return response.data?.data?.project as PresalesProjectDetail | undefined;
    },
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    if (data.requirements) {
      if (typeof data.requirements.rawNotes === "string") {
        setRequirementsRawNotes(data.requirements.rawNotes);
      }
      if (typeof data.requirements.constraints === "string") {
        setRequirementsConstraints(data.requirements.constraints);
      }
      if (isArrayOfObjects(data.requirements.functionalReq)) {
        setRequirementsFunctional(
          data.requirements.functionalReq.map((item, index) => ({
            id: (item.id as string) || `f-${index + 1}`,
            description: String(item.description ?? ""),
            priority: String(item.priority ?? "Medium"),
            status: String(item.status ?? "Open"),
          })),
        );
      } else {
        setRequirementsFunctional([]);
      }
      if (isArrayOfObjects(data.requirements.technicalReq)) {
        setRequirementsTechnical(
          data.requirements.technicalReq.map((item, index) => ({
            id: (item.id as string) || `t-${index + 1}`,
            description: String(item.description ?? ""),
            priority: String(item.priority ?? "Medium"),
            status: String(item.status ?? "Open"),
          })),
        );
      } else {
        setRequirementsTechnical([]);
      }
      if (isArrayOfObjects(data.requirements.stakeholders)) {
        setRequirementsStakeholders(
          data.requirements.stakeholders.map((item, index) => ({
            id: (item.id as string) || `s-${index + 1}`,
            name: String(item.name ?? ""),
            role: String(item.role ?? ""),
            contact: String(item.contact ?? ""),
          })),
        );
      } else {
        setRequirementsStakeholders([]);
      }
    } else {
      setRequirementsRawNotes("");
      setRequirementsConstraints("");
      setRequirementsFunctional([]);
      setRequirementsTechnical([]);
      setRequirementsStakeholders([]);
    }

    if (data.solution) {
      setArchitectureUrl(data.solution.architectureUrl ?? "");
      setDiagramUrl(data.solution.diagramUrl ?? "");
      setRecommendedOption(data.solution.recommendedOption ?? "");
      setJustification(data.solution.justification ?? "");

      if (data.solution.techStack && typeof data.solution.techStack === "object") {
        const stack = data.solution.techStack;
        setTechStackTags({
          frontend: Array.isArray((stack as any).Frontend) ? (stack as any).Frontend : [],
          backend: Array.isArray((stack as any).Backend) ? (stack as any).Backend : [],
          infrastructure: Array.isArray((stack as any).Infrastructure) ? (stack as any).Infrastructure : [],
          security: Array.isArray((stack as any).Security) ? (stack as any).Security : [],
        });
      } else {
        setTechStackTags({
          frontend: [],
          backend: [],
          infrastructure: [],
          security: [],
        });
      }

      if (isArrayOfObjects(data.solution.competitors)) {
        setCompetitors(
          (data.solution.competitors as any[]).map((item, index) => ({
            id: (item.id as string) || `c-${index + 1}`,
            name: String(item.name ?? ""),
            offering: String(item.offering ?? ""),
            advantage: String(item.advantage ?? ""),
            riskLevel: String(item.riskLevel ?? ""),
          })),
        );
      } else {
        setCompetitors([]);
      }
    } else {
      setArchitectureUrl("");
      setDiagramUrl("");
      setRecommendedOption("");
      setJustification("");
      setTechStackTags({
        frontend: [],
        backend: [],
        infrastructure: [],
        security: [],
      });
      setCompetitors([]);
    }

    if (data.boq && isArrayOfObjects(data.boq.lineItems)) {
      setBoqItems(
        (data.boq.lineItems as any[]).map((item, index) => ({
          id: (item.id as string) || `b-${index + 1}`,
          category: String(item.category ?? ""),
          item: String(item.item ?? ""),
          spec: String(item.spec ?? ""),
          quantity: String(item.quantity ?? ""),
          unit: String(item.unit ?? ""),
          listPrice: String(item.listPrice ?? ""),
          negotiatedPrice: String(item.negotiatedPrice ?? ""),
        })),
      );
      if (typeof data.boq.effortDays === "number") {
        setBoqEffortDays(String(data.boq.effortDays));
      } else {
        setBoqEffortDays("");
      }
      if (typeof data.boq.resourceCount === "number") {
        setBoqResourceCount(String(data.boq.resourceCount));
      } else {
        setBoqResourceCount("");
      }
    } else {
      setBoqItems([]);
      setBoqEffortDays("");
      setBoqResourceCount("");
    }

    if (data.poc) {
      setPocRequired(data.poc.status !== "not_required");
      setPocObjective(data.poc.objective ?? "");
      setPocScope(data.poc.scope ?? "");
      setPocEnvironment(data.poc.environment ?? "");
      setPocStartDate(data.poc.startDate ?? "");
      setPocEndDate(data.poc.endDate ?? "");
      setPocFindings(data.poc.findings ?? "");
      setPocOutcome(data.poc.outcome ?? null);
      if (Array.isArray(data.poc.evidenceUrls)) {
        setPocEvidence((data.poc.evidenceUrls as any[]).join(", "));
      } else {
        setPocEvidence("");
      }
      if (isArrayOfObjects(data.poc.successCriteria)) {
        setPocSuccessCriteria(
          (data.poc.successCriteria as any[]).map((item, index) => ({
            id: (item.id as string) || `sc-${index + 1}`,
            label: String(item.label ?? ""),
            completed: Boolean(item.completed),
          })),
        );
      } else {
        setPocSuccessCriteria([]);
      }
    } else {
      setPocRequired(true);
      setPocObjective("");
      setPocScope("");
      setPocEnvironment("");
      setPocStartDate("");
      setPocEndDate("");
      setPocFindings("");
      setPocOutcome(null);
      setPocEvidence("");
      setPocSuccessCriteria([]);
    }

    if (data.proposal) {
      setProposalExecutiveSummary(data.proposal.executiveSummary ?? "");
      setProposalScopeOfWork(data.proposal.scopeOfWork ?? "");
      setProposalTechnicalApproach(data.proposal.technicalApproach ?? "");
      setProposalTerms(data.proposal.termsConditions ?? "");
      if (isArrayOfObjects(data.proposal.commercials)) {
        setProposalCommercials(
          (data.proposal.commercials as any[]).map((item, index) => ({
            id: (item.id as string) || `pc-${index + 1}`,
            item: String(item.item ?? ""),
            description: String(item.description ?? ""),
            price: String(item.price ?? ""),
          })),
        );
      } else {
        setProposalCommercials([]);
      }
      if (isArrayOfObjects(data.proposal.timeline)) {
        setProposalTimeline(
          (data.proposal.timeline as any[]).map((item, index) => ({
            id: (item.id as string) || `pt-${index + 1}`,
            name: String(item.name ?? ""),
            weeks: String(item.weeks ?? ""),
          })),
        );
      } else {
        setProposalTimeline([]);
      }
      if (isArrayOfObjects(data.proposal.teamStructure)) {
        setProposalTeam(
          (data.proposal.teamStructure as any[]).map((item, index) => ({
            id: (item.id as string) || `tm-${index + 1}`,
            role: String(item.role ?? ""),
            count: String(item.count ?? ""),
          })),
        );
      } else {
        setProposalTeam([]);
      }
    } else {
      setProposalExecutiveSummary("");
      setProposalScopeOfWork("");
      setProposalTechnicalApproach("");
      setProposalTerms("");
      setProposalCommercials([]);
      setProposalTimeline([]);
      setProposalTeam([]);
    }
  }, [data]);

  return (
    <div className="space-y-6">
      {/* existing JSX unchanged */}
    </div>
  );
}

function PresalesBoqPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["presales-boq-board"],
    queryFn: async () => {
      const response = await api.get("/api/v1/presales/boq");
      return (response.data?.data?.items ?? []) as {
        id: string;
        projectId: string;
        totalValue: number | null;
        status: string;
        version: number;
        submittedAt: string | null;
        project: PresalesProjectListItem;
      }[];
    },
  });

  const items = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">BOQ Board</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            Commercial estimates ready for review
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            See every presales BOQ with value, status and latest version.
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 text-xs shadow-sm">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.8fr)] bg-[var(--bg-elevated)]/60 px-4 py-2 text-[11px] font-medium text-neutral-500">
          <div>Project</div>
          <div className="text-right">Total Value</div>
          <div>Status</div>
          <div>Version</div>
          <div className="text-right">Submitted</div>
        </div>
        {isLoading ? (
          <div className="px-4 py-8 text-center text-[11px] text-neutral-500">Loading BOQs…</div>
        ) : isError ? (
          <div className="px-4 py-8 text-center text-[11px] text-red-500">
            Unable to load BOQ board. Please refresh or sign in again.
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] text-neutral-500">
            No BOQs have been created yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]/70">
            {items.map(row => (
              <button
                key={row.id}
                type="button"
                onClick={() => navigate(`/presales/projects/${row.projectId}`)}
                className="grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.8fr)] items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-elevated)]/60"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {row.project.title}
                  </p>
                  <p className="text-[11px] text-neutral-500">{row.project.clientName}</p>
                </div>
                <div className="text-right text-[11px] font-semibold text-[var(--text-primary)]">
                  {row.totalValue != null ? row.totalValue.toLocaleString("en-IN") : "—"}
                </div>
                <div>
                  <span className="inline-flex items-center rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[11px] text-neutral-600">
                    {row.status}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500">v{row.version}</div>
                <div className="text-right text-[11px] text-neutral-500">
                  {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "Not submitted"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PresalesPocPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["presales-poc-board"],
    queryFn: async () => {
      const response = await api.get("/api/v1/presales/poc");
      return (response.data?.data?.items ?? []) as {
        id: string;
        projectId: string;
        engineerName: string | null;
        startDate: string | null;
        endDate: string | null;
        status: string;
        outcome: string | null;
        project: PresalesProjectListItem;
      }[];
    },
  });

  const items = data ?? [];

  const outcomeColor = (outcome: string | null) => {
    if (outcome === "success") return "bg-emerald-500/10 text-emerald-400";
    if (outcome === "partial") return "bg-amber-500/10 text-amber-400";
    if (outcome === "fail") return "bg-red-500/10 text-red-400";
    return "bg-neutral-700 text-neutral-200";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">PoC Tracker</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            Proof of concepts across pursuits
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Track PoC owners, dates and outcomes across all presales projects.
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 text-xs shadow-sm">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] bg-[var(--bg-elevated)]/60 px-4 py-2 text-[11px] font-medium text-neutral-500">
          <div>Project</div>
          <div>Engineer</div>
          <div>Dates</div>
          <div>Status</div>
          <div>Outcome</div>
        </div>
        {isLoading ? (
          <div className="px-4 py-8 text-center text-[11px] text-neutral-500">Loading PoCs…</div>
        ) : isError ? (
          <div className="px-4 py-8 text-center text-[11px] text-red-500">
            Unable to load PoC tracker. Please refresh or sign in again.
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] text-neutral-500">
            No PoCs have been configured yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]/70">
            {items.map(row => (
              <button
                key={row.id}
                type="button"
                onClick={() => navigate(`/presales/projects/${row.projectId}`)}
                className="grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-elevated)]/60"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {row.project.title}
                  </p>
                  <p className="text-[11px] text-neutral-500">{row.project.clientName}</p>
                </div>
                <div className="text-[11px] text-neutral-500">
                  {row.engineerName ?? "Unassigned"}
                </div>
                <div className="text-[11px] text-neutral-500">
                  {row.startDate
                    ? `${new Date(row.startDate).toLocaleDateString()} – ${
                        row.endDate ? new Date(row.endDate).toLocaleDateString() : "TBD"
                      }`
                    : "TBD"}
                </div>
                <div>
                  <span className="inline-flex items-center rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[11px] text-neutral-600">
                    {row.status}
                  </span>
                </div>
                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${outcomeColor(
                      row.outcome,
                    )}`}
                  >
                    {row.outcome ?? "Not set"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PresalesProposalsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["presales-proposals-board"],
    queryFn: async () => {
      const response = await api.get("/api/v1/presales/proposals");
      return (response.data?.data?.items ?? []) as {
        id: string;
        projectId: string;
        value: number | null;
        status: string;
        version: number;
        sentAt: string | null;
        clientResponse: string | null;
        project: PresalesProjectListItem;
      }[];
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      await api.post(`/api/v1/presales/proposals/${proposalId}/reminder`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["presales-proposals-board"] });
    },
  });

  const items = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Proposals</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            Commercial proposals sent to customers
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Monitor proposal versions, values and responses across your presales pipeline.
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 text-xs shadow-sm">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] bg-[var(--bg-elevated)]/60 px-4 py-2 text-[11px] font-medium text-neutral-500">
          <div>Project</div>
          <div className="text-right">Value</div>
          <div>Status</div>
          <div>Version</div>
          <div className="text-right">Sent</div>
          <div>Client Response</div>
        </div>
        {isLoading ? (
          <div className="px-4 py-8 text-center text-[11px] text-neutral-500">Loading proposals…</div>
        ) : isError ? (
          <div className="px-4 py-8 text-center text-[11px] text-red-500">
            Unable to load proposals board. Please refresh or sign in again.
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] text-neutral-500">
            No proposals have been drafted yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]/70">
            {items.map(row => {
              const isReminderEligible =
                row.status === "sent" &&
                row.sentAt != null &&
                new Date().getTime() - new Date(row.sentAt).getTime() > 7 * 24 * 60 * 60 * 1000 &&
                !row.clientResponse;
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] items-center gap-3 px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/presales/projects/${row.projectId}`)}
                    className="flex flex-col items-start gap-1 text-left"
                  >
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {row.project.title}
                    </p>
                    <p className="text-[11px] text-neutral-500">{row.project.clientName}</p>
                  </button>
                  <div className="text-right text-[11px] font-semibold text-[var(--text-primary)]">
                    {row.value != null ? row.value.toLocaleString("en-IN") : "—"}
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[11px] text-neutral-600">
                      {row.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500">v{row.version}</div>
                  <div className="text-right text-[11px] text-neutral-500">
                    {row.sentAt ? new Date(row.sentAt).toLocaleDateString() : "Not sent"}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                    <span>{row.clientResponse ?? "Awaiting response"}</span>
                    <button
                      type="button"
                      disabled={!isReminderEligible || sendReminderMutation.isLoading}
                      onClick={() => sendReminderMutation.mutate(row.id)}
                      className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-[11px] text-neutral-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Send Reminder
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const advanceStageMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/v1/presales/projects/${projectId}/stages/advance`, {
        notes: stageNotes || null,
      });
    },
    onSuccess: async () => {
      setStageModalOpen(false);
      setStageNotes("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["presales", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["presales-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["presales-dashboard-summary"] }),
      ]);
    },
  });

  const requirementsMutation = useMutation({
    mutationFn: async () => {
      const functionalPayload = requirementsFunctional.map(item => ({
        id: item.id,
        description: item.description,
        priority: item.priority,
        status: item.status,
      }));
      const technicalPayload = requirementsTechnical.map(item => ({
        id: item.id,
        description: item.description,
        priority: item.priority,
        status: item.status,
      }));
      const stakeholdersPayload = requirementsStakeholders.map(item => ({
        id: item.id,
        name: item.name,
        role: item.role,
        contact: item.contact,
      }));
      await api.put(`/api/v1/presales/projects/${projectId}/requirements`, {
        rawNotes: requirementsRawNotes || null,
        functionalReq: functionalPayload,
        technicalReq: technicalPayload,
        constraints: requirementsConstraints || null,
        stakeholders: stakeholdersPayload,
      });
    },
    onSuccess: async () => {
      setRequirementsLastSavedAt(new Date());
      await queryClient.invalidateQueries({ queryKey: ["presales", projectId] });
    },
  });

  const solutionMutation = useMutation({
    mutationFn: async () => {
      const techStackPayload: Record<string, string[]> = {
        Frontend: techStackTags.frontend,
        Backend: techStackTags.backend,
        Infrastructure: techStackTags.infrastructure,
        Security: techStackTags.security,
      };
      const competitorsPayload = competitors.map(item => ({
        id: item.id,
        name: item.name,
        offering: item.offering,
        advantage: item.advantage,
        riskLevel: item.riskLevel,
      }));
      await api.put(`/api/v1/presales/projects/${projectId}/solution`, {
        architectureUrl: architectureUrl || null,
        diagramUrl: diagramUrl || null,
        techStack: techStackPayload,
        competitors: competitorsPayload,
        recommendedOption: recommendedOption || null,
        justification: justification || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["presales", projectId] });
    },
  });

  const boqMutation = useMutation({
    mutationFn: async () => {
      const lineItemsPayload = boqItems.map(item => ({
        id: item.id,
        category: item.category,
        item: item.item,
        spec: item.spec,
        quantity: Number(item.quantity || 0),
        unit: item.unit,
        listPrice: Number(item.listPrice || 0),
        negotiatedPrice: Number(item.negotiatedPrice || 0),
      }));
      await api.put(`/api/v1/presales/projects/${projectId}/boq`, {
        lineItems: lineItemsPayload,
        effortDays: boqEffortDays ? Number(boqEffortDays) : null,
        resourceCount: boqResourceCount ? Number(boqResourceCount) : null,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["presales", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["presales-boq-board"] }),
      ]);
    },
  });

  const boqSubmitMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/v1/presales/projects/${projectId}/boq/submit`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["presales", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["presales-boq-board"] }),
      ]);
    },
  });

  const pocMutation = useMutation({
    mutationFn: async () => {
      const successCriteriaPayload = pocSuccessCriteria.map(item => ({
        id: item.id,
        label: item.label,
        completed: item.completed,
      }));
      const evidenceUrls =
        pocEvidence.trim().length > 0
          ? pocEvidence
              .split(",")
              .map(part => part.trim())
              .filter(Boolean)
          : [];
      await api.put(`/api/v1/presales/projects/${projectId}/poc`, {
        objective: pocObjective || null,
        scope: pocScope || null,
        successCriteria: successCriteriaPayload,
        environment: pocEnvironment || null,
        startDate: pocStartDate || null,
        endDate: pocEndDate || null,
        outcome: pocOutcome,
        findings: pocFindings || null,
        evidenceUrls,
        status: pocRequired ? "planned" : "not_required",
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["presales", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["presales-poc-board"] }),
      ]);
    },
  });

  const pocOutcomeMutation = useMutation({
    mutationFn: async (outcome: string) => {
      await api.patch(`/api/v1/presales/projects/${projectId}/poc/outcome`, {
        outcome,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["presales", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["presales-poc-board"] }),
      ]);
    },
  });

  const proposalMutation = useMutation({
    mutationFn: async () => {
      const commercialsPayload = proposalCommercials.map(item => ({
        id: item.id,
        item: item.item,
        description: item.description,
        price: Number(item.price || 0),
      }));
      const timelinePayload = proposalTimeline.map(item => ({
        id: item.id,
        name: item.name,
        weeks: Number(item.weeks || 0),
      }));
      const teamPayload = proposalTeam.map(item => ({
        id: item.id,
        role: item.role,
        count: Number(item.count || 0),
      }));
      await api.put(`/api/v1/presales/projects/${projectId}/proposal`, {
        executiveSummary: proposalExecutiveSummary || null,
        scopeOfWork: proposalScopeOfWork || null,
        technicalApproach: proposalTechnicalApproach || null,
        commercials: commercialsPayload,
        timeline: timelinePayload,
        teamStructure: teamPayload,
        termsConditions: proposalTerms || null,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["presales", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["presales-proposals-board"] }),
      ]);
    },
  });

  if (!projectId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">Invalid presales identifier.</p>
      </div>
    );
  }

  const project = data;

  const currentStageIndex =
    project != null ? presalesStages.findIndex(stage => stage === project.currentStage) : -1;

  const nextStage =
    currentStageIndex >= 0 && currentStageIndex < presalesStages.length - 1
      ? presalesStages[currentStageIndex + 1]
      : null;

  const handleJump = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const addRequirementRow = (type: "functional" | "technical") => {
    if (type === "functional") {
      setRequirementsFunctional(prev => [
        ...prev,
        { id: `f-${prev.length + 1}`, description: "", priority: "Medium", status: "Open" },
      ]);
    } else {
      setRequirementsTechnical(prev => [
        ...prev,
        { id: `t-${prev.length + 1}`, description: "", priority: "Medium", status: "Open" },
      ]);
    }
  };

  const removeRequirementRow = (type: "functional" | "technical", idToRemove: string) => {
    if (type === "functional") {
      setRequirementsFunctional(prev => prev.filter(item => item.id !== idToRemove));
    } else {
      setRequirementsTechnical(prev => prev.filter(item => item.id !== idToRemove));
    }
  };

  const addStakeholderRow = () => {
    setRequirementsStakeholders(prev => [
      ...prev,
      { id: `s-${prev.length + 1}`, name: "", role: "", contact: "" },
    ]);
  };

  const removeStakeholderRow = (idToRemove: string) => {
    setRequirementsStakeholders(prev => prev.filter(item => item.id !== idToRemove));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-20 border-b border-[var(--border)]/70 bg-[var(--bg-surface)]/95 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            {isLoading || !project ? (
              <>
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Presales Project</p>
                <h1 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  Loading project…
                </h1>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Presales Project</p>
                <h1 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  {project.title}
                </h1>
                <p className="text-xs text-neutral-500">
                  {project.clientName} · #{project.id.slice(0, 6).toUpperCase()}
                </p>
              </>
            )}
          </div>
          {project && (
            <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
              <WinProbabilityGauge value={project.winProbability} />
              <div className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px]">
                <span className="mr-2 text-neutral-500">Stage</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {project.currentStage}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate("/presales/projects")}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px] text-neutral-600"
              >
                Back to list
              </button>
            </div>
          )}
        </div>
      </div>

      {project && (
        <div className="flex flex-1 gap-4 px-4 py-4">
          <div className="hidden w-48 flex-shrink-0 flex-col gap-1 border-r border-[var(--border)]/70 pr-3 text-[11px] text-neutral-500 md:flex">
            {[
              { id: "requirements", label: "Requirements" },
              { id: "solution-design", label: "Solution Design" },
              { id: "tech-stack", label: "Tech Stack" },
              { id: "boq", label: "BOQ" },
              { id: "poc", label: "PoC" },
              { id: "proposal", label: "Proposal" },
              { id: "competitors", label: "Competitors" },
              { id: "activities", label: "Activities" },
            ].map(link => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleJump(link.id)}
                className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left hover:bg-[var(--bg-elevated)]/70"
              >
                <span>{link.label}</span>
                <span className="text-[9px] text-neutral-400">⟶</span>
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-5">
            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-4 text-xs shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Pipeline
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex flex-1 items-center gap-3 overflow-x-auto pb-2">
                    {presalesStages.map(stage => {
                      const index = presalesStages.indexOf(stage);
                      const isCompleted = currentStageIndex !== -1 && index < currentStageIndex;
                      const isCurrent = currentStageIndex !== -1 && index === currentStageIndex;
                      const log =
                        project.stages.find(stageLog => stageLog.stage === stage) ?? null;
                      const timeLabel =
                        log && log.timeTakenMinutes != null && log.timeTakenMinutes > 0
                          ? `${Math.max(1, Math.round(log.timeTakenMinutes / 60 / 24))}d`
                          : "";
                      const tooltipParts: string[] = [];
                      if (log) {
                        tooltipParts.push(`Completed by ${log.completedBy}`);
                        tooltipParts.push(
                          new Date(log.completedAt).toLocaleString(),
                        );
                        if (log.timeTakenMinutes != null) {
                          tooltipParts.push(`${log.timeTakenMinutes} min`);
                        }
                      }
                      const tooltip = tooltipParts.join(" • ");
                      return (
                        <div
                          key={stage}
                          className="flex items-center gap-2"
                          title={tooltip || undefined}
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold ${
                              isCompleted
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : isCurrent
                                  ? "presales-stage-current border-[var(--accent-primary)] bg-[var(--bg-surface)] text-[var(--accent-primary)]"
                                  : "border-[var(--border)] bg-[var(--bg-elevated)] text-neutral-500"
                            }`}
                          >
                            {isCompleted ? "✓" : index + 1}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[11px] text-[var(--text-primary)]">{stage}</p>
                            {timeLabel && (
                              <p className="text-[10px] text-neutral-500">{timeLabel}</p>
                            )}
                          </div>
                          {index < presalesStages.length - 1 && (
                            <div className="h-px w-6 bg-gradient-to-r from-[var(--border)] to-transparent" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-neutral-500">
                    Stage log updates automatically as presales work moves forward.
                  </p>
                  {nextStage && (
                    <button
                      type="button"
                      disabled={advanceStageMutation.isLoading}
                      onClick={() => setStageModalOpen(true)}
                      className="inline-flex items-center rounded-full bg-[var(--accent-primary)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Advance to {nextStage} →
                    </button>
                  )}
                </div>
              </div>
            </div>

            <section id="requirements">
              <CollapsibleSection
                id="requirements-panel"
                title="Requirements"
                defaultOpen
                headerRight={
                  requirementsLastSavedAt && (
                    <span className="text-[10px] text-neutral-500">
                      Last saved{" "}
                      {formatDistanceToNow(requirementsLastSavedAt, { addSuffix: true })}
                    </span>
                  )
                }
              >
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-neutral-600">
                        Functional requirements
                      </p>
                      <div className="space-y-2">
                        {requirementsFunctional.map(item => (
                          <div
                            key={item.id}
                            className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.3fr)]"
                          >
                            <input
                              value={item.description}
                              onChange={event =>
                                setRequirementsFunctional(prev =>
                                  prev.map(row =>
                                    row.id === item.id
                                      ? { ...row, description: event.target.value }
                                      : row,
                                  ),
                                )
                              }
                              placeholder="Describe what the customer expects the system to do"
                              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            />
                            <select
                              value={item.priority}
                              onChange={event =>
                                setRequirementsFunctional(prev =>
                                  prev.map(row =>
                                    row.id === item.id
                                      ? { ...row, priority: event.target.value }
                                      : row,
                                  ),
                                )
                              }
                              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            >
                              <option>Low</option>
                              <option>Medium</option>
                              <option>High</option>
                            </select>
                            <select
                              value={item.status}
                              onChange={event =>
                                setRequirementsFunctional(prev =>
                                  prev.map(row =>
                                    row.id === item.id
                                      ? { ...row, status: event.target.value }
                                      : row,
                                  ),
                                )
                              }
                              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            >
                              <option>Open</option>
                              <option>In progress</option>
                              <option>Closed</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeRequirementRow("functional", item.id)}
                              className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px]"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addRequirementRow("functional")}
                          className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] text-neutral-600"
                        >
                          + Add row
                        </button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium text-neutral-600">
                          Technical requirements
                        </p>
                        <div className="space-y-2">
                          {requirementsTechnical.map(item => (
                            <div
                              key={item.id}
                              className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.3fr)]"
                            >
                              <input
                                value={item.description}
                                onChange={event =>
                                  setRequirementsTechnical(prev =>
                                    prev.map(row =>
                                      row.id === item.id
                                        ? { ...row, description: event.target.value }
                                        : row,
                                    ),
                                  )
                                }
                                placeholder="Protocols, integrations, performance and other technical asks"
                                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                              />
                              <select
                                value={item.priority}
                                onChange={event =>
                                  setRequirementsTechnical(prev =>
                                    prev.map(row =>
                                      row.id === item.id
                                        ? { ...row, priority: event.target.value }
                                        : row,
                                    ),
                                  )
                                }
                                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                              >
                                <option>Low</option>
                                <option>Medium</option>
                                <option>High</option>
                              </select>
                              <select
                                value={item.status}
                                onChange={event =>
                                  setRequirementsTechnical(prev =>
                                    prev.map(row =>
                                      row.id === item.id
                                        ? { ...row, status: event.target.value }
                                        : row,
                                    ),
                                  )
                                }
                                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                              >
                                <option>Open</option>
                                <option>In progress</option>
                                <option>Closed</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => removeRequirementRow("technical", item.id)}
                                className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px]"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addRequirementRow("technical")}
                            className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] text-neutral-600"
                          >
                            + Add row
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-neutral-600">Stakeholders</p>
                      <div className="space-y-2">
                        {requirementsStakeholders.map(item => (
                          <div
                            key={item.id}
                            className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.2fr)]"
                          >
                            <input
                              value={item.name}
                              onChange={event =>
                                setRequirementsStakeholders(prev =>
                                  prev.map(row =>
                                    row.id === item.id
                                      ? { ...row, name: event.target.value }
                                      : row,
                                  ),
                                )
                              }
                              placeholder="Name"
                              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            />
                            <input
                              value={item.role}
                              onChange={event =>
                                setRequirementsStakeholders(prev =>
                                  prev.map(row =>
                                    row.id === item.id
                                      ? { ...row, role: event.target.value }
                                      : row,
                                  ),
                                )
                              }
                              placeholder="Role"
                              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            />
                            <input
                              value={item.contact}
                              onChange={event =>
                                setRequirementsStakeholders(prev =>
                                  prev.map(row =>
                                    row.id === item.id
                                      ? { ...row, contact: event.target.value }
                                      : row,
                                  ),
                                )
                              }
                              placeholder="Contact"
                              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            />
                            <button
                              type="button"
                              onClick={() => removeStakeholderRow(item.id)}
                              className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px]"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addStakeholderRow}
                          className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] text-neutral-600"
                        >
                          + Add stakeholder
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-neutral-600">Constraints</p>
                      <textarea
                        value={requirementsConstraints}
                        onChange={event => setRequirementsConstraints(event.target.value)}
                        rows={5}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                        placeholder="List business, technical or commercial constraints for this pursuit."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-neutral-600">Raw notes</p>
                    <textarea
                      value={requirementsRawNotes}
                      onChange={event => setRequirementsRawNotes(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                      placeholder="Free-form notes from discovery calls and workshops."
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-neutral-500">
                      Saving requirements updates win probability and can auto-advance the pipeline.
                    </p>
                    <button
                      type="button"
                      disabled={requirementsMutation.isLoading}
                      onClick={() => requirementsMutation.mutate()}
                      className="inline-flex items-center rounded-full bg-[var(--accent-primary)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {requirementsMutation.isLoading ? "Saving…" : "Save requirements"}
                    </button>
                  </div>
                </div>
              </CollapsibleSection>
            </section>

            <section id="solution-design">
              <CollapsibleSection id="solution-design-panel" title="Solution Design">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-neutral-600">Architecture</p>
                      <input
                        value={architectureUrl}
                        onChange={event => setArchitectureUrl(event.target.value)}
                        placeholder="Link to architecture document or workspace"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-neutral-600">System diagram</p>
                      <input
                        value={diagramUrl}
                        onChange={event => setDiagramUrl(event.target.value)}
                        placeholder="Link to system diagram (Lucidchart, Miro, etc.)"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-neutral-600">Recommended option</p>
                      <input
                        value={recommendedOption}
                        onChange={event => setRecommendedOption(event.target.value)}
                        placeholder="Primary solution option being recommended"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-neutral-600">Justification</p>
                      <textarea
                        value={justification}
                        onChange={event => setJustification(event.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                        placeholder="Why this is the right fit for the customer."
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-neutral-500">
                    Solution design snapshots are stored on the project so anyone can pick up context.
                  </p>
                  <button
                    type="button"
                    disabled={solutionMutation.isLoading}
                    onClick={() => solutionMutation.mutate()}
                    className="inline-flex items-center rounded-full bg-[var(--accent-primary)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {solutionMutation.isLoading ? "Saving…" : "Save solution"}
                  </button>
                </div>
              </CollapsibleSection>
            </section>

            <section id="tech-stack">
              <CollapsibleSection id="tech-stack-panel" title="Tech Stack">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { key: "frontend", label: "Frontend" },
                    { key: "backend", label: "Backend" },
                    { key: "infrastructure", label: "Infrastructure" },
                    { key: "security", label: "Security" },
                  ].map(column => (
                    <div key={column.key} className="space-y-2">
                      <p className="text-[11px] font-medium text-neutral-600">{column.label}</p>
                      <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2">
                        {techStackTags[column.key as keyof typeof techStackTags].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setTechStackTags(prev => ({
                                ...prev,
                                [column.key]: prev[column.key as keyof typeof prev].filter(
                                  existing => existing !== tag,
                                ),
                              }))
                            }
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-neutral-700"
                          >
                            <span>{tag}</span>
                            <span className="text-[10px] text-neutral-400">✕</span>
                          </button>
                        ))}
                        <input
                          value={techStackInputs[column.key as keyof typeof techStackInputs]}
                          onChange={event =>
                            setTechStackInputs(prev => ({
                              ...prev,
                              [column.key]: event.target.value,
                            }))
                          }
                          onKeyDown={event => {
                            if (event.key === "Enter") {
                              const value = techStackInputs[column.key as keyof typeof techStackInputs]
                                .trim();
                              if (value.length > 0) {
                                event.preventDefault();
                                setTechStackTags(prev => ({
                                  ...prev,
                                  [column.key]: [
                                    ...prev[column.key as keyof typeof prev].filter(
                                      existing => existing.toLowerCase() !== value.toLowerCase(),
                                    ),
                                    value,
                                  ],
                                }));
                                setTechStackInputs(prev => ({ ...prev, [column.key]: "" }));
                              }
                            }
                          }}
                          placeholder="Type and press Enter…"
                          className="min-w-[120px] flex-1 border-none bg-transparent px-1 py-1 text-[11px] outline-none placeholder:text-neutral-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-neutral-500">
                    Tags help reporting on technology patterns across all presales pursuits.
                  </p>
                  <button
                    type="button"
                    disabled={solutionMutation.isLoading}
                    onClick={() => solutionMutation.mutate()}
                    className="inline-flex items-center rounded-full bg-[var(--accent-primary)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {solutionMutation.isLoading ? "Saving…" : "Save stack"}
                  </button>
                </div>
              </CollapsibleSection>
            </section>

            <section id="boq">
              <CollapsibleSection id="boq-panel" title="BOQ Builder">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
                  <div className="space-y-2">
                    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,0.5fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.9fr)] gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 px-2 py-1.5 text-[10px] font-medium text-neutral-500">
                      <span>Category</span>
                      <span>Item</span>
                      <span>Spec</span>
                      <span>Qty</span>
                      <span>Unit</span>
                      <span>List</span>
                      <span>Neg.</span>
                      <span>Margin / Total</span>
                    </div>
                    <div className="space-y-2">
                      {boqItems.map(row => {
                        const quantity = Number(row.quantity || 0);
                        const listPrice = Number(row.listPrice || 0);
                        const negotiatedPrice = Number(row.negotiatedPrice || 0);
                        const total = quantity * negotiatedPrice;
                        const marginPct =
                          listPrice > 0 ? ((negotiatedPrice - listPrice) / listPrice) * 100 : 0;
                        const marginClass =
                          marginPct < 10
                            ? "bg-red-500/10 text-red-400"
                            : marginPct < 20
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-emerald-500/10 text-emerald-400";
                        return (
                          <div
                            key={row.id}
                            className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,0.5fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.9fr)] gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 px-2 py-1.5 text-[11px]"
                          >
                            <select
                              value={row.category}
                              onChange={event =>
                                setBoqItems(prev =>
                                  prev.map(item =>
                                    item.id === row.id ? { ...item, category: event.target.value } : item,
                                  ),
                                )
                              }
                              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            >
                              <option value="">Type</option>
                              <option>Hardware</option>
                              <option>Software</option>
                              <option>Services</option>
                              <option>Licensing</option>
                            </select>
                            <input
                              value={row.item}
                              onChange={event =>
                                setBoqItems(prev =>
                                  prev.map(item =>
                                    item.id === row.id ? { ...item, item: event.target.value } : item,
                                  ),
                                )
                              }
                              placeholder="Line item"
                              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            />
                            <input
                              value={row.spec}
                              onChange={event =>
                                setBoqItems(prev =>
                                  prev.map(item =>
                                    item.id === row.id ? { ...item, spec: event.target.value } : item,
                                  ),
                                )
                              }
                              placeholder="Spec / description"
                              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            />
                            <input
                              value={row.quantity}
                              onChange={event =>
                                setBoqItems(prev =>
                                  prev.map(item =>
                                    item.id === row.id
                                      ? { ...item, quantity: event.target.value.replace(/[^0-9.]/g, "") }
                                      : item,
                                  ),
                                )
                              }
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-right outline-none focus:border-[var(--accent-primary)]"
                            />
                            <input
                              value={row.unit}
                              onChange={event =>
                                setBoqItems(prev =>
                                  prev.map(item =>
                                    item.id === row.id ? { ...item, unit: event.target.value } : item,
                                  ),
                                )
                              }
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            />
                            <input
                              value={row.listPrice}
                              onChange={event =>
                                setBoqItems(prev =>
                                  prev.map(item =>
                                    item.id === row.id
                                      ? { ...item, listPrice: event.target.value.replace(/[^0-9.]/g, "") }
                                      : item,
                                  ),
                                )
                              }
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-right outline-none focus:border-[var(--accent-primary)]"
                            />
                            <input
                              value={row.negotiatedPrice}
                              onChange={event =>
                                setBoqItems(prev =>
                                  prev.map(item =>
                                    item.id === row.id
                                      ? { ...item, negotiatedPrice: event.target.value.replace(/[^0-9.]/g, "") }
                                      : item,
                                  ),
                                )
                              }
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-right outline-none focus:border-[var(--accent-primary)]"
                            />
                            <div className="flex flex-col items-end gap-1 text-[10px]">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${marginClass}`}
                              >
                                {Number.isFinite(marginPct) ? `${marginPct.toFixed(1)}%` : "—"}
                              </span>
                              <span className="text-[11px] text-neutral-400">
                                {Number.isFinite(total) ? total.toLocaleString() : "—"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() =>
                          setBoqItems(prev => [
                            ...prev,
                            {
                              id: `b-${prev.length + 1}`,
                              category: "",
                              item: "",
                              spec: "",
                              quantity: "",
                              unit: "",
                              listPrice: "",
                              negotiatedPrice: "",
                            },
                          ])
                        }
                        className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] text-neutral-600"
                      >
                        + Add line
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
                      <span>Grand total</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {boqItems
                          .reduce(
                            (sum, row) =>
                              sum +
                              Number(row.quantity || 0) * Number(row.negotiatedPrice || 0),
                            0,
                          )
                          .toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-3">
                      <p className="text-[11px] font-medium text-neutral-600">Effort panel</p>
                      <div className="mt-3 grid gap-2 text-[11px]">
                        <label className="flex items-center justify-between gap-2">
                          <span>Engineering days</span>
                          <input
                            value={boqEffortDays}
                            onChange={event =>
                              setBoqEffortDays(event.target.value.replace(/[^0-9.]/g, ""))
                            }
                            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-right outline-none focus:border-[var(--accent-primary)]"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2">
                          <span>Implementation weeks</span>
                          <span className="w-24 text-right text-[11px] text-neutral-500">
                            {boqEffortDays
                              ? (Number(boqEffortDays) / 5).toFixed(1)
                              : "0.0"}
                          </span>
                        </label>
                        <label className="flex items-center justify-between gap-2">
                          <span>Resource count</span>
                          <input
                            value={boqResourceCount}
                            onChange={event =>
                              setBoqResourceCount(event.target.value.replace(/[^0-9]/g, ""))
                            }
                            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-right outline-none focus:border-[var(--accent-primary)]"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2">
                          <span>Daily rate</span>
                          <input
                            value={boqDailyRate}
                            onChange={event =>
                              setBoqDailyRate(event.target.value.replace(/[^0-9.]/g, ""))
                            }
                            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-right outline-none focus:border-[var(--accent-primary)]"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2">
                          <span>Effort cost</span>
                          <span className="w-24 text-right text-[11px] text-[var(--text-primary)]">
                            {(
                              Number(boqEffortDays || 0) * Number(boqDailyRate || 0)
                            ).toLocaleString()}
                          </span>
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          disabled={boqMutation.isLoading}
                          onClick={() => boqMutation.mutate()}
                          className="inline-flex flex-1 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {boqMutation.isLoading ? "Saving…" : "Save BOQ"}
                        </button>
                        <button
                          type="button"
                          disabled={boqSubmitMutation.isLoading}
                          onClick={() => boqSubmitMutation.mutate()}
                          className="inline-flex flex-1 items-center justify-center rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_10px_30px_rgba(16,185,129,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {boqSubmitMutation.isLoading
                            ? "Submitting…"
                            : "Submit BOQ to Sales"}
                        </button>
                      </div>
                      <p className="text-[10px] text-neutral-500">
                        Submitting the BOQ notifies sales and locks pricing for approval flows.
                      </p>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            </section>

            <section id="poc">
              <CollapsibleSection id="poc-panel" title="PoC">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    <span className="text-neutral-600">PoC required?</span>
                    <button
                      type="button"
                      onClick={() => setPocRequired(true)}
                      className={`rounded-full px-3 py-1.5 ${
                        pocRequired
                          ? "bg-[var(--accent-primary)] text-white"
                          : "border border-[var(--border)] bg-[var(--bg-surface)] text-neutral-600"
                      }`}
                    >
                      Required
                    </button>
                    <button
                      type="button"
                      onClick={() => setPocRequired(false)}
                      className={`rounded-full px-3 py-1.5 ${
                        !pocRequired
                          ? "bg-[var(--accent-primary)] text-white"
                          : "border border-[var(--border)] bg-[var(--bg-surface)] text-neutral-600"
                      }`}
                    >
                      Not required
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="space-y-1.5 text-[11px]">
                        <span className="font-medium text-neutral-600">Objective</span>
                        <textarea
                          value={pocObjective}
                          onChange={event => setPocObjective(event.target.value)}
                          rows={3}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                          disabled={!pocRequired}
                        />
                      </label>
                      <label className="space-y-1.5 text-[11px]">
                        <span className="font-medium text-neutral-600">Scope</span>
                        <textarea
                          value={pocScope}
                          onChange={event => setPocScope(event.target.value)}
                          rows={3}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                          disabled={!pocRequired}
                        />
                      </label>
                      <label className="space-y-1.5 text-[11px]">
                        <span className="font-medium text-neutral-600">Environment</span>
                        <textarea
                          value={pocEnvironment}
                          onChange={event => setPocEnvironment(event.target.value)}
                          rows={3}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                          disabled={!pocRequired}
                        />
                      </label>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <label className="space-y-1.5">
                          <span className="font-medium text-neutral-600">Start date</span>
                          <input
                            type="date"
                            value={pocStartDate || ""}
                            onChange={event => setPocStartDate(event.target.value)}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            disabled={!pocRequired}
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="font-medium text-neutral-600">End date</span>
                          <input
                            type="date"
                            value={pocEndDate || ""}
                            onChange={event => setPocEndDate(event.target.value)}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            disabled={!pocRequired}
                          />
                        </label>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium text-neutral-600">
                          Success criteria
                        </p>
                        <div className="space-y-2">
                          {pocSuccessCriteria.map(item => (
                            <label
                              key={item.id}
                              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 px-3 py-1.5 text-[11px]"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={item.completed}
                                  onChange={event =>
                                    setPocSuccessCriteria(prev =>
                                      prev.map(row =>
                                        row.id === item.id
                                          ? { ...row, completed: event.target.checked }
                                          : row,
                                      ),
                                    )
                                  }
                                  disabled={!pocRequired}
                                />
                                <input
                                  value={item.label}
                                  onChange={event =>
                                    setPocSuccessCriteria(prev =>
                                      prev.map(row =>
                                        row.id === item.id
                                          ? { ...row, label: event.target.value }
                                          : row,
                                      ),
                                    )
                                  }
                                  placeholder="Clear measurable outcome"
                                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                                  disabled={!pocRequired}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setPocSuccessCriteria(prev =>
                                    prev.filter(row => row.id !== item.id),
                                  )
                                }
                                className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px]"
                                disabled={!pocRequired}
                              >
                                ✕
                              </button>
                            </label>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setPocSuccessCriteria(prev => [
                                ...prev,
                                { id: `sc-${prev.length + 1}`, label: "", completed: false },
                              ])
                            }
                            className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] text-neutral-600"
                            disabled={!pocRequired}
                          >
                            + Add success criteria
                          </button>
                        </div>
                      </div>
                      <label className="space-y-1.5 text-[11px]">
                        <span className="font-medium text-neutral-600">
                          Evidence links (comma separated)
                        </span>
                        <textarea
                          value={pocEvidence}
                          onChange={event => setPocEvidence(event.target.value)}
                          rows={3}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                          disabled={!pocRequired}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-neutral-600">Outcome</p>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        {[
                          { key: "success", label: "Success", color: "bg-emerald-500/10 text-emerald-400" },
                          { key: "partial", label: "Partial", color: "bg-amber-500/10 text-amber-400" },
                          { key: "fail", label: "Failed", color: "bg-red-500/10 text-red-400" },
                          { key: "not_required", label: "Not required", color: "bg-neutral-700 text-neutral-200" },
                        ].map(option => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => {
                              setPocOutcome(option.key);
                              if (option.key === "not_required") {
                                setPocRequired(false);
                              }
                              pocOutcomeMutation.mutate(option.key);
                            }}
                            className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left text-[11px] ${
                              pocOutcome === option.key
                                ? `${option.color} border-transparent`
                                : "border-[var(--border)] bg-[var(--bg-surface)] text-neutral-500"
                            }`}
                          >
                            <span className="text-[11px] font-semibold">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="space-y-1.5 text-[11px]">
                      <span className="font-medium text-neutral-600">Findings</span>
                      <textarea
                        value={pocFindings}
                        onChange={event => setPocFindings(event.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-neutral-500">
                      Outcome drives win probability and is visible to sales on the pursuit.
                    </p>
                    <button
                      type="button"
                      disabled={pocMutation.isLoading}
                      onClick={() => pocMutation.mutate()}
                      className="inline-flex items-center rounded-full bg-[var(--accent-primary)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {pocMutation.isLoading ? "Saving…" : "Save PoC"}
                    </button>
                  </div>
                </div>
              </CollapsibleSection>
            </section>

            <section id="proposal">
              <CollapsibleSection id="proposal-panel" title="Proposal">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)]/80 pb-2 text-[11px]">
                  <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5">
                    {[
                      { key: "editor", label: "Editor" },
                      { key: "preview", label: "Preview" },
                      { key: "versions", label: "Versions" },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setProposalTab(tab.key as typeof proposalTab)}
                        className={`rounded-full px-3 py-1 ${
                          proposalTab === tab.key
                            ? "bg-[var(--accent-primary)] text-white"
                            : "text-neutral-600"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {project.proposal && (
                    <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                      <span>
                        v{project.proposal.version} · {project.proposal.status}
                      </span>
                      {project.proposal.sentAt && (
                        <span>
                          Sent{" "}
                          {formatDistanceToNow(new Date(project.proposal.sentAt), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {proposalTab === "editor" && (
                  <div className="mt-3 space-y-3 text-[11px]">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className="font-medium text-neutral-600">Executive summary</span>
                        <textarea
                          value={proposalExecutiveSummary}
                          onChange={event => setProposalExecutiveSummary(event.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="font-medium text-neutral-600">Scope of work</span>
                        <textarea
                          value={proposalScopeOfWork}
                          onChange={event => setProposalScopeOfWork(event.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                        />
                      </label>
                    </div>
                    <label className="space-y-1.5">
                      <span className="font-medium text-neutral-600">Technical approach</span>
                      <textarea
                        value={proposalTechnicalApproach}
                        onChange={event => setProposalTechnicalApproach(event.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                      />
                    </label>
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-neutral-600">Commercials</p>
                      <div className="space-y-2">
                        {proposalCommercials.map(row => (
                          <div
                            key={row.id}
                            className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,0.6fr)]"
                          >
                            <input
                              value={row.item}
                              onChange={event =>
                                setProposalCommercials(prev =>
                                  prev.map(item =>
                                    item.id === row.id ? { ...item, item: event.target.value } : item,
                                  ),
                                )
                              }
                              placeholder="Line item"
                              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            />
                            <input
                              value={row.description}
                              onChange={event =>
                                setProposalCommercials(prev =>
                                  prev.map(item =>
                                    item.id === row.id
                                      ? { ...item, description: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="Description"
                              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                            />
                            <div className="flex items-center gap-2">
                              <input
                                value={row.price}
                                onChange={event =>
                                  setProposalCommercials(prev =>
                                    prev.map(item =>
                                      item.id === row.id
                                        ? {
                                            ...item,
                                            price: event.target.value.replace(/[^0-9.]/g, ""),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-right text-[11px] outline-none focus:border-[var(--accent-primary)]"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setProposalCommercials(prev =>
                                    prev.filter(item => item.id !== row.id),
                                  )
                                }
                                className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px]"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setProposalCommercials(prev => [
                              ...prev,
                              { id: `pc-${prev.length + 1}`, item: "", description: "", price: "" },
                            ])
                          }
                          className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] text-neutral-600"
                        >
                          + Add commercial line
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium text-neutral-600">
                          Timeline milestones
                        </p>
                        <div className="space-y-2">
                          {proposalTimeline.map(row => (
                            <div
                              key={row.id}
                              className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.3fr)] gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-2 text-[11px]"
                            >
                              <input
                                value={row.name}
                                onChange={event =>
                                  setProposalTimeline(prev =>
                                    prev.map(item =>
                                      item.id === row.id
                                        ? { ...item, name: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="Milestone name"
                                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                              />
                              <input
                                value={row.weeks}
                                onChange={event =>
                                  setProposalTimeline(prev =>
                                    prev.map(item =>
                                      item.id === row.id
                                        ? {
                                            ...item,
                                            weeks: event.target.value.replace(/[^0-9.]/g, ""),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="Weeks"
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-right text-[11px] outline-none focus:border-[var(--accent-primary)]"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setProposalTimeline(prev =>
                                    prev.filter(item => item.id !== row.id),
                                  )
                                }
                                className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px]"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setProposalTimeline(prev => [
                                ...prev,
                                { id: `pt-${prev.length + 1}`, name: "", weeks: "" },
                              ])
                            }
                            className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] text-neutral-600"
                          >
                            + Add milestone
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium text-neutral-600">Team structure</p>
                        <div className="space-y-2">
                          {proposalTeam.map(row => (
                            <div
                              key={row.id}
                              className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.3fr)] gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-2 text-[11px]"
                            >
                              <input
                                value={row.role}
                                onChange={event =>
                                  setProposalTeam(prev =>
                                    prev.map(item =>
                                      item.id === row.id
                                        ? { ...item, role: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="Role"
                                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                              />
                              <input
                                value={row.count}
                                onChange={event =>
                                  setProposalTeam(prev =>
                                    prev.map(item =>
                                      item.id === row.id
                                        ? {
                                            ...item,
                                            count: event.target.value.replace(/[^0-9]/g, ""),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="Count"
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-right text-[11px] outline-none focus:border-[var(--accent-primary)]"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setProposalTeam(prev =>
                                    prev.filter(item => item.id !== row.id),
                                  )
                                }
                                className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px]"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setProposalTeam(prev => [
                                ...prev,
                                { id: `tm-${prev.length + 1}`, role: "", count: "" },
                              ])
                            }
                            className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] text-neutral-600"
                          >
                            + Add role
                          </button>
                        </div>
                      </div>
                    </div>
                    <label className="space-y-1.5">
                      <span className="text-[11px] font-medium text-neutral-600">
                        Terms and conditions
                      </span>
                      <textarea
                        value={proposalTerms}
                        onChange={event => setProposalTerms(event.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                      />
                    </label>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-neutral-500">
                        Proposal content feeds into PDF generation and can be reused for clones.
                      </p>
                      <button
                        type="button"
                        disabled={proposalMutation.isLoading}
                        onClick={() => proposalMutation.mutate()}
                        className="inline-flex items-center rounded-full bg-[var(--accent-primary)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {proposalMutation.isLoading ? "Saving…" : "Save proposal"}
                      </button>
                    </div>
                  </div>
                )}
                {proposalTab === "preview" && (
                  <div className="mt-3 space-y-3 text-[11px]">
                    <p className="text-[11px] text-neutral-500">
                      This is a lightweight preview of how the proposal will read to the customer.
                    </p>
                    <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {project.title} – Proposal
                      </h3>
                      <p className="text-[11px] text-neutral-500">
                        {project.clientName} · {project.priority} priority
                      </p>
                      {proposalExecutiveSummary && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-[11px] font-semibold text-neutral-600">
                            Executive summary
                          </p>
                          <p className="whitespace-pre-line text-[11px] text-neutral-500">
                            {proposalExecutiveSummary}
                          </p>
                        </div>
                      )}
                      {proposalScopeOfWork && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-[11px] font-semibold text-neutral-600">
                            Scope of work
                          </p>
                          <p className="whitespace-pre-line text-[11px] text-neutral-500">
                            {proposalScopeOfWork}
                          </p>
                        </div>
                      )}
                      {proposalTechnicalApproach && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-[11px] font-semibold text-neutral-600">
                            Technical approach
                          </p>
                          <p className="whitespace-pre-line text-[11px] text-neutral-500">
                            {proposalTechnicalApproach}
                          </p>
                        </div>
                      )}
                      {proposalCommercials.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-[11px] font-semibold text-neutral-600">Commercials</p>
                          <div className="space-y-1.5 text-[11px]">
                            {proposalCommercials.map(row => (
                              <div
                                key={row.id}
                                className="flex items-center justify-between gap-3 border-b border-dashed border-[var(--border)]/70 pb-1.5"
                              >
                                <div>
                                  <p className="font-medium text-[var(--text-primary)]">
                                    {row.item}
                                  </p>
                                  {row.description && (
                                    <p className="text-[11px] text-neutral-500">
                                      {row.description}
                                    </p>
                                  )}
                                </div>
                                <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                                  {Number(row.price || 0).toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {proposalTab === "versions" && (
                  <div className="mt-3 space-y-2 text-[11px]">
                    {project.proposal ? (
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-3">
                        <p className="text-[11px] font-medium text-neutral-600">
                          Current version
                        </p>
                        <p className="mt-1 text-[11px] text-neutral-500">
                          Version {project.proposal.version} · Status {project.proposal.status}
                        </p>
                        {project.proposal.clientFeedback && (
                          <p className="mt-2 text-[11px] text-neutral-500">
                            Client feedback: {project.proposal.clientFeedback}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-neutral-500">
                        No proposal has been drafted for this project yet.
                      </p>
                    )}
                  </div>
                )}
              </CollapsibleSection>
            </section>

            <section id="competitors">
              <CollapsibleSection id="competitors-panel" title="Competitor Tracking">
                <div className="space-y-2">
                  <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.3fr)] gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 px-2 py-1.5 text-[10px] font-medium text-neutral-500">
                    <span>Competitor</span>
                    <span>Their offering</span>
                    <span>Our advantage</span>
                    <span>Risk</span>
                    <span />
                  </div>
                  <div className="space-y-2">
                    {competitors.map(row => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.3fr)] gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 px-2 py-1.5 text-[11px]"
                      >
                        <input
                          value={row.name}
                          onChange={event =>
                            setCompetitors(prev =>
                              prev.map(item =>
                                item.id === row.id
                                  ? { ...item, name: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Name"
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                        />
                        <input
                          value={row.offering}
                          onChange={event =>
                            setCompetitors(prev =>
                              prev.map(item =>
                                item.id === row.id
                                  ? { ...item, offering: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Their product, services, bundles"
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                        />
                        <input
                          value={row.advantage}
                          onChange={event =>
                            setCompetitors(prev =>
                              prev.map(item =>
                                item.id === row.id
                                  ? { ...item, advantage: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="How we differentiate"
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                        />
                        <select
                          value={row.riskLevel}
                          onChange={event =>
                            setCompetitors(prev =>
                              prev.map(item =>
                                item.id === row.id
                                  ? { ...item, riskLevel: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent-primary)]"
                        >
                          <option value="">Risk</option>
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setCompetitors(prev => prev.filter(item => item.id !== row.id))
                          }
                          className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px]"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setCompetitors(prev => [
                          ...prev,
                          {
                            id: `c-${prev.length + 1}`,
                            name: "",
                            offering: "",
                            advantage: "",
                            riskLevel: "",
                          },
                        ])
                      }
                      className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] text-neutral-600"
                    >
                      + Add competitor
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-neutral-500">
                      Competitor insights are saved alongside solution design for this pursuit.
                    </p>
                    <button
                      type="button"
                      disabled={solutionMutation.isLoading}
                      onClick={() => solutionMutation.mutate()}
                      className="inline-flex items-center rounded-full bg-[var(--accent-primary)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {solutionMutation.isLoading ? "Saving…" : "Save competitors"}
                    </button>
                  </div>
                </div>
              </CollapsibleSection>
            </section>

            <section id="activities">
              <CollapsibleSection id="activities-panel" title="Activities Timeline">
                <div className="space-y-3">
                  <p className="text-[11px] text-neutral-500">
                    Activity feed shows key presales actions across the lifecycle of this pursuit.
                  </p>
                  <div className="space-y-2">
                    {project.activities.length === 0 && (
                      <p className="text-[11px] text-neutral-500">
                        No activities have been logged against this presales project yet.
                      </p>
                    )}
                    {project.activities
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                      )
                      .map(activity => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 px-3 py-2 text-[11px]"
                        >
                          <div className="mt-1 h-7 w-7 flex-shrink-0 rounded-full bg-[var(--accent-primary)]/10 text-center text-[11px] font-semibold text-[var(--accent-primary)]">
                            <span className="leading-[28px]">
                              {activity.type.slice(0, 1).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-[var(--text-primary)]">
                                {activity.type}
                              </span>
                              <span className="text-[10px] text-neutral-500">
                                {activity.createdBy}
                              </span>
                              <span className="text-[10px] text-neutral-500">
                                ·{" "}
                                {formatDistanceToNow(new Date(activity.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            <p className="whitespace-pre-line text-[11px] text-neutral-500">
                              {activity.description}
                            </p>
                            {activity.fileUrl && (
                              <a
                                href={activity.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex text-[10px] text-[var(--accent-primary)]"
                              >
                                View attachment
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </CollapsibleSection>
            </section>
          </div>
        </div>
      )}

      {nextStage && stageModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-xs shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Advance pipeline
                </p>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Confirm moving this pursuit to the next stage in the journey.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStageModalOpen(false)}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] text-neutral-600"
                disabled={advanceStageMutation.isLoading}
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-[11px] text-neutral-500">
                Notes (optional)
              </p>
              <textarea
                value={stageNotes}
                onChange={event => setStageNotes(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                placeholder={`What was completed to move into ${nextStage}?`}
              />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setStageModalOpen(false)}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-1.5 text-neutral-600"
                disabled={advanceStageMutation.isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={advanceStageMutation.isLoading}
                onClick={() => advanceStageMutation.mutate()}
                className="rounded-full bg-[var(--accent-primary)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {advanceStageMutation.isLoading ? "Advancing…" : `Advance to ${nextStage}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardPage() {
  const [mode, setMode] = useState<"system" | "custom">("system");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const response = await api.get("/api/dashboard/admin");
      return response.data?.data as AdminDashboardSummary;
    },
  });

  const {
    data: preferenceData,
    isLoading: preferencesLoading,
    refetch: refetchPreferences,
  } = useQuery({
    queryKey: ["dashboard-preferences"],
    queryFn: async () => {
      const response = await api.get("/api/dashboard/preferences");
      return response.data?.data?.config as DashboardPreferenceConfig;
    },
  });

  const [localPreferences, setLocalPreferences] = useState<DashboardPreferenceConfig>({
    showLeadOwner: true,
    showOpportunityStage: true,
    showLeadSource: true,
    showOpportunityOwner: true,
  });

  const [savingPreferences, setSavingPreferences] = useState(false);

  useEffect(() => {
    if (preferenceData) {
      setLocalPreferences(preferenceData);
    }
  }, [preferenceData]);

  const handleTogglePreference = (key: keyof DashboardPreferenceConfig) => {
    setLocalPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSavePreferences = async () => {
    setSavingPreferences(true);
    try {
      await api.post("/api/dashboard/preferences", { config: localPreferences });
      await refetchPreferences();
    } finally {
      setSavingPreferences(false);
    }
  };

  const summary = data?.summaryCards;
  const segments = data?.segments;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Admin dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Command center for sales and presales</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Live view of leads, opportunities and quotations flowing through your Cachedigitech CRM.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-1 py-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("system")}
            className={`rounded-full px-3 py-1.5 ${
              mode === "system"
                ? "bg-[var(--accent-primary)] text-white shadow-[0_0_0_1px_rgba(15,23,42,0.7)]"
                : "text-neutral-500"
            }`}
          >
            System analytics
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`rounded-full px-3 py-1.5 ${
              mode === "custom"
                ? "bg-[var(--accent-primary)] text-white shadow-[0_0_0_1px_rgba(15,23,42,0.7)]"
                : "text-neutral-500"
            }`}
          >
            My analytics
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/40 bg-gradient-to-br from-[var(--bg-surface)]/90 via-[var(--bg-elevated)]/80 to-[var(--bg-surface)]/90 p-[1px] shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
          <div className="h-full rounded-2xl bg-[var(--bg-surface)]/95 px-4 py-4">
            <p className="text-xs font-medium text-neutral-500">Leads this month</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {isLoading || !summary ? "—" : summary.leadCount.current}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Prev. month: {isLoading || !summary ? "—" : summary.leadCount.previous}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/40 bg-gradient-to-br from-[#f5f0ff] via-[#fdfcf7] to-[#fdf8ff] p-[1px] shadow-[0_18px_40px_rgba(190,148,255,0.25)] dark:from-[#111827] dark:via-[#020617] dark:to-[#020617]">
          <div className="h-full rounded-2xl bg-[var(--bg-surface)]/95 px-4 py-4">
            <p className="text-xs font-medium text-neutral-500">Opportunities this month</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {isLoading || !summary ? "—" : summary.opportunityCount.current}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Prev. month: {isLoading || !summary ? "—" : summary.opportunityCount.previous}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/40 bg-gradient-to-br from-[#0f172a] via-[#020617] to-[#020617] p-[1px] shadow-[0_18px_40px_rgba(15,23,42,0.45)] dark:from-[#020617] dark:via-[#020617] dark:to-[#020617]">
          <div className="flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-[#020617] via-[#020617] to-[#111827] px-4 py-4">
            <div>
              <p className="text-xs font-medium text-slate-300">Quotations this month</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-50">
                {isLoading || !summary ? "—" : summary.quotationCount.current}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Prev. month: {isLoading || !summary ? "—" : summary.quotationCount.previous}
              </p>
            </div>
          </div>
        </div>
      </div>

      {mode === "system" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                    Lead owner wise
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">How leads are distributed across your team.</p>
                </div>
              </div>
              <div className="mt-4 h-64">
                {isLoading || !segments ? (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                    Loading pipeline…
                  </div>
                ) : segments.leadOwner.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                    No leads captured yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={segments.leadOwner}>
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                    Opportunity stage funnel
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">See where opportunities are concentrating.</p>
                </div>
              </div>
              <div className="mt-4 h-64">
                {isLoading || !segments ? (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                    Loading funnel…
                  </div>
                ) : segments.opportunityStage.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                    No opportunities captured yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={segments.opportunityStage}>
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#38bdf8" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Lead source mix</p>
              <p className="mt-1 text-xs text-neutral-500">Which channels are bringing you demand.</p>
              <div className="mt-4 h-56">
                {isLoading || !segments ? (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                    Loading sources…
                  </div>
                ) : segments.leadSource.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                    No sources configured yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={segments.leadSource} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80}>
                        {segments.leadSource.map((entry, index) => (
                          <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Opportunity owner wise
              </p>
              <p className="mt-1 text-xs text-neutral-500">How live opportunities are spread across owners.</p>
              <div className="mt-4 h-56">
                {isLoading || !segments ? (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                    Loading owners…
                  </div>
                ) : segments.opportunityOwner.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                    No opportunities assigned yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={segments.opportunityOwner} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80}>
                        {segments.opportunityOwner.map((entry, index) => (
                          <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === "custom" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Personalised analytics canvas
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Toggle the building blocks you care about. Cachedigitech will remember this view for your user.
              </p>
              <div className="mt-4 grid gap-3 text-xs md:grid-cols-2">
                {localPreferences.showLeadOwner && segments && (
                  <div className="rounded-xl border border-[var(--border)]/70 bg-[var(--bg-elevated)]/90 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                      Lead owner wise
                    </p>
                    <div className="mt-2 h-32">
                      {isLoading || !segments ? (
                        <div className="flex h-full items-center justify-center text-[11px] text-neutral-500">
                          Loading…
                        </div>
                      ) : segments.leadOwner.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-[11px] text-neutral-500">
                          No data yet.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={segments.leadOwner}>
                            <XAxis dataKey="name" hide />
                            <YAxis hide />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#22c55e" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                )}
                {localPreferences.showOpportunityStage && segments && (
                  <div className="rounded-xl border border-[var(--border)]/70 bg-[var(--bg-elevated)]/90 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                      Opportunity stage
                    </p>
                    <div className="mt-2 h-32">
                      {isLoading || !segments ? (
                        <div className="flex h-full items-center justify-center text-[11px] text-neutral-500">
                          Loading…
                        </div>
                      ) : segments.opportunityStage.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-[11px] text-neutral-500">
                          No data yet.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={segments.opportunityStage}>
                            <XAxis dataKey="name" hide />
                            <YAxis hide />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#38bdf8" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                )}
                {localPreferences.showLeadSource && segments && (
                  <div className="rounded-xl border border-[var(--border)]/70 bg-[var(--bg-elevated)]/90 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                      Lead source mix
                    </p>
                    <div className="mt-2 h-32">
                      {isLoading || !segments ? (
                        <div className="flex h-full items-center justify-center text-[11px] text-neutral-500">
                          Loading…
                        </div>
                      ) : segments.leadSource.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-[11px] text-neutral-500">
                          No data yet.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={segments.leadSource}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={24}
                              outerRadius={40}
                            >
                              {segments.leadSource.map((entry, index) => (
                                <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                )}
                {localPreferences.showOpportunityOwner && segments && (
                  <div className="rounded-xl border border-[var(--border)]/70 bg-[var(--bg-elevated)]/90 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                      Opportunity owner wise
                    </p>
                    <div className="mt-2 h-32">
                      {isLoading || !segments ? (
                        <div className="flex h-full items-center justify-center text-[11px] text-neutral-500">
                          Loading…
                        </div>
                      ) : segments.opportunityOwner.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-[11px] text-neutral-500">
                          No data yet.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={segments.opportunityOwner}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={24}
                              outerRadius={40}
                            >
                              {segments.opportunityOwner.map((entry, index) => (
                                <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Layout controls</p>
              <p className="mt-1 text-xs text-neutral-500">
                Choose which tiles appear in your personalised view. This configuration is stored against your user.
              </p>
              <div className="mt-4 space-y-3 text-xs">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-neutral-500">Show lead owner wise</span>
                  <button
                    type="button"
                    onClick={() => handleTogglePreference("showLeadOwner")}
                    className={`inline-flex h-5 w-9 items-center rounded-full ${
                      localPreferences.showLeadOwner ? "bg-emerald-400/90" : "bg-neutral-700"
                    }`}
                  >
                    <span
                      className={`ml-[2px] h-4 w-4 rounded-full bg-[var(--bg-surface)] transition ${
                        localPreferences.showLeadOwner ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-neutral-500">Show opportunity stage</span>
                  <button
                    type="button"
                    onClick={() => handleTogglePreference("showOpportunityStage")}
                    className={`inline-flex h-5 w-9 items-center rounded-full ${
                      localPreferences.showOpportunityStage ? "bg-emerald-400/90" : "bg-neutral-700"
                    }`}
                  >
                    <span
                      className={`ml-[2px] h-4 w-4 rounded-full bg-[var(--bg-surface)] transition ${
                        localPreferences.showOpportunityStage ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-neutral-500">Show lead source mix</span>
                  <button
                    type="button"
                    onClick={() => handleTogglePreference("showLeadSource")}
                    className={`inline-flex h-5 w-9 items-center rounded-full ${
                      localPreferences.showLeadSource ? "bg-emerald-400/90" : "bg-neutral-700"
                    }`}
                  >
                    <span
                      className={`ml-[2px] h-4 w-4 rounded-full bg-[var(--bg-surface)] transition ${
                        localPreferences.showLeadSource ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-neutral-500">Show opportunity owner wise</span>
                  <button
                    type="button"
                    onClick={() => handleTogglePreference("showOpportunityOwner")}
                    className={`inline-flex h-5 w-9 items-center rounded-full ${
                      localPreferences.showOpportunityOwner ? "bg-emerald-400/90" : "bg-neutral-700"
                    }`}
                  >
                    <span
                      className={`ml-[2px] h-4 w-4 rounded-full bg-[var(--bg-surface)] transition ${
                        localPreferences.showOpportunityOwner ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                </label>
              </div>
              <button
                type="button"
                disabled={savingPreferences || preferencesLoading}
                onClick={handleSavePreferences}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-xs font-medium text-white shadow-[0_16px_40px_rgba(15,23,42,0.7)] transition hover:bg-[var(--accent-primary)]/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingPreferences ? "Saving layout…" : "Save my layout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SuperAdminPage() {
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [createName, setCreateName] = useState("");
  const [createAdminName, setCreateAdminName] = useState("");
  const [createAdminEmail, setCreateAdminEmail] = useState("");
  const [modulesState, setModulesState] = useState<{ crm: boolean; hrms: boolean }>({ crm: true, hrms: false });
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdAdminEmail, setCreatedAdminEmail] = useState<string | null>(null);

  const modulesSelected = [modulesState.crm && "CRM", modulesState.hrms && "HRMS"].filter(Boolean) as string[];

  const { data: overviewData } = useQuery({
    queryKey: ["super-admin-overview"],
    queryFn: async () => {
      const response = await api.get("/api/super-admin/overview");
      return response.data?.data?.organizations as SuperAdminOrganizationOverview[] | undefined;
    },
  });

  const organizations = overviewData ?? [];

  const activeOrgId = selectedOrgId ?? organizations[0]?.id ?? null;

  const { data: activeOrgDetail } = useQuery({
    queryKey: ["super-admin-organization", activeOrgId],
    enabled: activeOrgId != null,
    queryFn: async () => {
      const response = await api.get(`/api/super-admin/organizations/${activeOrgId}`);
      return response.data?.data?.organization as SuperAdminOrganizationDetail | undefined;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: createName,
        modules: modulesSelected,
        adminName: createAdminName,
        adminEmail: createAdminEmail,
      };
      const response = await api.post("/api/super-admin/organizations", payload);
      return response.data?.data as {
        organization: SuperAdminOrganizationOverview;
        admin: { id: number; name: string; email: string };
        temporaryPassword: string;
        emailSent: boolean;
      };
    },
    onSuccess: async data => {
      setCreatedPassword(data?.temporaryPassword ?? null);
      setCreatedAdminEmail(data?.admin.email ?? null);
      setCreateName("");
      setCreateAdminName("");
      setCreateAdminEmail("");
      await queryClient.invalidateQueries({ queryKey: ["super-admin-overview"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Super admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Global control studio</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Configure tenants, subscription models and high-trust roles for your customers.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Invite admin · create organisation
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Super admin spins up a new tenant, modules and first admin in one step.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-neutral-600">Organisation name</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={event => setCreateName(event.target.value)}
                    placeholder="Acme Infra Pvt Ltd"
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-neutral-600">Modules</p>
                  <div className="mt-1 inline-flex gap-2 rounded-full bg-[var(--bg-elevated)] px-1 py-1">
                    <button
                      type="button"
                      onClick={() => setModulesState(prev => ({ ...prev, crm: !prev.crm }))}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] ${
                        modulesState.crm
                          ? "bg-[var(--accent-primary)] text-white"
                          : "text-neutral-600 hover:bg-[var(--bg-surface)]"
                      }`}
                    >
                      CRM
                    </button>
                    <button
                      type="button"
                      onClick={() => setModulesState(prev => ({ ...prev, hrms: !prev.hrms }))}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] ${
                        modulesState.hrms
                          ? "bg-[var(--accent-primary)] text-white"
                          : "text-neutral-600 hover:bg-[var(--bg-surface)]"
                      }`}
                    >
                      HRMS
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-neutral-600">Admin name</label>
                  <input
                    type="text"
                    value={createAdminName}
                    onChange={event => setCreateAdminName(event.target.value)}
                    placeholder="Primary workspace admin"
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-600">Admin email</label>
                  <input
                    type="email"
                    value={createAdminEmail}
                    onChange={event => setCreateAdminEmail(event.target.value)}
                    placeholder="admin@customer.com"
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <button
                  type="button"
                  disabled={
                    createMutation.isLoading ||
                    !createName.trim() ||
                    !createAdminName.trim() ||
                    !createAdminEmail.trim() ||
                    modulesSelected.length === 0
                  }
                  onClick={() => createMutation.mutate()}
                  className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {createMutation.isLoading ? "Creating…" : "Create organisation"}
                </button>
              </div>
            </div>
            {createdPassword && createdAdminEmail && (
              <div className="mt-4 rounded-xl border border-emerald-400/50 bg-emerald-50 px-3 py-3 text-[11px] text-emerald-900">
                <p className="font-semibold tracking-[0.18em]">INVITE READY</p>
                <p className="mt-1">
                  Admin credentials for <span className="font-medium">{createdAdminEmail}</span>:
                </p>
                <p className="mt-1">
                  <span className="font-medium">Temporary password:</span> {createdPassword}
                </p>
                <p className="mt-1 text-emerald-800">
                  These details are shown only once here and sent over email if SMTP is configured.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-5 text-xs shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">At a glance</p>
            {organizations.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-600">
                No organisations created yet. Use the card on the left to spin up your first tenant.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {organizations.map(org => {
                  const isActive = org.id === activeOrgId;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => setSelectedOrgId(org.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${
                        isActive
                          ? "border-[var(--accent-primary)] bg-[var(--bg-elevated)]"
                          : "border-[var(--border)] bg-[var(--bg-surface)]/90 hover:border-[var(--accent-primary)]/60"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{org.name}</p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          {org.modules.join(" · ")} · {org.totalSeats} seats
                        </p>
                      </div>
                      <div className="text-right text-[10px] text-neutral-500">
                        <p>
                          Admins <span className="font-semibold text-[var(--text-primary)]">{org.adminCount}</span>
                        </p>
                        <p>
                          Users <span className="font-semibold text-[var(--text-primary)]">{org.userCount}</span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-5 text-xs shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Tenant graph</p>
          {!activeOrgDetail ? (
            <p className="mt-2 text-[11px] text-neutral-500">Select a tenant on the left to view details.</p>
          ) : (
            <div className="mt-3 space-y-4">
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">{activeOrgDetail.name}</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Code {activeOrgDetail.code} · Modules {activeOrgDetail.modules.join(" · ")}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Admin and user roster
                </p>
                {activeOrgDetail.users.length === 0 ? (
                  <p className="mt-2 text-[11px] text-neutral-500">
                    No workspace users yet. Once the admin provisions users, they will appear here instantly.
                  </p>
                ) : (
                  <div className="mt-2 divide-y divide-[var(--border)]/70 rounded-xl border border-[var(--border)]/80">
                    {activeOrgDetail.users.map(user => (
                      <div key={user.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div>
                          <p className="text-xs font-medium text-[var(--text-primary)]">{user.name}</p>
                          <p className="mt-0.5 text-[11px] text-neutral-500">{user.email}</p>
                        </div>
                        <div className="text-right text-[11px]">
                          <p className="font-semibold text-neutral-700">{user.role}</p>
                          <p className="mt-0.5 text-[10px] text-neutral-500">
                            {user.isActive ? "Active" : "Inactive"}
                            {user.department ? ` · ${user.department}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-neutral-500">
                Super admin only sees hashed passwords in the backend. Plain credentials are shared once via invite
                email and the banner above when created.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Workspace administration lane</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage users, approvals and day-to-day configuration for your organisation.
        </p>
      </div>
    </div>
  );
}

function SettingsUsersPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Administration</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Users & Roles</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Curate who gets super admin, admin or workspace access in your organisation.
        </p>
      </div>
      <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 px-4 py-6 shadow-sm">
        <p className="text-sm text-neutral-500">User table and role editor coming in the next phase.</p>
      </div>
    </div>
  );
}

function WorkspacePage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">My operating lane</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Daily tasks, opportunities and approvals tailored to this user will appear here.
        </p>
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore(s => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await api.post("/api/auth/login", { email, password });
      const user = response.data?.data?.user as { id: number; role: string } | undefined;
      if (!user) {
        setError("Unexpected response from server.");
        setLoading(false);
        return;
      }
      setUser(user);
      const role = user.role;
      if (role === "SUPER_ADMIN") {
        navigate("/super-admin");
      } else if (role === "ADMIN") {
        navigate("/dashboard");
      } else {
        navigate("/workspace");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          setError("Invalid email or password.");
        } else if (status && status >= 500) {
          setError("Server error while signing in. Please try again.");
        } else {
          setError("Unable to sign in. Please check your connection.");
        }
      } else {
        setError("Unexpected error while signing in.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-[-8rem] h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,_rgba(45,212,191,0.26),_transparent)] blur-3xl" />
        <div className="absolute -right-20 top-40 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.32),_transparent)] blur-3xl" />
        <div className="absolute inset-x-0 bottom-[-16rem] h-[26rem] bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.26),_transparent)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col px-5 pb-20 pt-6">
        <header className="flex items-center justify-between pb-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-sky-400 to-violet-500 text-[11px] font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(15,23,42,0.5)]">
              C+
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">
                Cachedigitech
              </p>
              <p className="text-xs text-slate-400">Enterprise Operations Cloud</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              className="hidden rounded-full border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-slate-200/90 backdrop-blur hover:border-sky-400/70 sm:inline-flex"
            >
              View architecture
            </button>
            <button
              type="button"
              className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 font-medium text-emerald-200 shadow-[0_10px_30px_rgba(16,185,129,0.35)] hover:bg-emerald-400/20"
            >
              Request enterprise demo
            </button>
          </div>
        </header>

        <section className="grid gap-10 border-b border-slate-800/70 pb-12 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-300/90 shadow-[0_0_0_1px_rgba(15,23,42,0.9)]">
                Enterprise operating layer for your super stakeholders
              </div>
              <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-tight text-slate-50 md:text-5xl">
                CRM, redefined as your{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-400 bg-clip-text text-transparent">
                  enterprise operating system
                </span>
                .
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300/90">
                Cachedigitech stitches Super Admin, Admin and User workflows into a single governed graph. Opportunities,
                SCM, deployments and finance all flow through one trustable command center.
              </p>
            </div>
            <div className="mt-6 grid gap-4 text-xs text-slate-300 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.55)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400/90">
                  Super Admin graph
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-200">
                  Govern orgs, subscriptions and roles with fine-grained view / edit / both controls.
                </p>
              </div>
              <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/70 p-4 shadow-[0_18px_50px_rgba(8,47,73,0.7)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                  Admin control lane
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-100">
                  Admins orchestrate deals, approvals and OOF rules without ever touching raw config.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 via-slate-900/80 to-sky-500/20 p-4 shadow-[0_18px_60px_rgba(16,185,129,0.6)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
                  User focus mode
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-emerald-50">
                  Frontline teams get a calm, task-first workspace with zero admin noise.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-full rounded-3xl border border-slate-700/80 bg-slate-900/80 p-[1px] shadow-[0_28px_80px_rgba(15,23,42,0.95)] backdrop-blur-2xl">
              <div className="rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 px-6 py-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Sign in
                    </p>
                    <p className="mt-1 text-xs text-slate-300/90">Enter your workspace credentials.</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-slate-950 text-[10px] font-medium text-slate-100">
                    <span className="rounded-full bg-emerald-400 px-2 py-1 text-slate-950">Super Admin</span>
                    <span className="px-2 py-1 text-slate-400">Admin</span>
                    <span className="px-2 py-1 text-slate-500">User</span>
                  </div>
                </div>
                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-200">Work email</label>
                    <input
                      type="email"
                      placeholder="you@cachedigitech.com"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-50 outline-none ring-0 transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-200">Password</label>
                      <button
                        type="button"
                        className="text-[11px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                      >
                        Forgot?
                      </button>
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-50 outline-none ring-0 transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <span className="inline-flex h-4 w-7 items-center rounded-full bg-slate-800 p-[2px]">
                        <span className="h-3.5 w-3.5 rounded-full bg-slate-200 shadow-sm" />
                      </span>
                      <span>Stay signed in on this device</span>
                    </div>
                    <span>Secure SSO will be wired in next phase</span>
                  </div>
                  {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent-primary)] px-3 py-2.5 text-sm font-medium text-white shadow-[0_22px_55px_rgba(15,23,42,0.9)] transition hover:bg-[var(--accent-primary)]/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Entering…" : "Enter the studio"}
                  </button>
                </form>
                <p className="mt-4 text-[11px] text-slate-400">
                  By continuing you confirm you are authorised to access this Cachedigitech environment.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 border-b border-slate-800/70 pb-10 text-xs text-slate-300 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-200/90">
              CRMs were built for records. Enterprises run on workflows.
            </p>
            <p className="max-w-xl text-[13px] leading-relaxed text-slate-300">
              Cachedigitech connects CRM, presales, SCM, finance and deployments into one execution backbone. Every
              approval, every margin check, every dispatch is a node in your enterprise graph.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Out-of-the-box governance
              </p>
              <p className="mt-2 text-[13px] leading-relaxed">
                Role-aware policies for Super Admin, Admin and User tiers, aligned with enterprise-grade approvals.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Multi-discipline graph
              </p>
              <p className="mt-2 text-[13px] leading-relaxed">
                CRM, opportunities, SCM, deployments, invoices and collections all stitched into a single audit trail.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10 flex flex-col items-center gap-4 text-center text-xs text-slate-300">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
            Start with Cachedigitech
          </p>
          <h2 className="max-w-md text-sm leading-relaxed text-slate-200">
            Make Cachedigitech CRM the calm, luxury backbone for how your teams sell, deploy and support.
          </h2>
          <button
            type="button"
            className="mt-1 inline-flex items-center rounded-full bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.85)]"
          >
            Start with this console
          </button>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/super-admin"
        element={
          <AppShell>
            <SuperAdminPage />
          </AppShell>
        }
      />
      <Route
        path="/admin"
        element={
          <AppShell>
            <AdminPage />
          </AppShell>
        }
      />
      <Route
        path="/workspace"
        element={
          <AppShell>
            <WorkspacePage />
          </AppShell>
        }
      />
      <Route
        path="/"
        element={
          <AppShell>
            <DashboardPage />
          </AppShell>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AppShell>
            <DashboardPage />
          </AppShell>
        }
      />
      <Route
        path="/crm/leads"
        element={
          <AppShell>
            <LeadsPage />
          </AppShell>
        }
      />
      <Route
        path="/crm/leads/new"
        element={
          <AppShell>
            <CreateLeadPage />
          </AppShell>
        }
      />
      <Route
        path="/crm/leads/:id"
        element={
          <AppShell>
            <LeadDetailPage />
          </AppShell>
        }
      />
      <Route
        path="/crm/opportunities"
        element={
          <AppShell>
            <OpportunitiesPage />
          </AppShell>
        }
      />
      <Route
        path="/crm/opportunities/:id"
        element={
          <AppShell>
            <OpportunityDetailPage />
          </AppShell>
        }
      />
      <Route
        path="/presales"
        element={
          <AppShell>
            <PresalesDashboardPage />
          </AppShell>
        }
      />
      <Route
        path="/presales/projects"
        element={
          <AppShell>
            <PresalesProjectsPage />
          </AppShell>
        }
      />
      <Route
        path="/presales/projects/:id"
        element={
          <AppShell>
            <PresalesProjectDetailPage />
          </AppShell>
        }
      />
      <Route
        path="/presales/boq"
        element={
          <AppShell>
            <PresalesBoqPage />
          </AppShell>
        }
      />
      <Route
        path="/presales/poc"
        element={
          <AppShell>
            <PresalesPocPage />
          </AppShell>
        }
      />
      <Route
        path="/presales/proposals"
        element={
          <AppShell>
            <PresalesProposalsPage />
          </AppShell>
        }
      />
      <Route
        path="/api-fetcher"
        element={
          <AppShell>
            <ApiFetcherPage />
          </AppShell>
        }
      />
      <Route
        path="/settings/users"
        element={
          <AppShell>
            <SettingsUsersPage />
          </AppShell>
        }
      />
    </Routes>
  );
}
