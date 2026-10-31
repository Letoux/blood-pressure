import { accountChangePassword } from "./account-change-password";
import { accountDelete } from "./account-delete";
import { accountDismissPasswordChangeSuggestion } from "./account-dismiss-password-change-suggestion";
import { accountExportMeasurements } from "./account-export-measurements";
import { adminCreateUser } from "./admin-create-user";
import { adminDeleteUser } from "./admin-delete-user";
import { adminDisableUser } from "./admin-disable-user";
import { adminEnableUser } from "./admin-enable-user";
import { adminGetSettings } from "./admin-get-settings";
import { adminListUsers } from "./admin-list-users";
import { adminResetPassword } from "./admin-reset-password";
import { adminRevokeSessions } from "./admin-revoke-sessions";
import { adminSetSignUpOpen } from "./admin-set-sign-up-open";
import { campaignsDelete } from "./campaigns-delete";
import { campaignsOverview } from "./campaigns-overview";
import { campaignsSchedule } from "./campaigns-schedule";
import { health } from "./health";
import { me } from "./me";
import { measurementsCreate } from "./measurements-create";
import { measurementsDelete } from "./measurements-delete";
import { measurementsList } from "./measurements-list";
import { measurementsUpdate } from "./measurements-update";
import { reportGet } from "./report-get";
import { settingsGet, settingsUpdate } from "./settings";
import { signUpOpen } from "./sign-up-open";

export const router = {
  health,
  me,
  signUpOpen,
  measurements: {
    list: measurementsList,
    create: measurementsCreate,
    update: measurementsUpdate,
    delete: measurementsDelete,
  },
  campaigns: {
    overview: campaignsOverview,
    schedule: campaignsSchedule,
    delete: campaignsDelete,
  },
  report: {
    get: reportGet,
  },
  settings: {
    get: settingsGet,
    update: settingsUpdate,
  },
  account: {
    changePassword: accountChangePassword,
    dismissPasswordChangeSuggestion: accountDismissPasswordChangeSuggestion,
    exportMeasurements: accountExportMeasurements,
    delete: accountDelete,
  },
  admin: {
    createUser: adminCreateUser,
    listUsers: adminListUsers,
    disableUser: adminDisableUser,
    enableUser: adminEnableUser,
    deleteUser: adminDeleteUser,
    resetPassword: adminResetPassword,
    revokeSessions: adminRevokeSessions,
    getSettings: adminGetSettings,
    setSignUpOpen: adminSetSignUpOpen,
  },
};

export type AppRouter = typeof router;
