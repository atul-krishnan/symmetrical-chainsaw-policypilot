import type { QuizQuestion } from "@/lib/types";

export type QuizGradeResult = {
  scorePct: number;
  passed: boolean;
  details: Array<{
    questionId: string;
    isCorrect: boolean;
    expected: number;
    received: number;
  }>;
};

export function gradeQuiz(
  questions: Pick<QuizQuestion, "id" | "correctChoiceIndex">[],
  answers: number[],
  passScore: number,
): QuizGradeResult {
  const safeAnswers = answers.slice(0, questions.length);
  const details = questions.map((question, index) => {
    const received = safeAnswers[index] ?? -1;
    const isCorrect = question.correctChoiceIndex === received;

    return {
      questionId: question.id,
      isCorrect,
      expected: question.correctChoiceIndex,
      received,
    };
  });

  const correct = details.filter((item) => item.isCorrect).length;
  const scorePct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

  return {
    scorePct,
    passed: scorePct >= passScore,
    details,
  };
}
