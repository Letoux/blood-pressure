import { adminCreateUser } from "./admin-create-user";
import { health } from "./health";
import { me } from "./me";
import { measurementsCreate } from "./measurements-create";
import { measurementsDelete } from "./measurements-delete";
import { measurementsList } from "./measurements-list";
import { measurementsUpdate } from "./measurements-update";
import { settingsGet, settingsUpdate } from "./settings";

export const router = {
  health,
  me,
  measurements: {
    list: measurementsList,
    create: measurementsCreate,
    update: measurementsUpdate,
    delete: measurementsDelete,
  },
  settings: {
    get: settingsGet,
    update: settingsUpdate,
  },
  admin: {
    createUser: adminCreateUser,
  },
};

export type AppRouter = typeof router;
