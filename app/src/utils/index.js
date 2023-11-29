import { proxy, subscribe } from 'valtio';

const STORAGE_VERSION = 0.1;

export async function postRequest(state, path, body) {
  state.isLoading = true;

  try {
    const options = { method: 'POST' };

    if (body) {
      options.body = body;
      options.headers = {
        'Content-Type': 'application/json',
      };
    }

    const result = await fetch(`http://localhost:8080${path}`, options);
    const json = await result.json();

    if (result.status !== 200) {
      throw new Error(json.message);
    }

    state.isError = false;
    state.data = json;
  } catch (error) {
    state.isError = true;
    console.error(`${path} request failed: ${error.message}`);
  } finally {
    state.isLoading = false;
  }
}

export function createStorageProxy(key, defaultValue) {
  const state = proxy(getStoredValue(key, defaultValue));

  subscribe(state, () => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ ...state, __version: STORAGE_VERSION }),
      );
    } catch (error) {
      console.error(`Could not persist state: ${error.message}`);
    }
  });

  return state;
}

function getStoredValue(key, defaultValue) {
  try {
    const storageItem = localStorage.getItem(key);

    if (storageItem) {
      const parsedItem = JSON.parse(storageItem);

      if (parsedItem.__version >= STORAGE_VERSION) {
        return parsedItem;
      } else {
        // Overwrite the saved state
        localStorage.setItem(key, JSON.stringify(defaultValue));

        return defaultValue;
      }
    }
  } catch {
    console.warn('Could not parse local storage value');
  }

  return defaultValue;
}
