'use strict';

/**
 * NitroSend — Store Analyzer
 * GET /api/analyze?url=store.com
 *
 * Reads only PUBLIC storefront data and returns:
 *  - contact emails found on the store
 *  - store facts (name, country, currency, theme, product count)
 *  - bestseller details (photos, video, description, reviews)
 *  - catalog health (photos, resolution, descriptions, sold-out)
 *  - mobile speed estimate, conversion/marketing signals, Christmas readiness
 *  - estimated traffic tier
 *  - ranked list of issues (each mapped to a service you can pitch)
 *
 * Runs as a Netlify Function.
 */

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

/* ------------------------------------------------------------------ */
/* Fingerprints                                                        */
/* ------------------------------------------------------------------ */
const APPS = {
  reviews: {
    'Judge.me': ['judge.me', 'judgeme'],
    Loox: ['loox.io'],
    Yotpo: ['yotpo'],
    Okendo: ['okendo'],
    'Stamped.io': ['stamped.io'],
    'Reviews.io': ['reviews.io'],
    Junip: ['junip'],
    'Ali Reviews': ['alireviews'],
    Trustoo: ['trustoo'],
    Rivyo: ['rivyo'],
    'Shopify Reviews': ['spr-badge', 'shopify-product-reviews'],
    Trustpilot: ['trustpilot'],
  },
  email: {
    Klaviyo: ['klaviyo'],
    Omnisend: ['omnisend'],
    Privy: ['privy.com'],
    Mailchimp: ['chimpstatic', 'mailchimp'],
    Justuno: ['justuno'],
    Wisepops: ['wisepops'],
    'Shopify Forms': ['forms.shopifyapps', 'shopify-forms'],
    Postscript: ['postscript.io'],
    Attentive: ['attn.tv', 'attentivemobile'],
  },
  upsell: {
    Rebuy: ['rebuyengine'],
    ReConvert: ['reconvert'],
    Vitals: ['vitals.co'],
    Kaching: ['kaching'],
    Selleasy: ['selleasy'],
    Zipify: ['zipify'],
    Bold: ['boldapps', 'boldcommerce'],
    Bundler: ['bundler.app'],
    UpCart: ['upcart'],
    'Frequently Bought Together': ['frequently-bought', 'fbt-'],
  },
  video: {
    Tolstoy: ['gotolstoy', 'tolstoy'],
    Videowise: ['videowise'],
    Firework: ['fireworktv', 'fw-embed'],
    Whatmore: ['whatmore'],
    Vimeo: ['player.vimeo.com'],
    YouTube: ['youtube.com/embed', 'youtube-nocookie.com/embed'],
    Wistia: ['wistia'],
    Tagshop: ['tagshop'],
    Covet: ['covet.pics'],
  },
  urgency: {
    Countdown: ['countdown', 'hurrify', 'timer-bar', 'sale-timer'],
  },
};

const VINTAGE_THEMES = ['debut', 'brooklyn', 'minimal', 'supply', 'narrative', 'venture', 'simple', 'boundless', 'jumpstart', 'pop'];
const FREE_THEMES = ['dawn', 'refresh', 'sense', 'craft', 'studio', 'taste', 'crave', 'colorblock', 'ride', 'origin', 'spotlight', 'publisher', 'trade', 'horizon'];

const NICHES = [
  ['Beauty & skincare', /skin|serum|cream|lotion|makeup|lipstick|beauty|cosmetic|lash|nail|face mask|moisturi[sz]er/i],
  ['Hair care', /hair|wig|shampoo|conditioner|bonnet|extension/i],
  ['Pet supplies', /\bdog|\bcat\b|cats\b|pet\b|pets\b|puppy|kitten|leash|collar|litter/i],
  ['Fitness', /fitness|gym|workout|yoga|resistance band|dumbbell|protein|athletic/i],
  ['Supplements & wellness', /supplement|vitamin|capsule|gumm(y|ies)|collagen|wellness|detox|tea\b/i],
  ['Fashion & apparel', /shirt|dress|hoodie|jeans|pants|jacket|apparel|sweater|legging|tee\b|skirt/i],
  ['Jewelry & accessories', /necklace|bracelet|ring\b|rings\b|earring|jewel|pendant|watch|sunglass/i],
  ['Home & decor', /decor|candle|pillow|blanket|lamp|rug|vase|wall art|home\b|bedding/i],
  ['Kitchen', /kitchen|cook|knife|pan\b|mug|cup\b|bottle|blender|coffee/i],
  ['Baby & kids', /baby|toddler|kids|infant|nursery|diaper|toy\b|toys\b/i],
  ['Tech & gadgets', /phone|charger|cable|earbud|headphone|speaker|led\b|gadget|case\b|smart/i],
  ['Outdoor & travel', /camping|hiking|outdoor|travel|backpack|tent|fishing/i],
  ['Automotive', /car\b|auto|vehicle|tesla|dashboard|seat cover/i],
];

