import * as React from "react";

function fileIdentity(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
}

export function mergeSelectedFormFiles(current: File[], selected: File[]): File[] {
  const seen = new Set<string>();
  const merged: File[] = [];
  for (const file of [...current, ...selected]) {
    if (file.size <= 0) continue;
    const identity = fileIdentity(file);
    if (seen.has(identity)) continue;
    seen.add(identity);
    merged.push(file);
  }
  return merged;
}

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(file: File): string {
  const extension = file.name.split(".").pop()?.trim().toUpperCase();
  return extension?.slice(0, 6) || "BESTAND";
}

export function FormFileUploadField({
  id,
  name,
  files,
  onFilesChange,
  disabled = false,
  required = false,
  accept = "image/*,application/pdf,.doc,.docx",
  inputClassName,
}: {
  id: string;
  name: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  required?: boolean;
  accept?: string;
  inputClassName: string;
}) {
  const [previewUrls, setPreviewUrls] = React.useState<Map<File, string>>(new Map());

  React.useEffect(() => {
    const next = new Map<File, string>();
    for (const file of files) {
      if (file.type.toLowerCase().startsWith("image/")) {
        next.set(file, URL.createObjectURL(file));
      }
    }
    setPreviewUrls(next);
    return () => {
      for (const url of next.values()) URL.revokeObjectURL(url);
    };
  }, [files]);

  return (
    <>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple
        required={required}
        disabled={disabled}
        className={inputClassName}
        onChange={(event) => {
          const selected = Array.from(event.currentTarget.files ?? []);
          if (selected.length > 0) {
            onFilesChange(mergeSelectedFormFiles(files, selected));
          }
          // The selected File objects live in React state. Clearing the native
          // control lets a user select the same file again after removing it.
          event.currentTarget.value = "";
        }}
      />
      {files.length > 0 ? (
        <ul
          className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
          aria-label="Geselecteerde bestanden"
          data-testid="form-file-previews"
        >
          {files.map((file, index) => {
            const previewUrl = previewUrls.get(file);
            return (
              <li
                key={`${fileIdentity(file)}:${index}`}
                className="relative min-w-0 overflow-hidden rounded-xl border border-border bg-background/60"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`Voorbeeld van ${file.name}`}
                    className="h-24 w-full bg-black/20 object-cover"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-black/20 px-2 text-center text-[11px] font-semibold text-muted-foreground">
                    {fileTypeLabel(file)}
                  </div>
                )}
                <div className="min-w-0 px-2 pb-2 pt-1.5 pr-8">
                  <p className="truncate text-[11px] text-foreground" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{fileSizeLabel(file.size)}</p>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}
                  className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/75 text-base leading-none text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                  aria-label={`Verwijder ${file.name}`}
                >
                  <span aria-hidden>×</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
