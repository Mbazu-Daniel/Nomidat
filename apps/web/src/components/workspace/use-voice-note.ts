import { useEffect, useRef, useState } from "react";
import { createApiRequest } from "@/lib/api";
import type { VoiceNoteOptions } from "./types/chat-picture.type";

export function useVoiceNote({ path, setText, setError, setBusy }: VoiceNoteOptions) {
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [path]);
  async function startRecording() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Voice recording is unavailable in this browser. You can still type your message.",
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const next = new MediaRecorder(media);
      recorder.current = next;
      const chunks: Blob[] = [];
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      next.onstop = async () => {
        media.getTracks().forEach((track) => track.stop());
        if (timer.current) clearTimeout(timer.current);
        if (!mounted.current) return;
        setRecording(false);
        setBusy(true);
        try {
          const blob = new Blob(chunks, { type: next.mimeType });
          if (!blob.size || blob.size > 10 * 1024 * 1024)
            throw new Error(
              "Recording must be between 1 byte and 10 MB. Please try a shorter note.",
            );
          const form = new FormData();
          form.append("audio", blob, "voice.webm");
          const result = await createApiRequest<{ text: string }>(path + "/voice", {
            method: "POST",
            body: form,
          });
          if (mounted.current) setText(result.text);
        } catch (reason) {
          if (mounted.current) setError((reason as Error).message);
        } finally {
          if (mounted.current) setBusy(false);
        }
      };
      next.start();
      setRecording(true);
      timer.current = setTimeout(() => {
        if (next.state === "recording") next.stop();
      }, 60_000);
    } catch (reason) {
      stream.current?.getTracks().forEach((track) => track.stop());
      setError((reason as Error).message);
    }
  }
  return { recording, startRecording, stopRecording: () => recorder.current?.stop() };
}
