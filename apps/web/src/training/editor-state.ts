/** Never replace newer local edits with the response to an earlier save. */
export function preserveNewerEdits<T>(
  current: T,
  submitted: T,
  canonical: T,
): T {
  return JSON.stringify(current) === JSON.stringify(submitted)
    ? canonical
    : current;
}
/** Only a definitive not-found makes a saved attempt unusable. */
export function forgetAttempt(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "status" in error &&
    error.status === 404
  );
}
