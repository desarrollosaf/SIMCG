import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AG_GRID_LOCALE_ES } from '@ag-grid-community/locale';

ModuleRegistry.registerModules([AllCommunityModule]);

export const AG_GRID_LOCALE = AG_GRID_LOCALE_ES;

// Los colores salen de variables CSS (styles.scss), así el grid sigue al tema
// claro/oscuro sin recrear el objeto de tema.
export const simcgGridTheme = themeQuartz.withParams({
  accentColor: 'var(--accent-text)',
  backgroundColor: 'var(--surface)',
  borderColor: 'var(--border)',
  browserColorScheme: 'inherit',
  foregroundColor: 'var(--ink)',
  headerBackgroundColor: 'var(--surface)',
  headerFontSize: 12,
  headerFontWeight: 600,
  headerTextColor: 'var(--muted)',
  headerColumnBorder: { style: 'solid', width: 1, color: 'var(--border)' },
  headerRowBorder: { style: 'solid', width: 1, color: 'var(--border)' },
  columnBorder: { style: 'solid', width: 1, color: 'var(--border)' },
  cellFontSize: 12.5,
  fontFamily: 'inherit',
  oddRowBackgroundColor: 'var(--surface)',
  rowVerticalPaddingScale: 1.35,
  rowBorder: { style: 'solid', width: 1, color: 'var(--border)' },
  cellHorizontalPadding: 18,
  spacing: 8,
  wrapperBorder: true,
  wrapperBorderRadius: 16,
});
