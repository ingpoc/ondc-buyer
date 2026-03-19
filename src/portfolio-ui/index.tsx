import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Command as CommandPrimitive } from 'cmdk';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Menu,
  PackagePlus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from './lib/cn';

export * from './tokens';
export { cn } from './lib/cn';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';
export type AsyncStateKind = 'loading' | 'empty' | 'error' | 'blocked' | 'success';

export interface NavItem {
  href: string;
  label: string;
}

export interface ShellAction {
  id?: string;
  node: ReactNode;
}

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatusTone;
}

const toneClasses: Record<StatusTone, string> = {
  neutral: 'text-[var(--ui-text-secondary)] bg-[var(--ui-bg-subtle)] border-[var(--ui-border)]',
  success: 'text-[var(--ui-success)] bg-[rgba(19,121,91,0.12)] border-[rgba(19,121,91,0.14)]',
  warning: 'text-[var(--ui-warning)] bg-[rgba(180,83,9,0.12)] border-[rgba(180,83,9,0.14)]',
  error: 'text-[var(--ui-error)] bg-[rgba(194,65,12,0.12)] border-[rgba(194,65,12,0.14)]',
  info: 'text-[var(--ui-info)] bg-[rgba(29,78,216,0.12)] border-[rgba(29,78,216,0.14)]',
};

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--ui-radius-pill)] text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-ring)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--ui-primary)] text-white shadow-[0_10px_24px_rgba(234,106,42,0.24)] hover:bg-[var(--ui-primary-strong)]',
        secondary:
          'border border-[var(--ui-border)] bg-white text-[var(--ui-text)] hover:bg-[rgba(255,255,255,0.7)]',
        ghost: 'bg-transparent text-[var(--ui-text)] hover:bg-[rgba(16,16,16,0.04)]',
        subtle:
          'bg-[var(--ui-bg-subtle)] text-[var(--ui-text)] shadow-none hover:bg-[#e6e1d8]',
        danger: 'bg-[var(--ui-error)] text-white shadow-[0_10px_24px_rgba(194,65,12,0.24)]',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-11 w-11',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, fullWidth }), className)} {...props} />
  )
);
Button.displayName = 'Button';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-[var(--ui-radius-pill)] border border-[var(--ui-border)] bg-white px-4 text-sm font-medium text-[var(--ui-text)] shadow-[var(--ui-shadow-sm)] outline-none transition-all duration-150 placeholder:text-[var(--ui-text-muted)] focus:border-[var(--ui-primary)] focus:ring-2 focus:ring-[var(--ui-ring)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[120px] w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-white px-4 py-3 text-sm font-medium text-[var(--ui-text)] shadow-[var(--ui-shadow-sm)] outline-none transition-all duration-150 placeholder:text-[var(--ui-text-muted)] focus:border-[var(--ui-primary)] focus:ring-2 focus:ring-[var(--ui-ring)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'surface-card rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[rgba(255,255,255,0.88)] p-6 backdrop-blur-sm',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: StatusTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--ui-radius-pill)] border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  title,
  description,
  tone = 'info',
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  tone?: StatusTone;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-[var(--ui-radius-lg)] border p-4', toneClasses[tone], className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">{title}</div>
          {description ? <div className="mt-1 text-sm opacity-90">{description}</div> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[var(--ui-radius-md)] bg-[rgba(16,16,16,0.06)]', className)} />;
}

