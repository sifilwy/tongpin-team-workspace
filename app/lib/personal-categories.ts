export const personalOwners = ["xzx", "吃吃", "czl", "子涵", "悦悦"] as const;
export type PersonalOwner = typeof personalOwners[number];
export type PersonalCategories = Record<PersonalOwner, string[]>;

/** Old two-member documents and partially saved categories remain readable. */
export function restorePersonalCategories(saved: unknown, tasks: readonly { owner: string; category: string }[] = []): PersonalCategories {
  const record = saved && typeof saved === "object" && !Array.isArray(saved) ? saved as Record<string, unknown> : {};
  return Object.fromEntries(personalOwners.map(owner => {
    const raw = record[owner];
    const names = (Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [])
      .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
    const taskNames = tasks.filter(task => task && task.owner === owner && typeof task.category === "string" && task.category.trim()).map(task => task.category);
    const result = [...new Set([...names, ...taskNames])];
    return [owner, result.length ? result : ["独立"]];
  })) as PersonalCategories;
}
