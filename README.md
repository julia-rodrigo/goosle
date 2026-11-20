# Goosle

A calm way to watch YouTube. You see what you chose to see, and nothing else.

- **Your feed is only your subscriptions**, newest first. No algorithm, no "recommended for you".
- **No Shorts, no AI slop.** Shorts are hidden, and videos whose title, channel or description match AI/slop phrases ("ai generated", "#aiart", "suno", "reddit stories", …) are filtered out. You can edit the list.
- **Block anything.** Block a channel with one click, or block words and topics.
- **No recommendations on the watch page.** The space beside the player shows your Watch later list instead. The player is set so the end screen only shows the same channel.
- **No ads on the site, no account, no tracking.** Subscriptions, history and Watch later live in your browser. Export/import them from Filters.
- **Bring your YouTube subscriptions** from a Google Takeout `subscriptions.csv`, or add channels by `@handle` or link.
- Paste any YouTube link into the search box to jump straight to it.

Every filter shows how many videos it hid, with a "Show anyway" link, so nothing disappears silently.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

It works without any setup. Optionally, add a free YouTube Data API key for more reliable search and fuller video details (views, length, description on the watch page):

```bash
cp .env.example .env.local
# then put your key in YOUTUBE_API_KEY
```

## How it gets data

| What | Without a key | With `YOUTUBE_API_KEY` |
| --- | --- | --- |
| Subscription feed | Public channel RSS feeds | same (RSS is free and costs no quota) |
| Search | Reads the public results page; Shorts shelves and ads are dropped | YouTube Data API |
| Video page | oEmbed (title, channel) | YouTube Data API (plus views, date, description) |
| Adding a channel | Reads the channel page for its id | YouTube Data API |

Videos play through the official embedded player from `youtube-nocookie.com`.

## About ads

Goosle itself has no ads. Videos still play in YouTube's own embedded player, and YouTube may show its ads there on some monetized videos; Goosle doesn't strip them, since that would mean bypassing YouTube's player. If you have YouTube Premium and are signed in to YouTube in the same browser, the embedded player is ad-free.

## Project layout

```
app/              pages (feed, search, watch, channel, subscriptions, later, history, settings)
app/api/          server routes that talk to YouTube
lib/youtube.ts    all YouTube access (RSS, API, page fallback)
lib/filters.ts    Shorts / slop / blocked-word / blocked-channel rules
lib/store.ts      local-only user data (localStorage)
components/       UI pieces
```

The previous version of this repo is kept on the `legacy` branch.
