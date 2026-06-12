import { useEffect } from "react";

export function useCapacitorClass() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
    
    if (isCapacitor) {
      document.body.classList.add("capacitor-app");
    } else {
      document.body.classList.remove("capacitor-app");
    }
    
    return () => {
      document.body.classList.remove("capacitor-app");
    };
  }, []);
}
