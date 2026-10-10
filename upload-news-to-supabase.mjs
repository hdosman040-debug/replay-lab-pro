import fs from "fs";
import os from "os";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const FILE = path.join(os.homedir(), "forex-calendar", "news_final.csv");
const BUCKET = "market-data-file";
const TARGET = "US30/NEWS/usd-high-impact.csv";

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv(".env.local");
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) throw new Error("Missing Supabase keys in .env.local");
if (!fs.existsSync(FILE)) throw new Error(`Missing ${FILE}`);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const local = fs.readFileSync(FILE);
console.log(`Uploading ${(local.length / 1024).toFixed(0)} KB to ${BUCKET}/${TARGET}`);

const { error } = await supabase.storage.from(BUCKET).upload(TARGET, local, {
  contentType: "text/csv",
  upsert: true,
});
if (error) {
  console.error("UPLOAD FAILED:", error.message);
  process.exit(1);
}

const { data, error: dlError } = await supabase.storage.from(BUCKET).download(TARGET);
if (dlError) {
  console.error("VERIFY FAILED:", dlError.message);
  process.exit(1);
}
const remote = Buffer.from(await data.arrayBuffer());
if (!remote.equals(local)) {
  console.error("VERIFY FAILED: remote file differs from local file");
  process.exit(1);
}
console.log("SUCCESS: uploaded and verified byte-for-byte.");
