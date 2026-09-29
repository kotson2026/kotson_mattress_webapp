export default function BotanicalBranch({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="leafGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C9C59" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#467065" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="leafGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#95B176" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#5E8478" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="stemGrad" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#5E8478" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#7C9C59" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Main graceful arching stem */}
      <path
        d="M430,220 C360,170 280,130 180,95 C110,70 50,60 0,65"
        stroke="url(#stemGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Secondary branchlet */}
      <path
        d="M260,120 C230,85 190,65 140,55"
        stroke="url(#stemGrad)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Secondary branchlet 2 */}
      <path
        d="M340,158 C320,115 285,90 235,75"
        stroke="url(#stemGrad)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Leaf 1 - Far Left Tip */}
      <path
        d="M0,65 C-20,40 -10,15 15,20 C40,25 30,55 0,65 Z"
        fill="url(#leafGrad1)"
      />

      {/* Leaf 2 */}
      <path
        d="M50,61 C45,30 70,10 95,22 C120,35 90,60 50,61 Z"
        fill="url(#leafGrad2)"
      />

      {/* Leaf 3 */}
      <path
        d="M100,72 C115,45 145,35 160,52 C175,70 145,85 100,72 Z"
        fill="url(#leafGrad1)"
      />

      {/* Leaf 4 - on secondary branchlet */}
      <path
        d="M140,55 C130,25 155,5 178,18 C200,30 180,55 140,55 Z"
        fill="url(#leafGrad2)"
      />

      {/* Leaf 5 */}
      <path
        d="M190,65 C195,35 225,20 248,38 C270,55 240,78 190,65 Z"
        fill="url(#leafGrad1)"
      />

      {/* Leaf 6 */}
      <path
        d="M165,90 C175,120 150,145 130,135 C110,125 125,98 165,90 Z"
        fill="url(#leafGrad2)"
      />

      {/* Leaf 7 - Large central leaf */}
      <path
        d="M235,75 C245,40 280,25 308,45 C335,65 300,92 235,75 Z"
        fill="url(#leafGrad1)"
      />

      {/* Leaf 8 */}
      <path
        d="M230,110 C260,135 255,165 235,162 C210,158 205,125 230,110 Z"
        fill="url(#leafGrad2)"
      />

      {/* Leaf 9 - Upper right accent */}
      <path
        d="M285,90 C305,55 345,45 370,68 C395,90 355,115 285,90 Z"
        fill="url(#leafGrad1)"
      />

      {/* Leaf 10 - Lower right */}
      <path
        d="M305,142 C338,168 335,195 310,192 C285,188 280,158 305,142 Z"
        fill="url(#leafGrad2)"
      />

      {/* Leaf 11 - Far right large leaf */}
      <path
        d="M360,118 C385,78 430,70 450,95 C470,120 435,145 360,118 Z"
        fill="url(#leafGrad1)"
      />
    </svg>
  );
}
