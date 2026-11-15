"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface ExerciseOption {
  id: string;
  title: string;
  category: string;
  difficulty: string;
}

interface Submission {
  id: string;
  athlete_name: string;
  exercise_id: string;
  exercise_title: string;
  video_url: string | null;
  notes: string;
  coach_feedback: string | null;
  post_type?: string;
  workout_duration?: string;
  created_at: string;
}

const ALLOWED_TIMELINE_CATEGORIES = ["Tricking", "Plyometria", "Siła", "Rozciąganie"];

export default function TimelinePage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: "athlete" | "coach" } | null>(null);

  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [savingFeedbackId, setSavingFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    const savedProfile = localStorage.getItem("goat_athlete_profile");
    if (savedProfile) {
      try {
        setCurrentUser(JSON.parse(savedProfile));
      } catch {
        // Ignoruj błąd parsowania
      }
    }
    localStorage.setItem("timeline_last_read", Date.now().toString());
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: subData } = await supabase
      .from("progress_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (subData) {
      setSubmissions(subData);
      const initialDrafts: Record<string, string> = {};
      subData.forEach((s) => {
        initialDrafts[s.id] = s.coach_feedback || "";
      });
      setFeedbackDrafts(initialDrafts);
    }

    const { data: exData } = await supabase
      .from("exercises")
      .select("id, title, category, difficulty")
      .in("category", ALLOWED_TIMELINE_CATEGORIES)
      .order("title", { ascending: true });

    if (exData) {
      setExercises(exData);
      if (exData.length > 0) {
        setSelectedExerciseId(exData[0].id);
      }
    }

    setLoading(false);
  };

  const filteredExercises = useMemo(() => {
    const term = exerciseSearchTerm.trim().toLowerCase();
    if (!term) return exercises;
    return exercises.filter(
      (ex) =>
        ex.title.toLowerCase().includes(term) ||
        ex.category.toLowerCase().includes(term) ||
        ex.difficulty?.toLowerCase().includes(term)
    );
  }, [exercises, exerciseSearchTerm]);

  useEffect(() => {
    if (filteredExercises.length > 0) {
      const stillVisible = filteredExercises.some((ex) => ex.id === selectedExerciseId);
      if (!stillVisible) {
        setSelectedExerciseId(filteredExercises[0].id);
      }
    }
  }, [filteredExercises, selectedExerciseId]);

  const formatVideoUrl = (url: string) => {
    if (!url) return "";
    if (url.includes("youtube.com/watch?v=")) {
      const videoId = url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes("youtube.com/shorts/")) {
      const videoId = url.split("shorts/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes("drive.google.com/file/d/")) {
      const fileId = url.split("/d/")[1]?.split("/")[0];
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return url;
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const chosenEx = exercises.find((ex) => ex.id === selectedExerciseId);
    if (!chosenEx) {
      alert("Wybierz trick lub ćwiczenie z listy.");
      return;
    }

    setSubmitting(true);
    const formattedUrl = videoUrl.trim() ? formatVideoUrl(videoUrl.trim()) : null;

    const payload = {
      athlete_name: currentUser.username,
      exercise_id: chosenEx.id,
      exercise_title: chosenEx.title,
      video_url: formattedUrl,
      notes: notes.trim(),
      post_type: "video_progress",
    };

    const { data, error } = await supabase
      .from("progress_submissions")
      .insert([payload])
      .select();

    setSubmitting(false);

    if (!error && data) {
      setSubmissions((prev) => [data[0], ...prev]);
      setIsPostModalOpen(false);
      setVideoUrl("");
      setNotes("");
      setExerciseSearchTerm("");
    } else if (error) {
      alert("Błąd dodawania posta: " + error.message);
    }
  };

  const handleSaveFeedback = async (submissionId: string) => {
    if (currentUser?.role !== "coach") return;
    setSavingFeedbackId(submissionId);

    const feedbackText = feedbackDrafts[submissionId]?.trim() || null;

    const { error } = await supabase
      .from("progress_submissions")
      .update({ coach_feedback: feedbackText })
      .eq("id", submissionId);

    setSavingFeedbackId(null);

    if (!error) {
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, coach_feedback: feedbackText } : s))
      );
      alert("Wskazówka trenerska zapisana!");
    } else {
      alert("Błąd zapisu: " + error.message);
    }
  };

  const handleDeleteSubmission = async (id: string) => {
    if (!confirm("Czy na pewno usunąć ten wpis z Timeline?")) return;
    const { error } = await supabase.from("progress_submissions").delete().eq("id", id);
    if (!error) {
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 pb-20">
      {/* NAGŁÓWEK */}
      <div className="border-b border-neutral-800/80 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
            >
              ← Baza
            </Link>
            <div>
              <h1 className="text-base md:text-lg font-black text-emerald-400 uppercase tracking-tight">
                🎬 Timeline Ekipy
              </h1>
              <p className="text-[11px] text-neutral-400 hidden sm:block">
                Nagrania z sali, postępy i feedback trenerski
              </p>
            </div>
          </div>

          {currentUser ? (
            <button
              onClick={() => {
                setExerciseSearchTerm("");
                setIsPostModalOpen(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md transition-all active:scale-95"
            >
              + Dodaj Wideo / Postęp
            </button>
          ) : (
            <Link
              href="/"
              className="text-xs text-neutral-400 hover:text-emerald-400 underline"
            >
              Zaloguj się na głównej
            </Link>
          )}
        </div>
      </div>

      {/* LISTA WPISÓW */}
      <div className="max-w-3xl mx-auto px-4 mt-6 space-y-4">
        {loading ? (
          <div className="text-center py-16 text-neutral-500 text-xs animate-pulse">
            Ładowanie nagrań ekipy...
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 border border-neutral-900 rounded-3xl space-y-2">
            <p className="text-neutral-400 text-sm font-semibold">Brak wpisów na Timeline.</p>
            <p className="text-neutral-500 text-xs">
              Wrzuć pierwsze nagranie z treningu, aby otrzymać wskazówki techniczne!
            </p>
          </div>
        ) : (
          submissions.map((sub) => {
            const isWorkoutSummary = sub.post_type === "workout_summary";
            const canDelete =
              currentUser?.role === "coach" || currentUser?.username === sub.athlete_name;

            return (
              <article
                key={sub.id}
                className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-4 md:p-5 space-y-3.5 shadow-xl"
              >
                {/* GÓRA KARTY */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-2.5 py-0.5 rounded-lg">
                        👤 {sub.athlete_name}
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        {new Date(sub.created_at).toLocaleDateString("pl-PL", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <h2 className="text-base md:text-lg font-bold text-white">
                        {sub.exercise_title}
                      </h2>
                      {!isWorkoutSummary && sub.exercise_id && (
                        <Link
                          href={`/exercise/${sub.exercise_id}`}
                          className="text-[11px] text-emerald-400 hover:underline shrink-0"
                        >
                          Metodyka ↗
                        </Link>
                      )}
                    </div>
                  </div>

                  {canDelete && (
                    <button
                      onClick={() => handleDeleteSubmission(sub.id)}
                      className="text-xs text-neutral-500 hover:text-red-400 px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800"
                      title="Usuń wpis"
                    >
                      🗑️
                    </button>
                  )}
                </div>

                {/* NOTATKA ZAWODNIKA */}
                {sub.notes && (
                  <p className="text-xs md:text-sm text-neutral-300 bg-neutral-950/70 border border-neutral-800/80 p-3 rounded-2xl leading-relaxed">
                    {sub.notes}
                  </p>
                )}

                {/* ODTWARZACZ WIDEO */}
                {sub.video_url && (
                  <div className="rounded-2xl overflow-hidden border border-neutral-800 bg-black aspect-video">
                    <iframe
                      src={sub.video_url}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                {/* FEEDBACK TRENERA */}
                <div className="pt-1">
                  {currentUser?.role === "coach" ? (
                    <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                        📋 Wskazówka Trenera:
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Wpisz analizę techniczną lub korektę..."
                        value={feedbackDrafts[sub.id] ?? ""}
                        onChange={(e) =>
                          setFeedbackDrafts((prev) => ({
                            ...prev,
                            [sub.id]: e.target.value,
                          }))
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSaveFeedback(sub.id)}
                          disabled={savingFeedbackId === sub.id}
                          className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all"
                        >
                          {savingFeedbackId === sub.id ? "Zapisywanie..." : "Zapisz feedback"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    sub.coach_feedback && (
                      <div className="bg-amber-950/25 border border-amber-500/40 rounded-2xl p-3.5 space-y-1">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                          📋 Analiza Trenera:
                        </span>
                        <p className="text-xs md:text-sm text-amber-100 leading-relaxed">
                          {sub.coach_feedback}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* MODAL DODAWANIA POSTA Z WYSZUKIWARKĄ TRICKÓW */}
      {isPostModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-3.5 text-left">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
              <h2 className="text-base font-bold text-white">🎬 Dodaj Postęp na Timeline</h2>
              <button
                onClick={() => setIsPostModalOpen(false)}
                className="text-neutral-400 hover:text-white text-xs px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="text-neutral-400 block font-semibold">
                  1. Wyszukaj i wybierz trick lub ćwiczenie *
                </label>

                <input
                  type="text"
                  placeholder="🔍 Wpisz nazwę (np. Cork, Full, Szpagat)..."
                  value={exerciseSearchTerm}
                  onChange={(e) => setExerciseSearchTerm(e.target.value)}
                  className="w-full bg-neutral-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />

                <select
                  value={selectedExerciseId}
                  onChange={(e) => setSelectedExerciseId(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {filteredExercises.length === 0 ? (
                    <option value="">Brak pasujących tricków lub ćwiczeń</option>
                  ) : (
                    filteredExercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.category} • {ex.difficulty})
                      </option>
                    ))
                  )}
                </select>
                <span className="text-[10px] text-neutral-500 block">
                  Znaleziono: {filteredExercises.length} pozycji (Tricking, Plyometria, Siła, Rozciąganie)
                </span>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">
                  Link do wideo (YouTube / Google Drive)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/... lub YouTube"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Komentarz / Co poprawić?</label>
                <textarea
                  rows={3}
                  placeholder="np. Pierwsze próby lądowania, wydaje mi się że za szybko zrywam śrubę..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(false)}
                  className="px-3 py-1.5 text-neutral-400"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={submitting || filteredExercises.length === 0}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold px-4 py-1.5 rounded-xl"
                >
                  {submitting ? "Wysyłanie..." : "Opublikuj"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}