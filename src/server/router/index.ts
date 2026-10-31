import { accountChangePassword } from "./account-change-password";
import { accountDismissPasswordChangeSuggestion } from "./account-dismiss-password-change-suggestion";
import { adminCreateUser } from "./admin-create-user";
import { adminDeleteUser } from "./admin-delete-user";
import { adminDisableUser } from "./admin-disable-user";
import { adminEnableUser } from "./admin-enable-user";
import { adminGetSettings } from "./admin-get-settings";
import { adminListUsers } from "./admin-list-users";
import { adminResetPassword } from "./admin-reset-password";
import { adminRevokeSessions } from "./admin-revoke-sessions";
import { adminSetSignUpOpen } from "./admin-set-sign-up-open";
import { health } from "./health";
import { me } from "./me";
import { signUpOpen } from "./sign-up-open";

export const router = {
  health,
  me,
  signUpOpen,
  account: {
    changePassword: accountChangePassword,
    dismissPasswordChangeSuggestion: accountDismissPasswordChangeSuggestion,
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
