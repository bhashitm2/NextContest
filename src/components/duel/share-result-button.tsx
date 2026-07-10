"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Share a finished duel: native share sheet when available, else copy the
 * link. The duel page is publicly viewable once FINISHED, so the link works
 * for anyone. */
export function ShareResultButton({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // dismissed or unsupported payload — fall through to copy
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Button variant="outline" onClick={share}>
      {copied ? <Check data-icon="inline-start" /> : <Share2 data-icon="inline-start" />}
      {copied ? "Link copied" : "Share result"}
    </Button>
  );
}
