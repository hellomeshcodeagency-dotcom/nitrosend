# NitroSend — by MeshCode

You paste store links. NitroSend reads each store, finds the contact email, and spots the store's biggest problem. Then it writes a short, Christmas-angled email that opens with a hook about that problem. Click **Send** and the email opens ready to go, the same way TurboSend works.

## Files

```
nitrosend/
├── netlify.toml                    # Netlify config + /api/analyze route
├── netlify/functions/analyze.js    # The store analyzer
└── public/
    ├── index.html                  # The app (Load / Send / Settings)
    └── pitches.js                  # Email templates and hooks (edit freely)
```

## Deploy on Netlify (GitHub web upload)

1. Create a GitHub repo and upload everything, keeping the same folders.
2. Netlify → **Add new site → Import from GitHub** → pick the repo. Leave the build command empty.
3. Open the site. Done.

No list size limit: paste as many links as you want. Each store uses one function run on Netlify, so keep an eye on **Netlify → Usage** if you analyze very large lists every day.

## How to use

1. **Load:** paste store links (or upload a CSV/TXT) and click **Analyze stores**. If a CSV row also has an email, NitroSend uses it.
2. **Send:** every analyzed store shows with its email, the problem found, and the written email.
   - **⚡ Send / Send next** (or press **N**) opens the email.
   - **Analysis** shows the full report, and you can pick a different problem to pitch.
   - **Rewrite** switches to another version of the email.
   - **Edit** lets you change the subject or body.
   - Tabs: Ready, Hot (strongest leads), Sent, No email, Failed.
3. **Settings:**
   - Your sign-off and an optional portfolio link.
   - Services to pitch (untick ones you don't want).
   - Sender accounts plus a daily cap. NitroSend rotates through them and skips any that hit the cap.
   - Send mode: **mailto** (default mail app) or **Gmail in browser** (opens the right account automatically).
   - Optional Google PageSpeed API key for real mobile scores.

Everything is saved in your browser, so you can close the tab and continue later. Use **Export CSV** to back up.

## What it checks

| Area | Checks |
|---|---|
| Contact | Emails from homepage, contact page, store policies, Cloudflare-protected emails |
| Bestseller | Photos, low-res photos, video, description length, reviews, price, sale price |
| Product photos | Products with under 3 photos, low-res images, uneven image sizes |
| Product pages | Thin descriptions, short titles, missing alt text, sold-out products |
| Mobile speed | Server response, page weight, app scripts, render-blocking scripts (or Google PageSpeed with a key) |
| Design | Theme (old / free / paid), custom domain, homepage video, announcement bar |
| Marketing | Reviews, email/SMS, upsell, and video apps; Meta/Google/TikTok pixels; express checkout |
| Christmas | Holiday collections, homepage mention, countdown |
| Traffic | Estimated tier (Low/Medium/High) from reviews, pixels, apps, catalog size, socials, theme |

## Problems → services it pitches

UGC videos · Product photography · Product photo enhancement · Mobile speed optimization · Product page optimization · Product optimization · Reviews setup · Email marketing · Upsells & bundles · Christmas store setup · Ads pixel setup · Store redesign · Store setup · Checkout optimization · SEO optimization

Every email follows the same pattern: greeting, a **hook** with a real fact about their store, the Christmas reason, your offer, and a yes/no question. Most emails are 45–60 words.

## Notes

- Traffic is an **estimate** from public signals, not real visitor numbers.
- The speed number is an estimate unless you add a PageSpeed key.
- Stores that block bots, are password-protected, or are down will show as **Failed**. Use **Retry failed** later.
