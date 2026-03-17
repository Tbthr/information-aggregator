import { useState } from "react";

interface SaveButtonProps {
  itemId: string;
  packId?: string;
  saved?: boolean;
  onToggle?: () => void;
}

interface SaveResponse {
  success: boolean;
  data: {
    savedAt: string | null;
  };
}

export function SaveButton({ itemId, saved: initialSaved = false, onToggle }: SaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;

    setLoading(true);
    try {
      const method = saved ? "DELETE" : "POST";
      const response = await fetch(`/api/items/${itemId}/save`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result: SaveResponse = await response.json();

      if (result.success) {
        setSaved(!saved);
        onToggle?.();
      }
    } catch (error) {
      console.error("Failed to toggle save state:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        p-1.5 rounded-md transition-colors
        ${loading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100"}
        ${saved ? "text-yellow-500" : "text-gray-400 hover:text-gray-600"}
      `}
      title={saved ? "取消保存" : "保存"}
      aria-label={saved ? "取消保存" : "保存"}
    >
      {saved ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path
            fillRule="evenodd"
            d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
          />
        </svg>
      )}
    </button>
  );
}
