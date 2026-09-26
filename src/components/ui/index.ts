// Design-system primitives. Import from "@/components/ui".
// Tokens (colours, type scale, motion) live in src/app/globals.css.

export { cx } from "./cx";
export { Button, ButtonLink, IconButton, TextLink, buttonClass, buttonVariants, type ButtonSize, type ButtonVariant } from "./button";
export { checkboxClass, inputClass, selectClass } from "./input";
export { Breadcrumbs, Callout, Card, FormActions, FormSection, InfoItem, PageHeader, type Crumb } from "./layout";
export {
  Avatar,
  Badge,
  Dash,
  IconTile,
  PersonCell,
  ProgressBar,
  Table,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
  type BadgeTone,
  type IconTone,
} from "./data";
export { DashboardSkeleton, DetailSkeleton, EmptyState, ListSkeleton, Skeleton, SpotIllustration, SuccessState } from "./feedback";
export { StatCard, StatGrid } from "./stat";
export { StatusTab, tabBarClass } from "./tabs";
export { AnimatedNumber } from "./animated-number";
export { NavTabs, type NavTab } from "./nav-tabs";
export { MenuButton, MenuDivider, MenuLink, MoreMenu } from "./menu";
export { Modal, useConfirm, type ConfirmOptions } from "./modal";
export { SegmentedControl, type SegmentOption } from "./segmented";
export { ThemeToggle } from "./theme-toggle";
export { useToast } from "./toast";
export { PageTransition } from "./page-transition";
export { AppShell, type NavGroup, type NavItem } from "./app-shell";
export { AccountCard } from "./account-card";
export { PagedList, PagedTable } from "./paged";
export { HeroCard, HeroGhostLink, HeroLink, HeroProgress } from "./hero";
