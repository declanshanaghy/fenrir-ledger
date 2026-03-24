"use client";

/**
 * IssuerSelect — shared issuer dropdown for add and edit card forms.
 *
 * Each dropdown item shows:
 *   [logo] [fixed-width rune] [real issuer name]
 *
 * The rune is rendered in a fixed-width container so all issuer names
 * align regardless of rune character width.
 *
 * Issue #1955: extracted from CardFormStep1 and CardFormEditFields to
 * eliminate duplicate dropdown code and fix rune alignment.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { KNOWN_ISSUERS } from "@/lib/constants";
import { getIssuerMeta } from "@/lib/issuer-utils";

interface IssuerSelectProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function IssuerSelect({ value, onChange, required }: IssuerSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        id="issuerId"
        aria-required={required ? "true" : undefined}
        className="min-h-[44px]"
      >
        <SelectValue placeholder="Select issuer" />
      </SelectTrigger>
      <SelectContent>
        {KNOWN_ISSUERS.map((issuer) => {
          const meta = getIssuerMeta(issuer.id);
          return (
            <SelectItem key={issuer.id} value={issuer.id}>
              <span className="inline-flex items-center gap-2">
                {meta && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.logoPath}
                    alt=""
                    aria-hidden="true"
                    style={{ height: "1em", width: "auto", flexShrink: 0 }}
                  />
                )}
                <span
                  className="inline-flex w-6 justify-center"
                  aria-hidden="true"
                >
                  {meta?.rune ?? ""}
                </span>
                <span>{issuer.name}</span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
