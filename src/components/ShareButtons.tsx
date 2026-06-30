import { Button } from "@/components/ui/button";
import { Link2, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ShareButtonsProps {
  url: string;
  title: string;
}

export default function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const links = [
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      svg: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2H21.5l-7.69 8.79L23 22h-7.04l-5.5-7.19L4.16 22H.9l8.24-9.42L1 2h7.2l4.98 6.59L18.244 2Zm-1.23 18h1.9L7.06 4H5.05l11.964 16Z" />
        </svg>
      ),
    },
    {
      name: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      svg: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.62 0 4.29 2.38 4.29 5.48v6.26ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
        </svg>
      ),
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      svg: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.92.26-1.55 1.58-1.55h1.68V4.27c-.29-.04-1.29-.13-2.46-.13-2.43 0-4.1 1.49-4.1 4.21v2.45H7.5V14h2.7v8h3.3Z" />
        </svg>
      ),
    },
    {
      name: "Reddit",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      svg: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M22 12.07c0-1.18-.96-2.13-2.14-2.13-.58 0-1.1.23-1.49.61-1.46-1-3.42-1.65-5.6-1.73l.97-4.36 3.06.65a1.52 1.52 0 1 0 .14-.91l-3.4-.72a.45.45 0 0 0-.53.34l-1.07 4.83c-2.2.07-4.2.72-5.68 1.73a2.12 2.12 0 0 0-1.5-.61C3.6 9.94 2.64 10.89 2.64 12.07c0 .82.47 1.53 1.16 1.88-.04.22-.06.45-.06.68 0 2.85 3.32 5.16 7.4 5.16s7.4-2.31 7.4-5.16c0-.23-.02-.45-.06-.67.7-.35 1.18-1.06 1.18-1.89ZM7.46 13.5c0-.7.57-1.27 1.27-1.27.7 0 1.27.57 1.27 1.27 0 .7-.57 1.27-1.27 1.27-.7 0-1.27-.57-1.27-1.27Zm7.1 3.55c-.87.87-2.55.94-3.04.94s-2.17-.07-3.04-.94a.33.33 0 1 1 .47-.47c.55.55 1.73.75 2.57.75s2.02-.2 2.57-.75a.33.33 0 1 1 .47.47Zm-.27-2.28c-.7 0-1.27-.57-1.27-1.27 0-.7.57-1.27 1.27-1.27.7 0 1.27.57 1.27 1.27 0 .7-.57 1.27-1.27 1.27Z" />
        </svg>
      ),
    },
  ];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Odkaz zkopírován");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Nepodařilo se zkopírovat");
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-mono text-muted-foreground mr-1">Sdílet:</span>
      {links.map((l) => (
        <Button
          key={l.name}
          asChild
          variant="outline"
          size="icon"
          className="h-9 w-9 hover:text-primary hover:border-primary/50"
          aria-label={`Sdílet na ${l.name}`}
        >
          <a href={l.href} target="_blank" rel="noopener noreferrer">{l.svg}</a>
        </Button>
      ))}
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 hover:text-primary hover:border-primary/50"
        onClick={copyLink}
        aria-label="Kopírovat odkaz"
      >
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}
