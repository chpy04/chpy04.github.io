import React, { useState } from "react";
import Image from "next/image";
import ProjectModal from "../ProjectModal";

interface ProjectCardProps {
  img: string;
  name?: string;
  categories?: string[];
  fileName?: string;
  externalLink?: string;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  img,
  name,
  categories,
  fileName,
  externalLink,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (externalLink) {
      window.open(externalLink, "_blank");
    } else if (fileName) {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <div
        className="overflow-hidden rounded-lg p-2 laptop:p-4 first:ml-0 link cursor-pointer"
        onClick={handleClick}
      >
        <div
          className="relative rounded-lg overflow-hidden transition-all ease-out duration-300 h-48 mob:h-auto"
          style={{ height: "400px" }}
        >
          <Image
            alt={name || "Project image"}
            className="h-full w-full object-cover hover:scale-110 transition-all ease-out duration-300"
            src={img}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={false}
          />
        </div>
        <h1 className="mt-5 text-3xl font-medium">
          {name ? name : "Project Name"}
        </h1>
        <div className="flex flex-wrap gap-2 mt-2">
          {categories?.map((category, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm"
            >
              {category}
            </span>
          ))}
        </div>
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
