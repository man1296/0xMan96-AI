import test from "node:test";
import assert from "node:assert/strict";
import { parseDuckDuckGoHtml, searchWeb } from "../lib/agent/research.mjs";

test("parses search titles, snippets and redirected HTTPS sources", () => {
  const html = '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Farticle&amp;rut=x">Example <b>Article</b></a><a class="result__snippet">A useful &amp; clear summary.</a>';
  const rows = parseDuckDuckGoHtml(html, 5);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "S1");
  assert.equal(rows[0].title, "Example Article");
  assert.equal(rows[0].url, "https://example.com/article");
  assert.equal(rows[0].snippet, "A useful & clear summary.");
});

test("rejects unsafe protocols, local hosts and duplicate URLs", () => {
  const html = [
    '<a class="result__a" href="javascript:alert(1)">Bad</a>',
    '<a class="result__a" href="http://127.0.0.1/private">Local</a>',
    '<a class="result__a" href="https://example.com/a">Good</a>',
    '<a class="result__a" href="https://example.com/a">Duplicate</a>'
  ].join("");
  const rows = parseDuckDuckGoHtml(html, 8);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].url, "https://example.com/a");
});

test("searchWeb uses a fixed provider endpoint and bounds results", async () => {
  let requested;
  const html = '<a class="result__a" href="https://example.com">Example</a><a class="result__snippet">Snippet</a>';
  const result = await searchWeb("  test query  ", 20, async (url, init) => {
    requested = { url: String(url), init };
    return new Response(html, { status: 200 });
  });
  assert.match(requested.url, /^https:\/\/html\.duckduckgo\.com\/html\/\?/);
  assert.equal(new URL(requested.url).searchParams.get("q"), "test query");
  assert.equal(result.results.length, 1);
  assert.equal(result.provider, "DuckDuckGo");
});

test("searchWeb rejects empty queries and upstream errors", async () => {
  await assert.rejects(() => searchWeb("  ", 5, fetch), /web_search_requires_query/);
  await assert.rejects(() => searchWeb("query", 5, async () => new Response("", { status: 429 })), /web_search_rate_limited/);
});
