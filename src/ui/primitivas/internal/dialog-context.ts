import { createContext, useContext } from "react";

export const DialogContentContext = createContext<{
  titleId: string;
  descriptionId: string;
} | null>(null);

export function useDialogContentContext(component: string) {
  const context = useContext(DialogContentContext);
  if (!context) {
    throw new Error(`<${component}> debe usarse dentro de <DialogContent>.`);
  }
  return context;
}
