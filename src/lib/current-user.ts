import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export const getCurrentUser = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

export async function requireUser(returnTo = "/my-businesses") {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?${new URLSearchParams({ next: returnTo })}`);
  return user;
}
