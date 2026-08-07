import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import {
  Settings,
  User,
  Mail,
  KeyRound,
  Shield,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Users,
  Globe2,
  Inbox,
  ArrowUpRight,
  UserPlus,
  Trash2,
  Bell,
  Monitor,
  LifeBuoy,
} from "lucide-react";

import { PageHeader } from "@/components/admin/AdminBits";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { StaffAuthenticatorReplacePanel } from "@/components/admin/StaffAuthenticatorReplacePanel";
import { Switch } from "@/components/ui/switch";
import { useAdminSession } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";
import { inviteAdminFn, recoverStaffAccountFn } from "@/lib/api/staff-identity.functions";
import {
  changeStaffEmailFn,
  changeStaffPasswordFn,
  changeStaffRoleFn,
  getStaffSettingsProfileFn,
  getSuperAdminSettingsOverviewFn,
  removeStaffMemberFn,
  updateStaffProfileFn,
} from "@/lib/api/staff-settings.functions";
import {
  listAdminNotificationPreferences,
  updateAdminNotificationPreference,
} from "@/lib/api/notifications.functions";
import type { AdminNotificationPreference } from "@/lib/notifications/types";
import type { StaffSettingsProfile, SuperAdminSettingsOverview } from "@mccoy/database/server";
import type { ActiveNotificationType } from "@mccoy/notifications";
import { staffPasswordStrengthError } from "@mccoy/domain";
import { appConfirm } from "@/lib/app-dialogs";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

type FormState = "idle" | "saving" | "success" | "error";

function roleLabel(role: string | null | undefined): string {
  if (role === "super_admin") return "Super admin";
  if (role === "admin") return "Admin";
  return role ?? "—";
}

/** Dutch copy for implemented (active) notification types only — see @mccoy/notifications registry. */
const NOTIFICATION_TYPE_COPY: Record<ActiveNotificationType, { label: string; description: string }> = {
  "website_request.received": {
    label: "Nieuwe aanvraag",
    description: "Een nieuwe website-aanvraag (contact, offerte, sollicitatie) komt binnen.",
  },
  "website_request.reply_failed": {
    label: "Antwoord versturen mislukt",
    description: "Een antwoord op een aanvraag kon niet worden verzonden.",
  },
  "website_request.applicant_replied": {
    label: "Reactie op e-mail",
    description: "Een aanvrager heeft geantwoord op een e-mail vanuit Aanvragen.",
  },
  "cms.publish_failed": {
    label: "Publiceren mislukt",
    description: "Het publiceren van een website-pagina is mislukt.",
  },
  "cms.publish_succeeded": {
    label: "Publiceren gelukt",
    description: "Een website-pagina is succesvol gepubliceerd.",
  },
  "mailbox.connection_failed": {
    label: "Postvak-verbinding verbroken",
    description: "De koppeling met de Aanvragen-mailbox werkt niet meer.",
  },
  "mailbox.connection_restored": {
    label: "Postvak-verbinding hersteld",
    description: "De koppeling met de Aanvragen-mailbox werkt weer.",
  },
  "system.warning": {
    label: "Systeemwaarschuwing",
    description: "Een algemene systeemwaarschuwing die aandacht vereist.",
  },
};