export function Section({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {(eyebrow || title || description || actions) && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            {eyebrow ? <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">{eyebrow}</div> : null}
            {title ? <h2 className="text-2xl font-bold tracking-[-0.03em] text-[var(--ui-text)]">{title}</h2> : null}
            {description ? <p className="max-w-3xl text-sm text-[var(--ui-text-secondary)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
}

export function PageLayout({
  children,
  variant = 'default',
  title,
  subtitle,
  showHeader = false,
}: {
  children: ReactNode;
  variant?: 'default' | 'gray' | 'centered';
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8',
        variant === 'centered' && 'flex min-h-[calc(100vh-8rem)] flex-col justify-center',
        variant === 'gray' && 'rounded-[var(--ui-radius-lg)] bg-[rgba(255,255,255,0.42)]'
      )}
    >
      {(showHeader || title || subtitle) && (
        <PageHeader title={title ?? ''} subtitle={subtitle} />
      )}
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.04em] text-[var(--ui-text)]">{title}</h1>
        {subtitle ? <p className="max-w-3xl text-sm text-[var(--ui-text-secondary)] sm:text-base">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'neutral' }: StatCardProps) {
  return (
    <Card className="rounded-[var(--ui-radius-lg)] p-5">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">{label}</div>
      <div className="mt-4 text-3xl font-bold tracking-[-0.04em] text-[var(--ui-text)]">{value}</div>
      {hint ? <div className={cn('mt-3 text-sm font-medium', toneClasses[tone].split(' ')[0])}>{hint}</div> : null}
    </Card>
  );
}

export function AsyncState({
  kind,
  title,
  description,
  action,
  className,
}: {
  kind: AsyncStateKind;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const icon =
    kind === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> :
    kind === 'success' ? <Check className="h-5 w-5" /> :
    kind === 'blocked' ? <ShieldCheck className="h-5 w-5" /> :
    <AlertCircle className="h-5 w-5" />;

  const tone: StatusTone =
    kind === 'error' ? 'error' :
    kind === 'blocked' ? 'warning' :
    kind === 'success' ? 'success' :
    'neutral';

  return (
    <Card className={cn('rounded-[var(--ui-radius-lg)] p-8 text-center', className)}>
      <div className={cn('mx-auto flex h-12 w-12 items-center justify-center rounded-full border', toneClasses[tone])}>
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-bold tracking-[-0.03em] text-[var(--ui-text)]">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--ui-text-secondary)]">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export function EmptyState(props: Omit<Parameters<typeof AsyncState>[0], 'kind'>) {
  return <AsyncState kind="empty" {...props} />;
}

export function ErrorState(props: Omit<Parameters<typeof AsyncState>[0], 'kind'>) {
  return <AsyncState kind="error" {...props} />;
}

export function TrustBanner({
  title,
  description,
  action,
  tone = 'warning',
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  tone?: StatusTone;
}) {
  return <Alert title={title} description={description} action={action} tone={tone} className="rounded-[var(--ui-radius-lg)]" />;
}

interface AppShellProps {
  brand: {
    name: string;
    href: string;
    tagline?: string;
  };
  navItems: NavItem[];
  activePath?: string;
  renderLink: (item: NavItem, className: string, isActive: boolean, onNavigate?: () => void) => ReactNode;
  actions?: ReactNode;
  headerSearch?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  brand,
  navItems,
  activePath,
  renderLink,
  actions,
  headerSearch,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const desktopLinkClass = (isActive: boolean) =>
    cn(
      'rounded-[var(--ui-radius-pill)] px-4 py-2 text-sm font-semibold transition-all duration-150',
      isActive
        ? 'bg-[rgba(234,106,42,0.12)] text-[var(--ui-primary-strong)]'
        : 'text-[var(--ui-text-secondary)] hover:bg-[rgba(16,16,16,0.04)] hover:text-[var(--ui-text)]'
    );

  return (
    <div className="premium-shell min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--ui-border)] bg-[rgba(246,244,239,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">Portfolio</div>
            {renderLink(
              { href: brand.href, label: brand.name },
              'block text-[1.5rem] font-bold tracking-[-0.05em] text-[var(--ui-text)]',
              activePath === brand.href
            )}
            {brand.tagline ? <div className="mt-1 hidden text-sm text-[var(--ui-text-secondary)] sm:block">{brand.tagline}</div> : null}
          </div>
          <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
            {navItems.map((item) => renderLink(item, desktopLinkClass(activePath === item.href), activePath === item.href))}
          </nav>
          <div className="ml-auto hidden items-center gap-3 lg:flex">
            {headerSearch}
            {actions}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            {actions ? <div className="hidden sm:flex">{actions}</div> : null}
            <Button variant="secondary" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DrawerContent side="right" className="lg:hidden">
          <div className="space-y-3 p-6">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">Navigation</div>
              <div className="text-2xl font-bold tracking-[-0.04em] text-[var(--ui-text)]">{brand.name}</div>
              {brand.tagline ? <div className="text-sm text-[var(--ui-text-secondary)]">{brand.tagline}</div> : null}
            </div>
            {headerSearch ? <div className="pt-2">{headerSearch}</div> : null}
            <div className="space-y-2 pt-2">
              {navItems.map((item) =>
                renderLink(
                  item,
                  cn(
                    'block rounded-[var(--ui-radius-md)] px-4 py-3 text-sm font-semibold',
                    activePath === item.href ? 'bg-[rgba(234,106,42,0.12)] text-[var(--ui-primary-strong)]' : 'bg-white text-[var(--ui-text)]'
                  ),
                  activePath === item.href,
                  () => setMobileOpen(false)
                )
              )}
            </div>
            {actions ? <div className="flex flex-wrap gap-3 pt-4">{actions}</div> : null}
          </div>
        </DrawerContent>
      </Dialog>
      <main>{children}</main>
    </div>
  );
}

export function FormLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 md:grid-cols-2', className)}>{children}</div>;
}

export function DataTableLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-white shadow-[var(--ui-shadow-sm)]', className)}>{children}</div>;
}

export function ChatLayout({
  title,
  children,
  footer,
  actions,
  height = '640px',
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  height?: CSSProperties['height'];
}) {
  return (
    <Card className="overflow-hidden rounded-[var(--ui-radius-lg)] p-0">
      <div className="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">Assistant</div>
          <div className="text-lg font-bold tracking-[-0.03em] text-[var(--ui-text)]">{title}</div>
        </div>
        {actions}
      </div>
      <div className="flex flex-col" style={{ height }}>
        <div className="hide-scrollbar flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-[var(--ui-border)] bg-[rgba(255,255,255,0.7)] px-5 py-4">{footer}</div> : null}
      </div>
    </Card>
  );
}

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-[rgba(16,16,16,0.5)] backdrop-blur-sm', className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-white p-6 shadow-[var(--ui-shadow-lg)]',
        className
      )}
      {...props}
    >
      {children}
      <DialogClose className="absolute right-4 top-4 rounded-full p-2 text-[var(--ui-text-muted)] hover:bg-[rgba(16,16,16,0.04)]">
        <X className="h-4 w-4" />
      </DialogClose>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DrawerContent({
  className,
  children,
  side = 'right',
}: {
  className?: string;
  children: ReactNode;
  side?: 'left' | 'right';
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-0 z-50 h-full w-[min(92vw,24rem)] bg-white shadow-[var(--ui-shadow-lg)]',
          side === 'right' ? 'right-0' : 'left-0',
          className
        )}
      >
        {children}
        <DialogClose className="absolute right-4 top-4 rounded-full p-2 text-[var(--ui-text-muted)] hover:bg-[rgba(16,16,16,0.04)]">
          <X className="h-4 w-4" />
        </DialogClose>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogTrigger,
  DrawerContent,
};

