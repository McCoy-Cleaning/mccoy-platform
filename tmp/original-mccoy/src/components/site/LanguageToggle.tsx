import { useI18n, type Lang } from "@/lib/i18n";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const langs: Lang[] = ["nl", "en"];
  const activeIndex = langs.indexOf(lang);
  return (
    <div
      translate="no"
      className={`relative inline-flex items-center rounded-full border border-white/15 bg-white/5 p-1 ${className}`}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 w-9 rounded-full bg-primary transition-transform duration-200 ease-out"
        style={{ transform: `translate3d(${activeIndex * 36}px, 0, 0)` }}
      />
      {langs.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          translate="no"
          className="notranslate relative z-10 h-7 w-9 text-xs font-semibold uppercase tracking-wider"
          aria-label={l === "nl" ? "Nederlands" : "English"}
          lang={l}
        >
          <span
            translate="no"
            aria-hidden="true"
            data-label={l.toUpperCase()}
            className={`relative ${lang === l ? "text-primary-foreground" : "text-white/70 hover:text-white"}`}
          />
        </button>
      ))}
    </div>
  );
}
