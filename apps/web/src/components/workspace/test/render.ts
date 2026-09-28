import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, vi } from "vitest";
import { createApiRequest } from "@/lib/api";
vi.mock("@/lib/api", () => ({ createApiRequest: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) =>
    createElement("a", { ...props, href: to }, children),
}));
export const api = vi.mocked(createApiRequest);
let root: Root;
let container: HTMLDivElement;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
export async function render<P extends object>(component: ComponentType<P>, props: P) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(component, props)));
  return container;
}
export async function click(element: Element | null) {
  if (!element) throw new Error("Missing click target");
  await act(async () => (element as HTMLElement).click());
}
export async function submit(form: HTMLFormElement | null) {
  if (!form) throw new Error("Missing form");
  await act(async () =>
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
export async function change(element: Element | null, value: string) {
  if (!element) throw new Error("Missing field");
  await act(async () => {
    const field = element as HTMLInputElement;
    // Use the prototype setter so React observes the user's change.
    const prototype = Object.getPrototypeOf(field);
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(
      new Event(field.tagName === "SELECT" ? "change" : "input", { bubbles: true }),
    );
  });
}
export function button(container: Element, label: string) {
  return (
    [...container.querySelectorAll("button")].find((node) => node.textContent?.trim() === label) ??
    null
  );
}
