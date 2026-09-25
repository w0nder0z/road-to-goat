"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Exercise {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  difficulty: string;
  short_description: string;
  description?: string;
  video_url?: string;
  prerequisite_ids?: string[];
  muscles?: string[];
  joints?: string[];
}

interface Workout {
  id: string;
  title: string;
  description: string;
  level: string;
  exercise_ids: string[];
  created_at: string;
}

const MAIN_CATEGORIES = [
  "Tricking",
  "Plyometria",
  "Siła",
  "Rozciąganie",
  "Dieta",
  "Własne treningi",
  "Muzyka",
];

const SUBCATEGORIES_CONFIG: Record<string, string[]> = {
  Tricking: [
    "Wszystkie podkategorie",
    "Vertical Kicks (Pop, Cheat, Swing)",
    "Backward Tricks (Backflip, Cork, Full, Gainer)",
    "Forward Tricks (Frontflip, Webster, Janitor)",
    "Inside Tricks (Aerial, B-kick/twist, Wrap)",
    "Outside Tricks (Raiz, Doubleleg, Sideflip)",
  ],
  Plyometria: [
    "Wszystkie partie",
    "Staw skokowy / Ścięgno Achillesa",
    "Moc kolana / Czworogłowy",
    "Biodro / Pośladek (Wybicie)",
    "Amortyzacja / Zeskok (Deceleracja)",
  ],
  Siła: [
    "Wszystkie partie",
    "Dolne partie (Nogi / Pośladki)",
    "Górne partie (Klatka / Plecy / Barki)",
    "Core / Antyrotacja",
    "Siła chwytu i ramion",
  ],
  Rozciąganie: [
    "Wszystkie partie",
    "Szpagaty / Zginacze i Kulszowe",
    "Otwarcie klatki i barków",
    "Mobilność stawu skokowego",
    "Mobilność bioder i miednicy",
    "Kręgosłup (Mostki / Rotacja)",
  ],
  Dieta: [
    "Wszystkie grupy",
    "Drób / Kurczak",
    "Mięso czerwone",
    "Ryby / Owoce morza",
    "Warzywa / Owoce",
    "Węglowodany / Energia",
    "Nawodnienie / Suplementacja",
  ],
  "Własne treningi": [
    "Wszystkie zestawy",
    "Tricking Session",
    "Moc & Skoczność",
    "Górne partie / Core",
    "Regeneracja & Mobility",
  ],
  Muzyka: [
    "Wszystkie playlisty",
    "Tricking Battles / Bass",
    "Drill / Hype Hip-Hop",
    "Phonk / Hardstyle",
    "Rozgrzewka / Flow",
    "Stretching / Chillout",
  ],
};

