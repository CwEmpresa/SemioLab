"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Conversa por voz em tempo real com o paciente (OpenAI Realtime via
 * WebRTC). O navegador fala direto com o modelo: a resposta começa ~1 s
 * depois que o aluno para de falar, sem as etapas de transcrever → responder
 * → gerar voz. O servidor só entrega a chave temporária da ligação
 * (/api/patient/realtime) e salva cada troca (/api/patient/realtime/turn). */

export type RealtimeState = "idle" | "connecting" | "listening" | "userSpeaking" | "thinking" | "speaking";

export type TurnSaved = { messageId: string | null; questionsUsed: number; questionsLimit: number; limitReached: boolean };

type Callbacks = {
  /** Aluno terminou uma fala (a transcrição ainda vai chegar). */
  onStudentStart: (key: string) => void;
  /** Transcrição da fala do aluno ("" = só ruído). */
  onStudentText: (key: string, text: string) => void;
  /** Texto do paciente sendo falado (acumulado). */
  onPatientText: (key: string, text: string, done: boolean) => void;
  onTurnSaved: (key: string, saved: TurnSaved) => void;
  onError: (message: string) => void;
  onEnded: (reason: "user" | "limit" | "idle" | "error") => void;
};

type Turn = {
  itemId: string;
  student: string | null; // null = transcrição ainda não chegou
  responseId: string | null;
  patient: string;
  responseDone: boolean;
  usage: unknown[];
  saved: boolean;
};

const IDLE_HANGUP_MS = 3 * 60_000;

