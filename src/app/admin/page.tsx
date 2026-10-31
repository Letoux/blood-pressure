import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { SignOutButton } from "../sign-out-button";
import { CreateUserForm } from "./create-user-form";
import { SignUpSetting } from "./sign-up-setting";
import { UsersTable } from "./users-table";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");

  return (
    <main>
      <h1>Administration</h1>
      <UsersTable />
      <CreateUserForm />
      <SignUpSetting />
      <SignOutButton />
    </main>
  );
}
