import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const url = new URL("../dist/server/index.js", import.meta.url);
  url.searchParams.set("test", Date.now());
  const { default: worker } = await import(url.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders an identity gate without exposing task content", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /正在连接工作台/);
  assert.doesNotMatch(html, /确认本周咨询排期/);
});
