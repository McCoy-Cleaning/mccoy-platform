import { createServerFn } from "@tanstack/react-start";

import {
  changeOwnStaffEmail,
  changeOwnStaffPassword,
  changeStaffMemberRole,
  getOwnStaffSettingsProfile,
  getSuperAdminSettingsOverview,
  removeStaffMemberFromRoster,
  finalizeStaffAuthenticatorReplace,
  updateOwnStaffProfile,
} from "@mccoy/database/server";
import {
  staffChangeEmailSchema,
  staffChangePasswordSchema,
  staffChangeRoleSchema,
  staffRemoveMemberSchema,
  staffFinalizeAuthenticatorReplaceSchema,
  staffUpdateProfileSchema,
} from "@mccoy/validation";

export const getStaffSettingsProfileFn = createServerFn({ method: "POST" }).handler(async () => {
  return getOwnStaffSettingsProfile();
});

export const updateStaffProfileFn = createServerFn({ method: "POST" })
  .validator(staffUpdateProfileSchema)
  .handler(async ({ data }) => {
    return updateOwnStaffProfile({ fullName: data.fullName });
  });

export const changeStaffEmailFn = createServerFn({ method: "POST" })
  .validator(staffChangeEmailSchema)
  .handler(async ({ data }) => {
    return changeOwnStaffEmail({ newEmail: data.newEmail });
  });

export const changeStaffPasswordFn = createServerFn({ method: "POST" })
  .validator(staffChangePasswordSchema)
  .handler(async ({ data }) => {
    return changeOwnStaffPassword({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      totpCode: data.totpCode,
    });
  });

export const getSuperAdminSettingsOverviewFn = createServerFn({ method: "POST" }).handler(
  async () => {
    return getSuperAdminSettingsOverview();
  },
);

export const removeStaffMemberFn = createServerFn({ method: "POST" })
  .validator(staffRemoveMemberSchema)
  .handler(async ({ data }) => {
    return removeStaffMemberFromRoster({ targetUserId: data.targetUserId });
  });

export const changeStaffRoleFn = createServerFn({ method: "POST" })
  .validator(staffChangeRoleSchema)
  .handler(async ({ data }) => {
    return changeStaffMemberRole({
      targetUserId: data.targetUserId,
      staffRole: data.staffRole,
    });
  });

export const finalizeStaffAuthenticatorReplaceFn = createServerFn({ method: "POST" })
  .validator(staffFinalizeAuthenticatorReplaceSchema)
  .handler(async ({ data }) => {
    return finalizeStaffAuthenticatorReplace({ keepFactorId: data.keepFactorId });
  });
