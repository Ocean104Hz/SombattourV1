
/** โครงรายการซ่อมแบบ shimmer ขณะรอโหลด */
export default function SkeletonCards({ count = 8 }: { count?: number }) {
  return (
    <div className="mt-4 px-4 pb-20 flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.5rem)] 
                     rounded-2xl bg-white/5 border border-white/10 p-4"
        >
          <div className="h-4 w-24 rounded bg-white/10 animate-pulse mb-3" />
          <div className="h-6 w-2/3 rounded bg-white/10 shimmer" />
          <div className="mt-3 h-4 w-1/2 rounded bg-white/10 shimmer" />
          <div className="mt-2 h-4 w-3/4 rounded bg-white/10 shimmer" />
          <div className="mt-4 flex gap-2">
            <div className="h-8 w-20 rounded bg-white/10 shimmer" />
            <div className="h-8 w-16 rounded bg-white/10 shimmer" />
          </div>
        </div>
      ))}

      <style>{`
        .shimmer {
          position: relative;
          overflow: hidden;
        }
        .shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background-image: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.08) 50%,
            rgba(255,255,255,0) 100%
          );
          animation: shimmer 1.6s infinite;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
