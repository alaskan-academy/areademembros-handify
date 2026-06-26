export default function DashboardLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
      {/* Saudação */}
      <div className="mb-8 space-y-2">
        <div className="h-7 w-56 bg-gray-200 rounded" />
        <div className="h-4 w-80 bg-gray-200 rounded" />
      </div>

      {/* Cards de cursos */}
      <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="aspect-video bg-gray-200" />
            <div className="p-4 space-y-3">
              <div className="h-5 w-full bg-gray-200 rounded" />
              {/* Barra de progresso */}
              <div className="h-2 w-full bg-gray-200 rounded-full" />
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-gray-200 rounded" />
                <div className="h-3 w-12 bg-gray-200 rounded" />
              </div>
              <div className="h-9 w-full bg-gray-200 rounded-lg mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
