"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ExerciseDetail {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  short_description: string;
  description: string;
  joints: string[];
  muscles: string[];
  video_url: string;
  sources?: string[];
  prerequisite_ids?: string[];
}

interface MiniExercise {
  id: string;
  title: string;
  difficulty: string;
}

interface ProgressSubmission {
  id: string;
  athlete_name: string;
  video_url: string;
  notes: string;
  created_at: string;
}

export default function ExerciseDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [prerequisites, setPrerequisites] = useState<MiniExercise[]>([]);
  const [unlockedTricks, setUnlockedTricks] = useState<MiniExercise[]>([]);
  const [submissions, setSubmissions] = useState<ProgressSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  // Indeks aktualnego źródła w karuzeli
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ athlete_name: "", video_url: "", notes: "" });

  // Konwersja na format iframe
  const parseVideoEmbed = (url: string) => {
    if (!url) return "";
    if (url.includes("drive.google.com/file/d/")) {
      const fileId = url.split("/d/")[1]?.split("/")[0];
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    if (url.includes("youtube.com/shorts/")) {
      const videoId = url.split("shorts/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes("youtube.com/watch?v=")) {
      const videoId = url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes("open.spotify.com/playlist/")) {
      const playlistId = url.split("playlist/")[1]?.split("?")[0];
      return `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`;
    }
    return url;
  };

  // Sprawdzenie, czy serwis zezwala na osadzanie w ramce iframe
  const isEmbeddable = (url: string) => {
    if (!url) return false;
    return (
      url.includes("youtube.com") ||
      url.includes("youtu.be") ||
      url.includes("drive.google.com") ||
      url.includes("spotify.com")
    );
  };

  const fetchDetailAndTree = async () => {
    if (!id) return;
    setLoading(true);

    const { data: currentEx, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !currentEx) {
      setLoading(false);
      return;
    }

    setExercise(currentEx);

    if (currentEx.prerequisite_ids && currentEx.prerequisite_ids.length > 0) {
      const { data: prereqData } = await supabase
        .from("exercises")
        .select("id, title, difficulty")
        .in("id", currentEx.prerequisite_ids);

      if (prereqData) setPrerequisites(prereqData);
    }

    const { data: unlockedData } = await supabase
      .from("exercises")
      .select("id, title, difficulty")
      .contains("prerequisite_ids", [id]);

    if (unlockedData) setUnlockedTricks(unlockedData);

    const { data: subsData } = await supabase
      .from("progress_submissions")
      .select("id, athlete_name, video_url, notes, created_at")
      .eq("exercise_id", id)
      .order("created_at", { ascending: false });

    if (subsData) setSubmissions(subsData);

    setLoading(false);
  };

  useEffect(() => {
    fetchDetailAndTree();
  }, [id]);

  const handleAddSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.athlete_name || !form.video_url || !exercise) return;

    const payload = {
      athlete_name: form.athlete_name,
      exercise_id: exercise.id,
      exercise_title: exercise.title,
      video_url: parseVideoEmbed(form.video_url),
      notes: form.notes,
    };

    const { data, error } = await supabase.from("progress_submissions").insert([payload]).select();

    if (!error && data) {
      setSubmissions((prev) => [data[0], ...prev]);
      setIsModalOpen(false);
      setForm({ athlete_name: "", video_url: "", notes: "" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center text-sm animate-pulse">
        Budowanie podglądu...
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8 flex flex-col items-center justify-center">
        <p className="text-neutral-400 mb-4">Nie znaleziono takiego ćwiczenia.</p>
        <Link href="/" className="text-emerald-400 underline text-sm">
          ← Wróć do bazy
        </Link>
      </div>
    );
  }

  const allSources =
    exercise.sources && exercise.sources.length > 0
      ? exercise.sources
      : exercise.video_url
      ? [exercise.video_url]
      : [];

  const rawCurrentUrl = allSources[currentVideoIndex] || "";
  const embedCurrentUrl = parseVideoEmbed(rawCurrentUrl);
  const canEmbed = isEmbeddable(rawCurrentUrl);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between select-none">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-emerald-400 transition-colors"
          >
            <span>←</span>
            <span>Wróć do bazy ROAD TO GOAT</span>
          </Link>

          <Link href="/timeline" className="text-xs text-neutral-400 hover:text-emerald-400 transition-colors">
            🎬 Globalny Timeline →
          </Link>
        </div>

        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3 mb-4 select-none">
            <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-neutral-800 text-emerald-400 border border-neutral-700">
              {exercise.category}
            </span>
            <span className="text-xs text-neutral-400 bg-neutral-950 px-3 py-1 rounded-lg border border-neutral-800">
              {exercise.difficulty}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
            {exercise.title}
          </h1>

          {exercise.short_description && (
            <p className="text-emerald-400/90 text-sm md:text-base font-medium mb-6">
              {exercise.short_description}
            </p>
          )}

          {/* ODTWARZACZ WIDEO ZE STRZAŁKAMI I AWARYJNYM PRZYCISKIEM */}
          {allSources.length > 0 ? (
            <div className="mb-6 space-y-3">
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-neutral-950 border border-neutral-800 shadow-2xl group">
                {canEmbed ? (
                  <iframe
                    src={embedCurrentUrl}
                    title={`${exercise.title} - źródło ${currentVideoIndex + 1}`}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                  />
                ) : (
                  /* KARTA GDY STRONA BLOKUJE IFRAME (NP. LOOPKICKS) */
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-neutral-900/90">
                    <span className="text-4xl mb-3">🔗</span>
                    <h3 className="text-white font-bold text-base mb-1">
                      Materiał ze strony zewnętrznej
                    </h3>
                    <p className="text-xs text-neutral-400 max-w-sm mb-4 leading-relaxed">
                      Ta witryna blokuje osadzanie w ramkach. Możesz otworzyć pełny poradnik i materiał bezpośrednio pod źródłowym adresem.
                    </p>
                    <a
                      href={rawCurrentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5"
                    >
                      <span>Otwórz stronę źródłową</span>
                      <span>↗</span>
                    </a>
                  </div>
                )}

                {/* Strzałki zmiany źródła */}
                {allSources.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setCurrentVideoIndex((prev) => (prev > 0 ? prev - 1 : allSources.length - 1))
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-emerald-500 hover:text-black text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg backdrop-blur-sm transition-all shadow-lg cursor-pointer"
                      title="Poprzednie wideo"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() =>
                        setCurrentVideoIndex((prev) => (prev < allSources.length - 1 ? prev + 1 : 0))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-emerald-500 hover:text-black text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg backdrop-blur-sm transition-all shadow-lg cursor-pointer"
                      title="Następne wideo"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>

              {/* Pasek nawigacyjny źródeł + Bezpośredni link awaryjny */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-400 px-1 select-none">
                <div className="flex items-center gap-2">
                  {allSources.length > 1 ? (
                    <>
                      <span>
                        Materiał: <strong>{currentVideoIndex + 1}</strong> z {allSources.length}
                      </span>
                      <div className="flex items-center gap-1.5 ml-2">
                        {allSources.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentVideoIndex(idx)}
                            className={`h-2 rounded-full transition-all cursor-pointer ${
                              currentVideoIndex === idx ? "w-6 bg-emerald-400" : "w-2 bg-neutral-700"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <span>Materiał wideo powiązany z ćwiczeniem</span>
                  )}
                </div>

                {/* Bezpośredni link ratunkowy do pliku/strony */}
                <a
                  href={rawCurrentUrl.replace("/preview", "/view")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 self-start sm:self-auto"
                >
                  <span>🔗 Problemy z odtwarzaniem? Otwórz bezpośrednio w nowej karcie</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed border-neutral-800 rounded-2xl text-neutral-500 text-xs mb-6">
              Brak przypisanego wideo do tego ćwiczenia.
            </div>
          )}

          {exercise.description && (
            <div className="space-y-2 mb-6">
              <h2 className="text-sm font-semibold text-neutral-200">
                Wskazówki trenerskie i metodyka:
              </h2>
              <div className="p-4 bg-neutral-950/60 border border-neutral-800/80 rounded-2xl text-neutral-300 text-sm leading-relaxed whitespace-pre-line">
                {exercise.description}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-neutral-800/60">
            <div>
              <p className="text-xs text-neutral-400 mb-2 font-medium">Kluczowe stawy:</p>
              <div className="flex flex-wrap gap-1.5 select-none">
                {exercise.joints && exercise.joints.length > 0 ? (
                  exercise.joints.map((joint) => (
                    <span
                      key={joint}
                      className="text-xs bg-neutral-800 text-neutral-200 px-2.5 py-1 rounded-lg border border-neutral-700"
                    >
                      🦴 {joint}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-500">Brak przypisanych stawów</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs text-neutral-400 mb-2 font-medium">Główne mięśnie i ścięgna:</p>
              <div className="flex flex-wrap gap-1.5 select-none">
                {exercise.muscles && exercise.muscles.length > 0 ? (
                  exercise.muscles.map((muscle) => (
                    <span
                      key={muscle}
                      className="text-xs bg-emerald-950/40 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-900/50"
                    >
                      ⚡ {muscle}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-500">Brak przypisanych mięśni</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Drzewko progresji */}
        <div className="bg-neutral-900/50 border border-neutral-800/90 rounded-3xl p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🌳</span> Drzewko Progresji (Skill Tree)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
                Wymagane fundamenty (Prerequisites)
              </h3>
              {prerequisites.length === 0 ? (
                <p className="text-xs text-neutral-500 italic py-2">
                  Brak wymagań wstępnych – element bazowy (Level 1).
                </p>
              ) : (
                <div className="space-y-2">
                  {prerequisites.map((p) => (
                    <Link
                      key={p.id}
                      href={`/exercise/${p.id}`}
                      className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 hover:border-amber-400/50 rounded-xl text-xs transition-colors"
                    >
                      <span className="font-semibold text-neutral-200">🔒 {p.title}</span>
                      <span className="text-[10px] text-neutral-500 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                        {p.difficulty}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
                Co odblokowuje (Next Steps)
              </h3>
              {unlockedTricks.length === 0 ? (
                <p className="text-xs text-neutral-500 italic py-2">
                  Ten element jest obecnie na szczycie gałęzi progresji.
                </p>
              ) : (
                <div className="space-y-2">
                  {unlockedTricks.map((u) => (
                    <Link
                      key={u.id}
                      href={`/exercise/${u.id}`}
                      className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 rounded-xl text-xs transition-colors"
                    >
                      <span className="font-semibold text-neutral-200">🔓 {u.title}</span>
                      <span className="text-[10px] text-neutral-500 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                        {u.difficulty}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FEED PRÓB ZAWODNIKÓW */}
        <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📹</span> Próby i Progres Zawodników
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Nagrania wykonania tego elementu ({submissions.length} wideo).
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              + Dodaj swoje wideo
            </button>
          </div>

          {submissions.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-neutral-800 rounded-2xl text-neutral-500 text-sm">
              Brak dodanych nagrań dla tego tricku.
            </div>
          ) : (
            <div className="space-y-6">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-neutral-200">{sub.athlete_name}</span>
                    <span className="text-[11px] text-neutral-500">
                      {new Date(sub.created_at).toLocaleDateString("pl-PL")}
                    </span>
                  </div>

                  {sub.video_url && (
                    <div className="space-y-1">
                      <div className="rounded-xl overflow-hidden aspect-video bg-neutral-950 border border-neutral-800">
                        <iframe
                          src={sub.video_url}
                          title={`Próba ${sub.athlete_name}`}
                          className="w-full h-full"
                          allowFullScreen
                        />
                      </div>
                      <div className="flex justify-end">
                        <a
                          href={sub.video_url.replace("/preview", "/view")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-400 hover:underline"
                        >
                          Otwórz nagranie w nowej karcie ↗
                        </a>
                      </div>
                    </div>
                  )}

                  {sub.notes && (
                    <p className="text-neutral-300 text-xs bg-neutral-900/60 p-3 rounded-xl border border-neutral-800/60">
                      💬 {sub.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal dodawania próby */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-1">Wrzuć próbę: {exercise.title}</h2>
            <form onSubmit={handleAddSubmission} className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Twoje imię / Nick *</label>
                <input
                  type="text"
                  required
                  value={form.athlete_name}
                  onChange={(e) => setForm({ ...form, athlete_name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Link do wideo *</label>
                <input
                  type="text"
                  required
                  placeholder="YouTube, Shorts lub link z Dysku Google"
                  value={form.video_url}
                  onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Komentarz</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-neutral-400 hover:text-white cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-5 py-2 rounded-xl text-sm transition-all cursor-pointer"
                >
                  Zapisz próbę
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}