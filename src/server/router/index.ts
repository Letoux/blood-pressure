import { adminCreateUser } from "./admin-create-user";
import { health } from "./health";
import { me } from "./me";
import { settingsGet, settingsUpdate } from "./settings";

export const router = {
  health,
  me,
  settings: {
    get: settingsGet,
    update: settingsUpdate,
  },
  admin: {
    createUser: adminCreateUser,
  },
};

export type AppRouter = typeof router;
