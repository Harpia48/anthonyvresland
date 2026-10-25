"""Render approved book data into a static local prototype. Python standard library only."""
import argparse
import html
import json
from pathlib import Path
import re
from string import Template
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def escape(value):
    return html.escape(str(value), quote=True)


def validate(data, root=ROOT):
    if data.get("schemaVersion") != 1:
        raise ValueError("Unsupported book-data schema")
    site = urlsplit(data["siteUrl"])
    if site.scheme != "https" or site.netloc != "anthonyvresland.com" or site.path:
        raise ValueError("Expected the verified site origin")
    books = {}
    slugs = set()
    for book in data["books"]:
        for key in ("id", "catalogueAnchor"):
            if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", book[key]):
                raise ValueError(f"Unsafe {key}")
        if book["id"] in books:
            raise ValueError("Duplicate book id")
        for key in ("title", "description", "sources"):
            if not book.get(key):
                raise ValueError(f"Missing verified {key}")
        url = urlsplit(book["amazonUrl"])
        if url.scheme != "https" or url.netloc not in ("a.co", "www.amazon.com"):
            raise ValueError("Purchase link must use a verified Amazon host")
        cover = book["cover"]
        if not cover.startswith("/assets/") or ".." in cover.split("/"):
            raise ValueError("Cover must be an existing local asset")
        if not (root / cover.lstrip("/")).is_file():
            raise ValueError(f"Missing cover: {cover}")
        if book.get("landingSlug"):
            slug = book["landingSlug"]
            if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug) or slug in slugs:
                raise ValueError("Unsafe or duplicate landing slug")
            if any(not isinstance(book.get(k), int) or book[k] <= 0 for k in ("coverWidth", "coverHeight")):
                raise ValueError("Landing pages require verified cover dimensions")
            slugs.add(slug)
        books[book["id"]] = book
    if data["featuredBook"] not in books or not books[data["featuredBook"]].get("landingSlug"):
        raise ValueError("Featured book needs an approved landing page")
    for book in books.values():
        related = book.get("related", [])
        if len(set(related)) != len(related) or any(i not in books or i == book["id"] for i in related):
            raise ValueError("Related books must be distinct existing records")
    return books


def related_section(book, books):
    related = [books[i] for i in book.get("related", [])]
    if not related:
        return ""
    cards = []
    for item in related:
        cards.append(f'''<article class="publishing-related-card">
  <img src="{escape(item['cover'])}" alt="{escape(item['title'])} — book cover" width="170" height="272" loading="lazy">
  <h3>{escape(item['title'])}</h3><p>{escape(item['description'])}</p>
  <a class="publishing-button publishing-button-secondary" href="{escape(item['amazonUrl'])}" target="_blank" rel="noopener noreferrer" data-book-id="{escape(item['id'])}" data-action="amazon-click" aria-label="Buy {escape(item['title'])} on Amazon (opens in a new tab)">Buy on Amazon <span class="publishing-new-tab">(opens in a new tab)</span></a>
</article>''')
    return f'''<section id="related-reading" class="publishing-related" aria-labelledby="related-title">
  <div class="publishing-container">
    <div class="publishing-section-heading"><div><p class="publishing-eyebrow">Related reading</p><h2 id="related-title">{escape(book.get("relatedHeading", "Related reading"))}</h2></div><a class="publishing-text-link" href="/books">View all books →</a></div>
    <div class="publishing-related-grid">''' + "\n".join(cards) + "</div>\n  </div>\n</section>"


