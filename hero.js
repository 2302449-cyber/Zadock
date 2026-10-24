// Homepage slideshow built from the newest product photos
(async function initHero() {
    const home = document.getElementById("home");
    const slidesBox = document.getElementById("heroSlides");

    if (!home || !slidesBox) return;

    // 1. Get one photo from each of the newest products
    const photos = [];

    try {
        const { data, error } = await sb
            .from("products")
            .select("name, product_colours(images, position)")
            .order("created_at", { ascending: false })
            .limit(8);

        if (error) throw error;

        for (const product of data) {
            const colour = (product.product_colours || [])
                .sort((a, b) => a.position - b.position)
                .find(c => c.images && c.images.length > 0);

            if (colour) photos.push({ src: colour.images[0], name: product.name });
        }
    } catch (error) {
        console.error("Slideshow could not load:", error);
    }

    // No photos yet: keep the plain burgundy banner
    if (photos.length === 0) return;

    // 2. Build the slides
    const slides = photos.map((photo, index) => {
        const img = document.createElement("img");
        img.className = "hero-slide" + (index === 0 ? " active" : "");
        img.src = photo.src;
        img.alt = photo.name;
        img.loading = index === 0 ? "eager" : "lazy";
        slidesBox.appendChild(img);
        return img;
    });

    // One photo only: no controls needed
    if (slides.length < 2) return;

    // 3. Arrows and dots
    const prevButton = document.createElement("button");
    prevButton.type = "button";
    prevButton.className = "hero-arrow prev";
    prevButton.setAttribute("aria-label", "Previous photo");
    prevButton.textContent = "‹";

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "hero-arrow next";
    nextButton.setAttribute("aria-label", "Next photo");
    nextButton.textContent = "›";

    const dotsBox = document.createElement("div");
    dotsBox.className = "hero-dots";

    const dots = slides.map((_, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = index === 0 ? "active" : "";
        dot.setAttribute("aria-label", `Show photo ${index + 1}`);
        dot.addEventListener("click", () => { show(index); restart(); });
        dotsBox.appendChild(dot);
        return dot;
    });

    home.append(prevButton, nextButton, dotsBox);

    // 4. Sliding logic
    let current = 0;
    let timer = null;

    function show(index) {
        current = (index + slides.length) % slides.length;

        slides.forEach((slide, i) => slide.classList.toggle("active", i === current));
        dots.forEach((dot, i) => dot.classList.toggle("active", i === current));
    }

    function start() {
        const reduceMotion =
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (reduceMotion || timer) return;
        timer = setInterval(() => show(current + 1), 5500);
    }

    function stop() {
        clearInterval(timer);
        timer = null;
    }

    function restart() {
        stop();
        start();
    }

    prevButton.addEventListener("click", () => { show(current - 1); restart(); });
    nextButton.addEventListener("click", () => { show(current + 1); restart(); });

    // Pause while the customer hovers, and while the tab is hidden
    home.addEventListener("mouseenter", stop);
    home.addEventListener("mouseleave", start);

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stop(); else start();
    });

    // Swipe on phones
    let touchStartX = 0;

    home.addEventListener("touchstart", event => {
        touchStartX = event.changedTouches[0].clientX;
        stop();
    }, { passive: true });

    home.addEventListener("touchend", event => {
        const distance = event.changedTouches[0].clientX - touchStartX;

        if (Math.abs(distance) > 50) show(current + (distance < 0 ? 1 : -1));
        start();
    }, { passive: true });

    start();
})();