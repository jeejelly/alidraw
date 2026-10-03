/** the subscribe/notify half of a `useSyncExternalStore` source */
export class ChangeNotifier {
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  notify = () => this.listeners.forEach((listener) => listener());
}
