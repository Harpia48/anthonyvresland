# Essays & Journal publishing

Publish complete articles on https://fatlots.blogspot.com/. The website displays metadata, images and short descriptions, linking to each original Blogger post.

## Editorial categories

Add any of these exact Blogger labels to include an entry in a category filter:

- Philosophy & Ancient Wisdom
- Mythology Decoded
- Research & Discoveries
- Author's Notebook
- The Academy

Posts without these labels remain in All Entries. Other Blogger labels are displayed on cards but are not guessed or mapped into editorial categories. Use consistent label spelling and capitalisation, because Blogger's label-specific feed URLs use exact label names.

## News and featured essays

Use `News`, `Book Announcement`, or `Author Update` to include a post in Latest News. The three newest matching posts appear there. These labels are publishing controls, separate from the five editorial categories.

Use `Featured` or `Major Essay` for major essays. The newest such essay appears prominently. Without either label, the newest non-news post on the first archive page is featured automatically. Older major essays remain in the chronological archive. Give every post a proper Blogger title; body heading and permalink recovery are fallback measures for untitled posts.

## Automatic retrieval and archive

Cloudflare Pages Functions serve `/essays` and `/api/essays`. Retrieval occurs server-side, avoiding Blogger browser CORS restrictions. Successful query responses are cached for 15 minutes. Category filters, Blogger search and older/newer pagination request the appropriate upstream feed page, rather than filtering only the first hundred posts. Filters and search work without client JavaScript. Open pages refresh periodically, without replacing a form while it is being used.

If Blogger is unavailable, `data/essays.json` provides a metadata snapshot and a visible notice. A snapshot is not permanent storage for every newly fetched entry; Blogger remains the source of truth. Missing images are omitted. No new paid services, secrets, or application dependencies are required.

## Checks and Cloudflare deployment

Run `node --test tools/essays.test.mjs`. `node tools/verify-preservation.mjs` compares the original 81 repository files against the pre-journal commit, allowing navigation and the new sitemap entry only.

The existing Cloudflare Pages project is `anthonyvresland`, with production branch `main`, repository `Harpia48/anthonyvresland`, repository-root assets, and no build command. Pages compiles the root `functions/` directory automatically. `_routes.json` limits function execution to the new journal and API paths. Do not replace the project or change its custom domains. Native Pages builds and Wrangler deploys support the functions; static drag-and-drop alone does not.

For Cloudflare runtime QA, run `npx wrangler pages dev . --port 8788 --compatibility-date 2025-09-17` from the checkout. For the lightweight Node preview, run `node tools/preview-essays.mjs`. No framework migration is needed.
