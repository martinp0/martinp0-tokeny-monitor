import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const MCP_SERVER_NAME = "tokeny";
const TOKEN_PLACEHOLDER = "<TOKEN>";

function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-start gap-2 rounded-lg bg-secondary/40 px-2.5 py-1.5">
        {multiline ? (
          <pre className="flex-1 overflow-x-auto whitespace-pre-wrap break-words text-xs font-mono">{value}</pre>
        ) : (
          <code className="flex-1 truncate text-xs font-mono">{value}</code>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label={t("mcpClients.copy", { what: label })}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success(t("mcpClients.copied"));
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ClientCard({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="surface glass-hover rounded-xl p-4 space-y-3" aria-label={title}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {title}
        {badge && <span className="glass-pill px-2 py-0.5 text-[10px] font-medium text-primary">{badge}</span>}
      </h3>
      {children}
    </section>
  );
}

/** Per-client setup instructions for the Tokeny MCP server (static Bearer header, no OAuth). */
export function McpClientGuides({ url }: { url: string }) {
  const { t } = useTranslation();
  const bearer = `Bearer ${TOKEN_PLACEHOLDER}`;
  const grokPrompt = t("mcpClients.grok.prompt", { name: MCP_SERVER_NAME, url });
  const cursorJson = JSON.stringify(
    { mcpServers: { [MCP_SERVER_NAME]: { url, headers: { Authorization: bearer } } } },
    null,
    2,
  );
  const claudeDesktopJson = JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          command: "npx",
          args: ["-y", "mcp-remote", url, "--header", "Authorization:${TOKENY_AUTH}"],
          env: { TOKENY_AUTH: bearer },
        },
      },
    },
    null,
    2,
  );
  const claudeCode = `claude mcp add --transport http ${MCP_SERVER_NAME} ${url} --header "Authorization: ${bearer}"`;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("mcpClients.intro", { token: TOKEN_PLACEHOLDER })}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ClientCard title="Grok Bot" badge={t("mcpClients.new")}>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            <li>{t("mcpClients.grok.step1")}</li>
            <li>{t("mcpClients.grok.step2")}</li>
            <li>{t("mcpClients.grok.step3")}</li>
          </ol>
          <CopyField label={t("mcpClients.grok.promptLabel")} value={grokPrompt} multiline />
          <details className="text-xs">
            <summary className="cursor-pointer font-medium">{t("mcpClients.grok.manual")}</summary>
            <div className="mt-2 space-y-2">
              <CopyField label={t("mcpClients.fields.name")} value={MCP_SERVER_NAME} />
              <CopyField label={t("mcpClients.fields.url")} value={url} />
              <CopyField label={t("mcpClients.fields.headerName")} value="Authorization" />
              <CopyField label={t("mcpClients.fields.headerValue")} value={bearer} />
            </div>
          </details>
          <p className="text-[11px] text-muted-foreground">{t("mcpClients.grok.note")}</p>
        </ClientCard>

        <ClientCard title="Cursor">
          <p className="text-xs text-muted-foreground">{t("mcpClients.cursor.hint")}</p>
          <CopyField label="mcp.json" value={cursorJson} multiline />
        </ClientCard>

        <ClientCard title="Claude Code">
          <p className="text-xs text-muted-foreground">{t("mcpClients.claudeCode.hint")}</p>
          <CopyField label={t("mcpClients.fields.command")} value={claudeCode} multiline />
        </ClientCard>

        <ClientCard title="Claude Desktop">
          <p className="text-xs text-muted-foreground">{t("mcpClients.claudeDesktop.hint")}</p>
          <CopyField label="claude_desktop_config.json" value={claudeDesktopJson} multiline />
        </ClientCard>
      </div>
    </div>
  );
}
