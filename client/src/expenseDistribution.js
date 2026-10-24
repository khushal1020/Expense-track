export function aggregateExpensesByCategory(expenses) {
  const grouped = new Map();
  expenses.forEach(item => {
    const category = typeof item.category === 'string' ? item.category.trim() : '';
    const amount = item.amount;
    if (!category || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return;
    grouped.set(category, (grouped.get(category) || 0) + amount);
  });

  const items = [...grouped.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = items.reduce((sum, [, amount]) => sum + amount, 0);
  return { items, total };
}
