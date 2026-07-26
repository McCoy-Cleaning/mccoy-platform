import * as React from "react";
import { cn } from "@/lib/utils";
import { Upload, Trash2 } from "lucide-react";

export function InlineText({
  value,
  onChange,
  as = "div",
  className,
  placeholder,
  multiline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const Tag = as as any;

  React.useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value]);

  return (
    <Tag
      ref={ref as any}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const v = e.currentTarget.innerText.trim();
        if (v !== value) onChange(v);
      }}
      className={cn(
        "outline-none rounded-md -mx-1 px-1 transition",
        "hover:bg-white/5 focus:bg-white/10 focus:ring-2 focus:ring-[#1e88e5]/40",
        "empty:before:content-[attr(data-placeholder)] empty:before:text-white/30",
        className,
      )}
    />
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImageEdit({
  src,
  onChange,
  className,
  aspect = "aspect-[4/3]",
  alt = "",
}: {
  src?: string;
  onChange: (v: string) => void;
  className?: string;
  aspect?: string;
  alt?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const handle = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      alert("Afbeelding is groter dan 2MB. Kies een kleinere.");
      return;
    }
    setBusy(true);
    try {
      const url = await fileToDataUrl(f);
      onChange(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/5",
        aspect,
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        handle(e.dataTransfer.files?.[0]);
      }}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-white/50">
          <Upload className="h-5 w-5" />
          <span>Klik of sleep afbeelding</span>
          <span className="text-[10px] text-white/30">max 2MB</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-black/50 backdrop-blur-sm transition"
        aria-label="Afbeelding vervangen"
      >
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-medium text-white">
          <Upload className="h-3.5 w-3.5" />
          {busy ? "Bezig..." : src ? "Vervangen" : "Uploaden"}
        </span>
      </button>
      {src && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
          }}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border border-white/20 bg-black/60 text-white/80 opacity-0 transition hover:text-red-300 group-hover:opacity-100"
          aria-label="Afbeelding verwijderen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  );
}