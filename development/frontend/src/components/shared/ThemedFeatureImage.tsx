/**
 * ThemedFeatureImage — Shared themed image component
 *
 * Renders both dark and light variants of a feature image, toggling
 * visibility via CSS `hidden dark:block` / `block dark:hidden` so the
 * correct image shows per the current theme without any client-side JS.
 *
 * Used by:
 *   - /features page (marketing)
 *   - KarlUpsellDialog (in-app upsell)
 *
 * Image convention:
 *   /images/features/{image}-dark.png
 *   /images/features/{image}-light.png
 *
 * @module shared/ThemedFeatureImage
 */

import Image from "next/image";
import { cn } from "@/lib/utils";

export interface ThemedFeatureImageProps {
  /** Base filename for /images/features/ (e.g. "valhalla" → valhalla-dark.png, valhalla-light.png) */
  image: string;
  /** Alt text for the image */
  alt: string;
  /** Width hint for Next/Image (default: 800) */
  width?: number;
  /** Height hint for Next/Image (default: 600) */
  height?: number;
  /** Whether to show the hover shimmer overlay (default: true) */
  shimmer?: boolean;
  /** Whether to show the hover scale + glow effect (default: true) */
  hoverEffect?: boolean;
  /** Additional className for the outer container */
  className?: string;
}

/**
 * ThemedFeatureImage — renders dark/light image variants with CSS theme switching.
 *
 * Includes optional hover animation: gold glow pulse + subtle scale + rune shimmer.
 * Set shimmer={false} and hoverEffect={false} to disable hover effects (e.g. in dialog context).
 */
export function ThemedFeatureImage({
  image,
  alt,
  width = 800,
  height = 600,
  shimmer = true,
  hoverEffect = true,
  className,
}: ThemedFeatureImageProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-sm border border-border bg-card",
        className,
      )}
    >
      {/* Rune shimmer overlay on hover */}
      {shimmer && (
        <div
          className={[
            "pointer-events-none absolute inset-0 z-10",
            "opacity-0 group-hover:opacity-100",
            "bg-gradient-to-r from-transparent via-primary/10 to-transparent",
            "translate-x-[-100%] group-hover:translate-x-[100%]",
            "transition-all duration-1000 ease-in-out",
          ].join(" ")}
          aria-hidden="true"
        />
      )}
      {/* Dark-mode image */}
      <Image
        src={`/images/features/${image}-dark.png`}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          "hidden dark:block w-full h-auto object-cover",
          hoverEffect && [
            "transition-all duration-500 ease-out",
            "group-hover:scale-[1.03]",
            "group-hover:drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]",
          ],
        )}
      />
      {/* Light-mode image */}
      <Image
        src={`/images/features/${image}-light.png`}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          "block dark:hidden w-full h-auto object-cover",
          hoverEffect && [
            "transition-all duration-500 ease-out",
            "group-hover:scale-[1.03]",
            "group-hover:drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]",
          ],
        )}
      />
    </div>
  );
}
