import { proxy, subscribe } from 'valtio';

export function createStorageProxy(key, defaultValue) {
  const state = proxy(getStoredValue(key, defaultValue));

  subscribe(state, () => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Could not save state to local storage: ${message}`);
    }
  });

  return state;
}

function getStoredValue(key, defaultValue) {
  try {
    const storageItem = localStorage.getItem(key);

    if (storageItem) {
      const parsedItem = JSON.parse(storageItem);
      const keys = Object.keys(defaultValue);

      // Perform a basic check to verify that the stored value contains all the
      // keys of the default value.
      for (let i = 0; i < keys.length; i++) {
        if (parsedItem[keys[i]] === undefined) {
          // Overwrite the saved state
          localStorage.setItem(key, JSON.stringify(defaultValue));

          return defaultValue;
        }
      }

      return parsedItem;
    } else {
      return defaultValue;
    }
  } catch {
    return defaultValue;
  }
}
