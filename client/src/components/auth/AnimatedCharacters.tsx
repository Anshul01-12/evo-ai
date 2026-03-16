import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";

export type CharacterMood =
  | "idle"
  | "looking"
  | "tracking"
  | "curious"
  | "sad"
  | "happy";

interface Props {
  mood: CharacterMood;
  mouseX: number;
  mouseY: number;
}

function useBlink(base = 3000) {
  const [b, setB] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      setB(true);
      setTimeout(() => setB(false), 120);
    }, base + Math.random() * 2000);
    return () => clearInterval(id);
  }, [base]);
  return b;
}

/* ── Eye component with larger pupil movement ── */
function CharEye({
  cx,
  cy,
  rx,
  ry,
  pupilR,
  eyeTarget,
  closed,
  fill = "#1a1a2e",
  happyArc,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  pupilR: number;
  eyeTarget: { x: number; y: number };
  closed: boolean;
  fill?: string;
  happyArc?: boolean;
}) {
  if (happyArc) {
    return (
      <motion.path
        d={`M${cx - rx},${cy} Q${cx},${cy - ry * 1.5} ${cx + rx},${cy}`}
        fill="none"
        stroke={fill}
        strokeWidth={2.5}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3 }}
      />
    );
  }
  if (closed) {
    return (
      <line
        x1={cx - rx}
        y1={cy}
        x2={cx + rx}
        y2={cy}
        stroke={fill}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    );
  }
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="white" />
      <motion.circle
        r={pupilR}
        fill={fill}
        animate={{
          cx: cx + eyeTarget.x * 0.7,
          cy: cy + eyeTarget.y * 0.6,
        }}
        transition={{ type: "spring", stiffness: 250, damping: 18 }}
      />
      <motion.circle
        r={pupilR * 0.35}
        fill="white"
        animate={{
          cx: cx + eyeTarget.x * 0.7 + pupilR * 0.3,
          cy: cy + eyeTarget.y * 0.6 - pupilR * 0.3,
        }}
        transition={{ type: "spring", stiffness: 250, damping: 18 }}
      />
    </g>
  );
}

