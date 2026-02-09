import {
  loadContentAndSchema,
  validateContent,
  buildArtifacts,
  writeArtifacts,
} from "./lib/content-core.mjs";

async function main() {
  const { content, schema } = await loadContentAndSchema();
  const errors = validateContent(content, schema);
  if (errors.length > 0) {
    console.error("CONTENT_SYNC_ABORTED_VALIDATION");
    errors.forEach((error, idx) => {
      console.error(`${idx + 1}. ${error}`);
    });
    process.exitCode = 1;
    return;
  }

  const artifacts = await buildArtifacts(content);
  const changed = await writeArtifacts(artifacts);

  if (changed.length === 0) {
    console.log("CONTENT_SYNC_NO_CHANGES");
    return;
  }

  console.log("CONTENT_SYNC_UPDATED");
  changed.forEach((filePath) => {
    console.log(`- ${filePath}`);
  });
}

main().catch((err) => {
  console.error("CONTENT_SYNC_CRASH");
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
