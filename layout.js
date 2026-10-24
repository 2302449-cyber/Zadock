// Builds the same header and footer on every page
(function () {
    const here =
        location.pathname.split("/").pop().replace(".html", "").toLowerCase() || "index";

    const pages = [
        ["Home", "index"],
        ["Shop", "shop"],
        ["About Us", "about"],
        ["Contact", "contact"],
        ["Track Order", "track"]
    ];

    const links = pages.map(([label, key]) =>
        `<a href="${key}.html"${here === key ? ' class="active" aria-current="page"' : ""}>${label}</a>`
    ).join("");

    const header = document.getElementById("siteHeader");

    if (header) {
        header.innerHTML = `
            <a class="logo" href="index.html">${SITE.name}</a>
            <nav>
                ${links}
                <button type="button" id="cartToggle">🛒 Cart (<span id="cartCount">0</span>)</button>
            </nav>
        `;
    }

    const socials = [
        ["Instagram", SITE.instagram],
        ["Facebook", SITE.facebook],
        ["TikTok", SITE.tiktok]
    ]
        .filter(([, url]) => url)
        .map(([name, url]) => `<a href="${url}" target="_blank" rel="noopener">${name}</a>`)
        .join(" · ");

    const footer = document.getElementById("siteFooter");

    if (footer) {
        footer.innerHTML = `
            <div class="footer-grid">
                <div>
                    <h3>${SITE.name}</h3>
                    <p>Wear your heritage with pride.</p>
                </div>

                <div>
                    <h3>Quick Links</h3>
                    <p>${links}</p>
                </div>

                <div>
                    <h3>Contact</h3>
                    <p>📍 ${SITE.location}</p>
                    <p>📞 <a href="tel:${SITE.phone.replace(/[^+\d]/g, "")}">${SITE.phone}</a></p>
                    <p>✉️ <a href="mailto:${SITE.email}">${SITE.email}</a></p>
                    ${socials ? `<p>${socials}</p>` : ""}
                </div>
            </div>

            <div class="footer-bottom">
                &copy; ${new Date().getFullYear()} ${SITE.name}. All rights reserved.
            </div>
        `;
    }
})();