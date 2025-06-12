import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
}

const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  fileName,
}) => {
  const [markdown, setMarkdown] = useState<string>("");

  useEffect(() => {
    if (isOpen && fileName) {
      fetch(`/projectFiles/${fileName}`)
        .then((response) => response.text())
        .then((text) => setMarkdown(text))
        .catch((error) => console.error("Error loading markdown:", error));
    }
  }, [isOpen, fileName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      ></div>
      <div className="relative bg-slate-800 rounded-lg w-11/12 max-w-6xl max-h-[90vh] overflow-y-auto p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <article className="prose prose-invert prose-slate max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-a:text-blue-400 prose-strong:text-slate-200 prose-code:text-slate-300 prose-pre:bg-slate-900 prose-img:rounded-lg">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
          >
            {markdown}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
};

export default ProjectModal;
