/* eslint-disable no-console */
require('dotenv/config');
const fs = require('node:fs/promises');
const path = require('node:path');

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

async function main() {
  const port = env('PORT', '3000');
  const swaggerPath = env('SWAGGER_PATH', 'docs').replace(/^\/+/, '');
  const baseUrl = env('OPENAPI_BASE_URL', `http://127.0.0.1:${port}`);
  const outputFile = env('OPENAPI_OUTPUT', 'openapi.yaml');

  const url = `${baseUrl}/${swaggerPath}-yaml`;

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(
      [
        `Failed to fetch OpenAPI from ${url}.`,
        `Is the API running locally? (try: \`npm run start:dev\`)`,
        `You can also override the target with OPENAPI_BASE_URL, e.g. OPENAPI_BASE_URL=http://127.0.0.1:3001`,
        '',
        String(err?.stack || err),
      ].join('\n'),
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch OpenAPI from ${url}: ${res.status} ${res.statusText}\n${text}`);
  }

  const yaml = await res.text();

  const absOut = path.resolve(process.cwd(), outputFile);
  await fs.mkdir(path.dirname(absOut), { recursive: true });
  await fs.writeFile(absOut, yaml, 'utf8');

  console.log(`Wrote ${outputFile} from ${url}`);
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exitCode = 1;
});

