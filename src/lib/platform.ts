export const isCapacitorApp = () => {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
};

export const getPlatform = () => {
  if (typeof window === "undefined") return "web";
  const cap = (window as any).Capacitor;
  if (!cap?.isNativePlatform?.()) return "web";
  return cap.getPlatform?.() || "unknown";
};
