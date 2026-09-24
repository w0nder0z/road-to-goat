"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ExerciseDetail {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  short_description: string;
  description: string;
  joints: string[];
  muscles: string[];
  video_url: string;
  prerequisite_ids?: string[];
}

interface MiniExercise {
  id: string;
  title: string;
  difficulty: string;
}

export default function ExerciseDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [prerequisites, setPrerequisites] = useState<MiniExercise[]>([]);
  const [unlockedTricks, setUnlockedTricks] = useState<MiniExercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchDetailAndTree = async () => {
      setLoading(true);

      // 1. Pobierz dane bieżącego ćwiczenia
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

      // 2. Pobierz Wymagania wstępne (Prerequisites)
      if (currentEx.prerequisite_ids && currentEx.prerequisite_ids.length > 0) {
        const { data: prereqData } = await supabase
          .from("exercises")
          .select("id, title, difficulty")
          .in("id", currentEx.prerequisite_ids);

        if (prereqData) setPrerequisites(prereqData);
      } else {
        setPrerequisites([]);
      }

      // 3. Pobierz Odblokowywane tricki (Co ten trick odblokowuje dalej w drzewku)
      const { data: unlockedData } = await supabase
        .from("exercises")
        .select("id, title, difficulty")
        .contains("prerequisite_ids", [id]);

      if (unlockedData) {
        setUnlockedTricks(unlockedData);
      }

      setLoading(false);
    };

    fetchDetailAndTree();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center text-sm animate-pulse">
        Budowanie drzewka progresji...
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8 flex flex-col items-center justify-center">
        <p className="text-neutral-400 mb-4">Nie znaleziono takiego ćwiczenia.</p>
        <Link
          href="/"
          className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold underline"
        >
          ← Wróć do bazy
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Nawigacja powrotu */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-emerald-400 transition-colors select-none"
        >
          <span>←</span>
          <span>Wróć do bazy</span>
        </Link>

        {/* Główna karta ćwiczenia */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3 mb-4 select-none">
            <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-neutral-800 text-emerald-400 border border-neutral-700">
              {exercise.category}
            </span>
            <span className="text-xs text-neutral-400 bg-neutral-950 px-3 py-1 rounded-lg border border-neutral-800">
              {exercise.difficulty}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
            {exercise.title}
          </h1>

          {exercise.short_description && (
            <p className="text-emerald-400/90 text-sm md:text-base font-medium mb-6">
              {exercise.short_description}
            </p>
          )}

          {/* Odtwarzacz wideo lub link źródłowy */}
          {exercise.video_url && (
            <div className="mb-6">
              {exercise.video_url.includes("youtube.com/embed") ? (
                <div className="rounded-2xl overflow-hidden aspect-video bg-neutral-950 border border-neutral-800 shadow-2xl">
                  <iframe
                    src={exercise.video_url}
                    title={exercise.title}
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              ) : (
                <a
                  href={exercise.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-4 bg-neutral-950/80 border border-neutral-800 hover:border-emerald-500/50 rounded-2xl text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <span>🔗 Otwórz materiał źródłowy w nowej karcie</span>
                </a>
              )}
            </div>
          )}

          {/* Wskazówki trenerskie */}
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

          {/* Tagi anatomiczne */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-neutral-800/60">
            <div>
              <p className="text-xs text-neutral-400 mb-2 font-medium">
                Kluczowe stawy:
              </p>
              <div className="flex flex-wrap gap-1.5 select-none">
                {exercise.joints && exercise.joints.length > 0 ? (
                  exercise.joints.map((joint) => (
                    <span
                      key={joint}
                      className="text-xs bg-neutral-800 text-neutral-200 px-2.5 py-1 rounded-lg border border-neutral-700"
                    >
                      🦴 {joint}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-500">Brak przypisanych stawów</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs text-neutral-400 mb-2 font-medium">
                Główne mięśnie i ścięgna:
              </p>
              <div className="flex flex-wrap gap-1.5 select-none">
                {exercise.muscles && exercise.muscles.length > 0 ? (
                  exercise.muscles.map((muscle) => (
                    <span
                      key={muscle}
                      className="text-xs bg-emerald-950/40 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-900/50"
                    >
                      ⚡ {muscle}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-500">Brak przypisanych mięśni</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* DRZEWKO PROGRESJI: Skill Tree Card */}
        <div className="bg-neutral-900/50 border border-neutral-800/90 rounded-3xl p-6 md:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🌳</span> Drzewko Progresji (Skill Tree)
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Hierarchia i zależności ruchowe w metodyce nauczania.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Wymagania wstępne */}
            <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Wymagane fundamenty (Prerequisites)
                </h3>
              </div>

              {prerequisites.length === 0 ? (
                <p className="text-xs text-neutral-500 italic py-2">
                  Brak wymagań wstępnych – ten ruch to element bazowy (Level 1 / Fundament).
                </p>
              ) : (
                <div className="space-y-2">
                  {prerequisites.map((p) => (
                    <Link
                      key={p.id}
                      href={`/exercise/${p.id}`}
                      className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 hover:border-amber-400/50 rounded-xl text-xs transition-colors group"
                    >
                      <span className="font-semibold text-neutral-200 group-hover:text-amber-300">
                        🔒 {p.title}
                      </span>
                      <span className="text-[10px] text-neutral-500 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                        {p.difficulty}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Co odblokowuje dalej */}
            <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Co odblokowuje (Next Steps)
                </h3>
              </div>

              {unlockedTricks.length === 0 ? (
                <p className="text-xs text-neutral-500 italic py-2">
                  Ten element jest obecnie na szczycie gałęzi progresji lub kolejne tricki nie zostały jeszcze zlinkowane.
                </p>
              ) : (
                <div className="space-y-2">
                  {unlockedTricks.map((u) => (
                    <Link
                      key={u.id}
                      href={`/exercise/${u.id}`}
                      className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 rounded-xl text-xs transition-colors group"
                    >
                      <span className="font-semibold text-neutral-200 group-hover:text-emerald-300">
                        🔓 {u.title}
                      </span>
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

        {/* Sekcja Progresu Użytkowników */}
        <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                Nasz progres & Próby zawodników
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Wrzucaj nagrania swoich powtórzeń, analizuj technikę i zbieraj feedback.
              </p>
            </div>
            <button className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium px-3.5 py-2 rounded-xl border border-neutral-700 transition-colors cursor-pointer">
              + Dodaj wideo próby
            </button>
          </div>

          <div className="p-8 text-center border border-dashed border-neutral-800 rounded-2xl text-neutral-500 text-sm">
            Brak dodanych nagrań dla tego elementu. Bądź pierwszym, który wrzuci swoją próbę!
          </div>
        </div>
      </div>
    </main>
  );
}