import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "../../utils";
import { buttonVariants } from "./button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",

        /* caption + navegación (flechas dentro) */
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-3 z-20 flex items-center justify-between px-1",

        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "z-30 h-7 w-7 p-0 bg-transparent opacity-50 hover:opacity-100 border border-input ml-4"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "z-30 h-7 w-7 p-0 bg-transparent opacity-50 hover:opacity-100 border border-input"
        ),

        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] text-center",
        week: "flex w-full mt-2",

        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",



          day_button: cn(
            buttonVariants({ variant: "ghost" }),
            "h-8 w-8 p-0 font-normal leading-none hover:bg-slate-100 aria-selected:opacity-100"
          ),


        /* ✅ nombres correctos v9 */
        range_start: "range_start",
        range_end: "range_end",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",

        selected: "bg-black text-white hover:bg-black hover:text-white focus:bg-black focus:text-white",
          today: "bg-slate-100 text-slate-900",
        outside:
          "text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",

        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...p }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", className)} {...p} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", className)} {...p} />
          ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";
export { Calendar };
