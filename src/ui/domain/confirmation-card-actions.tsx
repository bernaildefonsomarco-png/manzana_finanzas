import { Button } from "@/ui/primitivas/button";

export function ConfirmationCardActions({
  isRisk,
  confirmLabel,
  confirmAriaLabel,
  cancelLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  isRisk: boolean;
  confirmLabel: string;
  confirmAriaLabel?: string;
  cancelLabel?: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // `WEB-D099`, `41` §5: en `riesgo` el primario es la salida segura, no el
  // boton destructivo — por eso el orden y las variantes se invierten aqui
  // en vez de compartir un unico layout con los demas niveles.
  if (isRisk) {
    return (
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="danger"
          onClick={onConfirm}
          loading={loading}
          aria-label={confirmAriaLabel ?? confirmLabel}
        >
          {confirmLabel}
        </Button>
        <Button type="button" variant="primary" onClick={onCancel}>
          {cancelLabel ?? "No eliminar"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <Button type="button" variant="secondary" onClick={onCancel}>
        {cancelLabel ?? "Cancelar"}
      </Button>
      <Button
        type="button"
        variant="primary"
        onClick={onConfirm}
        loading={loading}
        aria-label={confirmAriaLabel ?? confirmLabel}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
