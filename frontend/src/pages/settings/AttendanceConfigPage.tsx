import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { attendanceApi } from "../../lib/attendanceApi";
import { getCurrentPosition } from "../../lib/geolocation";

type Config = {
  officeLat: number;
  officeLng: number;
  perimeterMeters: number;
  faceMatchThreshold: number;
};

/** Default office location — kept in sync with `backend/seed.js` AttendanceConfig. */
const DEFAULT_OFFICE_LAT = "28.497293941267056";
const DEFAULT_OFFICE_LNG = "77.16323783636463";

export default function AttendanceConfigPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-config"],
    queryFn: async () => {
      try {
        const res = await attendanceApi.getConfig();
        return res.data.data.config as Config;
      } catch {
        return null;
      }
    },
  });

  const { data: regCount } = useQuery({
    queryKey: ["attendance-face-count"],
    queryFn: async () => {
      const res = await attendanceApi.getFaceRegistrationCount();
      return res.data.data.count;
    },
  });

  const [officeLat, setOfficeLat] = useState("");
  const [officeLng, setOfficeLng] = useState("");
  const [perimeter, setPerimeter] = useState("70");
  const [thresholdPct, setThresholdPct] = useState("70");

  useEffect(() => {
    if (data) {
      setOfficeLat(String(data.officeLat));
      setOfficeLng(String(data.officeLng));
      setPerimeter(String(data.perimeterMeters));
      setThresholdPct(String(Math.round(data.faceMatchThreshold * 100)));
      return;
    }
    if (data === null) {
      setOfficeLat(DEFAULT_OFFICE_LAT);
      setOfficeLng(DEFAULT_OFFICE_LNG);
      setPerimeter("70");
      setThresholdPct("70");
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const lat = parseFloat(officeLat);
      const lng = parseFloat(officeLng);
      const pm = parseInt(perimeter, 10);
      const th = parseInt(thresholdPct, 10) / 100;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Invalid coordinates");
      }
      await attendanceApi.saveConfig({
        officeLat: lat,
        officeLng: lng,
        perimeterMeters: pm,
        faceMatchThreshold: th,
      });
    },
    onSuccess: () => {
      toast.success("Attendance settings saved");
      void queryClient.invalidateQueries({ queryKey: ["attendance-config"] });
    },
    onError: (e: Error) => toast.error(e.message || "Save failed"),
  });

  const resetMut = useMutation({
    mutationFn: () => attendanceApi.resetAllFaceDescriptors(),
    onSuccess: res => {
      toast.success(`Reset face data for ${res.data.data.count} users`);
      void queryClient.invalidateQueries({ queryKey: ["attendance-face-count"] });
    },
    onError: () => toast.error("Reset failed"),
  });

  const mapUrl =
    officeLat && officeLng && !Number.isNaN(parseFloat(officeLat)) && !Number.isNaN(parseFloat(officeLng))
      ? `https://staticmap.openstreetmap.de/staticmap.php?center=${officeLat},${officeLng}&zoom=16&size=400x200&markers=${officeLat},${officeLng}`
      : null;

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Settings</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Attendance</h1>
        <p className="mt-1 text-sm text-neutral-500">Office location, perimeter, and face match threshold.</p>
      </div>

      <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Office location</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-neutral-500">
            Latitude
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
              value={officeLat}
              onChange={e => setOfficeLat(e.target.value)}
            />
          </label>
          <label className="text-xs text-neutral-500">
            Longitude
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
              value={officeLng}
              onChange={e => setOfficeLng(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="mt-3 rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
          onClick={() => {
            void getCurrentPosition()
              .then(pos => {
                setOfficeLat(String(pos.lat));
                setOfficeLng(String(pos.lng));
                toast.success("Filled from your current location");
              })
              .catch(() => toast.error("Could not get location"));
          }}
        >
          Use my current location
        </button>
        {mapUrl ? (
          <img src={mapUrl} alt="Office map preview" className="mt-4 max-w-full rounded-lg border border-[var(--border)]" />
        ) : null}

        <h2 className="mt-8 text-lg font-semibold">Perimeter (meters)</h2>
        <input
          type="range"
          min={10}
          max={500}
          value={Math.min(500, Math.max(10, parseInt(perimeter, 10) || 70))}
          onChange={e => setPerimeter(e.target.value)}
          className="mt-2 w-full"
        />
        <input
          type="number"
          min={10}
          max={5000}
          className="mt-2 w-32 rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
          value={perimeter}
          onChange={e => setPerimeter(e.target.value)}
        />

        <h2 className="mt-8 text-lg font-semibold">Face match threshold</h2>
        <p className="text-xs text-neutral-500">50%–95% (default 70%)</p>
        <input
          type="range"
          min={50}
          max={95}
          value={Math.min(95, Math.max(50, parseInt(thresholdPct, 10) || 70))}
          onChange={e => setThresholdPct(e.target.value)}
          className="mt-2 w-full"
        />
        <span className="text-sm">{thresholdPct}%</span>

        <button
          type="button"
          disabled={saveMut.isPending}
          className="mt-8 w-full min-h-[48px] rounded-xl bg-[var(--accent-primary)] py-3 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => saveMut.mutate()}
        >
          Save settings
        </button>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
        <h2 className="text-lg font-semibold text-red-800">Danger zone</h2>
        <p className="mt-2 text-sm text-red-900/80">
          Reset face ID for all users in your organization. Users must re-register via profile photo.
        </p>
        <p className="mt-2 text-sm text-neutral-700">
          Attendance Face ID registered: <strong>{regCount ?? "—"}</strong> users
        </p>
        <button
          type="button"
          disabled={resetMut.isPending}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => {
            if (window.confirm("Reset face descriptors for ALL users in this organization?")) {
              resetMut.mutate();
            }
          }}
        >
          Reset all face IDs
        </button>
      </div>
    </div>
  );
}
