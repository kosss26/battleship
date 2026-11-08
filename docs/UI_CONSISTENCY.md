# Naval interface consistency

The production interface uses one steel-blue naval surface for centered dialogs and bottom sheets. Overlays render in a portal attached to `document.body`, so route animation transforms cannot turn viewport positioning into page-relative positioning. Safe-area padding, bounded height and internal scrolling keep controls reachable. The overlay stack locks background scroll, traps Tab in the top window, restores focus when closed and handles Escape without dismissing a required seasonal claim.

Settings, seasonal rewards, season results, reward receipts, duel invites, surrender and account-deletion confirmations share these surfaces. Season emblems and ranks use vector artwork, restrained theme accents and the same typography as the main game. Claim endpoints, rewards, seasonal progression and confirmation rules are unchanged.

`PlayerAvatar` renders both `Avatar` and `CaptainAvatar`. Profile, standings, shop, friends and battles therefore use the same aperture, photo crop and frame geometry. The Regent face is centered at 81% of the frame viewport, matching the inside of its metal ring; the ornament uses the same 100% viewport instead of an oversized 116% overlay. Relative dimensions remain correct at small and large sizes. Broken photos fall back to the existing captain artwork or initials.

Profile medals now use `MedalArt` and `achievementMedal`, exactly like the achievements page. Artwork follows the achievement identifier/stat instead of the position on the shelf; retired identifiers no longer inflate the catalog count. Reward receipts and battle-result achievements use that same mapping.

The browser regression suite also revealed a route-effect race during resume: the active room could arrive while a navigation from `/battle` to `/` was still pending. Including the current route in the active-game redirect dependencies makes the subsequent navigation return to the room. No server rules or progress data change.

Verification covers artwork parity, portrait/ornament bounds at 390px and 320px, season claim and receipt, required dialog behavior, keyboard focus, touch scrolling, background scroll restoration, account deletion, invites and actual battles. Production build and browser checks run before publication. Deployment follows [RELEASE.md](RELEASE.md); publishing does not activate the VPS automatically.

Validation result: the complete browser run passed 24 of 25 scenarios and exposed the resume-route race described above. After the dependency fix, all three appearance/fullscreen scenarios passed twice; the final four recovery, medal, avatar and season-dialog checks passed. The production build and whitespace check passed. The unchanged server foundation was validated by the prior 62-test server run; no balance, ownership or reward rules changed here.
