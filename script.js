// Masquer le loader automatiquement au chargement
window.addEventListener('load', () => {
  const loader = document.getElementById('loader-wrapper');
  if (loader) {
    loader.classList.add('loaded');
  }
});

// Toggle Anglais / Français
let currentLang = 'en';

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'fr' : 'en';
  const langBtn = document.getElementById('lang-toggle');
  
  if (langBtn) {
    langBtn.textContent = currentLang === 'en' ? '🇫🇷 FR' : '🇬🇧 EN';
  }

  // Mettre à jour tous les éléments avec attributs data-en / data-fr
  const elements = document.querySelectorAll('[data-en]');
  elements.forEach(el => {
    if (el.dataset[currentLang]) {
      el.textContent = el.dataset[currentLang];
    }
  });

  // Texte du loader
  const loaderTxt = document.getElementById('loader-txt');
  if (loaderTxt) {
    loaderTxt.textContent = currentLang === 'en' ? 'Loading Coffee Break Studio...' : 'Chargement de Coffee Break Studio...';
  }
}
