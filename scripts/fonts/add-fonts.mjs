#!/usr/bin/env node
/**
 * Vendors open-licence font families from the Fontsource npm packages (which
 * repackage Google Fonts and other open fonts) into public/fonts/library/, and
 * keeps public/fonts/library/manifest.json (+ LICENSES.md) up to date.
 *
 *   node scripts/fonts/add-fonts.mjs inter "open-sans" lora    some families
 *   node scripts/fonts/add-fonts.mjs --curated                 the starter set (curated.json)
 *   node scripts/fonts/add-fonts.mjs --all                     every family on Fontsource (thousands of files, GBs)
 *
 * Options: --weights 400,700   --subsets latin,latin-ext   --no-italic
 * Only licences in ALLOWED are taken; anything else is reported and skipped.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "..", "public", "fonts", "library");
const ALLOWED = new Set([
  "OFL-1.1",
  "Apache-2.0",
  "MIT",
  "Ubuntu",
  "CC0-1.0",
  "UFL-1.0",
]);

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const flagIndex = args.indexOf(`--${name}`);
  return flagIndex >= 0 ? args[flagIndex + 1] : fallback;
};
const weights = option("weights", "400,700").split(",").map(Number);
const subsets = option("subsets", "latin").split(",");
const italics = !flag("no-italic");
const positional = args.filter(
  (argument, index) =>
    !argument.startsWith("--") &&
    !["--weights", "--subsets"].includes(args[index - 1]),
);

const slugify = (text) => text.toLowerCase().trim().replace(/\s+/g, "-");

const allSlugs = async () => {
  const slugs = [];
  for (let from = 0; ; from += 250) {
    const res = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=scope:fontsource&size=250&from=${from}`,
    );
    const body = await res.json();
    for (const object of body.objects) {
      slugs.push(object.package.name.replace("@fontsource/", ""));
    }
    if (body.objects.length < 250) {
      break;
    }
  }
  return slugs.filter(
    (candidate) =>
      !candidate.startsWith("variable") && !candidate.endsWith("-variable"),
  );
};

const manifestFile = path.join(OUT, "manifest.json");
const manifest = fs.existsSync(manifestFile)
  ? JSON.parse(fs.readFileSync(manifestFile, "utf8"))
  : { fonts: [] };

const addOne = async (slug) => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "fontsource-"));
  try {
    await run(
      "npm",
      ["pack", `@fontsource/${slug}`, "--pack-destination", work, "--silent"],
      { cwd: work },
    );
    const tgz = fs.readdirSync(work).find((file) => file.endsWith(".tgz"));
    await run("tar", ["-xzf", tgz, "-C", work], { cwd: work });
    const pkg = path.join(work, "package");
    const meta = JSON.parse(
      fs.readFileSync(path.join(pkg, "metadata.json"), "utf8"),
    );
    const licence = meta.license?.type ?? "unknown";
    if (!ALLOWED.has(licence)) {
      return { slug, skipped: `licence ${licence}` };
    }
    const dir = path.join(OUT, slug);
    fs.mkdirSync(dir, { recursive: true });
    const styles = [];
    for (const weight of weights.filter((candidate) =>
      meta.weights.includes(candidate),
    )) {
      for (const style of [
        "normal",
        ...(italics && meta.styles.includes("italic") ? ["italic"] : []),
      ]) {
        for (const subset of subsets.filter((candidate) =>
          meta.subsets.includes(candidate),
        )) {
          const name = `${slug}-${subset}-${weight}-${style}.woff2`;
          const from = path.join(pkg, "files", name);
          if (fs.existsSync(from)) {
            fs.copyFileSync(from, path.join(dir, name));
            styles.push({ weight, style, subset, file: `${slug}/${name}` });
          }
        }
      }
    }
    if (!styles.length) {
      return { slug, skipped: "no matching files" };
    }
    const licenceFile = path.join(pkg, "LICENSE");
    if (fs.existsSync(licenceFile)) {
      fs.copyFileSync(licenceFile, path.join(dir, "LICENSE"));
    }
    const entry = {
      id: slug,
      family: meta.family,
      category: meta.category,
      license: licence,
      licenseUrl: meta.license?.url ?? null,
      attribution: meta.license?.attribution ?? null,
      source: meta.source ?? "https://fontsource.org",
      version: JSON.parse(
        fs.readFileSync(path.join(pkg, "package.json"), "utf8"),
      ).version,
      styles,
    };
    manifest.fonts = [
      ...manifest.fonts.filter((font) => font.id !== slug),
      entry,
    ];
    return { slug, added: styles.length };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
};

const main = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let slugs = positional.map(slugify);
  if (flag("curated")) {
    slugs = Object.values(
      JSON.parse(fs.readFileSync(path.join(here, "curated.json"), "utf8")),
    ).flat();
  }
  if (flag("all")) {
    slugs = await allSlugs();
  }
  if (!slugs.length) {
    console.error("nothing to add: name families, or use --curated / --all");
    process.exit(1);
  }
  const queue = [...slugs];
  const results = [];
  const worker = async () => {
    while (queue.length) {
      const slug = queue.shift();
      try {
        const outcome = await addOne(slug);
        results.push(outcome);
        console.log(
          outcome.added
            ? `+ ${slug} (${outcome.added} files)`
            : `- ${slug}: ${outcome.skipped}`,
        );
      } catch (error) {
        results.push({
          slug,
          skipped: String(error.message ?? error).split("\n")[0],
        });
        console.log(
          `! ${slug}: ${String(error.message ?? error).split("\n")[0]}`,
        );
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  manifest.fonts.sort((first, second) =>
    first.family.localeCompare(second.family),
  );
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest)}\n`);
  const lines = [
    "# Font library licences",
    "",
    "Every family here is open source; its licence is kept beside the files.",
    "",
    "| Family | Licence | Source | Version |",
    "|---|---|---|---|",
  ];
  for (const font of manifest.fonts) {
    lines.push(
      `| ${font.family} | ${font.license} | ${font.source} | ${font.version} |`,
    );
  }
  fs.writeFileSync(path.join(OUT, "LICENSES.md"), `${lines.join("\n")}\n`);
  const skipped = results.filter((outcome) => outcome.skipped);
  console.log(
    `\n${manifest.fonts.length} families in the library, ${skipped.length} skipped`,
  );
};

main();