export function useRealtimeVoice(sessionId: string | null, doctorTitle: string | null, callbacks: Callbacks) {
  const [state, setState] = useState<RealtimeState>("idle");
  const cb = useRef(callbacks);
  useEffect(() => {
    cb.current = callbacks;
  });
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const stateRef = useRef<RealtimeState>("idle");
  const idleTimerRef = useRef<number | null>(null);
  const speechStoppedAtRef = useRef<number>(0);
  const sessionRef = useRef(sessionId);
  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);

  const setBoth = (next: RealtimeState) => {
    stateRef.current = next;
    setState(next);
  };

  const teardown = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }
    turnsRef.current = [];
    setBoth("idle");
  }, []);

  const stop = useCallback(
    (reason: "user" | "limit" | "idle" | "error" = "user") => {
      if (!pcRef.current && stateRef.current === "idle") return;
      teardown();
      cb.current.onEnded(reason);
    },
    [teardown],
  );

  const armIdle = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => stop("idle"), IDLE_HANGUP_MS);
  }, [stop]);

  async function saveTurn(turn: Turn) {
    if (turn.saved || turn.student === null || !turn.responseDone) return;
    turn.saved = true;
    const sid = sessionRef.current;
    if (!sid) return;
    const student = turn.student.trim();
    // Ruído sem fala real: não conta pergunta nem salva bolha, só o custo.
    const patient = student ? turn.patient.trim() : "";
    if (!student && !patient && turn.usage.length === 0) return;
    try {
      const res = await fetch("/api/patient/realtime/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sid, student, patient, usage: turn.usage }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<TurnSaved>;
      if (!res.ok) return;
      const saved: TurnSaved = {
        messageId: data.messageId ?? null,
        questionsUsed: data.questionsUsed ?? 0,
        questionsLimit: data.questionsLimit ?? 20,
        limitReached: Boolean(data.limitReached),
      };
      if (student) cb.current.onTurnSaved(turn.itemId, saved);
      if (saved.limitReached) {
        // Deixa a última resposta terminar de tocar antes de desligar.
        window.setTimeout(() => stop("limit"), 2500);
      }
    } catch {}
  }

  function handleEvent(ev: { type: string; [k: string]: unknown }) {
    const turns = turnsRef.current;
    switch (ev.type) {
      case "input_audio_buffer.speech_started":
        armIdle();
        setBoth("userSpeaking");
        break;
      case "input_audio_buffer.speech_stopped":
        speechStoppedAtRef.current = performance.now();
        setBoth("thinking");
        break;
      case "input_audio_buffer.committed": {
        const itemId = String(ev.item_id ?? "");
        if (!itemId) break;
        turns.push({ itemId, student: null, responseId: null, patient: "", responseDone: false, usage: [], saved: false });
        cb.current.onStudentStart(itemId);
        break;
      }
      case "conversation.item.input_audio_transcription.completed":
      case "conversation.item.input_audio_transcription.failed": {
        const turn = turns.find((t) => t.itemId === ev.item_id);
        if (!turn) break;
        turn.student = ev.type.endsWith("completed") ? String(ev.transcript ?? "").trim() : "";
        cb.current.onStudentText(turn.itemId, turn.student);
        void saveTurn(turn);
        break;
      }
      case "response.created": {
        const id = String((ev.response as { id?: string } | undefined)?.id ?? "");
        const turn = [...turns].reverse().find((t) => !t.responseId);
        if (turn && id) turn.responseId = id;
        break;
      }
      case "response.output_audio_transcript.delta": {
        const turn = turns.find((t) => t.responseId === ev.response_id);
        if (!turn) break;
        turn.patient += String(ev.delta ?? "");
        cb.current.onPatientText(turn.itemId, turn.patient, false);
        break;
      }
      case "output_audio_buffer.started":
        if (speechStoppedAtRef.current) {
          console.info("[voz] espera até o paciente começar a falar:", Math.round(performance.now() - speechStoppedAtRef.current), "ms");
          speechStoppedAtRef.current = 0;
        }
        setBoth("speaking");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        if (stateRef.current === "speaking") setBoth("listening");
        armIdle();
        break;
      case "response.done": {
        const response = ev.response as { id?: string; usage?: unknown; output?: Array<{ content?: Array<{ transcript?: string }> }> } | undefined;
        const turn = turns.find((t) => t.responseId === response?.id);
        if (!turn) break;
        const finalText = response?.output?.flatMap((o) => o.content ?? []).map((c) => c.transcript ?? "").join(" ").trim();
        if (finalText) turn.patient = finalText;
        if (response?.usage) turn.usage.push(response.usage);
        turn.responseDone = true;
        cb.current.onPatientText(turn.itemId, turn.patient, true);
        if (stateRef.current === "thinking") setBoth("listening");
        void saveTurn(turn);
        break;
      }
      case "error": {
        const err = ev.error as { message?: string; code?: string } | undefined;
        console.error("[voz] erro da ligação", err?.code, err?.message);
        break;
      }
    }
  }

  const start = useCallback(async () => {
    if (!sessionRef.current || pcRef.current) return;
    setBoth("connecting");
    // O elemento de áudio é criado dentro do toque do aluno (exigência de
    // reprodução automática no iPhone).
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    audio.style.display = "none";
    document.body.appendChild(audio);
    audioRef.current = audio;
    try {
      // Microfone e chave da ligação em paralelo.
      const [mic, tokenRes] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }),
        fetch("/api/patient/realtime", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: sessionRef.current, doctorTitle }),
        }),
      ]);
      micRef.current = mic;
      const token = (await tokenRes.json().catch(() => ({}))) as { clientSecret?: string; error?: string; limitReached?: boolean };
      if (!tokenRes.ok || !token.clientSecret) {
        teardown();
        cb.current.onError(token.error || "Não foi possível iniciar a conversa por voz.");
        cb.current.onEnded(token.limitReached ? "limit" : "error");
        return;
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0];
        void audio.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          if (pcRef.current === pc) {
            cb.current.onError("A conversa por voz caiu. Toque no microfone para retomar.");
            stop("error");
          }
        }
      };
      mic.getTracks().forEach((track) => pc.addTrack(track, mic));
      const dc = pc.createDataChannel("oai-events");
      dc.onmessage = (msg) => {
        try {
          handleEvent(JSON.parse(msg.data));
        } catch {}
      };
      dc.onopen = () => {
        setBoth("listening");
        armIdle();
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${token.clientSecret}`, "Content-Type": "application/sdp" },
      });
      if (!sdpRes.ok) throw new Error(`sdp ${sdpRes.status}`);
      const answer = await sdpRes.text();
      if (pcRef.current !== pc) return; // desligou enquanto conectava
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      teardown();
      cb.current.onError(denied ? "Não foi possível acessar o microfone. Verifique a permissão do navegador." : "Não foi possível iniciar a conversa por voz agora.");
      cb.current.onEnded("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorTitle, teardown, stop, armIdle]);

  // Desliga ao sair da tela.
  useEffect(() => () => teardown(), [teardown]);

  return { state, start, stop, active: state !== "idle" };
}
