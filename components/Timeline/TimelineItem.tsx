import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";

interface TimelineItemProps {
  organization: string;
  title: string;
  description: string;
  start: string;
  end?: string;
  type: string;
  thumbnail: string;
  "timeline-id": number;
}

const formatDateRange = (start: string, end?: string): string => {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : undefined;

  const startMonth = startDate.toLocaleString("default", { month: "long" });
  const endMonth = endDate
    ? endDate.toLocaleString("default", { month: "long" })
    : "";
  const startYear = startDate.getFullYear();
  const endYear = endDate ? endDate.getFullYear() : "";

  if (startYear === endYear) {
    return `${startMonth} - ${endMonth} ${startYear}`;
  }

  if (!endDate) {
    return `${startMonth} ${startYear} - Present`;
  }

  return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
};

export const TimelineItemCard: React.FC<TimelineItemProps> = (props) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-slate-800 backdrop-blur-sm rounded-3xl shadow-lg p-6 mb-6 max-w-xl mx-auto border border-slate-700/50 h-[250px] flex flex-col"
    >
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-start mb-2 min-h-[45px]">
          <div className="flex-1 pr-4">
            <h3 className="text-2xl font-bold text-gray-100 line-clamp-1">
              {props.title}
            </h3>
            <p className="text-lg text-gray-400 line-clamp-1">
              {props.organization}: {formatDateRange(props.start, props.end)}
            </p>
          </div>
          <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-base shrink-0">
            {props.type}
          </span>
        </div>

        <div className="relative flex-1">
          <div className="float-left mr-4 mb-2 w-20 h-20 relative">
            <Image
              src={`/images/timeline/${props.thumbnail}`}
              alt={props.organization}
              fill
              className="object-cover rounded-lg"
            />
          </div>
          <div
            className="text-lg text-gray-300 [&>a]:text-blue-400 [&>a]:underline [&>a]:hover:text-blue-300 [&>a]:transition-colors"
            dangerouslySetInnerHTML={{ __html: props.description }}
          />
        </div>
      </div>
    </motion.div>
  );
};
