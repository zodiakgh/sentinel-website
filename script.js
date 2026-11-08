// Masquer le loader dès que le DOM & toutes les ressources sont chargés
window.addEventListener('load', () => {
  hideLoader();
});

function hideLoader() {
  const loader = document.getElementById('loader-wrapper');
  if (loader) {
    loader.classList.add('loaded');
  }
}

// Démo interactive pour ré-afficher le loader temporairement
function triggerLoaderDemo() {
  const loader = document.getElementById('loader-wrapper');
  if (loader) {
    loader.classList.remove('loaded');
    setTimeout(() => {
      loader.classList.add('loaded');
    }, 1800);
  }
}