/* ── Orange Character — body leans + head tilts toward mouse ── */
function OrangeChar({
  eyeTarget,
  blink,
  mood,
  mouseX,
  mouseY,
}: {
  eyeTarget: { x: number; y: number };
  blink: boolean;
  mood: CharacterMood;
  mouseX: number;
  mouseY: number;
}) {
  const isHappy = mood === "happy";
  const isSad = mood === "sad";
  const isCovering = mood === "curious";

  // Body lean: tilt toward mouse
  const bodyLean = mood === "idle" ? (mouseX - 0.5) * 8 : mood === "tracking" ? (mouseX - 0.5) * 12 : 0;
  const bodyShiftX = mood === "idle" ? (mouseX - 0.5) * 6 : mood === "tracking" ? (mouseX - 0.5) * 10 : 0;
  const bodyShiftY = mood === "idle" ? (mouseY - 0.5) * 3 : 0;

  return (
    <motion.g
      animate={{
        y: isHappy ? [0, -12, 4, -6, 0] : isSad ? 5 : bodyShiftY,
        x: bodyShiftX,
        rotate: isHappy ? [0, -5, 5, -3, 0] : isSad ? -3 : bodyLean,
      }}
      transition={isHappy ? { duration: 0.6 } : { type: "spring", stiffness: 80, damping: 12 }}
      style={{ originX: "120px", originY: "310px" }}
    >
      {/* Body */}
      <motion.ellipse
        cx={120} cy={260} rx={95} ry={90} fill="#F97316"
        animate={{ scaleY: isHappy ? [1, 0.92, 1.06, 1] : isSad ? 0.96 : 1 }}
        transition={{ duration: 0.5 }}
        style={{ originX: "120px", originY: "350px" }}
      />

      {/* Face group — moves more than body */}
      <motion.g
        animate={{
          x: mood === "idle" ? (mouseX - 0.5) * 4 : mood === "tracking" ? (mouseX - 0.5) * 8 : 0,
          y: mood === "idle" ? (mouseY - 0.5) * 3 : mood === "tracking" ? 3 : isSad ? 4 : 0,
        }}
        transition={{ type: "spring", stiffness: 150, damping: 15 }}
      >
        {!isCovering && (
          <>
            <CharEye cx={95} cy={240} rx={9} ry={10} pupilR={6} eyeTarget={eyeTarget} closed={blink} happyArc={isHappy} />
            <CharEye cx={140} cy={240} rx={9} ry={10} pupilR={6} eyeTarget={eyeTarget} closed={blink} happyArc={isHappy} />
          </>
        )}

        {isCovering && (
          <motion.g
            initial={{ y: 35, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            <ellipse cx={88} cy={240} rx={20} ry={15} fill="#EA580C" />
            <ellipse cx={147} cy={240} rx={20} ry={15} fill="#EA580C" />
            {/* Finger bumps */}
            <circle cx={76} cy={236} r={5} fill="#EA580C" />
            <circle cx={82} cy={232} r={4.5} fill="#EA580C" />
            <circle cx={153} cy={236} r={5} fill="#EA580C" />
            <circle cx={159} cy={232} r={4.5} fill="#EA580C" />
          </motion.g>
        )}

        {/* Mouth */}
        <motion.path
          fill={isHappy ? "#c2410c" : "none"}
          stroke="#1a1a2e"
          strokeWidth={2.5}
          strokeLinecap="round"
          animate={{
            d: isHappy
              ? "M98,268 Q118,292 138,268"
              : isSad
                ? "M102,272 Q118,258 138,272"
                : isCovering
                  ? "M108,265 Q118,272 128,265"
                  : "M100,266 Q118,280 138,266",
          }}
          transition={{ type: "spring", stiffness: 170, damping: 13 }}
        />
      </motion.g>

      {/* Blush */}
      <motion.circle cx={72} cy={260} r={9} fill="#FB923C" opacity={0.5} animate={{ scale: isHappy ? 1.4 : 1 }} />
      <motion.circle cx={163} cy={260} r={9} fill="#FB923C" opacity={0.5} animate={{ scale: isHappy ? 1.4 : 1 }} />
    </motion.g>
  );
}

/* ── Purple Character — tall rect, tilts and leans ── */
function PurpleChar({
  eyeTarget,
  blink,
  mood,
  mouseX,
  mouseY,
}: {
  eyeTarget: { x: number; y: number };
  blink: boolean;
  mood: CharacterMood;
  mouseX: number;
  mouseY: number;
}) {
  const isHappy = mood === "happy";
  const isSad = mood === "sad";
  const isCovering = mood === "curious";

  const tilt = mood === "idle" ? (mouseX - 0.5) * 6 : mood === "tracking" ? (mouseX - 0.5) * 10 : 0;
  const shiftX = mood === "idle" ? (mouseX - 0.5) * 4 : 0;

  return (
    <motion.g
      animate={{
        y: isHappy ? [0, -14, 0] : isSad ? 3 : 0,
        x: shiftX,
        rotate: isHappy ? [0, -4, 6, -2, 0] : isSad ? 2 : tilt,
      }}
      transition={isHappy ? { duration: 0.6 } : { type: "spring", stiffness: 80, damping: 12 }}
      style={{ originX: "120px", originY: "265px" }}
    >
      <rect x={80} y={95} width={80} height={170} rx={12} fill="#7C3AED" />

      {/* Face group */}
      <motion.g
        animate={{
          x: mood === "idle" ? (mouseX - 0.5) * 5 : mood === "tracking" ? (mouseX - 0.5) * 8 : 0,
          y: mood === "idle" ? (mouseY - 0.5) * 3 : isSad ? 3 : 0,
        }}
        transition={{ type: "spring", stiffness: 150, damping: 15 }}
      >
        {!isCovering ? (
          <>
            <CharEye cx={105} cy={175} rx={7} ry={8} pupilR={5} eyeTarget={eyeTarget} closed={blink} fill="#1a1a2e" happyArc={isHappy} />
            <CharEye cx={140} cy={175} rx={7} ry={8} pupilR={5} eyeTarget={eyeTarget} closed={blink} fill="#1a1a2e" happyArc={isHappy} />
          </>
        ) : (
          <motion.g
            initial={{ y: 25, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            <ellipse cx={105} cy={175} rx={16} ry={11} fill="#6D28D9" />
            <ellipse cx={140} cy={175} rx={16} ry={11} fill="#6D28D9" />
          </motion.g>
        )}

        <motion.path
          fill="none"
          stroke="#1a1a2e"
          strokeWidth={2}
          strokeLinecap="round"
          animate={{
            d: isHappy
              ? "M108,202 Q122,218 136,202"
              : isSad
                ? "M112,207 Q122,197 132,207"
                : "M112,200 Q122,210 132,200",
          }}
          transition={{ type: "spring", stiffness: 170 }}
        />
      </motion.g>
    </motion.g>
  );
}

/* ── Black Character — leans and tilts ── */
function BlackChar({
  eyeTarget,
  blink,
  mood,
  mouseX,
  mouseY,
}: {
  eyeTarget: { x: number; y: number };
  blink: boolean;
  mood: CharacterMood;
  mouseX: number;
  mouseY: number;
}) {
  const isHappy = mood === "happy";
  const isSad = mood === "sad";
  const isCovering = mood === "curious";

  const tilt = mood === "idle" ? (mouseX - 0.5) * 5 : 0;

  return (
    <motion.g
      animate={{
        y: isHappy ? [0, -10, 0] : isSad ? 3 : 0,
        rotate: isHappy ? [0, 3, -5, 2, 0] : isSad ? -2 : tilt,
        x: mood === "idle" ? (mouseX - 0.5) * 3 : 0,
      }}
      transition={isHappy ? { duration: 0.5, delay: 0.1 } : { type: "spring", stiffness: 80, damping: 12 }}
      style={{ originX: "200px", originY: "270px" }}
    >
      <rect x={170} y={130} width={60} height={140} rx={10} fill="#1a1a2e" />
      <ellipse cx={200} cy={132} rx={25} ry={8} fill="#1a1a2e" />

      {/* Face */}
      <motion.g
        animate={{
          x: mood === "idle" ? (mouseX - 0.5) * 4 : 0,
          y: mood === "idle" ? (mouseY - 0.5) * 2 : isSad ? 3 : 0,
        }}
        transition={{ type: "spring", stiffness: 150, damping: 15 }}
      >
        {!isCovering ? (
          <>
            <CharEye cx={188} cy={195} rx={6} ry={7} pupilR={4} eyeTarget={eyeTarget} closed={blink} fill="white" />
            <CharEye cx={212} cy={195} rx={6} ry={7} pupilR={4} eyeTarget={eyeTarget} closed={blink} fill="white" />
          </>
        ) : (
          <motion.g
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            <ellipse cx={188} cy={195} rx={13} ry={9} fill="#2d2d4e" />
            <ellipse cx={212} cy={195} rx={13} ry={9} fill="#2d2d4e" />
          </motion.g>
        )}

        <motion.path
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          animate={{
            d: isHappy
              ? "M192,220 Q200,232 208,220"
              : isSad
                ? "M194,224 Q200,216 206,224"
                : "M194,218 Q200,226 206,218",
          }}
          transition={{ type: "spring", stiffness: 170 }}
        />
      </motion.g>
    </motion.g>
  );
}

/* ── Yellow Character — bouncy and reactive ── */
function YellowChar({
  eyeTarget,
  blink,
  mood,
  mouseX,
  mouseY,
}: {
  eyeTarget: { x: number; y: number };
  blink: boolean;
  mood: CharacterMood;
  mouseX: number;
  mouseY: number;
}) {
  const isHappy = mood === "happy";
  const isSad = mood === "sad";
  const isCovering = mood === "curious";

  const tilt = mood === "idle" ? (mouseX - 0.5) * 7 : mood === "tracking" ? (mouseX - 0.5) * 10 : 0;

  return (
    <motion.g
      animate={{
        y: isHappy ? [0, -16, 4, -8, 0] : isSad ? 4 : 0,
        rotate: isHappy ? [0, -6, 8, -4, 0] : isSad ? 3 : tilt,
        x: mood === "idle" ? (mouseX - 0.5) * 5 : 0,
      }}
      transition={isHappy ? { duration: 0.5, delay: 0.15 } : { type: "spring", stiffness: 80, damping: 12 }}
      style={{ originX: "205px", originY: "320px" }}
    >
      <motion.ellipse
        cx={205} cy={280} rx={40} ry={45} fill="#FBBF24"
        animate={{ scaleY: isHappy ? [1, 0.9, 1.08, 1] : isSad ? 0.95 : 1 }}
        transition={{ duration: 0.4 }}
        style={{ originX: "205px", originY: "320px" }}
      />

      {/* Face */}
      <motion.g
        animate={{
          x: mood === "idle" ? (mouseX - 0.5) * 5 : mood === "tracking" ? (mouseX - 0.5) * 7 : 0,
          y: mood === "idle" ? (mouseY - 0.5) * 3 : isSad ? 3 : 0,
        }}
        transition={{ type: "spring", stiffness: 150, damping: 15 }}
      >
        {!isCovering ? (
          <>
            <CharEye cx={192} cy={268} rx={6} ry={7} pupilR={4} eyeTarget={eyeTarget} closed={blink} happyArc={isHappy} />
            <CharEye cx={216} cy={268} rx={6} ry={7} pupilR={4} eyeTarget={eyeTarget} closed={blink} happyArc={isHappy} />
          </>
        ) : (
          <motion.g
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            <ellipse cx={192} cy={268} rx={11} ry={8} fill="#E5A717" />
            <ellipse cx={216} cy={268} rx={11} ry={8} fill="#E5A717" />
          </motion.g>
        )}

        <motion.path
          fill={isHappy ? "#b45309" : "none"}
          stroke="#1a1a2e"
          strokeWidth={2}
          strokeLinecap="round"
          animate={{
            d: isHappy
              ? "M196,288 Q205,300 214,288"
              : isSad
                ? "M199,292 Q205,284 211,292"
                : "M199,286 Q205,294 211,286",
          }}
          transition={{ type: "spring", stiffness: 170 }}
        />
      </motion.g>

      {/* Blush */}
      <motion.circle cx={180} cy={280} r={6} fill="#F59E0B" opacity={0.5} animate={{ scale: isHappy ? 1.4 : 1 }} />
      <motion.circle cx={228} cy={280} r={6} fill="#F59E0B" opacity={0.5} animate={{ scale: isHappy ? 1.4 : 1 }} />
    </motion.g>
  );
}

export function AnimatedCharacters({ mood, mouseX, mouseY }: Props) {
  const blink = useBlink();
  const maxEyeMove = 12;

  const eyeTarget = useMemo(() => {
    if (mood === "looking" || mood === "tracking") {
      return { x: (mouseX - 0.5) * maxEyeMove * 3, y: 5 };
    }
    if (mood === "curious") return { x: 0, y: 0 };
    if (mood === "sad") return { x: 0, y: 6 };
    if (mood === "happy") return { x: 0, y: 0 };
    // idle — strong mouse follow
    return {
      x: (mouseX - 0.5) * maxEyeMove * 2.5,
      y: (mouseY - 0.5) * maxEyeMove * 1.5,
    };
  }, [mood, mouseX, mouseY, maxEyeMove]);

  return (
    <motion.svg
      viewBox="0 0 300 340"
      className="w-full h-full select-none"
      preserveAspectRatio="xMidYMax meet"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Subtle breathing */}
      <motion.g
        animate={{ y: [0, -2, 0, -1, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      >
        {/* Back characters (z-order) */}
        <PurpleChar eyeTarget={eyeTarget} blink={blink} mood={mood} mouseX={mouseX} mouseY={mouseY} />
        <BlackChar eyeTarget={eyeTarget} blink={blink} mood={mood} mouseX={mouseX} mouseY={mouseY} />

        {/* Front characters */}
        <OrangeChar eyeTarget={eyeTarget} blink={blink} mood={mood} mouseX={mouseX} mouseY={mouseY} />
        <YellowChar eyeTarget={eyeTarget} blink={blink} mood={mood} mouseX={mouseX} mouseY={mouseY} />
      </motion.g>
    </motion.svg>
  );
}
