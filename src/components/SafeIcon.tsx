import * as React from "react";

/**
 * SafeIcon — Wraps a Heroicon (or any SVG component) and renders a
 * minimal inline SVG fallback if the icon component fails to load
 * or throws at render time. This keeps pages from breaking the build
 * when an icon import path changes or @heroicons/react is missing.
 */
type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface SafeIconProps extends React.SVGProps<SVGSVGElement> {
  icon?: IconComponent | null | undefined;
  fallbackLabel?: string;
}

class IconBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.warn("[SafeIcon] icon failed to render, using fallback", error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const Fallback = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden="true"
    {...props}
  >
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <path d="M8 12h8M12 8v8" strokeLinecap="round" />
  </svg>
);

export function SafeIcon({ icon: Icon, fallbackLabel, ...rest }: SafeIconProps) {
  if (!Icon) return <Fallback {...rest} aria-label={fallbackLabel} />;
  return (
    <IconBoundary fallback={<Fallback {...rest} aria-label={fallbackLabel} />}>
      <Icon {...rest} />
    </IconBoundary>
  );
}

export default SafeIcon;
