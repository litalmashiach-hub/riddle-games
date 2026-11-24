// TEST ONLY. Added to the app's page on the test branch, after the build, to report what the web view itself
// measures. It changes nothing the player sees or does. Its report is the label of an invisible element,
// which the UI test reads, and a console line.
(function () {
  var haptics = { calls: 0, ok: 0, failed: 0, last: '' };
  var seen = { selection: 0, menus: 0, pageScroll: 0, zoom: 1 };
  function wrapBridge() {
    var cap = window.Capacitor;
    if (!cap || !cap.nativePromise || cap.nativePromise.__feel) return;
    var real = cap.nativePromise;
    cap.nativePromise = function (plugin, method, options) {
      var p = real.apply(cap, arguments);
      if (plugin === 'Haptics') {
        haptics.calls++;
        haptics.last = method + ' ' + JSON.stringify(options);
        p.then(function () { haptics.ok++; }, function (e) { haptics.failed++; haptics.last += ' ERROR ' + (e && e.message); });
      }
      return p;
    };
    cap.nativePromise.__feel = true;
  }
  document.addEventListener('selectionchange', function () { if (String(getSelection()).length) seen.selection++; });
  document.addEventListener('contextmenu', function (e) { setTimeout(function () { if (!e.defaultPrevented) seen.menus++; }, 0); });
  window.addEventListener('scroll', function () { if (scrollX || scrollY) seen.pageScroll++; });
  function insets() {
    var d = document.createElement('div');
    d.setAttribute('data-feel', '1');
    d.style.cssText = 'position:fixed;visibility:hidden;top:env(safe-area-inset-top);left:env(safe-area-inset-left);right:env(safe-area-inset-right);bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(d);
    var r = d.getBoundingClientRect();
    d.remove();
    return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(innerWidth - r.right), bottom: Math.round(innerHeight - r.bottom) };
  }
  function shows(el) {
    for (var e = el; e && e !== document.documentElement; e = e.parentElement) {
      var s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
    }
    return true;
  }
  function audit(ins) {
    var W = innerWidth, H = innerHeight, bad = [], count = 0, min = { left: 9999, right: 9999, top: 9999, bottom: 9999 };
    var all = document.querySelectorAll('body *');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.tagName === 'CANVAS' || el.closest('[role="status"]') || el.closest('[data-feel]')) continue;
      var control = el.matches('button, a[href], [role="button"], [role="switch"], [role="tab"]');
      if (!control && (el.closest('[aria-hidden="true"]') || el.closest('button, a[href]'))) continue;
      var text = '';
      for (var j = 0; j < el.childNodes.length; j++) if (el.childNodes[j].nodeType === 3) text += el.childNodes[j].textContent.trim() + ' ';
      text = text.trim();
      if (!control && !text) continue;
      if (!shows(el)) continue;
      var box;
      if (control) box = el.getBoundingClientRect();
      else { var range = document.createRange(); range.selectNodeContents(el); box = range.getBoundingClientRect(); }
      var x0 = box.left, y0 = box.top, x1 = box.right, y1 = box.bottom, rides = false;
      for (var e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
        var s = getComputedStyle(e), c = e.getBoundingClientRect();
        if (s.overflowX !== 'visible') { x0 = Math.max(x0, c.left); x1 = Math.min(x1, c.right); if (/auto|scroll/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1) rides = true; }
        if (s.overflowY !== 'visible') { y0 = Math.max(y0, c.top); y1 = Math.min(y1, c.bottom); }
      }
      if (rides || x1 - x0 < 1 || y1 - y0 < 1 || x1 <= 0 || y1 <= 0 || x0 >= W || y0 >= H) continue;
      count++;
      min.left = Math.min(min.left, Math.round(x0)); min.right = Math.min(min.right, Math.round(W - x1));
      min.top = Math.min(min.top, Math.round(y0)); min.bottom = Math.min(min.bottom, Math.round(H - y1));
      var over = Math.max(ins.left - x0, x1 - (W - ins.right), ins.top - y0, y1 - (H - ins.bottom));
      if (over > 0.5) bad.push((el.getAttribute('aria-label') || text || '').slice(0, 24) + ' by ' + Math.round(over));
    }
    return { count: count, bad: bad, nearest: min };
  }
  function screenName() {
    var h = document.querySelector('h2, h1');
    return (location.hash || '#/') + ' ' + (h ? h.textContent.trim().slice(0, 24) : '');
  }
  var tag = document.createElement('div');
  tag.setAttribute('data-feel', '1');
  tag.setAttribute('role', 'img');
  tag.style.cssText = 'position:fixed;left:50%;top:50%;width:2px;height:2px;opacity:0.02;pointer-events:none;z-index:99999';
  var lastLine = '';
  function report() {
    wrapBridge();
    if (!tag.isConnected && document.body) document.body.appendChild(tag);
    var ins = insets(), a = audit(ins), cap = window.Capacitor;
    var line = 'FEEL ' + JSON.stringify({
      screen: screenName(), size: [innerWidth, innerHeight], insets: ins, items: a.count, under: a.bad, nearest: a.nearest,
      appShell: document.documentElement.classList.contains('app-shell'),
      platform: cap && cap.getPlatform ? cap.getPlatform() : 'none',
      plugin: !!(cap && cap.isPluginAvailable && cap.isPluginAvailable('Haptics')),
      haptics: haptics, seen: { selection: seen.selection, menus: seen.menus, pageScroll: seen.pageScroll, zoom: window.visualViewport ? Math.round(visualViewport.scale * 100) / 100 : 1, scrollY: scrollY, selected: String(getSelection()).length },
    });
    tag.setAttribute('aria-label', line);
    if (line !== lastLine) { lastLine = line; console.log(line); }
  }
  setInterval(report, 1500);
})();
