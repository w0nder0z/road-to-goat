"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  sources?: string[];
  prerequisite_ids?: string[];
}

interface Workout {
  id: string;
  title: string;
  description: string;
  level: string;
  exercise_ids: string[];
  author_username?: string;
  created_at: string;
}

interface Competition {
  id: string;
  name: string;
  date: string;
  location?: string;
  phase?: string;
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

const TEAM_PASSWORD = "Kawashi2026";
const COACH_PIN = "1234";

const HERO_IMAGES = [
  "/hero/hero1.jpg",
  "/hero/hero2.jpg",
  "/hero/hero3.jpg",
  "/hero/hero4.jpg",
  "/hero/hero5.jpg",
  "/hero/hero6.jpg",
];

// Automatyczny kalkulator fazy przygotowań do zawodów
function calculateCompetitionPhase(dateStr: string): string {
  if (!dateStr) return "Planowanie";
  const now = new Date();
  const compDate = new Date(dateStr);
  const diffDays = Math.ceil((compDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Po zawodach (Regeneracja)";
  if (diffDays <= 7) return "Tapering / Szczyt świeżości";
  if (diffDays <= 21) return "Szlifowanie & Czystość lądowań";
  if (diffDays <= 42) return "Budowa formy pod muzykę (Kombinacje)";
  return "Nauka nowych elementów (Baza & Siła)";
}

export default function Home() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Tricking");
  const [activeSubcategory, setActiveSubcategory] = useState("Wszystkie podkategorie");
  const [activeTrickingLevel, setActiveTrickingLevel] = useState("Wszystkie poziomy");
  const [searchTerm, setSearchTerm] = useState("");

  const [currentHeroIdx, setCurrentHeroIdx] = useState(0);
  const [hasNewTimelinePosts, setHasNewTimelinePosts] = useState(false);

  const [currentUser, setCurrentUser] = useState<{ username: string; role: "athlete" | "coach" } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authIsCoach, setAuthIsCoach] = useState(false);

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isCompModalOpen, setIsCompModalOpen] = useState(false);
  const [compForm, setCompForm] = useState({
    name: "",
    date: "",
    location: "",
  });

  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);

  // KREATOR TRENINGU
  const [workoutForm, setWorkoutForm] = useState({
    title: "",
    description: "",
    level: "Średniozaawansowany",
    warmup_ids: [] as string[],
    strength_ids: [] as string[],
    skill_ids: [] as string[],
    cooldown_ids: [] as string[],
  });

  // TRYB SALI / SESJA TRENINGOWA
  const [activeSessionWorkout, setActiveSessionWorkout] = useState<Workout | null>(null);
  const [sessionCompletedIds, setSessionCompletedIds] = useState<string[]>([]);
  const [sessionElapsedTime, setSessionElapsedTime] = useState(0);
  const [restTimerSeconds, setRestTimerSeconds] = useState<number | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    category: "Tricking",
    subcategory: "Vertical Kicks (Pop, Cheat, Swing)",
    difficulty: "Lvl 1: Fundamenty",
    short_description: "",
    description: "",
    sources: [""] as string[],
    prerequisite_ids: [] as string[],
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroIdx((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const checkTimelineUnread = async (userLoggedIn: boolean) => {
    if (!userLoggedIn) {
      setHasNewTimelinePosts(false);
      return;
    }

    const { data: latestPost } = await supabase
      .from("progress_submissions")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestPost && latestPost.length > 0) {
      const latestPostTime = new Date(latestPost[0].created_at).getTime();
      const lastReadTimeStr = localStorage.getItem("timeline_last_read");
      const lastReadTime = lastReadTimeStr ? parseInt(lastReadTimeStr, 10) : 0;
      setHasNewTimelinePosts(latestPostTime > lastReadTime);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: exData } = await supabase
      .from("exercises")
      .select("id, title, category, subcategory, difficulty, short_description, description, video_url, sources, prerequisite_ids")
      .order("created_at", { ascending: false });

    if (exData) setExercises(exData);

    const { data: woData } = await supabase
      .from("workouts")
      .select("*")
      .order("created_at", { ascending: false });

    if (woData) setWorkouts(woData);

    const { data: compData } = await supabase
      .from("competitions")
      .select("*")
      .order("date", { ascending: true });

    if (compData) setCompetitions(compData);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const savedUserStr = localStorage.getItem("goat_athlete_profile");
    if (savedUserStr) {
      try {
        const parsed = JSON.parse(savedUserStr);
        setCurrentUser(parsed);
        checkTimelineUnread(true);
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

  // Obsługa stopera głównego sesji treningowej
  useEffect(() => {
    if (activeSessionWorkout) {
      sessionTimerRef.current = setInterval(() => {
        setSessionElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      setSessionElapsedTime(0);
      setSessionCompletedIds([]);
      setRestTimerSeconds(null);
    }
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [activeSessionWorkout]);

  // Obsługa timera przerw
  useEffect(() => {
    if (restTimerSeconds !== null && restTimerSeconds > 0) {
      restTimerRef.current = setInterval(() => {
        setRestTimerSeconds((prev) => {
          if (prev === null || prev <= 1) {
            playBeep();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (restTimerSeconds === 0) {
      playBeep();
      setRestTimerSeconds(null);
    }
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, [restTimerSeconds]);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {
      // Dźwięk pomijany jeśli Web Audio nie jest wspierany
    }
  };

  const handleStartRest = (seconds: number) => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    setRestTimerSeconds(seconds);
  };

  const toggleSessionExerciseCheck = (id: string) => {
    setSessionCompletedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const formatTimerDigits = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = authUsername.trim();

    if (!cleanNick) {
      alert("Wpisz swój nick!");
      return;
    }

    if (authIsCoach) {
      if (authPassword !== COACH_PIN) {
        alert("Błędny PIN Trenera!");
        return;
      }
    } else {
      if (authPassword !== TEAM_PASSWORD) {
        alert("Błędne hasło drużyny!");
        return;
      }
    }

    const assignedRole: "athlete" | "coach" = authIsCoach ? "coach" : "athlete";

    if (authMode === "register") {
      const { error } = await supabase
        .from("athlete_profiles")
        .insert([{ username: cleanNick, role: assignedRole }]);

      if (error) {
        if (error.code === "23505") {
          alert("Ten nick jest już zajęty! Kliknij 'Zaloguj się'.");
        } else {
          alert("Błąd rejestracji: " + error.message);
        }
        return;
      }

      const userObj = { username: cleanNick, role: assignedRole };
      setCurrentUser(userObj);
      localStorage.setItem("goat_athlete_profile", JSON.stringify(userObj));
      setIsAuthModalOpen(false);
      setAuthUsername("");
      setAuthPassword("");
      checkTimelineUnread(true);
    } else {
      const { data, error } = await supabase
        .from("athlete_profiles")
        .select("*")
        .eq("username", cleanNick)
        .single();

      if (error || !data) {
        alert("Nie znaleziono takiego konta. Kliknij 'Stwórz nowe konto' poniżej.");
        return;
      }

      const userObj = { username: data.username, role: assignedRole };
      setCurrentUser(userObj);
      localStorage.setItem("goat_athlete_profile", JSON.stringify(userObj));
      setIsAuthModalOpen(false);
      setAuthUsername("");
      setAuthPassword("");
      checkTimelineUnread(true);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("goat_athlete_profile");
    setHasNewTimelinePosts(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatUrl = (url: string) => {
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
    if (url.includes("open.spotify.com/playlist/")) {
      const playlistId = url.split("playlist/")[1]?.split("?")[0];
      return `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`;
    }
    return url;
  };

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    const formattedSources = formData.sources
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(formatUrl);

    const payload = {
      title: formData.title,
      category: formData.category,
      subcategory: formData.subcategory,
      difficulty: formData.category === "Muzyka" ? "Playlista" : formData.difficulty,
      short_description: formData.short_description,
      description: formData.category === "Muzyka" ? "" : (formData.description || formData.short_description),
      sources: formattedSources,
      video_url: formattedSources[0] || "",
      prerequisite_ids: formData.category === "Muzyka" ? [] : formData.prerequisite_ids,
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

  const handleSaveStructuredWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutForm.title || !currentUser) return;

    const combinedIds = [
      ...workoutForm.warmup_ids,
      ...workoutForm.strength_ids,
      ...workoutForm.skill_ids,
      ...workoutForm.cooldown_ids,
    ];

    const payload = {
      title: workoutForm.title,
      description: workoutForm.description,
      level: workoutForm.level,
      exercise_ids: combinedIds,
      author_username: currentUser.username,
    };

    const { data, error } = await supabase.from("workouts").insert([payload]).select();

    if (!error && data) {
      const newWorkout = data[0];
      setWorkouts((prev) => [newWorkout, ...prev]);
      setIsWorkoutModalOpen(false);
      setWorkoutForm({
        title: "",
        description: "",
        level: "Średniozaawansowany",
        warmup_ids: [],
        strength_ids: [],
        skill_ids: [],
        cooldown_ids: [],
      });
      setActiveCategory("Własne treningi");

      if (confirm(`Trening "${newWorkout.title}" zapisany! Czy chcesz go teraz odpalić na sali?`)) {
        setActiveSessionWorkout(newWorkout);
      }
    } else if (error) {
      alert("Błąd: " + error.message);
    }
  };

  const handleDeleteWorkout = async (id: string, title: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć trening "${title}"?`)) return;
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (!error) {
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
    }
  };

  const toggleSelectExercise = (
    listKey: "warmup_ids" | "strength_ids" | "skill_ids" | "cooldown_ids",
    id: string
  ) => {
    setWorkoutForm((prev) => {
      const exists = prev[listKey].includes(id);
      return {
        ...prev,
        [listKey]: exists
          ? prev[listKey].filter((x) => x !== id)
          : [...prev[listKey], id],
      };
    });
  };

  const handleSaveCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compForm.name || !compForm.date) return;

    const { data, error } = await supabase.from("competitions").insert([compForm]).select();
    if (!error && data) {
      setCompetitions((prev) =>
        [...prev, data[0]].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      );
      setIsCompModalOpen(false);
      setCompForm({ name: "", date: "", location: "" });
    }
  };

  const nextCompetition = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return competitions.find((c) => c.date >= today) || competitions[0];
  }, [competitions]);

  const daysToComp = useMemo(() => {
    if (!nextCompetition) return null;
    const diff = new Date(nextCompetition.date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [nextCompetition]);

  const calculatedPhase = useMemo(() => {
    return nextCompetition ? calculateCompetitionPhase(nextCompetition.date) : "";
  }, [nextCompetition]);

  const visibleWorkouts = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "coach") return workouts;
    return workouts.filter((w) => w.author_username === currentUser.username);
  }, [workouts, currentUser]);

  const filteredList = useMemo(() => {
    return exercises.filter((item) => {
      if (item.category !== activeCategory) return false;

      const matchesSearch =
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.short_description?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      const isAllSub = activeSubcategory.startsWith("Wszystkie");
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
    <main className="min-h-screen bg-neutral-950 text-neutral-100 pb-16">
      {/* SEKCJA HERO BANNER */}
      <section className="relative w-full border-b border-neutral-800/80 bg-neutral-950 overflow-hidden select-none">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {HERO_IMAGES.map((src, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                idx === currentHeroIdx ? "opacity-75" : "opacity-0"
              }`}
            >
              <img
                src={src}
                alt="Acrobatics hero"
                className="w-full h-full object-cover object-center"
              />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-neutral-950/30" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 md:px-8 pt-6 pb-10 flex flex-col justify-between min-h-[480px] md:min-h-[540px]">
          {/* TOP BAR */}
          <div className="flex items-start justify-between gap-4 w-full">
            {!currentUser ? (
              <div className="max-w-md bg-neutral-950/70 p-4 rounded-2xl backdrop-blur-md border border-neutral-800/80 shadow-2xl">
                <div className="inline-block border border-neutral-700/80 bg-neutral-900/90 rounded-xl px-4 py-2 shadow-lg mb-2.5">
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-emerald-400 uppercase">
                    ROAD TO GOAT
                  </h1>
                </div>
                <p className="text-neutral-300 text-xs leading-relaxed">
                  Szukasz pomysłu na jednostkę siłową, chcesz odblokować nowy trick, a może budujesz szczyt formy na zawody? Ta platforma da Ci narzędzia i strukturę, aby krok po kroku stać się GOAT-em.
                </p>
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3 ml-auto">
              <Link
                href="/timeline"
                className={`relative flex items-center gap-2.5 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/80 hover:border-emerald-500/60 rounded-2xl shadow-xl transition-all active:scale-95 ${
                  currentUser ? "px-5 py-2.5 text-sm font-bold" : "px-3.5 py-1.5 text-xs font-medium"
                }`}
              >
                <span className={currentUser ? "text-lg" : "text-sm"}>🎬</span>
                <span>Timeline</span>
                {currentUser && hasNewTimelinePosts && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                )}
              </Link>

              {!currentUser ? (
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setIsAuthModalOpen(true);
                  }}
                  className="bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-xs px-4 py-2 rounded-xl text-neutral-300 hover:text-white transition-all cursor-pointer"
                >
                  👤 Zaloguj / Rejestracja
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-700/80 p-1.5 rounded-2xl shadow-xl">
                  <span className="text-sm text-emerald-400 font-bold px-3 py-1 bg-neutral-950/80 border border-neutral-800 rounded-xl">
                    👤 {currentUser.username} {currentUser.role === "coach" && "(Admin)"}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="bg-neutral-900 hover:bg-red-950/60 border border-neutral-800 hover:border-red-800 text-xs px-3 py-1.5 rounded-xl text-neutral-400 hover:text-red-300 transition-all cursor-pointer font-medium"
                  >
                    Wyloguj
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* DLA ZALOGOWANEGO: TYTUŁ + AUTOMATYCZNY KALENDARZ */}
          {currentUser && (
            <div className="my-auto py-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
              <div className="lg:col-span-2">
                <div className="inline-block bg-neutral-900/80 backdrop-blur-md border border-neutral-700/80 rounded-2xl px-5 py-3 shadow-xl mb-3">
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight text-emerald-400 uppercase">
                    ROAD TO GOAT
                  </h1>
                </div>
                <p className="text-neutral-200 text-xs md:text-sm max-w-xl leading-relaxed drop-shadow bg-neutral-950/50 p-3.5 rounded-xl backdrop-blur-sm border border-neutral-800/40">
                  Szukasz pomysłu na jednostkę siłową, chcesz odblokować nowy trick, a może budujesz szczyt formy na zawody? Ta platforma da Ci narzędzia i strukturę, aby krok po kroku stać się GOAT-em.
                </p>
              </div>

              {/* CEL STARTOWY Z AUTOMATYCZNĄ FAZĄ */}
              <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2 mb-2.5">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🏆</span> Cel Startowy (System)
                  </span>
                  {currentUser.role === "coach" && (
                    <button
                      onClick={() => setIsCompModalOpen(true)}
                      className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                    >
                      + Zaplanuj
                    </button>
                  )}
                </div>

                {nextCompetition ? (
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-bold text-white text-sm truncate max-w-[170px]">
                        {nextCompetition.name}
                      </h3>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {daysToComp !== null ? `${daysToComp} dni` : ""}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="text-neutral-400 flex justify-between">
                        <span>Data: {nextCompetition.date}</span>
                        {nextCompetition.location && <span>{nextCompetition.location}</span>}
                      </div>
                      <div className="pt-1">
                        <span className="text-emerald-300 font-semibold bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-md inline-block">
                          ⚡ {calculatedPhase}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500 py-1">
                    Brak zaplanowanych zawodów.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PRZYCISKI AKCJI */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {currentUser ? (
              <div className="flex flex-wrap items-center gap-2.5">
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
                      sources: [""],
                      prerequisite_ids: [],
                    });
                    setIsModalOpen(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  + Dodaj pozycję
                </button>

                <button
                  onClick={() => setIsWorkoutModalOpen(true)}
                  className="bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                >
                  🏋️ Stwórz Trening
                </button>

                <button
                  onClick={() => setIsCompModalOpen(true)}
                  className="bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                >
                  🏆 Plan na zawody
                </button>
              </div>
            ) : (
              <div />
            )}

            <div className="hidden sm:flex items-center gap-1.5 opacity-60">
              {HERO_IMAGES.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === currentHeroIdx ? "w-5 bg-emerald-400" : "w-1.5 bg-neutral-600"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* GŁÓWNA NAWIGACJA KATEGORII */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 mt-8 space-y-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none select-none border-b border-neutral-900 pb-3">
          {MAIN_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setActiveSubcategory(SUBCATEGORIES_CONFIG[cat][0]);
                setActiveTrickingLevel("Wszystkie poziomy");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                  : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
              }`}
            >
              {cat === "Muzyka" ? "🎵 Muzyka" : cat === "Własne treningi" ? "📋 Własne treningi" : cat}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Szukaj tricku, ćwiczenia, elementu..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
        />

        {activeCategory !== "Własne treningi" && (
          <div className="space-y-3 select-none">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
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

            {activeCategory === "Tricking" && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
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

        {/* WIDOK: WŁASNE TRENINGI */}
        {activeCategory === "Własne treningi" ? (
          !currentUser ? (
            <div className="text-center py-16 text-neutral-500 text-sm border border-neutral-900 rounded-3xl">
              Zaloguj się, aby tworzyć i realizować plany treningowe.
            </div>
          ) : visibleWorkouts.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-sm border border-neutral-900 rounded-3xl">
              Nie masz jeszcze zapisanych treningów. Kliknij u góry <strong>„Stwórz Trening”</strong>!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {visibleWorkouts.map((wo) => {
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500 font-mono">
                          {wo.exercise_ids?.length || 0} ćwiczeń
                        </span>
                        <button
                          onClick={() => handleDeleteWorkout(wo.id, wo.title)}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 bg-red-950/40 border border-red-900/50 rounded-md cursor-pointer"
                          title="Usuń trening"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{wo.title}</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">{wo.description}</p>
                    </div>

                    {/* PRZYCISK ODPALENIA SESJI NA SALI */}
                    <button
                      onClick={() => setActiveSessionWorkout(wo)}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>▶ Rozpocznij Trening na Sali</span>
                    </button>

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
                              {i + 1}. {ex.title} ({ex.category})
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
          /* STANDARDOWA SIATKA ĆWICZEŃ */
          loading ? (
            <div className="text-center py-16 text-neutral-500 text-sm animate-pulse">
              Ładowanie bazy...
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-sm border border-neutral-900 rounded-3xl">
              Brak elementów w tej kategorii.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 items-start">
              {filteredList.map((item) => {
                const isExpanded = !!expandedCardIds[item.id];
                const primaryMedia = (item.sources && item.sources[0]) || item.video_url || "";
                const isSpotify = primaryMedia.includes("spotify.com");

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

                    <div
                      className={`grid transition-all duration-300 ease-in-out ${
                        isExpanded
                          ? "grid-rows-[1fr] opacity-100 mt-3 pt-3 border-t border-neutral-800/80"
                          : "grid-rows-[0fr] opacity-0 mt-0 pt-0 border-transparent"
                      }`}
                    >
                      <div className="overflow-hidden space-y-4">
                        <p className="text-neutral-400 text-xs leading-relaxed">
                          {item.short_description || "Brak opisu."}
                        </p>

                        {isSpotify && primaryMedia && (
                          <div className="mt-2 rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <iframe
                              src={primaryMedia}
                              width="100%"
                              height="152"
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              loading="lazy"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          {currentUser?.role === "coach" ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingExerciseId(item.id);
                                  const exSources = item.sources && item.sources.length > 0 ? item.sources : (item.video_url ? [item.video_url] : [""]);
                                  setFormData({
                                    title: item.title,
                                    category: item.category,
                                    subcategory: item.subcategory || SUBCATEGORIES_CONFIG[item.category][1] || "",
                                    difficulty: item.difficulty,
                                    short_description: item.short_description || "",
                                    description: item.description || "",
                                    sources: exSources,
                                    prerequisite_ids: item.prerequisite_ids || [],
                                  });
                                  setIsModalOpen(true);
                                }}
                                className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2.5 py-1.5 rounded-lg border border-neutral-700"
                              >
                                ✏️ Edytuj
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!confirm(`Usunąć ${item.title}?`)) return;
                                  const { error } = await supabase.from("exercises").delete().eq("id", item.id);
                                  if (!error) setExercises((p) => p.filter((x) => x.id !== item.id));
                                }}
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

      {/* PEŁNOEKRANOWY TRYB SALI / SESJA TRENINGOWA */}
      {activeSessionWorkout && (
        <div className="fixed inset-0 bg-neutral-950/95 backdrop-blur-md z-50 p-4 md:p-8 flex flex-col justify-between overflow-y-auto">
          <div className="max-w-3xl w-full mx-auto space-y-6">
            {/* Top Bar sesji */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                  Tryb Sali (W Toku)
                </span>
                <h2 className="text-2xl font-black text-white mt-1">{activeSessionWorkout.title}</h2>
              </div>
              <button
                onClick={() => {
                  if (confirm("Zakończyć jednostkę treningową?")) {
                    setActiveSessionWorkout(null);
                  }
                }}
                className="bg-neutral-900 hover:bg-red-950/60 border border-neutral-800 hover:border-red-800 text-neutral-300 hover:text-red-300 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Zakończ Trening ✕
              </button>
            </div>

            {/* Pasek stopera i odpoczynku */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-900/80 border border-neutral-800 p-5 rounded-2xl">
              <div>
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                  ⏱️ Czas trwania treningu:
                </span>
                <span className="text-3xl font-black font-mono text-emerald-400">
                  {formatTimerDigits(sessionElapsedTime)}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                  ⏳ Timer odpoczynku:
                </span>
                {restTimerSeconds !== null ? (
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black font-mono text-amber-400 animate-pulse">
                      {formatTimerDigits(restTimerSeconds)}
                    </span>
                    <button
                      onClick={() => setRestTimerSeconds(null)}
                      className="text-xs text-neutral-500 hover:text-white underline cursor-pointer"
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    {[30, 60, 90, 120].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => handleStartRest(sec)}
                        className="bg-neutral-950 hover:bg-emerald-500 hover:text-black border border-neutral-800 text-neutral-300 text-xs px-2.5 py-1 rounded-lg transition-colors font-mono cursor-pointer"
                      >
                        +{sec}s
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pasek postępu */}
            <div>
              <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <span>Postęp jednostki</span>
                <span>
                  {sessionCompletedIds.length} / {activeSessionWorkout.exercise_ids.length} wykonanych
                </span>
              </div>
              <div className="w-full bg-neutral-900 h-2.5 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{
                    width: `${
                      activeSessionWorkout.exercise_ids.length > 0
                        ? (sessionCompletedIds.length / activeSessionWorkout.exercise_ids.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Lista ćwiczeń do odhaczania */}
            <div className="space-y-3">
              {activeSessionWorkout.exercise_ids.map((exId, idx) => {
                const ex = exercises.find((e) => e.id === exId);
                if (!ex) return null;
                const isChecked = sessionCompletedIds.includes(ex.id);

                return (
                  <div
                    key={ex.id}
                    onClick={() => toggleSessionExerciseCheck(ex.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? "bg-emerald-950/20 border-emerald-500/40 text-neutral-300"
                        : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-bold ${
                          isChecked
                            ? "bg-emerald-500 border-emerald-500 text-black"
                            : "border-neutral-700 bg-neutral-950 text-transparent"
                        }`}
                      >
                        ✓
                      </div>
                      <div>
                        <h4 className={`text-base font-bold ${isChecked ? "line-through text-neutral-500" : "text-white"}`}>
                          {idx + 1}. {ex.title}
                        </h4>
                        <span className="text-xs text-neutral-500">{ex.subcategory || ex.category}</span>
                      </div>
                    </div>

                    <Link
                      href={`/exercise/${ex.id}`}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-emerald-400 hover:underline px-3 py-1 bg-neutral-950 rounded-lg border border-neutral-800"
                    >
                      Metodyka ↗
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* KREATOR TRENINGU */}
      {isWorkoutModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-1">🏋️ Stwórz Własny Trening</h2>
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              Skomponuj jednostkę widoczną wyłącznie na Twoim koncie. Po zapisaniu możesz ją od razu odpalić w Trybie Sali.
            </p>

            <form onSubmit={handleSaveStructuredWorkout} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Nazwa jednostki *</label>
                  <input
                    type="text"
                    required
                    placeholder="np. Przygotowanie bioder + Tricking"
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
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Krótki opis jednostki</label>
                <textarea
                  rows={2}
                  placeholder="np. Skupienie na amortyzacji i dynamice wybicia..."
                  value={workoutForm.description}
                  onChange={(e) => setWorkoutForm({ ...workoutForm, description: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* BLOK 1 */}
              <div className="border border-neutral-800 bg-neutral-950/60 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🔥</span> Krok 1: Rozgrzewka & Mobilność
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Wybrano: {workoutForm.warmup_ids.length}
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {exercises
                    .filter((e) => e.category === "Rozciąganie" || e.subcategory?.includes("Mobilność"))
                    .map((ex) => {
                      const isSel = workoutForm.warmup_ids.includes(ex.id);
                      return (
                        <div
                          key={ex.id}
                          onClick={() => toggleSelectExercise("warmup_ids", ex.id)}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSel
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "hover:bg-neutral-900 text-neutral-400"
                          }`}
                        >
                          <span>{ex.title}</span>
                          <span className="text-[10px] text-neutral-500">{ex.subcategory}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* BLOK 2 */}
              <div className="border border-neutral-800 bg-neutral-950/60 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚡</span> Krok 2: Wzmocnienie (Siła / Plyometria)
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Wybrano: {workoutForm.strength_ids.length}
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {exercises
                    .filter((e) => e.category === "Siła" || e.category === "Plyometria")
                    .map((ex) => {
                      const isSel = workoutForm.strength_ids.includes(ex.id);
                      return (
                        <div
                          key={ex.id}
                          onClick={() => toggleSelectExercise("strength_ids", ex.id)}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSel
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                              : "hover:bg-neutral-900 text-neutral-400"
                          }`}
                        >
                          <span>{ex.title}</span>
                          <span className="text-[10px] text-neutral-500">{ex.subcategory}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* BLOK 3 */}
              <div className="border border-neutral-800 bg-neutral-950/60 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🎯</span> Krok 3: Część Główna (Tricking)
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Wybrano: {workoutForm.skill_ids.length}
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {exercises
                    .filter((e) => e.category === "Tricking")
                    .map((ex) => {
                      const isSel = workoutForm.skill_ids.includes(ex.id);
                      return (
                        <div
                          key={ex.id}
                          onClick={() => toggleSelectExercise("skill_ids", ex.id)}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSel
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "hover:bg-neutral-900 text-neutral-400"
                          }`}
                        >
                          <span>{ex.title}</span>
                          <span className="text-[10px] text-neutral-500">{ex.difficulty}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* BLOK 4 */}
              <div className="border border-neutral-800 bg-neutral-950/60 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🧘</span> Krok 4: Cool-down & Rozciąganie
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Wybrano: {workoutForm.cooldown_ids.length}
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {exercises
                    .filter((e) => e.category === "Rozciąganie")
                    .map((ex) => {
                      const isSel = workoutForm.cooldown_ids.includes(ex.id);
                      return (
                        <div
                          key={ex.id}
                          onClick={() => toggleSelectExercise("cooldown_ids", ex.id)}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSel
                              ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                              : "hover:bg-neutral-900 text-neutral-400"
                          }`}
                        >
                          <span>{ex.title}</span>
                          <span className="text-[10px] text-neutral-500">{ex.subcategory}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWorkoutModalOpen(false)}
                  className="px-4 py-2 text-sm text-neutral-400 hover:text-white cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2 rounded-xl text-sm transition-all cursor-pointer"
                >
                  Zapisz Mój Trening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PLANOWANIA ZAWODÓW (BEZ RĘCZNEGO WYBIERANIA FAZY) */}
      {isCompModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">🏆 Zaplanuj Zawody</h2>
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              Wystarczy podać nazwę i datę startu. System automatycznie dopasuje fazę periodyzacji w zależności od liczby tygodni do imprezy.
            </p>

            <form onSubmit={handleSaveCompetition} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Nazwa turnieju *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Mistrzostwa Polski Form Muzycznych"
                  value={compForm.name}
                  onChange={(e) => setCompForm({ ...compForm, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Data startu *</label>
                  <input
                    type="date"
                    required
                    value={compForm.date}
                    onChange={(e) => setCompForm({ ...compForm, date: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Lokalizacja</label>
                  <input
                    type="text"
                    placeholder="np. Warszawa"
                    value={compForm.location}
                    onChange={(e) => setCompForm({ ...compForm, location: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCompModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Zapisz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LOGOWANIA */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">
              {authMode === "login" ? "🔐 Zaloguj się" : "📝 Załóż konto zawodnika"}
            </h2>
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              Wystarczy unikalny nick oraz hasło drużyny (lub PIN trenera).
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Twój Nick / Imię *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Piotrek, Tricker99"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  {authIsCoach ? "PIN Trenera (Admin) *" : "Hasło Drużyny *"}
                </label>
                <input
                  type="password"
                  required
                  placeholder={authIsCoach ? "PIN..." : "Hasło..."}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="authCoach"
                  checked={authIsCoach}
                  onChange={(e) => setAuthIsCoach(e.target.checked)}
                  className="rounded border-neutral-800 bg-neutral-950 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="authCoach" className="text-xs text-neutral-300 cursor-pointer select-none">
                  Konto Trenera / Admina
                </label>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                  className="text-xs text-emerald-400 hover:underline cursor-pointer"
                >
                  {authMode === "login" ? "Nie masz konta? Stwórz" : "Masz konto? Zaloguj"}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white cursor-pointer"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    {authMode === "login" ? "Wejdź" : "Załóż"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DODAWANIA POZYCJI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingExerciseId
                ? "✏️ Edytuj pozycję"
                : formData.category === "Muzyka"
                ? "🎵 Dodaj Playlistę Muzyczną"
                : "+ Dodaj nowy element"}
            </h2>

            <form onSubmit={handleSaveExercise} className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  {formData.category === "Muzyka" ? "Nazwa Playlisty *" : "Nazwa *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={formData.category === "Muzyka" ? "np. Battle Hype Beats 2026" : "np. Corkscrew, B-twist"}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Kategoria</label>
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
                  <label className="text-xs text-neutral-400 block mb-1">
                    {formData.category === "Muzyka" ? "Gatunek muzyki" : "Podkategoria"}
                  </label>
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

              {formData.category !== "Muzyka" && (
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Poziom</label>
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
              )}

              <div>
                <label className="text-xs text-emerald-400 block mb-1 font-medium">
                  {formData.category === "Muzyka" ? "Krótki opis / Klimat playlisty *" : "Krótki opis *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={formData.category === "Muzyka" ? "np. Szybki beat, idealny pod walki" : "Krótki opis..."}
                  value={formData.short_description}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {formData.category !== "Muzyka" && (
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Wskazówki metodyczne</label>
                  <textarea
                    rows={2}
                    placeholder="Technika, błędy..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-emerald-400 font-medium">
                    {formData.category === "Muzyka"
                      ? "🔗 Link do Playlisty (Spotify lub YouTube)"
                      : "🔗 Źródła wideo (YouTube, Shorts, Dysk Google)"}
                  </label>
                  {formData.category !== "Muzyka" && (
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, sources: [...p.sources, ""] }))}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                    >
                      + Dodaj kolejne wideo
                    </button>
                  )}
                </div>

                {formData.sources.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={formData.category === "Muzyka" ? "https://open.spotify.com/playlist/..." : `Link wideo #${idx + 1}`}
                      value={s}
                      onChange={(e) => {
                        const newS = [...formData.sources];
                        newS[idx] = e.target.value;
                        setFormData({ ...formData, sources: newS });
                      }}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    />
                    {formData.sources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, sources: p.sources.filter((_, i) => i !== idx) }))}
                        className="text-neutral-500 hover:text-red-400 text-sm px-2 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
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