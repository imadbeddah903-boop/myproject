/*
 * Google AdSense loader for InkSpire.
 * Disabled until a real Publisher ID is configured.
 */
(function () {
  'use strict';

  var ADSENSE_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';
  var enabled = false;

  if (!enabled || !/^ca-pub-\\d{10,20}$/.test(ADSENSE_CLIENT)) {
    console.log('[AdSense] Disabled — waiting for Publisher ID');
    return;
  }

  var script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ADSENSE_CLIENT);
  document.head.appendChild(script);

  window.adsbygoogle = window.adsbygoogle || [];
})();
