"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  uploadVideoToCloudinary,
  isDirectVideoUrl,
  MAX_CLOUDINARY_VIDEO_MB,
} from "@/lib/cloudinary";

interface ExerciseOption {
  id: string;
  title: string;
  category: string;
  difficulty: string;
}

interface SequenceStep {
  id: string;
  title: string;
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
  combo_sequence?: SequenceStep[];
  created_at: string;
}

const ALLOWED_TIMELINE_CATEGORIES = ["Tricking", "Plyometria", "Siła", "Rozciąganie"];

export default function TimelinePage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: "athlete" | "coach" } | null>(null);

  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState("");

  const [comboSequence, setComboSequence] = useState<SequenceStep[]>([]);
  const [comboSearchTerm, setComboSearchTerm] = useState("");

  const [uploadMode, setUploadMode] = useState<"file" | "link">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [removeExistingVideo, setRemoveExistingVideo] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");

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

  const filteredComboExercises = useMemo(() => {
    const term = comboSearchTerm.trim().toLowerCase();
    if (!term) return exercises.slice(0, 25);
    return exercises
      .filter(
        (ex) =>
          ex.title.toLowerCase().includes(term) ||
          ex.category.toLowerCase().includes(term)
      )
      .slice(0, 35);
  }, [exercises, comboSearchTerm]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_CLOUDINARY_VIDEO_MB) {
      alert(`Plik jest za duży (${sizeMb.toFixed(1)} MB). Maksymalny rozmiar to ${MAX_CLOUDINARY_VIDEO_MB} MB.`);
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setRemoveExistingVideo(false);
  };

  const openCreateModal = () => {
    setEditingSubmission(null);
    setExerciseSearchTerm("");
    setComboSearchTerm("");
    setComboSequence([]);
    if (exercises.length > 0) {
      setSelectedExerciseId(exercises[0].id);
    }
    setSelectedFile(null);
    setVideoUrl("");
    setNotes("");
    setRemoveExistingVideo(false);
    setUploadMode("file");
    setIsPostModalOpen(true);
  };

  const openEditModal = (sub: Submission) => {
    setEditingSubmission(sub);
    setExerciseSearchTerm("");
    setComboSearchTerm("");
    setComboSequence(Array.isArray(sub.combo_sequence) ? sub.combo_sequence : []);
    if (sub.exercise_id && exercises.some((e) => e.id === sub.exercise_id)) {
      setSelectedExerciseId(sub.exercise_id);
    } else if (exercises.length > 0) {
      setSelectedExerciseId(exercises[0].id);
    }
    setSelectedFile(null);
    setRemoveExistingVideo(false);
    setNotes(sub.notes || "");

    if (sub.video_url && !isDirectVideoUrl(sub.video_url)) {
      setUploadMode("link");
      setVideoUrl(sub.video_url);
    } else {
      setUploadMode("file");
      setVideoUrl("");
    }
    setIsPostModalOpen(true);
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const isWorkoutSummary = editingSubmission?.post_type === "workout_summary";
    const chosenEx = exercises.find((ex) => ex.id === selectedExerciseId);

    if (!isWorkoutSummary && !chosenEx) {
      alert("Wybierz główny trick lub ćwiczenie z listy.");
      return;
    }

    setSubmitting(true);
    let finalVideoUrl: string | null = editingSubmission ? editingSubmission.video_url : null;

    try {
      if (removeExistingVideo) {
        finalVideoUrl = null;
      }

      if (uploadMode === "file" && selectedFile) {
        setUploadStatusText("Przesyłanie i optymalizacja wideo: 0%");
        finalVideoUrl = await uploadVideoToCloudinary(selectedFile, (percent) => {
          setUploadStatusText(
            percent < 100
              ? `Przesyłanie wideo: ${percent}%`
              : "Kompresja i optymalizacja wideo w chmurze..."
          );
        });
      } else if (uploadMode === "link") {
        if (videoUrl.trim()) {
          finalVideoUrl = formatVideoUrl(videoUrl.trim());
        } else if (!editingSubmission) {
          finalVideoUrl = null;
        }
      }

      setUploadStatusText(editingSubmission ? "Aktualizowanie wpisu..." : "Zapisywanie wpisu...");

      if (editingSubmission) {
        const updatePayload: Record<string, unknown> = {
          notes: notes.trim(),
          video_url: finalVideoUrl,
          combo_sequence: comboSequence,
        };

        if (!isWorkoutSummary && chosenEx) {
          updatePayload.exercise_id = chosenEx.id;
          updatePayload.exercise_title = chosenEx.title;
        }

        const { data, error } = await supabase
          .from("progress_submissions")
          .update(updatePayload)
          .eq("id", editingSubmission.id)
          .select();

        if (error) {
          throw new Error("Błąd aktualizacji wpisu: " + error.message);
        }

        if (data && data[0]) {
          setSubmissions((prev) =>
            prev.map((item) => (item.id === editingSubmission.id ? data[0] : item))
          );
        }
      } else {
        const insertPayload = {
          athlete_name: currentUser.username,
          exercise_id: chosenEx!.id,
          exercise_title: chosenEx!.title,
          video_url: finalVideoUrl,
          notes: notes.trim(),
          post_type: "video_progress",
          combo_sequence: comboSequence,
        };

        const { data, error } = await supabase
          .from("progress_submissions")
          .insert([insertPayload])
          .select();

        if (error) {
          throw new Error("Błąd zapisu posta: " + error.message);
        }

        if (data && data[0]) {
          setSubmissions((prev) => [data[0], ...prev]);
        }
      }

      setIsPostModalOpen(false);
      setEditingSubmission(null);
      setSelectedFile(null);
      setVideoUrl("");
      setNotes("");
      setExerciseSearchTerm("");
      setComboSearchTerm("");
      setComboSequence([]);
      setRemoveExistingVideo(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Wystąpił nieznany błąd.";
      alert(message);
    } finally {
      setSubmitting(false);
      setUploadStatusText("");
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

  const handleDeleteSubmission = async (sub: Submission) => {
    if (!confirm("Czy na pewno usunąć ten wpis z Timeline?")) return;

    const { error } = await supabase.from("progress_submissions").delete().eq("id", sub.id);
    if (!error) {
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
    } else {
      alert("Nie udało się usunąć wpisu: " + error.message);
    }
  };

  const canManageSubmission = (sub: Submission) => {
    if (!currentUser) return false;
    if (currentUser.role === "coach") return true;
    return (
      currentUser.username.trim().toLowerCase() ===
      (sub.athlete_name || "").trim().toLowerCase()
    );
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
              onClick={openCreateModal}
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
            const canManage = canManageSubmission(sub);

            return (
              <article
                key={sub.id}
                className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-4 md:p-5 space-y-3.5 shadow-xl"
              >
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

                  {canManage && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => openEditModal(sub)}
                        className="text-xs text-neutral-300 hover:text-emerald-400 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 transition-colors"
                        title="Edytuj wpis"
                      >
                        ✏️ Edytuj
                      </button>
                      <button
                        onClick={() => handleDeleteSubmission(sub)}
                        className="text-xs text-neutral-400 hover:text-red-400 px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800 transition-colors"
                        title="Usuń wpis"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                {Array.isArray(sub.combo_sequence) && sub.combo_sequence.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 bg-neutral-950/90 border border-emerald-500/30 p-2.5 rounded-2xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mr-1">
                      🔗 Combo:
                    </span>
                    {sub.combo_sequence.map((step, idx) => (
                      <React.Fragment key={`${step.id}-${idx}`}>
                        <Link
                          href={`/exercise/${step.id}`}
                          className="text-[11px] font-bold bg-neutral-900 hover:border-emerald-400 border border-neutral-700 text-emerald-300 px-2 py-0.5 rounded-lg"
                        >
                          {step.title}
                        </Link>
                        {idx < sub.combo_sequence!.length - 1 && (
                          <span className="text-emerald-500 font-bold text-xs">➔</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {sub.notes && (
                  <p className="text-xs md:text-sm text-neutral-300 bg-neutral-950/70 border border-neutral-800/80 p-3 rounded-2xl leading-relaxed">
                    {sub.notes}
                  </p>
                )}

                {sub.video_url && (
                  <div className="rounded-2xl overflow-hidden border border-neutral-800 bg-black">
                    {isDirectVideoUrl(sub.video_url) ? (
                      <video
                        src={sub.video_url}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full max-h-[480px] object-contain mx-auto"
                      />
                    ) : (
                      <div className="aspect-video">
                        <iframe
                          src={sub.video_url}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </div>
                )}

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

      {/* MODAL DODAWANIA / EDYCJI POSTA */}
      {isPostModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-3.5 text-left max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
              <h2 className="text-base font-bold text-white">
                {editingSubmission ? "✏️ Edytuj Wpis na Timeline" : "🎬 Dodaj Postęp na Timeline"}
              </h2>
              <button
                onClick={() => !submitting && setIsPostModalOpen(false)}
                className="text-neutral-400 hover:text-white text-xs px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePost} className="space-y-3 text-xs">
              {editingSubmission?.post_type !== "workout_summary" && (
                <div className="space-y-1.5">
                  <label className="text-neutral-400 block font-semibold">
                    1. Główny trick lub ćwiczenie *
                  </label>

                  <input
                    type="text"
                    placeholder="🔍 Wpisz główny element (np. Corkscrew)..."
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
                </div>
              )}

              <div className="border border-neutral-800 bg-neutral-950/70 p-3 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-emerald-400 font-semibold">
                    2. Sekwencja elementów nagrania ({comboSequence.length})
                  </label>
                  {comboSequence.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setComboSequence([])}
                      className="text-[10px] text-neutral-500 hover:text-red-400"
                    >
                      Wyczyść
                    </button>
                  )}
                </div>

                {comboSequence.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 bg-neutral-900 p-2 rounded-xl border border-neutral-800">
                    {comboSequence.map((step, idx) => (
                      <React.Fragment key={`${step.id}-${idx}`}>
                        <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                          <span>{step.title}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setComboSequence((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-red-400 hover:text-red-300 ml-0.5"
                          >
                            ✕
                          </button>
                        </span>
                        {idx < comboSequence.length - 1 && (
                          <span className="text-neutral-500 text-xs">➔</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="🔍 Dodaj po kolei (np. Hook Kick, Touchdown Raiz, Cork)..."
                  value={comboSearchTerm}
                  onChange={(e) => setComboSearchTerm(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />

                <div className="max-h-24 overflow-y-auto space-y-1">
                  {filteredComboExercises.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() =>
                        setComboSequence((prev) => [...prev, { id: ex.id, title: ex.title }])
                      }
                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-neutral-900 text-neutral-300 text-[11px] flex items-center justify-between"
                    >
                      <span>+ {ex.title}</span>
                      <span className="text-[10px] text-neutral-500">{ex.category}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-neutral-400 font-semibold">3. Nagranie wideo</label>
                  <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setUploadMode("file")}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                        uploadMode === "file"
                          ? "bg-emerald-500 text-black"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      📁 Plik z telefonu
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode("link")}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                        uploadMode === "link"
                          ? "bg-emerald-500 text-black"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      🔗 Link YT/Drive
                    </button>
                  </div>
                </div>

                {editingSubmission?.video_url && !removeExistingVideo && !selectedFile && (
                  <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 px-3 py-2 rounded-xl text-[11px]">
                    <span className="text-emerald-400 truncate max-w-[220px]">
                      ✓ Obecne nagranie załączone
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveExistingVideo(true);
                        setVideoUrl("");
                      }}
                      className="text-red-400 hover:underline shrink-0"
                    >
                      Usuń wideo
                    </button>
                  </div>
                )}

                {uploadMode === "file" ? (
                  <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-neutral-700 hover:border-emerald-500/60 bg-neutral-950/80 rounded-2xl p-4 cursor-pointer transition-all text-center">
                    <span className="text-xl mb-1">📹</span>
                    {selectedFile ? (
                      <div className="space-y-0.5">
                        <span className="text-emerald-400 font-bold block truncate max-w-[260px]">
                          {selectedFile.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 block">
                          {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Kliknij, aby zmienić
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <span className="text-neutral-200 font-semibold block">
                          {editingSubmission?.video_url && !removeExistingVideo
                            ? "Kliknij, aby podmienić nagranie"
                            : "Kliknij, aby wybrać film z galerii"}
                        </span>
                        <span className="text-[10px] text-neutral-500 block">
                          MP4 / MOV / WEBM (do {MAX_CLOUDINARY_VIDEO_MB} MB, auto-kompresja)
                        </span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <input
                    type="url"
                    placeholder="https://youtube.com/... lub Google Drive"
                    value={videoUrl}
                    onChange={(e) => {
                      setVideoUrl(e.target.value);
                      setRemoveExistingVideo(false);
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                )}
              </div>

              <div>
                <label className="text-neutral-400 block mb-1 font-semibold">
                  4. Komentarz / Co poprawić?
                </label>
                <textarea
                  rows={3}
                  placeholder="np. Pierwsze próby lądowania, wydaje mi się że za szybko zrywam śrubę..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {uploadStatusText && (
                <div className="bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold px-3 py-2 rounded-xl animate-pulse text-center">
                  ⏳ {uploadStatusText}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsPostModalOpen(false)}
                  className="px-3 py-1.5 text-neutral-400 disabled:opacity-40"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (editingSubmission?.post_type !== "workout_summary" &&
                      filteredExercises.length === 0)
                  }
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold px-4 py-1.5 rounded-xl"
                >
                  {submitting
                    ? "Wysyłanie..."
                    : editingSubmission
                    ? "Zapisz zmiany"
                    : "Opublikuj"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}