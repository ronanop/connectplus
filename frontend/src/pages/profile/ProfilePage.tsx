import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { ProfilePhotoUploader } from "../../components/profile/ProfilePhotoUploader";

export default function ProfilePage() {
  const user = useAuthStore(s => s.user);
  const { data: userDetails, isLoading } = useQuery({
    queryKey: ["user-profile"],
    enabled: !!user,
    queryFn: async () => {
      const response = await api.get("/api/auth/me");
      return response.data?.data?.user as Record<string, unknown>;
    },
  });

  const displayUser = (userDetails ?? user) as Record<string, unknown>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-neutral-500">Loading profile...</p>
      </div>
    );
  }

  if (!displayUser) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-neutral-500">User not found</p>
      </div>
    );
  }

  const name = String(displayUser.name ?? "User");
  const profilePhotoUrl =
    typeof displayUser.profilePhotoUrl === "string" ? displayUser.profilePhotoUrl : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Profile</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">My Profile</h1>
        <p className="mt-1 text-sm text-neutral-500">View and manage your account information.</p>
      </div>

      <ProfilePhotoUploader
        userName={name}
        profilePhotoUrl={profilePhotoUrl}
        hasFaceRegistered={Boolean(displayUser.hasFaceRegistered)}
        faceEnrolledAt={displayUser.faceEnrolledAt ? String(displayUser.faceEnrolledAt) : null}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Personal Information</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-gold)]/20 text-[var(--accent-primary)]">
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold">{name.charAt(0).toUpperCase() || "U"}</span>
                )}
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{name}</p>
                <p className="text-sm text-neutral-500">{String(displayUser.email ?? "No email")}</p>
              </div>
            </div>

            <div className="space-y-3 border-t border-[var(--border)]/50 pt-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Role</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                  {String(displayUser.role ?? "N/A")}
                </p>
              </div>

              {displayUser.department ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Department</p>
                  <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                    {String(displayUser.department)}
                  </p>
                </div>
              ) : null}

              {displayUser.organization ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Organization</p>
                  <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                    {String(displayUser.organization)}
                  </p>
                </div>
              ) : null}

              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">User ID</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                  {String(displayUser.id ?? "N/A")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Account Details</h2>
          <div className="space-y-4">
            <div className="rounded-lg bg-[var(--bg-elevated)]/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Email Address</p>
              <p className="mt-2 text-sm text-[var(--text-primary)]">
                {String(displayUser.email ?? "Not provided")}
              </p>
            </div>

            <div className="rounded-lg bg-[var(--bg-elevated)]/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Account Status</p>
              <p className="mt-2 text-sm text-[var(--text-primary)]">Active</p>
            </div>

            <div className="rounded-lg bg-[var(--bg-elevated)]/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Permissions</p>
              <p className="mt-2 text-sm text-[var(--text-primary)]">
                Based on role: <span className="font-medium">{String(displayUser.role ?? "N/A")}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
