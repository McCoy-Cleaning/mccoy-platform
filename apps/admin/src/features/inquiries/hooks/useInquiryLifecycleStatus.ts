import * as React from "react";

import { updateAdminRequestLifecycleStatus } from "@/lib/api/admin-requests.functions";

export type LifecycleMutationStatus = "open" | "closed";

export function useInquiryLifecycleStatus(options: {
  onMoved: (id: string, status: LifecycleMutationStatus) => void;
}) {
  const { onMoved } = options;
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [errorState, setErrorState] = React.useState<{
    id: string;
    message: string;
  } | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const updateLifecycle = React.useCallback(
    async (id: string, status: LifecycleMutationStatus) => {
      if (savingId) return false;
      setSavingId(id);
      setErrorState(null);
      setToast(null);
      try {
        const result = await updateAdminRequestLifecycleStatus({
          data: { id, status },
        });
        if (!result.ok) {
          setErrorState({ id, message: result.error });
          return false;
        }
        onMoved(id, status);
        setToast(
          status === "closed"
            ? "Aanvraag verplaatst naar Afgerond."
            : "Aanvraag heropend en verplaatst naar Openstaand.",
        );
        return true;
      } catch {
        setErrorState({ id, message: "Status wijzigen mislukt. Probeer het opnieuw." });
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [onMoved, savingId],
  );

  return {
    updateLifecycle,
    savingId,
    errorFor: (id: string) => (errorState?.id === id ? errorState.message : null),
    toast,
    dismissToast: () => setToast(null),
  };
}
