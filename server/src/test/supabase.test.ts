import { supabase } from "../lib/supabase";

async function main(): Promise<void> {
  const { error, count } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("[supabase test] Query failed:", error.message);
    process.exit(1);
    return;
  }

  if (count !== 37) {
    console.error(`[supabase test] Expected 37 rows, got ${count ?? "null"}`);
    process.exit(1);
    return;
  }

  console.log("[supabase test] OK - cards row count is 37");
  process.exit(0);
}

main();


