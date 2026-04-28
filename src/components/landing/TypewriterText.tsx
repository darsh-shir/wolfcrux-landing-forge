import { useEffect, useState } from "react";

interface Props {
  words: string[];
  typingSpeed?: number; // ms per char
  deletingSpeed?: number;
  pauseTime?: number; // hold full word
  className?: string;
}

const TypewriterText = ({
  words,
  typingSpeed = 90,
  deletingSpeed = 45,
  pauseTime = 1500,
  className = "",
}: Props) => {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = words[idx % words.length];
    let timeout: number;

    if (!deleting && text === current) {
      timeout = window.setTimeout(() => setDeleting(true), pauseTime);
    } else if (deleting && text === "") {
      setDeleting(false);
      setIdx((i) => (i + 1) % words.length);
    } else {
      timeout = window.setTimeout(
        () => {
          setText((t) =>
            deleting ? t.slice(0, -1) : current.slice(0, t.length + 1)
          );
        },
        deleting ? deletingSpeed : typingSpeed
      );
    }
    return () => clearTimeout(timeout);
  }, [text, deleting, idx, words, typingSpeed, deletingSpeed, pauseTime]);

  return (
    <span className={className}>
      {text}
      <span className="inline-block w-[2px] h-[1em] align-middle bg-accent ml-1 animate-pulse" />
    </span>
  );
};

export default TypewriterText;
