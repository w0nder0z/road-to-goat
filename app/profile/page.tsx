"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Workout {
  id: string;
  title: string;
  description: string;
  level: string;
  exercise_ids: string[];
  created_at: string;
}

interface ProgressItem {
  id: string;
  exercise_title: string;
  video_url?: string;
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

interface AthleteProfile {
  id: string;
  username: string;
  role: "athlete" | "coach";
  created_at: string;
}

const COACH_PIN = "1234";

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ username: string; role: "athlete" | "coach" } | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [submissions, setSubmissions] = useState<ProgressItem[]>([]);
  const [comments, setComments] = useState<TimelineComment[]>([]);
  const [allAthletes, setAllAthletes] = useState<AthleteProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUserStr = localStorage.getItem("goat_athlete_profile");
    if (!savedUserStr) {
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(savedUserStr);
      setCurrentUser(parsed);
      loadUserData(parsed.username, parsed.role);
    } catch {
      setLoading(false);
    }
  }, []);

  const loadUserData = async (username: string, role: "athlete" | "coach") => {
    setLoading(true);

    // Pobierz własne treningi
    const { data: woData } = await supabase
      .from("workouts")
      .select("*")
      .eq("author_username", username)
      .order("created_at", { ascending: false });

    if (woData) setWorkouts(woData);

    // Pobierz własne nagrania z Timeline
    const { data: subsData } = await supabase
      .from("progress_submissions")
      .select("*")
      .eq("athlete_name", username)
      .order("created_at", { ascending: false });

    if (subsData) {
      setSubmissions(subsData);

      const subIds = subsData.map((s) => s.id);
      if (subIds.length > 0) {
        const { data: commsData } = await supabase
          .from("timeline_comments")
          .select("*")
          .in("submission_id", subIds)
          .order("created_at", { ascending: true });

        if (commsData) setComments(commsData);
      }
    }

    // Jeśli użytkownik to Trener, pobierz listę wszystkich kont do zarządzania
    if (role === "coach") {
      const { data: athletesData } = await supabase
        .from("athlete_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (athletesData) setAllAthletes(athletesData);
    }

    setLoading(false);
  };

  const handleToggleCoach = async () => {
    if (!currentUser) return;
    if (currentUser.role === "coach") {
      const downgraded = { username: currentUser.username, role: "athlete" as const };
      setCurrentUser(downgraded);
      localStorage.setItem("goat_athlete_profile", JSON.stringify(downgraded));
      setAllAthletes([]);
    } else {
      const pin = prompt("Podaj PIN Trenera / Admina:");
      if (pin === COACH_PIN) {
        const upgraded = { username: currentUser.username, role: "coach" as const };
        setCurrentUser(upgraded);
        localStorage.setItem("goat_athlete_profile", JSON.stringify(upgraded));
        loadUserData(currentUser.username, "coach");
      } else if (pin !== null) {
        alert("Nieprawidłowy PIN.");
      }
    }
  };

  const handleDeleteAthlete = async (athlete: AthleteProfile) => {
    if (athlete.username === currentUser?.username) {
      alert("Nie możesz usunąć swojego własnego konta z tego poziomu.");
      return;
    }

    const confirmed = confirm(
      `Czy na pewno chcesz bezpowrotnie usunąć konto zawodnika "${athlete.username}"?\nUsunięte zostaną również jego treningi i wpisy na Timeline.`
    );
    if (!confirmed) return;

    // 1. Usunięcie profilu z bazy
    const { error: profileErr } = await supabase
      .from("athlete_profiles")
      .delete()
      .eq("id", athlete.id);

    if (profileErr) {
      alert("Błąd podczas usuwania konta: " + profileErr.message);
      return;
    }

    // 2. Kaskadowe czyszczenie powiązanych treningów i zgłoszeń
    await supabase.from("workouts").delete().eq("author_username", athlete.username);
    await supabase.from("progress_submissions").delete().eq("athlete_name", athlete.username);

    setAllAthletes((prev) => prev.filter((a) => a.id !== athlete.id));
    alert(`Konto zawodnika "${athlete.username}" zostało pomyślnie usunięte.`);
  };

  const handleLogout = () => {
    localStorage.removeItem("goat_athlete_profile");
    router.push("/");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center text-sm animate-pulse">
        Ładowanie profilu zawodnika...
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-neutral-900/90 border border-neutral-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-3xl mx-auto">
            👤
          </div>
          <h1 className="text-2xl font-black text-white">Profil niedostępny</h1>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Musisz być zalogowany, aby przeglądać statystyki i archiwum swojego profilu.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
            >
              ← Przejdź do logowania
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const coachFeedbackCount = comments.filter((c) => c.author_role === "coach").length;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Nawigacja powrotu */}
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4 select-none">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-emerald-400 transition-colors"
          >
            <span>←</span>
            <span>Wróć do bazy treningowej</span>
          </Link>

          <Link
            href="/timeline"
            className="text-xs text-neutral-400 hover:text-emerald-400 transition-colors"
          >
            🎬 Otwórz Timeline →
          </Link>
        </div>

        {/* Karta Główna Profilu */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl font-black text-emerald-400 shadow-lg">
              {currentUser.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl md:text-3xl font-black text-white">{currentUser.username}</h1>
                <span
                  className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full border ${
                    currentUser.role === "coach"
                      ? "bg-red-950/80 text-red-400 border-red-800"
                      : "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                  }`}
                >
                  {currentUser.role === "coach" ? "Trener / Admin" : "Zawodnik Kadry"}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">Status: Aktywny członek ROAD TO GOAT</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleToggleCoach}
              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-300 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              {currentUser.role === "coach" ? "🔒 Wyłącz Trenera" : "🔑 Zaloguj Trenera"}
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 text-red-400 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              Wyloguj się
            </button>
          </div>
        </div>

        {/* Mini Statystyki */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-5">
            <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider block mb-1">
              🏋️ Moje Treningi
            </span>
            <span className="text-3xl font-black font-mono text-emerald-400">{workouts.length}</span>
          </div>

          <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-5">
            <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider block mb-1">
              🎬 Nagrania w Timeline
            </span>
            <span className="text-3xl font-black font-mono text-emerald-400">{submissions.length}</span>
          </div>

          <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-5">
            <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider block mb-1">
              🎯 Feedback od Trenera
            </span>
            <span className="text-3xl font-black font-mono text-emerald-400">{coachFeedbackCount}</span>
          </div>
        </div>

        {/* PANEL ADMINA: ZARZĄDZANIE KONTAMI ZAWODNIKÓW (TYLKO DLA TRENERA) */}
        {currentUser.role === "coach" && (
          <div className="bg-neutral-900/70 border border-red-900/40 rounded-3xl p-6 md:p-8 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>👥</span> Panel Trenera: Zarządzanie Zawodnikami
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Możesz usuwać nieaktywne lub testowe konta. Usunięcie profilu wyczyści także jego wpisy i treningi.
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-neutral-950 border border-neutral-800 text-neutral-300 px-3 py-1 rounded-xl">
                Konta: {allAthletes.length}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {allAthletes.map((athlete) => {
                const isSelf = athlete.username === currentUser.username;
                return (
                  <div
                    key={athlete.id}
                    className="flex items-center justify-between p-3.5 bg-neutral-950/80 border border-neutral-800/80 rounded-2xl text-xs transition-colors hover:border-neutral-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-neutral-200">
                        {athlete.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{athlete.username}</span>
                          {isSelf && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md font-semibold">
                              Ty
                            </span>
                          )}
                          <span className="text-[10px] text-neutral-500 uppercase font-mono">
                            {athlete.role === "coach" ? "Trener" : "Zawodnik"}
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-500">
                          Dołączył(a): {new Date(athlete.created_at).toLocaleDateString("pl-PL")}
                        </span>
                      </div>
                    </div>

                    {!isSelf && (
                      <button
                        onClick={() => handleDeleteAthlete(athlete)}
                        className="bg-red-950/40 hover:bg-red-900/70 border border-red-900/60 text-red-400 hover:text-red-200 px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span>🗑️</span>
                        <span>Usuń konto</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sekcja: Moje Plany Treningowe */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📋</span> Moje Skomponowane Treningi ({workouts.length})
            </h2>
            <Link href="/" className="text-xs text-emerald-400 hover:underline">
              + Nowy trening na stronie głównej
            </Link>
          </div>

          {workouts.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-neutral-800 rounded-3xl text-neutral-500 text-xs">
              Nie masz jeszcze skomponowanego żadnego treningu.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workouts.map((wo) => (
                <div
                  key={wo.id}
                  className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 space-y-3"
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
                    <h3 className="font-bold text-white text-base">{wo.title}</h3>
                    <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{wo.description}</p>
                  </div>

                  <Link
                    href="/"
                    className="inline-block w-full text-center bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-emerald-400 text-xs py-2 rounded-xl transition-colors font-semibold"
                  >
                    Przejdź do bazy, aby odpalić w Trybie Sali →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sekcja: Moje Nagrania & Wskazówki */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📹</span> Moje Nagrania i Wskazówki Trenerskie ({submissions.length})
          </h2>

          {submissions.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-neutral-800 rounded-3xl text-neutral-500 text-xs">
              Nie dodałeś jeszcze żadnych nagrań na Timeline.
            </div>
          ) : (
            <div className="space-y-6">
              {submissions.map((sub) => {
                const subComments = comments.filter((c) => c.submission_id === sub.id);

                return (
                  <div
                    key={sub.id}
                    className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-5 md:p-6 space-y-4 shadow-xl"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-neutral-800 text-emerald-400 border border-neutral-700">
                        🎯 {sub.exercise_title}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {new Date(sub.created_at).toLocaleDateString("pl-PL")}
                      </span>
                    </div>

                    {sub.video_url && (
                      <div className="rounded-2xl overflow-hidden aspect-video bg-neutral-950 border border-neutral-800">
                        <iframe
                          src={sub.video_url}
                          title={sub.exercise_title}
                          className="w-full h-full"
                          allowFullScreen
                        />
                      </div>
                    )}

                    {sub.notes && (
                      <p className="text-neutral-300 text-xs bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800/80 leading-relaxed">
                        💬 <strong className="text-neutral-200">Twój komentarz:</strong> {sub.notes}
                      </p>
                    )}

                    {subComments.length > 0 && (
                      <div className="border-t border-neutral-800/80 pt-3 space-y-2">
                        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                          Otrzymany feedback ({subComments.length}):
                        </p>
                        <div className="space-y-1.5">
                          {subComments.map((com) => (
                            <div
                              key={com.id}
                              className={`p-3 rounded-xl text-xs space-y-1 border ${
                                com.author_role === "coach"
                                  ? "bg-emerald-950/30 border-emerald-500/40 text-neutral-200"
                                  : "bg-neutral-950/60 border-neutral-800/80 text-neutral-300"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{com.author_name}</span>
                                {com.author_role === "coach" && (
                                  <span className="text-[9px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded-md">
                                    Wskazówka Trenera
                                  </span>
                                )}
                              </div>
                              <p className="leading-relaxed">{com.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}