export const Sheet = Dialog;
export const SheetTrigger = DialogTrigger;
export const SheetContent = DialogContent;

export const Tabs = TabsPrimitive.Root;
export const TabsList = forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('inline-flex rounded-[var(--ui-radius-pill)] bg-[var(--ui-bg-subtle)] p-1', className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'rounded-[var(--ui-radius-pill)] px-4 py-2 text-sm font-semibold text-[var(--ui-text-secondary)] transition-all data-[state=active]:bg-white data-[state=active]:text-[var(--ui-text)] data-[state=active]:shadow-[var(--ui-shadow-sm)]',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;
export const TabsContent = TabsPrimitive.Content;

export const ScrollArea = ScrollAreaPrimitive.Root;
export const ScrollAreaViewport = ScrollAreaPrimitive.Viewport;
export const ScrollAreaScrollbar = ScrollAreaPrimitive.ScrollAreaScrollbar;

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuContent = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={8}
      className={cn('rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-white p-1 shadow-[var(--ui-shadow-lg)]', className)}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;
export const DropdownMenuItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn('flex cursor-pointer items-center rounded-[var(--ui-radius-sm)] px-3 py-2 text-sm font-medium text-[var(--ui-text)] outline-none hover:bg-[rgba(16,16,16,0.04)]', className)}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={6}
      className={cn('rounded-[var(--ui-radius-sm)] bg-[var(--ui-bg-strong)] px-3 py-2 text-xs font-medium text-white shadow-[var(--ui-shadow-lg)]', className)}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export function Select({
  options,
  placeholder,
  value,
  onValueChange,
}: {
  options: { value: string; label: string }[];
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger className="flex h-11 w-full items-center justify-between rounded-[var(--ui-radius-pill)] border border-[var(--ui-border)] bg-white px-4 text-sm font-medium text-[var(--ui-text)] shadow-[var(--ui-shadow-sm)] outline-none">
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 text-[var(--ui-text-muted)]" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="overflow-hidden rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-white shadow-[var(--ui-shadow-lg)]">
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="flex cursor-pointer items-center rounded-[var(--ui-radius-sm)] px-3 py-2 text-sm font-medium text-[var(--ui-text)] outline-none hover:bg-[rgba(16,16,16,0.04)]"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export const Command = CommandPrimitive;
export const CommandInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <Input ref={ref} className={cn('h-10 rounded-[var(--ui-radius-md)]', className)} {...props} />
));
CommandInput.displayName = 'CommandInput';
export function CommandList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-1', className)}>{children}</div>;
}
export function CommandItem({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[var(--ui-radius-sm)] px-3 py-2 text-sm font-medium hover:bg-[rgba(16,16,16,0.04)]', className)} {...props}>{children}</div>;
}

export interface DramsInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}
export const DramsInput = forwardRef<HTMLInputElement, DramsInputProps>(({ className, error, ...props }, ref) => (
  <Input
    ref={ref}
    className={cn(error && 'border-[var(--ui-error)] focus:border-[var(--ui-error)] focus:ring-[rgba(194,65,12,0.18)]', className)}
    {...props}
  />
));
DramsInput.displayName = 'DramsInput';

