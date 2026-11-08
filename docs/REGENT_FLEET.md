# Regent demonstration fleet

A public showroom at `/fleet/regent`, also linked from Shop → Collection, demonstrates four separately illustrated ship classes: Sovereign battleship, Viscount heavy cruiser, Corsair destroyer, and Sentinel armoured launch. Each has a distinct hull, deck arrangement, armament and silhouette. The showroom and actual board use the same transparent 448 KB WebP atlas, with cropping shared by `RegentArtwork`.

The showroom offers standard-fleet comparison, four class selectors, and interactive hit/miss/sinking previews. Signed-in players can start a real AI trial with the full ten-ship Regent fleet. Guests can inspect the collection without authentication.

The server restricts this cosmetic override to an ordinary AI demo. It grants no ownership, charges no currency, disables consumable boosters, and awards no progress, rewards, statistics or history entries. A rematch remains a demo. Existing equipped cosmetics remain unchanged. Opponent ship rendering uses their public cosmetic identifier; hidden ship positions remain private.

This is a demonstration, not a purchasable collection. Existing prices and collections are unchanged. Four independent sprites are packed into one atlas to reduce requests. CSS sizing applies only to the outer thumbnail SVG, so nested crop viewports retain their dimensions.

Validation: production frontend build; 58 backend tests including demo settlement and cosmetic access; two mobile browser tests covering the public showroom and a real AI trial. Mobile artwork crops were additionally inspected visually. Publishing the branch does not update the VPS; use the existing preview deployment process to apply it.
