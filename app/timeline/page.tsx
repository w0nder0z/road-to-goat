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

  // Status profilu
  const [currentUser, setCurrentUser] = useState<{ username: string; role: "athlete" | "coach" } | null>(null);

  // Modal
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

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      athlete_name: currentUser?.username || "",
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
        setForm((prev) => ({
          ...prev,
          video_url: "",
          notes: "",
        }));
      }
    }
  };

  const handleDeleteSubmission = async (id: string, athlete: string) => {
    if (!confirm(`Czy na pewno usunąć nagranie zawodnika "${athlete}"?`)) {
      return;
    }
    const { error } = await supabase.from("progress_submissions").delete().eq("id", id);
    if (!error) {
      setSubmissions((prev) => prev.filter((item) => item.id !== id));
    }
  };

  // EKRAN BLOKADY DLA NIEZALOGOWANYCH
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
              onClick={handleOpenAdd}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-1.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              + Dodaj nagranie
            </button>
          </div>
        </div>

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
            Wszystkie nagrania, ewolucje i próby z sali treningowej w jednym miejscu.
          </p>
        </div>

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

                    {currentUser?.role === "coach" && (
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
                    {sub.video_url.includes("drive.google.com") && (
                      <div className="flex justify-end">
                        <a
                          href={sub.video_url.replace("/preview", "/view")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <span>🔗 Otwórz bezpośrednio na Google Drive</span>
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