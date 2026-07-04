const sb = require('../database/supabaseClient');

const QURAN_TABLE = 'daily_quran_ayats';
const DAILY_AYAT_COUNT = 7;
const REQUEST_TIMEOUT_MS = 8000;

const surahAyahCounts = {
  1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
  11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98,
  20: 135, 21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88,
  29: 69, 30: 60, 31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182,
  38: 88, 39: 75, 40: 85, 41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35,
  47: 38, 48: 29, 49: 18, 50: 45, 51: 60, 52: 49, 53: 62, 54: 55, 55: 78,
  56: 96, 57: 29, 58: 22, 59: 24, 60: 13, 61: 14, 62: 11, 63: 11, 64: 18,
  65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44, 71: 28, 72: 28, 73: 20,
  74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42, 81: 29, 82: 19,
  83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20, 91: 15,
  92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11,
  101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6,
  110: 3, 111: 5, 112: 4, 113: 5, 114: 6
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeAyat(row) {
  return {
    ...row,
    date: String(row.date).slice(0, 10)
  };
}

function randomLocation(existing) {
  const surahs = Object.keys(surahAyahCounts).map(Number);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const surahNumber = surahs[Math.floor(Math.random() * surahs.length)];
    const ayahNumber = Math.floor(Math.random() * surahAyahCounts[surahNumber]) + 1;
    const key = `${surahNumber}:${ayahNumber}`;

    if (!existing.has(key)) {
      existing.add(key);
      return { surahNumber, ayahNumber };
    }
  }

  throw new Error('Could not select a unique random ayat.');
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();

    if (!response.ok || data.code !== 200 || !data.data) {
      throw new Error(data?.status || `Quran API request failed: ${response.status}`);
    }

    return data.data;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRandomAyat(existing) {
  const { surahNumber, ayahNumber } = randomLocation(existing);
  const reference = `${surahNumber}:${ayahNumber}`;
  const [arabic, urdu] = await Promise.all([
    fetchJson(`https://api.alquran.cloud/v1/ayah/${reference}/quran-uthmani`),
    fetchJson(`https://api.alquran.cloud/v1/ayah/${reference}/ur.jalandhry`)
  ]);

  const surahName = arabic.surah?.englishName || urdu.surah?.englishName || `Surah ${surahNumber}`;

  return {
    surah_number: surahNumber,
    ayah_number: ayahNumber,
    surah_name: surahName,
    arabic_text: arabic.text,
    urdu_translation: urdu.text,
    reference: `${surahName} ${surahNumber}:${ayahNumber}`,
    date: todayDate()
  };
}

async function getAyatsForDate(date) {
  const { data } = await sb.list(QURAN_TABLE, {
    filters: [['date', 'eq', date]],
    order: 'id.asc'
  });
  return (data || []).map(normalizeAyat);
}

async function getStoredFallbackAyats() {
  const { data } = await sb.list(QURAN_TABLE, {
    order: 'date.desc,id.asc',
    limit: DAILY_AYAT_COUNT
  });
  return (data || []).map(normalizeAyat);
}

async function createDailyAyats() {
  const date = todayDate();
  const selected = new Set();
  const ayats = [];

  while (ayats.length < DAILY_AYAT_COUNT) {
    ayats.push(await fetchRandomAyat(selected));
  }

  await sb.remove(QURAN_TABLE, [['date', 'neq', date]]);
  return sb.upsert(QURAN_TABLE, ayats, 'date,surah_number,ayah_number');
}

async function getTodayAyats() {
  const date = todayDate();
  let todayAyats = [];

  try {
    todayAyats = await getAyatsForDate(date);
  } catch (err) {
    return {
      success: false,
      message: 'No Quran Ayats available right now.',
      error: err.message
    };
  }

  if (todayAyats.length >= DAILY_AYAT_COUNT) {
    return { success: true, date, source: 'today', ayats: todayAyats.slice(0, DAILY_AYAT_COUNT) };
  }

  try {
    const newAyats = await createDailyAyats();
    return {
      success: true,
      date,
      source: 'today',
      ayats: newAyats.map(normalizeAyat).slice(0, DAILY_AYAT_COUNT)
    };
  } catch (err) {
    let fallbackAyats = todayAyats;

    if (fallbackAyats.length === 0) {
      try {
        fallbackAyats = await getStoredFallbackAyats();
      } catch (fallbackErr) {
        fallbackAyats = [];
      }
    }

    if (fallbackAyats.length > 0) {
      return {
        success: true,
        date,
        source: 'fallback',
        message: 'External Quran API failed. Showing stored Ayats.',
        ayats: fallbackAyats.slice(0, DAILY_AYAT_COUNT)
      };
    }

    return {
      success: false,
      message: 'No Quran Ayats available right now.',
      error: err.message
    };
  }
}

async function refreshDailyAyats() {
  const date = todayDate();
  const todayAyats = await getAyatsForDate(date);

  if (todayAyats.length >= DAILY_AYAT_COUNT) {
    return {
      success: true,
      message: 'Daily Quran Ayats already refreshed for today.',
      date,
      count: todayAyats.length,
      ayats: todayAyats.slice(0, DAILY_AYAT_COUNT)
    };
  }

  const newAyats = await createDailyAyats();
  return {
    success: true,
    message: 'Daily Quran Ayats refreshed successfully.',
    date,
    count: newAyats.length,
    ayats: newAyats.map(normalizeAyat).slice(0, DAILY_AYAT_COUNT)
  };
}

module.exports = {
  getTodayAyats,
  refreshDailyAyats,
  surahAyahCounts
};
