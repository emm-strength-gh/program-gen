/* Smoke test: does the patched page still boot, and is the PWA wiring intact?
 * Run: node test-boot.js
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "program-generator.html"), "utf8");
let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : " FAIL "} ${name}${extra && !cond ? " — " + extra : ""}`);
  if (!cond) failures++;
};

/* ---- static markup checks ------------------------------------------------ */
console.log("\nHead / manifest wiring");
check("manifest link present", /<link rel="manifest" href="\.\/manifest\.webmanifest">/.test(html));
check("viewport-fit=cover", /viewport-fit=cover/.test(html));
check("apple-mobile-web-app-capable", /name="apple-mobile-web-app-capable" content="yes"/.test(html));
check("apple-touch-icon", /rel="apple-touch-icon"/.test(html));
check("theme-color meta has id", /id="theme-color-meta"/.test(html));
check("sw registered on relative path", /register\("\.\/sw\.js"\)/.test(html));
check("safe-area insets used", /env\(safe-area-inset-top\)/.test(html));
check("touch inputs bumped to 16px", /pointer:coarse\)\{\s*\.field input, \.opt select/.test(html));

/* ---- referenced local files must actually exist -------------------------- */
console.log("\nReferenced files exist on disk");
const refs = [...html.matchAll(/(?:href|src)="\.\/([^"]+)"/g)].map(m => m[1]);
const unique = [...new Set(refs)].filter(r => !r.startsWith("sw.js"));
unique.forEach(r => check(r, fs.existsSync(path.join(__dirname, r))));
check("sw.js", fs.existsSync(path.join(__dirname, "sw.js")));

/* ---- manifest icons resolve --------------------------------------------- */
console.log("\nManifest");
const mf = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.webmanifest"), "utf8"));
check("start_url points at the app file",
  fs.existsSync(path.join(__dirname, mf.start_url.replace("./", ""))), mf.start_url);
check("display is standalone", mf.display === "standalone");
mf.icons.forEach(i =>
  check(`icon ${i.sizes} ${i.purpose}`, fs.existsSync(path.join(__dirname, i.src.replace("./", "")))));
check("has a maskable icon", mf.icons.some(i => i.purpose === "maskable"));

/* ---- boot the page ------------------------------------------------------ */
console.log("\nRuntime boot (jsdom)");
const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "https://example.github.io/program-hub/program-generator.html",
  virtualConsole: new (require("jsdom").VirtualConsole)()
    .on("jsdomError", e => errors.push(e.message))
    .on("error", m => errors.push(String(m))),
});

const { window } = dom;
/* jsdom doesn't implement layout APIs like scrollTo/scrollIntoView; those aren't app bugs. */
const realErrors = errors.filter(e => !/Not implemented/i.test(e));
if (errors.length !== realErrors.length) {
  console.log(`       (ignored ${errors.length - realErrors.length} jsdom "Not implemented" notice(s))`);
}
check("no script errors on load", realErrors.length === 0, realErrors.join(" | ").slice(0, 400));

const doc = window.document;
check("hub view rendered", !!doc.querySelector("#view-hub.active, #view-hub"));
check("builder cards present", doc.querySelectorAll(".gen-card").length > 0,
  `found ${doc.querySelectorAll(".gen-card").length}`);
console.log(`       builders on the hub: ${doc.querySelectorAll(".gen-card").length}`);

/* patched functions should be defined and the export path intact */
["exportActive", "downloadBlob", "isStandalonePWA", "applyTheme"].forEach(fn =>
  check(`${fn}() defined`, typeof window[fn] === "function"));

/* theme toggle should move the status-bar meta */
console.log("\nTheme toggle drives status bar colour");
window.applyTheme("light");
check("light -> #F1F2F5", doc.getElementById("theme-color-meta").getAttribute("content") === "#F1F2F5",
  doc.getElementById("theme-color-meta").getAttribute("content"));
window.applyTheme("dark");
check("dark -> #0E1014", doc.getElementById("theme-color-meta").getAttribute("content") === "#0E1014",
  doc.getElementById("theme-color-meta").getAttribute("content"));

/* export should fall back to <a download> when not standalone */
console.log("\nCSV export routing");
check("standalone detection false in a plain tab", window.isStandalonePWA() === false);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
