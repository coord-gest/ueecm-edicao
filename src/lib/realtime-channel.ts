export function uniqueRealtimeChannelName(base: string) {
  const safeBase = base.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 80);
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${safeBase}-${suffix}`;
}