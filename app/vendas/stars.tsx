const STAR = "M12 2.4l2.95 6.2 6.8.82-5.02 4.68 1.3 6.73L12 17.5l-6.03 3.33 1.3-6.73L2.25 9.42l6.8-.82L12 2.4z";

/** Cinco estrelas douradas com brilho em cima e tom queimado embaixo,
 * como as de loja de aplicativos. */
export default function Stars({ label }: { label?: string }) {
  return (
    <span className="ap-stars" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="ap-star-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe58a" />
            <stop offset="0.45" stopColor="#ffc53d" />
            <stop offset="1" stopColor="#e8930c" />
          </linearGradient>
        </defs>
      </svg>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
          <path fill="url(#ap-star-gold)" stroke="#c97a06" strokeWidth="0.6" strokeLinejoin="round" d={STAR} />
        </svg>
      ))}
    </span>
  );
}
