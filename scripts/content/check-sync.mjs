import {
  loadContentAndSchema,
  validateContent,
  buildArtifacts,
  checkArtifactDrift,
} from "./lib/content-core.mjs";

async function main() {
  const { content, schema } = await loadContentAndSchema();
  const errors = validateContent(content, schema);
  if (errors.length > 0) {
    console.error("CONTENT_CHECK_ABORTED_VALIDATION");
    errors.forEach((error, idx) => {
      console.error(`${idx + 1}. ${error}`);
    });
    process.exitCode = 1;
    return;
  }

  const artifacts = await buildArtifacts(content);
  const drift = await checkArtifactDrift(artifacts);
  if (drift.length > 0) {
    console.error("CONTENT_CHECK_OUT_OF_SYNC");
    drift.forEach((filePath) => {
      console.error(`- ${filePath}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log("CONTENT_CHECK_OK");
}

main().catch((err) => {
  console.error("CONTENT_CHECK_CRASH");
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
