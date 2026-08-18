import { z } from "zod";

export const ExamFindingSchema = z.object({
  examIds: z.array(z.string()).min(1),
  name: z.string(),
  result: z.string(),
  type: z.enum(["lab", "imaging"]),
});

export const HiddenCaseSchema = z.object({
  persona: z.object({
    name: z.string(),
    age: z.number().int().positive(),
    sex: z.string(),
    tone: z.string(),
  }),
  diagnosis: z.string(),
  differentials: z.array(z.string()).min(1),
  history: z.record(z.string(), z.string()),
  physicalExam: z.record(z.string(), z.string()),
  exams: z.array(ExamFindingSchema).default([]),
  idealConduct: z.array(z.string()).min(1),
  keyQuestions: z.array(z.string()).min(1),
});

export const PatientCaseSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  specialty: z.string().min(1),
  difficulty: z.enum(["facil", "moderado", "dificil"]),
  openingLine: z.string().min(1),
  receptionReason: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  hiddenCase: HiddenCaseSchema,
});

export const PatientCaseBatchSchema = z.array(PatientCaseSchema);

export type ExamFinding = z.infer<typeof ExamFindingSchema>;
export type HiddenCase = z.infer<typeof HiddenCaseSchema>;
export type PatientCaseInput = z.infer<typeof PatientCaseSchema>;
