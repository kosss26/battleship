# Regent demonstration fleet

A public showroom at `/fleet/regent`, also linked from Shop → Collection, demonstrates four separately illustrated ship classes: Sovereign battleship, Viscount heavy cruiser, Corsair destroyer, and Sentinel armoured launch. Each has a distinct hull, deck arrangement, armament and silhouette. The showroom and actual board use the same transparent 448 KB WebP atlas, with cropping shared by `RegentArtwork`.

The showroom offers standard-fleet comparison, four class selectors, and interactive hit/miss/sinking previews. Signed-in players can start a real AI trial with the full ten-ship Regent fleet, Regent Sound board and Regent Salvo effects. Guests can inspect the collection without authentication.

The server restricts this cosmetic override to an ordinary AI demo. It grants no ownership, charges no currency, disables consumable boosters, and awards no progress, rewards, statistics or history entries. A rematch remains a demo. Existing equipped cosmetics remain unchanged. Opponent ship rendering uses their public cosmetic identifier; hidden ship positions remain private.

This is a demonstration, not a purchasable collection. Existing prices and collections are unchanged. Four independent sprites are packed into one atlas to reduce requests. CSS sizing applies only to the outer thumbnail SVG, so nested crop viewports retain their dimensions.

Validation: production frontend build; 59 backend tests including demo settlement and cosmetic access; mobile browser tests covering the public showroom a real AI trial, transient shell/impact cleanup, preview resets, reduced-motion marks and responsive layouts. Mobile artwork crops were additionally inspected visually. Publishing the branch does not update the VPS; use the existing preview deployment process to apply it.

The dedicated Regent Sound surface is a 36 KB 1024px WebP. Brass survey marks and coordinate styling overlay its subdued sea texture. Regent Salvo uses vector/CSS steel-tipped shells, warm impact flashes, metal fragments and short-lived smoke; misses create a silver water plume with rings and spray. Sinking adds a whole-hull shadow, foam and a widening wake. Persistent hit, miss and wreck marks remain distinct with reduced motion. The same 300ms flight and 1400ms impact lifetime as other cosmetics preserves turn pacing. Switching a showroom preset or resetting cancels previous preview animations and timers.

The complete demo set is selected centrally by `battleCosmetics` for placement, waiting, combat, result previews and rematches. None of the three demo items can be purchased or equipped outside the trial. Heavy CSS drop shadows were removed from the large ship artwork and thumbnails to eliminate the detached dark slab under the hull.

The trial includes the Order of Regent avatar frame (cast brass, laurels and crown), previewed in the showroom and applied only to trial match profiles. It grants no ownership. Both trial seats wear the complete demonstration set. Normal PvP matches instead publish each participant’s equipped cosmetic identifiers, without hidden fleet data. The enemy board defaults to that opponent’s ships and waters; a locally remembered Appearance choice can render it with your own set. Shot effects always belong to the shooter. Both sides can be reviewed after the battle.

Battle results use one universal Battleship design for every set and game mode: naval battle report, medal, player identities, four statistics, rewards and optional review of both boards. The Regent cosmetic does not replace the report interface. Telegram 8.0+ requests native fullscreen at startup; older or unsupported clients keep the expanded view. Native safe-area and content-safe-area events update the top, bottom and landscape side insets.
