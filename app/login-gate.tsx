"use client";

import { useRouter } from "next/navigation";
import { SignIn1 } from "@/components/ui/modern-stunning-sign-in";

export default function LoginGate() {
  const router = useRouter();
  return <SignIn1 onSignIn={() => router.refresh()} />;
}
