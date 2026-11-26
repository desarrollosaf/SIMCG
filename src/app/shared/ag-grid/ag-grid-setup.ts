import { AllCommunityModule, ColDef, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AG_GRID_LOCALE_ES } from '@ag-grid-community/locale';

ModuleRegistry.registerModules([AllCommunityModule]);

export const AG_GRID_LOCALE = AG_GRID_LOCALE_ES;

/**
 * Columnas ordenables al hacer clic en el encabezado: ascendente → descendente
 * (sin tercer estado «sin orden»). Las columnas que no deben ordenarse declaran
 * `sortable: false`.
 */
export const AG_GRID_COLUMNA_BASE: ColDef = {
  sortable: true,
  sortingOrder: ['asc', 'desc'],
  unSortIcon: true,
  // Texto completo: nunca se corta con «…»; la fila crece si hace falta.
  wrapText: true,
  autoHeight: true,
};

// Los colores salen de variables CSS (styles.scss), así el grid sigue al tema
// claro/oscuro sin recrear el objeto de tema.
export const simcgGridTheme = themeQuartz.withParams({
  accentColor: 'var(--accent-text)',
  backgroundColor: 'var(--surface)',
  borderColor: 'var(--border)',
  browserColorScheme: 'inherit',
  foregroundColor: 'var(--ink)',
  fontFamily: 'inherit',
  // Encabezado limpio: sin separadores verticales ni manijas de redimensión visibles.
  headerBackgroundColor: 'var(--surface-2)',
  headerFontSize: 11.5,
  headerFontWeight: 600,
  headerTextColor: 'var(--muted)',
  headerHeight: 44,
  headerColumnBorder: false,
  headerColumnResizeHandleColor: 'transparent',
  headerRowBorder: { style: 'solid', width: 1, color: 'var(--border)' },
  columnBorder: false,
  // Solo una línea horizontal sutil entre filas.
  rowBorder: { style: 'solid', width: 1, color: 'var(--border)' },
  rowHeight: 50,
  cellFontSize: 13,
  cellHorizontalPadding: 18,
  oddRowBackgroundColor: 'var(--surface)',
  rowHoverColor: 'var(--hover)',
  selectedRowBackgroundColor: 'var(--brand-primary-soft)',
  spacing: 8,
  // El grid ya vive dentro de una .card: sin borde exterior propio.
  wrapperBorder: false,
  wrapperBorderRadius: 12,
  // Sin recuadro al hacer clic en una celda; el foco de teclado se ve en styles.scss.
  focusShadow: 'none',
  // Sin divisor vertical a la izquierda de la columna «Acciones» (fija a la derecha).
  pinnedColumnBorder: false,
  pinnedRowBorder: false,
});
