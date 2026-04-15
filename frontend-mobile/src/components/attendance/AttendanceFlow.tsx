import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { Check, Loader2, MapPin, X } from "lucide-react";
import { toast } from "react-toastify";
import { attendanceApi } from "../../lib/attendanceApi";
import { formatAttendanceError, ATTENDANCE_ERRORS } from "../../lib/attendanceErrors";
import { getCurrentPosition, isIOS } from "../../lib/geolocation";
import {
  captureFrame,
  cosineSimilarity,
  getDescriptorFromImage,
  isInAppBrowser,
  loadModels,
  startCamera,
  stopCamera,
} from "../../lib/faceRecognition";

type GeoState =
  | "REQUESTING"
  | "SUCCESS"
  | "OUTSIDE"
  | "DENIED"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "UNKNOWN";

export type AttendanceFlowMode = "checkIn" | "checkOut";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode?: AttendanceFlowMode;
};

export function AttendanceFlow({ open, onClose, onSuccess, mode = "checkIn" }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [geoState, setGeoState] = useState<GeoState>("REQUESTING");
  const [geoMsg, setGeoMsg] = useState("");
  const [distance, setDistance] = useState<number | null>(null);
  const [perimeter, setPerimeter] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [latLng, setLatLng] = useState<{ lat: number; lng: number } | null>(null);

  const [modelPct, setModelPct] = useState<number | null>(null);
  const [faceStatus, setFaceStatus] = useState<string>("");
  const [faceBorder, setFaceBorder] = useState<"gray" | "green">("gray");
  const [analyzing, setAnalyzing] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [doneScreen, setDoneScreen] = useState<"none" | "success" | "fail">("none");
  const [matchPct, setMatchPct] = useState<number | null>(null);
  const [completedTime, setCompletedTime] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [geoAttempt, setGeoAttempt] = useState(0);

  const reset = useCallback(() => {
    setStep(1);
    setGeoState("REQUESTING");
    setGeoMsg("");
    setDistance(null);
    setPerimeter(null);
    setToken(null);
    setLatLng(null);
    setModelPct(null);
    setFaceStatus("");
    setFaceBorder("gray");
    setAnalyzing(false);
    setAttempts(0);
    setDoneScreen("none");
    setMatchPct(null);
    setCompletedTime(null);
    setGeoAttempt(0);
    stopCamera(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    let cancelled = false;
    const runGeo = async () => {
      setGeoState("REQUESTING");
      setGeoMsg("Getting your location…");
      try {
        const pos = await getCurrentPosition();
        if (cancelled) {
          return;
        }
        setLatLng({ lat: pos.lat, lng: pos.lng });
        const res = await attendanceApi.verifyGeo(pos.lat, pos.lng);
        const d = res.data.data;
        if (!d.passed) {
          setGeoState("OUTSIDE");
          setDistance(Math.round(d.distance));
          setPerimeter(d.perimeterMeters ?? null);
          setGeoMsg("");
          return;
        }
        setGeoState("SUCCESS");
        setDistance(Math.round(d.distance));
        setToken(d.token ?? null);
        setGeoMsg(`You are ${Math.round(d.distance)}m from the office`);
        setTimeout(() => {
          if (!cancelled) {
            setStep(2);
          }
        }, 1200);
      } catch (e: unknown) {
        if (cancelled) {
          return;
        }
        if (axios.isAxiosError(e)) {
          const status = e.response?.status;
          const msg = (e.response?.data as { message?: string } | undefined)?.message;
          if (status === 404) {
            setGeoState("UNKNOWN");
            setGeoMsg(
              msg ??
                "Attendance is not configured. Ask your admin to set office location in Settings → Attendance.",
            );
            return;
          }
          if (status === 400 && msg?.trim()) {
            setGeoState("UNKNOWN");
            setGeoMsg(msg.trim());
            return;
          }
          if (status === 401) {
            setGeoState("UNKNOWN");
            setGeoMsg("Your session expired. Please sign in again.");
            return;
          }
          if (status != null && msg?.trim()) {
            setGeoState("UNKNOWN");
            setGeoMsg(msg.trim());
            return;
          }
          if (!e.response) {
            setGeoState("UNKNOWN");
            setGeoMsg(
              "Cannot reach the server. Use the same Wi‑Fi as your PC or set VITE_API_URL to http://YOUR_PC_IP:4000 in .env.",
            );
            return;
          }
        }
        const code = e instanceof Error ? e.message : "GEO_UNKNOWN";
        if (code === "GEO_PERMISSION_DENIED") {
          setGeoState("DENIED");
          setGeoMsg(isIOS() ? ATTENDANCE_ERRORS.GEO_PERMISSION_DENIED_IOS.message : ATTENDANCE_ERRORS.GEO_PERMISSION_DENIED.message);
        } else if (code === "GEO_UNAVAILABLE") {
          setGeoState("UNAVAILABLE");
        } else if (code === "GEO_TIMEOUT") {
          setGeoState("TIMEOUT");
        } else if (code === "GEO_NOT_SUPPORTED") {
          setGeoState("UNAVAILABLE");
          setGeoMsg(ATTENDANCE_ERRORS.GEO_NOT_SUPPORTED.message);
        } else if (code === "GEO_REQUIRES_HTTPS") {
          setGeoState("UNKNOWN");
          setGeoMsg(ATTENDANCE_ERRORS.GEO_REQUIRES_HTTPS.message);
        } else if (code === "GEO_UNKNOWN") {
          setGeoState("UNKNOWN");
          setGeoMsg(ATTENDANCE_ERRORS.GEO_UNKNOWN.message);
        } else {
          setGeoState("UNKNOWN");
          setGeoMsg(ATTENDANCE_ERRORS.GEO_UNKNOWN.message);
        }
      }
    };
    void runGeo();
    return () => {
      cancelled = true;
    };
  }, [open, reset, geoAttempt]);

  useEffect(() => {
    if (!open || step !== 2) {
      return;
    }
    if (isInAppBrowser()) {
      toast.error(ATTENDANCE_ERRORS.IN_APP_BROWSER.message);
      return;
    }
    let cancelled = false;
    let raf = 0;

    const waitForVideoEl = (): Promise<HTMLVideoElement | null> => {
      const deadline = performance.now() + 4000;
      return new Promise(resolve => {
        const tick = () => {
          if (cancelled) {
            resolve(null);
            return;
          }
          const el = videoRef.current;
          if (el) {
            resolve(el);
            return;
          }
          if (performance.now() > deadline) {
            resolve(null);
            return;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
    };

    const prep = async () => {
      try {
        await loadModels(p => {
          if (!cancelled) {
            setModelPct(p);
          }
        });
        if (cancelled) {
          return;
        }
        setModelPct(100);
        setFaceStatus("Starting camera…");
        const videoEl = await waitForVideoEl();
        if (cancelled || !videoEl) {
          if (!cancelled) {
            toast.error("Camera preview did not start. Close and try Mark Attendance again.");
            setFaceStatus("Camera preview unavailable. Close and reopen this flow.");
          }
          return;
        }
        const s = await startCamera(videoEl);
        if (cancelled) {
          stopCamera(s);
          return;
        }
        streamRef.current = s;
        setFaceStatus("Position your face in the oval");
      } catch (e: unknown) {
        const code = e instanceof Error ? e.message : "";
        const mapped = formatAttendanceError(
          code === "CAMERA_PERMISSION_DENIED" && isIOS() ? "CAMERA_PERMISSION_DENIED_IOS" : code,
        );
        toast.error(mapped.message);
        setFaceStatus(mapped.message);
      }
    };
    void prep();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopCamera(streamRef.current);
      streamRef.current = null;
    };
  }, [open, step]);

  const handleVerifyFace = async () => {
    if (!latLng || !token || !videoRef.current) {
      toast.error("Missing location or session. Start again.");
      return;
    }
    if (attempts >= 3) {
      return;
    }
    setAnalyzing(true);
    setFaceStatus("Verifying…");
    try {
      await loadModels();
      const enrolledRes = await attendanceApi.getFaceDescriptor();
      const raw = enrolledRes.data.data.descriptor;
      const enrolled = new Float32Array(raw);
      const canvas = captureFrame(videoRef.current);
      const live = await getDescriptorFromImage(canvas);
      if (!live) {
        setAttempts(a => a + 1);
        setFaceStatus("No face detected. Adjust lighting or position.");
        setFaceBorder("gray");
        setAnalyzing(false);
        if (attempts + 1 >= 3) {
          if (mode === "checkIn") {
            await attendanceApi.recordFaceFailed();
          }
          stopCamera(streamRef.current);
          streamRef.current = null;
          setDoneScreen("fail");
        }
        return;
      }
      const cfg = await attendanceApi.getConfig();
      const threshold = Number((cfg.data.data.config as { faceMatchThreshold?: number }).faceMatchThreshold ?? 0.7);
      const score = cosineSimilarity(enrolled, live);
      if (score >= threshold) {
        setFaceBorder("green");
        const pct = Math.round(score * 100);
        setMatchPct(pct);
        // Re-verify location right before submit — model load + face retries can exceed the geo token TTL.
        const geoAgain = await attendanceApi.verifyGeo(latLng.lat, latLng.lng);
        const gd = geoAgain.data.data;
        if (!gd.passed || !gd.token) {
          toast.error(
            "You no longer appear to be within the office perimeter. Go back to step 1 and verify location again.",
          );
          setAnalyzing(false);
          return;
        }
        const payload = {
          faceMatchScore: score,
          verificationToken: gd.token,
          lat: latLng.lat,
          lng: latLng.lng,
        };
        if (mode === "checkOut") {
          await attendanceApi.checkOut(payload);
        } else {
          await attendanceApi.checkIn(payload);
        }
        stopCamera(streamRef.current);
        streamRef.current = null;
        setCompletedTime(
          new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        );
        setDoneScreen("success");
        onSuccess();
      } else {
        const next = attempts + 1;
        setAttempts(next);
        setFaceStatus(`Face not recognized. Attempt ${next} of 3.`);
        setFaceBorder("gray");
        if (next >= 3) {
          if (mode === "checkIn") {
            await attendanceApi.recordFaceFailed();
          }
          stopCamera(streamRef.current);
          streamRef.current = null;
          setDoneScreen("fail");
        }
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; message?: string } } };
      const code = ax.response?.data?.error;
      if (code === "TOKEN_EXPIRED" || ax.response?.data?.message?.includes("expired")) {
        toast.error(ATTENDANCE_ERRORS.TOKEN_EXPIRED.message);
      } else if (code === "ALREADY_CHECKED_IN") {
        toast.error(ATTENDANCE_ERRORS.ALREADY_CHECKED_IN.message);
      } else if (code === "ALREADY_CHECKED_OUT") {
        toast.error(ATTENDANCE_ERRORS.ALREADY_CHECKED_OUT.message);
      } else if (code === "ATTENDANCE_LOCKED") {
        toast.error(ATTENDANCE_ERRORS.ATTENDANCE_LOCKED.message);
      } else {
        toast.error(ax.response?.data?.message ?? "Verification failed");
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const retryGeo = () => {
    setStep(1);
    setGeoState("REQUESTING");
    setToken(null);
    setLatLng(null);
    setGeoAttempt(a => a + 1);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[250] flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-3 pt-[max(0.75rem,var(--safe-top))] sm:px-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
          <span className={step === 1 ? "font-semibold text-[var(--accent-primary)]" : "text-neutral-500"}>
            ① Location
          </span>
          <span className="hidden text-neutral-400 sm:inline">—</span>
          <span className={step === 2 ? "font-semibold text-[var(--accent-primary)]" : "text-neutral-500"}>
            ② Face ID
          </span>
        </div>
        <button
          type="button"
          aria-label="Close attendance flow"
          className="mobile-tap shrink-0 rounded-lg p-2 hover:bg-[var(--bg-elevated)]"
          onClick={() => {
            stopCamera(streamRef.current);
            streamRef.current = null;
            onClose();
          }}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence mode="sync">
        {doneScreen === "success" ? (
          <motion.div
            key="ok"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-4 sm:p-6"
          >
            <div className="success-burst flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-semibold">
              {mode === "checkOut" ? "Checked out" : "Attendance Marked"}
            </h2>
            <p className="text-neutral-600">
              {completedTime && <span>Time: {completedTime}</span>}
              {matchPct != null && <span className="ml-3">Match: {matchPct}%</span>}
            </p>
            <button
              type="button"
              className="mobile-tap mobile-tap-strong mt-4 rounded-xl bg-[var(--accent-primary)] px-6 py-3 text-white"
              onClick={onClose}
            >
              Close
            </button>
            <style>{`
              @keyframes successBurst {
                0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
                100% { box-shadow: 0 0 0 32px rgba(34, 197, 94, 0); }
              }
              .success-burst { animation: successBurst 0.8s ease-out 1; }
            `}</style>
          </motion.div>
        ) : doneScreen === "fail" ? (
          <motion.div
            key="fail"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-4 text-center sm:p-6"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20 text-orange-600">
              <X className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">Couldn&apos;t verify your face</h2>
            <p className="max-w-md px-1 text-sm text-neutral-600">
              {mode === "checkOut"
                ? "You are still checked in. Try again or contact your manager."
                : "Contact your manager or admin for a manual override."}
            </p>
            <button
              type="button"
              className="mobile-tap mt-4 rounded-xl border px-6 py-3"
              onClick={onClose}
            >
              Close
            </button>
          </motion.div>
        ) : step === 1 ? (
          <motion.div
            key="g"
            initial={{ x: -16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 16, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto overflow-x-hidden p-4 sm:p-6"
          >
            <MapPin className="h-12 w-12 animate-pulse text-[var(--accent-primary)]" />
            {geoState === "REQUESTING" && (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                <p className="text-sm" aria-live="polite">
                  Checking your location…
                </p>
                <p className="text-xs text-neutral-500">Desktop location may be less accurate without GPS.</p>
              </>
            )}
            {geoState === "SUCCESS" && (
              <>
                <Check className="h-10 w-10 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-700" aria-live="polite">
                  Location verified
                </p>
                <p className="text-xs text-neutral-600">{geoMsg}</p>
              </>
            )}
            {geoState === "OUTSIDE" && (
              <>
                <p className="max-w-full px-2 text-center text-sm" aria-live="polite">
                  You are {distance}m away. You must be within {perimeter ?? "?"}m of the office.
                </p>
                <button type="button" className="mobile-tap rounded-xl border px-4 py-2" onClick={retryGeo}>
                  Retry
                </button>
                <button type="button" className="mobile-tap text-sm text-neutral-500" onClick={onClose}>
                  Cancel
                </button>
              </>
            )}
            {(geoState === "DENIED" || geoState === "UNAVAILABLE" || geoState === "TIMEOUT" || geoState === "UNKNOWN") && (
              <>
                <p className="max-w-full px-2 text-center text-sm" aria-live="polite">
                  {geoMsg || "Location error"}
                </p>
                <button type="button" className="mobile-tap rounded-xl border px-4 py-2" onClick={retryGeo}>
                  Retry
                </button>
                <button type="button" className="mobile-tap text-sm text-neutral-500" onClick={onClose}>
                  Cancel
                </button>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="f"
            initial={{ x: 16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto overflow-x-hidden p-3 pb-[max(1.5rem,var(--safe-bottom))] sm:p-4"
          >
            {modelPct != null && modelPct < 100 && (
              <div className="w-full max-w-sm">
                <p className="mb-1 text-xs text-neutral-500">Preparing face verification… {modelPct}%</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-full bg-[var(--accent-primary)] transition-all" style={{ width: `${modelPct}%` }} />
                </div>
              </div>
            )}
            <div className="relative mx-auto aspect-square w-full max-w-[min(320px,_calc(100vw-1.5rem))] overflow-hidden rounded-full border-2 border-[var(--border)] bg-black sm:max-w-[min(360px,_calc(100vw-2rem))]">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
                autoPlay
                playsInline
                muted
              />
              {analyzing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="h-10 w-10 animate-spin text-white" />
                </div>
              )}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden>
                <ellipse
                  cx="50"
                  cy="50"
                  rx="38"
                  ry="48"
                  fill="none"
                  stroke={faceBorder === "green" ? "#22c55e" : "rgba(255,255,255,0.6)"}
                  strokeWidth="0.9"
                  strokeDasharray={faceBorder === "green" ? "0" : "3 2"}
                  className="transition-[stroke] duration-300"
                />
              </svg>
            </div>
            <p className="max-w-full px-2 text-center text-sm" aria-live="polite">
              {faceStatus}
            </p>
            <div className="flex gap-2" aria-label="Attempts used">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${i < attempts ? "bg-orange-500" : "bg-neutral-300"}`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Verify face"
              disabled={analyzing || attempts >= 3}
              className="mobile-tap mobile-tap-strong flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white shadow-lg transition-shadow duration-200 hover:shadow-xl disabled:opacity-40"
              onClick={() => void handleVerifyFace()}
            >
              Verify
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
