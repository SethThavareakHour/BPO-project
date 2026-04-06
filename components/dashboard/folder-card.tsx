import * as React from "react";
import { cn } from "@/lib/utils";

interface FolderCardProps extends React.HTMLAttributes<HTMLDivElement> {
  isActive?: boolean;
  children: React.ReactNode;
  contentTitle?: React.ReactNode;
  contentStats?: React.ReactNode;
}

export function FolderCard({
  isActive = true, // Force active/blue theme based on user reference
  className,
  children,       // For the white inner paper content (e.g., description)
  contentTitle,   // For the "Raw data" label
  contentStats,   // For "39 notes / 180 MB"
  ...props
}: FolderCardProps) {
  return (
    <div
      className={cn(
        "relative w-full h-[205px] rounded-[20px] overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1.5 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)] hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]",
        className
      )}
      {...props}
    >
      {/* 1. Back Layer (Darker blue folder back) */}
      <div className="absolute inset-0 bg-[#5E8DF2]" />

      {/* 2. Inner Layer (Semi-transparent inner paper) */}
      <div className="absolute top-[10px] left-[10px] right-[10px] bottom-8 bg-[#9FBFF8] rounded-t-lg rotate-[-1.5deg] origin-bottom-left border border-white/20 transition-transform group-hover:rotate-[-2.5deg]" />

      {/* 3. Front Inner Layer (White paper with content) */}
      <div className="absolute top-[20px] left-[14px] right-[14px] bottom-8 bg-white rounded-t-[12px] shadow-sm flex flex-col pt-3 px-4">
        {/* Pass any inner white paper content here */}
        {children}
      </div>

      {/* 4. Front Flap (The angled folder cover) */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[78%] bg-gradient-to-b from-[#78A1FB] to-[#5586FF] z-10"
        style={{
          clipPath: `polygon(
            0 0, 
            63% 0, 
            65% 4%,
            67% 10%,
            69% 18%,
            71% 28%,
            73% 36%,
            75% 40%,
            77% 41%,
            100% 41%, 
            100% 100%, 
            0 100%
          )`
        }}
      >
      </div>

      {/* 5. Flap Content Overlay (White text on top of the blue flap) */}
      <div className="absolute top-[28%] left-0 right-0 bottom-0 z-20 px-5 pb-5 pt-1 flex flex-col justify-between">
        {contentTitle && (
          <div className="text-lg font-black text-white drop-shadow-sm tracking-wide leading-[1.1] line-clamp-3 max-w-[55%] break-words">
            {contentTitle}
          </div>
        )}
        {contentStats && (
          <div className="text-white/95 text-[12px] font-bold tracking-tight flex flex-col gap-2 drop-shadow-sm">
            {contentStats}
          </div>
        )}
      </div>

    </div>
  );
}

