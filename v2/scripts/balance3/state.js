import { createInitialState } from './domain.js';

let currentState = createInitialState();
const listeners = new Set();

export function getState() {
  return currentState;
}

export function updateState(recipe, { notify = true } = {}) {
  const next = typeof recipe === 'function' ? recipe(currentState) : recipe;
  if (next && next !== currentState) currentState = next;
  currentState.updatedAt = new Date().toISOString();
  if (notify) listeners.forEach((listener) => listener(currentState));
  return currentState;
}

export function replaceState(nextState) {
  currentState = nextState || createInitialState();
  listeners.forEach((listener) => listener(currentState));
  return currentState;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
