import { Children, isValidElement, type ComponentType, type ReactElement, type ReactNode } from "react";

/**
 * `AC-DS-06`: en desarrollo, un contenedor de diálogo sin el marcador de
 * título entre sus hijos falla de inmediato en vez de renderizar un
 * diálogo sin nombre accesible. Recibe el componente marcador como
 * parámetro para no acoplar `Dialog`/`Sheet`/futuros contenedores a un
 * único tipo de título.
 */
export function assertHasDialogTitle(
  children: ReactNode,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TitleComponent: ComponentType<any>,
  contenedor: string
) {
  if (process.env.NODE_ENV === "production") return;
  let found = false;
  Children.forEach(children, function walk(child) {
    if (!isValidElement(child)) return;
    if (child.type === TitleComponent) {
      found = true;
      return;
    }
    const element = child as ReactElement<{ children?: ReactNode }>;
    if (element.props?.children) {
      Children.forEach(element.props.children, walk);
    }
  });
  if (!found) {
    const nombreTitulo = TitleComponent.displayName ?? TitleComponent.name ?? "Title";
    throw new Error(
      `<${contenedor}> exige un <${nombreTitulo}> — un diálogo sin título es un error en tiempo de desarrollo (16 §5, AC-DS-06).`
    );
  }
}
