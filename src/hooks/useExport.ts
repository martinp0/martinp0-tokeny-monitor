import { useCallback, useRef } from "react";

/**
 * Dashboard PNG snapshot (rendered in the browser). CSV/JSON exports and the printable monthly
 * report are served by /api/export and /api/report (see ExportDialog and pages/Report).
 */
export function useExport(dashboardRef: React.RefObject<HTMLElement | null>) {
  const exporting = useRef(false);

  const exportPNG = useCallback(async () => {
    if (!dashboardRef.current || exporting.current) return;
    exporting.current = true;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(dashboardRef.current, {
        backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `tokeny-dashboard-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      exporting.current = false;
    }
  }, [dashboardRef]);

  return { exportPNG };
}
