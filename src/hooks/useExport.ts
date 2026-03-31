import { useCallback, useRef } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { type ActivityRow } from "@/lib/csv-parser";
import { fmtCost, fmtNum } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";

export function useExport(dashboardRef: React.RefObject<HTMLElement | null>) {
  const exporting = useRef(false);
  const { currency, exchangeRate } = useCurrency();

  const exportPNG = useCallback(async () => {
    if (!dashboardRef.current || exporting.current) return;
    exporting.current = true;
    try {
      const dataUrl = await toPng(dashboardRef.current, {
        backgroundColor: "#0f0f23",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `openrouter-dashboard-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      exporting.current = false;
    }
  }, [dashboardRef]);

  const exportPDF = useCallback((data: ActivityRow[], totalCost: number, totalRequests: number, totalTokens: number, avgGenTime: number) => {
    const doc = new jsPDF({ orientation: "landscape" });
    const w = doc.internal.pageSize.getWidth();
    const m = 15;
    let y = 20;

    doc.setFontSize(20);
    doc.setTextColor(0, 230, 128);
    doc.text("OpenRouter Monitor — Report", m, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(`Vygenerovano ${new Date().toLocaleString("cs-CZ")} · ${fmtNum(data.length, currency)} pozadavku`, m, y);
    y += 12;

    doc.setFontSize(11);
    doc.setTextColor(60);
    const kpis = [
      `Naklady: ${fmtCost(totalCost, 4, currency, exchangeRate)}`,
      `Pozadavky: ${fmtNum(totalRequests, currency)}`,
      `Prum. odpoved: ${(avgGenTime / 1000).toFixed(1)}s`,
      `Tokeny: ${fmtNum(totalTokens, currency)}`,
    ];
    kpis.forEach((k, i) => {
      doc.text(k, m + i * 65, y);
    });
    y += 12;

    doc.setFillColor(30, 30, 50);
    doc.rect(m, y - 4, w - m * 2, 8, "F");
    doc.setFontSize(8);
    doc.setTextColor(180);
    const costLabel = currency === "CZK" ? "Naklady (Kc)" : "Cost ($)";
    const cols = ["Cas", "Model", "Provider", costLabel, "Tokeny", "Gen Time (ms)", "Status"];
    const colX = [m, m + 35, m + 100, m + 140, m + 175, m + 210, m + 240];
    cols.forEach((c, i) => doc.text(c, colX[i], y));
    y += 6;

    doc.setTextColor(100);
    const sorted = [...data].sort((a, b) => b.created_at.localeCompare(a.created_at));
    for (const row of sorted) {
      if (y > doc.internal.pageSize.getHeight() - 15) {
        doc.addPage();
        y = 20;
      }
      const vals = [
        row.created_at.substring(11, 19),
        (row.model_permaslug.split("/").pop() || "").substring(0, 28),
        row.provider_name,
        fmtCost(row.cost_total, 4, currency, exchangeRate),
        fmtNum(row.tokens_prompt + row.tokens_completion, currency),
        fmtNum(row.generation_time_ms, currency),
        row.finish_reason_normalized,
      ];
      vals.forEach((v, i) => doc.text(v, colX[i], y));
      y += 5;
    }

    doc.save(`openrouter-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [currency, exchangeRate]);

  return { exportPNG, exportPDF };
}
