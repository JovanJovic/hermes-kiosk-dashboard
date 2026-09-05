import { useEffect, useState } from "react";
import { demoData, validHub, type HubData } from "./data";
export function useHub(mode: "demo" | "live") {
  const [data, setData] = useState<HubData | null>(() =>
    mode === "demo" ? demoData() : null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(mode === "live");
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setData(mode === "demo" ? demoData() : null);
    setError("");
    setLoading(mode === "live");
    async function poll() {
      try {
        let next: HubData;
        if (mode === "demo") next = demoData();
        else {
          const response = await fetch("./api/hub", {
            cache: "no-store",
            credentials: "omit",
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(18000),
            ]),
          });
          if (!response.ok) throw new Error("Unavailable");
          const raw: unknown = await response.json();
          if (!validHub(raw)) throw new Error("Invalid response");
          next = raw;
        }
        if (active) {
          setData(next);
          setError("");
        }
      } catch {
        if (active) {
          setData(null);
          setError("The local hub is unavailable. Retrying automatically.");
        }
      } finally {
        if (active) {
          setLoading(false);
          timer = setTimeout(poll, 8000);
        }
      }
    }
    void poll();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [mode]);
  return { data: data?.source === mode ? data : null, error, loading };
}
