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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ athlete_name: "", video_url: "", notes: "" });

  const formatVideoUrl = (url: string) => {
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
    return url;
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
    } else {
      setPrerequisites([]);
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
      video_url: formatVideoUrl(form.video_url),
      notes: form.notes,
    };

    const { data, error } = await supabase
      .from("progress_submissions")
      .insert([payload])
      .select();

    if (!error && data) {
      setSubmissions((prev) => [data[0], ...prev]);
      setIsModalOpen(false);
      setForm({ athlete_name: "", video_url: "", notes: "" });
    } else if (error) {
      alert("Błąd: " + error.message);
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
        <Link href="/" className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold underline">
          ← Wróć do bazy
        </Link>
      </div>
    );
  }

  // Lista wszystkich źródeł (nowa tablica lub stary pojedynczy video_url)
  const allSources = exercise.sources && exercise.sources.length > 0 
    ? exercise.sources 
    : (exercise.video_url ? [exercise.video_url] : []);

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
            🎬 Otwórz globalny Timeline →
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

          {/* PREZENTACJA WSZYSTKICH ŹRÓDEŁ */}
          {allSources.length > 0 && (
            <div className="space-y-4 mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Materiały źródłowe & Tutoriale ({allSources.length}):
              </h2>
              <div className="space-y-4">
                {allSources.map((sourceUrl, idx) => {
                  const isEmbed = sourceUrl.includes("youtube.com/embed") || sourceUrl.includes("drive.google.com");
                  return (
                    <div key={idx} className="space-y-2">
                      {isEmbed ? (
                        <div className="rounded-2xl overflow-hidden aspect-video bg-neutral-950 border border-neutral-800 shadow-2xl">
                          <iframe
                            src={sourceUrl}
                            title={`${exercise.title} - źródło ${idx + 1}`}
                            className="w-full h-full"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3.5 bg-neutral-950 border border-neutral-800 hover:border-emerald-500/50 rounded-xl text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <span>🔗 Otwórz źródło #{idx + 1} w nowej karcie</span>
                          <span className="text-neutral-500 truncate max-w-xs">{sourceUrl}</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
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
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🌳</span> Drzewko Progresji (Skill Tree)
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Hierarchia i zależności ruchowe w metodyce nauczania.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Wymagane fundamenty (Prerequisites)
                </h3>
              </div>

              {prerequisites.length === 0 ? (
                <p className="text-xs text-neutral-500 italic py-2">
                  Brak wymagań wstępnych – ten ruch to element bazowy (Level 1 / Fundament).
                </p>
              ) : (
                <div className="space-y-2">
                  {prerequisites.map((p) => (
                    <Link
                      key={p.id}
                      href={`/exercise/${p.id}`}
                      className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 hover:border-amber-400/50 rounded-xl text-xs transition-colors group"
                    >
                      <span className="font-semibold text-neutral-200 group-hover:text-amber-300">
                        🔒 {p.title}
                      </span>
                      <span className="text-[10px] text-neutral-500 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                        {p.difficulty}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Co odblokowuje (Next Steps)
                </h3>
              </div>

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
                      className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 rounded-xl text-xs transition-colors group"
                    >
                      <span className="font-semibold text-neutral-200 group-hover:text-emerald-300">
                        🔓 {u.title}
                      </span>
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

        {/* Sekcja postępów zawodników */}
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
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-xs">
                        {sub.athlete_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm text-neutral-200">
                        {sub.athlete_name}
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-500">
                      {new Date(sub.created_at).toLocaleDateString("pl-PL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {sub.video_url && (
                    <div className="rounded-xl overflow-hidden aspect-video bg-neutral-950 border border-neutral-800">
                      <iframe
                        src={sub.video_url}
                        title={`Próba ${sub.athlete_name}`}
                        className="w-full h-full"
                        allowFullScreen
                      />
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-1">
              Wrzuć próbę: {exercise.title}
            </h2>
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
                  className="px-4 py-2 text-sm text-neutral-400 hover:text-white"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-5 py-2 rounded-xl text-sm transition-all"
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