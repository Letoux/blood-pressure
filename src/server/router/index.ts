import { adminCreateUser } from "./admin-create-user";
import { health } from "./health";
import { me } from "./me";

export const router = {
  health,
  me,
  admin: {
    createUser: adminCreateUser,
  },
};

export type AppRouter = typeof router;
