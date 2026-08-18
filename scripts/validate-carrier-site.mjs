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
const cteGuide = readFileSync(join(root, "cte/guide/index.html"), "utf8");
const ctePorting = readFileSync(join(root, "cte/porting/index.html"), "utf8");
const cteFaq = readFileSync(join(root, "cte/faq/index.html"), "utf8");
const cmlinkHtml = readFileSync(join(root, "cmlink/index.html"), "utf8");
const cmlinkGuide = readFileSync(join(root, "cmlink/keep-number/index.html"), "utf8");
const cmlinkFaq = readFileSync(join(root, "cmlink/faq/index.html"), "utf8");
const ggHtml = readFileSync(join(root, "gg/index.html"), "utf8");
const css = readFileSync(join(root, "carrier-site.css"), "utf8");
const js = readFileSync(join(root, "carrier-site.js"), "utf8");
const allNew = pages.map(([, file]) => readFileSync(join(root, file), "utf8")).join("\n");
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));

const sectionCount = (rootHtml.match(/<section\b/g) || []).length;
if (sectionCount > 7) fail("short CTExcel homepage", `${sectionCount} sections exceeds 7`);
else pass("short CTExcel homepage", `${sectionCount} sections`);

for (const text of ["¥128", "/cte/guide/", "/cte/porting/", "/cte/faq/", "/cmlink/", "/gg/"]) {
  if (!rootHtml.includes(text)) fail("CTExcel homepage content", `missing ${text}`);
}
pass("CTExcel homepage content", "product, subpages, and carrier links present");

for (const text of ["¥60", "首月", "1GB", "30 分钟", "30 短信", "£15/年", "365 天", "/cmlink/keep-number/", "/cmlink/faq/"]) {
  if (!cmlinkHtml.includes(text)) fail("CMLink product facts", `missing ${text}`);
}
for (const text of ["30 天", "不会自动续订", "£15/年"]) {
  if (!cmlinkGuide.includes(text)) fail("CMLink keep-number guide", `missing ${text}`);
}
pass("CMLink product route", "¥60, first-month allowance, 30-day window, and £15/year present");

for (const text of ["£0.20/分钟", "£0.05/分钟", "£0.10/条", "£0.005/MB", "约 ¥50", "接收短信", "免费"]) {
  if (!cteGuide.includes(text)) fail("CTExcel roaming rates", `missing ${text}`);
}
if (!cteFaq.includes("price-table") || !cteFaq.includes("约 ¥0.05/MB")) {
  fail("CTExcel FAQ rate answer", "full rate table is not present in FAQ");
}
pass("CTExcel roaming rates", "call, incoming call, SMS, free incoming SMS, and data rates present");

for (const text of ["30p/分钟", "60p/分钟", "150p/分钟", "35p/条", "接收普通短信", "移动数据不按普通 PAYG", "中国 15GB", "中国 40GB"]) {
  if (!cmlinkGuide.includes(text)) fail("CMLink roaming rates", `missing ${text}`);
}
if (!cmlinkFaq.includes("约 ¥3.5/条") || !cmlinkFaq.includes("跨国流量 3GB")) {
  fail("CMLink FAQ rate answer", "full roaming and data-pack answer is not present");
}
pass("CMLink roaming rates", "China roaming calls, SMS, free incoming SMS, and data packs present");

for (const [name, html] of [["CTExcel", cteFaq], ["CMLink", cmlinkFaq]]) {
  for (const marker of ["data-faq-root", "data-faq-search", "data-faq-status", "data-faq-item", "data-faq-empty"]) {
    if (!html.includes(marker)) fail(`${name} FAQ interaction`, `missing ${marker}`);
  }
}
for (const marker of ["normalizeSearch", "找到 ${visibleCount} 个相关问题", "aria-pressed"]) {
  if (!js.includes(marker)) fail("FAQ interaction script", `missing ${marker}`);
}
pass("FAQ interaction", "search filtering, empty state, status, and checklist behavior present");

for (const text of ["PAC 自己保存", "不需要发给退款客服", "原 giffgaff 号码"]) {
  if (!ctePorting.includes(text)) fail("PAC guidance", `missing ${text}`);
}
pass("PAC guidance", "customer-held PAC and independent refund route preserved");

if (/(?:^|[^\d])£1(?:\s|<|体验|套餐)/.test(allNew)) fail("CMLink wording", "standalone £1 package wording found");
else pass("CMLink wording", "standalone £1 wording removed");

for (const phrase of ["运营商独立分类", "三个入口，互相连接", "主页保持简洁", "内容已经拆开", "每个品牌都有自己的页面"]) {
  if (allNew.includes(phrase)) fail("customer-facing copy", `internal implementation note found: ${phrase}`);
}
pass("customer-facing copy", "internal implementation notes removed");

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

if (!existsSync(join(root, "assets/wechat-qr-only.png"))) fail("WeChat QR asset", "cropped QR missing");
else pass("WeChat QR asset", "square QR-only asset present");

if (!/aspect-ratio:\s*9\s*\/\s*19/.test(css)) fail("phone mockup", "realistic 9:19 ratio missing");
else pass("phone mockup", "realistic 9:19 ratio present");

const redirects = new Map(vercel.redirects.map((item) => [item.source, item.destination]));
for (const [source, destination] of [["/ctexcel", "/cte"], ["/ctexcel-faq", "/cte/faq"], ["/giffgaff", "/gg"]]) {
  if (redirects.get(source) !== destination) fail("legacy redirects", `${source} does not target ${destination}`);
}
pass("legacy redirects", "cleanUrls-compatible sources target new carrier routes");

if (failures.length) {
  console.error(`\nFAILURES ${failures.length}`);
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}

console.log(`\nRESULT PASS routes=${pages.length} failures=0`);
