/** @param {{amount?: number, quantity?: number | null}} task */
export function taskTotal(task) {
  const quantity = task.quantity === null ? 0 : task.quantity ?? 1;
  if (!Number.isFinite(task.amount) || task.amount < 0 || !Number.isSafeInteger(quantity) || quantity < 0) return 0;
  return Math.round(task.amount * 100) * quantity / 100;
}
