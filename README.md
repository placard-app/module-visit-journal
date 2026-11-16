# Visit Journal

Keep private dated notes for each place in Placard. Add a visit on the place detail page, read visits newest first, and delete entries you no longer need. Entries are private to the signed-in user, even when the place is shared.

## Install

Upload `dist/places.visit-journal-0.1.1.placard-module` in Placard's module marketplace, enable it, and make it visible in your module settings. The host must support SDK 1 and the `place-sections` and `persistent-data` capabilities.

## Build and test

Use Node 24 or later. Run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`. The build produces a zip and a `.placard-module` archive in `dist/`.

Journal data lives in the host's module data directory and survives module updates and reinstalls. Back up the modules volume, including hidden directories, while writers are stopped. Placard's personal library export does not include module data.
