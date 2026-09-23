import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve("data/us30/M1");
const BUCKET = "market-data-file";
const CONCURRENCY = 3;

function loadEnv(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}`);
  }

  const env = {};

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");

    env[key] = value;
  }

  return env;
}

const env = loadEnv(".env.local");

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing from .env.local"
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

function findCsvFiles(dir) {
  const result = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      result.push(...findCsvFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".csv")) {
      result.push(fullPath);
    }
  }

  return result.sort();
}

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

const files = findCsvFiles(ROOT);

if (files.length === 0) {
  throw new Error(`No CSV files found under ${ROOT}`);
}

console.log("========================================");
console.log(" Replay Lab Pro - M1 Supabase Uploader");
console.log("========================================");
console.log(`Local files : ${files.length}`);
console.log(`Bucket      : ${BUCKET}`);
console.log(`Concurrency : ${CONCURRENCY}`);
console.log();

let completed = 0;
let skipped = 0;
let failed = 0;

const failures = [];

async function uploadFile(file) {
  const relative = path.relative(ROOT, file).split(path.sep).join("/");

  // data/us30/M1/YYYY/YYYY-MM.csv
  // becomes US30/M1/YYYY/YYYY-MM.csv
  const storagePath = `US30/M1/${relative}`;

  const stat = fs.statSync(file);

  // The first test file is already confirmed uploaded.
  if (storagePath === "US30/M1/2016/2016-10.csv") {
    skipped++;
    completed++;
    console.log(
      `[${completed}/${files.length}] SKIP   ${storagePath} (${formatMB(stat.size)} MB)`
    );
    return;
  }

  try {
    console.log(
      `[${completed + 1}/${files.length}] UPLOAD ${storagePath} (${formatMB(stat.size)} MB)`
    );

    const fileBuffer = fs.readFileSync(file);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: "text/csv",
        upsert: false,
      });

    if (error) {
      // If it already exists, treat it as safely skipped.
      if (
        error.message?.toLowerCase().includes("already exists") ||
        error.message?.toLowerCase().includes("duplicate")
      ) {
        skipped++;
        completed++;
        console.log(`          ALREADY EXISTS -> skipped`);
        return;
      }

      throw error;
    }

    completed++;
    console.log(`          SUCCESS`);
  } catch (error) {
    failed++;
    completed++;

    const message = error?.message || String(error);

    failures.push({
      local: file,
      storage: storagePath,
      error: message,
    });

    console.log(`          FAILED: ${message}`);
  }
}

async function worker(queue) {
  while (queue.length > 0) {
    const file = queue.shift();
    await uploadFile(file);
  }
}

const queue = [...files];

await Promise.all(
  Array.from(
    { length: Math.min(CONCURRENCY, files.length) },
    () => worker(queue)
  )
);

console.log();
console.log("========================================");
console.log(" UPLOAD COMPLETE");
console.log("========================================");
console.log(`Total files : ${files.length}`);
console.log(`Completed   : ${completed}`);
console.log(`Skipped     : ${skipped}`);
console.log(`Failed      : ${failed}`);

if (failures.length > 0) {
  console.log();
  console.log("FAILED FILES:");
  for (const failure of failures) {
    console.log(`- ${failure.storage}`);
    console.log(`  ${failure.error}`);
  }

  process.exitCode = 1;
} else {
  console.log();
  console.log("ALL MONTHLY M1 FILES UPLOADED SUCCESSFULLY.");
}
