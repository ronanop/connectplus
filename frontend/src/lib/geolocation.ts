export interface GeoResult {
  lat: number;
  lng: number;
  accuracy: number;
}

function isLocalhostHostname(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

export function assertGeolocationSecureContext(): void {
  if (typeof window === "undefined") return;
  if (window.isSecureContext) return;
  if (isLocalhostHostname()) return;
  throw new Error("GEO_REQUIRES_HTTPS");
}

function getCurrentPositionWithOptions(options: PositionOptions): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    assertGeolocationSecureContext();
    if (!navigator.geolocation) {
      reject(new Error("GEO_NOT_SUPPORTED"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      err => {
        const map: Record<number, string> = {
          1: "GEO_PERMISSION_DENIED",
          2: "GEO_UNAVAILABLE",
          3: "GEO_TIMEOUT",
        };
        reject(new Error(map[err.code] ?? "GEO_UNKNOWN"));
      },
      options,
    );
  });
}

export async function getCurrentPosition(): Promise<GeoResult> {
  try {
    return await getCurrentPositionWithOptions({
      enableHighAccuracy: true,
      timeout: 22_000,
      maximumAge: 0,
    });
  } catch (e) {
    if (e instanceof Error && (e.message === "GEO_TIMEOUT" || e.message === "GEO_UNAVAILABLE")) {
      return getCurrentPositionWithOptions({
        enableHighAccuracy: false,
        timeout: 28_000,
        maximumAge: 120_000,
      });
    }
    throw e;
  }
}

export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
