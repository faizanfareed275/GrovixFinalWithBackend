export function runGrovixStorageMigration() {
  if (typeof window === "undefined" || !("localStorage" in window)) return;

  const flagKey = "grovix_migration_v1_done";
  const oldPrefix = "youthxp_";
  const newPrefix = "grovix_";
  const bridgeFlag = "grovix_bridge_patch_applied";

  try {
    if (localStorage.getItem(bridgeFlag) !== "true") {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      const originalRemoveItem = localStorage.removeItem.bind(localStorage);
      const originalGetItem = localStorage.getItem.bind(localStorage);

      (localStorage as any).setItem = (key: string, value: string) => {
        originalSetItem(key, value);
        if (key.startsWith(oldPrefix)) {
          const newKey = newPrefix + key.slice(oldPrefix.length);
          if (originalGetItem(newKey) !== value) originalSetItem(newKey, value);
        } else if (key.startsWith(newPrefix)) {
          const oldKey = oldPrefix + key.slice(newPrefix.length);
          if (originalGetItem(oldKey) !== value) originalSetItem(oldKey, value);
        }
      };

      (localStorage as any).removeItem = (key: string) => {
        originalRemoveItem(key);
        if (key.startsWith(oldPrefix)) {
          const newKey = newPrefix + key.slice(oldPrefix.length);
          originalRemoveItem(newKey);
        } else if (key.startsWith(newPrefix)) {
          const oldKey = oldPrefix + key.slice(newPrefix.length);
          originalRemoveItem(oldKey);
        }
      };

      (localStorage as any).getItem = (key: string) => {
        const val = originalGetItem(key);
        if (val !== null) return val;
        if (key.startsWith(newPrefix)) {
          const oldKey = oldPrefix + key.slice(newPrefix.length);
          return originalGetItem(oldKey);
        }
        if (key.startsWith(oldPrefix)) {
          const newKey = newPrefix + key.slice(oldPrefix.length);
          return originalGetItem(newKey) ?? val;
        }
        return val;
      };

      localStorage.setItem(bridgeFlag, "true");
    }

    if (localStorage.getItem(flagKey) !== "true") {
      const keysToCopy: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(oldPrefix)) {
          keysToCopy.push(key);
        }
      }

      for (const oldKey of keysToCopy) {
        const newKey = newPrefix + oldKey.slice(oldPrefix.length);
        if (localStorage.getItem(newKey) !== null) continue;
        const value = localStorage.getItem(oldKey);
        if (value !== null) {
          localStorage.setItem(newKey, value);
        }
      }

      localStorage.setItem(flagKey, "true");
    }
  } catch {
  }
}
