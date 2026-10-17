/* NitroSend — pitch engine
 * Every email = greeting → HOOK (a specific fact about their store) → Christmas reason → offer → yes/no question.
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

  function daysToChristmas(now = new Date()) {
    const xmas = new Date(now.getFullYear(), 11, 25);
    const d = Math.ceil((xmas - now) / 864e5);
    return d;
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

  function buildCtx(a, email, settings) {
    const days = daysToChristmas();
    const bs = a.bestseller || {};
    const store = a.storeName || a.domain;
    return {
      name: firstName(email) || `${store} team`,
      store,
      domain: a.domain,
      product: bs.short || 'your bestseller',
      hasProduct: !!bs.short,
      photos: bs.photos ?? 0,
      descWords: bs.descWords ?? 0,
      reviews: bs.reviewCount || 0,
      niche: a.niche,
      idea: VIDEO_IDEAS[a.niche] || 'a real person unboxing and using it',
      days,
      when: days > 1 ? `${days} days before Christmas` : days >= 0 ? 'right before Christmas' : 'ahead of the New Year sales',
      season: days >= 0 ? 'Christmas' : 'New Year',
      speedScore: a.speed?.score,
      speedSec: a.speed?.estLoadSec,
      speedSource: a.speed?.source,
      apps: a.speed?.appScripts,
      theme: a.design?.theme || 'an older theme',
      cat: a.catalog || {},
      pp: (n) => (n >= 95 ? 'Almost all' : `${n}%`),
      sig: settings.signature || 'Meshach',
      link: settings.includeLink && settings.portfolio ? settings.portfolio : '',
    };
  }

  /* ---- Templates: each returns [subject, bodyCore] ; bodyCore excludes greeting and sign-off ---- */
  const T = {
    no_video: [
      (c) => [
        `${c.product} needs a video before ${c.season}`,
        `${c.product} has ${c.photos} ${plural(c.photos, 'photo')} and zero video, ${c.when}.\n\nGift shoppers scroll fast. A 20-second clip of ${c.idea} stops them better than any photo.\n\nI make UGC videos for Shopify brands. Want me to send a quick concept for ${c.product}?`,
      ],
      (c) => [
        `Quick video idea for ${c.product}`,
        `I pictured ${c.idea} for your ${c.product}, and it would make a scroll-stopping ${c.season} ad.\n\nRight now the page has no video, and that's where holiday buyers usually drop off.\n\nI create UGC videos for Shopify stores. Should I send you the idea?`,
      ],
    ],
    few_photos_bestseller: [
      (c) => [
        `Only ${c.photos} ${plural(c.photos, 'photo')} on ${c.product}?`,
        `Your bestseller, ${c.product}, has only ${c.photos} ${plural(c.photos, 'photo')}. ${c.season} shoppers can't touch it, so they need to see every angle.\n\nI can create 5–6 clean product images (angles, close-ups, lifestyle) before the holiday rush.\n\nWant to see what I'd add?`,
      ],
      (c) => [
        `Gift buyers want to see more of ${c.product}`,
        `${c.product} is selling with just ${c.photos} ${plural(c.photos, 'image')}, ${c.when}.\n\nMore angles and a lifestyle shot answer the "is this worth it as a gift?" question before they leave.\n\nI do product photos for Shopify stores. Want me to mock up a few for ${c.product}?`,
      ],
    ],
    few_photos_catalog: [
      (c) => [
        `${c.pp(c.cat.fewPhotosPct)} of your products have under 3 photos`,
        `${c.pp(c.cat.fewPhotosPct)} of the products on ${c.store} have fewer than 3 photos, ${c.when}.\n\nGift shoppers buy what they can clearly see, and thin galleries cost sales.\n\nI create clean product and lifestyle images for Shopify stores. Want me to start with your bestseller?`,
      ],
    ],
    low_res: [
      (c) => [
        `Your product photos look blurry on phones`,
        `${c.pp(c.cat.lowResPct)} of your product photos are under 800px wide, so they look soft on the phones most ${c.season} shoppers use.\n\nSharp images look more premium and convert better.\n\nI enhance product photos for Shopify stores. Want me to fix one free so you can see the difference?`,
      ],
    ],
    mixed_ratios: [
      (c) => [
        `Your product grid looks uneven`,
        `Your collection pages mix different photo sizes, so the grid looks messy, especially on mobile.\n\nA clean, consistent grid makes ${c.store} look like a brand worth gifting from this ${c.season}.\n\nI can resize and clean up every product image. Want a before/after of one collection?`,
      ],
    ],
    slow_mobile: [
      (c) => [
        `${c.domain} is slow on mobile`,
        (c.speedSource === 'google'
          ? `${c.domain} scored ${c.speedScore}/100 on Google's mobile speed test.`
          : `${c.domain} took about ${c.speedSec}s to load in my mobile test.`) +
          `\n\nMost ${c.season} traffic is on phones, and many shoppers leave before a slow page finishes loading.\n\nI speed up Shopify stores in 48 hours, no redesign needed. Want me to send what's slowing it down?`,
      ],
      (c) => [
        `Losing ${c.season} shoppers to load time?`,
        `I tested ${c.store} on mobile and it's slower than most stores I check (about ${c.speedSec}s).\n\nWith ${c.season} ads and traffic coming, every extra second leaks sales.\n\nI fix Shopify speed issues fast, without breaking anything. Should I send you the 3 biggest fixes?`,
      ],
    ],
    app_bloat: [
      (c) => [
        `${c.apps} apps are slowing ${c.store} down`,
        `${c.apps} different app scripts load before your homepage even shows up.\n\nThat's a big reason stores feel slow on phones, right when ${c.season} traffic peaks.\n\nI clean up app bloat on Shopify stores without losing features. Want a quick list of what can go?`,
      ],
    ],
    thin_desc_bestseller: [
      (c) => [
        `${c.product}'s description is only ${c.descWords} words`,
        `Your bestseller, ${c.product}, has a ${c.descWords}-word description. That's the spot where ${c.season} gift buyers decide.\n\nI rewrite product pages to sell: benefits, sizing, a gift angle, and Google-friendly keywords.\n\nWant me to rewrite ${c.product} as a free sample?`,
      ],
    ],
    thin_desc_catalog: [
      (c) => [
        `${c.pp(c.cat.thinDescPct)} of your product pages are too short`,
        `${c.pp(c.cat.thinDescPct)} of the product descriptions on ${c.store} are under 50 words, ${c.when}.\n\nShort pages don't answer buyer questions, and they don't rank on Google either.\n\nI optimize Shopify product pages for sales and SEO. Want me to redo your bestseller first?`,
      ],
    ],
    no_reviews: [
      (c) => [
        `No reviews on ${c.product}?`,
        `I couldn't find a single review on ${c.product}. At ${c.season}, people buy what others already trust.\n\nI can set up photo reviews and an automatic review-request email, so proof builds before the rush.\n\nWant me to set it up for ${c.store}?`,
      ],
    ],
    no_email_capture: [
      (c) => [
        `${c.store} is losing ${c.season} visitors for good`,
        `Every shopper who leaves ${c.store} this ${c.season} is gone for good. There's no email signup to bring them back.\n\nI set up popups and abandoned-cart emails that recover sales on autopilot.\n\nWant to see how it would look on your store?`,
      ],
    ],
    no_upsell: [
      (c) => [
        `${c.season} shoppers buy in 2s and 3s`,
        `${c.season} shoppers buy gifts in twos and threes, but ${c.store} has no bundle or "add one more" offer.\n\nA simple "Buy 2, save 10%" on ${c.product} lifts order value right when traffic peaks.\n\nWant me to set it up for you?`,
      ],
    ],
    no_christmas: [
      (c) => [
        `${c.store} isn't ready for Christmas yet`,
        `${c.store} doesn't have a Christmas gift section yet, ${c.when}. Gift shoppers search "gifts for her", not product names.\n\nI can build a gift guide page, holiday banner and shipping-cutoff countdown in 2–3 days.\n\nWant me to put it together?`,
      ],
      (c) => [
        `Christmas gift page for ${c.store}?`,
        `I looked for a Christmas or gift page on ${c.store} and couldn't find one.\n\nThat's where most holiday shoppers start, and ${c.product} would fit perfectly in a "Top Gifts" section.\n\nI set up Christmas pages for Shopify stores. Should I send a quick mockup?`,
      ],
    ],
    no_pixels: [
      (c) => [
        `${c.season} visitors can't be retargeted`,
        `There's no Meta or TikTok pixel on ${c.domain}, so every ${c.season} visitor who leaves can't be shown your ads again.\n\nRetargeting is usually the cheapest sale you'll get all season.\n\nI set up pixels and tracking properly in a day. Want me to do it before the rush?`,
      ],
    ],
    old_theme: [
      (c) => [
        `${c.store} is on an outdated Shopify theme`,
        `${c.store} runs on ${c.theme}, an older Shopify theme that's slower and harder to update.\n\nA modern theme gives you faster pages and drag-and-drop Christmas sections.\n\nI can move you over without losing anything. Want a quick preview of how it'd look?`,
      ],
    ],
    myshopify: [
      (c) => [
        `Your store still uses .myshopify.com`,
        `${c.store} still uses a .myshopify.com address. Many ${c.season} shoppers don't trust that at checkout.\n\nA proper domain plus a quick trust cleanup makes you look like an established brand.\n\nI can set it all up in a day. Want me to handle it?`,
      ],
    ],
    sold_out: [
      (c) => [
        `${c.pp(c.cat.soldOutPct)} of your store shows "Sold out"`,
        `${c.pp(c.cat.soldOutPct)} of the products on ${c.store} show "Sold out", ${c.when}.\n\nThat's wasted space where gift shoppers should see things they can buy.\n\nI can reorganize your collections and add back-in-stock alerts so no visitor is wasted. Want me to set it up?`,
      ],
    ],
    no_express: [
      (c) => [
        `No Shop Pay button on ${c.product}`,
        `${c.product} has no Shop Pay, Apple Pay or Google Pay button on the product page.\n\nOne-tap checkout matters most at ${c.season}, when people are buying on their phones in a hurry.\n\nI can switch it on and tidy up checkout in an hour. Want me to?`,
      ],
    ],
    weak_seo: [
      (c) => [
        `${c.store} is hard to find on Google`,
        `${c.store} is missing basic Google setup: page descriptions and image alt text.\n\n${c.season} gift searches are peaking now, and these are quick wins.\n\nI do Shopify SEO cleanups in a few days. Want me to send what I'd fix first?`,
      ],
    ],
    weak_titles: [
      (c) => [
        `Your product titles are too short to rank`,
        `${c.pp(c.cat.shortTitlePct)} of your product titles are just 1–2 words, so Google and shoppers can't tell what they are.\n\nClear, keyword-rich titles bring in ${c.season} gift searches.\n\nI optimize Shopify product titles and pages. Want me to redo your top 5 as a sample?`,
      ],
    ],
    fallback: [
      (c) => [
        `${c.season} idea for ${c.store}`,
        `I was looking at ${c.product} on ${c.store} and pictured ${c.idea}. It would make a great ${c.season} ad.\n\nShort, real-person videos are what's converting best this season.\n\nI make UGC videos for Shopify brands. Want me to send a quick concept?`,
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
    const idx = ((opts.variant ?? hashStr(a.domain)) % variants.length + variants.length) % variants.length;
    const [subject, core] = variants[idx](c);
    let body = `Hi ${c.name},\n\n${core}`;
    if (c.link) body += `\n\nSamples: ${c.link}`;
    body += `\n\n${c.sig}`;
    return { key, service: SERVICE_OF[key], variant: idx, variants: variants.length, subject, body };
  }

  global.Pitches = { compose, pickIssue, SERVICE_OF, SERVICES: [...new Set(Object.values(SERVICE_OF))], daysToChristmas, firstName };
})(window);
