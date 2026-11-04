# Naval home screen

This design lives on `design/naval-home`, based on
`claude/telegram-game-development-qdhatm` at `323e7aa`.
It does not change the production deployment or the source branch.

## What changed

- Cinematic battleship hero, illustrated game modes and captain avatar fallback.
- Live profile balances, rank, campaign completion and daily rewards.
- Home navigation styled to match the concept; other screens retain their theme.
- Existing ads, starter offer, pass, quests, referrals and season link remain
  available under “Задания, пропуск и предложения”.
- Russian and English text, Telegram safe areas, narrow-screen layout and
  keyboard focus states.

The concept's sample “Silver II” rank is replaced by the game's actual rank
and rating. Player photos and equipped avatar frames are preserved.

## Assets

`frontend/public/art/naval/hero.webp` and `modes.webp` are locally served
artwork generated for this design, compressed to WebP (about 432 KiB total).
`modes.webp` is a 2×2 atlas: radar, island, fleet and captain. CSS selects the
quadrants; buttons and all text remain HTML, not baked into the artwork.

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
Browser preview uses an isolated sample profile, without contacting production
or changing player data. A real Telegram session is still needed to verify
Telegram-specific authentication, payments and native safe-area insets.
