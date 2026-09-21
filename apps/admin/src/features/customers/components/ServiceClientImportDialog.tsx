import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";

import { AppDialog } from "@/components/admin/AppDialog";
import { Button } from "@/components/ui/button";
import { importAdminExistingServiceClients } from "@/lib/api/admin-customers.functions";

type ServicePreview = {
  fileName: string;
  sheetName: string | null;
  headers: string[];
  sheetNames: string[];
  totalRows: number;
  counts: {
    new: number;
    update: number;
    unchanged: number;
    invalid: number;
    conflict: number;
  };
  inviteCounts: {
    willInvite: number;
    missingEmail: number;
    skippedNotNew: number;
  };
  importableCount: number;
  rows: Array<{
    sourceRowNumber: number;
    externalCustomerId: string | null;
    companyName: string | null;
    classification: string;
    reason: string | null;
    autoInvitePlan: string;
  }>;
};

function classificationLabelNl(c: string): string {
  if (c === "NEW") return "Nieuw";
  if (c === "UPDATE") return "Bijwerken";
  if (c === "UNCHANGED") return "Ongewijzigd";
  if (c === "INVALID") return "Ongeldig";
  if (c === "CONFLICT") return "Conflict";
  return c;
}

function autoInviteLabelNl(plan: string): string {
  if (plan === "will_invite") return "Uitnodiging Account Admin";
  if (plan === "missing_email") return "Geen e-mail (geen uitnodiging)";
  return "Geen auto-uitnodiging";
}

