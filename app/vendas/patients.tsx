/* Pacientes reais do banco de casos (data/patient-cases/pilot-50.json):
   nome, idade e queixa como aparecem no app. O diagnóstico fica de fora,
   de propósito. As falas são a abertura do atendimento em linguagem
   leiga, e a arte é gráfica até existirem ilustrações dos pacientes. */

type Sign = "ecg" | "ecg-fast" | "resp" | "fever" | "neuro" | "rise";

const PATIENTS: {
  name: string;
  age: number;
  complaint: string;
  area: string;
  quote: string;
  sign: Sign;
  art: string;
}[] = [
  {
    name: "Marta",
    age: 68,
    complaint: "Dispneia e inchaço nas pernas",
    area: "Cardiologia",
    quote: "Deitada o ar não vem. Tenho que dormir sentada.",
    sign: "ecg",
    art: "linear-gradient(165deg,#8b5cf6,#3b0764 78%)",
  },
  {
    name: "Roberto",
    age: 57,
    complaint: "Dor no peito súbita",
    area: "Cardiologia",
    quote: "É um aperto que vai pro braço. Começou faz uma hora.",
    sign: "ecg-fast",
    art: "linear-gradient(165deg,#fb923c,#7c2d12 80%)",
  },
  {
    name: "Larissa",
    age: 22,
    complaint: "Chiado no peito e falta de ar",
    area: "Respiratório",
    quote: "A bombinha não tá resolvendo como antes.",
    sign: "resp",
    art: "linear-gradient(165deg,#38bdf8,#1e3a8a 80%)",
  },
  {
    name: "Vinícius",
    age: 20,
    complaint: "Dor de barriga que mudou de lugar",
    area: "Gastro",
    quote: "Começou no umbigo. Agora dói aqui embaixo, do lado direito.",
    sign: "fever",
    art: "linear-gradient(165deg,#f472b6,#831843 80%)",
  },
  {
    name: "Beatriz",
    age: 19,
    complaint: "Dor de cabeça forte com febre",
    area: "Neurologia",
    quote: "A luz incomoda muito. E o pescoço tá travado.",
    sign: "neuro",
    art: "linear-gradient(165deg,#facc15,#713f12 80%)",
  },
  {
    name: "Antônio",
    age: 71,
    complaint: "Fraqueza súbita de um lado do corpo",
    area: "Neurologia",
    quote: "Acordei e o braço direito não obedecia.",
    sign: "neuro",
    art: "linear-gradient(165deg,#2dd4bf,#134e4a 80%)",
  },
  {
    name: "Camila",
    age: 17,
    complaint: "Muita sede, urina frequente, mal-estar",
    area: "Endocrinologia",
    quote: "Bebo água o dia inteiro e continuo com sede.",
    sign: "rise",
    art: "linear-gradient(165deg,#a3e635,#365314 80%)",
  },
  {
    name: "Lucas",
    age: 26,
    complaint: "Febre alta, dor no corpo, manchas",
    area: "Infectologia",
    quote: "Dói atrás dos olhos. E apareceram umas manchas.",
    sign: "fever",
    art: "linear-gradient(165deg,#fb7185,#881337 80%)",
  },
];

function signPath(sign: Sign) {
  const w = 300;
  let d = "";
  if (sign === "ecg" || sign === "ecg-fast") {
    const beat = sign === "ecg" ? 75 : 50;
    d = "M0 40";
    for (let x = 0; x < w; x += beat) {
      d += ` L${x + beat * 0.2} 40 Q${x + beat * 0.26} 33 ${x + beat * 0.32} 40 L${x + beat * 0.38} 40 L${x + beat * 0.41} 46 L${x + beat * 0.45} 6 L${x + beat * 0.49} 58 L${x + beat * 0.52} 40 L${x + beat * 0.64} 40 Q${x + beat * 0.74} 28 ${x + beat * 0.84} 40 L${x + beat} 40`;
    }
  } else if (sign === "resp") {
    d = "M0 40";
    for (let x = 0; x <= w; x += 6) {
      const y = 40 - Math.sin(x / 22) * 20 + (Math.sin(x / 22) < 0 ? Math.sin(x * 1.3) * 4 : 0);
      d += ` L${x} ${y.toFixed(1)}`;
    }
  } else if (sign === "fever") {
    d = "M0 52 C 40 50, 50 20, 80 24 S 120 50, 150 40 S 200 8, 230 14 S 270 30, 300 22";
  } else if (sign === "neuro") {
    d = "M0 40";
    for (let x = 0; x <= w; x += 5) {
      const y = 40 + Math.sin(x / 7) * 7 + Math.sin(x / 2.3) * 5 + (x > 150 && x < 190 ? Math.sin(x) * 16 : 0);
      d += ` L${x} ${y.toFixed(1)}`;
    }
  } else {
    d = "M0 60 C 60 58, 90 52, 130 44 S 200 30, 230 20 S 280 8, 300 6";
  }
  return d;
}

export default function Patients() {
  return (
    <ul className="sx-patients" aria-label="Pacientes do SemioLab">
      {PATIENTS.map((p) => (
        <li key={p.name} className="sx-patient">
          <div className="sx-patient-art" style={{ ["--art" as string]: p.art }}>
            <span className="sx-patient-initial" aria-hidden="true">
              {p.name[0]}
            </span>
            <div className="sx-patient-sign" aria-hidden="true">
              <small>
                <i />
                {p.area}
              </small>
              <svg viewBox="0 0 300 70" preserveAspectRatio="none">
                <path d={signPath(p.sign)} />
              </svg>
            </div>
            <blockquote className="sx-patient-quote">“{p.quote}”</blockquote>
          </div>
          <h3>
            {p.name}, {p.age}
          </h3>
          <p>{p.complaint}</p>
        </li>
      ))}
    </ul>
  );
}
