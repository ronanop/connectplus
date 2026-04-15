import axios from "axios";

export function getHierarchyErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { message?: string; error?: string } | undefined;
    if (d?.message) {
      return d.message;
    }
  }
  return err instanceof Error ? err.message : "Something went wrong";
}
