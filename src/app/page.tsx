import { redirect } from "next/navigation";
import Dashboard from "@/frontend/components/dashboard";
import { createClient } from "@/frontend/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") redirect("/login");
  return <Dashboard />;
}
