let idCounter = 1;

export function nextId(): number {
  return idCounter++;
}

export function resetIdCounter(start = 1): void {
  idCounter = start;
}