export function ServiceClientImportDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [preview, setPreview] = useState<ServicePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mapId, setMapId] = useState("");
  const [mapName, setMapName] = useState("");

  useEffect(() => {
    if (!open) {
      setFileName(null);
      setFileBase64(null);
      setSheetName("");
      setPreview(null);
      setError(null);
      setMapId("");
      setMapName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  async function readFile(file: File) {
    setError(null);
    setPreview(null);
    if (file.size > 2_000_000) {
      setError("Bestand te groot (max 2 MB).");
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx") && !lower.endsWith(".txt")) {
      setError("Alleen .csv of .xlsx wordt ondersteund.");
      return;
    }
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    const b64 = btoa(binary);
    setFileName(file.name);
    setFileBase64(b64);
  }

  async function runPreview(nextSheet?: string) {
    if (!fileName || !fileBase64) {
      setError("Kies eerst een bestand.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await importAdminExistingServiceClients({
      data: {
        fileName,
        fileBase64,
        commit: false,
        sheetName: (nextSheet ?? sheetName) || null,
        columnMap: {
          ...(mapId.trim() ? { externalCustomerId: mapId.trim() } : {}),
          ...(mapName.trim() ? { legalName: mapName.trim() } : {}),
        },
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setPreview(null);
      return;
    }
    if (res.mode === "preview") {
      setPreview(res.preview as ServicePreview);
      if (!sheetName && res.preview.sheetName) setSheetName(res.preview.sheetName);
    }
  }

  async function runCommit() {
    if (!fileName || !fileBase64) return;
    setBusy(true);
    setError(null);
    const res = await importAdminExistingServiceClients({
      data: {
        fileName,
        fileBase64,
        commit: true,
        sheetName: sheetName || null,
        columnMap: {
          ...(mapId.trim() ? { externalCustomerId: mapId.trim() } : {}),
          ...(mapName.trim() ? { legalName: mapName.trim() } : {}),
        },
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.mode === "commit") {
      onDone(
        `Serviceklanten import: ${res.mirrored} naar mirror, sync ${res.sync.created} nieuw / ${res.sync.updated} bijgewerkt. Uitnodigingen: ${res.invites.sent} verstuurd / ${res.invites.skipped} overgeslagen / ${res.invites.failed} mislukt. Ongeldig ${res.skippedInvalid}, conflict ${res.skippedConflict}.`,
      );
    }
  }

  const problemRows =
    preview?.rows.filter(
      (r) => r.classification === "INVALID" || r.classification === "CONFLICT",
    ) ?? [];

  return (
    <AppDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Serviceklanten importeren"
      description="CSV of Excel â†’ voorvertoning â†’ mirror â†’ sync. Vul Klantsoort in (bedrijf of particulier). Nieuwe rijen met e-mail krijgen automatisch Ã©Ã©n Account Admin-uitnodiging. Identiteit = klantnummer."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Annuleren
          </Button>
          {!preview ? (
            <Button
              type="button"
              loading={busy}
              onClick={() => void runPreview()}
              disabled={!fileBase64}
            >
              Voorvertoning
            </Button>
          ) : (
            <Button
              type="button"
              loading={busy}
              onClick={() => void runCommit()}
              disabled={preview.importableCount === 0}
            >
              Importeer geldige rijen ({preview.importableCount})
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3 text-sm text-white/80">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-medium text-white/90">Sjabloon CSV</p>
          <p className="mt-1 text-xs text-white/55">
            Download het sjabloon, vul bestaande klanten in en let op{" "}
            <span className="text-white/80">Klantsoort</span> (
            <code className="text-white/75">bedrijf</code> of{" "}
            <code className="text-white/75">particulier</code>). Bij particulier is Bedrijfsnaam de
            volledige persoonsnaam; KVK/BTW meestal leeg.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={busy}
            onClick={() => {
              const csv = `\uFEFFKlantnummer,Klantsoort,Bedrijfsnaam,Handelsnaam,E-mail,Telefoon,Contactpersoon,KVK,BTW,Straat,Huisnummer,Toevoeging,Postcode,Plaats,Land,Factuur toegestaan
10482,bedrijf,ABC Facility BV,ABC Facility,info@abc.example,0612345678,Jan de Vries,12345678,NL123456789B01,Hoofdstraat,12,a,1234 AB,Amsterdam,NL,nee
10483,particulier,Maria Jansen,,maria@example.com,0687654321,,,,,,,Hoofdstraat,1,,1000 AA,Amsterdam,NL,nee
`;
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "mccoy-serviceklanten-import-sjabloon.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Sjabloon downloaden
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
          }}
        />

        <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.04] p-4">
          <p className="text-sm font-medium text-white/90">Stap 1 — Bestand uploaden</p>
          <p className="mt-1 text-xs text-white/55">
            Klik op de knop hieronder om een .csv of .xlsx van je computer te kiezen.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" aria-hidden />
              Bestand kiezen
            </Button>
            {fileName ? (
              <span className="text-xs text-emerald-300/90">Geselecteerd: {fileName}</span>
            ) : (
              <span className="text-xs text-white/45">Nog geen bestand gekozen</span>
            )}
          </div>
        </div>

        {preview && preview.sheetNames.length > 1 ? (
          <label className="block">
            Werkblad
            <select
              className="a-input mt-1 w-full"
              value={sheetName}
              onChange={(e) => {
                setSheetName(e.target.value);
                void runPreview(e.target.value);
              }}
            >
              {preview.sheetNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs">
            Kolom klantnummer (optioneel)
            <select
              className="a-input mt-1 w-full"
              value={mapId}
              onChange={(e) => setMapId(e.target.value)}
            >
              <option value="">Automatisch (bekende aliassen)</option>
              {(preview?.headers ?? []).map((h) => (
                <option key={`id-${h}`} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            Kolom bedrijfsnaam (optioneel)
            <select
              className="a-input mt-1 w-full"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
            >
              <option value="">Automatisch (bekende aliassen)</option>
              {(preview?.headers ?? []).map((h) => (
                <option key={`name-${h}`} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        </div>
        {preview && (mapId || mapName) ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={busy}
            onClick={() => void runPreview()}
          >
            Opnieuw classificeren
          </Button>
        ) : null}

        {preview ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
            <p>
              Rijen: {preview.totalRows} Â· Nieuw: {preview.counts.new} Â· Bijwerken:{" "}
              {preview.counts.update} Â· Ongewijzigd: {preview.counts.unchanged} Â· Ongeldig:{" "}
              {preview.counts.invalid} Â· Conflict: {preview.counts.conflict}
            </p>
            <p className="mt-1">
              Auto-uitnodiging Account Admin: {preview.inviteCounts.willInvite} Â· Zonder e-mail:{" "}
              {preview.inviteCounts.missingEmail} Â· Niet van toepassing:{" "}
              {preview.inviteCounts.skippedNotNew}
            </p>
            <p className="mt-1 text-white/50">
              Ongeldige en conflictregels worden nooit opgeslagen. Bijwerken stuurt geen nieuwe
              uitnodiging. Annuleren na voorvertoning wijzigt niets.
            </p>
          </div>
        ) : null}

        {problemRows.length ? (
          <div className="max-h-40 overflow-auto rounded-xl border border-red-500/20 bg-red-500/5 p-2 text-xs">
            {problemRows.slice(0, 40).map((r) => (
              <p key={`${r.sourceRowNumber}-${r.externalCustomerId ?? ""}`} className="py-0.5">
                Rij {r.sourceRowNumber}: {classificationLabelNl(r.classification)} —{" "}
                {r.externalCustomerId ?? "(geen ID)"} / {r.companyName ?? "—"} — {r.reason}
              </p>
            ))}
          </div>
        ) : null}

        {preview?.rows.some((r) => r.classification === "NEW") ? (
          <div className="max-h-32 overflow-auto rounded-xl border border-white/10 bg-white/[0.02] p-2 text-xs text-white/70">
            {preview.rows
              .filter((r) => r.classification === "NEW")
              .slice(0, 30)
              .map((r) => (
                <p
                  key={`invite-${r.sourceRowNumber}-${r.externalCustomerId ?? ""}`}
                  className="py-0.5"
                >
                  Rij {r.sourceRowNumber}: {r.companyName ?? "—"} —{" "}
                  {autoInviteLabelNl(r.autoInvitePlan)}
                </p>
              ))}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </AppDialog>
  );
}
