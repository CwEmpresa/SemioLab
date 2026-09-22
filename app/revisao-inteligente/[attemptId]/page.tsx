import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildSmartReview } from "@/lib/smart-review";
import { SmartReviewUnavailable, SmartReviewView } from "./smart-review-view";
import "./smart-review.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Revisão Inteligente · SemioLab" };

export default async function SmartReviewPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // A tentativa é sempre carregada pelo usuário da sessão — trocar o
  // attemptId na URL por um de outra pessoa resulta em "não encontrada".
  const result = await buildSmartReview(attemptId, user);
  if (result.status !== "ready") return <SmartReviewUnavailable kind={result.status} />;
  return <SmartReviewView review={result.review} />;
}
