import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            Information Aggregator
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              信息聚合平台
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="text-sm text-gray-500 text-center">
          Powered by Information Aggregator
        </div>
      </footer>
    </div>
  );
}
