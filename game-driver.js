/*
 * game-driver.js — neutral offline replacement for the GameSnacks SDK.
 * Implements the exact surface used by this game:
 *   GameSnacks.storage.setItem/getItem   -> localStorage passthrough
 *   GameSnacks.audio.isEnabled/subscribe -> always enabled
 *   GameSnacks.game.ready/levelComplete/gameOver, GameSnacks.score.update -> no-op
 *   GameSnacks.ad.break(options)         -> Google H5 Games Ads semantics:
 *     type "reward":       call options.beforeReward(showAdFn); showAdFn runs
 *                          beforeAd -> adViewed -> afterAd when the game calls it
 *                          (player chose to watch).
 *     type "interstitial": beforeAd -> afterAd -> adBreakDone({breakStatus:'dismissed'}).
 *   Every callback is invoked asynchronously and never throws.
 */
(function () {
  'use strict';

  var ROOT = (typeof window !== 'undefined') ? window : globalThis;

  function log() {
    try { console.log.apply(console, ['[GameDriver]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  function safe(fn) {
    setTimeout(function () {
      try { fn(); } catch (e) { log('callback error', e && e.message); }
    }, 0);
  }

  var GameDriver = {
    _audioSubscribers: [],

    storage: {
      setItem: function (key, value) {
        try { ROOT.localStorage.setItem(key, value); } catch (e) {}
      },
      getItem: function (key) {
        try { return ROOT.localStorage.getItem(key); } catch (e) { return null; }
      }
    },

    audio: {
      isEnabled: function () { return true; },
      subscribe: function (cb) {
        if (typeof cb === 'function') {
          GameDriver._audioSubscribers.push(cb);
          safe(function () { cb(true); });
        }
      }
    },

    game: {
      ready: function () { log('game.ready'); },
      levelComplete: function (n) { log('game.levelComplete', n); },
      gameOver: function () { log('game.gameOver'); }
    },

    score: {
      update: function (n) { log('score.update', n); }
    },

    ad: {
      break: function (options) {
        options = options || {};
        var type = options.type || 'interstitial';
        log('ad.break called: type=' + type + ' keys=' + Object.keys(options).join(','));

        // Per the H5 Games Ads API, adBreakDone is ALWAYS invoked exactly once,
        // no matter what happened with the ad itself.
        var doneCalled = false;
        var callDone = function (status) {
          if (doneCalled || typeof options.adBreakDone !== 'function') return;
          doneCalled = true;
          safe(function () {
            options.adBreakDone({ breakFormat: type, breakStatus: status });
          });
        };

        if (type === 'reward') {
          // Ad is "instantly ready": hand the game its showAdFn.
          if (typeof options.beforeReward === 'function') {
            safe(function () {
              log('ad.break(reward): calling beforeReward(showAdFn)');
              options.beforeReward(function showAdFn() {
                log('showAdFn: game invoked it -> running ad flow');
                // Player accepted to watch (no real ad): run the full flow now.
                safe(function () {
                  if (typeof options.beforeAd === 'function') options.beforeAd();
                  if (typeof options.adViewed === 'function') options.adViewed();
                  else if (typeof options.adDismissed === 'function') options.adDismissed();
                  if (typeof options.afterAd === 'function') options.afterAd();
                  callDone('viewed');
                  log('reward flow complete: adBreakDone(viewed) sent');
                });
              });
            });
          } else {
            log('ad.break(reward): no beforeReward -> adBreakDone(noAdPreloaded)');
            callDone('noAdPreloaded');
          }
          // Safety net: if the game never calls showAdFn, still terminate the
          // break after a grace period so the flow can never hang forever.
          setTimeout(function () { callDone('dismissed'); log('reward safety net: adBreakDone(dismissed)'); }, 30000);
          return;
        }

        // interstitial (default): skip straight through the lifecycle.
        safe(function () {
          if (typeof options.beforeAd === 'function') options.beforeAd();
          if (typeof options.afterAd === 'function') options.afterAd();
          callDone('dismissed');
        });
      }
    }
  };

  ROOT.GameDriver = GameDriver;

  // Expose under the name the game calls, keeping GameDriver as the neutral alias.
  if (typeof ROOT.GameSnacks === 'undefined') {
    ROOT.GameSnacks = GameDriver;
  }

  // Global recovery hook: if the engine shows its crash dialog, reload once (30s cooldown).
  var lastReload = 0;
  ROOT.addEventListener('error', function () {
    var now = Date.now();
    if (now - lastReload > 30000) {
      var dlg = document.getElementById('GameDiv');
      if (dlg && dlg.getAttribute('data-crashed') === '1') {
        lastReload = now;
        ROOT.location.reload();
      }
    }
  }, true);

  log('ready (offline mode)');
})();
