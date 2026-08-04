/* ============================================
   ABN STUDIO — LANGUAGE (ES default · EN toggle)
   Bilingual content lives inline as <span lang="es"> / <span lang="en">.
   CSS shows the active language; this only flips <html lang> + remembers it.
   ============================================ */
(function () {
  var KEY = 'abn-studio-lang';
  var root = document.documentElement;

  function setLang(lang) {
    lang = (lang === 'en') ? 'en' : 'es';
    root.setAttribute('lang', lang);
    try { localStorage.setItem(KEY, lang); } catch (e) {}
  }

  // Apply saved preference immediately (avoid flash of wrong language).
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  setLang(saved || 'es');

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('lang-switch');
    if (!btn) return;
    btn.addEventListener('click', function () {
      setLang(root.getAttribute('lang') === 'es' ? 'en' : 'es');
    });
  });
})();
