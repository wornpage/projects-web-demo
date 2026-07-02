// __PROJECT_NAME__ — client-side SPA
// Hash router, state store, theme manager, render dispatch.

/* ================================================================
   Initialization
   ================================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  routeFromHash();
  window.addEventListener("hashchange", routeFromHash);
  bindShellControls();
});

/* ================================================================
   State
   ================================================================ */

const state = {
  route: "home",
  theme: "light"
};

/* ================================================================
   Helpers
   ================================================================ */

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return String(value ?? "").replace(/"/g, "&quot;");
}

/* ================================================================
   Routing
   ================================================================ */

const ROUTES = {
  home:  { title: "Home",  render: renderHome },
  about: { title: "About", render: renderAbout }
};

function routeFromHash() {
  const raw = window.location.hash.replace(/^#\/?/, "") || "home";
  const [route, ...rest] = raw.split("/");
  if (!ROUTES[route]) {
    window.location.hash = "#/home";
    return;
  }
  state.route = route;
  state.routeParam = rest.join("/") || "";
  document.title = `${ROUTES[route].title} — __PROJECT_NAME__`;
  markCurrentNav(route);
  ROUTES[route].render();
}

function go(route, param = "") {
  window.location.hash = param ? `#/${route}/${param}` : `#/${route}`;
}

function markCurrentNav(route) {
  document.querySelectorAll(".app-nav a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const linkRoute = href.replace("#/", "").split("/")[0];
    link.setAttribute("aria-current", linkRoute === route ? "page" : "false");
  });
}

/* ================================================================
   Theme
   ================================================================ */

function initTheme() {
  const stored = localStorage.getItem("__PROJECT_NS___theme");
  applyTheme(stored === "dark" ? "dark" : "light");
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("__PROJECT_NS___theme", theme);
  const btn = el("theme-toggle");
  if (btn) {
    btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }
}

/* ================================================================
   Shell controls
   ================================================================ */

function bindShellControls() {
  const toggle = el("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      applyTheme(state.theme === "dark" ? "light" : "dark");
    });
  }
}

/* ================================================================
   Route renderers — stub these out with your own pages
   ================================================================ */

function renderHome() {
  el("screen-content").innerHTML = `
    <section class="page-section">
      <h1>Welcome to __PROJECT_NAME__</h1>
      <p>Replace this with your home page content.</p>
      <a class="btn-primary" href="#/about">Learn more</a>
    </section>`;
}

function renderAbout() {
  el("screen-content").innerHTML = `
    <section class="page-section">
      <h1>About</h1>
      <p>Your about page goes here.</p>
    </section>`;
}
