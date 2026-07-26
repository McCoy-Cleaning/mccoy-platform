import { createServerFn } from "@tanstack/react-start";

import {
  changeOwnStaffEmail,
  changeOwnStaffPassword,
  getOwnStaffSettingsProfile,
  getSuperAdminSettingsOverview,
  removeStaffMemberFromRoster,
  updateOwnStaffProfile,
} from "@mccoy/database/server";
import {
  staffChangeEmailSchema,
  staffChangePasswordSchema,
  staffRemoveMemberSchema,
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
