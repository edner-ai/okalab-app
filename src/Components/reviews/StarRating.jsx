import React, { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "../../utils";

export default function StarRating({
  value = 0,
  onChange,
  size = 20,
  readOnly = false,
  className = "",
}) {
  const [hoverValue, setHoverValue] = useState(0);
  const displayValue = useMemo(() => (hoverValue > 0 ? hoverValue : value), [hoverValue, value]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = displayValue >= star;
        const iconClass = active ? "text-amber-400 fill-amber-400" : "text-slate-300";

        if (readOnly) {
          return <Star key={star} className={cn(iconClass)} style={{ width: size, height: size }} />;
        }

        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            onMouseEnter={() => setHoverValue(star)}
            onMouseLeave={() => setHoverValue(0)}
            className="transition-transform hover:-translate-y-0.5"
            aria-label={`${star} estrellas`}
          >
            <Star className={cn(iconClass)} style={{ width: size, height: size }} />
          </button>
        );
      })}
    </div>
  );
}
