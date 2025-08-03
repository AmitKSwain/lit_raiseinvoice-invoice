// Utility to display the current URL in the bottom-right corner
export function initializeUrlDisplay() {
  // Only run in the browser
  if (typeof window === 'undefined') return;

  // Get or create the URL display element
  let urlDisplay = document.getElementById('app-url');
  if (!urlDisplay) {
    urlDisplay = document.createElement('div');
    urlDisplay.id = 'app-url';
    urlDisplay.style.cssText = 'position: fixed; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px; z-index: 1000;';
    urlDisplay.innerHTML = 'App URL: <span id="current-url"></span>';
    document.body.appendChild(urlDisplay);
  }

  // Update the URL display
  const currentUrl = window.location.href;
  const urlSpan = document.getElementById('current-url');
  if (urlSpan) {
    urlSpan.textContent = currentUrl;
  }

  // Add a simple way to toggle the URL display (double-click to show/hide)
  let clickCount = 0;
  let clickTimer;
  
  urlDisplay.addEventListener('click', () => {
    clickCount++;
    if (clickCount === 1) {
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 300);
    } else if (clickCount === 2) {
      clearTimeout(clickTimer);
      clickCount = 0;
      urlDisplay.style.display = urlDisplay.style.display === 'none' ? 'block' : 'none';
    }
  });
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUrlDisplay);
} else {
  initializeUrlDisplay();
}
