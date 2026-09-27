"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ExerciseDetail {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
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
  category: string;
}

interface ProgressSubmission {
  id: string;
  athlete_name: string;
  video_url?: string;
  notes: string;
  created_at: string;
}

const TRICKING_LEVELS = [
  "Lvl 1: Fundamenty",
  "Lvl 2: Baza",
  "Lvl 3: Pojedyncze śruby",
  "Lvl 4: Zaawansowane",
  "Lvl 5: Master",
  "Lvl 6: Elite",
];

const STANDARD_DIFFICULTIES = [
  "Fundament / Wdrożenie",
  "Średniozaawansowany",
  "Zaawansowany / Wyczyn",
];

export default function ExerciseDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [prerequisites, setPrerequisites] = useState<MiniExercise[]>([]);
  const [unlockedTricks, setUnlockedTricks] = useState<MiniExercise[]>([]);
  const [submissions, setSubmissions] = useState<ProgressSubmission[]>([]);
  const [allExercisesList, setAllExercisesList] = useState<MiniExercise[]>([]);
  const [loading, setLoading] = useState(true);

  // Sesja użytkownika / uprawnienia trenera
  const [currentUser, setCurrentUser] = useState<{ username: string; role: "athlete" | "coach" } | null>(null);

  // Karuzela wideo
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  // Modal zgłoszenia wideo zawodnika
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [submissionForm, setSubmissionForm] = useState({ athlete_name: "", video_url: "", notes: "" });

  // Modal edycji tricku dla Admina / Trenera
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    category: "Tricking",
    subcategory: "",
    difficulty: "Lvl 1: Fundamenty",
    short_description: "",
    description: "",
    sources: [""] as string[],
    prerequisite_ids: [] as string[],
  });
  const [prereqSearch, setPrereqSearch] = useState("");

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

    // 1. Bieżące ćwiczenie
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

    // Formularz edycji startowo
    const initialSources = currentEx.sources && currentEx.sources.length > 0
      ? currentEx.sources
      : currentEx.video_url
      ? [currentEx.video_url]
      : [""];

    setEditForm({
      title: currentEx.title,
      category: currentEx.category,
      subcategory: currentEx.subcategory || "",
      difficulty: currentEx.difficulty,
      short_description: currentEx.short_description || "",
      description: currentEx.description || "",
      sources: initialSources,
      prerequisite_ids: currentEx.prerequisite_ids || [],
    });

    // 2. Cała lista do wyboru w drzewku
    const { data: allList } = await supabase
      .from("exercises")
      .select("id, title, difficulty, category")
      .order("title", { ascending: true });

    if (allList) setAllExercisesList(allList);

    // 3. Wymagane fundamenty (Prerequisites)
    if (currentEx.prerequisite_ids && currentEx.prerequisite_ids.length > 0) {
      const { data: prereqData } = await supabase
        .from("exercises")
        .select("id, title, difficulty, category")
        .in("id", currentEx.prerequisite_ids);

      if (prereqData) setPrerequisites(prereqData);
    } else {
      setPrerequisites([]);
    }

    // 4. Co odblokowuje (Unlocked Tricks)
    const { data: unlockedData } = await supabase
      .from("exercises")
      .select("id, title, difficulty, category")
      .contains("prerequisite_ids", [id]);

    if (unlockedData) setUnlockedTricks(unlockedData);
    else setUnlockedTricks([]);

    // 5. Próby wideo zawodników
    const { data: subsData } = await supabase
      .from("progress_submissions")
      .select("id, athlete_name, video_url, notes, created_at")
      .eq("exercise_id", id)
      .order("created_at", { ascending: false });

    if (subsData) setSubmissions(subsData);

    setLoading(false);
  };

  useEffect(() => {
    // Weryfikacja zalogowanego profilu
    const savedUser = localStorage.getItem("goat_athlete_profile");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        if (parsed.username) {
          setSubmissionForm((p) => ({ ...p, athlete_name: parsed.username }));
        }
      } catch {
        setCurrentUser(null);
      }
    }

    fetchDetailAndTree();
  }, [id]);

  const handleAddSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionForm.athlete_name || !exercise) return;

    const payload = {
      athlete_name: submissionForm.athlete_name,
      exercise_id: exercise.id,
      exercise_title: exercise.title,
      video_url: submissionForm.video_url ? parseVideoEmbed(submissionForm.video_url) : null,
      notes: submissionForm.notes,
      post_type: "video",
    };

    const { data, error } = await supabase.from("progress_submissions").insert([payload]).select();

    if (!error && data) {
      setSubmissions((prev) => [data[0], ...prev]);
      setIsSubmissionModalOpen(false);
      setSubmissionForm((p) => ({ ...p, video_url: "", notes: "" }));
      alert("Twoja próba została wrzucona na Timeline! 🎬");
    } else {
      alert("Błąd: " + error?.message);
    }
  };

  // Zapis zmian w edycji ćwiczenia przez Trenera
  const handleSaveExerciseEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.title || !exercise) return;

    const formattedSources = editForm.sources
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(parseVideoEmbed);

    const payload = {
      title: editForm.title,
      category: editForm.category,
      subcategory: editForm.subcategory,
      difficulty: editForm.difficulty,
      short_description: editForm.short_description,
      description: editForm.description,
      sources: formattedSources,
      video_url: formattedSources[0] || "",
      prerequisite_ids: editForm.prerequisite_ids,
    };

    const { data, error } = await supabase
      .from("exercises")
      .update(payload)
      .eq("id", exercise.id)
      .select();

    if (!error && data) {
      setIsEditModalOpen(false);
      await fetchDetailAndTree();
      alert("Zaktualizowano pomyślnie metodykę i powiązania w drzewku!");
    } else {
      alert("Błąd zapisu: " + error?.message);
    }
  };

  const togglePrereqId = (selectedId: string) => {
    setEditForm((prev) => {
      const exists = prev.prerequisite_ids.includes(selectedId);
      return {
        ...prev,
        prerequisite_ids: exists
          ? prev.prerequisite_ids.filter((x) => x !== selectedId)
          : [...prev.prerequisite_ids, selectedId],
      };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center text-sm animate-pulse">
        Budowanie podglądu metodycznego...
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

  const filteredPrereqOptions = allExercisesList.filter(
    (item) =>
      item.id !== exercise.id &&
      item.title.toLowerCase().includes(prereqSearch.toLowerCase())
  );

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

          <div className="flex items-center gap-3">
            {currentUser?.role === "coach" && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border border-emerald-500/40 text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>✏️ Edytuj metodykę & drzewko</span>
              </button>
            )}

            <Link href="/timeline" className="text-xs text-neutral-400 hover:text-emerald-400 transition-colors">
              🎬 Timeline →
            </Link>
          </div>
        </div>

        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 select-none">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-neutral-800 text-emerald-400 border border-neutral-700">
                {exercise.subcategory || exercise.category}
              </span>
              <span className="text-xs text-neutral-400 bg-neutral-950 px-3 py-1 rounded-lg border border-neutral-800">
                {exercise.difficulty}
              </span>
            </div>

            {currentUser?.role === "coach" && (
              <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                Tryb Trenera Aktywny
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
            {exercise.title}
          </h1>

          {exercise.short_description && (
            <p className="text-emerald-400/90 text-sm md:text-base font-medium mb-6">
              {exercise.short_description}
            </p>
          )}

          {/* ODTWARZACZ WIDEO ZE STRZAŁKAMI I AWARYJNYM LINKIEM */}
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
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-neutral-900/90">
                    <span className="text-4xl mb-3">🔗</span>
                    <h3 className="text-white font-bold text-base mb-1">
                      Materiał ze strony zewnętrznej
                    </h3>
                    <p className="text-xs text-neutral-400 max-w-sm mb-4 leading-relaxed">
                      Ta witryna blokuje osadzanie w ramkach. Możesz otworzyć pełny poradnik bezpośrednio pod adresem źródłowym.
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
                    <span>Materiał metodyczny powiązany z ćwiczeniem</span>
                  )}
                </div>

                <a
                  href={rawCurrentUrl.replace("/preview", "/view")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1"
                >
                  <span>🔗 Otwórz w nowej karcie</span>
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
        </div>

        {/* DRZEWKO PROGRESJI (SKILL TREE) */}
        <div className="bg-neutral-900/50 border border-neutral-800/90 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🌳</span> Drzewko Progresji (Skill Tree)
            </h2>
            {currentUser?.role === "coach" && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="text-xs text-emerald-400 hover:underline cursor-pointer"
              >
                + Zmień powiązania w drzewku
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
                <span>🔒</span> Wymagane fundamenty ({prerequisites.length})
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
                <span>🔓</span> Co odblokowuje ({unlockedTricks.length})
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
              onClick={() => setIsSubmissionModalOpen(true)}
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

      {/* MODAL EDYCJI METODYKI I DRZEWKA (DLA TRENERA) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
            <h2 className="text-xl font-bold text-white mb-1">
              ✏️ Edytuj Element & Drzewko Progresji
            </h2>

            <form onSubmit={handleSaveExerciseEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Nazwa elementu *</label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Poziom zaawansowania</label>
                  <select
                    value={editForm.difficulty}
                    onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {(editForm.category === "Tricking" ? TRICKING_LEVELS : STANDARD_DIFFICULTIES).map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Krótki opis (na kafelek) *</label>
                <input
                  type="text"
                  required
                  value={editForm.short_description}
                  onChange={(e) => setEditForm({ ...editForm, short_description: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Szczegółowa metodyka & technika</label>
                <textarea
                  rows={4}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* SEKCJA DRZEWKA: WYBÓR FUNDAMENTÓW (PREREQUISITES) */}
              <div className="border border-neutral-800 bg-neutral-950/70 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🌳</span> Wymagane fundamenty w Drzewku ({editForm.prerequisite_ids.length})
                  </span>
                  <span className="text-[11px] text-neutral-500">Kliknij, aby zaznaczyć/odznaczyć</span>
                </div>

                <input
                  type="text"
                  placeholder="Filtruj tricki do powiązania..."
                  value={prereqSearch}
                  onChange={(e) => setPrereqSearch(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                />

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {filteredPrereqOptions.map((item) => {
                    const isSelected = editForm.prerequisite_ids.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => togglePrereqId(item.id)}
                        className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "hover:bg-neutral-900 text-neutral-400 border border-transparent"
                        }`}
                      >
                        <span className="font-semibold">{item.title}</span>
                        <span className="text-[10px] text-neutral-500">{item.difficulty}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ŹRÓDŁA WIDEO */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-emerald-400 font-medium">
                    🔗 Źródła wideo (YouTube, Shorts, Dysk Google)
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditForm((p) => ({ ...p, sources: [...p.sources, ""] }))}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                  >
                    + Dodaj kolejne wideo
                  </button>
                </div>

                {editForm.sources.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Link wideo #${idx + 1}`}
                      value={s}
                      onChange={(e) => {
                        const newS = [...editForm.sources];
                        newS[idx] = e.target.value;
                        setEditForm({ ...editForm, sources: newS });
                      }}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    />
                    {editForm.sources.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((p) => ({
                            ...p,
                            sources: p.sources.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-neutral-500 hover:text-red-400 text-sm px-2 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm text-neutral-400 hover:text-white cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2 rounded-xl text-sm transition-all cursor-pointer"
                >
                  Zapisz zmiany w bazie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL WRZUCANIA PRÓBY PRZEZ ZAWODNIKA */}
      {isSubmissionModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-1">Wrzuć próbę: {exercise.title}</h2>
            <form onSubmit={handleAddSubmission} className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Twoje imię / Nick *</label>
                <input
                  type="text"
                  required
                  value={submissionForm.athlete_name}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, athlete_name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Link do wideo (YouTube, Shorts lub Dysk)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={submissionForm.video_url}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, video_url: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Komentarz / Wrażenia</label>
                <textarea
                  rows={2}
                  value={submissionForm.notes}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, notes: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSubmissionModalOpen(false)}
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