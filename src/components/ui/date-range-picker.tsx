import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "../../../@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../@/components/ui/popover";
import { Calendar } from "../../../@/components/ui/calendar";
import type { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}

/** Theme-aware date-range picker: a Popover trigger showing the formatted
 *  range, opening a range-mode Calendar. */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Any date",
  className,
}: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Select date range"
          className={cn(
            "w-full justify-start px-2.5 font-normal",
            !value?.from && "text-muted",
            className,
          )}
        >
          <CalendarIcon aria-hidden="true" data-icon="inline-start" />
          {value?.from ? (
            value.to ? (
              <span className="truncate">
                {format(value.from, "LLL dd, y")} -{" "}
                {format(value.to, "LLL dd, y")}
              </span>
            ) : (
              <span className="truncate">
                {format(value.from, "LLL dd, y")}
              </span>
            )
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          defaultMonth={value?.from}
          selected={value}
          onSelect={onChange}
          numberOfMonths={1}
        />
      </PopoverContent>
    </Popover>
  );
}