const JUNK_EMAIL = /(example\.|sentry|wixpress|shopify\.com|domain\.com|email\.com|yourstore|yourdomain|test@|@2x|\.(png|jpe?g|gif|webp|svg|css|js)$|u003e|noreply|no-reply|donotreply)/i;
const PREFERRED_PREFIX = ['hello', 'hi', 'info', 'contact', 'support', 'team', 'sales', 'shop', 'store', 'care', 'help', 'founder', 'owner'];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */
function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!s) throw new Error('No URL');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error('Invalid URL');
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (
    host === 'localhost' ||
    host.startsWith('[') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    !host.includes('.') ||
    /\.(local|internal|lan|home)$/.test(host)
  ) {
    throw new Error('Invalid domain');
  }
  return `https://${host}`;
}

async function get(url, ms = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const ttfb = Date.now() - start;
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, ttfb, url: res.url || url };
  } catch (e) {
    return { ok: false, status: 0, text: '', ttfb: Date.now() - start, url, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

const safeJson = (t) => {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#64;|&#x40;/gi, '@')
    .replace(/&#46;|&#x2e;/gi, '.');
}

function stripTags(html) {
  return decode(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

const words = (s) => (stripTags(s).match(/\S+/g) || []).length;
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const median = (arr) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

function metaContent(html, attr, val) {
  const tag = html.match(new RegExp(`<meta[^>]+${attr}\\s*=\\s*["']${val}["'][^>]*>`, 'i'));
  if (!tag) return null;
  const c = tag[0].match(/content\s*=\s*["']([^"']*)["']/i);
  return c ? decode(c[1]).trim() : '';
}

function detect(hay, group) {
  return Object.entries(group)
    .filter(([, needles]) => needles.some((n) => hay.includes(n)))
    .map(([name]) => name);
}

function hostOf(src, base) {
  try {
    return new URL(src.replace(/\\\//g, '/'), base).hostname.toLowerCase();
  } catch {
    return null;
  }
}
const SHOPIFY_HOSTS = ['cdn.shopify.com', 'shopify.com', 'shopifycloud.com', 'shopifysvc.com', 'myshopify.com', 'shopifycdn.net'];
const isShopifyHost = (h) => SHOPIFY_HOSTS.some((s) => h === s || h.endsWith('.' + s));

function cfDecode(hex) {
  try {
    const key = parseInt(hex.substr(0, 2), 16);
    let out = '';
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ key);
    return out;
  } catch {
    return '';
  }
}

function extractEmails(html) {
  const out = new Set();
  const text = decode(html).replace(/\\u0040/g, '@').replace(/%40/g, '@');
  (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi) || []).forEach((e) => out.add(e.toLowerCase().replace(/^[._-]+/, '')));
  (html.match(/data-cfemail=["']([0-9a-f]+)["']/gi) || []).forEach((m) => {
    const e = cfDecode(m.split(/["']/)[1]);
    if (e.includes('@')) out.add(e.toLowerCase());
  });
  return [...out].filter((e) => !JUNK_EMAIL.test(e) && e.length < 80);
}

function rankEmails(emails, domain) {
  const root = domain.replace(/^www\./, '').split('.').slice(-2).join('.');
  const score = (e) => {
    const [local, d] = e.split('@');
    let s = 0;
    if (d && d.endsWith(root)) s += 5;
    if (PREFERRED_PREFIX.includes(local)) s += 2;
    if (/order|return|privacy|legal|dpo|abuse|careers|jobs|press|billing/.test(local)) s -= 3;
    return s;
  };
  return [...new Set(emails)].sort((a, b) => score(b) - score(a));
}

function themeInfo(html) {
  const m = html.match(/Shopify\.theme\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  const j = safeJson(m[1]);
  if (j) return { name: j.name || 'Unknown', schema: j.schema_name || null, storeId: j.theme_store_id || null };
  const n = m[1].match(/"name"\s*:\s*"([^"]+)"/);
  return n ? { name: n[1], schema: null, storeId: null } : null;
}

function detectNiche(products) {
  const types = {};
  products.forEach((p) => {
    const t = (p.product_type || '').trim();
    if (t) types[t] = (types[t] || 0) + 1;
  });
  const blob = products
    .slice(0, 80)
    .map((p) => `${p.title} ${p.product_type || ''} ${(p.tags || []).join ? p.tags.join(' ') : p.tags || ''}`)
    .join(' ');
  let best = null;
  let bestCount = 0;
  NICHES.forEach(([name, re]) => {
    const c = (blob.match(new RegExp(re.source, 'gi')) || []).length;
    if (c > bestCount) {
      best = name;
      bestCount = c;
    }
  });
  const topType = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
  return { niche: bestCount >= 2 ? best : topType ? topType[0] : 'General store', topType: topType ? topType[0] : null };
}

function cleanTitle(t) {
  // Shorten long product titles for use in emails: "Cozy Dog Bed - Large / Grey | Brand" -> "Cozy Dog Bed"
  let s = String(t || '').split(/\s[|\-–—]\s|\s\/\s|,\s|\(/)[0].trim();
  if (s.length > 40) s = s.slice(0, 40).replace(/\s+\S*$/, '');
  return s || String(t || '').slice(0, 40);
}

/* ------------------------------------------------------------------ */
/* Owner / founder name                                                 */
/* ------------------------------------------------------------------ */
const NOT_NAMES = new Set(
  ('the our we us you your my this that shop store team brand company family hello hi hey welcome about home founder founders cofounder owner ceo ' +
    'story mission love thanks thank customer customers support service shopify contact email info privacy policy terms shipping returns ' +
    'mr mrs ms miss dr sir madam dear all everyone friends people women men kids baby pet pets dog dogs cat cats christmas holiday ' +
    'january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday ' +
    'new york london paris usa america canada australia california texas florida')
    .split(/\s+/)
);

function validName(n, storeWords) {
  if (!n) return false;
  const first = n.split(/\s+/)[0];
  if (!/^[A-Z][a-z]{2,14}$/.test(first)) return false;
  const lw = first.toLowerCase();
  if (NOT_NAMES.has(lw) || storeWords.has(lw)) return false;
  return true;
}

function findOwner(sources, storeName) {
  const storeWords = new Set(String(storeName || '').toLowerCase().split(/[^a-z]+/).filter(Boolean));
  const NAME = "([A-Z][a-z]{2,14}(?:\\s[A-Z][a-z'\\-]{1,20})?)";
  const textPatterns = [
    [new RegExp(`\\bfounded (?:in \\d{4} )?by ${NAME}`), 'founded by'],
    [new RegExp(`\\b(?:started|created|launched) (?:in \\d{4} )?by ${NAME}`), 'started by'],
    [new RegExp(`\\b(?:Hi|Hello|Hey)[,!.]?\\s+I(?:'|’)?m ${NAME}`), 'intro'],
    [new RegExp(`\\bmy name is ${NAME}`, 'i'), 'my name is'],
    [new RegExp(`${NAME},?\\s+(?:the\\s+)?(?:Founder|Co-Founder|Cofounder|Owner|CEO)\\b`), 'title'],
    [new RegExp(`\\b(?:Founder|Co-Founder|Owner|CEO)(?:\\s+&\\s+\\w+)?\\s*[:,\\-–—]\\s*${NAME}`), 'title'],
    [new RegExp(`\\b(?:Love|Cheers|Warmly|xo|XO),?\\s*[-–—]?\\s*${NAME}\\s*$`, 'm'), 'signoff'],
  ];
  for (const { html, label } of sources) {
    if (!html) continue;
    // JSON-LD founder
    const jl = html.match(/"founder"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]{3,40})"/i) || html.match(/"founder"\s*:\s*"([^"]{3,40})"/i);
    if (jl && validName(jl[1].trim(), storeWords)) {
      const full = jl[1].trim();
      return { first: full.split(/\s+/)[0], full, source: `${label} (founder data)` };
    }
    const text = stripTags(html);
    for (const [re, how] of textPatterns) {
      const m = text.match(re);
      if (m && validName(m[1], storeWords)) {
        const full = m[1].trim();
        return { first: full.split(/\s+/)[0], full, source: `${label} (${how})` };
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Main analysis                                                        */
/* ------------------------------------------------------------------ */
async function analyze(base) {
  const t0 = Date.now();
  const domain = new URL(base).hostname;

  // Phase 1
  const [home, productsRes, metaRes, bestRes, collRes] = await Promise.all([
    get(base + '/', 5500),
    get(base + '/products.json?limit=250', 5500),
    get(base + '/meta.json', 4000),
    get(base + '/collections/all?sort_by=best-selling', 4500),
    get(base + '/collections.json?limit=250', 4000),
  ]);

  if (!home.ok && home.status === 0) {
    throw new Error(home.error === 'timeout' ? 'Store timed out' : 'Store unreachable');
  }
  if (/\/password(\?|$)/.test(home.url)) throw new Error('Store is password protected');

  const finalHost = (() => {
    try {
      return new URL(home.url).hostname;
    } catch {
      return domain;
    }
  })();
  const html = home.text || '';
  const lower = html.toLowerCase();
  const productsJson = productsRes.ok ? safeJson(productsRes.text) : null;
  const products = Array.isArray(productsJson?.products) ? productsJson.products : [];
  const meta = metaRes.ok ? safeJson(metaRes.text) : null;
  const collections = (collRes.ok && safeJson(collRes.text)?.collections) || [];
  const isShopify = lower.includes('cdn.shopify.com') || lower.includes('shopify.theme') || products.length > 0 || !!meta?.myshopify_domain;

  // Bestseller
  let bestHandle = null;
  if (bestRes.ok) {
    const m = bestRes.text.match(/\/products\/([a-z0-9][a-z0-9\-_%.]*)/i);
    if (m) bestHandle = decodeURIComponent(m[1]).replace(/[?#].*$/, '');
  }
  let best = (bestHandle && products.find((p) => p.handle === bestHandle)) || products.find((p) => (p.images || []).length) || products[0] || null;
  if (best) bestHandle = best.handle;

  // Phase 2
  const [pJs, pHtml, contact, contactInfo, privacy, about1, about2, about3] = await Promise.all([
    bestHandle ? get(`${base}/products/${bestHandle}.js`, 3500) : Promise.resolve({ ok: false, text: '' }),
    bestHandle ? get(`${base}/products/${bestHandle}`, 3500) : Promise.resolve({ ok: false, text: '' }),
    get(base + '/pages/contact', 3500),
    get(base + '/policies/contact-information', 3500),
    get(base + '/policies/privacy-policy', 3500),
    get(base + '/pages/about', 3500),
    get(base + '/pages/about-us', 3500),
    get(base + '/pages/our-story', 3500),
  ]);
  const aboutHtml = [about1, about2, about3].filter((r) => r.ok).map((r) => r.text).join('\n');
  const pdp = pHtml.text || '';
  const pdpLower = pdp.toLowerCase();
  const pData = pJs.ok ? safeJson(pJs.text) : null;
  const both = lower + ' ' + pdpLower;

  /* ---------- Emails ---------- */
  const emails = rankEmails(
    [
      ...extractEmails(html),
      ...extractEmails(contact.text || ''),
      ...extractEmails(contactInfo.text || ''),
      ...extractEmails(privacy.text || ''),
      ...extractEmails(pdp),
      ...extractEmails(aboutHtml),
    ],
    finalHost
  ).slice(0, 5);

  /* ---------- Store facts ---------- */
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
  const storeName =
    (meta?.name && decode(meta.name)) || metaContent(html, 'property', 'og:site_name') || title.split(/\s[|–—-]\s/)[0].trim() || finalHost;
  const theme = themeInfo(html);
  const themeKey = (theme?.schema || theme?.name || '').toLowerCase();
  const currency = meta?.currency || (html.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/) || [])[1] || null;
  const productCount = meta?.published_products_count ?? products.length;
  const { niche } = detectNiche(products);

  /* ---------- Speed ---------- */
  const head = html.split(/<\/head>/i)[0] || '';
  const scriptTags = html.match(/<script\b[^>]*>/gi) || [];
  const srcs = scriptTags.map((t) => (t.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1]).filter(Boolean);
  const asyncBlock = (html.match(/function asyncLoad\(\)\s*\{[\s\S]*?\}/) || [])[0] || '';
  const asyncUrls = asyncBlock.match(/https?:\\?\/\\?\/[^"'\s,]+/g) || [];
  const appHosts = new Set();
  [...srcs, ...asyncUrls].forEach((src) => {
    const h = hostOf(src, base);
    if (!h || h === finalHost) return;
    if (isShopifyHost(h)) {
      if (/\/extensions\//.test(src)) appHosts.add('ext:' + (src.match(/\/extensions\/([^/]+)/) || [])[1]);
      return;
    }
    appHosts.add(h);
  });
  const appScripts = appHosts.size;
  const renderBlocking = (head.match(/<script\b[^>]*>/gi) || []).filter(
    (t) => /\bsrc\s*=/.test(t) && !/\b(async|defer)\b/i.test(t) && !/type\s*=\s*["']module["']/i.test(t)
  ).length;
  const homeImgs = html.match(/<img\b[^>]*>/gi) || [];
  const lazyImgs = homeImgs.filter((t) => /loading\s*=\s*["']lazy["']/i.test(t)).length;
  const htmlKb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
  const ttfb = home.ttfb;

  let speedScore = 100;
  speedScore -= Math.min(30, Math.max(0, (ttfb - 500) / 40));
  speedScore -= Math.min(20, Math.max(0, (htmlKb - 150) / 12));
  speedScore -= Math.min(30, Math.max(0, appScripts - 5) * 3);
  speedScore -= Math.min(16, renderBlocking * 4);
  if (homeImgs.length > 40) speedScore -= 5;
  if (homeImgs.length >= 8 && pct(lazyImgs, homeImgs.length) < 20) speedScore -= 6;
  speedScore = Math.max(5, Math.min(99, Math.round(speedScore)));
  const estLoad = +(1.4 + ttfb / 1000 + appScripts * 0.22 + htmlKb / 350 + renderBlocking * 0.3).toFixed(1);

  /* ---------- Apps ---------- */
  const reviewApps = detect(both, APPS.reviews);
  const emailApps = detect(lower, APPS.email);
  const upsellApps = detect(both, APPS.upsell);
  const videoApps = detect(both, APPS.video);
  const urgency = detect(both, APPS.urgency).length > 0;

  /* ---------- Bestseller ---------- */
  let bestseller = null;
  if (best) {
    const imgs = best.images || [];
    const media = Array.isArray(pData?.media) ? pData.media : [];
    const videoMedia = media.filter((m) => /video/.test(m.media_type || '')).length;
    const pdpVideoTags = (pdp.match(/<video\b|youtube\.com\/embed|player\.vimeo\.com/gi) || []).length;
    let reviewCount = 0;
    const rc =
      pdp.match(/"reviewCount"\s*:\s*"?(\d+)/i) ||
      pdp.match(/data-number-of-reviews=["'](\d+)/i) ||
      pdp.match(/data-raters=["'](\d+)/i) ||
      pdp.match(/"ratingCount"\s*:\s*"?(\d+)/i);
    if (rc) reviewCount = parseInt(rc[1], 10) || 0;
    const rating = (pdp.match(/"ratingValue"\s*:\s*"?([\d.]+)/i) || [])[1] || null;
    const prices = (best.variants || []).map((v) => parseFloat(v.price)).filter((n) => !isNaN(n));
    bestseller = {
      title: best.title,
      short: cleanTitle(best.title),
      handle: best.handle,
      url: `${base}/products/${best.handle}`,
      image: imgs[0]?.src || null,
      price: prices.length ? Math.min(...prices) : null,
      photos: imgs.length,
      lowResPhotos: imgs.filter((i) => i.width && i.width < 800).length,
      videos: videoMedia || pdpVideoTags,
      descWords: words(best.body_html),
      titleLength: (best.title || '').length,
      reviewCount,
      rating: rating ? parseFloat(rating) : null,
      variants: (best.variants || []).length,
      onSale: (best.variants || []).some((v) => v.compare_at_price && parseFloat(v.compare_at_price) > parseFloat(v.price)),
      soldOut: (best.variants || []).length > 0 && best.variants.every((v) => v.available === false),
      metaDescription: !!metaContent(pdp, 'name', 'description'),
      fromBestSelling: !!bestRes.ok,
    };
  }

  /* ---------- Catalog ---------- */
  let catalog = null;
  if (products.length) {
    const allImgs = products.flatMap((p) => p.images || []);
    const firstImgs = products.map((p) => (p.images || [])[0]).filter((i) => i && i.width && i.height);
    const ratios = {};
    firstImgs.forEach((i) => {
      const r = (i.width / i.height).toFixed(1);
      ratios[r] = (ratios[r] || 0) + 1;
    });
    const dominant = Math.max(0, ...Object.values(ratios));
    const prices = products.flatMap((p) => (p.variants || []).map((v) => parseFloat(v.price))).filter((n) => !isNaN(n) && n > 0);
    const xmasHits = products.filter((p) => /christmas|xmas|holiday|santa|stocking|gift/i.test(`${p.title} ${(p.tags || []).join ? p.tags.join(' ') : ''}`)).length;
    catalog = {
      scanned: products.length,
      fewPhotosPct: pct(products.filter((p) => (p.images || []).length < 3).length, products.length),
      onePhotoPct: pct(products.filter((p) => (p.images || []).length <= 1).length, products.length),
      avgPhotos: +(allImgs.length / products.length).toFixed(1),
      lowResPct: pct(allImgs.filter((i) => i.width && i.width < 800).length, allImgs.length),
      noAltPct: pct(allImgs.filter((i) => !i.alt || !String(i.alt).trim()).length, allImgs.length),
      mixedRatiosPct: firstImgs.length >= 6 ? 100 - pct(dominant, firstImgs.length) : 0,
      thinDescPct: pct(products.filter((p) => words(p.body_html) < 50).length, products.length),
      emptyDescPct: pct(products.filter((p) => words(p.body_html) < 5).length, products.length),
      soldOutPct: pct(
        products.filter((p) => (p.variants || []).length && p.variants.every((v) => v.available === false)).length,
        products.length
      ),
      onSalePct: pct(
        products.filter((p) => (p.variants || []).some((v) => v.compare_at_price && parseFloat(v.compare_at_price) > parseFloat(v.price))).length,
        products.length
      ),
      shortTitlePct: pct(products.filter((p) => (p.title || '').trim().split(/\s+/).length <= 2).length, products.length),
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      priceMedian: prices.length ? median(prices) : null,
      christmasProducts: xmasHits,
    };
  }

  /* ---------- Marketing / trust ---------- */
  const linksLower = (html.match(/href\s*=\s*["'][^"']+["']/gi) || []).join(' ').toLowerCase();
  const socials = {};
  [
    ['instagram', /instagram\.com\/([a-z0-9._]+)/i],
    ['tiktok', /tiktok\.com\/@([a-z0-9._]+)/i],
    ['facebook', /facebook\.com\/([a-z0-9.\-]+)/i],
    ['youtube', /youtube\.com\/(@?[a-z0-9._\-\/]+)/i],
    ['pinterest', /pinterest\.[a-z.]+\/([a-z0-9_]+)/i],
  ].forEach(([k, re]) => {
    const m = linksLower.match(re);
    if (m && !/sharer|share|intent|plugins|dialog/.test(m[1])) socials[k] = m[1].replace(/\/$/, '');
  });
  const pixels = {
    meta: /fbq\(|connect\.facebook\.net|facebook-pixel/i.test(html),
    google: /googletagmanager|gtag\(|google-analytics/i.test(html),
    tiktok: /analytics\.tiktok\.com|ttq\./i.test(html),
    pinterest: /pintrk|s\.pinimg\.com\/ct/i.test(html),
    snapchat: /sc-static\.net|snaptr\(/i.test(html),
  };
  const homeText = stripTags(html);
  const freeShipping = /free (shipping|delivery)/i.test(homeText);
  const expressCheckout = /shopify-payment-button|dynamic-checkout|shop-pay|accelerated-checkout/i.test(pdp);
  const homeVideos = (html.match(/<video\b|youtube\.com\/embed|player\.vimeo\.com/gi) || []).length;

  /* ---------- Christmas readiness ---------- */
  const xmasRe = /christmas|xmas|holiday|gift guide|gifts? for|stocking|black friday|bfcm|cyber monday/i;
  const xmasCollections = collections.filter((c) => xmasRe.test(`${c.title} ${c.handle}`)).map((c) => c.title);
  const christmas = {
    homepageMention: xmasRe.test(homeText),
    collections: xmasCollections.slice(0, 5),
    products: catalog?.christmasProducts || 0,
    countdown: urgency,
    ready: xmasCollections.length > 0 || xmasRe.test(homeText),
  };

  /* ---------- Design ---------- */
  const vintage = VINTAGE_THEMES.some((v) => themeKey === v || themeKey.startsWith(v + ' '));
  const freeTheme = FREE_THEMES.some((v) => themeKey === v || themeKey.startsWith(v + ' '));
  const design = {
    theme: theme?.name || null,
    themeBase: theme?.schema || null,
    vintage,
    freeTheme,
    paidTheme: !!themeKey && !freeTheme && !vintage,
    customDomain: !finalHost.endsWith('.myshopify.com'),
    viewport: /<meta[^>]+name=["']viewport["']/i.test(head),
    announcementBar: /announcement[-_ ]?bar|announcement__/i.test(html),
    heroVideo: homeVideos > 0,
    h1: (html.match(/<h1[\s>]/gi) || []).length,
    metaDescription: !!metaContent(html, 'name', 'description'),
    ogImage: !!metaContent(html, 'property', 'og:image'),
  };
  let designScore = 70;
  if (vintage) designScore -= 25;
  if (design.paidTheme) designScore += 10;
  if (!design.customDomain) designScore -= 20;
  if (!design.viewport) designScore -= 20;
  if (design.heroVideo) designScore += 8;
  if (design.announcementBar) designScore += 4;
  if (catalog && catalog.mixedRatiosPct > 30) designScore -= 10;
  if (catalog && catalog.lowResPct > 30) designScore -= 8;
  design.score = Math.max(5, Math.min(99, designScore));

  /* ---------- Traffic estimate ---------- */
  const tSignals = [];
  let t = 0;
  const rcount = bestseller?.reviewCount || 0;
  if (rcount > 500) (t += 3), tSignals.push(`${rcount} reviews on bestseller`);
  else if (rcount > 100) (t += 2), tSignals.push(`${rcount} reviews on bestseller`);
  else if (rcount > 15) (t += 1), tSignals.push(`${rcount} reviews on bestseller`);
  const pixelCount = Object.values(pixels).filter(Boolean).length;
  if (pixelCount >= 2) (t += 1), tSignals.push(`${pixelCount} ad pixels`);
  if (emailApps.length) (t += 1), tSignals.push('email marketing app');
  if (productCount > 50) (t += 1), tSignals.push(`${productCount} products`);
  if (appScripts > 10) (t += 1), tSignals.push(`${appScripts} apps/scripts`);
  if (Object.keys(socials).length >= 3) (t += 1), tSignals.push(`${Object.keys(socials).length} social profiles`);
  if (design.paidTheme) (t += 1), tSignals.push('paid theme');
  if (Array.isArray(meta?.ships_to_countries) && meta.ships_to_countries.length > 10) (t += 1), tSignals.push('ships internationally');
  if (!design.customDomain) t -= 2;
  const traffic = { tier: t >= 6 ? 'High' : t >= 3 ? 'Medium' : 'Low', points: t, signals: tSignals };

  /* ---------- Issues → services ---------- */
  const issues = [];
  const add = (key, service, severity, data = {}) => issues.push({ key, service, severity: Math.round(severity), data });
  const hasVideo = (bestseller?.videos || 0) > 0 || videoApps.length > 0 || homeVideos > 0;
  const bsPhotos = bestseller?.photos ?? null;

  if (bestseller && !hasVideo) add('no_video', 'UGC videos', 80 + (pixels.meta || pixels.tiktok ? 6 : 0) + (socials.tiktok ? 3 : 0));
  if (bestseller && bsPhotos !== null && bsPhotos < 3) add('few_photos_bestseller', 'Product photography', 78 + (3 - bsPhotos) * 4);
  else if (catalog && catalog.fewPhotosPct >= 50) add('few_photos_catalog', 'Product photography', 66);
  if (catalog && catalog.lowResPct >= 30) add('low_res', 'Product photo enhancement', 62);
  if (catalog && catalog.mixedRatiosPct >= 35) add('mixed_ratios', 'Product photo enhancement', 50);
  if (speedScore < 50) add('slow_mobile', 'Mobile speed optimization', 72 + (50 - speedScore) / 3);
  else if (speedScore < 68) add('slow_mobile', 'Mobile speed optimization', 56);
  if (bestseller && bestseller.descWords < 60) add('thin_desc_bestseller', 'Product page optimization', 70);
  else if (catalog && catalog.thinDescPct >= 50) add('thin_desc_catalog', 'Product page optimization', 64);
  if (!reviewApps.length && rcount === 0 && isShopify) add('no_reviews', 'Reviews setup', 74);
  if (!emailApps.length) add('no_email_capture', 'Email marketing', 63);
  if (!upsellApps.length && isShopify) add('no_upsell', 'Upsells & bundles', 55);
  if (!christmas.ready) add('no_christmas', 'Christmas store setup', 68);
  if (!pixels.meta && !pixels.tiktok) add('no_pixels', 'Ads pixel setup', 52);
  if (vintage) add('old_theme', 'Store redesign', 64);
  if (!design.customDomain) add('myshopify', 'Store setup', 82);
  if (catalog && catalog.soldOutPct >= 30) add('sold_out', 'Product optimization', 54);
  if (bestseller && !expressCheckout && pHtml.ok) add('no_express', 'Checkout optimization', 48);
  if (!design.metaDescription || (catalog && catalog.noAltPct >= 60)) add('weak_seo', 'SEO optimization', 42);
  if (catalog && catalog.shortTitlePct >= 50) add('weak_titles', 'Product optimization', 46);
  if (appScripts > 14) add('app_bloat', 'Mobile speed optimization', 58);

  issues.sort((a, b) => b.severity - a.severity);

  return {
    ok: true,
    url: base,
    domain: finalHost,
    isShopify,
    storeName: storeName.slice(0, 60),
    owner: findOwner(
      [
        { html: aboutHtml, label: 'About page' },
        { html, label: 'Homepage' },
        { html: contact.text || '', label: 'Contact page' },
      ],
      storeName
    ),
    country: meta?.country || null,
    currency,
    niche,
    productCount,
    collectionCount: collections.length,
    emails,
    bestseller,
    catalog,
    speed: { score: speedScore, estLoadSec: estLoad, ttfbMs: ttfb, htmlKb, appScripts, renderBlocking, homeImages: homeImgs.length, source: 'estimate' },
    apps: { reviews: reviewApps, email: emailApps, upsell: upsellApps, video: videoApps },
    socials,
    pixels,
    conversion: { freeShipping, expressCheckout, urgency },
    christmas,
    design,
    traffic,
    issues,
    analyzedAt: new Date().toISOString(),
    ms: Date.now() - t0,
  };
}

/* ------------------------------------------------------------------ */
/* Handler                                                              */
/* ------------------------------------------------------------------ */
async function handle(rawUrl) {
  let base;
  try {
    base = normalizeUrl(rawUrl);
  } catch (e) {
    return { statusCode: 400, body: { ok: false, error: e.message } };
  }
  try {
    return { statusCode: 200, body: await analyze(base) };
  } catch (e) {
    return { statusCode: 200, body: { ok: false, url: base, domain: new URL(base).hostname, error: e.message || 'Analysis failed' } };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  const url = event.queryStringParameters?.url;
  const r = await handle(url);
  return { statusCode: r.statusCode, headers: HEADERS, body: JSON.stringify(r.body) };
};

exports.handle = handle;
exports.HEADERS = HEADERS;
