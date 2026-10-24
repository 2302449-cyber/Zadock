// "New Arrivals" on the home page: the 4 newest products
(async function showArrivals() {
    const grid = document.getElementById("arrivalsGrid");
    if (!grid) return;

    await productsReady;
    grid.replaceChildren();

    if (productsLoadFailed) {
        grid.textContent = "We could not load the collection. Please refresh.";
        return;
    }

    const newest = products.slice(0, 4);

    if (newest.length === 0) {
        grid.textContent = "New designs are coming soon.";
        return;
    }

    newest.forEach(product => {
        const photo = product.colours
            .flatMap(colour => colour.images)[0] || "";

        const card = document.createElement("a");
        card.className = "arrival-card";
        card.href = `shop.html#p-${product.id}`;

        const image = document.createElement("img");
        image.src = photo;
        image.alt = product.name;
        image.loading = "lazy";

        const name = document.createElement("h3");
        name.textContent = product.name;

        const price = document.createElement("p");
        price.textContent = money(Number(product.price));

        card.append(image, name, price);
        grid.appendChild(card);
    });
})();