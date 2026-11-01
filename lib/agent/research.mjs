const SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";
const MAX_QUERY_LENGTH = 300;
const MAX_RESULTS = 8;
const MAX_HTML_LENGTH = 1_500_000;

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|#39|lt|gt|nbsp);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
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

/**
 * Read-only web search. The query is sent to DuckDuckGo; result pages are not fetched.
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
  return {
    provider: "DuckDuckGo",
    query: cleanQuery,
    results,
    searchedAt: new Date().toISOString()
  };
}