export type DramsButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gray';
export interface DramsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DramsButtonVariant;
  loading?: boolean;
  children?: ReactNode;
}
export function DramsButton({ variant = 'primary', className, loading, children, disabled, ...props }: DramsButtonProps) {
  const mappedVariant =
    variant === 'primary' ? 'default' :
    variant === 'gray' ? 'subtle' :
    variant;
  return (
    <Button className={className} variant={mappedVariant} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

export interface DramsDropdownOption {
  value: string;
  label: string;
}

export interface DramsDropdownProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: readonly DramsDropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

export function DramsDropdown({
  options,
  value,
  onChange,
  className,
  placeholder,
  ...props
}: DramsDropdownProps) {
  return (
    <select
      className={cn(
        'flex h-11 w-full rounded-[var(--ui-radius-pill)] border border-[var(--ui-border)] bg-white px-4 pr-10 text-sm font-medium text-[var(--ui-text)] shadow-[var(--ui-shadow-sm)] outline-none transition-all duration-150 focus:border-[var(--ui-primary)] focus:ring-2 focus:ring-[var(--ui-ring)]',
        className
      )}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      {...props}
    >
      {placeholder ? <option value="" disabled hidden>{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export interface DramsEmptyStateProps {
  title: string;
  message?: string;
  icon?: string;
  ctaLabel?: string;
  onCta?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export function DramsEmptyState({
  title,
  message,
  icon,
  ctaLabel,
  onCta,
  actionLabel,
  onAction,
}: DramsEmptyStateProps) {
  return (
    <EmptyState
      title={icon ? `${icon} ${title}` : title}
      description={message}
      action={(ctaLabel || actionLabel) ? <Button onClick={onCta ?? onAction}>{ctaLabel ?? actionLabel}</Button> : undefined}
    />
  );
}

export function DramsSpinner({
  className,
  size = 'md',
  message,
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | string;
  message?: string;
}) {
  const sizeClass =
    size === 'sm' ? 'h-4 w-4' :
    size === 'lg' ? 'h-7 w-7' :
    'h-5 w-5';

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-8 text-[var(--ui-text-secondary)]', className)}>
      <Loader2 className={cn(sizeClass, 'animate-spin text-[var(--ui-primary)]')} />
      {message ? <div className="text-sm font-medium">{message}</div> : null}
    </div>
  );
}

export interface DramsTabOption {
  value: string;
  label: string;
}

export function DramsTabGroup({
  options,
  value,
  onChange,
  className,
  style,
}: {
  options: DramsTabOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn('inline-flex flex-wrap gap-2 rounded-[var(--ui-radius-pill)] bg-[var(--ui-bg-subtle)] p-1', className)} style={style}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'rounded-[var(--ui-radius-pill)] px-4 py-2 text-sm font-semibold transition-all',
            value === option.value ? 'bg-white text-[var(--ui-text)] shadow-[var(--ui-shadow-sm)]' : 'text-[var(--ui-text-secondary)]'
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export interface DramsRadioOption {
  value: string;
  label: string;
  description?: string;
}

export function DramsRadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: DramsRadioOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-[var(--ui-radius-lg)] border bg-white p-4 transition-all',
              checked ? 'border-[rgba(234,106,42,0.35)] bg-[rgba(234,106,42,0.06)]' : 'border-[var(--ui-border)]'
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="mt-1 h-4 w-4 accent-[var(--ui-primary)]"
            />
            <div>
              <div className="text-sm font-semibold text-[var(--ui-text)]">{option.label}</div>
              {option.description ? <div className="text-sm text-[var(--ui-text-secondary)]">{option.description}</div> : null}
            </div>
          </label>
        );
      })}
    </div>
  );
}

export interface DramsAddButtonProps extends ButtonProps {
  loading?: boolean;
  children?: ReactNode;
}

export function DramsAddButton({
  children,
  loading,
  className,
  fullWidth = false,
  ...props
}: DramsAddButtonProps) {
  return (
    <Button className={className} fullWidth={fullWidth} size="lg" {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
      {children}
    </Button>
  );
}

export interface DramsProductCardProps {
  name: string;
  category?: string;
  price: string;
  image?: string;
  badge?: string;
  rating?: number;
  onAdd?: () => void;
  onClick?: () => void;
  isAdding?: boolean;
}

export function DramsProductCard({
  name,
  category,
  price,
  image,
  badge,
  onAdd,
  onClick,
  isAdding,
}: DramsProductCardProps) {
  return (
    <Card className="group cursor-pointer overflow-hidden rounded-[var(--ui-radius-lg)] p-0 transition-all duration-150 hover:-translate-y-1 hover:shadow-[var(--ui-shadow-md)]" onClick={onClick}>
      <div className="relative h-56 overflow-hidden bg-[linear-gradient(135deg,#efe6d6_0%,#ded8ca_100%)]">
        {badge ? <Badge tone="info" className="absolute left-4 top-4 z-10">{badge}</Badge> : null}
        {image ? (
          <img src={image} alt={name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--ui-primary-soft)] text-[var(--ui-primary)]">
              <Sparkles className="h-8 w-8" />
            </div>
          </div>
        )}
      </div>
      <div className="space-y-4 p-5">
        <div className="space-y-1">
          <h3 className="text-lg font-bold tracking-[-0.03em] text-[var(--ui-text)]">{name}</h3>
          {category ? <p className="text-sm text-[var(--ui-text-secondary)]">{category}</p> : null}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xl font-bold tracking-[-0.03em] text-[var(--ui-text)]">{price}</div>
          {onAdd ? (
            <Button
              type="button"
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                onAdd();
              }}
              disabled={isAdding}
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export interface DramsFlipCardProps {
  front: ReactNode;
  back: ReactNode;
  height?: number;
}

export function DramsFlipCard({ front, back, height = 240 }: DramsFlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={() => setFlipped((current) => !current)}
      style={{ perspective: '1200px' }}
    >
      <div
        className="relative w-full transition-transform duration-500"
        style={{ minHeight: height, transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        <div className="backface-hidden absolute inset-0 rounded-[var(--ui-radius-lg)]" style={{ backfaceVisibility: 'hidden' }}>
          {front}
        </div>
        <div className="backface-hidden absolute inset-0 rounded-[var(--ui-radius-lg)]" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          {back}
        </div>
        <div style={{ minHeight: height, visibility: 'hidden' }}>{front}</div>
      </div>
    </button>
  );
}

export function FlipCardFront({
  title,
  stats,
  hint,
}: {
  title: string;
  stats: { label: string; value: string | number }[];
  hint?: string;
}) {
  return (
    <Card className="flex h-full flex-col justify-between rounded-[var(--ui-radius-lg)] bg-[rgba(255,255,255,0.92)]">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">Overview</div>
        <h3 className="mt-2 text-xl font-bold tracking-[-0.03em] text-[var(--ui-text)]">{title}</h3>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-bg-subtle)] px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">{stat.label}</div>
            <div className="mt-2 text-base font-semibold text-[var(--ui-text)]">{stat.value}</div>
          </div>
        ))}
      </div>
      {hint ? <div className="mt-6 text-sm text-[var(--ui-text-secondary)]">{hint}</div> : null}
    </Card>
  );
}

