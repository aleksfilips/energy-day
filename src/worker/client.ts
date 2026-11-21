import type { WorkerRequest } from './compute.worker';

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
const cache = new Map<string, Promise<unknown>>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./compute.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const p = pending.get(ev.data.id);
      if (!p) return;
      pending.delete(ev.data.id);
      if (ev.data.ok) p.resolve(ev.data.result);
      else p.reject(new Error(ev.data.error));
    };
  }
  return worker;
}

type Body = WorkerRequest extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;

/** Запрос к вычислительному воркеру с кэшем по содержимому запроса. */
export function compute<T>(body: Body): Promise<T> {
  const key = JSON.stringify(body);
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const id = ++seq;
  const p = new Promise<unknown>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...body, id });
  });
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  if (cache.size > 40) cache.delete(cache.keys().next().value!);
  return p as Promise<T>;
}
