import { describe, expect, it } from "vitest";

import { gradeQuiz } from "@/lib/edtech/quiz-grader";

describe("gradeQuiz", () => {
  it("computes score and pass/fail correctly", () => {
    const result = gradeQuiz(
      [
        { id: "q1", correctChoiceIndex: 0 },
        { id: "q2", correctChoiceIndex: 1 },
        { id: "q3", correctChoiceIndex: 2 },
      ],
      [0, 1, 0],
      80,
    );

    expect(result.scorePct).toBe(67);
    expect(result.passed).toBe(false);
    expect(result.details[2]?.isCorrect).toBe(false);
  });
});
