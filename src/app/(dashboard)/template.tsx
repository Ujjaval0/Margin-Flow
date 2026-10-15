import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/security/session";

/** Check durable authentication on workspace navigation without changing its client shell. */
export default async function DashboardTemplate({ children }: { children: ReactNode }) {
  const request = new Request("http://workspace.local", { headers: await headers() });
  if (!await getSessionUser(request)) redirect("/login");
  return children;
}
