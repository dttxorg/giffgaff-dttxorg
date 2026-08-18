(() => {
  const root = document.documentElement;
  const updateProgress = () => {
    const max = Math.max(1, root.scrollHeight - window.innerHeight);
    root.style.setProperty("--scroll-progress", Math.min(100, (window.scrollY / max) * 100).toFixed(2));
  };

  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress, { passive: true });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealNodes = [...document.querySelectorAll(".reveal")];

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealNodes.forEach((node) => node.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -5%" });
    revealNodes.forEach((node) => observer.observe(node));
  }

  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });

  const normalizeSearch = (value) => value
    .toLocaleLowerCase("zh-CN")
    .replace(/\s+/g, " ")
    .trim();

  document.querySelectorAll("[data-faq-root]").forEach((rootNode) => {
    const input = rootNode.querySelector("[data-faq-search]");
    const status = rootNode.querySelector("[data-faq-status]");
    const empty = rootNode.querySelector("[data-faq-empty]");
    const groups = [...rootNode.querySelectorAll("[data-faq-group]")];
    const items = [...rootNode.querySelectorAll("[data-faq-item]")];

    if (!input) return;

    const updateFaq = () => {
      const query = normalizeSearch(input.value);
      let visibleCount = 0;

      groups.forEach((group) => {
        let groupCount = 0;
        const groupSearchText = normalizeSearch(
          `${group.querySelector("h2")?.textContent || ""} ${group.dataset.search || ""}`,
        );
        const groupMatches = Boolean(query && groupSearchText.includes(query));
        group.querySelectorAll("[data-faq-item]").forEach((item) => {
          const matches = !query || groupMatches || normalizeSearch(
            `${item.textContent} ${item.dataset.search || ""}`,
          ).includes(query);
          item.hidden = !matches;
          if (matches) {
            groupCount += 1;
            visibleCount += 1;
          }
        });
        group.hidden = groupCount === 0;
      });

      if (status) {
        status.textContent = query
          ? `找到 ${visibleCount} 个相关问题`
          : `显示全部 ${items.length} 个问题`;
      }
      if (empty) empty.hidden = visibleCount !== 0;
    };

    input.addEventListener("input", updateFaq);
    updateFaq();

    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.focus();
      }
      if (event.key === "Escape" && document.activeElement === input) {
        input.value = "";
        updateFaq();
        input.blur();
      }
    });
  });

  document.querySelectorAll("[data-check-list] button").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(next));
    });
  });
})();
