import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "dist", "pages");

const REQUIRED_ROOT_FILES = ["index.html", "404.html"];
const OPTIONAL_ROOT_FILES = ["team.html", "sponsoring-anfrage.html", "robots.txt", "sitemap.xml", "feed.xml", "manifest.webmanifest", "CNAME"];
const COPY_DIRECTORIES = ["assets"];

async function exists(absolutePath) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function copyFileIfPresent(fileName, copiedFiles, copiedFileSet) {
  if (copiedFileSet.has(fileName)) {
    return true;
  }

  const source = path.join(ROOT_DIR, fileName);
  if (!(await exists(source))) {
    return false;
  }

  const target = path.join(OUTPUT_DIR, fileName);
  await fs.cp(source, target);
  copiedFiles.push(fileName);
  copiedFileSet.add(fileName);
  return true;
}

async function copyDirectoryIfPresent(dirName, copiedDirectories) {
  const source = path.join(ROOT_DIR, dirName);
  if (!(await exists(source))) {
    return false;
  }

  const target = path.join(OUTPUT_DIR, dirName);
  await fs.cp(source, target, { recursive: true });
  copiedDirectories.push(dirName);
  return true;
}

async function main() {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const copiedFiles = [];
  const copiedFileSet = new Set();
  const copiedDirectories = [];
  const missingRequired = [];

  for (const fileName of REQUIRED_ROOT_FILES) {
    const copied = await copyFileIfPresent(fileName, copiedFiles, copiedFileSet);
    if (!copied) {
      missingRequired.push(fileName);
    }
  }

  const rootEntries = await fs.readdir(ROOT_DIR, { withFileTypes: true });
  const htmlFiles = rootEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".html"))
    .map((entry) => entry.name);

  const rootFiles = [...new Set([...htmlFiles, ...OPTIONAL_ROOT_FILES])];
  for (const fileName of rootFiles) {
    await copyFileIfPresent(fileName, copiedFiles, copiedFileSet);
  }

  for (const dirName of COPY_DIRECTORIES) {
    await copyDirectoryIfPresent(dirName, copiedDirectories);
  }

  await fs.writeFile(path.join(OUTPUT_DIR, ".nojekyll"), "");

  if (missingRequired.length > 0) {
    console.error("PAGES_ARTIFACT_MISSING_REQUIRED_FILES");
    for (const fileName of missingRequired) {
      console.error(`- ${fileName}`);
    }
    process.exitCode = 1;
    return;
  }

  copiedFiles.sort((a, b) => a.localeCompare(b));
  copiedDirectories.sort((a, b) => a.localeCompare(b));

  console.log("PAGES_ARTIFACT_READY");
  console.log(`OUTPUT_DIR=${path.relative(ROOT_DIR, OUTPUT_DIR).replaceAll("\\", "/")}`);
  console.log(`FILES=${copiedFiles.length}`);
  for (const fileName of copiedFiles) {
    console.log(`- ${fileName}`);
  }
  console.log(`DIRECTORIES=${copiedDirectories.length}`);
  for (const dirName of copiedDirectories) {
    console.log(`- ${dirName}/`);
  }
}

main().catch((err) => {
  console.error("PAGES_ARTIFACT_CRASH");
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
