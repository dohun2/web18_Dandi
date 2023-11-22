import { useRef, useEffect, useState } from 'react';
import GrassTooltip from '@components/Home/GrassTooltip';

interface GrassDataProps {
  date: string;
  mood: string;
}

const Grass = () => {
  const data = [
    { date: '2023-01-13', mood: 'soso' },
    { date: '2023-01-13', mood: 'bad' },
    { date: '2023-01-31', mood: 'bad' },
    { date: '2023-02-07', mood: 'excellent' },
    { date: '2023-03-23', mood: 'bad' },
    { date: '2023-04-12', mood: 'soso' },
    { date: '2023-04-28', mood: 'soso' },
    { date: '2023-05-23', mood: 'good' },
    { date: '2023-06-13', mood: 'bad' },
    { date: '2023-06-24', mood: 'bad' },
    { date: '2023-06-29', mood: 'good' },
    { date: '2023-07-16', mood: 'bad' },
    { date: '2023-07-29', mood: 'excellent' },
    { date: '2023-08-15', mood: 'excellent' },
    { date: '2023-08-18', mood: 'terrible' },
    { date: '2023-08-29', mood: 'soso' },
    { date: '2023-09-16', mood: 'bad' },
    { date: '2023-09-16', mood: 'excellent' },
    { date: '2023-09-17', mood: 'soso' },
    { date: '2023-10-15', mood: 'good' },
  ];

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  const currentDate: Date = new Date();
  const lastYear: Date = new Date(currentDate);
  lastYear.setFullYear(lastYear.getFullYear() - 1);
  const dates: string[] = new Array(365).fill(null);
  data.forEach(({ date, mood }: GrassDataProps) => {
    const dataDate: Date = new Date(date);
    const index: number = Math.floor(
      (dataDate.getTime() - lastYear.getTime()) / (24 * 60 * 60 * 1000),
    );
    dates[index] = mood;
  });
  const grassData = [...Array(lastYear.getDay()).fill(undefined), ...dates];

  const renderGrass = (scrollLeft: number) => {
    return grassData.map((mood, index) => {
      const getTooltipContent = () => {
        const tmpDate = new Date(lastYear);
        tmpDate.setDate(tmpDate.getDate() + index);
        const moodContent = mood === null ? 'no' : mood;
        return `${moodContent} mood on ${tmpDate.toLocaleDateString()}`;
      };

      return (
        <GrassTooltip key={index} scrollLeft={scrollLeft} content={getTooltipContent()}>
          <div className={`m-[0.1rem] h-4 w-4 rounded bg-emotion-${mood}`}></div>
        </GrassTooltip>
      );
    });
  };

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        setScrollLeft(scrollRef.current.scrollLeft);
      }
    };
    scrollRef.current?.addEventListener('scroll', handleScroll);
    return () => {
      scrollRef.current?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="z-0 flex h-full w-3/5 flex-col gap-2 p-5">
      <p className="text-2xl font-bold">지난 1년간 {data.length}개의 일기를 작성하셨어요.</p>
      <div
        ref={scrollRef}
        className="grid-rows-7 border-brown z-0 grid h-full w-full grid-flow-col overflow-x-scroll rounded-lg border p-2"
      >
        {renderGrass(scrollRef.current?.scrollLeft || 0)}
      </div>
    </div>
  );
};

export default Grass;
