export default function CourseDetailLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
      {/* Thumbnail */}
      <div className="aspect-video w-full bg-gray-200 rounded-xl mb-6" />

      {/* Título e meta */}
      <div className="space-y-3 mb-6">
        <div className="h-3 w-24 bg-gray-200 rounded" />
        <div className="h-7 w-3/4 bg-gray-200 rounded" />
        <div className="h-7 w-1/2 bg-gray-200 rounded" />
        <div className="flex gap-4 pt-1">
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-4 w-20 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Botão CTA */}
      <div className="h-12 w-48 bg-gray-200 rounded-lg mb-8" />

      {/* Módulos */}
      <div className="space-y-3">
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="h-4 w-48 bg-gray-200 rounded" />
            <div className="space-y-2 pl-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-gray-200 shrink-0" />
                  <div className="h-3 w-full bg-gray-200 rounded" />
                  <div className="h-3 w-12 bg-gray-200 rounded shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
