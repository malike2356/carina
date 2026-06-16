export type ProductMode = 'hosted' | 'private' | 'ops';

export type RouteOwnership = 'hosted' | 'private' | 'shared' | 'any';

export type ShellNavLink = {
  id: string;
  href: string;
  label: string;
  description?: string;
};

export type ProductSurface = {
  mode: ProductMode;
  hostname: string;
  branding: {
    productName: string;
    workspaceName: string;
    titleSuffix: string;
    loginPath: string;
    defaultLanding: string;
  };
  shell: {
    primaryNav: ShellNavLink[];
    accountNav: ShellNavLink[];
    instanceNav: ShellNavLink[];
  };
};
