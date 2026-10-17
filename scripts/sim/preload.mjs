// Loaded with `node --import` in front of the post command. It replaces fetch, so nothing can
// leave the process: a request for http://site.invalid/api/posts is answered by the real route
// handlers, built by build.mjs, and a request for anywhere else is refused.
import { appendFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ORIGIN = "http://site.invalid";
const require = createRequire(join(fileURLToPath(new URL("../..", import.meta.url)), "package.json"));
const { NextRequest } = require("next/server");
const route = await import(process.env.SIM_ROUTE);
const WIRE = process.env.SIM_WIRE;

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  if (!url.startsWith(`${ORIGIN}/`)) throw new Error(`the sim refused to fetch ${url}`);
  const method = (init.method ?? "GET").toUpperCase();
  // what the command sent, kept so a test can look at it
  if (WIRE) appendFileSync(WIRE, JSON.stringify({ method, path: url.slice(ORIGIN.length), body: init.body ? JSON.parse(init.body) : undefined }) + "\n");
  const handler = route[method];
  if (!handler) return new Response("Method Not Allowed", { status: 405 });
  return handler(new NextRequest(url, { method, headers: init.headers, body: init.body }));
};
