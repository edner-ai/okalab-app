import * as React from "react";
import { Toaster as Sonner } from "sonner";

function getThemeFromHtmlClass() {
  if (typeof document === "undefined") return "system";
  const el = document.documentElement;
  if (el.classList.contains("dark")) return "dark";
  if (el.classList.contains("light")) return "light";
  return "system";
}

const Toaster = (props) => {
  const [theme, setTheme] = React.useState(getThemeFromHtmlClass);

  React.useEffect(() => {
    const el = document.documentElement;

    // Observa cambios en la clase (ej: cuando alternas dark/light)
    const obs = new MutationObserver(() => setTheme(getThemeFromHtmlClass()));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });

    return () => obs.disconnect();
  }, []);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
