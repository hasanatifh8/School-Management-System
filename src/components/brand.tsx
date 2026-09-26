import Image from "next/image";

/** Product name and maker, shown on the sign-in pages. */
export const PRODUCT = { name: "Scholdesk", tagline: "Modern School Management Platform", maker: "Cliccx Technologies" } as const;

/**
 * Scholdesk logo (mark + wordmark). `tone`: "auto" follows the colour theme,
 * "dark" is for always-dark surfaces such as the sign-in brand panel.
 */
export function ScholdeskLogo({ className = "h-16 w-auto", tone = "auto", priority = false }: { className?: string; tone?: "auto" | "dark"; priority?: boolean }) {
  if (tone === "dark") {
    return <Image src="/brand/scholdesk-dark.png" alt={PRODUCT.name} width={636} height={379} priority={priority} className={className} />;
  }
  return (
    <>
      <Image src="/brand/scholdesk.png" alt={PRODUCT.name} width={636} height={379} priority={priority} className={`${className} dark:hidden`} />
      <Image src="/brand/scholdesk-dark.png" alt={PRODUCT.name} width={636} height={379} priority={priority} className={`${className} hidden dark:block`} />
    </>
  );
}

/** "Powered by" line with the Cliccx Technologies logo. */
export function PoweredBy({ tone = "auto", className = "" }: { tone?: "auto" | "dark"; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className="text-xs">Powered by</span>
      {tone === "dark" ? (
        <Image src="/brand/cliccx-dark.png" alt={PRODUCT.maker} width={314} height={367} className="h-10 w-auto" />
      ) : (
        <>
          <Image src="/brand/cliccx.png" alt={PRODUCT.maker} width={314} height={367} className="h-10 w-auto dark:hidden" />
          <Image src="/brand/cliccx-dark.png" alt={PRODUCT.maker} width={314} height={367} className="hidden h-10 w-auto dark:block" />
        </>
      )}
    </span>
  );
}
