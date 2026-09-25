"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface ProgressItem {
  id: string;
  athlete_name: string;
  exercise_id: string;
  exercise_title: string;
  video_url: string;
  notes: string;
  created_at: string;
}

interface TimelineComment {
  id: string;
  submission_id: string;
  author_name: string;
  author_role: "athlete" | "coach";
  content: string;
  created_at: string;
}

const COACH_PIN = "1234";

export default function TimelinePage() {
  const [submissions, setSubmissions] = useState<ProgressItem[]>([]);
  const [comments, setComments] = useState<TimelineComment[]>([]);
  const [loading, setLoading] = useState(true);

  // Profil użytkownika
  const [currentUser, setCurrentUser] = useState<{ username: string; role: "athlete" | "coach" } | null>(null);

  // Filtry
  const [filterAthlete, setFilterAthlete] = useState("Wszyscy");
  const [filterExercise, setFilterExercise] = useState("Wszystkie");

  // Modal wideo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exercisesList, setExercisesList] = useState<{ id: string; title: string }[]>([]);
  const [form, setForm] = useState({
    athlete_name: "",
    exercise_id: "",
    exercise_title: "",
    video_url: "",
    notes: "",
  });

  // Nowy komentarz
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setLoading(true);

    const { data: subsData } = await supabase
      .from("progress_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (subsData) setSubmissions(subsData);

    const { data: commsData } = await supabase
      .from("timeline_comments")
      .select("*")
      .order("created_at", { ascending: true });

    if (commsData) setComments(commsData);

    const { data: exData } = await supabase.from("exercises").select("id, title");
    if (exData) {
      setExercisesList(exData);
      if (exData.length > 0 && !form.exercise_id) {
        setForm((prev) => ({
          ...prev,
          exercise_id: exData[0].id,
          exercise_title: exData[0].title,
        }));
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    localStorage.setItem("timeline_last_read", Date.now().toString());

    const savedUserStr = localStorage.getItem("goat_athlete_profile");
    if (savedUserStr) {
      try {
        const parsed = JSON.parse(savedUserStr);
        setCurrentUser(parsed);
        setForm((prev) => ({ ...prev, athlete_name: parsed.username }));
      } catch {
        setCurrentUser(null);
      }
    }

    fetchData();
  }, []);

  const handleToggleCoach = () => {
    if (currentUser?.role === "coach") {
      const downgraded = { username: currentUser.username, role: "athlete" as const };
      setCurrentUser(downgraded);
      localStorage.setItem("goat_athlete_profile", JSON.stringify(downgraded));
    } else {
      const pin = prompt("Podaj PIN Trenera / Admina:");
      if (pin === COACH_PIN) {
        const upgraded = { username: currentUser?.username || "Trener", role: "coach" as const };
        setCurrentUser(upgraded);
        localStorage.setItem("goat_athlete_profile", JSON.stringify(upgraded));
      } else if (pin !== null) {
        alert("Nieprawidłowy PIN.");
      }
    }
  };

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

  const handleSaveSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.athlete_name || !form.video_url) return;

    const payload = {
      athlete_name: form.athlete_name,
      exercise_id: form.exercise_id,
      exercise_title: form.exercise_title,
      video_url: formatVideoUrl(form.video_url),
      notes: form.notes,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from("progress_submissions")
        .update(payload)
        .eq("id", editingId)
        .select();

      if (!error && data) {
        setSubmissions((prev) =>
          prev.map((item) => (item.id === editingId ? { ...item, ...data[0] } : item))
        );
        setIsModalOpen(false);
        setEditingId(null);
      }
    } else {
      const { data, error } = await supabase
        .from("progress_submissions")
        .insert([payload])
        .select();

      if (!error && data) {
        setSubmissions((prev) => [data[0], ...prev]);
        setIsModalOpen(false);
        setForm((prev) => ({ ...prev, video_url: "", notes: "" }));
      }
    }
  };

  const handleDeleteSubmission = async (id: string, athlete: string) => {
    if (!confirm(`Czy na pewno usunąć nagranie zawodnika "${athlete}"?`)) return;
    const { error } = await supabase.from("progress_submissions").delete().eq("id", id);
    if (!error) {
      setSubmissions((prev) => prev.filter((item) => item.id !== id));
      setComments((prev) => prev.filter((c) => c.submission_id !== id));
    }
  };

  const handleAddComment = async (submissionId: string) => {
    const text = newCommentText[submissionId]?.trim();
    if (!text || !currentUser) return;

    const payload = {
      submission_id: submissionId,
      author_name: currentUser.username,
      author_role: currentUser.role,
      content: text,
    };

    const { data, error } = await supabase
      .from("timeline_comments")
      .insert([payload])
      .select();

    if (!error && data) {
      setComments((prev) => [...prev, data[0]]);
      setNewCommentText((prev) => ({ ...prev, [submissionId]: "" }));
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Usunąć ten komentarz?")) return;
    const { error } = await supabase.from("timeline_comments").delete().eq("id", commentId);
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  };

  // Listy do filtrów
  const uniqueAthletes = useMemo(() => {
    const names = Array.from(new Set(submissions.map((s) => s.athlete_name)));
    return ["Wszyscy", ...names];
  }, [submissions]);

  const uniqueExercises = useMemo(() => {
    const titles = Array.from(new Set(submissions.map((s) => s.exercise_title).filter(Boolean)));
    return ["Wszystkie", ...titles];
  }, [submissions]);

  // Przefiltrowana lista wpisów
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      if (filterAthlete !== "Wszyscy" && s.athlete_name !== filterAthlete) return false;
      if (filterExercise !== "Wszystkie" && s.exercise_title !== filterExercise) return false;
      return true;
    });
  }, [submissions, filterAthlete, filterExercise]);

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-neutral-900/90 border border-neutral-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-3xl mx-auto">
            🔒
          </div>
          <h1 className="text-2xl font-black text-white">Strona tylko dla zalogowanych</h1>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Oś czasu i feed postępów z sali treningowej są dostępne wyłącznie dla członków drużyny Road to GOAT.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
            >
              ← Wróć na stronę główną i zaloguj się
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Pasek nawigacyjny */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-4 select-none">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-emerald-400 transition-colors"
          >
            <span>←</span>
            <span>Wróć do bazy ROAD TO GOAT</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleToggleCoach}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                currentUser?.role === "coach"
                  ? "bg-neutral-800 text-emerald-400 border-emerald-500/50 hover:bg-neutral-700"
                  : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
              }`}
            >
              {currentUser?.role === "coach" ? "🔒 Trener" : "🔑 Trener"}
            </button>

            <button
              onClick={() => {
                setEditingId(null);
                setForm({
                  athlete_name: currentUser.username,
                  exercise_id: exercisesList[0]?.id || "",
                  exercise_title: exercisesList[0]?.title || "",
                  video_url: "",
                  notes: "",
                });
                setIsModalOpen(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-1.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              + Dodaj nagranie
            </button>
          </div>
        </div>

        {/* Nagłówek i statystyka */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
                <span>🎬</span> Oś Czasu & Feed Progresu
              </h1>
              {currentUser?.role === "coach" && (
                <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                  Tryb Trenera
                </span>
              )}
            </div>
            <p className="text-neutral-400 text-sm mt-1 leading-relaxed">
              Analizy, ewolucje i próby z sali treningowej. Zostawiaj feedback i obserwuj rozwój ekipy.
            </p>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 px-4 py-2 rounded-2xl text-xs text-neutral-400 shrink-0">
            Nagrania w bazie: <strong className="text-emerald-400 font-mono text-sm">{submissions.length}</strong>
          </div>
        </div>

        {/* Pasek filtrów */}
        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-3.5 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 font-semibold uppercase tracking-wider">Zawodnik:</span>
            <select
              value={filterAthlete}
              onChange={(e) => setFilterAthlete(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {uniqueAthletes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-neutral-500 font-semibold uppercase tracking-wider">Ćwiczenie / Trick:</span>
            <select
              value={filterExercise}
              onChange={(e) => setFilterExercise(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {uniqueExercises.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </div>

          {(filterAthlete !== "Wszyscy" || filterExercise !== "Wszystkie") && (
            <button
              onClick={() => {
                setFilterAthlete("Wszyscy");
                setFilterExercise("Wszystkie");
              }}
              className="text-neutral-400 hover:text-emerald-400 text-xs ml-auto cursor-pointer"
            >
              Zresetuj filtry ✕
            </button>
          )}
        </div>

        {/* Lista wpisów */}
        {loading ? (
          <div className="text-center py-16 text-neutral-500 text-sm animate-pulse">
            Ładowanie feedu nagrań...
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-center py-16 text-neutral-500 text-sm border border-neutral-900 rounded-3xl">
            Brak nagrań spełniających wybrane kryteria.
          </div>
        ) : (
          <div className="space-y-6">
            {filteredSubmissions.map((sub) => {
              const postComments = comments.filter((c) => c.submission_id === sub.id);

              return (
                <div
                  key={sub.id}
                  className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-5 md:p-7 space-y-4 shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-sm">
                        {sub.athlete_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{sub.athlete_name}</h3>
                        <p className="text-xs text-neutral-500">
                          {new Date(sub.created_at).toLocaleDateString("pl-PL", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-neutral-800 text-emerald-400 border border-neutral-700">
                        🎯 {sub.exercise_title}
                      </span>

                      {currentUser?.role === "coach" && (
                        <div className="flex items-center gap-1.5 ml-2">
                          <button
                            onClick={() => {
                              setEditingId(sub.id);
                              setForm({
                                athlete_name: sub.athlete_name,
                                exercise_id: sub.exercise_id,
                                exercise_title: sub.exercise_title,
                                video_url: sub.video_url,
                                notes: sub.notes || "",
                              });
                              setIsModalOpen(true);
                            }}
                            className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2.5 py-1 rounded-lg border border-neutral-700 cursor-pointer"
                            title="Edytuj wpis"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteSubmission(sub.id, sub.athlete_name)}
                            className="text-xs bg-red-950/40 hover:bg-red-900/60 text-red-400 px-2 py-1 rounded-lg border border-red-900/50 cursor-pointer"
                            title="Usuń wpis"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Odtwarzacz */}
                  {sub.video_url && (
                    <div className="space-y-1.5">
                      <div className="rounded-2xl overflow-hidden aspect-video bg-neutral-950 border border-neutral-800">
                        <iframe
                          src={sub.video_url}
                          title={sub.exercise_title}
                          className="w-full h-full"
                          allow="autoplay; encrypted-media; fullscreen"
                          allowFullScreen
                        />
                      </div>
                      {sub.video_url.includes("drive.google.com") && (
                        <div className="flex justify-end">
                          <a
                            href={sub.video_url.replace("/preview", "/view")}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <span>🔗 Otwórz w Google Drive</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {sub.notes && (
                    <p className="text-neutral-300 text-sm bg-neutral-950/60 p-4 rounded-2xl border border-neutral-800/80 leading-relaxed">
                      💬 <strong className="text-neutral-200">Notatka:</strong> {sub.notes}
                    </p>
                  )}

                  {/* SEKCJA KOMENTARZY & FEEDBACKU */}
                  <div className="border-t border-neutral-800/80 pt-4 space-y-3">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🗣️</span> Komentarze & Wskazówki trenerskie ({postComments.length})
                    </p>

                    {postComments.length > 0 && (
                      <div className="space-y-2">
                        {postComments.map((com) => {
                          const isCoachCom = com.author_role === "coach";
                          return (
                            <div
                              key={com.id}
                              className={`p-3 rounded-xl text-xs space-y-1 border ${
                                isCoachCom
                                  ? "bg-emerald-950/30 border-emerald-500/40 text-neutral-200"
                                  : "bg-neutral-950/60 border-neutral-800/80 text-neutral-300"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">{com.author_name}</span>
                                  {isCoachCom && (
                                    <span className="text-[9px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded-md">
                                      Trener / Wskazówka
                                    </span>
                                  )}
                                  <span className="text-[10px] text-neutral-500">
                                    {new Date(com.created_at).toLocaleDateString("pl-PL", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>

                                {(currentUser.role === "coach" || currentUser.username === com.author_name) && (
                                  <button
                                    onClick={() => handleDeleteComment(com.id)}
                                    className="text-[10px] text-neutral-500 hover:text-red-400 cursor-pointer"
                                    title="Usuń komentarz"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              <p className="leading-relaxed">{com.content}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Formularz dodawania komentarza */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Napisz komentarz lub wskazówkę..."
                        value={newCommentText[sub.id] || ""}
                        onChange={(e) =>
                          setNewCommentText({ ...newCommentText, [sub.id]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddComment(sub.id);
                          }
                        }}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={() => handleAddComment(sub.id)}
                        className="bg-neutral-800 hover:bg-emerald-500 hover:text-black text-neutral-200 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer"
                      >
                        Wyślij
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal dodawania i edycji nagrania */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingId ? "✏️ Edytuj wpis w Timeline" : "🎬 Wrzuć swoją próbę / wideo"}
            </h2>

            <form onSubmit={handleSaveSubmission} className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Twoje imię / Nick *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Piotrek, Alicja"
                  value={form.athlete_name}
                  onChange={(e) => setForm({ ...form, athlete_name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Jaki trick / ćwiczenie wykonujesz? *</label>
                <select
                  value={form.exercise_id}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const found = exercisesList.find((x) => x.id === selId);
                    setForm({
                      ...form,
                      exercise_id: selId,
                      exercise_title: found ? found.title : "",
                    });
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                >
                  {exercisesList.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  Link wideo (YouTube, Shorts lub Dysk Google) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="YouTube lub link z Dysku Google"
                  value={form.video_url}
                  onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Komentarz / Wrażenia z próby</label>
                <textarea
                  rows={2}
                  placeholder="Co poszło dobrze, nad czym pracujesz, amortyzacja..."
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
                  {editingId ? "Zapisz zmiany" : "Opublikuj w Timeline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}