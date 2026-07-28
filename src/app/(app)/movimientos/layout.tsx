// Ranura paralela `@panel` (`12` §6): en escritorio, abrir un detalle desde
// el listado muestra un panel sin perder el listado de fondo; cargar la URL
// directa muestra la pantalla completa (`[id]/page.tsx`), sin este layout.
export default function MovimientosLayout({
  children,
  panel,
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
}) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
