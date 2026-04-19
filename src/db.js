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
    entries: storedEntries.map(({ _order, ...entry }) => ({
      ...entry,
      id: entry.id ? String(entry.id) : crypto.randomUUID()
    })),
    isDarkMode
  };
}

export async function saveEntries(entries) {
  await db.transaction('rw', db.entries, async () => {
    await db.entries.clear();
    if (entries.length > 0) {
      await db.entries.bulkAdd(
        entries.map((entry, idx) => ({
          ...entry,
          id: entry.id ? String(entry.id) : crypto.randomUUID(),
          _order: idx
        }))
      );
    }
  });
}

export async function saveDarkMode(isDarkMode) {
  await db.settings.put({ key: 'darkMode', value: isDarkMode });
}
