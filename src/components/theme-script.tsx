/**
 * Sets the `.dark` class on <html> before first paint.
 *
 * Runs blocking and inline on purpose: doing it in an effect would render one
 * frame with the wrong palette, which is the flash of white every dark-mode
 * user notices. Reads a stored preference if the visitor has chosen one,
 * otherwise follows the operating system.
 */
export const THEME_STORAGE_KEY = "cardresssl-theme";

export function ThemeScript() {
  const script = `
    try {
      var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
      var dark = stored === 'dark' ||
        (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
    } catch (e) {
      /* Private mode or blocked storage: fall back to the light default. */
    }
  `;

  return (
    <script
      // The content is a fixed string with no interpolated data.
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
