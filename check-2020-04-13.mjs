import fs from "node:fs";

const env = {};

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

const file =
  `${url}/storage/v1/object/market-data-file/US30/M1/2020/2020-04.csv`;

const response = await fetch(file, {
  headers: {
    Authorization: `Bearer ${key}`,
    apikey: key,
  },
});

if (!response.ok) {
  console.error("HTTP ERROR:", response.status);
  console.error(await response.text());
  process.exit(1);
}

const text = await response.text();
const rows = text.split(/\r?\n/).filter(Boolean).slice(1);

const getDate = (row) => row.split(",")[0].slice(0, 10);

console.log("==============================================");
console.log(" APRIL 13 — CORRECT RAW TIMESTAMP CHECK");
console.log("==============================================");

const dates = [
  "2020.04.09",
  "2020.04.10",
  "2020.04.11",
  "2020.04.12",
  "2020.04.13",
  "2020.04.14",
  "2020.04.15",
];

for (const date of dates) {
  const matches = rows.filter((r) => getDate(r) === date);

  console.log("");
  console.log(`${date} => ${matches.length} M1 rows`);

  if (matches.length) {
    console.log("FIRST:", matches[0]);
    console.log("LAST :", matches[matches.length - 1]);
  }
}

const apr13 = rows.filter((r) => getDate(r) === "2020.04.13");

console.log("");
console.log("==============================================");
console.log(" APRIL 13 EXACT DATA");
console.log("==============================================");

console.log("M1 COUNT:", apr13.length);

if (apr13.length) {
  console.log("");
  console.log("FIRST 20:");
  console.log(apr13.slice(0, 20).join("\n"));

  console.log("");
  console.log("LAST 20:");
  console.log(apr13.slice(-20).join("\n"));
}

console.log("");
console.log("==============================================");
console.log(" GAP CHECK — APRIL 13");
console.log("==============================================");

function parseBrokerTime(row) {
  const value = row.split(",")[0];
  const [date, time] = value.split(" ");

  const [y, m, d] = date.split(".").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);

  return Date.UTC(y, m - 1, d, hh, mm, ss) / 1000;
}

if (apr13.length > 1) {
  let gaps = 0;
  let largestGap = 0;
  let largestPair = null;

  for (let i = 1; i < apr13.length; i++) {
    const previous = parseBrokerTime(apr13[i - 1]);
    const current = parseBrokerTime(apr13[i]);

    const diff = current - previous;

    if (diff > 60) {
      gaps++;

      if (diff > largestGap) {
        largestGap = diff;
        largestPair = [apr13[i - 1], apr13[i]];
      }
    }
  }

  console.log("Gaps > 1 minute:", gaps);
  console.log(
    "Largest gap:",
    largestGap,
    "seconds",
    `(${(largestGap / 60).toFixed(1)} minutes)`
  );

  if (largestPair) {
    console.log("");
    console.log("LARGEST GAP:");
    console.log("BEFORE:", largestPair[0]);
    console.log("AFTER :", largestPair[1]);
  }
}

console.log("");
console.log("==============================================");
console.log(" END");
console.log("==============================================");
