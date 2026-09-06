"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { AnswerLane, type LaneAnswer } from "./answer-lane";

export type ThreadTurn = {
  readonly id: string;
  readonly prompt: string;
  readonly answers: readonly LaneAnswer[];
};

/**
 * The conversation so far, one row of lanes per turn.
 *
 * When every lane in a turn has settled the page asks the server for its own
 * view of the rows. Until then the text on screen lives only in the browser;
 * after it, the copy shown is the one that was actually written down, so a
 * reload shows the same answer rather than an empty lane.
 */
export const ThreadView = ({ turns }: { readonly turns: readonly ThreadTurn[] }) => {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  return (
    <div className="flex flex-col gap-8">
      {turns.map((turn) => (
        <section key={turn.id} className="flex flex-col gap-3">
          <div className="flex justify-end">
            <p className="border-subtle bg-raised max-w-[48ch] rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap">
              {turn.prompt}
            </p>
          </div>

          {/* Lanes scroll sideways rather than stacking on a narrow screen.
              Stacking would put each model's numbers on its own row and destroy
              the shared baseline, which is the whole point of the layout. */}
          <div className="border-subtle overflow-x-auto rounded-lg border">
            <div
              className="divide-subtle grid divide-x"
              style={{
                gridTemplateColumns: `repeat(${turn.answers.length}, minmax(16rem, 1fr))`,
              }}
            >
              {turn.answers.map((answer) => (
                <AnswerLane key={answer.id} answer={answer} onSettled={refresh} />
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
};
