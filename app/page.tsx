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
  original_author?: string;
  created_at: string;
}

interface Competition {
  id: string;
  name: string;
  date: string;
  location?: string;
}

const EXERCISE_CATEGORIES = ["Tricking", "Plyometria", "Siła", "Rozciąganie"];

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
  Muzyka: [
    "Wszystkie playlisty",
    "Tricking Battles / Bass",
    "Drill / Hype Hip-Hop",
    "Phonk / Hardstyle",
    "Rozgrzewka / Flow",
    "Stretching / Chillout",
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

const TOUR_STEPS = [
  {
    targetId: "tour-header",
    title: "Centrum Dowodzenia ROAD TO GOAT 🥋",
    desc: "Witaj na platformie! Przeprowadzimy Cię bezpośrednio przez kluczowe elementy interfejsu.",
    position: "bottom" as const,
  },
  {
    targetId: "tour-exercise-base",
    title: "Baza Ćwiczeń & Drzewko Skill Tree 📚",
    desc: "Tutaj rozwijasz fundamenty trickingu, siły, plyo i rozciągania. Oznaczaj elementy, które już umiesz, a system ułoży pod Ciebie progresję.",
    position: "bottom" as const,
  },
  {
    targetId: "tour-workouts-btn",
    title: "Kreator Treningów & Tryb Sali 🏋️",
    desc: "W tym miejscu tworzysz własne jednostki lub importujesz plany od znajomych z ekipy. Na macie odpalasz Tryb Sali ze stoperem.",
    position: "bottom" as const,
  },
  {
    targetId: "tour-competition-widget",
    title: "Automatyczny Plan na Zawody 🏆",
    desc: "System sam wylicza fazę przygotowań (Baza -> Forma -> Szlif -> Tapering) na podstawie daty kolejnego startu!",
    position: "top" as const,
  },
  {
    targetId: "tour-timeline-btn",
    title: "Timeline & Feedback Trenera 🎬",
    desc: "Tutaj wrzucasz swoje nagrania z sali lub meldujesz ukończenie treningu, a Trener nanosi wskazówki techniczne.",
    position: "bottom" as const,
  },
];

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

  const [isExerciseDropdownOpen, setIsExerciseDropdownOpen] = useState(false);
  const [isWorkoutDropdownOpen, setIsWorkoutDropdownOpen] = useState(false);
  const exerciseDropdownRef = useRef<HTMLDivElement>(null);
  const workoutDropdownRef = useRef<HTMLDivElement>(null);

  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const [masteredSkillIds, setMasteredSkillIds] = useState<string[]>([]);
  const [showRecommendationModal, setShowRecommendationModal] = useState(false);

  const [heroImages, setHeroImages] = useState<string[]>([
    "/hero/hero1.jpg",
    "/hero/hero2.jpg",
    "/hero/hero3.jpg",
    "/hero/hero4.jpg",
    "/hero/hero5.jpg",
    "/hero/hero6.jpg",
  ]);
  const [currentHeroIdx, setCurrentHeroIdx] = useState(0);
  const [hasNewTimelinePosts, setHasNewTimelinePosts] = useState(false);

  const [currentUser, setCurrentUser] = useState<{ username: string; role: "athlete" | "coach" } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authTeamCode, setAuthTeamCode] = useState("");
  const [authIsCoach, setAuthIsCoach] = useState(false);

  // Zawody
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isCompManagerOpen, setIsCompManagerOpen] = useState(false);
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [compForm, setCompForm] = useState({ name: "", date: "", location: "" });

  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCode, setImportCode] = useState("");

  const [workoutForm, setWorkoutForm] = useState({
    title: "",
    description: "",
    level: "Średniozaawansowany",
    warmup_ids: [] as string[],
    strength_ids: [] as string[],
    skill_ids: [] as string[],
    cooldown_ids: [] as string[],
  });

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
  const [formPrereqSearch, setFormPrereqSearch] = useState("");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exerciseDropdownRef.current && !exerciseDropdownRef.current.contains(event.target as Node)) {
        setIsExerciseDropdownOpen(false);
      }
      if (workoutDropdownRef.current && !workoutDropdownRef.current.contains(event.target as Node)) {
        setIsWorkoutDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function detectAvailableImages() {
      const detected: string[] = [];
      for (let i = 1; i <= 20; i++) {
        const src = `/hero/hero${i}.jpg`;
        try {
          const res = await fetch(src, { method: "HEAD" });
          if (res.ok) detected.push(src);
          else if (i > 6) break;
        } catch {
          if (i > 6) break;
        }
      }
      if (detected.length > 0) setHeroImages(detected);
    }
    detectAvailableImages();
  }, []);

  useEffect(() => {
    if (heroImages.length === 0) return;
    const timer = setInterval(() => {
      setCurrentHeroIdx((prev) => (prev + 1) % heroImages.length);
    }, 20000);
    return () => clearInterval(timer);
  }, [heroImages]);

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

  const fetchMasteredSkills = async (username: string) => {
    const { data } = await supabase
      .from("mastered_skills")
      .select("exercise_id")
      .eq("username", username);

    if (data) {
      setMasteredSkillIds(data.map((item) => item.exercise_id));
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
    async function checkAuthSession() {
      const token = localStorage.getItem("goat_auth_token");
      if (!token) return;

      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          localStorage.setItem("goat_athlete_profile", JSON.stringify(data.user));
          checkTimelineUnread(true);
          await fetchMasteredSkills(data.user.username);

          const seenTutorial = localStorage.getItem("goat_tutorial_seen");
          if (!seenTutorial) {
            startGuidedTour();
          }
        } else {
          setCurrentUser(null);
          localStorage.removeItem("goat_athlete_profile");
          localStorage.removeItem("goat_auth_token");
        }
      } catch {
        // Fallback
      }
    }

    checkAuthSession();
    fetchData();
  }, []);

  const startGuidedTour = () => {
    setTutorialStep(0);
    setIsTutorialOpen(true);
  };

  useEffect(() => {
    if (!isTutorialOpen) return;
    const currentStepConfig = TOUR_STEPS[tutorialStep];
    if (!currentStepConfig) return;

    const el = document.getElementById(currentStepConfig.targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        setTargetRect(el.getBoundingClientRect());
      }, 300);
    } else {
      setTargetRect(null);
    }
  }, [tutorialStep, isTutorialOpen]);

  const closeTutorial = () => {
    setIsTutorialOpen(false);
    localStorage.setItem("goat_tutorial_seen", "true");
    setTargetRect(null);
  };

  const nextTutorialStep = () => {
    if (tutorialStep < TOUR_STEPS.length - 1) {
      setTutorialStep((prev) => prev + 1);
    } else {
      closeTutorial();
    }
  };

  const prevTutorialStep = () => {
    if (tutorialStep > 0) {
      setTutorialStep((prev) => prev - 1);
    }
  };

  const toggleMasteredSkill = async (exerciseId: string) => {
    if (!currentUser) {
      alert("Zaloguj się, aby oznaczać opanowane tricki i śledzić swój postęp!");
      return;
    }

    const alreadyMastered = masteredSkillIds.includes(exerciseId);

    if (alreadyMastered) {
      const { error } = await supabase
        .from("mastered_skills")
        .delete()
        .eq("username", currentUser.username)
        .eq("exercise_id", exerciseId);

      if (!error) {
        setMasteredSkillIds((prev) => prev.filter((id) => id !== exerciseId));
      }
    } else {
      const { error } = await supabase
        .from("mastered_skills")
        .insert([{ username: currentUser.username, exercise_id: exerciseId }]);

      if (!error) {
        setMasteredSkillIds((prev) => [...prev, exerciseId]);
      }
    }
  };

  const recommendedSkill = useMemo(() => {
    if (!currentUser || exercises.length === 0) return null;

    const candidate = exercises.find((ex) => {
      if (ex.category !== "Tricking") return false;
      if (masteredSkillIds.includes(ex.id)) return false;
      if (!ex.prerequisite_ids || ex.prerequisite_ids.length === 0) return true;

      return ex.prerequisite_ids.every((prereqId) =>
        masteredSkillIds.includes(prereqId)
      );
    });

    return candidate || null;
  }, [exercises, masteredSkillIds, currentUser]);

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
      // Audio fallback
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

  const handlePublishWorkoutToTimeline = async (wo: Workout, durationStr: string) => {
    if (!currentUser) return;
    const notesInput = prompt(
      `Dodaj komentarz z treningu "${wo.title}" (lub zostaw puste):`,
      `Ukończono cały plan! Czas trwania jednostki: ${durationStr}`
    );

    if (notesInput === null) return;

    const payload = {
      athlete_name: currentUser.username,
      exercise_id: wo.id,
      exercise_title: `Trening: ${wo.title}`,
      video_url: null,
      notes: notesInput,
      post_type: "workout_summary",
      workout_duration: durationStr,
    };

    const { error } = await supabase.from("progress_submissions").insert([payload]);
    if (!error) {
      alert("Trening opublikowany na Timeline ekipy! 🔥");
      setActiveSessionWorkout(null);
    } else {
      alert("Błąd: " + error.message);
    }
  };

  const handleCopyShareCode = (workoutId: string, title: string) => {
    navigator.clipboard.writeText(workoutId);
    alert(`Skopiowano kod treningu "${title}"! Przekaż go innej osobie.`);
  };

  const handleImportWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importCode.trim() || !currentUser) return;

    const cleanId = importCode.trim();
    const { data: targetWorkout, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("id", cleanId)
      .single();

    if (error || !targetWorkout) {
      alert("Nie znaleziono treningu o tym kodzie!");
      return;
    }

    const payload = {
      title: targetWorkout.title,
      description: targetWorkout.description,
      level: targetWorkout.level,
      exercise_ids: targetWorkout.exercise_ids,
      author_username: currentUser.username,
      original_author: targetWorkout.author_username || "Inny zawodnik",
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("workouts")
      .insert([payload])
      .select();

    if (!insertErr && inserted) {
      setWorkouts((prev) => [inserted[0], ...prev]);
      setIsImportModalOpen(false);
      setImportCode("");
      alert(`Zaimportowano trening od zawodnika "${payload.original_author}"!`);
    } else {
      alert("Błąd importu: " + insertErr?.message);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = authUsername.trim();
    if (!cleanNick) {
      alert("Wpisz swój nick!");
      return;
    }
    if (!authPassword) {
      alert("Wpisz hasło!");
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanNick,
          password: authPassword,
          teamCode: authTeamCode,
          isCoach: authIsCoach,
          mode: authMode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Błąd uwierzytelniania.");
        return;
      }

      setCurrentUser(data.user);
      localStorage.setItem("goat_athlete_profile", JSON.stringify(data.user));
      localStorage.setItem("goat_auth_token", data.token);

      setIsAuthModalOpen(false);
      setAuthUsername("");
      setAuthPassword("");
      setAuthTeamCode("");
      checkTimelineUnread(true);
      await fetchMasteredSkills(data.user.username);

      if (authMode === "register") {
        localStorage.removeItem("goat_tutorial_seen");
        startGuidedTour();
      }
    } catch {
      alert("Błąd połączenia z serwerem logowania.");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignoruj błąd
    }
    setCurrentUser(null);
    setMasteredSkillIds([]);
    localStorage.removeItem("goat_athlete_profile");
    localStorage.removeItem("goat_auth_token");
    setHasNewTimelinePosts(false);
    if (activeCategory === "Własne treningi") {
      setActiveCategory("Tricking");
    }
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
    if (!confirm(`Czy na pewno usunąć trening "${title}"?`)) return;
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

    if (editingCompId) {
      const { data, error } = await supabase
        .from("competitions")
        .update(compForm)
        .eq("id", editingCompId)
        .select();

      if (!error && data) {
        setCompetitions((prev) =>
          prev
            .map((c) => (c.id === editingCompId ? data[0] : c))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        );
        setEditingCompId(null);
        setCompForm({ name: "", date: "", location: "" });
      }
    } else {
      const { data, error } = await supabase.from("competitions").insert([compForm]).select();
      if (!error && data) {
        setCompetitions((prev) =>
          [...prev, data[0]].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        );
        setCompForm({ name: "", date: "", location: "" });
      }
    }
  };

  const handleDeleteCompetition = async (id: string, name: string) => {
    if (!confirm(`Czy na pewno usunąć zawody "${name}"?`)) return;
    const { error } = await supabase.from("competitions").delete().eq("id", id);
    if (!error) {
      setCompetitions((prev) => prev.filter((c) => c.id !== id));
      if (editingCompId === id) {
        setEditingCompId(null);
        setCompForm({ name: "", date: "", location: "" });
      }
    }
  };

  const nextCompetition = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const upcoming = competitions.filter((c) => c.date >= today);
    return upcoming.length > 0 ? upcoming[0] : null;
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

  const getLevelWeight = (diff: string) => {
    if (!diff) return 99;
    const lower = diff.toLowerCase();
    if (lower.includes("lvl 1") || lower.includes("fundament")) return 1;
    if (lower.includes("lvl 2") || lower.includes("baza")) return 2;
    if (lower.includes("lvl 3") || lower.includes("pojedyncze")) return 3;
    if (lower.includes("lvl 4") || lower.includes("zaawansowan")) return 4;
    if (lower.includes("lvl 5") || lower.includes("master")) return 5;
    if (lower.includes("lvl 6") || lower.includes("elite")) return 6;
    return 10;
  };

  const filteredList = useMemo(() => {
    const list = exercises.filter((item) => {
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

    return list.sort((a, b) => {
      if (b.prerequisite_ids?.includes(a.id)) return -1;
      if (a.prerequisite_ids?.includes(b.id)) return 1;

      const levelA = getLevelWeight(a.difficulty);
      const levelB = getLevelWeight(b.difficulty);
      if (levelA !== levelB) return levelA - levelB;

      const prereqsA = a.prerequisite_ids?.length || 0;
      const prereqsB = b.prerequisite_ids?.length || 0;
      if (prereqsA !== prereqsB) return prereqsA - prereqsB;

      return 0;
    });
  }, [exercises, activeCategory, activeSubcategory, activeTrickingLevel, searchTerm]);

  const isExerciseCategoryActive = EXERCISE_CATEGORIES.includes(activeCategory);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 pb-20">
      {/* SPOTLIGHT GUIDED TOUR */}
      {isTutorialOpen && (
        <div className="fixed inset-0 z-50 pointer-events-auto">
          <div className="absolute inset-0 bg-black/80 transition-all duration-300" />

          {targetRect && (
            <div
              className="absolute border-2 border-emerald-400 rounded-2xl shadow-[0_0_25px_rgba(52,211,153,0.4)] pointer-events-none transition-all duration-300"
              style={{
                top: Math.max(0, targetRect.top + window.scrollY - 4),
                left: Math.max(0, targetRect.left + window.scrollX - 4),
                width: Math.min(window.innerWidth - 8, targetRect.width + 8),
                height: targetRect.height + 8,
              }}
            />
          )}

          <div
            className="fixed z-50 bg-neutral-900 border border-emerald-500/60 rounded-3xl p-5 shadow-2xl max-w-sm w-[92vw] mx-auto space-y-3.5"
            style={{
              top: targetRect
                ? Math.min(window.innerHeight - 250, Math.max(16, targetRect.bottom + 14))
                : "50%",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                Krok {tutorialStep + 1} z {TOUR_STEPS.length}
              </span>
              <button
                onClick={closeTutorial}
                className="text-neutral-500 hover:text-white text-xs px-2 py-1"
              >
                Pomiń ✕
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-white">
                {TOUR_STEPS[tutorialStep].title}
              </h3>
              <p className="text-neutral-300 text-xs leading-relaxed">
                {TOUR_STEPS[tutorialStep].desc}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
              <button
                onClick={prevTutorialStep}
                disabled={tutorialStep === 0}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium ${
                  tutorialStep === 0
                    ? "opacity-30 cursor-not-allowed text-neutral-500"
                    : "text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                ‹ Wstecz
              </button>

              <button
                onClick={nextTutorialStep}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1 shadow-md shadow-emerald-500/20"
              >
                <span>{tutorialStep === TOUR_STEPS.length - 1 ? "Gotowe!" : "Dalej"}</span>
                <span>➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HERO BANNER - RESPONSYWNY */}
      <section className="relative w-full border-b border-neutral-800/80 bg-neutral-950 overflow-hidden select-none">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {heroImages.map((src, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                idx === currentHeroIdx ? "opacity-70" : "opacity-0"
              }`}
            >
              <img
                src={src}
                alt="Acrobatics hero"
                className="w-full h-full object-cover object-center"
              />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/75 to-neutral-950/40" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 md:px-8 pt-4 pb-8 flex flex-col justify-between min-h-[440px] md:min-h-[520px]">
          {/* TOP BAR NA TELEFONIE */}
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5">
              <span className="text-xl">🥋</span>
              <span className="text-xs md:text-sm font-black tracking-tight text-emerald-400 uppercase">
                ROAD TO GOAT
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                id="tour-timeline-btn"
                href="/timeline"
                className="relative flex items-center gap-1.5 bg-neutral-900/90 border border-neutral-700 hover:border-emerald-500/60 rounded-xl px-2.5 py-1.5 text-xs font-semibold"
              >
                <span>🎬</span>
                <span className="hidden sm:inline">Timeline</span>
                {currentUser && hasNewTimelinePosts && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                )}
              </Link>

              {!currentUser ? (
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setIsAuthModalOpen(true);
                  }}
                  className="bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 text-xs px-3 py-1.5 rounded-xl text-neutral-200 transition-all cursor-pointer font-medium"
                >
                  👤 Wejdź
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-neutral-900/90 border border-neutral-700/80 p-1 rounded-xl">
                  <Link
                    href="/profile"
                    className="text-xs text-emerald-400 font-bold px-2 py-1 bg-neutral-950/80 border border-neutral-800 rounded-lg truncate max-w-[110px]"
                  >
                    👤 {currentUser.username}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="bg-neutral-900 hover:bg-red-950/60 border border-neutral-800 text-[11px] px-2 py-1 rounded-lg text-neutral-400 hover:text-red-300 transition-all font-medium"
                  >
                    Wyloguj
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* GŁÓWNA TREŚĆ HERO */}
          <div className="my-auto py-5 grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
            <div id="tour-header" className="lg:col-span-2 space-y-2">
              <div className="inline-block bg-neutral-900/85 backdrop-blur-md border border-neutral-700/80 rounded-2xl px-4 py-2 shadow-lg">
                <h1 className="text-2xl md:text-5xl font-black tracking-tight text-emerald-400 uppercase">
                  ROAD TO GOAT
                </h1>
              </div>
              <p className="text-neutral-200 text-xs md:text-sm max-w-xl leading-relaxed drop-shadow bg-neutral-950/60 p-3 rounded-xl backdrop-blur-sm border border-neutral-800/40">
                Szukasz pomysłu na trening, odblokowujesz nowy trick, a może celujesz w szczyt formy na zawody? Otrzymujesz strukturę, by krok po kroku osiągnąć wyznaczony poziom.
              </p>

              {currentUser && recommendedSkill && (
                <div className="inline-flex flex-wrap items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 p-2.5 rounded-xl backdrop-blur-md">
                  <span className="text-xs text-neutral-200">
                    🎯 Następny krok: <strong className="text-emerald-300">{recommendedSkill.title}</strong>
                  </span>
                  <button
                    onClick={() => setShowRecommendationModal(true)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all"
                  >
                    Metodyka →
                  </button>
                </div>
              )}
            </div>

            {/* KAFELEK ZAWODÓW NA TELEFONIE */}
            {currentUser && (
              <div
                id="tour-competition-widget"
                onClick={() => setIsCompManagerOpen(true)}
                className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 hover:border-emerald-500/50 rounded-2xl p-3.5 shadow-xl cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5 mb-2">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                    <span>🏆</span> Najbliższy Start
                  </span>
                  <span className="text-[10px] text-emerald-400">
                    Zarządzaj ({competitions.length}) ↗
                  </span>
                </div>

                {nextCompetition ? (
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-bold text-white text-xs md:text-sm truncate">
                        {nextCompetition.name}
                      </h3>
                      <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                        {daysToComp !== null ? `${daysToComp} dni` : ""}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span>📅 {nextCompetition.date}</span>
                      {nextCompetition.location && <span>📍 {nextCompetition.location}</span>}
                    </div>

                    <div className="pt-0.5">
                      <span className="text-emerald-300 font-bold text-[10px] bg-emerald-950 border border-emerald-800/80 px-2 py-0.5 rounded-md inline-block">
                        ⚡ {calculatedPhase}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500 py-1">
                    Brak zaplanowanych zawodów. Kliknij, aby dodać.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PRZYCISKI AKCJI - RESPONSYWNY PASEK */}
          <div className="relative z-30 flex flex-wrap items-center justify-between gap-2 pt-2">
            {currentUser ? (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95 flex-1 sm:flex-none text-center"
                >
                  + Dodaj
                </button>

                <div className="relative inline-block flex-1 sm:flex-none" ref={workoutDropdownRef} id="tour-workouts-btn">
                  <button
                    type="button"
                    onClick={() => setIsWorkoutDropdownOpen((prev) => !prev)}
                    className="w-full bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <span>🏋️ Treningi</span>
                    <span className="text-[10px] text-emerald-400 font-bold">▾</span>
                  </button>

                  {isWorkoutDropdownOpen && (
                    <div className="absolute left-0 bottom-full mb-2 w-52 bg-neutral-900 border border-neutral-700 rounded-2xl p-2 shadow-2xl z-50 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsWorkoutDropdownOpen(false);
                          setIsWorkoutModalOpen(true);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-neutral-200 hover:bg-neutral-800 hover:text-emerald-400 transition-colors flex items-center gap-2"
                      >
                        <span>✨</span>
                        <span>Stwórz Trening</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsWorkoutDropdownOpen(false);
                          setIsImportModalOpen(true);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-neutral-200 hover:bg-neutral-800 hover:text-emerald-400 transition-colors flex items-center gap-2 border-t border-neutral-800/80 pt-1.5"
                      >
                        <span>📥</span>
                        <span>Importuj Kodem</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setIsCompManagerOpen(true)}
                  className="bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 px-3 py-2 rounded-xl text-xs font-semibold flex-1 sm:flex-none text-center"
                >
                  🏆 Starty
                </button>
              </div>
            ) : (
              <div />
            )}

            <div className="hidden sm:flex items-center gap-1.5 opacity-60 ml-auto">
              {heroImages.map((_, i) => (
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

      {/* PASEK ZAKŁADEK I WYSZUKIWARKA - PRZYJAZNE DLA TELEFONU */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 mt-5 space-y-4">
        {/* Poziomo przewijany pasek kategorii głównych */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none select-none border-b border-neutral-900">
          <div className="relative shrink-0" ref={exerciseDropdownRef} id="tour-exercise-base">
            <button
              onClick={() => setIsExerciseDropdownOpen(!isExerciseDropdownOpen)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                isExerciseCategoryActive
                  ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                  : "bg-neutral-900 text-neutral-300 border border-neutral-800"
              }`}
            >
              <span>📚 Baza</span>
              <span className="text-[10px] opacity-75">
                {isExerciseCategoryActive ? `(${activeCategory})` : "▾"}
              </span>
            </button>

            {isExerciseDropdownOpen && (
              <div className="absolute left-0 mt-2 w-44 bg-neutral-900 border border-neutral-800 rounded-2xl p-1.5 shadow-2xl z-40 space-y-1">
                {EXERCISE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      setActiveSubcategory(SUBCATEGORIES_CONFIG[cat][0]);
                      setActiveTrickingLevel("Wszystkie poziomy");
                      setIsExerciseDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold ${
                      activeCategory === cat
                        ? "bg-emerald-500/20 text-emerald-400 font-bold"
                        : "text-neutral-300 hover:bg-neutral-800"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setActiveCategory("Muzyka");
              setActiveSubcategory(SUBCATEGORIES_CONFIG["Muzyka"][0]);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeCategory === "Muzyka"
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                : "bg-neutral-900 text-neutral-400 border border-neutral-800"
            }`}
          >
            🎵 Muzyka
          </button>

          <button
            onClick={() => {
              setActiveCategory("Dieta");
              setActiveSubcategory(SUBCATEGORIES_CONFIG["Dieta"][0]);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeCategory === "Dieta"
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                : "bg-neutral-900 text-neutral-400 border border-neutral-800"
            }`}
          >
            🥗 Dieta
          </button>

          {currentUser && (
            <button
              onClick={() => {
                setActiveCategory("Własne treningi");
                setActiveSubcategory(SUBCATEGORIES_CONFIG["Własne treningi"][0]);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                activeCategory === "Własne treningi"
                  ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                  : "bg-neutral-900 text-neutral-400 border border-neutral-800"
              }`}
            >
              📋 Treningi
            </button>
          )}
        </div>

        {/* Wyszukiwarka */}
        <input
          type="text"
          placeholder="Szukaj tricku, ćwiczenia, elementu..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs md:text-sm focus:outline-none focus:border-emerald-500 transition-colors"
        />

        {/* Podkategorie - płynny poziomy scroll na telefonie */}
        {activeCategory !== "Własne treningi" && (
          <div className="space-y-2 select-none">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {SUBCATEGORIES_CONFIG[activeCategory]?.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setActiveSubcategory(sub)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                    activeSubcategory === sub
                      ? "bg-neutral-200 text-neutral-950 font-bold"
                      : "bg-neutral-900/80 text-neutral-400 border border-neutral-800"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>

            {activeCategory === "Tricking" && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {TRICKING_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setActiveTrickingLevel(lvl)}
                    className={`px-2 py-1 rounded-md text-[10px] md:text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                      activeTrickingLevel === lvl
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                        : "bg-neutral-900/40 text-neutral-500 border border-neutral-900"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WŁASNE TRENINGI (WIDOK) */}
        {activeCategory === "Własne treningi" && currentUser && (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-900/40 border border-neutral-800/80 p-3 rounded-xl">
              <span className="text-xs text-neutral-400 font-medium">
                Twoje jednostki ({visibleWorkouts.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsWorkoutModalOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
                >
                  + Stwórz
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="bg-neutral-900 hover:bg-neutral-800 text-emerald-400 border border-emerald-500/40 text-xs px-3 py-1.5 rounded-lg transition-all font-semibold"
                >
                  📥 Importuj
                </button>
              </div>
            </div>

            {visibleWorkouts.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 text-xs border border-neutral-900 rounded-2xl">
                Brak zapisanych treningów.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleWorkouts.map((wo) => {
                  const includedExercises = exercises.filter((ex) =>
                    wo.exercise_ids?.includes(ex.id)
                  );
                  return (
                    <div
                      key={wo.id}
                      className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                          {wo.level}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopyShareCode(wo.id, wo.title)}
                            className="text-xs text-neutral-400 hover:text-emerald-400 px-2 py-0.5 bg-neutral-950 border border-neutral-800 rounded-md"
                          >
                            🔗 Kod
                          </button>
                          <button
                            onClick={() => handleDeleteWorkout(wo.id, wo.title)}
                            className="text-xs text-red-400 px-2 py-0.5 bg-red-950/40 border border-red-900/50 rounded-md"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-white mb-0.5">{wo.title}</h3>
                        <p className="text-xs text-neutral-400 leading-relaxed">{wo.description}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setActiveSessionWorkout(wo)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs py-2 rounded-xl text-center"
                        >
                          ▶ Odpal na Sali
                        </button>
                        <button
                          onClick={() => handlePublishWorkoutToTimeline(wo, "45 min")}
                          className="bg-neutral-950 hover:bg-neutral-800 border border-neutral-700/80 text-emerald-400 text-xs py-2 rounded-xl text-center font-semibold"
                        >
                          🏆 Timeline
                        </button>
                      </div>

                      <div className="space-y-1.5 border-t border-neutral-800/80 pt-2 text-xs">
                        <p className="text-[11px] font-semibold text-neutral-400">
                          Ćwiczenia ({includedExercises.length}):
                        </p>
                        {includedExercises.map((ex, i) => (
                          <div
                            key={ex.id}
                            className="flex items-center justify-between p-1.5 bg-neutral-950 rounded-lg text-xs"
                          >
                            <span className="text-neutral-300 truncate max-w-[200px]">
                              {i + 1}. {ex.title}
                            </span>
                            <Link href={`/exercise/${ex.id}`} className="text-emerald-400 text-[11px] shrink-0">
                              Metodyka →
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* LISTA ĆWICZEŃ W BAZIE - RESPONSYWNE KARTY */}
        {activeCategory !== "Własne treningi" && (
          loading ? (
            <div className="text-center py-12 text-neutral-500 text-xs animate-pulse">
              Ładowanie bazy...
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-xs border border-neutral-900 rounded-2xl">
              Brak elementów w tej kategorii.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {filteredList.map((item) => {
                const isExpanded = !!expandedCardIds[item.id];
                const primaryMedia = (item.sources && item.sources[0]) || item.video_url || "";
                const isSpotify = primaryMedia.includes("spotify.com");
                const isMastered = masteredSkillIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleExpand(item.id)}
                    className={`border rounded-2xl p-4 transition-all duration-300 select-none cursor-pointer flex flex-col justify-between ${
                      isMastered
                        ? "bg-emerald-950/20 border-emerald-500/60 shadow-md"
                        : isExpanded
                        ? "bg-neutral-900/90 border-neutral-700"
                        : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-2.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-neutral-800 text-emerald-400 border border-neutral-700 truncate max-w-[160px]">
                          {item.subcategory || item.category}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-neutral-400 truncate max-w-[100px]">
                            {item.difficulty}
                          </span>
                          <span className={`text-[10px] text-neutral-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                            ▼
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`text-base font-bold ${isMastered ? "text-emerald-300" : "text-white"}`}>
                          {item.title}
                        </h3>

                        {currentUser && item.category !== "Muzyka" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMasteredSkill(item.id);
                            }}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${
                              isMastered
                                ? "bg-emerald-500 text-black border-emerald-400"
                                : "bg-neutral-950/80 text-neutral-400 border-neutral-700"
                            }`}
                          >
                            {isMastered ? "✓ Umiem" : "+ Umiem"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div
                      className={`grid transition-all duration-300 ease-in-out ${
                        isExpanded
                          ? "grid-rows-[1fr] opacity-100 mt-3 pt-2.5 border-t border-neutral-800/80"
                          : "grid-rows-[0fr] opacity-0 mt-0 pt-0 border-transparent"
                      }`}
                    >
                      <div className="overflow-hidden space-y-3">
                        <p className="text-neutral-400 text-xs leading-relaxed">
                          {item.short_description || "Brak opisu."}
                        </p>

                        {isSpotify && primaryMedia && (
                          <div className="mt-2 rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <iframe
                              src={primaryMedia}
                              width="100%"
                              height="80"
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen"
                              loading="lazy"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          {currentUser?.role === "coach" ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                                className="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded-lg border border-neutral-700"
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
                                className="text-xs bg-red-950/40 text-red-400 px-2 py-1 rounded-lg border border-red-900/50"
                              >
                                🗑️
                              </button>
                            </div>
                          ) : (
                            <div />
                          )}

                          {!isSpotify && (
                            <div onClick={(e) => e.stopPropagation()} className="ml-auto">
                              <Link
                                href={`/exercise/${item.id}`}
                                className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-md active:scale-95"
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

      {/* MODAL ZARZĄDZANIA ZAWODAMI */}
      {isCompManagerOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                <span>🏆</span> Zawody ({competitions.length})
              </h2>
              <button
                onClick={() => {
                  setIsCompManagerOpen(false);
                  setEditingCompId(null);
                  setCompForm({ name: "", date: "", location: "" });
                }}
                className="text-neutral-400 hover:text-white text-xs px-2"
              >
                ✕
              </button>
            </div>

            {currentUser?.role === "coach" && (
              <form onSubmit={handleSaveCompetition} className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-2 text-xs">
                <input
                  type="text"
                  required
                  placeholder="Nazwa turnieju..."
                  value={compForm.name}
                  onChange={(e) => setCompForm({ ...compForm, name: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={compForm.date}
                    onChange={(e) => setCompForm({ ...compForm, date: e.target.value })}
                    className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Miasto..."
                    value={compForm.location}
                    onChange={(e) => setCompForm({ ...compForm, location: e.target.value })}
                    className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  {editingCompId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCompId(null);
                        setCompForm({ name: "", date: "", location: "" });
                      }}
                      className="px-2.5 py-1 bg-neutral-800 rounded-lg"
                    >
                      Anuluj
                    </button>
                  )}
                  <button
                    type="submit"
                    className="bg-emerald-500 text-black font-bold px-3.5 py-1 rounded-lg"
                  >
                    {editingCompId ? "Zapisz" : "+ Dodaj"}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {competitions.map((comp) => {
                const isNext = nextCompetition?.id === comp.id;
                return (
                  <div
                    key={comp.id}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                      isNext
                        ? "bg-emerald-950/30 border-emerald-500/60"
                        : "bg-neutral-950/80 border-neutral-800"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-white text-xs">{comp.name}</h4>
                        {isNext && (
                          <span className="text-[9px] font-bold text-black bg-emerald-400 px-1.5 py-0.2 rounded-full">
                            Najbliższy
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-400 block mt-0.5">
                        📅 {comp.date} {comp.location && `| 📍 ${comp.location}`}
                      </span>
                      {isNext && (
                        <span className="text-[10px] font-bold text-emerald-300 mt-1 block">
                          ⚡ {calculatedPhase}
                        </span>
                      )}
                    </div>

                    {currentUser?.role === "coach" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingCompId(comp.id);
                            setCompForm({
                              name: comp.name,
                              date: comp.date,
                              location: comp.location || "",
                            });
                          }}
                          className="bg-neutral-800 px-2 py-1 rounded text-[11px]"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteCompetition(comp.id, comp.name)}
                          className="bg-red-950/50 text-red-400 px-2 py-1 rounded text-[11px]"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL REKOMENDACJI ASYSTENTA */}
      {showRecommendationModal && recommendedSkill && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5 z-50">
          <div className="bg-neutral-900 border border-emerald-500/50 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-3">
            <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
              Rekomendacja z Drzewka
            </span>
            <h2 className="text-xl font-black text-white">{recommendedSkill.title}</h2>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {recommendedSkill.short_description}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setShowRecommendationModal(false)}
                className="px-3 py-1.5 bg-neutral-800 text-xs rounded-xl"
              >
                Zamknij
              </button>
              <Link
                href={`/exercise/${recommendedSkill.id}`}
                className="bg-emerald-500 text-black font-bold text-xs px-4 py-1.5 rounded-xl"
              >
                Metodyka →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* TRYB SALI - MOBILNY PEŁNOEKRANOWY */}
      {activeSessionWorkout && (
        <div className="fixed inset-0 bg-neutral-950 z-50 p-4 flex flex-col justify-between overflow-y-auto">
          <div className="max-w-md w-full mx-auto space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <span className="text-[9px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                  Tryb Sali (W Toku)
                </span>
                <h2 className="text-lg font-black text-white mt-0.5">{activeSessionWorkout.title}</h2>
              </div>
              <button
                onClick={() => setActiveSessionWorkout(null)}
                className="text-neutral-400 hover:text-white text-xs px-2"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-neutral-900/80 border border-neutral-800 p-3 rounded-2xl">
              <div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase block">
                  Czas sesji:
                </span>
                <span className="text-2xl font-black font-mono text-emerald-400">
                  {formatTimerDigits(sessionElapsedTime)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase block">
                  Przerwa:
                </span>
                {restTimerSeconds !== null ? (
                  <span className="text-2xl font-black font-mono text-amber-400 animate-pulse">
                    {formatTimerDigits(restTimerSeconds)}
                  </span>
                ) : (
                  <div className="flex gap-1 pt-1">
                    {[30, 60, 90].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStartRest(s)}
                        className="bg-neutral-950 border border-neutral-800 text-[10px] px-1.5 py-0.5 rounded font-mono"
                      >
                        +{s}s
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {activeSessionWorkout.exercise_ids.map((exId, idx) => {
                const ex = exercises.find((e) => e.id === exId);
                if (!ex) return null;
                const isChecked = sessionCompletedIds.includes(ex.id);

                return (
                  <div
                    key={ex.id}
                    onClick={() => toggleSessionExerciseCheck(ex.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer ${
                      isChecked
                        ? "bg-emerald-950/20 border-emerald-500/40 text-neutral-400"
                        : "bg-neutral-900/60 border-neutral-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center text-[10px] font-bold ${
                          isChecked
                            ? "bg-emerald-500 border-emerald-500 text-black"
                            : "border-neutral-700 bg-neutral-950"
                        }`}
                      >
                        {isChecked && "✓"}
                      </div>
                      <span className={isChecked ? "line-through" : "text-white font-bold"}>
                        {idx + 1}. {ex.title}
                      </span>
                    </div>

                    <Link
                      href={`/exercise/${ex.id}`}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-emerald-400 shrink-0"
                    >
                      Metodyka ↗
                    </Link>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => handlePublishWorkoutToTimeline(activeSessionWorkout, formatTimerDigits(sessionElapsedTime))}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs py-2.5 rounded-xl shadow-lg mt-4"
            >
              Zakończ & Wrzuć na Timeline 🏆
            </button>
          </div>
        </div>
      )}

      {/* MODAL IMPORTU */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-3">
            <h2 className="text-base font-bold text-white">📥 Importuj Trening</h2>
            <form onSubmit={handleImportWorkout} className="space-y-3 text-xs">
              <input
                type="text"
                required
                placeholder="Wklej kod treningu (UUID)..."
                value={importCode}
                onChange={(e) => setImportCode(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3 py-1 text-neutral-400"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 text-black font-bold px-4 py-1.5 rounded-xl"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-3.5">
            <h2 className="text-base font-bold text-white">
              {authMode === "login" ? "🔐 Zaloguj się" : "📝 Rejestracja"}
            </h2>
            <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Nick *</label>
                <input
                  type="text"
                  required
                  placeholder="Twój Nick..."
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">
                  {authIsCoach ? "PIN Trenera *" : "Hasło *"}
                </label>
                <input
                  type="password"
                  required
                  placeholder="Hasło..."
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {authMode === "register" && (
                <div>
                  <label className="text-emerald-400 block mb-1 font-semibold">
                    Kod Drużyny (Kawashi) *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Wpisz kod drużyny..."
                    value={authTeamCode}
                    onChange={(e) => setAuthTeamCode(e.target.value)}
                    className="w-full bg-neutral-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="checkbox"
                  id="authCoachMobile"
                  checked={authIsCoach}
                  onChange={(e) => setAuthIsCoach(e.target.checked)}
                  className="rounded border-neutral-800 bg-neutral-950 text-emerald-500"
                />
                <label htmlFor="authCoachMobile" className="text-neutral-300">
                  Trener / Admin
                </label>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setAuthPassword("");
                    setAuthTeamCode("");
                  }}
                  className="text-emerald-400 underline text-xs"
                >
                  {authMode === "login" ? "Stwórz konto" : "Mam konto"}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(false)}
                    className="px-2 py-1 text-neutral-400"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-500 text-black font-bold px-4 py-1.5 rounded-xl"
                  >
                    {authMode === "login" ? "Wejdź" : "Załóż"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DODAWANIA ELEMENTU BAZY */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto space-y-3.5">
            <h2 className="text-base font-bold text-white">
              {editingExerciseId ? "✏️ Edytuj Pozycję" : "+ Dodaj do Bazy"}
            </h2>

            <form onSubmit={handleSaveExercise} className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Nazwa *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Cheat 720..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-neutral-400 block mb-1">Kategoria</label>
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
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1.5 text-xs"
                  >
                    {[...EXERCISE_CATEGORIES, "Muzyka", "Dieta"].map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Podkategoria</label>
                  <select
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1.5 text-xs"
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
                  <label className="text-neutral-400 block mb-1">Poziom</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1.5 text-xs"
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
                <label className="text-emerald-400 block mb-1 font-medium">Krótki opis *</label>
                <input
                  type="text"
                  required
                  placeholder="Krótki opis na kafelek..."
                  value={formData.short_description}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {formData.category !== "Muzyka" && (
                <div>
                  <label className="text-neutral-400 block mb-1">Metodyka / Technika</label>
                  <textarea
                    rows={2}
                    placeholder="Wskazówki trenerskie..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Fundamenty w Drzewku */}
              {formData.category !== "Muzyka" && (
                <div className="border border-neutral-800 bg-neutral-950/70 p-3 rounded-xl space-y-2">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                    🌳 Wymagane fundamenty ({formData.prerequisite_ids.length})
                  </span>
                  <input
                    type="text"
                    placeholder="Szukaj elementu bazowego..."
                    value={formPrereqSearch}
                    onChange={(e) => setFormPrereqSearch(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {exercises
                      .filter(
                        (ex) =>
                          ex.id !== editingExerciseId &&
                          ex.title.toLowerCase().includes(formPrereqSearch.toLowerCase())
                      )
                      .map((ex) => {
                        const isSelected = formData.prerequisite_ids.includes(ex.id);
                        return (
                          <div
                            key={ex.id}
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                prerequisite_ids: isSelected
                                  ? prev.prerequisite_ids.filter((x) => x !== ex.id)
                                  : [...prev.prerequisite_ids, ex.id],
                              }));
                            }}
                            className={`p-1.5 rounded-lg text-[11px] flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
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
              )}

              {/* Źródła wideo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-emerald-400 font-medium">Link do Wideo</label>
                  {formData.category !== "Muzyka" && (
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, sources: [...p.sources, ""] }))}
                      className="text-[11px] text-emerald-400 hover:underline"
                    >
                      + Następny link
                    </button>
                  )}
                </div>
                {formData.sources.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder={`Link #${idx + 1}`}
                      value={s}
                      onChange={(e) => {
                        const newS = [...formData.sources];
                        newS[idx] = e.target.value;
                        setFormData({ ...formData, sources: newS });
                      }}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                    />
                    {formData.sources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, sources: p.sources.filter((_, i) => i !== idx) }))}
                        className="text-red-400 px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-neutral-400"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 text-black font-bold px-4 py-1.5 rounded-xl"
                >
                  {editingExerciseId ? "Zapisz" : "Dodaj"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KREATOR TRENINGU */}
      {isWorkoutModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto space-y-3.5">
            <h2 className="text-base font-bold text-white">🏋️ Nowy Trening</h2>
            <form onSubmit={handleSaveStructuredWorkout} className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Nazwa *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Trening Mocy..."
                  value={workoutForm.title}
                  onChange={(e) => setWorkoutForm({ ...workoutForm, title: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Opis</label>
                <textarea
                  rows={2}
                  placeholder="Cele jednostki..."
                  value={workoutForm.description}
                  onChange={(e) => setWorkoutForm({ ...workoutForm, description: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Kroki periodyzacji */}
              {[
                { label: "🔥 Rozgrzewka", key: "warmup_ids" as const, cat: "Rozciąganie" },
                { label: "⚡ Siła / Plyo", key: "strength_ids" as const, cat: "Siła" },
                { label: "🎯 Tricking", key: "skill_ids" as const, cat: "Tricking" },
                { label: "🧘 Rozciąganie", key: "cooldown_ids" as const, cat: "Rozciąganie" },
              ].map(({ label, key, cat }) => (
                <div key={key} className="border border-neutral-800 bg-neutral-950/60 p-2.5 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-neutral-300 block">
                    {label} ({workoutForm[key].length})
                  </span>
                  <div className="max-h-20 overflow-y-auto space-y-1">
                    {exercises
                      .filter((e) => e.category === cat || (cat === "Siła" && e.category === "Plyometria"))
                      .map((ex) => (
                        <div
                          key={ex.id}
                          onClick={() => toggleSelectExercise(key, ex.id)}
                          className={`p-1.5 rounded-lg text-[11px] flex items-center justify-between cursor-pointer ${
                            workoutForm[key].includes(ex.id)
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "hover:bg-neutral-900 text-neutral-400"
                          }`}
                        >
                          <span>{ex.title}</span>
                          <span className="text-[10px] text-neutral-500">{ex.subcategory}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsWorkoutModalOpen(false)}
                  className="px-3 py-1 text-neutral-400"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 text-black font-bold px-4 py-1.5 rounded-xl"
                >
                  Zapisz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}