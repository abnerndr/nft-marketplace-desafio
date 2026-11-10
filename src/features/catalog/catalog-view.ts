export type CatalogView = "pending" | "error" | "empty" | "list";

/**
 * Uma releitura que falha não apaga o que já está na tela. O erro só ocupa
 * o lugar da grade quando ainda não existe lista.
 */
export function catalogView(input: {
  isPending: boolean;
  isError: boolean;
  itemCount: number | null;
}): CatalogView {
  if (input.itemCount === null) {
    if (input.isPending) return "pending";
    if (input.isError) return "error";
    return "empty";
  }
  if (input.itemCount === 0) return "empty";
  return "list";
}
