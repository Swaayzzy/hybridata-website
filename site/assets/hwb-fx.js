/* How We Build: phones get the cropped viewBox (building about 90% of the frame width); wider screens get the full one.
   Static: no motion of any kind. */
(function () {
  'use strict';
  var root = document.getElementById('how-we-build');
  if (!root) return;
  var svgs = Array.prototype.slice.call(root.querySelectorAll('svg[data-art]'));
  var mqPhone = window.matchMedia('(max-width: 680px)');
  function setViewBox() {
    svgs.forEach(function (s) { s.setAttribute('viewBox', s.getAttribute(mqPhone.matches ? 'data-vb-n' : 'data-vb-w')); });
  }
  setViewBox();
  if (mqPhone.addEventListener) mqPhone.addEventListener('change', setViewBox); else if (mqPhone.addListener) mqPhone.addListener(setViewBox);
})();