const TRICKING_LEVELS = [
  "Wszystkie poziomy",
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

const COACH_PIN = "69420";

export default function Home() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Tricking");
  const [activeSubcategory, setActiveSubcategory] = useState("Wszystkie podkategorie");
  const [activeTrickingLevel, setActiveTrickingLevel] = useState("Wszystkie poziomy");
  const [searchTerm, setSearchTerm] = useState("");

  const [isCoach, setIsCoach] = useState(false);
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  // Modal pozycji
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

  // Modal kreatora treningu
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [workoutForm, setWorkoutForm] = useState({
    title: "",
    description: "",
    level: "Średniozaawansowany",
    exercise_ids: [] as string[],
  });

  // Wyszukiwarka drzewka w modalu
  const [prereqQuery, setPrereqQuery] = useState("");
  const [isPrereqDropdownOpen, setIsPrereqDropdownOpen] = useState(false);
  const prereqRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    category: "Tricking",
    subcategory: "Vertical Kicks (Pop, Cheat, Swing)",
    difficulty: "Lvl 1: Fundamenty",
    short_description: "",
    description: "",
    videoUrl: "",
    prerequisite_ids: [] as string[],
  });

  const fetchData = async () => {
    setLoading(true);
    // Pobierz ćwiczenia
    const { data: exData } = await supabase
      .from("exercises")
      .select("id, title, category, subcategory, difficulty, short_description, description, video_url, prerequisite_ids, muscles, joints")
      .order("created_at", { ascending: false });

    if (exData) setExercises(exData);

    // Pobierz treningi
    const { data: woData } = await supabase
      .from("workouts")
      .select("*")
      .order("created_at", { ascending: false });

    if (woData) setWorkouts(woData);

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

  const handleCategorySwitch = (category: string) => {
    setActiveCategory(category);
    setActiveSubcategory(SUBCATEGORIES_CONFIG[category][0]);
    setActiveTrickingLevel("Wszystkie poziomy");
  };

  const toggleExpand = (id: string) => {
    setExpandedCardIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleOpenEdit = (e: React.MouseEvent, ex: Exercise) => {
    e.stopPropagation();
    setEditingExerciseId(ex.id);
    setFormData({
      title: ex.title,
      category: ex.category,
      subcategory: ex.subcategory || SUBCATEGORIES_CONFIG[ex.category][1] || "",
      difficulty: ex.difficulty,
      short_description: ex.short_description || "",
      description: ex.description || "",
      videoUrl: ex.video_url || "",
      prerequisite_ids: ex.prerequisite_ids || [],
    });
    setIsModalOpen(true);
  };

  const handleDeleteExercise = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (!confirm(`Czy na pewno chcesz usunąć "${title}"?`)) return;

    const { error } = await supabase.from("exercises").delete().eq("id", id);
    if (!error) {
      setExercises((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const formatVideoOrAudioUrl = (url: string) => {
    if (!url) return "";
    // YouTube
    if (url.includes("youtube.com/watch?v=")) {
      const videoId = url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    // Spotify Embed Converter
    if (url.includes("open.spotify.com/playlist/")) {
      const playlistId = url.split("playlist/")[1]?.split("?")[0];
      return `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`;
    }
    return url;
  };

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    const payload = {
      title: formData.title,
      category: formData.category,
      subcategory: formData.subcategory,
      difficulty: formData.difficulty,
      short_description: formData.short_description,
      description: formData.description || formData.short_description,
      video_url: formatVideoOrAudioUrl(formData.videoUrl),
      prerequisite_ids: formData.prerequisite_ids,
    };

    if (editingExerciseId) {
      const { data, error } = await supabase
        .from("exercises")
        .update(payload)
        .eq("id", editingExerciseId)
        .select();

      if (!error && data) {
        setExercises((prev) =>
          prev.map((item) => (item.id === editingExerciseId ? { ...item, ...data[0] } : item))
        );
        setIsModalOpen(false);
        setEditingExerciseId(null);
      }
    } else {
      const { data, error } = await supabase.from("exercises").insert([payload]).select();
      if (!error && data) {
        setExercises((prev) => [data[0], ...prev]);
        setIsModalOpen(false);
      }
    }
  };

  // Zapisywanie nowego treningu
  const handleSaveWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutForm.title) return;

    const { data, error } = await supabase
      .from("workouts")
      .insert([workoutForm])
      .select();

    if (!error && data) {
      setWorkouts((prev) => [data[0], ...prev]);
      setIsWorkoutModalOpen(false);
      setWorkoutForm({
        title: "",
        description: "",
        level: "Średniozaawansowany",
        exercise_ids: [],
      });
      setActiveCategory("Własne treningi");
    } else if (error) {
      alert("Błąd: " + error.message);
    }
  };

  const toggleWorkoutExercise = (id: string) => {
    setWorkoutForm((prev) => {
      const exists = prev.exercise_ids.includes(id);
      return {
        ...prev,
        exercise_ids: exists
          ? prev.exercise_ids.filter((x) => x !== id)
          : [...prev.exercise_ids, id],
      };
    });
  };

  const filteredList = useMemo(() => {
    return exercises.filter((item) => {
      if (item.category !== activeCategory) return false;

      const matchesSearch =
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.short_description?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      const isAllSub =
        activeSubcategory.startsWith("Wszystkie podkategorie") ||
        activeSubcategory.startsWith("Wszystkie partie") ||
        activeSubcategory.startsWith("Wszystkie grupy") ||
        activeSubcategory.startsWith("Wszystkie zestawy") ||
        activeSubcategory.startsWith("Wszystkie playlisty");
      if (!isAllSub && item.subcategory && item.subcategory !== activeSubcategory) {
        return false;
      }

      if (activeCategory === "Tricking" && activeTrickingLevel !== "Wszystkie poziomy") {
        if (!item.difficulty?.toLowerCase().includes(activeTrickingLevel.split(":")[0].toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [exercises, activeCategory, activeSubcategory, activeTrickingLevel, searchTerm]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8">
      {/* Nagłówek */}
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-800/80 pb-6 select-none">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-emerald-400">
              ROAD TO GOAT
            </h1>
            {isCoach && (
              <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                Tryb Trenera
              </span>
            )}
          </div>
          <p className="text-neutral-400 text-sm mt-2 leading-relaxed">
            Szukasz pomysłu na jednostkę siłową, chcesz odblokować nowy trick, a może budujesz szczyt formy na zawody? Ta platforma da Ci narzędzia i strukturę, aby krok po kroku stać się GOAT-em.
          </p>
        </div>

        {/* Pasek akcji w nagłówku */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {/* Przycisk do Osi Czasu / Feedu Progresu */}
          <Link
            href="/timeline"
            className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-emerald-400 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:border-emerald-500/60 active:scale-95 cursor-pointer"
          >
            <span>🎬</span>
            <span>Timeline</span>
          </Link>

          {/* Kreator Treningu */}
          <button
            onClick={() => setIsWorkoutModalOpen(true)}
            className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:text-white active:scale-95 cursor-pointer"
          >
            <span>🏋️</span>
            <span>Stwórz Trening</span>
          </button>

          {/* Przełącznik Trenera */}
          <button
            onClick={handleToggleCoach}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
              isCoach
                ? "bg-neutral-800 text-emerald-400 border-emerald-500/50 hover:bg-neutral-700"
                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
            }`}
          >
            {isCoach ? "🔒 Trener" : "🔑 Trener"}
          </button>

          {/* Przycisk dodawania: ZAWSZE WIDOCZNY DLA KAŻDEGO */}
          <button
            onClick={() => {
              setEditingExerciseId(null);
              setFormData({
                title: "",
                category: activeCategory === "Własne treningi" ? "Tricking" : activeCategory,
                subcategory: SUBCATEGORIES_CONFIG[activeCategory === "Własne treningi" ? "Tricking" : activeCategory][1] || "",
                difficulty: activeCategory === "Tricking" ? "Lvl 1: Fundamenty" : STANDARD_DIFFICULTIES[0],
                short_description: "",
                description: "",
                videoUrl: "",
                prerequisite_ids: [],
              });
              setIsModalOpen(true);
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            + Dodaj pozycję
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Pasek kategorii głównych (w tym Własne treningi i Muzyka) */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none select-none border-b border-neutral-900 pb-4">
          {MAIN_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategorySwitch(cat)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                  : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
              }`}
            >
              {cat === "Muzyka" ? "🎵 Muzyka" : cat === "Własne treningi" ? "📋 Własne treningi" : cat}
            </button>
          ))}
        </div>

        {/* Wyszukiwarka */}
        <input
          type="text"
          placeholder={`Szukaj w ${activeCategory}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
        />

        {/* Podkategorie */}
        {activeCategory !== "Własne treningi" && (
          <div className="space-y-3 select-none">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mr-1">
                Podział:
              </span>
              {SUBCATEGORIES_CONFIG[activeCategory].map((sub) => (
                <button
                  key={sub}
                  onClick={() => setActiveSubcategory(sub)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    activeSubcategory === sub
                      ? "bg-neutral-200 text-neutral-950 font-bold"
                      : "bg-neutral-900/80 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>

            {/* Filtr poziomów dla Trickingu */}
            {activeCategory === "Tricking" && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mr-1">
                  Poziom:
                </span>
                {TRICKING_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setActiveTrickingLevel(lvl)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                      activeTrickingLevel === lvl
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                        : "bg-neutral-900/40 text-neutral-500 hover:text-neutral-300 border border-neutral-900"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WIDOK DLA ZAKŁADKI: WŁASNE TRENINGI */}
        {activeCategory === "Własne treningi" ? (
          workouts.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-sm border border-neutral-900 rounded-3xl">
              Brak skomponowanych treningów. Kliknij u góry <strong>„Stwórz Trening”</strong>, aby połączyć ćwiczenia w gotową jednostkę!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {workouts.map((wo) => {
                const includedExercises = exercises.filter((ex) =>
                  wo.exercise_ids?.includes(ex.id)
                );
                return (
                  <div
                    key={wo.id}
                    className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 space-y-4 hover:border-emerald-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                        {wo.level}
                      </span>
                      <span className="text-xs text-neutral-500 font-mono">
                        {wo.exercise_ids?.length || 0} ćwiczeń
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{wo.title}</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">{wo.description}</p>
                    </div>

                    {/* Lista ćwiczeń w treningu */}
                    <div className="space-y-2 border-t border-neutral-800/80 pt-3">
                      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                        Kolejność w jednostce:
                      </p>
                      <div className="space-y-1.5">
                        {includedExercises.map((ex, i) => (
                          <div
                            key={ex.id}
                            className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-xl text-xs border border-neutral-800/80"
                          >
                            <span className="text-neutral-300 font-medium">
                              {i + 1}. {ex.title}
                            </span>
                            <Link
                              href={`/exercise/${ex.id}`}
                              className="text-emerald-400 hover:text-emerald-300 text-[11px]"
                            >
                              Otwórz →
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* STANDARDOWA SIATKA ĆWICZEŃ I MUZYKI */
          loading ? (
            <div className="text-center py-16 text-neutral-500 text-sm animate-pulse">
              Ładowanie bazy danych...
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-sm border border-neutral-900 rounded-3xl">
              Brak elementów w tej kategorii.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 items-start">
              {filteredList.map((item) => {
                const isExpanded = !!expandedCardIds[item.id];
                const isSpotify = item.video_url?.includes("spotify.com");

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleExpand(item.id)}
                    className={`border rounded-2xl p-5 transition-all duration-300 select-none cursor-pointer flex flex-col justify-between ${
                      isExpanded
                        ? "bg-neutral-900/90 border-emerald-500/60 shadow-xl shadow-emerald-950/40"
                        : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-neutral-800 text-emerald-400 border border-neutral-700 truncate max-w-[180px]">
                          {item.subcategory || item.category}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-neutral-400 truncate">
                            {item.difficulty}
                          </span>
                          <span
                            className={`text-xs text-neutral-500 transition-transform duration-300 ${
                              isExpanded ? "rotate-180 text-emerald-400" : ""
                            }`}
                          >
                            ▼
                          </span>
                        </div>
                      </div>

                      <h3
                        className={`text-lg font-bold transition-colors ${
                          isExpanded ? "text-emerald-300" : "text-white"
                        }`}
                      >
                        {item.title}
                      </h3>
                    </div>

                    {/* Rozwijana sekcja */}
                    <div
                      className={`grid transition-all duration-300 ease-in-out ${
                        isExpanded
                          ? "grid-rows-[1fr] opacity-100 mt-3 pt-3 border-t border-neutral-800/80"
                          : "grid-rows-[0fr] opacity-0 mt-0 pt-0 border-transparent"
                      }`}
                    >
                      <div className="overflow-hidden space-y-4">
                        <p className="text-neutral-400 text-xs leading-relaxed">
                          {item.short_description || "Brak krótkiego opisu."}
                        </p>

                        {/* Player Spotify w kategorii Muzyka */}
                        {isSpotify && item.video_url && (
                          <div className="mt-2 rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <iframe
                              src={item.video_url}
                              width="100%"
                              height="152"
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              loading="lazy"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          {isCoach ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleOpenEdit(e, item)}
                                className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2.5 py-1.5 rounded-lg border border-neutral-700"
                              >
                                ✏️ Edytuj
                              </button>
                              <button
                                onClick={(e) => handleDeleteExercise(e, item.id, item.title)}
                                className="text-xs bg-red-950/40 hover:bg-red-900/60 text-red-400 px-2.5 py-1.5 rounded-lg border border-red-900/50"
                              >
                                🗑️
                              </button>
                            </div>
                          ) : (
                            <div />
                          )}

                          {!isSpotify && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Link
                                href={`/exercise/${item.id}`}
                                className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                              >
                                <span>Naucz się</span>
                                <span>→</span>
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Modal tworzenia WŁASNEGO TRENINGU */}
      {isWorkoutModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-2">🏋️ Skomponuj Własny Trening</h2>
            <p className="text-xs text-neutral-400 mb-4">
              Wybierz ćwiczenia z bazy, które stworzą Twoją jednostkę treningową.
            </p>

            <form onSubmit={handleSaveWorkout} className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Nazwa treningu *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Poniedziałkowy Tricking + Siła Skoku"
                  value={workoutForm.title}
                  onChange={(e) => setWorkoutForm({ ...workoutForm, title: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Poziom intensywności</label>
                <select
                  value={workoutForm.level}
                  onChange={(e) => setWorkoutForm({ ...workoutForm, level: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="Wdrożenie / Lekki">Wdrożenie / Lekki</option>
                  <option value="Średniozaawansowany">Średniozaawansowany</option>
                  <option value="Wysoka intensywność / PRO">Wysoka intensywność / PRO</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Krótki opis / Plan sesji</label>
                <textarea
                  rows={2}
                  placeholder="np. Rozgrzewka, 4 serie aktywacji, część główna tricking, schłodzenie."
                  value={workoutForm.description}
                  onChange={(e) => setWorkoutForm({ ...workoutForm, description: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Lista ćwiczeń do wyboru w treningu */}
              <div>
                <label className="text-xs text-emerald-400 font-medium block mb-2">
                  Wybierz ćwiczenia ({workoutForm.exercise_ids.length} wybranych):
                </label>
                <div className="max-h-52 overflow-y-auto space-y-1.5 p-2 bg-neutral-950 border border-neutral-800 rounded-xl">
                  {exercises.map((ex) => {
                    const isSelected = workoutForm.exercise_ids.includes(ex.id);
                    return (
                      <div
                        key={ex.id}
                        onClick={() => toggleWorkoutExercise(ex.id)}
                        className={`p-2.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "hover:bg-neutral-900 text-neutral-300 border border-transparent"
                        }`}
                      >
                        <span className="font-medium">{ex.title}</span>
                        <span className="text-[10px] text-neutral-500">{ex.category}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWorkoutModalOpen(false)}
                  className="px-4 py-2 text-sm text-neutral-400 hover:text-white"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-5 py-2 rounded-xl text-sm transition-all"
                >
                  Zapisz Trening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal dodawania pozycji */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingExerciseId ? "✏️ Edytuj pozycję" : "+ Dodaj nowy element"}
            </h2>

            <form onSubmit={handleSaveExercise} className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  Nazwa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Corkscrew, Playlista Bass Boost, Pierś z indyka"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Kategoria główna</label>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      setFormData({
                        ...formData,
                        category: newCat,
                        subcategory: SUBCATEGORIES_CONFIG[newCat][1] || "",
                        difficulty: newCat === "Tricking" ? "Lvl 1: Fundamenty" : STANDARD_DIFFICULTIES[0],
                      });
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {MAIN_CATEGORIES.filter((c) => c !== "Własne treningi").map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Podkategoria</label>
                  <select
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {SUBCATEGORIES_CONFIG[formData.category]
                      ?.filter((s) => !s.startsWith("Wszystkie"))
                      .map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Poziom / Zaawansowanie</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                >
                  {(formData.category === "Tricking"
                    ? TRICKING_LEVELS.filter((l) => !l.startsWith("Wszystkie"))
                    : STANDARD_DIFFICULTIES
                  ).map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-emerald-400 block mb-1 font-medium">
                  Krótki opis (widoczny na kafelku) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Krótki opis lub zajawka..."
                  value={formData.short_description}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  Link wideo (YouTube) lub link Spotify
                </label>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/... lub https://open.spotify.com/playlist/..."
                  value={formData.videoUrl}
                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
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
                  {editingExerciseId ? "Zapisz zmiany" : "Dodaj"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}