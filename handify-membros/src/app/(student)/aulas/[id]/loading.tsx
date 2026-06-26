export default function AulaLoading() {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen animate-pulse">
      {/* Área principal */}
      <div className="flex-1 flex flex-col">
        {/* Player */}
        <div className="w-full aspect-video bg-gray-900" />

        {/* Info da aula */}
        <div className="p-4 md:p-6 space-y-3 border-b border-gray-100">
          <div className="h-6 w-2/3 bg-gray-200 rounded" />
          <div className="flex gap-3">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
        </div>

        {/* Botão concluir */}
        <div className="p-4 md:p-6">
          <div className="h-10 w-40 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Sidebar de módulos (desktop) */}
      <div className="hidden lg:flex flex-col w-80 border-l border-gray-100 bg-white p-4 gap-4">
        <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-40 bg-gray-200 rounded" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-2 pl-2">
                <div className="h-3 w-3 rounded-full bg-gray-200 shrink-0" />
                <div className="h-3 w-full bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
