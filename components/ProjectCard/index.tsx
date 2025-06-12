import React, { useState } from "react";
import Image from "next/image";
import ProjectModal from "../ProjectModal";

interface ProjectCardProps {
  img: string;
  name?: string;
  subtitle?: string;
  categories?: string[];
  fileName?: string;
  externalLink?: string;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  img,
  name,
  subtitle,
  categories,
  fileName,
  externalLink,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event
    if (externalLink) {
      window.open(externalLink, "_blank");
    } else if (fileName) {
      setIsModalOpen(true);
    }
  };

  const renderIcon = () => {
    if (externalLink) {
      return (
        <svg
          className="w-6 h-6 text-white"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            clipRule="evenodd"
          />
        </svg>
      );
    } else if (fileName) {
      return (
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    }
    return null;
  };

  return (
    <>
      <div className="overflow-hidden rounded-lg p-2 laptop:p-3 first:ml-0 w-full border border-gray-700 hover:border-gray-500 transition-all duration-300 hover:scale-105 relative">
        <h1 className="mb-3 text-2xl font-medium">
          {name ? name : "Project Name"}
        </h1>
        <div className="relative rounded-lg overflow-hidden transition-all ease-out duration-300 aspect-[4/3]">
          <Image
            alt={name || "Project image"}
            className="h-full w-full object-cover hover:scale-110 transition-all ease-out duration-300"
            src={img}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={false}
          />
        </div>
        <h2 className="mt-2 text-sm font-medium mr-10">{subtitle}</h2>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {categories?.map((category, index) => (
            <span
              key={index}
              className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs"
            >
              {category}
            </span>
          ))}
        </div>
        {(externalLink || fileName) && (
          <button
            onClick={handleIconClick}
            className="absolute bottom-3 right-3 p-2 bg-slate-800/80 rounded-full hover:bg-slate-700/80 transition-all duration-300 hover:scale-110"
            aria-label={
              externalLink ? "View on GitHub" : "View project details"
            }
          >
            {renderIcon()}
          </button>
        )}
      </div>
      {fileName && !externalLink && (
        <ProjectModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          fileName={fileName}
        />
      )}
    </>
  );
};

export default ProjectCard;
