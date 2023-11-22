import { ReactNode, useState } from 'react';

interface GrassTooltipProps {
  content: string;
  scrollLeft: number;
  children: ReactNode;
}

const GrassTooltip = ({ content, scrollLeft, children }: GrassTooltipProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div
      className="whitespace-pre"
      onMouseEnter={() => {setShowTooltip(true)}}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <div className="absolute">
          <p className={`bg-default z-50 -translate-x-[calc(50%_+_${scrollLeft}px)] rounded p-2 text-white opacity-90`}>
            {content}
          </p>
        </div>
      )}
    </div>
  );
};

export default GrassTooltip;
