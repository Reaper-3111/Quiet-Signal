/** Journal duplication: what each server is missing that another server has. Pure, so it can be tested. */
export interface Listed { id: string }

export function missing<T extends Listed>(lists: (T[] | null)[]) {
  const copies: { from: number; to: number; entry: T }[] = [];
  const have = lists.map((l) => new Set(l?.map((e) => e.id)));
  lists.forEach((list, from) => list?.forEach((entry) => {
    lists.forEach((other, to) => {
      if (to === from || !other || have[to].has(entry.id)) return;
      have[to].add(entry.id);
      copies.push({ from, to, entry });
    });
  }));
  return copies;
}
