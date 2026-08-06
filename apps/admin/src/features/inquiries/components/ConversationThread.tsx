import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormInboxThreadItem } from "@mccoy/email/contracts";
import { formatWhen } from "../lib/format";
import { AttachmentsBlock } from "./AttachmentsBlock";

export function ConversationThread({
  thread,
  rootId,
  hideRoot,
}: {
  thread: FormInboxThreadItem[];
  rootId: string;
  /** When structured fields are shown above, omit the form root to avoid duplication. */
  hideRoot: boolean;
}) {
  const items = thread.filter((item) => {
    if (item.direction === "form") return false;
    if (hideRoot && item.id === rootId) return false;
    return true;
  });

  const directionLabel: Record<FormInboxThreadItem["direction"], string> = {
    form: "Websiteformulier",
    customer: "Klant",
    admin: "McCoy",
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0c1220]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
        <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
          <MessageSquare className="h-4 w-4 text-white/50" />
          Gesprek
        </h3>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-white/50">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="px-6 py-8 text-sm leading-relaxed text-white/45">
          Nog geen antwoorden in dit gesprek. Zodra u een bericht verstuurt, verschijnt het hier.
        </div>
      ) : (
        <ol className="space-y-0 divide-y divide-white/10 px-3 py-3">
          {items.map((item) => {
            const isAdmin = item.direction === "admin";
            const isCustomer = item.direction === "customer";
            return (
              <li key={item.id} className="px-3 py-3">
                <article
                  className={cn(
                    "rounded-xl border px-4 py-3.5",
                    isAdmin && "border-[#1e88e5]/25 bg-[#1e88e5]/10",
                    isCustomer && "border-emerald-500/20 bg-emerald-500/10",
                    !isAdmin && !isCustomer && "border-white/10 bg-black/20",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                          isAdmin && "bg-[#1e88e5]/20 text-[#90caf9]",
                          isCustomer && "bg-emerald-500/20 text-emerald-200",
                          !isAdmin && !isCustomer && "bg-white/10 text-white/70",
                        )}
                      >
                        {directionLabel[item.direction]}
                      </span>
                      <span className="truncate text-xs text-white/40">
                        {isAdmin ? `naar ${item.to}` : item.from}
                      </span>
                    </div>
                    <time className="text-xs text-white/40">{formatWhen(item.date)}</time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/90">
                    {item.textBody || "(geen tekst)"}
                  </p>
                  {item.attachments.length > 0 && (
                    <div className="mt-3">
                      <AttachmentsBlock messageId={item.id} attachments={item.attachments} />
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
