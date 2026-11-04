# Naval interface: home, quests and shop

This design lives on `design/naval-home`, based on
`claude/telegram-game-development-qdhatm` at `323e7aa`.
It does not change the production deployment or the source branch.

## What changed

- Cinematic battleship hero, illustrated game modes and captain avatar fallback.
- Live profile balances, rank, campaign completion and daily rewards.
- Shared wordmark, wallet, navigation and steel-blue components on home, quests
  and shop. Battle, ranking, profile and other screens retain their theme.
- Daily reward calendar, quest progress, claim states and a horizontally
  scrollable free/premium pass track, with all rewards read from the catalog.
- Illustrated starter offer and all five gem packs, plus the existing
  collection, boosters, exchange, ads and legal links.
- Pending reward/purchase actions reject duplicate taps and recover after errors.
- Existing ads, starter offer, pass, quests, referrals and season link remain
  available under “Задания, пропуск и предложения”.
- Russian and English text, Telegram safe areas, narrow-screen layout and
  keyboard focus states.

The concepts' sample rewards and prices are replaced by the game's catalog.
No catalog, backend, authentication or payment-fulfilment logic is changed.
The concept's sample “Silver II” rank is replaced by the game's actual rank
and rating. Player photos and equipped avatar frames are preserved.

## Assets

`frontend/public/art/naval/hero.webp` and `modes.webp` are locally served
artwork generated for this design, compressed to WebP (about 432 KiB total).
`modes.webp` is a 2×2 atlas: radar, island, fleet and captain. CSS selects the
quadrants; buttons and all text remain HTML, not baked into the artwork.
`starter.svg` and `gems.svg` add the starter-pack illustration and a 2×2
product-art atlas. These SVG containers embed compressed WebP images, so the
artwork can be stored through the GitHub text-tree API without external hosting. Product illustrations are decorative;
quantities, prices, purchase IDs and ownership state remain data-driven.
The gem atlas has a true alpha background and tightly framed objects. Square
sprite cells preserve their proportions; the art uses no painted backplates or
edge masks and scales up to 144 CSS pixels inside the product cards.

## Run locally

```sh
npm ci
npm run build
```

For interactive development, use the existing backend/database setup described
in README, with development login enabled only in the local environment.
Then run `npm run dev`. No authentication bypass or preview data is included
in the production application.

## Validation

The production frontend build and browser checks are run before committing.
Browser preview uses an isolated sample profile and mocked API responses, without
contacting production or changing player data. Checks cover reward claim payloads,
pending/claimed states, error retries, pass eligibility, product prices, invoice
product IDs, cosmetic tabs, boosters and exchange, plus responsive layouts.
A real Telegram session is still needed to verify
Telegram-specific authentication, payments and native safe-area insets.
