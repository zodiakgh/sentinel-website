// Masquer le loader dès le chargement complet de la page
window.addEventListener('load', () => {
  hideLoader();
});

function hideLoader() {
  const loader = document.getElementById('loader-wrapper');
  if (loader) {
    loader.classList.add('loaded');
  }
}

// Démo interactive pour re-tester le loader
function triggerLoaderDemo() {
  const loader = document.getElementById('loader-wrapper');
  if (loader) {
    loader.classList.remove('loaded');
    setTimeout(() => {
      loader.classList.add('loaded');
    }, 1800);
  }
}