function statusLabel(status: string): string {
  if (status === "active") return "Actief";
  if (status === "invited") return "Uitgenodigd";
  if (status === "blocked") return "Geblokkeerd";
  return status;
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function SettingsPage() {
  const navigate = useNavigate();
  const { session } = useAdminSession();
  const isSuperAdmin = session?.staffRole === "super_admin";

  const [profile, setProfile] = React.useState<StaffSettingsProfile | null>(null);
  const [loadState, setLoadState] = React.useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [fullName, setFullName] = React.useState("");
  const [profileState, setProfileState] = React.useState<FormState>("idle");
  const [profileMessage, setProfileMessage] = React.useState<string | null>(null);

  const [newEmail, setNewEmail] = React.useState("");
  const [emailState, setEmailState] = React.useState<FormState>("idle");
  const [emailMessage, setEmailMessage] = React.useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordTotp, setPasswordTotp] = React.useState("");
  const [passwordState, setPasswordState] = React.useState<FormState>("idle");
  const [passwordMessage, setPasswordMessage] = React.useState<string | null>(null);

  const [overview, setOverview] = React.useState<SuperAdminSettingsOverview | null>(null);
  const [overviewState, setOverviewState] = React.useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [overviewError, setOverviewError] = React.useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteName, setInviteName] = React.useState("");
  const [inviteState, setInviteState] = React.useState<FormState>("idle");
  const [inviteMessage, setInviteMessage] = React.useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = React.useState<string | null>(null);
  const [removeMessage, setRemoveMessage] = React.useState<string | null>(null);
  const [roleChangingUserId, setRoleChangingUserId] = React.useState<string | null>(null);
  const [recoveringUserId, setRecoveringUserId] = React.useState<string | null>(null);

  const [preferences, setPreferences] = React.useState<AdminNotificationPreference[]>([]);
  const [prefState, setPrefState] = React.useState<"loading" | "ready" | "error">("loading");
  const [prefError, setPrefError] = React.useState<string | null>(null);
  const [pendingToggleKey, setPendingToggleKey] = React.useState<string | null>(null);

  const loadProfile = React.useEffectEvent(async () => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const result = await getStaffSettingsProfileFn();
      if (!result.ok) {
        setLoadState("error");
        setLoadError(result.error);
        return;
      }
      setProfile(result.data);
      setFullName(result.data.fullName ?? "");
      setNewEmail(result.data.email);
      setLoadState("ready");
    } catch {
      setLoadState("error");
      setLoadError("Profiel kon niet worden geladen.");
    }
  });

  const loadOverview = React.useEffectEvent(async () => {
    if (!isSuperAdmin) return;
    setOverviewState("loading");
    setOverviewError(null);
    try {
      const result = await getSuperAdminSettingsOverviewFn();
      if (!result.ok) {
        setOverviewState("error");
        setOverviewError(result.error);
        return;
      }
      setOverview(result.data);
      setOverviewState("ready");
    } catch {
      setOverviewState("error");
      setOverviewError("Overzicht kon niet worden geladen.");
    }
  });

  const loadPreferences = React.useEffectEvent(async () => {
    setPrefState("loading");
    setPrefError(null);
    try {
      const result = await listAdminNotificationPreferences();
      if (!result.ok) {
        setPrefState("error");
        setPrefError(result.error);
        return;
      }
      setPreferences(result.preferences);
      setPrefState("ready");
    } catch {
      setPrefState("error");
      setPrefError("Meldingsvoorkeuren konden niet worden geladen.");
    }
  });

  React.useEffect(() => {
    void loadProfile();
    void loadPreferences();
  }, []);

  React.useEffect(() => {
    if (isSuperAdmin) void loadOverview();
  }, [isSuperAdmin]);

  async function onTogglePreference(
    type: ActiveNotificationType,
    channel: "in_app" | "browser",
    nextEnabled: boolean,
  ) {
    const key = `${type}:${channel}`;
    const previous = preferences;
    setPendingToggleKey(key);
    setPrefError(null);
    setPreferences((prev) =>
      prev.map((p) =>
        p.type === type
          ? {
              ...p,
              ...(channel === "in_app"
                ? { inAppEnabled: nextEnabled }
                : { browserEnabled: nextEnabled }),
            }
          : p,
      ),
    );
    try {
      const result = await updateAdminNotificationPreference({
        data: { type, channel, enabled: nextEnabled },
      });
      if (!result.ok) {
        setPreferences(previous);
        setPrefError(result.error);
      }
    } catch {
      setPreferences(previous);
      setPrefError("Voorkeur opslaan mislukt. Probeer het opnieuw.");
    } finally {
      setPendingToggleKey(null);
    }
  }

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileState("saving");
    setProfileMessage(null);
    try {
      const result = await updateStaffProfileFn({ data: { fullName } });
      if (!result.ok) {
        setProfileState("error");
        setProfileMessage(result.error);
        return;
      }
      setProfile(result.data);
      setFullName(result.data.fullName ?? "");
      setProfileState("success");
      setProfileMessage("Naam bijgewerkt.");
    } catch {
      setProfileState("error");
      setProfileMessage("Opslaan mislukt. Probeer het opnieuw.");
    }
  }

  async function onChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailState("saving");
    setEmailMessage(null);
    try {
      const result = await changeStaffEmailFn({ data: { newEmail } });
      if (!result.ok) {
        setEmailState("error");
        setEmailMessage(result.error);
        return;
      }
      setEmailState("success");
      setEmailMessage(
        `Bevestigingsmail verzonden naar ${result.data.pendingEmail}. Je huidige e-mail blijft actief tot je de link bevestigt; daarna synchroniseert het profiel automatisch.`,
      );
    } catch {
      setEmailState("error");
      setEmailMessage("E-mailwijziging mislukt. Probeer het opnieuw.");
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordState("saving");
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordState("error");
      setPasswordMessage("Nieuwe wachtwoorden komen niet overeen.");
      return;
    }
    const passwordError = staffPasswordStrengthError(newPassword);
    if (passwordError) {
      setPasswordState("error");
      setPasswordMessage(passwordError);
      return;
    }
    if (!/^\d{6}$/.test(passwordTotp.trim())) {
      setPasswordState("error");
      setPasswordMessage("Voer de 6-cijferige MFA-code in.");
      return;
    }
    try {
      const result = await changeStaffPasswordFn({
        data: {
          currentPassword,
          newPassword,
          totpCode: passwordTotp.trim(),
        },
      });
      if (!result.ok) {
        setPasswordState("error");
        setPasswordMessage(result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordTotp("");
      setPasswordState("success");
      setPasswordMessage("Wachtwoord bijgewerkt. Je blijft ingelogd met deze sessie.");
    } catch {
      setPasswordState("error");
      setPasswordMessage("Wachtwoord wijzigen mislukt. Probeer het opnieuw.");
    }
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteState("saving");
    setInviteMessage(null);
    try {
      const result = await inviteAdminFn({
        data: {
          email: inviteEmail,
          fullName: inviteName.trim() || undefined,
          acceptOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (!result.ok) {
        setInviteState("error");
        setInviteMessage(result.error);
        return;
      }
      setInviteEmail("");
      setInviteName("");
      const reinstateHint = "reinstated" in result && result.reinstated
        ? " Geblokkeerd account hersteld; 2FA moet opnieuw worden ingesteld. Profiel en rol blijven behouden."
        : "";
      if ("emailDelivered" in result && result.emailDelivered === false) {
        setInviteState("error");
        const link =
          "inviteUrl" in result && typeof result.inviteUrl === "string" && result.inviteUrl
            ? result.inviteUrl
            : null;
        const providerDetail =
          "emailError" in result && typeof result.emailError === "string" && result.emailError
            ? `\n\nTechnische details: ${result.emailError}`
            : "";
        setInviteMessage(
          [
            "Gebruiker aangemaakt, maar de uitnodigingsmail is niet verzonden. Controleer Graph Mail.Send / SMTP en de map Verzonden items van GRAPH_MAILBOX.",
            providerDetail.trim(),
            link
              ? "Gebruik deze eenmalige link (niet doorsturen via chat die de URL inkort). De link moet naar https://…/admin/invite gaan — niet naar supabase.co:"
              : "Probeer later opnieuw, of controleer de e-mailconfiguratie op de server.",
            link,
            reinstateHint.trim(),
          ]
            .filter(Boolean)
            .join("\n\n"),
        );
      } else {
        setInviteState("success");
        const deliveryHint =
          result.delivery === "graph"
            ? "Uitnodiging verzonden via Microsoft Graph. Controleer de inbox van de uitgenodigde (en spam). In GRAPH_MAILBOX staat een kopie onder Verzonden items."
            : result.delivery === "smtp"
              ? "Uitnodiging verzonden via SMTP."
              : "Gebruiker toegevoegd. Deel de uitnodigingslink handmatig.";
        setInviteMessage(deliveryHint + reinstateHint);
      }
      void loadOverview();
    } catch {
      setInviteState("error");
      setInviteMessage("Uitnodigen mislukt. Probeer het opnieuw.");
    }
  }

  async function onRemoveStaff(userId: string, label: string) {
    const confirmed = await appConfirm({
      title: "Medewerker verwijderen?",
      description: `${label}\n\nDit blokkeert het account en verwijdert het uit de actieve lijst. Geschiedenis blijft bewaard.`,
      confirmLabel: "Verwijderen",
      tone: "destructive",
    });
    if (!confirmed) return;

    setRemovingUserId(userId);
    setRemoveMessage(null);
    try {
      const result = await removeStaffMemberFn({ data: { targetUserId: userId } });
      if (!result.ok) {
        setRemoveMessage(result.error);
        return;
      }
      setRemoveMessage("Medewerker verwijderd uit de actieve lijst.");
      void loadOverview();
    } catch {
      setRemoveMessage("Verwijderen mislukt. Probeer het opnieuw.");
    } finally {
      setRemovingUserId(null);
    }
  }

  async function onChangeStaffRole(
    userId: string,
    label: string,
    nextRole: "admin" | "super_admin",
  ) {
    const promote = nextRole === "super_admin";
    const confirmed = await appConfirm({
      title: promote ? "Super admin-rechten geven?" : "Degraderen naar admin?",
      description: promote
        ? `${label}\n\nDeze medewerker krijgt dezelfde super_admin-rechten als jij (uitnodigen, verwijderen, rollen wijzigen).`
        : `${label}\n\nDeze medewerker wordt een gewone admin en verliest super_admin-rechten.`,
      confirmLabel: promote ? "Maak super admin" : "Degradeer",
      tone: promote ? "warning" : "destructive",
    });
    if (!confirmed) return;

    setRoleChangingUserId(userId);
    setRemoveMessage(null);
    try {
      const result = await changeStaffRoleFn({
        data: { targetUserId: userId, staffRole: nextRole },
      });
      if (!result.ok) {
        setRemoveMessage(result.error);
        return;
      }
      setRemoveMessage(
        promote
          ? "Medewerker is nu super admin."
          : "Medewerker is gedegradeerd naar admin.",
      );
      void loadOverview();
    } catch {
      setRemoveMessage("Rol wijzigen mislukt. Probeer het opnieuw.");
    } finally {
      setRoleChangingUserId(null);
    }
  }

  async function onRecoverStaffAccount(userId: string, label: string) {
    const confirmed = await appConfirm({
      title: "Account herstellen?",
      description: `${label}\n\nMFA wordt gereset en alle sessies worden uitgelogd. De medewerker ontvangt een e-mail met een activatielink om wachtwoord te bevestigen en een nieuwe authenticator QR-code in te stellen. Profiel, rol en geschiedenis blijven behouden.`,
      confirmLabel: "Herstel account",
      tone: "warning",
    });
    if (!confirmed) return;

    setRecoveringUserId(userId);
    setRemoveMessage(null);
    try {
      const result = await recoverStaffAccountFn({
        data: {
          targetUserId: userId,
          acceptOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (!result.ok) {
        setRemoveMessage(result.error);
        return;
      }
      if (result.emailDelivered) {
        setRemoveMessage(
          "Accountherstel gestart. De medewerker ontvangt een e-mail met een herstellink.",
        );
      } else {
        const link =
          "recoveryUrl" in result && typeof result.recoveryUrl === "string" && result.recoveryUrl
            ? result.recoveryUrl
            : null;
        setRemoveMessage(
          [
            "MFA is gereset, maar de herstellink kon niet per e-mail worden verzonden.",
            link ? `Deel deze eenmalige link veilig:\n${link}` : "Controleer de e-mailconfiguratie.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        );
      }
      void loadOverview();
    } catch {
      setRemoveMessage("Accountherstel mislukt. Probeer het opnieuw.");
    } finally {
      setRecoveringUserId(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <PageHeader
        icon={Settings}
        accent="#94a3b8"
        title="Instellingen"
        subtitle="Je accountgegevens en — als super admin — het overzicht van medewerkers."
      />

      {loadState === "loading" && (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Gegevens laden…
        </div>
      )}

      {loadState === "error" && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-100"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{loadError ?? "Laden mislukt"}</p>
            <button
              type="button"
              onClick={() => void loadProfile()}
              className="mt-2 text-xs underline underline-offset-2 hover:text-white"
            >
              Opnieuw proberen
            </button>
          </div>
        </div>
      )}

      {loadState === "ready" && profile && (
        <>
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#1e88e5] to-[#7c3aed] text-sm font-bold uppercase">
                {(profile.fullName || profile.email).slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {profile.fullName || "Naam nog niet ingesteld"}
                </div>
                <div className="truncate text-xs text-white/50">{profile.email}</div>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80">
                  <Shield className="h-3 w-3" />
                  {roleLabel(profile.staffRole)}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                    profile.status === "active"
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-white/5 text-white/70",
                  )}
                >
                  {statusLabel(profile.status)}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                    profile.mfaActive
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-amber-400/30 bg-amber-500/10 text-amber-100",
                  )}
                >
                  MFA {profile.mfaActive ? "actief (AAL2)" : "niet voltooid"}
                </span>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <SettingsCard
              icon={User}
              title="Persoonlijke gegevens"
              description="Naam zoals die in het admin-profiel wordt getoond."
            >
              <form onSubmit={onSaveProfile} className="space-y-3">
                <Field label="Volledige naam" htmlFor="fullName">
                  <input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={200}
                    required
                    className={fieldClass}
                    autoComplete="name"
                  />
                </Field>
                <FormFeedback state={profileState} message={profileMessage} />
                <SubmitButton busy={profileState === "saving"} label="Naam opslaan" />
              </form>
            </SettingsCard>

            <SettingsCard
              icon={Mail}
              title="E-mailadres"
              description="Wijzigen vereist bevestiging via e-mail (Supabase Auth)."
            >
              <form onSubmit={onChangeEmail} className="space-y-3">
                <Field label="E-mailadres" htmlFor="newEmail">
                  <input
                    id="newEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    maxLength={320}
                    required
                    className={fieldClass}
                    autoComplete="email"
                  />
                </Field>
                <p className="text-[11px] leading-relaxed text-white/40">
                  Na bevestiging synchroniseert <code className="text-white/55">public.users</code>{" "}
                  automatisch via de e-mail sync-trigger.
                </p>
                <FormFeedback state={emailState} message={emailMessage} />
                <SubmitButton busy={emailState === "saving"} label="E-mail wijzigen" />
              </form>
            </SettingsCard>

            <SettingsCard
              icon={KeyRound}
              title="Wachtwoord"
              description="Vereist je huidige wachtwoord én een 2FA-code uit je authenticator-app. Je blijft ingelogd na een geslaagde wijziging."
              className="lg:col-span-2"
            >
              <form onSubmit={onChangePassword} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Huidig wachtwoord" htmlFor="currentPassword">
                  <PasswordInput
                    id="currentPassword"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className={fieldClass}
                    autoComplete="current-password"
                  />
                </Field>
                <Field label="Nieuw wachtwoord" htmlFor="newPassword">
                  <PasswordInput
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={10}
                    required
                    className={fieldClass}
                    autoComplete="new-password"
                    placeholder="Min. 10 tekens, A-z + cijfer"
                  />
                </Field>
                <Field label="Bevestig nieuw wachtwoord" htmlFor="confirmPassword">
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={10}
                    required
                    className={fieldClass}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="2FA-code" htmlFor="passwordTotp">
                  <input
                    id="passwordTotp"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={passwordTotp}
                    onChange={(e) => setPasswordTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    className={fieldClass}
                    autoComplete="one-time-code"
                    placeholder="000000"
                    aria-describedby="passwordTotpHint"
                  />
                </Field>
                <p
                  id="passwordTotpHint"
                  className="sm:col-span-2 lg:col-span-4 text-[11px] text-white/45"
                >
                  Open je authenticator-app en voer de actuele 6-cijferige code in. Zonder geldige
                  2FA wordt het wachtwoord niet gewijzigd.
                </p>
                <div className="sm:col-span-2 lg:col-span-4 space-y-3">
                  <FormFeedback state={passwordState} message={passwordMessage} />
                  <SubmitButton busy={passwordState === "saving"} label="Wachtwoord bijwerken" />
                </div>
              </form>
            </SettingsCard>

            {profile.mfaActive && (
              <SettingsCard
                icon={Shield}
                title="Tweestapsverificatie"
                description="Koppel je authenticator opnieuw wanneer je de app opnieuw installeert."
                className="lg:col-span-2"
              >
                <StaffAuthenticatorReplacePanel
                  aal={session?.aal}
                  onRequireMfa={() => navigate({ to: "/admin/mfa", replace: true })}
                />
              </SettingsCard>
            )}
          </div>

          <SettingsCard
            icon={Bell}
            title="Meldingsvoorkeuren"
            description="In-app en browser-meldingen per type. Uitgeschakelde meldingen blijven wel zichtbaar in de meldingencentrale zolang de server ze verstuurt naar je account — dit bepaalt alleen toast/desktop-gedrag."
          >
            {prefState === "loading" && (
              <div className="flex items-center gap-3 py-4 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" />
                Voorkeuren laden…
              </div>
            )}

            {prefState === "error" && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>{prefError ?? "Voorkeuren konden niet worden geladen."}</p>
                  <button
                    type="button"
                    onClick={() => void loadPreferences()}
                    className="mt-2 text-xs underline underline-offset-2 hover:text-white"
                  >
                    Opnieuw proberen
                  </button>
                </div>
              </div>
            )}

            {prefState === "ready" && (
              <>
                {prefError && (
                  <p role="alert" className="mb-3 text-xs text-red-300">
                    {prefError}
                  </p>
                )}
                {preferences.length === 0 ? (
                  <p className="text-sm text-white/50">Nog geen meldingstypen beschikbaar.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="text-[11px] uppercase tracking-wider text-white/40">
                        <tr className="border-b border-white/10">
                          <th className="py-2 pr-3 font-medium">Melding</th>
                          <th className="w-28 py-2 pr-3 text-center font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              <Bell className="h-3.5 w-3.5" /> In-app
                            </span>
                          </th>
                          <th className="w-28 py-2 font-medium text-center">
                            <span className="inline-flex items-center gap-1.5">
                              <Monitor className="h-3.5 w-3.5" /> Browser
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {preferences.map((pref) => {
                          const copy = NOTIFICATION_TYPE_COPY[pref.type] ?? {
                            label: pref.type,
                            description: "",
                          };
                          return (
                            <tr key={pref.type} className="border-b border-white/5 last:border-0">
                              <td className="py-3 pr-3">
                                <div className="font-medium text-white/90">{copy.label}</div>
                                {copy.description && (
                                  <div className="text-xs text-white/45">{copy.description}</div>
                                )}
                              </td>
                              <td className="py-3 pr-3 text-center">
                                <PreferenceToggle
                                  checked={pref.inAppEnabled}
                                  busy={pendingToggleKey === `${pref.type}:in_app`}
                                  label={`In-app melding voor ${copy.label}`}
                                  onChange={(next) => void onTogglePreference(pref.type, "in_app", next)}
                                />
                              </td>
                              <td className="py-3 text-center">
                                <PreferenceToggle
                                  checked={pref.browserEnabled}
                                  busy={pendingToggleKey === `${pref.type}:browser`}
                                  label={`Browser-melding voor ${copy.label}`}
                                  onChange={(next) => void onTogglePreference(pref.type, "browser", next)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </SettingsCard>
        </>
      )}

      {isSuperAdmin && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Super admin</h2>
              <p className="text-xs text-white/50">
                Medewerkersaccounts en snelle links naar websitebeheer.
              </p>
            </div>
          </div>

          {overviewState === "loading" && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Overzicht laden…
            </div>
          )}

          {overviewState === "error" && (
            <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
              {overviewError}
            </div>
          )}

          {overviewState === "ready" && overview && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  icon={Users}
                  label="Medewerkers"
                  value={String(overview.staffUsers.length)}
                  hint="Inclusief uitgenodigd / geblokkeerd"
                />
                <StatTile
                  icon={Globe2}
                  label="Websitepagina's"
                  value={String(overview.cmsPageCount)}
                  hint="Website content"
                  to="/admin/website"
                />
                <StatTile
                  icon={Inbox}
                  label="Website-aanvragen"
                  value={String(overview.websiteRequestCount)}
                  hint="Gestructureerde store (lokaal/JSON)"
                  to="/admin/inquiries"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {overview.links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                  </Link>
                ))}
              </div>

              <SettingsCard
                icon={Users}
                title="Medewerkers & login"
                description={`Maximaal ${overview.maxSuperAdmins ?? 2} super admins (jij + één backup). Nieuwe uitnodigingen starten als admin; promoveer hoogstens één andere persoon. Verwijderen blokkeert toegang (geen harde delete).`}
              >
                {removeMessage && (
                  <p
                    className={cn(
                      "mb-3 text-xs",
                      /verwijderd|super admin|gedegradeerd/i.test(removeMessage)
                        ? "text-emerald-300"
                        : "text-red-300",
                    )}
                    role="status"
                  >
                    {removeMessage}
                  </p>
                )}
                {(overview.rosterSuperAdminCount ?? 0) >= (overview.maxSuperAdmins ?? 2) ? (
                  <p className="mb-3 text-xs text-amber-100/80" role="status">
                    Super admin-limiet bereikt ({overview.rosterSuperAdminCount}/
                    {overview.maxSuperAdmins}). Gebruik “Naar admin” om iemand te degraderen
                    voordat je een andere super admin aanwijst.
                  </p>
                ) : null}
                {overview.staffUsers.length === 0 ? (
                  <p className="text-sm text-white/50">Nog geen medewerkers gevonden.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-[11px] uppercase tracking-wider text-white/40">
                        <tr className="border-b border-white/10">
                          <th className="py-2 pr-3 font-medium">Naam</th>
                          <th className="py-2 pr-3 font-medium">E-mail</th>
                          <th className="py-2 pr-3 font-medium">Rol</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 pr-3 font-medium">Bijgewerkt</th>
                          <th className="py-2 font-medium">Actie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.staffUsers.map((u) => {
                          const isSelf = u.id === session?.userId || u.id === profile?.id;
                          const label = `${u.fullName || "—"} <${u.email}>`;
                          const atSuperAdminCap =
                            (overview.rosterSuperAdminCount ?? 0) >=
                            (overview.maxSuperAdmins ?? 2);
                          return (
                            <tr key={u.id} className="border-b border-white/5 last:border-0">
                              <td className="py-2.5 pr-3 font-medium text-white/90">
                                {u.fullName || "—"}
                                {isSelf ? (
                                  <span className="ml-2 text-[10px] font-normal text-white/40">
                                    (jij)
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-2.5 pr-3 text-white/60">{u.email}</td>
                              <td className="py-2.5 pr-3 text-white/70">{roleLabel(u.staffRole)}</td>
                              <td className="py-2.5 pr-3">
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2 py-0.5 text-[11px]",
                                    u.status === "active" && "bg-emerald-500/15 text-emerald-200",
                                    u.status === "invited" && "bg-amber-500/15 text-amber-100",
                                    u.status === "blocked" && "bg-red-500/15 text-red-100",
                                  )}
                                >
                                  {statusLabel(u.status)}
                                </span>
                              </td>
                              <td className="py-2.5 pr-3 text-xs text-white/45">
                                {formatWhen(u.updatedAt)}
                              </td>
                              <td className="py-2.5">
                                {isSelf ? (
                                  <span className="text-xs text-white/35">—</span>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {u.staffRole === "admin" &&
                                    u.status !== "blocked" &&
                                    !atSuperAdminCap ? (
                                      <button
                                        type="button"
                                        disabled={
                                          roleChangingUserId === u.id || removingUserId === u.id
                                        }
                                        onClick={() =>
                                          void onChangeStaffRole(u.id, label, "super_admin")
                                        }
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#1e88e5]/35 bg-[#1e88e5]/10 px-2.5 py-1 text-xs font-medium text-[#90caf9] transition hover:bg-[#1e88e5]/20 disabled:opacity-50"
                                      >
                                        {roleChangingUserId === u.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Shield className="h-3.5 w-3.5" />
                                        )}
                                        Super admin
                                      </button>
                                    ) : null}
                                    {u.staffRole === "super_admin" && u.status !== "blocked" ? (
                                      <button
                                        type="button"
                                        disabled={
                                          roleChangingUserId === u.id || removingUserId === u.id
                                        }
                                        onClick={() =>
                                          void onChangeStaffRole(u.id, label, "admin")
                                        }
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/75 transition hover:bg-white/10 disabled:opacity-50"
                                      >
                                        {roleChangingUserId === u.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Shield className="h-3.5 w-3.5" />
                                        )}
                                        Naar admin
                                      </button>
                                    ) : null}
                                    {u.status === "active" ? (
                                      <button
                                        type="button"
                                        disabled={
                                          recoveringUserId === u.id ||
                                          removingUserId === u.id ||
                                          roleChangingUserId === u.id
                                        }
                                        onClick={() => void onRecoverStaffAccount(u.id, label)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-50"
                                      >
                                        {recoveringUserId === u.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <LifeBuoy className="h-3.5 w-3.5" />
                                        )}
                                        Herstel account
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      disabled={removingUserId === u.id || roleChangingUserId === u.id}
                                      onClick={() => void onRemoveStaff(u.id, label)}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                                    >
                                      {removingUserId === u.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                      Verwijderen
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </SettingsCard>

              <SettingsCard
                icon={UserPlus}
                title="Beheerder uitnodigen"
                description="Nieuwe admins starten als admin; promoveer hoogstens één andere persoon tot super admin. Voor actieve medewerkers die MFA kwijt zijn: gebruik “Herstel account” in de tabel — niet dit formulier."
              >
                <form onSubmit={onInvite} className="grid gap-3 sm:grid-cols-2">
                  <Field label="E-mail" htmlFor="inviteEmail">
                    <input
                      id="inviteEmail"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      className={fieldClass}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Naam (optioneel)" htmlFor="inviteName">
                    <input
                      id="inviteName"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      maxLength={200}
                      className={fieldClass}
                      autoComplete="off"
                    />
                  </Field>
                  <div className="sm:col-span-2 space-y-3">
                    <FormFeedback state={inviteState} message={inviteMessage} />
                    <SubmitButton busy={inviteState === "saving"} label="Uitnodiging versturen" />
                  </div>
                </form>
              </SettingsCard>
            </>
          )}
        </section>
      )}
    </div>
  );
}

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#1e88e5]/60 focus:ring-2 focus:ring-[#1e88e5]/20";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1.5">
      <span className="text-xs font-medium text-white/60">{label}</span>
      {children}
    </label>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5">
          <Icon className="h-4 w-4 text-white/70" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-white/45">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e88e5] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1976d2] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
    </button>
  );
}

function FormFeedback({ state, message }: { state: FormState; message: string | null }) {
  if (!message) return null;
  const ok = state === "success";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2 text-xs whitespace-pre-wrap break-all",
        ok
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          : "border-red-400/30 bg-red-500/10 text-red-100",
      )}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

function PreferenceToggle({
  checked,
  busy,
  label,
  onChange,
}: {
  checked: boolean;
  busy: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <span className="relative inline-flex items-center">
      <Switch
        checked={checked}
        disabled={busy}
        aria-label={label}
        onCheckedChange={(next) => onChange(next)}
      />
      {busy && (
        <Loader2 className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/70" />
      )}
    </span>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  to?: "/admin/website" | "/admin/inquiries" | "/admin/users";
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5">
          <Icon className="h-4 w-4 text-white/70" />
        </div>
        {to && <ArrowUpRight className="h-3.5 w-3.5 text-white/35" />}
      </div>
      <div className="mt-3 text-xs text-white/50">{label}</div>
      <div className="text-xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-white/35">{hint}</div>}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">{inner}</div>
  );
}
