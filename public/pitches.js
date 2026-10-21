/* NitroSend — pitch engine
 *
 * Every email:
 *   greeting → COMPLIMENT (real, from their store) → PROBLEM (what's costing them orders)
 *   → FIX (how you solve it, + optional season line) → REVERSE-PSYCHOLOGY close → sign-off
 *
 * Spam-safe: no "free", "sale(s)", "buy", "save", "offer", "deal", "guarantee", no %, no money,
 * no exclamation marks, no ALL CAPS. Greeting, compliment, close and subject rotate per store,
 * so no two emails look the same.
 */
(function (global) {
  'use strict';

  /* ---------------- Seasons (optional) ---------------- */
  function nthWeekday(year, month, weekday, n) {
    const first = new Date(year, month, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + offset + (n - 1) * 7);
  }
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1, day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month, day);
  }

  const SEASONS = {
    none: { label: 'None (no season)' },
    christmas: { label: 'Christmas', name: 'Christmas', rush: 'the Christmas rush', gift: 'Christmas gift', date: (y) => new Date(y, 11, 25) },
    bfcm: { label: 'Black Friday / Cyber Monday', name: 'Black Friday', rush: 'Black Friday', gift: 'Black Friday', date: (y) => { const t = nthWeekday(y, 10, 4, 4); return new Date(y, 10, t.getDate() + 1); } },
    newyear: { label: 'New Year', name: 'New Year', rush: 'the New Year rush', gift: 'New Year', date: (y) => new Date(y + 1, 0, 1) },
    valentines: { label: "Valentine's Day", name: "Valentine's Day", rush: "Valentine's Day", gift: "Valentine's gift", date: (y) => new Date(y, 1, 14) },
    easter: { label: 'Easter', name: 'Easter', rush: 'Easter', gift: 'Easter gift', date: (y) => easter(y) },
    mothers: { label: "Mother's Day", name: "Mother's Day", rush: "Mother's Day", gift: "Mother's Day gift", date: (y) => nthWeekday(y, 4, 0, 2) },
    fathers: { label: "Father's Day", name: "Father's Day", rush: "Father's Day", gift: "Father's Day gift", date: (y) => nthWeekday(y, 5, 0, 3) },
    backtoschool: { label: 'Back to School', name: 'back-to-school', rush: 'back-to-school season', gift: 'back-to-school', date: (y) => new Date(y, 7, 15) },
    halloween: { label: 'Halloween', name: 'Halloween', rush: 'Halloween', gift: 'Halloween', date: (y) => new Date(y, 9, 31) },
    summer: { label: 'Summer', name: 'summer', rush: 'the summer rush', gift: 'summer', date: (y) => new Date(y, 5, 21) },
    thanksgiving: { label: 'Thanksgiving', name: 'Thanksgiving', rush: 'Thanksgiving', gift: 'Thanksgiving', date: (y) => nthWeekday(y, 10, 4, 4) },
    ramadan: { label: 'Ramadan / Eid', name: 'Ramadan and Eid', rush: 'Ramadan and Eid', gift: 'Eid gift' },
  };

  function daysTo(seasonKey, now = new Date()) {
    const s = SEASONS[seasonKey];
    if (!s || !s.date) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let d = s.date(now.getFullYear());
    if (seasonKey === 'newyear') d = new Date(now.getFullYear() + 1, 0, 1);
    if (d < today) d = s.date(now.getFullYear() + 1);
    return Math.round((d - today) / 864e5);
  }

  /* ---------------- Helpers ---------------- */
  const VIDEO_IDEAS = {
    'Pet supplies': 'a dog or cat actually using it',
    'Beauty & skincare': 'a real customer applying it',
    'Hair care': 'a quick before-and-after',
    'Fashion & apparel': 'a try-on clip',
    'Jewelry & accessories': 'a gift-unboxing reaction',
    'Home & decor': 'a cozy room reveal',
    Kitchen: 'a quick recipe using it',
    'Tech & gadgets': 'a quick unboxing and demo',
    Fitness: 'a real workout using it',
    'Supplements & wellness': 'a morning-routine clip',
    'Baby & kids': 'a parent showing it in action',
    'Outdoor & travel': 'it being used outdoors',
    Automotive: 'a quick install in a real car',
  };

  const GENERIC_LOCALS = /^(info|hello|hi|hey|support|contact|sales|admin|team|shop|store|orders?|help|care|customercare|customerservice|service|office|mail|marketing|partnerships?|press|wholesale|enquiries|inquiries|billing|general|returns|accounts?|business|ecom|online|web|webmaster)$/;

  const SPAM_SWAPS = [
    [/\bfor free\b/gi, ''],
    [/\bfree\b/gi, ''],
    [/\bsales\b/gi, 'orders'],
    [/\bguarantee(d)?\b/gi, 'make sure'],
    [/\bdeal(s)?\b/gi, 'idea$1'],
    [/\boffer(s)?\b/gi, 'option$1'],
    [/\bdiscount(s)?\b/gi, 'option$1'],
    [/\bcheap(est)?\b/gi, 'simple'],
    [/\burgent\b/gi, 'timely'],
    [/\bact now\b/gi, ''],
    [/\bclick here\b/gi, ''],
    [/\blimited time\b/gi, ''],
    [/\bboost\b/gi, 'improve'],
    [/!+/g, '.'],
  ];
  function cleanSpam(s) {
    let out = s;
    SPAM_SWAPS.forEach(([re, rep]) => (out = out.replace(re, rep)));
    return out.replace(/[ \t]{2,}/g, ' ').replace(/ \./g, '.').replace(/ \?/g, '?').replace(/ ,/g, ',');
  }

  function firstName(email) {
    if (!email) return null;
    const local = email.split('@')[0].toLowerCase();
    const first = local.split(/[._-]/)[0];
    if (GENERIC_LOCALS.test(first) || GENERIC_LOCALS.test(local)) return null;
    if (!/^[a-z]{3,12}$/.test(first)) return null;
    return first[0].toUpperCase() + first.slice(1);
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  const pick = (arr, seed) => arr[hashStr(seed) % arr.length];
  const plural = (n, one, many) => (n === 1 ? one : many || one + 's');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function share(n) {
    if (n >= 95) return 'almost all';
    if (n >= 70) return 'most';
    if (n >= 50) return 'more than half';
    if (n >= 30) return 'about a third';
    return 'a lot';
  }

  /* ---------------- Compliments (only true ones are used) ---------------- */
  function compliments(a, c) {
    const bs = a.bestseller || {};
    const list = [];
    if (bs.reviewCount >= 20)
      list.push(`${bs.reviewCount} reviews on ${c.product}${bs.rating ? ` with a ${bs.rating} rating` : ''} is seriously impressive.`);
    if (bs.short) {
      list.push(`${c.product} is a great product. I can see why it's one of your best.`);
      list.push(`I really like ${c.product}. It stands out from what I usually see in this space.`);
    }
    if (a.design?.paidTheme || (a.design?.score || 0) >= 75) list.push(`${c.store} looks clean and well put together. You can tell real care went into it.`);
    if (a.socials?.instagram || a.socials?.tiktok) list.push(`I came across ${c.store} and liked the brand right away. Your social presence makes it feel real and trustworthy.`);
    if ((a.productCount || 0) >= 40) list.push(`You've built a solid range at ${c.store}. That takes real work.`);
    if (a.niche && a.niche !== 'General store') list.push(`${c.store} has a strong identity in ${a.niche.toLowerCase()}. It's clear who it's for.`);
    list.push(`I came across ${c.store} and really like what you've built.`);
    return list;
  }

  /* ---------------- Reverse-psychology closes ---------------- */
  const CLOSES = [
    `Might not be a priority right now, and that's fine. Just thought you should know.`,
    `Totally fine if you'd rather leave it as is. Most stores never fix this.`,
    `No pressure at all. If it's not something you care about, feel free to ignore this.`,
    `You may already have this on your list, in which case, ignore me.`,
    `Most store owners won't bother with this. If you're one of the few who will, just reply.`,
    `Not sure it's for you, but if you want to see how I'd do it, just say the word.`,
    `If things are already going great, you can skip this one.`,
  ];
  const GREETS = ['Hi', 'Hey', 'Hello'];
  const LEADS = [
    'One thing is likely costing you orders: ',
    "One thing I noticed: ",
    "The one thing I'd fix first: ",
    "What's likely holding back orders: ",
    'One small thing is getting in the way: ',
  ];
  const SEASON_LINES = ['Best done before {rush}.', 'Worth doing before {rush}.', 'Ideally before {rush}.'];

  /* ---------------- Problem + fix per issue ---------------- */
  const P = {
    no_video: (c) => [
      `{L}${c.product} has no video, so shoppers can't see it in action.`,
      `I'd make a short UGC video of ${c.idea}, the kind that gets people to add to cart.`,
    ],
    few_photos_bestseller: (c) => [
      `{L}${c.product} has only ${c.photos} ${plural(c.photos, 'photo')}, so shoppers can't really see what they're getting.`,
      `I'd add 4–5 clean shots: angles, close-ups and a lifestyle photo.`,
    ],
    few_photos_catalog: (c) => [
      `{L}${c.share(c.cat.fewPhotosPct)} of your products have fewer than 3 photos, which makes shoppers hesitate.`,
      `I'd fill out each gallery with clean angles and lifestyle shots, starting with your bestseller.`,
    ],
    low_res: (c) => [
      `{L}${c.share(c.cat.lowResPct)} of your product photos are low resolution, so they look blurry on phones.`,
      `I'd enhance and resize them so every product looks sharp and premium.`,
    ],
    mixed_ratios: (c) => [
      `{L}your product photos are all different sizes, so collection pages look uneven on mobile.`,
      `I'd resize them into one consistent format so the whole store looks polished.`,
    ],
    slow_mobile: (c) => [
      c.speedSource === 'google'
        ? `{L}${c.domain} scored ${c.speedScore}/100 on Google's mobile speed test, and most shoppers leave slow pages.`
        : `{L}${c.domain} takes about ${c.speedSec}s to load on mobile, and most shoppers leave before it finishes.`,
      `I'd speed it up in 48 hours without changing your design.`,
    ],
    app_bloat: (c) => [
      `{L}${c.apps} app scripts load before your homepage shows, which makes it slow on phones.`,
      `I'd remove what you don't need and keep everything that works.`,
    ],
    thin_desc_bestseller: (c) => [
      `{L}the ${c.product} description is only ${c.descWords} words, so it doesn't answer what shoppers want to know before they commit.`,
      `I'd rewrite it around benefits, sizing and common questions, with the right Google keywords.`,
    ],
    thin_desc_catalog: (c) => [
      `{L}${c.share(c.cat.thinDescPct)} of your product descriptions are under 50 words, so shoppers don't get enough reason to commit.`,
      `I'd rewrite them around benefits and common questions, starting with your bestseller.`,
    ],
    no_reviews: (c) => [
      `{L}${c.product} doesn't show any reviews, and new visitors rarely order without seeing them.`,
      `I'd set up photo reviews and an automatic review request after each order.`,
    ],
    no_email_capture: (c) => [
      `{L}there's no email signup, so visitors who leave never come back.`,
      `I'd set up a simple signup popup and an abandoned-cart email that brings people back automatically.`,
    ],
    no_upsell: (c) => [
      `{L}there's no bundle or "add one more" option, so most customers check out with a single item.`,
      `I'd add a simple bundle on ${c.product} so every order gets bigger.`,
    ],
    no_christmas: (c) => [
      c.season
        ? `{L}there's no ${c.season.gift} section yet, and that's where holiday shoppers start.`
        : `{L}there's no gift section, and gift shoppers search by who they're shopping for, not product names.`,
      `I'd build a gift guide page with a homepage banner, ready in 2–3 days.`,
    ],
    no_pixels: (c) => [
      `{L}there's no Meta or TikTok pixel, so you can't reach visitors again after they leave.`,
      `I'd set up tracking properly in a day so your ads can bring them back.`,
    ],
    old_theme: (c) => [
      `{L}it runs on ${c.theme}, an older Shopify theme that's slower and harder to update.`,
      `I'd move you to a modern, faster theme without losing anything.`,
    ],
    myshopify: (c) => [
      `{L}the store still uses a .myshopify.com address, which makes some shoppers hesitate at checkout.`,
      `I'd connect a proper domain and tidy up the trust signals.`,
    ],
    sold_out: (c) => [
      `{L}${c.share(c.cat.soldOutPct)} of your products show "Sold out", which sends shoppers away.`,
      `I'd reorganize your collections and add back-in-stock alerts.`,
    ],
    no_express: (c) => [
      `{L}${c.product} has no Shop Pay or Apple Pay button, so checkout takes longer than it should.`,
      `I'd switch on one-tap checkout in under an hour.`,
    ],
    weak_seo: (c) => [
      `{L}the store is missing page descriptions and image alt text, so Google barely shows it.`,
      `I'd fix the basics so you start showing up in searches.`,
    ],
    weak_titles: (c) => [
      `{L}${c.share(c.cat.shortTitlePct)} of your product titles are only 1–2 words, so Google and shoppers can't tell what they are.`,
      `I'd rewrite them to be clear and searchable.`,
    ],
    fallback: (c) => [
      `The one thing I'd add is video. Right now shoppers only see photos of ${c.product}.`,
      `I'd make a short UGC video of ${c.idea}.`,
    ],
  };

  const SUBJECTS = {
    no_video: (c) => [`Video for ${c.product}`, `Quick idea for ${c.product}`],
    few_photos_bestseller: (c) => [`Photos on ${c.product}`, `${c.product} photos`],
    few_photos_catalog: (c) => [`Product photos on ${c.store}`],
    low_res: (c) => [`Your product photos`],
    mixed_ratios: (c) => [`Your product grid`],
    slow_mobile: (c) => [`${c.store} on mobile`, `Load time on ${c.store}`],
    app_bloat: (c) => [`${c.store} on mobile`],
    thin_desc_bestseller: (c) => [`The ${c.product} page`],
    thin_desc_catalog: (c) => [`Product pages on ${c.store}`],
    no_reviews: (c) => [`Reviews on ${c.product}`],
    no_email_capture: (c) => [`Visitors to ${c.store}`],
    no_upsell: (c) => [`Bundles on ${c.store}`],
    no_christmas: (c) => [c.season ? `${c.season.name} at ${c.store}` : `Gift page for ${c.store}`],
    no_pixels: (c) => [`Visitors to ${c.store}`],
    old_theme: (c) => [`The theme on ${c.store}`],
    myshopify: (c) => [`Your store address`],
    sold_out: (c) => [`Sold-out items on ${c.store}`],
    no_express: (c) => [`Checkout on ${c.store}`],
    weak_seo: (c) => [`${c.store} on Google`],
    weak_titles: (c) => [`Product titles on ${c.store}`],
    fallback: (c) => [`Quick idea for ${c.store}`],
  };
  const GENERIC_SUBJECTS = (c) => [`Quick note about ${c.store}`, `Question about ${c.store}`, `A thought on ${c.product}`, `${c.store}`];

  const SERVICE_OF = {
    no_video: 'UGC videos',
    few_photos_bestseller: 'Product photography',
    few_photos_catalog: 'Product photography',
    low_res: 'Product photo enhancement',
    mixed_ratios: 'Product photo enhancement',
    slow_mobile: 'Mobile speed optimization',
    app_bloat: 'Mobile speed optimization',
    thin_desc_bestseller: 'Product page optimization',
    thin_desc_catalog: 'Product page optimization',
    no_reviews: 'Reviews setup',
    no_email_capture: 'Email marketing',
    no_upsell: 'Upsells & bundles',
    no_christmas: 'Seasonal / gift page setup',
    no_pixels: 'Ads pixel setup',
    old_theme: 'Store redesign',
    myshopify: 'Store setup',
    sold_out: 'Product optimization',
    no_express: 'Checkout optimization',
    weak_seo: 'SEO optimization',
    weak_titles: 'Product optimization',
    fallback: 'UGC videos',
  };

  const VARIANTS = 6; // "Rewrite" cycles through these

  function buildCtx(a, email, settings) {
    const bs = a.bestseller || {};
    const store = a.storeName || a.domain;
    const sKey = settings.season || 'none';
    const season = sKey !== 'none' && SEASONS[sKey] ? SEASONS[sKey] : null;
    return {
      fname: firstName(email) || (a.owner && a.owner.first) || null,
      store,
      domain: a.domain,
      product: bs.short || 'your bestseller',
      photos: bs.photos ?? 0,
      descWords: bs.descWords ?? 0,
      idea: VIDEO_IDEAS[a.niche] || 'a real person unboxing and using it',
      speedScore: a.speed?.score,
      speedSec: a.speed?.estLoadSec,
      speedSource: a.speed?.source,
      apps: a.speed?.appScripts,
      theme: a.design?.theme || 'an older theme',
      cat: a.catalog || {},
      season,
      share,
      sig: settings.signature || 'Meshach',
      link: settings.includeLink && settings.portfolio ? settings.portfolio : '',
    };
  }

  function pickIssue(a, disabledServices) {
    const off = new Set(disabledServices || []);
    const list = (a.issues || []).filter((i) => P[i.key] && !off.has(SERVICE_OF[i.key]));
    return list[0] ? list[0].key : 'fallback';
  }

  function compose(a, opts, settings) {
    const key = opts.issueKey && P[opts.issueKey] ? opts.issueKey : pickIssue(a, settings.disabledServices);
    const c = buildCtx(a, opts.email, settings);
    const v = Number.isInteger(opts.variant) ? ((opts.variant % VARIANTS) + VARIANTS) % VARIANTS : hashStr(a.domain) % VARIANTS;
    const seed = (part) => `${a.domain}|${v}|${part}`;

    const greet = pick(GREETS, seed('g'));
    const who = c.fname || `${c.store} team`;
    const compliment = pick(compliments(a, c), seed('c'));
    const [rawProblem, fix] = P[key](c);
    const problem = rawProblem.replace('{L}', pick(LEADS, seed('l')));
    const seasonLine = c.season ? ' ' + pick(SEASON_LINES, seed('s')).replace('{rush}', c.season.rush) : '';
    const close = pick(CLOSES, seed('x'));
    const subject = pick([...SUBJECTS[key](c), ...GENERIC_SUBJECTS(c)], seed('subj'));

    let body = `${greet} ${who},\n\n${compliment}\n\n${problem}\n\n${fix}${seasonLine}\n\n${close}`;
    body = cleanSpam(body);
    if (c.link) body += `\n\nSamples: ${c.link}`;
    body += `\n\n${c.sig}`;
    return { key, service: SERVICE_OF[key], variant: v, variants: VARIANTS, subject: cleanSpam(subject), body };
  }

  /* ---------------- Follow-ups ---------------- */
  const SUMMARY = {
    no_video: (c) => `${c.product} has no video yet`,
    few_photos_bestseller: (c) => `${c.product} only has ${c.photos} ${plural(c.photos, 'photo')}`,
    few_photos_catalog: () => `most of your products are short on photos`,
    low_res: () => `a lot of your product photos look blurry on phones`,
    mixed_ratios: () => `your product grid looks uneven on mobile`,
    slow_mobile: () => `the store is slow to load on mobile`,
    app_bloat: () => `extra app scripts are slowing the store down`,
    thin_desc_bestseller: (c) => `the ${c.product} description is very short`,
    thin_desc_catalog: () => `most product descriptions are very short`,
    no_reviews: (c) => `${c.product} isn't showing any reviews`,
    no_email_capture: () => `there's no email signup to bring visitors back`,
    no_upsell: () => `there's no bundle option to grow each order`,
    no_christmas: (c) => (c.season ? `there's no ${c.season.gift} section yet` : `there's no gift section yet`),
    no_pixels: () => `visitors can't be reached again after they leave`,
    old_theme: () => `the store is on an older, slower theme`,
    myshopify: () => `the store still uses a .myshopify.com address`,
    sold_out: () => `a lot of products are showing "Sold out"`,
    no_express: () => `there's no one-tap checkout button`,
    weak_seo: () => `Google can barely find the store`,
    weak_titles: () => `the product titles are too short to be found`,
    fallback: (c) => `${c.product} could use a short video`,
  };
  const FU1_OPEN = [
    'Just floating this back up in case it got buried.',
    'Bumping this to the top of your inbox.',
    'Quick follow-up on my last note.',
  ];
  const FU1_CLOSE = [
    `If it's not a priority, no worries at all. A simple "not now" is fine too.`,
    `Totally fine if the timing is off. Just let me know either way.`,
    `No pressure. If you'd rather leave it, I won't keep pushing.`,
  ];
  const FU2_OPEN = [
    `I'll stop reaching out after this one.`,
    `Last note from me on this, I promise.`,
    `I don't want to crowd your inbox, so this is my last message.`,
  ];

  // stage = 1 (first follow-up) or 2 (final follow-up)
  function composeFollowup(a, opts, settings) {
    const key = opts.issueKey && SUMMARY[opts.issueKey] ? opts.issueKey : pickIssue(a, settings.disabledServices);
    const c = buildCtx(a, opts.email, settings);
    const seed = (p) => `${a.domain}|fu${opts.stage}|${p}`;
    const who = c.fname || `${c.store} team`;
    const sum = SUMMARY[key](c);
    const orig = (opts.subject || `${c.store}`).replace(/^(re:\s*)+/i, '');
    let body;
    if (opts.stage >= 2) {
      const wish = c.season ? `Wishing ${c.store} a great ${c.season.name}.` : `Wishing ${c.store} all the best.`;
      body = `${pick(GREETS, seed('g'))} ${who},\n\n${pick(FU2_OPEN, seed('o'))}\n\nIf fixing the fact that ${sum} ever becomes a priority, just reply here and I'll pick it up.\n\n${wish}`;
    } else {
      const seasonLine = c.season ? ` ${pick(SEASON_LINES, seed('s')).replace('{rush}', c.season.rush)}` : '';
      body = `${pick(GREETS, seed('g'))} ${who},\n\n${pick(FU1_OPEN, seed('o'))}\n\nQuick recap: ${sum}, and I can fix that for you.${seasonLine}\n\n${pick(FU1_CLOSE, seed('x'))}`;
    }
    body = cleanSpam(body);
    body += `\n\n${c.sig}`;
    return { subject: cleanSpam(`Re: ${orig}`), body, stage: opts.stage };
  }

  global.Pitches = {
    compose,
    composeFollowup,
    pickIssue,
    cleanSpam,
    SERVICE_OF,
    SERVICES: [...new Set(Object.values(SERVICE_OF))],
    SEASONS,
    daysTo,
    firstName,
  };
})(window);
