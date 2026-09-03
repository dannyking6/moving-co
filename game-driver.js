/*
 * game-driver.js — neutral offline driver replacing the GameSnacks platform SDK.
 * Implements the exact surface the game calls: game lifecycle, audio, storage,
 * score, and the H5-games ad-break flow (all callbacks resolve instantly,
 * "viewed" outcome, no network).
 */
(function () {
  "use strict";
  var TAG = "[GameDriver]";
  function log() {
    try { console.debug.apply(console, [TAG].concat([].slice.call(arguments))); } catch (e) {}
  }
  function fn(f) { return typeof f === "function" ? f : null; }

  var GameSnacks = {
    version: "offline-driver-1.0.0",

    game: {
      ready: function () { log("game.ready"); },
      firstFrameReady: function () { log("game.firstFrameReady"); },
      gameOver: function () { log("game.gameOver"); },
      levelComplete: function (n) { log("game.levelComplete", n); },
      onPause: function (cb) {
        cb = fn(cb);
        document.addEventListener("visibilitychange", function () {
          if (document.hidden && cb) { log("game.onPause fire"); cb(); }
        });
      },
      onResume: function (cb) {
        cb = fn(cb);
        document.addEventListener("visibilitychange", function () {
          if (!document.hidden && cb) { log("game.onResume fire"); cb(); }
        });
      }
    },

    audio: {
      isEnabled: function () { return true; },
      subscribe: function (cb) {
        cb = fn(cb);
        // Defer until after page load so engine bridges (c2_callFunction etc.)
        // are already installed by the game runtime.
        if (cb) {
          var fire = function () { try { cb(true); } catch (e) { log("audio cb err", e); } };
          if (document.readyState === "complete") setTimeout(fire, 300);
          else window.addEventListener("load", function () { setTimeout(fire, 300); });
        }
      }
    },

    storage: {
      // Synchronous string semantics: also valid as `await GameSnacks.storage.getItem(k)`.
      getItem: function (k) {
        try { return window.localStorage.getItem(k); } catch (e) { return null; }
      },
      setItem: function (k, v) {
        try { window.localStorage.setItem(k, v); } catch (e) {}
      }
    },

    score: {
      update: function (n) { log("score.update", n); }
    },

    ad: {
      break: function (opts) {
        opts = opts || {};
        log("ad.break type=" + opts.type);
        var isReward = opts.type === "reward";
        var settled = false;
        var finish = function (status) {
          if (settled) return;
          settled = true;
          var a = fn(opts.afterAd); if (a) a();
          var d = fn(opts.adBreakDone);
          if (d) d({ breakStatus: status, type: opts.type || "next" });
        };
        var b = fn(opts.beforeAd); if (b) b();
        if (isReward) {
          // H5 ads reward flow: the game decides WHEN to show the ad by calling
          // showAdFn(). Only then may adViewed fire. If it never accepts, the
          // break ends as "dismissed" (never call adViewed/adDismissed).
          var br = fn(opts.beforeReward);
          if (br) {
            br(function showAdFn() {
              log("showAdFn called -> adViewed");
              var v = fn(opts.adViewed);
              if (v) v();
              finish("viewed");
            });
            // no acceptance within 400ms -> dismissed (covers menu flows that
            // only probe availability)
            setTimeout(function () { finish("dismissed"); }, 400);
          } else {
            finish("dismissed");
          }
        } else {
          // Interstitial: beforeAd -> afterAd -> adBreakDone. adViewed is part
          // of the reward flow only and must NOT fire here.
          finish("viewed");
        }
      }
    }
  };

  // Guard: engines (Construct/Phaser) install the real c2_callFunction later.
  // A no-op here keeps any early bridge call harmless; the runtime overwrites it.
  if (typeof window.c2_callFunction !== "function") {
    window.c2_callFunction = function () {};
  }

  // Offline firewall: neutralize any cross-origin fetch/XHR the game (or a
  // dormant feature like community levels) may attempt. Same-origin requests
  // are untouched. External fetch resolves with ok:false; XHR fires onerror.
  var _origFetch = window.fetch;
  if (_origFetch) {
    window.fetch = function (input, init) {
      try {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        if (/^(https?:)?\/\//i.test(url) && url.indexOf(location.origin + "/") !== 0) {
          log("fetch blocked (offline):", url);
          return Promise.resolve(new Response("", { status: 499, statusText: "offline" }));
        }
      } catch (e) {}
      return _origFetch.apply(window, arguments);
    };
  }
  var _origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      if (/^(https?:)?\/\//i.test(url) && url.indexOf(location.origin + "/") !== 0) {
        log("xhr blocked (offline):", url);
        arguments[1] = "data:text/plain,offline";
      }
    } catch (e) {}
    return _origOpen.apply(this, arguments);
  };

  window.GameSnacks = GameSnacks;
  window.GameDriver = GameSnacks; // alias for debugging

  window.addEventListener("error", function (e) {
    log("window.onerror:", e.message, e.filename, e.lineno);
  });
  log("initialized");
})();
