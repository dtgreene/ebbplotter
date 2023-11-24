export const LoadingOverlay = ({ active }) => {
  const style = active
    ? {
        opacity: 1,
        pointerEvents: 'default',
      }
    : undefined;

  return (
    <div
      className="w-full h-full absolute left-0 top-0 flex justify-center items-center bg-zinc-600/50 transition-opacity opacity-0 pointer-events-none z-50"
      style={style}
    >
      <span className="text-2xl">LOADING...</span>
    </div>
  );
};
