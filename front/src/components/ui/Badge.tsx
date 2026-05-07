import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../utils/shadcnUtils/cn";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-gray-100 text-gray-700 [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-red-100 text-red-600 focus-visible:ring-red-200 [a]:hover:bg-red-200",
        warning: "bg-amber-100 text-amber-700 [a]:hover:bg-amber-200",
        info: "bg-blue-100 text-blue-700 [a]:hover:bg-blue-200",
        outline:
          "border-border text-muted_foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost: "hover:bg-muted hover:text-muted-foreground ",
        link: "text-primary underline-offset-4 hover:underline",
        CANCELLED:
          "bg-red-100 text-red-600 focus-visible:ring-red-200 [a]:hover:bg-red-200",
        ACTIVE:
          "bg-green-100 text-green-700  focus-visible:ring-green-200 [a]:hover:bg-green-200",
        EXPIRED:
          "bg-gray-100 text-gray-700 focus-visible:ring-gray-200 [a]:hover:bg-gray-200",
        PENDING:
          "bg-amber-100 text-amber-700 focus-visible:ring-amber-200 [a]:hover:bg-amber-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
