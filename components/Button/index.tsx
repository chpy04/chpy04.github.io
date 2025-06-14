import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  type?: "primary" | "secondary";
  onClick?: () => void;
  classes?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  type,
  onClick,
  classes,
}) => {
  if (type === "primary") {
    return (
      <button
        onClick={onClick}
        type="button"
        className={`text-sm tablet:text-base p-1 laptop:p-2 m-1 laptop:m-2 rounded-lg bg-white text-black transition-all duration-300 ease-out first:ml-0 hover:scale-105 active:scale-100 link ${classes}`}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      type="button"
      className={`text-sm tablet:text-base p-1 laptop:p-2 m-1 laptop:m-2 rounded-lg flex items-center transition-all ease-out duration-300 hover:bg-slate-600 text-white hover:scale-105 active:scale-100 tablet:first:ml-0 [text-shadow:_0_1px_0_rgb(0_0_0_/_40%)] ${classes} link`}
    >
      {children}
    </button>
  );
};

export default Button;