export function FlipCardBack({
  specs,
}: {
  specs: { label: string; value: string | number }[];
}) {
  return (
    <Card className="h-full rounded-[var(--ui-radius-lg)] bg-[rgba(255,255,255,0.92)]">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">Specifications</div>
      <div className="mt-4 space-y-3">
        {specs.map((spec) => (
          <div key={spec.label} className="flex items-start justify-between gap-4 border-b border-[var(--ui-border)] pb-3 last:border-b-0 last:pb-0">
            <div className="text-sm font-semibold text-[var(--ui-text-secondary)]">{spec.label}</div>
            <div className="text-right text-sm font-semibold text-[var(--ui-text)]">{spec.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export interface RollingSearchProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
}

export function RollingSearch({
  onSearch,
  placeholder = 'Search products...',
}: RollingSearchProps) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus();
    }
  }, [expanded]);

  const submit = () => {
    const query = value.trim();
    if (!expanded) {
      setExpanded(true);
      return;
    }
    if (query) {
      onSearch?.(query);
      setValue('');
    }
    setExpanded(false);
  };

  return (
    <div className={cn('flex items-center gap-2 transition-all', expanded ? 'w-full max-w-xs' : 'w-auto')}>
      {expanded ? (
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
            if (event.key === 'Escape') {
              setExpanded(false);
              setValue('');
            }
          }}
          placeholder={placeholder}
          className="h-10"
        />
      ) : null}
      <Button variant={expanded ? 'default' : 'secondary'} size="icon" type="button" onClick={submit} aria-label="Search">
        {expanded ? <ArrowRight className="h-4 w-4" /> : <Search className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export interface AgentChatMessage {
  type: string;
  subtype?: string;
  content?: string;
  timestamp?: number;
  status?: string;
  data?: unknown;
  error?: string;
  errors?: string[];
}

export interface AgentChatProps {
  endpoint: string;
  placeholder?: string;
  title?: string;
  sessionId?: string;
  requestHeaders?: HeadersInit | (() => HeadersInit);
  buildRequestContext?: () => Record<string, unknown>;
  onMessage?: (message: AgentChatMessage) => void;
  height?: CSSProperties['height'];
  showEmptyState?: boolean;
  emptyStateMessage?: string;
}

const STORAGE_KEY = 'portfolio-agent-session-id';

function getSharedSessionId(endpoint: string) {
  if (typeof window === 'undefined') return '';
  const storageKey = `${STORAGE_KEY}:${endpoint}`;
  const stored = window.localStorage.getItem(storageKey);
  if (stored) return stored;
  const generated = `session-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(storageKey, generated);
  return generated;
}

function normalizeStreamMessage(message: AgentChatMessage): AgentChatMessage | null {
  if (message.type === 'assistant_delta') {
    return {
      type: 'assistant',
      subtype: 'stream',
      content: message.content,
      timestamp: message.timestamp,
    };
  }

  if (message.type === 'result' && message.content) {
    return {
      type: 'assistant',
      subtype: 'final',
      content: message.content,
      timestamp: message.timestamp,
    };
  }

  if (message.type === 'error') {
    return {
      type: 'result',
      subtype: 'error_during_execution',
      error: message.error,
      timestamp: message.timestamp,
    };
  }

  if (message.type === 'init' || message.type === 'usage' || message.type === 'session_state' || message.type === 'client_patch') {
    return null;
  }

  return message;
}

function appendAgentMessage(current: AgentChatMessage[], next: AgentChatMessage) {
  const normalized = normalizeStreamMessage(next);
  if (!normalized) {
    return current;
  }

  const last = current[current.length - 1];

  if (normalized.type === 'assistant' && normalized.subtype === 'stream') {
    if (last?.type === 'assistant' && (last.subtype === 'stream' || last.subtype === 'final')) {
      return [
        ...current.slice(0, -1),
        {
          ...last,
          subtype: 'stream',
          content: `${last.content ?? ''}${normalized.content ?? ''}`,
          timestamp: normalized.timestamp ?? last.timestamp,
        },
      ];
    }
  }

  if (normalized.type === 'assistant' && normalized.subtype === 'final') {
    if (last?.type === 'assistant' && (last.subtype === 'stream' || last.subtype === 'final')) {
      if ((last.content ?? '') === (normalized.content ?? '')) {
        return [
          ...current.slice(0, -1),
          {
            ...last,
            subtype: 'final',
            timestamp: normalized.timestamp ?? last.timestamp,
          },
        ];
      }

      return [
        ...current.slice(0, -1),
        {
          ...last,
          subtype: 'final',
          content: normalized.content ?? last.content,
          timestamp: normalized.timestamp ?? last.timestamp,
        },
      ];
    }
  }

  return [...current, normalized];
}

async function processStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onMessage: (message: AgentChatMessage) => void,
  onDone: () => void,
  onError: (error: AgentChatMessage) => void
) {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      onDone();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.replace(/^data:\s*/, '').trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as AgentChatMessage;
        onMessage(parsed);
      } catch (error) {
        onError({
          type: 'result',
          subtype: 'error_during_execution',
          errors: [error instanceof Error ? error.message : 'Failed to parse stream'],
        });
      }
    }
  }
}

export function AgentChat({
  endpoint,
  placeholder = 'Type your message...',
  title = 'Agent Chat',
  sessionId: initialSessionId = '',
  requestHeaders,
  buildRequestContext,
  onMessage,
  height,
  showEmptyState = true,
  emptyStateMessage = 'Start a conversation with the AI agent',
}: AgentChatProps) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(initialSessionId || getSharedSessionId(endpoint));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    const userMessage: AgentChatMessage = {
      type: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const resolvedHeaders = typeof requestHeaders === 'function' ? requestHeaders() : requestHeaders;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(resolvedHeaders ?? {}),
        },
        body: JSON.stringify({
          prompt,
          sessionId,
          context: buildRequestContext ? buildRequestContext() : {},
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      await processStream(
        reader,
        (message) => {
          onMessage?.(message);
          setMessages((current) => appendAgentMessage(current, message));
        },
        () => setIsLoading(false),
        (errorMessage) => {
          setMessages((current) => [...current, errorMessage]);
          setIsLoading(false);
        }
      );
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          type: 'result',
          subtype: 'error_during_execution',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      ]);
      setIsLoading(false);
    }
  }, [buildRequestContext, endpoint, input, isLoading, onMessage, requestHeaders, sessionId]);

  return (
    <ChatLayout
      title={title}
      height={height ?? '640px'}
      actions={<Badge tone="info">Session: {sessionId.slice(0, 8)}</Badge>}
      footer={
        <div className="space-y-2">
          <div className="flex items-end gap-3">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={placeholder}
              className="min-h-[80px]"
            />
            <Button type="button" size="icon" className="h-12 w-12 shrink-0" onClick={() => void sendMessage()} disabled={!input.trim() || isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-[var(--ui-text-muted)]">Responses stream from the local agent service. Verify important actions before checkout or fulfillment.</p>
        </div>
      }
    >
      {messages.length === 0 && showEmptyState ? (
        <AsyncState kind="empty" title={emptyStateMessage} description="Use the assistant for product discovery, summaries, and guided actions." />
      ) : (
        <div className="space-y-4">
          {messages.map((message, index) => {
            const content = message.content || message.errors?.join(', ') || message.error || message.status || 'Received update';
            const isUser = message.type === 'user';
            return (
              <div key={`${message.timestamp ?? 'message'}-${index}`} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-[var(--ui-radius-lg)] px-4 py-3 text-sm font-medium shadow-[var(--ui-shadow-sm)]',
                    isUser
                      ? 'bg-[var(--ui-primary)] text-white'
                      : message.subtype?.includes('error')
                        ? 'bg-[rgba(194,65,12,0.12)] text-[var(--ui-error)]'
                        : 'bg-white text-[var(--ui-text)]'
                  )}
                >
                  {content}
                </div>
              </div>
            );
          })}
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--ui-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>
      )}
    </ChatLayout>
  );
}
