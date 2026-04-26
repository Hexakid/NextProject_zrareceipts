import Dexie from 'dexie';

const db = new Dexie('zraCollectorDB');
db.version(1).stores({
  entries: '++id,_order,tpinOfSupplier,invoiceNumber,invoiceDate,nameOfSupplier',
  settings: '&key'
});
db.version(2).stores({
  entries: 'id,_order,tpinOfSupplier,invoiceNumber,invoiceDate,nameOfSupplier',
  settings: '&key'
}).upgrade(async (tx) => {
  const records = await tx.table('entries').toArray();
  await tx.table('entries').clear();
  if (records.length > 0) {
    await tx.table('entries').bulkAdd(
      records.map((entry, idx) => ({
        ...entry,
        id: entry.id ? String(entry.id) : crypto.randomUUID(),
        _order: typeof entry._order === 'number' ? entry._order : idx
      }))
    );
  }
});

const LEGACY_ENTRIES_KEY = 'zra_entries';
const LEGACY_DARKMODE_KEY = 'zra_darkmode';
const ENTRIES_API = '/api/entries';
const ENTRIES_SYNC_API = '/api/entries/sync';

function normalizeEntry(entry = {}, idx = 0) {
  return {
    ...entry,
    id: entry.id ? String(entry.id) : crypto.randomUUID(),
    _order: typeof entry._order === 'number' ? entry._order : idx,
    imageDataUrl: entry.imageDataUrl || null
  };
}

function stripOrder(entries) {
  return entries.map(({ _order, ...entry }) => ({
    ...entry,
    id: entry.id ? String(entry.id) : crypto.randomUUID()
  }));
}

function mergeUniqueEntries(remoteEntries = [], localEntries = []) {
  const byId = new Map();

  for (const entry of remoteEntries) {
    const normalized = normalizeEntry(entry, byId.size);
    byId.set(normalized.id, normalized);
  }

  for (const entry of localEntries) {
    const normalized = normalizeEntry(entry, byId.size);
    if (!byId.has(normalized.id)) byId.set(normalized.id, normalized);
  }

  return Array.from(byId.values()).map((entry, idx) => ({ ...entry, _order: idx }));
}

async function writeLocalEntries(entries) {
  await db.transaction('rw', db.entries, async () => {
    await db.entries.clear();
    if (entries.length > 0) {
      await db.entries.bulkAdd(entries.map((entry, idx) => normalizeEntry(entry, idx)));
    }
  });
}

async function fetchServerEntries() {
  const response = await fetch(ENTRIES_API, { credentials: 'include' });
  if (!response.ok) throw new Error(`Server entries fetch failed (${response.status}).`);
  const payload = await response.json();
  return Array.isArray(payload?.entries) ? payload.entries : [];
}

async function syncServerEntries(entries) {
  const response = await fetch(ENTRIES_SYNC_API, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: stripOrder(entries) })
  });
  if (!response.ok) throw new Error(`Server entries sync failed (${response.status}).`);
  const payload = await response.json();
  return Array.isArray(payload?.entries) ? payload.entries : [];
}

export async function loadInitialData() {
  let storedEntries = await db.entries.orderBy('_order').toArray();
  const darkModeSetting = await db.settings.get('darkMode');

  if (storedEntries.length === 0) {
    try {
      const legacyEntries = localStorage.getItem(LEGACY_ENTRIES_KEY);
      if (legacyEntries) {
        const parsed = JSON.parse(legacyEntries);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await db.entries.bulkAdd(
            parsed.map((entry, idx) => ({
              ...entry,
              id: entry.id ? String(entry.id) : crypto.randomUUID(),
              _order: idx
            }))
          );
          storedEntries = await db.entries.orderBy('_order').toArray();
        }
      }
    } catch {
      // Ignore migration errors.
    }
  }

  try {
    const remoteEntries = await fetchServerEntries();

    if (remoteEntries.length === 0 && storedEntries.length > 0) {
      const synced = await syncServerEntries(storedEntries);
      const normalizedSynced = synced.map((entry, idx) => normalizeEntry(entry, idx));
      await writeLocalEntries(normalizedSynced);
      storedEntries = normalizedSynced;
    } else if (remoteEntries.length > 0 && storedEntries.length === 0) {
      const normalizedRemote = remoteEntries.map((entry, idx) => normalizeEntry(entry, idx));
      await writeLocalEntries(normalizedRemote);
      storedEntries = normalizedRemote;
    } else if (remoteEntries.length > 0 && storedEntries.length > 0) {
      const merged = mergeUniqueEntries(remoteEntries, storedEntries);
      const syncedMerged = await syncServerEntries(merged);
      const normalizedMerged = syncedMerged.map((entry, idx) => normalizeEntry(entry, idx));
      await writeLocalEntries(normalizedMerged);
      storedEntries = normalizedMerged;
    }
  } catch {
    // If server is unavailable (offline/session expired), keep local data only.
  }

  let isDarkMode = darkModeSetting?.value === true;
  if (!darkModeSetting) {
    try {
      const legacyDarkMode = localStorage.getItem(LEGACY_DARKMODE_KEY);
      if (legacyDarkMode !== null) {
        isDarkMode = legacyDarkMode === 'true';
        await db.settings.put({ key: 'darkMode', value: isDarkMode });
      }
    } catch {
      // Ignore migration errors.
    }
  }

  return {
    entries: stripOrder(storedEntries),
    isDarkMode
  };
}

export async function saveEntries(entries) {
  const normalizedEntries = entries.map((entry, idx) => normalizeEntry(entry, idx));
  await writeLocalEntries(normalizedEntries);

  try {
    await fetch(ENTRIES_API, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: stripOrder(normalizedEntries) })
    });
  } catch {
    // Keep local data if server save fails.
  }
}

export async function saveDarkMode(isDarkMode) {
  await db.settings.put({ key: 'darkMode', value: isDarkMode });
}
