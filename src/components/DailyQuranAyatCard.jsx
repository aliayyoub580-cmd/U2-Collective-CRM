import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

export default function DailyQuranAyatCard() {
  const [ayats, setAyats] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function fetchAyats() {
      try {
        const response = await api.get('/quran/today');
        if (!mounted) return;

        const nextAyats = response.data?.ayats || [];
        if (response.data?.success && nextAyats.length > 0) {
          setAyats(nextAyats);
          setError('');
        } else {
          setError(response.data?.message || 'No Quran Ayats available right now.');
        }
      } catch (err) {
        if (!mounted) return;
        setError(err.response?.data?.message || 'No Quran Ayats available right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchAyats();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (ayats.length <= 1) return undefined;

    const interval = setInterval(() => {
      setCurrentIndex((index) => (index + 1) % ayats.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [ayats.length]);

  const currentAyat = useMemo(() => ayats[currentIndex], [ayats, currentIndex]);

  if (loading) {
    return (
      <section className="quran-card quran-card-skeleton" aria-label="Loading daily Quran ayat">
        <div className="quran-skeleton quran-skeleton-badge" />
        <div className="quran-skeleton quran-skeleton-line quran-skeleton-line-wide" />
        <div className="quran-skeleton quran-skeleton-line" />
        <div className="quran-skeleton quran-skeleton-reference" />
      </section>
    );
  }

  if (error || !currentAyat) {
    return (
      <section className="quran-card quran-card-error">
        <span className="quran-label">قرآنی آیت</span>
        <div className="quran-error-text" dir="rtl">
          <p>آج کی قرآنی آیات دستیاب نہیں ہیں۔</p>
          <p>براہ کرم بعد میں دوبارہ کوشش کریں۔</p>
        </div>
      </section>
    );
  }

  return (
    <section className="quran-card">
      <div className="quran-card-header">
        <span className="quran-label">قرآنی آیت</span>
        <span className="quran-reference-badge">{currentAyat.reference}</span>
      </div>

      <div key={`${currentAyat.id}-${currentIndex}`} className="quran-ayat-content">
        <p className="quran-arabic" dir="rtl">{currentAyat.arabic_text}</p>
        <p className="quran-urdu" dir="rtl">{currentAyat.urdu_translation}</p>
        <p className="quran-reference">{currentAyat.reference}</p>
      </div>

      {ayats.length > 1 && (
        <div className="quran-dots" aria-hidden="true">
          {ayats.map((ayat, index) => (
            <span
              key={ayat.id || `${ayat.surah_number}-${ayat.ayah_number}`}
              className={index === currentIndex ? 'quran-dot quran-dot-active' : 'quran-dot'}
            />
          ))}
        </div>
      )}
    </section>
  );
}
