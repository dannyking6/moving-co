# Box Hauler — Offline Build 🚚📦

You run a small-town hauling company: drag, flip and cram sofas, fridges,
pianos and boxes into the truck, then drive carefully so nothing breaks.
A charming physics-packing puzzle with a garage full of household chaos
levels, unlockable trucks and a satisfying "everything fits" payoff.

A 100% self-contained offline build: every image, sound and font is bundled —
no ads, no tracking, no network required. Playable from GitHub Pages or fully
offline.

## Controls

| Device | Action |
|---|---|
| Smartphone / tablet | Drag items with your finger; two-finger rotate; drag with 2 fingers to move the camera |
| Desktop, mouse | Left-click-drag to move items; right button / wheel to rotate; wheel to zoom |
| Trackpad | Single-finger drag to move; two-finger rotate gesture |
| Keyboard | Not required |

## What was changed for the offline build

- Removed the GameSnacks platform SDK and all network/analytics calls.
- Added `game-driver.js`: a neutral local driver implementing the exact
  surface the game expects (lifecycle, audio, storage, score, ad-break
  callbacks with the spec reward flow).
- Interstitial/reward ad breaks resolve instantly and locally — no
  third-party ads, no frozen callbacks.
- Save data (level progress, coins) is stored in localStorage.
- An offline firewall in the driver blocks any cross-origin `fetch`/XHR.
- All Cocos Creator bundles, scenes and assets are served locally.

## Run it

The build needs to be served over HTTP (not `file://`):

```bash
./serve.sh          # then open http://localhost:8080
# or: python3 -m http.server 8080
```

Or simply visit the GitHub Pages URL of this repository.

## Credits

Original game by its respective authors, mirrored from the GameSnacks catalog
for offline play. No game code was modified — only the platform wrapper was
replaced with a neutral local driver.
