/* 云旅游 · 交互 */
(function () {
  'use strict';

  // 导航滚动状态
  var nav = document.getElementById('nav');
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 24);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // 滚动渐入
  var nodes = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    nodes.forEach(function (n, i) {
      n.style.transitionDelay = (Math.min(i, 6) * 60) + 'ms';
      io.observe(n);
    });
  } else {
    nodes.forEach(function (n) { n.classList.add('in'); });
  }

  // 云层轻微视差
  var clouds = Array.prototype.slice.call(document.querySelectorAll('.cloud'));
  if (clouds.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        clouds.forEach(function (c, i) {
          c.style.marginTop = (-y * (0.02 + i * 0.012)) + 'px';
        });
        ticking = false;
      });
    }, { passive: true });
  }

  // 卡片当前年份
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
