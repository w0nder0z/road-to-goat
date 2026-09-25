"use client";

import React, { useEffect, useState } from "react";
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

const COACH_PIN = "1234";

export default function TimelinePage() {
  const [submissions, setSubmissions] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Uprawnienia trenera
  const [isCoach, setIsCoach] = useState(false);

  // Modal (dodawanie i edycja)
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

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("progress_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setSubmissions(data);

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
    fetchData();
    const savedRole = localStorage.getItem("coach_access");
    if (savedRole === "true") {
      setIsCoach(true);
    }
  }, []);

  const handleToggleCoach = () => {
    if (isCoach) {
      setIsCoach(false);
      localStorage.removeItem("coach_access");
    } else {
      const pin = prompt("Podaj kod dostępu Trenera / Admina:");
      if (pin === COACH_PIN) {
        setIsCoach(true);
        localStorage.setItem("coach_access", "true");
      } else if (pin !== null) {
        alert("Nieprawidłowy kod dostępu.");
      }
    }
  };

  const formatVideoUrl = (url: string) => {
    if (!url) return "";

    // Dysk Google
    if (url.includes("drive.google.com/file/d/")) {
      const fileId = url.split("/d/")[1]?.split("/")[0];
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }

    // YouTube Shorts
    if (url.includes("youtube.com/shorts/")) {
      const videoId = url.split("shorts/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }

    // YouTube watch
    if (url.includes("youtube.com/watch?v=")) {
      const videoId = url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }

    // YouTube youtu.be
    if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }

    return url;
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      athlete_name: "",
      exercise_id: exercisesList[0]?.id || "",
      exercise_title: exercisesList[0]?.title || "",
      video_url: "",
      notes: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sub: ProgressItem) => {
    setEditingId(sub.id);
    setForm({
      athlete_name: sub.athlete_name,
      exercise_id: sub.exercise_id,
      exercise_title: sub.exercise_title,
      video_url: sub.video_url,
      notes: sub.notes || "",
    });
    setIsModalOpen(true);
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
      // EDYCJA (UPDATE)
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
      } else if (error) {
        alert("Błąd zapisu zmian: " + error.message);
      }
    } else {
      // NOWY WPIS (INSERT)
      const { data, error } = await supabase
        .from("progress_submissions")
        .insert([payload])
        .select();

      if (!error && data) {
        setSubmissions((prev) => [data[0], ...prev]);
        setIsModalOpen(false);
      } else if (error) {
        alert("Błąd: " + error.message);
      }
    }
  };

  const handleDeleteSubmission = async (id: string, athlete: string) => {
    if (!confirm(`Czy jako Trener chcesz usunąć nagranie zawodnika "${athlete}"?`)) {
      return;
    }

    const { error } = await supabase.from("progress_submissions").delete().eq("id", id);

    if (!error) {
      setSubmissions((prev) => prev.filter((item) => item.id !== id));
    } else {
      alert("Błąd podczas usuwania: " + error.message);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Nawigacja */}
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
                isCoach
                  ? "bg-neutral-800 text-emerald-400 border-emerald-500/50 hover:bg-neutral-700"
                  : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
              }`}
            >
              {isCoach ? "🔒 Trener" : "🔑 Trener"}
            </button>

            <button
              onClick={handleOpenAdd}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-1.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              + Dodaj nagranie
            </button>
          </div>
        </div>

        {/* Tytuł */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
              <span>🎬</span> Oś Czasu & Feed Progresu
            </h1>
            {isCoach && (
              <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                Tryb Trenera
              </span>
            )}
          </div>
          <p className="text-neutral-400 text-sm mt-1 leading-relaxed">
            Tutaj trafiają wszystkie próby, sukcesy i analizy techniczne zawodników z całej platformy.
          </p>
        </div>

        {/* Lista wideo */}
        {loading ? (
          <div className="text-center py-16 text-neutral-500 text-sm animate-pulse">
            Ładowanie feedu nagrań...
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 text-neutral-500 text-sm border border-neutral-900 rounded-3xl">
            Oś czasu jest jeszcze pusta. Dodaj pierwsze wideo przyciskiem u góry!
          </div>
        ) : (
          <div className="space-y-6">
            {submissions.map((sub) => (
              <div
                key={sub.id}
                className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-sm">
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

                    {/* Przyciski Trenera: Edytuj i Usuń */}
                    {isCoach && (
                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          onClick={() => handleOpenEdit(sub)}
                          className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2.5 py-1 rounded-lg border border-neutral-700 transition-colors cursor-pointer"
                          title="Edytuj wpis"
                        >
                          ✏️ Edytuj
                        </button>
                        <button
                          onClick={() => handleDeleteSubmission(sub.id, sub.athlete_name)}
                          className="text-xs bg-red-950/40 hover:bg-red-900/60 text-red-400 px-2 py-1 rounded-lg border border-red-900/50 transition-colors cursor-pointer"
                          title="Usuń wpis"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Odtwarzacz wideo */}
                {sub.video_url && (
                  <div className="space-y-2">
                    <div className="rounded-2xl overflow-hidden aspect-video bg-neutral-950 border border-neutral-800">
                      <iframe
                        src={sub.video_url}
                        title={sub.exercise_title}
                        className="w-full h-full"
                        allow="autoplay; encrypted-media; fullscreen"
                        allowFullScreen
                      />
                    </div>
                    {/* Link zapasowy dla Dysku Google */}
                    {sub.video_url.includes("drive.google.com") && (
                      <div className="flex justify-end">
                        <a
                          href={sub.video_url.replace("/preview", "/view")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <span>🔗 Otwórz wideo bezpośrednio w Google Drive</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {sub.notes && (
                  <p className="text-neutral-300 text-sm bg-neutral-950/60 p-4 rounded-2xl border border-neutral-800/80 leading-relaxed">
                    💬 {sub.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal dodawania i edycji */}
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
                <p className="text-[11px] text-neutral-500 mt-1 leading-normal">
                  💡 <strong>Tip Google Drive:</strong> W Dysku Google kliknij <em>Udostępnij</em> i zaznacz: <strong>„Każda osoba mająca link (Przeglądający)”</strong>. Na YouTube możesz wybrać <strong>Niepubliczny (Unlisted)</strong>.
                </p>
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
                  className="px-4 py-2 text-sm text-neutral-400 hover:text-white"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-5 py-2 rounded-xl text-sm transition-all"
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