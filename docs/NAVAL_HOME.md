# Naval interface and fleet collections

This design lives on `design/naval-home`, based on
`claude/telegram-game-development-qdhatm` at `323e7aa`.
It does not change the production deployment or the source branch.

## What changed

- Cinematic battleship hero, illustrated game modes and captain avatar fallback.
- Live profile balances, rank, campaign completion and daily rewards.
- Shared wordmark, wallet, navigation and steel-blue components on home, quests
  and shop. Battle, ranking, profile and other screens retain their layout.
  Cosmetic rendering is described in the fleet-collections section below.
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
Existing reward and product prices are preserved. New cosmetic catalog entries
are described below; backend authentication and payment-fulfilment logic are
unchanged.
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

## Fleet collections and fitting room

The Collection tab includes Arctic and Imperial Fleet looks. The new items are
`ship_arctic` (180 gems) and `theme_imperial` (450 gems). The existing
`theme_arctic` (3,000 gold) and `ship_royal` (500 gems) retain their IDs, prices
and ownership. Royal receives the detailed navy/brass ship model as a visual
upgrade; the new Polar model uses winter camouflage and ice-blue lights.
The separate `fx_arctic` (180 gems) and `fx_imperial` (250 gems) packs add
matching shell, hit, miss and sinking animations in the existing effect slot.

Each collection is a curated look, not a new bundled product: its board,
ship skin and effect pack are bought and equipped separately through the
existing endpoints. Existing effect ownership and prices are preserved.
The native modal fitting room renders the real Board and Ship components with
a deterministic valid fleet. Shots are simulated with the shared engine in
local component state, with no matchmaking or socket calls. Opening/closing a
preview never equips or purchases anything. The modal traps keyboard focus,
supports Escape and restores focus when closed.

`fleet-collections.css` applies cosmetic water materials only; cells, fleet
sizes, hit markers and rules remain unchanged. The illustrated shop banners
use locally served `collections.svg`; actual gameplay uses detailed SVG ship
models with unique gradient/clip IDs for all deck lengths and orientations.

Validation includes pure backend purchase/equip tests, existing engine tests,
and browser checks for both collections, 320–768px layout, local-only preview,
focus restoration, pending purchases, ownership/equip states and English text.
Purchase errors are shown inside the fitting room, so insufficient-balance and
retry feedback remain visible above the native modal backdrop.

## Combat effects

The fitting room has explicit Hit, Miss and Sinking replay buttons and can
preview any effect individually on the currently equipped board and ships.
Preview shots use local engine state only. Matching packs use bounded CSS
particles, transform/opacity animation, foam, mist and a whole-hull sinking wake.
The basic and other existing effects retain their original visual treatments.

All shells use the same 300ms flight from `game/animation.js`; impact markers,
splashes, hull reveal and sinking share the Board's landing clock. Previously
known hits stay visible while a final shell is airborne, and a newly sunk enemy
hull/auto-marked halo does not reveal early. Concurrent shots have independent
timers; completed timers are removed and all work is cancelled on unmount.

When the final ship sinks, results wait for the remaining presentation (at most
300ms flight + 1400ms impact). The server's completed match state is never
delayed or changed. Resignations, disconnects and reconnects do not wait for
unavailable animation history. Reduced motion displays static result markers
immediately, skips particles/sinking movement and removes the extra result delay.

Validation: production build; pure cosmetic/engine/presentation-timing tests;
Chromium checks for both packs and their legacy counterparts, independent rapid
shots, pre-impact hit preservation, delayed wreck/halo reveal, transient cleanup,
separate effect buy/equip/error-retry flow, 320–768px layout and reduced motion.
GIF demonstrations are recordings of the running fitting room, not mockups.
