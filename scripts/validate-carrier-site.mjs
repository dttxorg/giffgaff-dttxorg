import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(process.argv[2] || process.cwd());
const pages = [
  ["/", "index.html"],
  ["/cte/", "cte/index.html"],
  ["/cte/guide/", "cte/guide/index.html"],
  ["/cte/porting/", "cte/porting/index.html"],
  ["/cte/faq/", "cte/faq/index.html"],
  ["/cmlink/", "cmlink/index.html"],
  ["/cmlink/keep-number/", "cmlink/keep-number/index.html"],
  ["/cmlink/faq/", "cmlink/faq/index.html"],
  ["/gg/", "gg/index.html"],
];

const failures = [];
const pass = (name, details = "") => console.log(`PASS ${name}${details ? ` :: ${details}` : ""}`);
const fail = (name, details) => failures.push(`${name} :: ${details}`);

const resolveLocal = (url, fromFile) => {
  const clean = url.split("#", 1)[0].split("?", 1)[0];
  if (!clean || clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("mailto:") || clean.startsWith("tel:")) return true;
  const base = clean.startsWith("/") ? root : dirname(join(root, fromFile));
  const raw = clean.startsWith("/") ? clean.slice(1) : clean;
  const candidates = [
    resolve(base, raw),
    resolve(base, `${raw}.html`),
    resolve(base, raw, "index.html"),
  ];
  return candidates.some(existsSync);
};

for (const [route, file] of pages) {
  const path = join(root, file);
  if (!existsSync(path)) {
    fail(`route ${route}`, `missing ${file}`);
    continue;
  }
  const html = readFileSync(path, "utf8");
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) fail(`route ${route}`, `duplicate ids ${[...new Set(duplicates)].join(",")}`);
  if (!/<title>[^<]+<\/title>/.test(html)) fail(`route ${route}`, "missing title");
  if (!/name="viewport"/.test(html)) fail(`route ${route}`, "missing viewport");
  if (!/https:\/\/gg\.681218\.xyz\//.test(html)) fail(`route ${route}`, "canonical domain is not gg.681218.xyz");
  if (!/\/carrier-site\.css/.test(html) || !/\/carrier-site\.js/.test(html)) fail(`route ${route}`, "shared assets missing");
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!resolveLocal(match[1], file)) fail(`route ${route}`, `broken local reference ${match[1]}`);
  }
  pass(`route ${route}`, `${html.length} chars, ${ids.length} ids`);
}

const rootHtml = readFileSync(join(root, "index.html"), "utf8");
const cmlinkHtml = readFileSync(join(root, "cmlink/index.html"), "utf8");
const cmlinkGuide = readFileSync(join(root, "cmlink/keep-number/index.html"), "utf8");
const ggHtml = readFileSync(join(root, "gg/index.html"), "utf8");
const css = readFileSync(join(root, "carrier-site.css"), "utf8");
const allNew = pages.map(([, file]) => readFileSync(join(root, file), "utf8")).join("\n");

const sectionCount = (rootHtml.match(/<section\b/g) || []).length;
if (sectionCount > 7) fail("short CTExcel homepage", `${sectionCount} sections exceeds 7`);
else pass("short CTExcel homepage", `${sectionCount} sections`);

for (const text of ["¥128", "/cte/guide/", "/cte/porting/", "/cte/faq/", "/cmlink/", "/gg/"]) {
  if (!rootHtml.includes(text)) fail("CTExcel homepage content", `missing ${text}`);
}
pass("CTExcel homepage content", "product, subpages, and carrier links present");

for (const text of ["¥60", "£1", "£15/年", "365 天", "/cmlink/keep-number/", "/cmlink/faq/"]) {
  if (!cmlinkHtml.includes(text)) fail("CMLink product facts", `missing ${text}`);
}
for (const text of ["30 天", "不会自动续订", "£15/年无忧保号套餐"]) {
  if (!cmlinkGuide.includes(text)) fail("CMLink keep-number guide", `missing ${text}`);
}
pass("CMLink product route", "¥60, £1, 30-day window, and £15/year present");

for (const text of ["/refund.html", "/refund-cases.html", "https://ai.681218.xyz/refund-agent.html"]) {
  if (!ggHtml.includes(text)) fail("giffgaff hub", `missing ${text}`);
}
pass("giffgaff hub", "refund, cases, and AI routes present");

if (allNew.includes("giffgaff.681218.xyz")) fail("domain normalization", "obsolete giffgaff.681218.xyz found");
else pass("domain normalization", "only gg.681218.xyz used");

for (const token of ["@keyframes", "IntersectionObserver", "prefers-reduced-motion"]) {
  const where = token === "IntersectionObserver" ? readFileSync(join(root, "carrier-site.js"), "utf8") : css;
  if (!where.includes(token)) fail("motion system", `missing ${token}`);
}
pass("motion system", "scroll reveal, keyframes, reduced-motion fallback");

if (!existsSync(join(root, "assets/cmlink/cmlink-logo.png"))) fail("CMLink asset", "logo missing");
else pass("CMLink asset", "official wordmark cached locally");

if (failures.length) {
  console.error(`\nFAILURES ${failures.length}`);
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}

console.log(`\nRESULT PASS routes=${pages.length} failures=0`);