def render(book, data, books, template, release=False):
    url = data["siteUrl"] + "/" + book["landingSlug"]
    author = data["author"]
    schema = {"@context": "https://schema.org", "@type": "Book", "name": book["title"],
              "description": book["description"], "url": url, "image": data["siteUrl"] + book["cover"],
              "author": {"@type": "Person", "name": author["name"], "url": data["siteUrl"] + author["aboutPath"]}}
    values = {"title": book["title"], "meta_description": f"{book['title']} by {author['name']}. {book['description']}",
              "canonical": url, "cover_url": data["siteUrl"] + book["cover"], "cover": book["cover"],
              "cover_width": book["coverWidth"], "cover_height": book["coverHeight"], "description": book["description"],
              "author_name": author["name"], "author_path": author["aboutPath"], "author_roles": author["roles"],
              "amazon_url": book["amazonUrl"], "book_id": book["id"],
              "robots": "index, follow, max-image-preview:large" if release else "noindex, nofollow"}
    values = {k: escape(v) for k, v in values.items()}
    values["structured_data"] = json.dumps(schema, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    values["related_section"] = related_section(book, books)
    return Template(template).substitute(values)


def feature(book):
    return f'''<section class="publishing-feature" aria-labelledby="featured-plato-title">
  <div class="publishing-container"><div class="publishing-feature-inner">
    <img src="{escape(book['cover'])}" alt="{escape(book['title'])} — book cover" width="{book['coverWidth']}" height="{book['coverHeight']}" loading="lazy">
    <div><p class="publishing-eyebrow">Featured book</p><h2 id="featured-plato-title">{escape(book['title'])}</h2><p class="publishing-lead">{escape(book['description'])}</p>
      <div class="publishing-actions"><a class="publishing-button publishing-button-primary" href="/{escape(book['landingSlug'])}">Explore the book</a><a class="publishing-button publishing-button-secondary" href="{escape(book['amazonUrl'])}" target="_blank" rel="noopener noreferrer">Buy on Amazon <span class="publishing-new-tab">(opens in a new tab)</span></a></div>
    </div>
  </div></div>
</section>'''


def replace_block(source, name, content):
    start, end = f"<!-- publishing:{name}:start -->", f"<!-- publishing:{name}:end -->"
    if source.count(start) != 1 or source.count(end) != 1:
        raise ValueError(f"Expected one {name} integration block")
    before, rest = source.split(start)
    _, after = rest.split(end)
    return before + start + "\n" + content + "\n" + end + after


def outputs(release=False):
    data = json.loads((ROOT / "data/books.json").read_text(encoding="utf-8"))
    books = validate(data)
    template = (ROOT / "templates/book.html").read_text(encoding="utf-8")
    result = {ROOT / (b["landingSlug"] + ".html"): render(b, data, books, template, release) for b in books.values() if b.get("landingSlug")}
    featured = books[data["featuredBook"]]
    home = ROOT / "index.html"
    result[home] = replace_block(home.read_text(encoding="utf-8"), "feature", feature(featured))
    catalogue = ROOT / "books.html"
    detail = f'<a class="publishing-catalogue-detail" href="/{escape(featured["landingSlug"])}">Explore this book</a>'
    result[catalogue] = replace_block(catalogue.read_text(encoding="utf-8"), "catalogue-detail", detail)
    if release:
        import xml.etree.ElementTree as ET
        sitemap = ROOT / "sitemap.xml"
        source = sitemap.read_text(encoding="utf-8")
        urls = {node.text for node in ET.fromstring(source).iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")}
        additions = []
        for book in books.values():
            if book.get("landingSlug"):
                url = data["siteUrl"] + "/" + book["landingSlug"]
                if url not in urls:
                    additions.append(f"  <url><loc>{escape(url)}</loc></url>")
        result[sitemap] = source.replace("</urlset>", "\n".join(additions) + "\n</urlset>") if additions else source
        result[ROOT / "assets/book-pages.css"] = (ROOT / "assets/book-pages.css").read_text(encoding="utf-8")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check generated outputs without writing")
    parser.add_argument("--release", action="store_true", help="Prepare indexable pages and sitemap in a separate local directory; never deploys")
    parser.add_argument("--output-dir", type=Path, help="Separate output directory (required for --release)")
    args = parser.parse_args()
    target = args.output_dir.resolve() if args.output_dir else ROOT
    if args.release and (not args.output_dir or target == ROOT or target.is_relative_to(ROOT)):
        parser.error("Release candidates must be written outside the website repository")
    stale = []
    for source_path, content in outputs(args.release).items():
        path = target / source_path.relative_to(ROOT)
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                stale.append(path.name)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="\n")
            print("Rendered", path.name)
    if stale:
        raise SystemExit("Generated output differs: " + ", ".join(stale))
    if args.check:
        print("All generated publishing outputs match their data and template.")


if __name__ == "__main__":
    main()
