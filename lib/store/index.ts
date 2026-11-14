import { env } from "../env";
import { demoVideos, DEMO_RATE } from "./fixtures";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

export type { Store } from "./types";

const g = globalThis as unknown as { __condorStore?: Store };

export function getStore(): Store {
  if (g.__condorStore) return g.__condorStore;
  if (env.isDemo) {
    const mem = new MemoryStore(demoVideos);
    mem.settings.set("usd_ars_rate", String(DEMO_RATE));
    g.__condorStore = mem;
  } else {
    g.__condorStore = new SupabaseStore(env.supabaseUrl!, env.supabaseServiceKey!);
  }
  return g.__condorStore;
}

/** Solo para tests. */
export function setStoreForTests(store: Store | undefined) {
  g.__condorStore = store;
}
