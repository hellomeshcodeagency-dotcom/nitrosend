/* NitroSend — pitch engine
 * Every email = greeting → HOOK (a specific fact about their store) → Christmas reason → offer → yes/no question.
 * Written to stay out of spam: no "free", "sale(s)", "buy", "save", "offer", "deal", "guarantee",
 * no percentages, no money amounts, no exclamation marks, no ALL CAPS.
 * Edit the templates freely. Placeholders come from ctx (see buildCtx).
 */
(function (global) {
  'use strict';

  const VIDEO_IDEAS = {
    'Pet supplies': 'a dog or cat actually using it',
    'Beauty & skincare': 'a real customer applying it',
    'Hair care': 'a quick before-and-after',
    'Fashion & apparel': 'a try-on haul',
    'Jewelry & accessories': 'a gift-unboxing reaction',
    'Home & decor': 'a cozy room reveal',
    Kitchen: 'a 15-second recipe using it',
    'Tech & gadgets': 'a quick unboxing and demo',
    Fitness: 'a real workout using it',
    'Supplements & wellness': 'a morning-routine clip',
    'Baby & kids': 'a parent showing it in action',
    'Outdoor & travel': 'it being used outdoors',
    Automotive: 'a quick install and demo in a real car',
  };

  const GENERIC_LOCALS = /^(info|hello|hi|hey|support|contact|sales|admin|team|shop|store|orders?|help|care|customercare|customerservice|service|office|mail|marketing|partnerships?|press|wholesale|enquiries|inquiries|billing|general|returns|accounts?|business|ecom|online|web|webmaster)$/;

  // Words that commonly push cold emails into spam. Used as a final safety pass on every email.
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
    return out.replace(/[ \t]{2,}/g, ' ').replace(/ \./g, '.').replace(/ \?/g, '?');
  }

  function daysToChristmas(now = new Date()) {
    const xmas = new Date(now.getFullYear(), 11, 25);
    return Math.ceil((xmas - now) / 864e5);
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
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function plural(n, one, many) {
    return n === 1 ? one : many || one + 's';
  }

  // Turns a percentage into words, so emails carry no "%" signs.
  function share(n) {
    if (n >= 95) return 'almost all';
    if (n >= 70) return 'most';
    if (n >= 50) return 'more than half';
    if (n >= 30) return 'about a third';
    return 'a lot';
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function buildCtx(a, email, settings) {
    const days = daysToChristmas();
    const bs = a.bestseller || {};
    const store = a.storeName || a.domain;
    return {
      name: firstName(email) || `${store} team`,
      store,
      domain: a.domain,
      product: bs.short || 'your bestseller',
      photos: bs.photos ?? 0,
      descWords: bs.descWords ?? 0,
      idea: VIDEO_IDEAS[a.niche] || 'a real person unboxing and using it',
      when: days > 1 ? `${days} days before Christmas` : days >= 0 ? 'right before Christmas' : 'ahead of the New Year',
      season: days >= 0 ? 'Christmas' : 'New Year',
      speedScore: a.speed?.score,
      speedSec: a.speed?.estLoadSec,
      speedSource: a.speed?.source,
      apps: a.speed?.appScripts,
      theme: a.design?.theme || 'an older theme',
      cat: a.catalog || {},
      share,
      cap,
      sig: settings.signature || 'Meshach',
      link: settings.includeLink && settings.portfolio ? settings.portfolio : '',
    };
  }

  /* ---- Templates: each returns [subject, bodyCore]; bodyCore excludes greeting and sign-off ---- */
  const T = {
    no_video: [
      (c) => [
        `Video idea for ${c.product}`,
        `${c.product} has ${c.photos} ${plural(c.photos, 'photo')} and no video, ${c.when}.\n\nGift shoppers scroll fast. A 20-second clip of ${c.idea} stops them better than any photo.\n\nI make UGC videos for Shopify brands. Want me to send a quick concept for ${c.product}?`,
      ],
      (c) => [
        `Quick thought on ${c.product}`,
        `I pictured ${c.idea} for your ${c.product}. It would make a scroll-stopping ${c.season} video.\n\nRight now the page has no video, and that's usually where holiday shoppers drop off.\n\nI create UGC videos for Shopify stores. Should I send you the idea?`,
      ],
    ],
    few_photos_bestseller: [
      (c) => [
        `Photos on ${c.product}`,
        `Your bestseller, ${c.product}, has only ${c.photos} ${plural(c.photos, 'photo')}. ${c.season} shoppers can't touch it, so they need to see every angle.\n\nI can create 5–6 clean product images (angles, close-ups, lifestyle) before the holiday rush.\n\nWant to see what I'd add?`,
      ],
      (c) => [
        `More angles for ${c.product}?`,
        `${c.product} is showing just ${c.photos} ${plural(c.photos, 'image')}, ${c.when}.\n\nMore angles and a lifestyle shot answer the "is this a good gift?" question before people leave.\n\nI do product photos for Shopify stores. Want me to mock up a few for ${c.product}?`,
      ],
    ],
    few_photos_catalog: [
      (c) => [
        `Product photos on ${c.store}`,
        `${c.cap(c.share(c.cat.fewPhotosPct))} of the products on ${c.store} have fewer than 3 photos, ${c.when}.\n\nGift shoppers go for what they can clearly see.\n\nI create clean product and lifestyle images for Shopify stores. Want me to start with your bestseller?`,
      ],
    ],
    low_res: [
      (c) => [
        `Your product photos on mobile`,
        `${c.cap(c.share(c.cat.lowResPct))} of your product photos are under 800px wide, so they look soft on the phones most ${c.season} shoppers use.\n\nSharp images make a store look more premium.\n\nI enhance product photos for Shopify stores. Want me to redo one so you can see the difference?`,
      ],
    ],
    mixed_ratios: [
      (c) => [
        `Your product grid on ${c.store}`,
        `Your collection pages mix different photo sizes, so the grid looks uneven, especially on mobile.\n\nA clean, consistent grid makes ${c.store} look like a brand worth gifting from this ${c.season}.\n\nI can resize and tidy every product image. Want a before/after of one collection?`,
      ],
    ],
    slow_mobile: [
      (c) => [
        `${c.domain} on mobile`,
        (c.speedSource === 'google'
          ? `${c.domain} scored ${c.speedScore}/100 on Google's mobile speed test.`
          : `${c.domain} took about ${c.speedSec}s to load in my mobile test.`) +
          `\n\nMost ${c.season} shoppers are on phones, and many leave before a slow page finishes loading.\n\nI speed up Shopify stores in 48 hours, no redesign needed. Want me to send what's slowing it down?`,
      ],
      (c) => [
        `Load time on ${c.store}`,
        `I tested ${c.store} on mobile and it's slower than most stores I check (about ${c.speedSec}s).\n\nWith ${c.season} traffic coming, every extra second costs you shoppers.\n\nI fix Shopify speed issues without breaking anything. Should I send you the 3 biggest fixes?`,
      ],
    ],
    app_bloat: [
      (c) => [
        `${c.store} and its apps`,
        `${c.apps} different app scripts load before your homepage even shows up.\n\nThat's a big reason stores feel slow on phones, right when ${c.season} traffic peaks.\n\nI clean up app clutter on Shopify stores without losing features. Want a quick list of what can go?`,
      ],
    ],
    thin_desc_bestseller: [
      (c) => [
        `The ${c.product} page`,
        `Your bestseller, ${c.product}, has a ${c.descWords}-word description. That's the spot where ${c.season} gift shoppers decide.\n\nI rewrite product pages around benefits, sizing, a gift angle and Google keywords.\n\nWant me to rewrite ${c.product} as a sample?`,
      ],
    ],
    thin_desc_catalog: [
      (c) => [
        `Product pages on ${c.store}`,
        `${c.cap(c.share(c.cat.thinDescPct))} of the product descriptions on ${c.store} are under 50 words, ${c.when}.\n\nShort pages don't answer shopper questions, and they don't rank on Google either.\n\nI optimize Shopify product pages. Want me to redo your bestseller first?`,
      ],
    ],
    no_reviews: [
      (c) => [
        `Reviews on ${c.product}?`,
        `I couldn't find a single review on ${c.product}. At ${c.season}, people pick what others already trust.\n\nI can set up photo reviews and an automatic review-request email, so trust builds before the rush.\n\nWant me to set it up for ${c.store}?`,
      ],
    ],
    no_email_capture: [
      (c) => [
        `${c.store} visitors this ${c.season}`,
        `Every shopper who leaves ${c.store} this ${c.season} is gone for good. There's no email signup to bring them back.\n\nI set up signup popups and abandoned-cart emails that bring people back automatically.\n\nWant to see how it would look on your store?`,
      ],
    ],
    no_upsell: [
      (c) => [
        `Gift bundles for ${c.store}`,
        `${c.season} shoppers pick gifts in twos and threes, but ${c.store} has no bundle or "add one more" option.\n\nA simple bundle with ${c.product} raises the size of every order right when traffic peaks.\n\nWant me to set it up for you?`,
      ],
    ],
    no_christmas: [
      (c) => [
        `${c.store} and Christmas`,
        `${c.store} doesn't have a Christmas gift section yet, ${c.when}. Gift shoppers search "gifts for her", not product names.\n\nI can build a gift guide page, holiday banner and shipping-cutoff countdown in 2–3 days.\n\nWant me to put it together?`,
      ],
      (c) => [
        `Christmas page for ${c.store}?`,
        `I looked for a Christmas or gift page on ${c.store} and couldn't find one.\n\nThat's where most holiday shoppers start, and ${c.product} would fit perfectly in a "Top Gifts" section.\n\nI set up Christmas pages for Shopify stores. Should I send a quick mockup?`,
      ],
    ],
    no_pixels: [
      (c) => [
        `${c.season} visitors to ${c.store}`,
        `There's no Meta or TikTok pixel on ${c.domain}, so every ${c.season} visitor who leaves can't be reached again.\n\nReaching people who already visited is the easiest win of the season.\n\nI set up pixels and tracking properly in a day. Want me to do it before the rush?`,
      ],
    ],
    old_theme: [
      (c) => [
        `The theme on ${c.store}`,
        `${c.store} runs on ${c.theme}, an older Shopify theme that's slower and harder to update.\n\nA modern theme gives you faster pages and drag-and-drop Christmas sections.\n\nI can move you over without losing anything. Want a quick preview of how it'd look?`,
      ],
    ],
    myshopify: [
      (c) => [
        `Your store address`,
        `${c.store} still uses a .myshopify.com address. Many ${c.season} shoppers don't trust that at checkout.\n\nA proper domain plus a quick trust cleanup makes you look like an established brand.\n\nI can set it all up in a day. Want me to handle it?`,
      ],
    ],
    sold_out: [
      (c) => [
        `Sold-out items on ${c.store}`,
        `${c.cap(c.share(c.cat.soldOutPct))} of the products on ${c.store} show "Sold out", ${c.when}.\n\nThat's space where gift shoppers should see things they can get.\n\nI can reorganize your collections and add back-in-stock alerts. Want me to set it up?`,
      ],
    ],
    no_express: [
      (c) => [
        `Checkout on ${c.product}`,
        `${c.product} has no Shop Pay, Apple Pay or Google Pay button on the product page.\n\nOne-tap checkout matters most at ${c.season}, when people are shopping on their phones in a hurry.\n\nI can switch it on and tidy up checkout in an hour. Want me to?`,
      ],
    ],
    weak_seo: [
      (c) => [
        `${c.store} on Google`,
        `${c.store} is missing basic Google setup: page descriptions and image alt text.\n\n${c.season} gift searches are picking up now, and these are quick fixes.\n\nI do Shopify SEO cleanups in a few days. Want me to send what I'd fix first?`,
      ],
    ],
    weak_titles: [
      (c) => [
        `Product titles on ${c.store}`,
        `${c.cap(c.share(c.cat.shortTitlePct))} of your product titles are just 1–2 words, so Google and shoppers can't tell what they are.\n\nClear, descriptive titles bring in ${c.season} gift searches.\n\nI optimize Shopify product titles and pages. Want me to redo your top 5 as a sample?`,
      ],
    ],
    fallback: [
      (c) => [
        `${c.season} idea for ${c.store}`,
        `I was looking at ${c.product} on ${c.store} and pictured ${c.idea}. It would make a great ${c.season} video.\n\nShort, real-person videos are what's working best this season.\n\nI make UGC videos for Shopify brands. Want me to send a quick concept?`,
      ],
    ],
  };

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
    no_christmas: 'Christmas store setup',
    no_pixels: 'Ads pixel setup',
    old_theme: 'Store redesign',
    myshopify: 'Store setup',
    sold_out: 'Product optimization',
    no_express: 'Checkout optimization',
    weak_seo: 'SEO optimization',
    weak_titles: 'Product optimization',
    fallback: 'UGC videos',
  };

  function pickIssue(a, disabledServices) {
    const off = new Set(disabledServices || []);
    const list = (a.issues || []).filter((i) => T[i.key] && !off.has(SERVICE_OF[i.key]));
    return list[0] ? list[0].key : 'fallback';
  }

  function compose(a, opts, settings) {
    const email = opts.email;
    const key = opts.issueKey && T[opts.issueKey] ? opts.issueKey : pickIssue(a, settings.disabledServices);
    const c = buildCtx(a, email, settings);
    const variants = T[key];
    const idx = (((opts.variant ?? hashStr(a.domain)) % variants.length) + variants.length) % variants.length;
    const [subject, core] = variants[idx](c);
    let body = `Hi ${c.name},\n\n${cleanSpam(core)}`;
    if (c.link) body += `\n\nSamples: ${c.link}`;
    body += `\n\n${c.sig}`;
    return { key, service: SERVICE_OF[key], variant: idx, variants: variants.length, subject: cleanSpam(subject), body };
  }

  global.Pitches = { compose, pickIssue, cleanSpam, SERVICE_OF, SERVICES: [...new Set(Object.values(SERVICE_OF))], daysToChristmas, firstName };
})(window);
