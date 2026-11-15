"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  uploadVideoToCloudinary,
  isDirectVideoUrl,
  MAX_CLOUDINARY_VIDEO_MB,
} from "@/lib/cloudinary";

interface Submission {
  id: string;
  athlete_name: string;
  exercise_id: string;
  exercise_title: string;
  video_url: string | null;
  notes: string;
  coach_feedback: string;
  status: string;
  post_type?: string;
  workout_duration?: string;
  created_at: string;
}

interface TimelineComment {
  id: string;
  submission_id: string;
  author_name: string;
  author_role: string;
  content: string;
  created_at: string;
}

interface ExerciseOption {
  id: string;
  title: string;
  category: string;
}

export default function TimelinePage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [commentsBySubmission, setCommentsBySubmission] = useState<Record<string, TimelineComment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);

  const [exercisesList, setExercisesList] = useState<ExerciseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: "athlete" | "coach" } | null>(null);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "link">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [newSubmission, setNewSubmission] = useState({
    exercise_id: "",
    video_url: "",
    notes: "",
  });

  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("Do sprawdzenia");

  useEffect(() => {
    const saved = localStorage.getItem("goat_athlete_profile");
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch {
        setCurrentUser(null);
      }
    }

    localStorage.setItem("timeline_last_read", Date.now().toString());
    fetchTimelineData();
  }, []);

  const fetchTimelineData = async () => {
    setLoading(true);

    const { data: subData } = await supabase
      .from("progress_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (subData) {
      setSubmissions(subData);
    }

    const { data: commData } = await supabase
      .from("timeline_comments")
      .select("*")
      .order("created_at", { ascending: true });

    if (commData) {
      const grouped: Record<string, TimelineComment[]> = {};
      for (const c of commData as TimelineComment[]) {
        if (!grouped[c.submission_id]) grouped[c.submission_id] = [];
        grouped[c.submission_id].push(c);
      }
      setCommentsBySubmission(grouped);
    }

    const { data: exData } = await supabase
      .from("exercises")
      .select("id, title, category")
      .neq("category", "Muzyka")
      .order("title", { ascending: true });

    if (exData) {
      setExercisesList(exData);
      if (exData.length > 0) {
        setNewSubmission((prev) => ({ ...prev, exercise_id: exData[0].id }));
      }
    }

    setLoading(false);
  };

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

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_CLOUDINARY_VIDEO_MB) {
      alert(
        `Wybrane wideo waży ${sizeMb.toFixed(1)} MB. Maksymalny rozmiar pliku to ${MAX_CLOUDINARY_VIDEO_MB} MB.`
      );
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleCreateSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const selectedEx = exercisesList.find((x) => x.id === newSubmission.exercise_id);
    if (!selectedEx) return;

    setSubmittingPost(true);
    let finalVideoUrl: string | null = null;

    try {
      if (uploadMode === "file") {
        if (!selectedFile) {
          alert("Wybierz plik wideo z urządzenia (lub przełącz na tryb Linku).");
          setSubmittingPost(false);
          return;
        }

        setUploadProgressText("Przesyłanie i kompresja wideo: 0%");
        finalVideoUrl = await uploadVideoToCloudinary(selectedFile, (percent) => {
          setUploadProgressText(
            percent < 100
              ? `Przesyłanie wideo: ${percent}%`
              : "Optymalizacja wideo w chmurze..."
          );
        });
      } else {
        if (!newSubmission.video_url.trim()) {
          alert("Wklej link do filmu!");
          setSubmittingPost(false);
          return;
        }
        finalVideoUrl = formatVideoUrl(newSubmission.video_url.trim());
      }

      setUploadProgressText("Zapisywanie posta na Timeline...");

      const payload = {
        athlete_name: currentUser.username,
        exercise_id: selectedEx.id,
        exercise_title: selectedEx.title,
        video_url: finalVideoUrl,
        notes: newSubmission.notes,
        post_type: "video",
      };

      const { data, error } = await supabase
        .from("progress_submissions")
        .insert([payload])
        .select();

      if (error) {
        throw new Error("Błąd zapisu posta: " + error.message);
      }

      if (data && data[0]) {
        setSubmissions((prev) => [data[0], ...prev]);
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        setNewSubmission((prev) => ({ ...prev, video_url: "", notes: "" }));
        localStorage.setItem("timeline_last_read", Date.now().toString());
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Wystąpił błąd podczas dodawania wideo.");
    } finally {
      setSubmittingPost(false);
      setUploadProgressText("");
    }
  };

  const handleAddComment = async (e: React.FormEvent, submissionId: string) => {
    e.preventDefault();
    if (!currentUser) return;

    const text = (commentInputs[submissionId] || "").trim();
    if (!text) return;

    setSubmittingCommentId(submissionId);
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

    if (!error && data && data[0]) {
      setCommentsBySubmission((prev) => ({
        ...prev,
        [submissionId]: [...(prev[submissionId] || []), data[0] as TimelineComment],
      }));
      setCommentInputs((prev) => ({ ...prev, [submissionId]: "" }));
    } else if (error) {
      alert("Błąd dodawania komentarza: " + error.message);
    }

    setSubmittingCommentId(null);
  };

  const handleDeleteComment = async (comment: TimelineComment) => {
    if (!currentUser) return;

    const isOwner =
      currentUser.username.trim().toLowerCase() ===
      comment.author_name.trim().toLowerCase();
    const isCoach = currentUser.role === "coach";

    if (!isOwner && !isCoach) {
      alert("Możesz usuwać wyłącznie własne komentarze.");
      return;
    }

    if (!confirm("Usunąć ten komentarz?")) return;

    const { error } = await supabase
      .from("timeline_comments")
      .delete()
      .eq("id", comment.id);

    if (!error) {
      setCommentsBySubmission((prev) => ({
        ...prev,
        [comment.submission_id]: (prev[comment.submission_id] || []).filter(
          (c) => c.id !== comment.id
        ),
      }));
    }
  };

  const handleSaveCoachFeedback = async (id: string) => {
    if (currentUser?.role !== "coach") return;

    const { error } = await supabase
      .from("progress_submissions")
      .update({
        coach_feedback: feedbackDraft,
        status: statusDraft,
      })
      .eq("id", id);

    if (!error) {
      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, coach_feedback: feedbackDraft, status: statusDraft } : item
        )
      );
      setEditingFeedbackId(null);
    }
  };

  const handleDeleteSubmission = async (sub: Submission) => {
    if (!currentUser) return;

    const isOwner =
      currentUser.username.trim().toLowerCase() ===
      sub.athlete_name.trim().toLowerCase();
    const isCoach = currentUser.role === "coach";

    if (!isOwner && !isCoach) {
      alert("Nie masz uprawnień do usunięcia posta innego zawodnika.");
      return;
    }

    if (!confirm(`Czy na pewno usunąć wpis użytkownika ${sub.athlete_name}?`)) return;

    const { error } = await supabase
      .from("progress_submissions")
      .delete()
      .eq("id", sub.id);

    if (!error) {
      setSubmissions((prev) => prev.filter((item) => item.id !== sub.id));
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} dni temu`;
    if (hours > 0) return `${hours} godz. temu`;
    if (mins > 0) return `${mins} min. temu`;
    return "Przed chwilą";
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* NAGŁÓWEK */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-neutral-400 hover:text-emerald-400 text-xs font-medium bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl"
            >
              ← Baza
            </Link>
            <h1 className="text-xl md:text-2xl font-black text-emerald-400 tracking-tight uppercase">
              🎬 Timeline Ekipy
            </h1>
          </div>

          {currentUser && (
            <button
              onClick={() => {
                setSelectedFile(null);
                setUploadMode("file");
                setIsUploadModalOpen(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-4 py-2 rounded-xl shadow-lg active:scale-95 transition-all"
            >
              + Wrzuć Wideo
            </button>
          )}
        </div>

        {!currentUser && (
          <div className="bg-neutral-900/60 border border-neutral-800 p-3.5 rounded-2xl text-xs text-neutral-400 text-center">
            Zaloguj się w bazie głównej, aby wrzucać wideo i komentować posty ekipy.
          </div>
        )}

        {/* STREAM POSTÓW */}
        {loading ? (
          <div className="text-center py-12 text-neutral-500 text-xs animate-pulse">
            Ładowanie aktywności drużyny...
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-14 text-neutral-500 text-xs border border-neutral-900 rounded-2xl">
            Brak filmików na osi czasu. Wrzuć pierwsze nagranie z sali!
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub) => {
              const isWorkoutSummary = sub.post_type === "workout_summary";
              const postComments = commentsBySubmission[sub.id] || [];

              const canDeletePost =
                !!currentUser &&
                (currentUser.role === "coach" ||
                  currentUser.username.trim().toLowerCase() ===
                    sub.athlete_name.trim().toLowerCase());

              return (
                <div
                  key={sub.id}
                  className={`border rounded-3xl p-4 md:p-5 space-y-3.5 text-left transition-all ${
                    isWorkoutSummary
                      ? "bg-emerald-950/15 border-emerald-500/40"
                      : "bg-neutral-900/60 border-neutral-800"
                  }`}
                >
                  {/* NAGŁÓWEK WPISU */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-white bg-neutral-950 border border-neutral-800 px-2.5 py-0.5 rounded-lg">
                          👤 {sub.athlete_name}
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          {formatTimeAgo(sub.created_at)}
                        </span>
                      </div>

                      <div className="pt-1 flex items-center gap-2 flex-wrap">
                        {isWorkoutSummary ? (
                          <span className="text-sm md:text-base font-black text-emerald-400">
                            🏆 {sub.exercise_title}
                          </span>
                        ) : (
                          <Link
                            href={`/exercise/${sub.exercise_id}`}
                            className="text-sm md:text-base font-bold text-emerald-300 hover:underline"
                          >
                            🎯 {sub.exercise_title} →
                          </Link>
                        )}
                        {sub.workout_duration && (
                          <span className="text-[11px] font-mono bg-neutral-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                            ⏱️ {sub.workout_duration}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isWorkoutSummary && (
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            sub.status === "Zaliczone / Czysto"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                              : sub.status === "Do poprawy"
                              ? "bg-amber-950 text-amber-300 border-amber-700"
                              : "bg-neutral-950 text-neutral-400 border-neutral-800"
                          }`}
                        >
                          {sub.status || "Do sprawdzenia"}
                        </span>
                      )}

                      {canDeletePost && (
                        <button
                          onClick={() => handleDeleteSubmission(sub)}
                          title="Usuń własny wpis"
                          className="text-xs text-neutral-500 hover:text-red-400 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded-lg transition-colors"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* NOTATKA ZAWODNIKA */}
                  {sub.notes && (
                    <p className="text-neutral-300 text-xs md:text-sm leading-relaxed bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/60">
                      {sub.notes}
                    </p>
                  )}

                  {/* ODTWARZACZ WIDEO */}
                  {sub.video_url && !isWorkoutSummary && (
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

                  {/* OFICJALNA OCENA TRENERA */}
                  {sub.coach_feedback && editingFeedbackId !== sub.id && (
                    <div className="bg-emerald-950/30 border border-emerald-500/40 p-3.5 rounded-2xl space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                        📋 Feedback Trenera:
                      </span>
                      <p className="text-xs md:text-sm text-neutral-200 leading-relaxed">
                        {sub.coach_feedback}
                      </p>
                    </div>
                  )}

                  {/* PANEL OCENY DLA TRENERA */}
                  {currentUser?.role === "coach" && !isWorkoutSummary && (
                    <div className="pt-1">
                      {editingFeedbackId === sub.id ? (
                        <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-2xl space-y-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-400">Ocena techniczna:</span>
                            <select
                              value={statusDraft}
                              onChange={(e) => setStatusDraft(e.target.value)}
                              className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs"
                            >
                              <option value="Do sprawdzenia">Do sprawdzenia</option>
                              <option value="Zaliczone / Czysto">Zaliczone / Czysto</option>
                              <option value="Do poprawy">Do poprawy</option>
                            </select>
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Wskazówki techniczne dla zawodnika..."
                            value={feedbackDraft}
                            onChange={(e) => setFeedbackDraft(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2 text-xs text-white"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingFeedbackId(null)}
                              className="px-2.5 py-1 text-neutral-400"
                            >
                              Anuluj
                            </button>
                            <button
                              onClick={() => handleSaveCoachFeedback(sub.id)}
                              className="bg-emerald-500 text-black font-bold px-3 py-1 rounded-lg"
                            >
                              Zapisz ocenę
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingFeedbackId(sub.id);
                            setFeedbackDraft(sub.coach_feedback || "");
                            setStatusDraft(sub.status || "Do sprawdzenia");
                          }}
                          className="text-xs text-emerald-400 hover:underline font-semibold"
                        >
                          ✍️ {sub.coach_feedback ? "Edytuj ocenę trenera" : "Dodaj ocenę trenera"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* SEKCJA KOMENTARZY EKIPY */}
                  <div className="pt-2.5 border-t border-neutral-800/80 space-y-2.5">
                    <span className="text-[11px] font-bold text-neutral-400 block">
                      💬 Komentarze ({postComments.length})
                    </span>

                    {postComments.length > 0 && (
                      <div className="space-y-1.5">
                        {postComments.map((comm) => {
                          const canDeleteComment =
                            !!currentUser &&
                            (currentUser.role === "coach" ||
                              currentUser.username.trim().toLowerCase() ===
                                comm.author_name.trim().toLowerCase());

                          return (
                            <div
                              key={comm.id}
                              className="bg-neutral-950/80 border border-neutral-800/80 rounded-xl px-3 py-2 text-xs flex items-start justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`font-bold ${
                                      comm.author_role === "coach"
                                        ? "text-emerald-400"
                                        : "text-neutral-200"
                                    }`}
                                  >
                                    {comm.author_name}
                                    {comm.author_role === "coach" && " (Trener)"}
                                  </span>
                                  <span className="text-[10px] text-neutral-500">
                                    • {formatTimeAgo(comm.created_at)}
                                  </span>
                                </div>
                                <p className="text-neutral-300 leading-relaxed">{comm.content}</p>
                              </div>

                              {canDeleteComment && (
                                <button
                                  onClick={() => handleDeleteComment(comm)}
                                  title="Usuń komentarz"
                                  className="text-[10px] text-neutral-500 hover:text-red-400 px-1 shrink-0"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {currentUser && (
                      <form
                        onSubmit={(e) => handleAddComment(e, sub.id)}
                        className="flex items-center gap-2 pt-0.5"
                      >
                        <input
                          type="text"
                          placeholder="Napisz komentarz..."
                          value={commentInputs[sub.id] || ""}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [sub.id]: e.target.value,
                            }))
                          }
                          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="submit"
                          disabled={submittingCommentId === sub.id}
                          className="bg-neutral-800 hover:bg-emerald-500 hover:text-black text-emerald-400 font-bold text-xs px-3.5 py-2 rounded-xl transition-all shrink-0"
                        >
                          {submittingCommentId === sub.id ? "..." : "Wyślij"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL WRZUCANIA WIDEO */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-3.5 text-left">
            <h2 className="text-base font-bold text-white">🎬 Wrzuć Progres Wideo</h2>

            <form onSubmit={handleCreateSubmission} className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Element / Ćwiczenie *</label>
                <select
                  value={newSubmission.exercise_id}
                  onChange={(e) => setNewSubmission({ ...newSubmission, exercise_id: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {exercisesList.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setUploadMode("file")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    uploadMode === "file"
                      ? "bg-emerald-500 text-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  📁 Plik z telefonu / PC
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode("link")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    uploadMode === "link"
                      ? "bg-emerald-500 text-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  🔗 Link (YouTube / Drive)
                </button>
              </div>

              {uploadMode === "file" ? (
                <div>
                  <label className="text-neutral-400 block mb-1">
                    Wybierz nagranie (max {MAX_CLOUDINARY_VIDEO_MB} MB) *
                  </label>
                  <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-neutral-700 hover:border-emerald-500/60 bg-neutral-950/80 rounded-2xl p-4 cursor-pointer transition-colors text-center">
                    {selectedFile ? (
                      <div className="space-y-1">
                        <span className="text-emerald-400 font-bold text-xs block truncate max-w-[260px]">
                          📹 {selectedFile.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 block">
                          {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Kliknij, aby zmienić
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-lg block">📲</span>
                        <span className="text-neutral-300 text-xs font-semibold block">
                          Kliknij, aby wybrać film z galerii
                        </span>
                        <span className="text-[10px] text-neutral-500 block">
                          MP4, MOV, WebM (automatyczna kompresja)
                        </span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileSelection}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div>
                  <label className="text-neutral-400 block mb-1">Link do wideo (YouTube / Drive) *</label>
                  <input
                    type="url"
                    placeholder="https://youtube.com/... lub Google Drive"
                    value={newSubmission.video_url}
                    onChange={(e) => setNewSubmission({ ...newSubmission, video_url: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              )}

              <div>
                <label className="text-neutral-400 block mb-1">Komentarz / Odczucia z próby</label>
                <textarea
                  rows={2}
                  placeholder="np. Pierwsze lądowanie na twardej macie, czuć jeszcze lekki niedokładny set..."
                  value={newSubmission.notes}
                  onChange={(e) => setNewSubmission({ ...newSubmission, notes: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {uploadProgressText && (
                <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold px-3 py-2 rounded-xl animate-pulse text-center">
                  ⏳ {uploadProgressText}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  disabled={submittingPost}
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-3 py-1.5 text-neutral-400 disabled:opacity-40"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={submittingPost}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-1.5 rounded-xl disabled:opacity-50"
                >
                  {submittingPost ? "Przesyłanie..." : "Opublikuj"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}