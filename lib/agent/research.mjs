const SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";
const MAX_QUERY_LENGTH = 300;
const MAX_RESULTS = 8;
const MAX_HTML_LENGTH = 1_500_000;

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|#39|lt|gt|nbsp);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (key.startsWith("#x") || key.startsWith("#")) {
      const codePoint = key.startsWith("#x") ? Number.parseInt(key.slice(2), 16) : Number.parseInt(key.slice(1), 10);
      try { return String.fromCodePoint(codePoint); } catch { return match; }
    }
    return ({ amp: "&", quot: '"', apos: "'", "#39": "'", lt: "<", gt: ">", nbsp: " " })[key] ?? match;
  });
}

function stripMarkup(value) {
  return decodeEntities(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}

function attribute(attributes, name) {
  const match = attributes.match(new RegExp("(?:^|\\s)" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

function safeResultUrl(rawHref) {
  try {
    const link = new URL(rawHref, "https://duckduckgo.com");
    let target = link;
    if (link.hostname === "duckduckgo.com" || link.hostname.endsWith(".duckduckgo.com")) {
      const redirected = link.searchParams.get("uddg");
      if (!redirected) return null;
      target = new URL(redirected);
    }
    if (target.protocol !== "https:" && target.protocol !== "http:") return null;
    if (target.username || target.password || (target.port && target.port !== "80" && target.port !== "443")) return null;
    const hostname = target.hostname.toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
        hostname.startsWith("[") || !hostname.includes(".")) return null;
    target.hash = "";
    return target.toString();
  } catch {
    return null;
  }
}

/**
 * Parse DuckDuckGo's HTML result page without executing any returned markup.
 * @param {string} html
 * @param {number} maxResults
 */
export function parseDuckDuckGoHtml(html, maxResults = 5) {
  const anchors = [...String(html).slice(0, MAX_HTML_LENGTH).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  const titles = [];
  const snippets = [];
  for (const match of anchors) {
    const classes = attribute(match[1], "class").split(/\s+/);
    if (classes.includes("result__a")) {
      titles.push({ href: attribute(match[1], "href"), title: stripMarkup(match[2]) });
    } else if (classes.includes("result__snippet")) {
      snippets.push(stripMarkup(match[2]));
    }
  }
  const results = [];
  const seen = new Set();
  for (let i = 0; i < titles.length && results.length < Math.max(1, Math.min(MAX_RESULTS, maxResults)); i++) {
    const url = safeResultUrl(titles[i].href);
    const title = titles[i].title.slice(0, 300);
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    results.push({ id: "S" + (results.length + 1), title, url, snippet: (snippets[i] ?? "").slice(0, 1000) });
  }
  return results;
}


async function readLimitedText(response, maxBytes) {
  if (!response.body?.getReader) return (await response.text()).slice(0, maxBytes);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value.subarray(0, Math.max(0, maxBytes - total));
    chunks.push(chunk);
    total += chunk.byteLength;
    if (chunk.byteLength < value.byteLength) {
      await reader.cancel();
      break;
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parseResearchPage(html) {
  const title = stripMarkup((String(html).match(/<title\\b[^>]*>([\\s\\S]*?)<\\/title>/i) ?? [])[1] ?? "").slice(0, 300);
  const body = String(html)
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside)\\b[^>]*>[\\s\\S]*?<\\/\\1>/gi, " ")
    .replace(/<(br|p|div|h1|h2|h3|h4|li|section|article)\\b[^>]*>/gi, "\\n")
    .replace(/<[^>]+>/g, " ");
  const content = decodeEntities(body).replace(/\\s+/g, " ").trim().slice(0, 4000);
  return { title, content };
}

async function fetchResearchPage(rawUrl, fetcher) {
  let current = safeResultUrl(rawUrl);
  if (!current || !current.startsWith("https://")) return { fetched: false, title: "", content: "" };
  for (let redirects = 0; redirects <= 2; redirects++) {
    try {
      const response = await fetcher(current, {
        method: "GET",
        headers: { Accept: "text/html, text/plain", "User-Agent": "0xMan96-AI/1.0 (read-only research)" },
        redirect: "manual",
        signal: AbortSignal.timeout(8000)
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 2) return { fetched: false, title: "", content: "" };
        current = safeResultUrl(new URL(location, current).toString());
        if (!current || !current.startsWith("https://")) return { fetched: false, title: "", content: "" };
        continue;
      }
      if (!response.ok) return { fetched: false, title: "", content: "" };
      const type = response.headers.get("content-type") ?? "";
      if (!/text\\/(html|plain)/i.test(type)) return { fetched: false, title: "", content: "" };
      const html = await readLimitedText(response, 600_000);
      const parsed = parseResearchPage(html);
      return { fetched: Boolean(parsed.content), ...parsed };
    } catch {
      return { fetched: false, title: "", content: "" };
    }
  }
  return { fetched: false, title: "", content: "" };
}

/**
 * Read-only search with bounded HTTPS page excerpts. Queries go to DuckDuckGo;
 * at most three public result pages are fetched without credentials or cookies.
 * @param {string} query
 * @param {number} [maxResults]
 * @param {typeof fetch} [fetcher]
 */
export async function searchWeb(query, maxResults = 5, fetcher = fetch) {
  const cleanQuery = String(query ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (!cleanQuery) throw new Error("web_search_requires_query");
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("q", cleanQuery);
  const response = await fetcher(url, {
    method: "GET",
    headers: { Accept: "text/html", "User-Agent": "0xMan96-AI/1.0 (read-only research)" },
    redirect: "follow",
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(response.status === 429 ? "web_search_rate_limited" : "web_search_provider_failed");
  const html = (await response.text()).slice(0, MAX_HTML_LENGTH);
  const results = parseDuckDuckGoHtml(html, maxResults);
  const pages = await Promise.all(results.slice(0, 3).map(result => fetchResearchPage(result.url, fetcher)));
  const enriched = results.map((result, index) => index < pages.length
    ? { ...result, ...pages[index] }
    : { ...result, fetched: false, title: "", content: "" });
  return {
    provider: "DuckDuckGo",
    query: cleanQuery,
    results: enriched,
    searchedAt: new Date().toISOString()
  };
}
