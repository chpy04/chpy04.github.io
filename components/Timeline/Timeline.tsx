import React, { useState } from "react";
import timelineData from "../../data/timeline.json";
import { TimelineItemCard } from "./TimelineItem";

export const Timeline: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState<number>(
    timelineData.length - 1
  );

  const sortedItems = [...timelineData].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  // Calculate timeline bar dimensions
  const leftPadding = 25;
  const rightPadding = 25;
  const availableWidth = 100 - leftPadding - rightPadding;
  const spacing = availableWidth / (sortedItems.length - 1);


  const years = [2022, 2023, 2024, 2025];
  const yearSpacing = 100 / (years.length + 1);

  return (
    <div className="container mx-auto px-4 py-4">
      {/* Timeline Bar */}
      <div className="relative w-full mb-6">
        {/* Years */}
        <div className="relative h-6">
          {years.map((year) => {
            const position = (years.indexOf(year) + 1) * yearSpacing;
            return (
              <div
                key={`year-${year}`}
                className="absolute transform -translate-x-1/2"
                style={{ left: `${position}%` }}
              >
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {year}
                </div>
              </div>
            );
          })}
        </div>

        {/* Line and Ticks */}
        <div className="relative h-4">
          <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-slate-700" />
          {years.map((year) => {
            const position = (years.indexOf(year) + 1) * yearSpacing;
            return (
              <div
                key={`tick-${year}`}
                className="absolute top-1/2 -translate-y-1/2 w-[2px] h-3 bg-slate-600"
                style={{ left: `${position}%` }}
              />
            );
          })}
        </div>
      </div>

      <div className="relative min-h-[200px] flex items-start mt-4">
        <div className="w-full relative">
          {sortedItems.map((item, index) => {
            const isSelected = selectedIndex === index;
            const isLeft = selectedIndex !== null && index < selectedIndex;
            const isRight = selectedIndex !== null && index > selectedIndex;

            // Calculate position with increased padding
            const position = leftPadding + index * spacing;

            // Calculate hover offset - reduced spread distance
            const hoverOffset = isSelected
              ? 0
              : isLeft
              ? -50
              : isRight
              ? 50
              : 0;

            // Calculate z-index based on selected state and position
            let zIndex;
            if (isSelected) {
              zIndex = 100; // Selected item always on top
            } else if (selectedIndex !== null) {
              // When something is selected, stack based on distance
              const distanceFromSelected = Math.abs(index - selectedIndex);
              zIndex = 50 - distanceFromSelected;
            } else {
              // Default state: most recent items on top
              zIndex = sortedItems.length - index;
            }

            return (
              <div
                key={item["timeline-id"]}
                className="absolute transition-all duration-300 ease-in-out"
                style={{
                  transform: `translateX(calc(-50% + ${hoverOffset}px)) ${
                    isSelected ? "scale(1.05)" : "scale(1)"
                  }`,
                  left: `${position}%`,
                  opacity: isSelected ? 1 : 1,
                  zIndex: zIndex,
                  width: "max-content",
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <TimelineItemCard {...item} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
