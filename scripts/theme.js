export function applyTheme(theme) {
  const body = document.body;
  const mode = theme === 'dark' ? 'theme-dark' : 'theme-light';
  body.classList.remove('theme-dark', 'theme-light');
  body.classList.add(mode);
}

export function initThemeToggle(toggleEl, currentTheme, onChange) {
  if (!toggleEl) return;
  toggleEl.checked = currentTheme === 'dark';
  toggleEl.addEventListener('change', (event) => {
    const next = event.target.checked ? 'dark' : 'light';
    applyTheme(next);
    onChange?.(next);
  });
}
