export const ATTENDANCE_ERRORS: Record<
  string,
  { title: string; message: string; action?: string }
> = {
  GEO_PERMISSION_DENIED_IOS: {
    title: "Location Access Denied",
    message:
      'On iPhone: go to Settings → Privacy & Security → Location Services → Safari → set to "While Using"',
    action: "Open Settings",
  },
  GEO_PERMISSION_DENIED_ANDROID: {
    title: "Location Access Denied",
    message: "Tap the lock icon in your browser address bar, then allow Location.",
    action: "Retry",
  },
  GEO_PERMISSION_DENIED: {
    title: "Location Access Denied",
    message: "Allow location access in your browser settings and try again.",
    action: "Retry",
  },
  GEO_UNAVAILABLE: {
    title: "Location Unavailable",
    message: "Could not get your GPS location. Ensure location is enabled and move to an open area.",
  },
  GEO_TIMEOUT: {
    title: "Location Timed Out",
    message: "GPS took too long to respond. Move to an open area and try again.",
    action: "Retry",
  },
  GEO_NOT_SUPPORTED: {
    title: "Location Not Supported",
    message: "Your browser does not support location access. Try Chrome or Safari.",
  },
  GEO_REQUIRES_HTTPS: {
    title: "Secure connection required",
    message:
      "GPS only works on HTTPS (or localhost). Open the app with https:// in the address bar and accept the certificate warning if shown — not plain http://.",
  },
  GEO_UNKNOWN: {
    title: "Location error",
    message:
      "Could not read your position. Move to an open area, tap Retry, or try disabling Wi‑Fi location and using GPS only.",
  },
  OUTSIDE_PERIMETER: {
    title: "Too Far from Office",
    message: "You are {distance}m away. You must be within {perimeter}m of the office.",
  },
  CAMERA_PERMISSION_DENIED_IOS: {
    title: "Camera Access Denied",
    message: "On iPhone: go to Settings → [Browser] → Camera → Allow",
    action: "Open Settings",
  },
  CAMERA_PERMISSION_DENIED: {
    title: "Camera Access Denied",
    message: "Allow camera access in your browser settings.",
    action: "Retry",
  },
  CAMERA_NOT_SUPPORTED: {
    title: "Camera Not Supported",
    message: "Your browser does not support camera access. Please use Chrome or Safari.",
  },
  CAMERA_IN_USE: {
    title: "Camera Busy",
    message: "Camera is in use by another app. Close other apps and try again.",
    action: "Retry",
  },
  CAMERA_NOT_FOUND: {
    title: "No Camera Found",
    message: "No camera was detected on this device.",
  },
  IN_APP_BROWSER: {
    title: "Open in Browser",
    message: "Camera access is not available in this in-app browser. Please open ConnectPlus in Safari or Chrome.",
  },
  FACE_NO_DESCRIPTOR: {
    title: "Face ID Not Set",
    message: "Please go to your profile and set up your photo to enable attendance.",
  },
  ALREADY_CHECKED_IN: {
    title: "Already Checked In",
    message: "Your attendance for today has already been recorded.",
  },
  ALREADY_CHECKED_OUT: {
    title: "Already Checked Out",
    message: "You have already checked out for today.",
  },
  ATTENDANCE_LOCKED: {
    title: "Attendance Set by Admin",
    message: "Attendance for today was set by an administrator. Contact HR if this is incorrect.",
  },
  TOKEN_EXPIRED: {
    title: "Session Expired",
    message: "The location verification expired. Please start again.",
  },
};

export function formatAttendanceError(
  code: string,
  vars?: Record<string, string | number>,
): { title: string; message: string; action?: string } {
  const base = ATTENDANCE_ERRORS[code] ?? {
    title: "Something went wrong",
    message: code,
  };
  let message = base.message;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      message = message.replace(`{${k}}`, String(v));
    }
  }
  return { ...base, message };
}
