import { loadContentAndSchema, validateContent } from "./lib/content-core.mjs";

async function main() {
  const { content, schema } = await loadContentAndSchema();
  const errors = validateContent(content, schema);

  if (errors.length > 0) {
    console.error("CONTENT_VALIDATE_FAILED");
    errors.forEach((error, idx) => {
      console.error(`${idx + 1}. ${error}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log("CONTENT_VALIDATE_OK");
}

main().catch((err) => {
  console.error("CONTENT_VALIDATE_CRASH");
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
