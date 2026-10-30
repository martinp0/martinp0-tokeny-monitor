import { lazy, Suspense, useEffect, useRef, useState } from "react";

const LandingDemo = lazy(() => import("./LandingDemo"));

function DemoSkeleton() {
  return (
    <div className="space-y-4 min-h-[280px] min-w-0 max-w-full overflow-hidden" aria-hidden>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted/60" />
        ))}
      </div>
      <div className="h-40 rounded-xl bg-muted/60" />
    </div>
  );
}

/** Loads Recharts and the sample CSV only once the demo is near the viewport. */
export function LandingDemoGate() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="min-w-0 max-w-full">
      {visible ? (
        <Suspense fallback={<DemoSkeleton />}>
          <LandingDemo />
        </Suspense>
      ) : (
        <DemoSkeleton />
      )}
    </div>
  );
}
