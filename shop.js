const productContainer = document.getElementById("productContainer");
const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");
const resultInfo = document.getElementById("resultInfo");

let searchText = "";

// cart.js calls this after an order so the stock numbers refresh
function refreshShopView() {
    displayProducts();
}

/* ================= SEARCH ================= */

let searchTimer = null;

searchInput.addEventListener("input", () => {
    clearSearch.hidden = searchInput.value === "";

    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        searchText = searchInput.value;
        displayProducts();
    }, 200);
});

clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    searchText = "";
    clearSearch.hidden = true;
    displayProducts();
    searchInput.focus();
});

// Matches the product name, description and colour names
function visibleProducts() {
    const words = searchText.trim().toLowerCase().split(/\s+/).filter(Boolean);

    if (words.length === 0) return products;

    return products.filter(product => {
        const haystack = [
            product.name,
            product.description,
            ...(product.colours || []).map(colour => colour.name)
        ].join(" ").toLowerCase();

        return words.every(word => haystack.includes(word));
    });
}

/* ================= PRODUCT CARDS ================= */

function displayProducts() {
    productContainer.replaceChildren();

    const list = visibleProducts();

    resultInfo.textContent = products.length === 0 || !searchText.trim()
        ? ""
        : `${list.length} item${list.length === 1 ? "" : "s"} matching "${searchText.trim()}"`;

    if (list.length === 0) {
        productContainer.textContent = products.length === 0
            ? "No clothes available yet. Please check back soon."
            : "No items match. Try a different word.";

        renderCart();
        return;
    }

    list.forEach(product => {
        // Always read the newest copy of this product
        const current = () => findProduct(product.id) || product;

        const card = document.createElement("article");
        card.className = "product-card";
        card.id = `p-${product.id}`;

        const image = document.createElement("img");
        image.alt = product.name;
        image.loading = "lazy";

        // Row of small clickable photos under the main picture
        const thumbs = document.createElement("div");
        thumbs.className = "thumbs";

        function showThumbs() {
            const colour = findColour(current(), colourSelect.value);
            const images = colour?.images || [];

            thumbs.replaceChildren();
            if (images.length < 2) return;

            images.forEach((src, i) => {
                const thumb = document.createElement("img");
                thumb.src = src;
                thumb.alt = `${product.name} photo ${i + 1}`;
                thumb.className = i === 0 ? "thumb active" : "thumb";

                thumb.addEventListener("click", () => {
                    image.src = src;
                    thumbs.querySelectorAll(".thumb")
                        .forEach(t => t.classList.remove("active"));
                    thumb.classList.add("active");
                });

                thumbs.appendChild(thumb);
            });
        }

        const name = document.createElement("h3");
        name.textContent = product.name;

        const description = document.createElement("p");
        description.textContent = product.description;

        const price = document.createElement("p");
        price.textContent = `Price: ${money(Number(product.price))}`;

        // Colour selector
        const colourLabel = document.createElement("label");
        colourLabel.textContent = "Choose colour: ";

        const colourSelect = document.createElement("select");

        (product.colours || []).forEach(colour => {
            const option = document.createElement("option");
            option.value = colour.name;
            option.textContent = colour.name;
            colourSelect.appendChild(option);
        });

        colourLabel.appendChild(colourSelect);

        // Size selector
        const sizeLabel = document.createElement("label");
        sizeLabel.textContent = "Choose size: ";

        const sizeSelect = document.createElement("select");

        sizesFor(product).forEach(size => {
            const option = document.createElement("option");
            option.value = size;
            option.textContent = sizeText(size);
            sizeSelect.appendChild(option);
        });

        // One-size products have nothing to choose
        if (isOneSize(product)) sizeSelect.disabled = true;

        sizeLabel.appendChild(sizeSelect);

        const stockText = document.createElement("p");

        // Quantity input
        const quantityLabel = document.createElement("label");
        quantityLabel.textContent = "Quantity: ";

        const quantityInput = document.createElement("input");
        quantityInput.type = "number";
        quantityInput.min = "1";
        quantityInput.step = "1";
        quantityInput.value = "1";

        quantityLabel.appendChild(quantityInput);

        const total = document.createElement("p");

        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.textContent = "Add to Cart";

        function updateOrderDetails() {
            const latest = current();
            const colour = findColour(latest, colourSelect.value);
            const stock = Number(colour?.stock?.[sizeSelect.value] ?? 0);

            stockText.textContent = `Available stock: ${stock}`;
            quantityInput.max = String(stock);

            if (stock < 1) {
                quantityInput.value = "0";
                quantityInput.disabled = true;
                addButton.disabled = true;

                const held = getReservedQty(
                    product.id, colourSelect.value, sizeSelect.value
                );

                total.textContent = held > 0
                    ? "Reserved by another customer. It returns to stock if unpaid after 2 hours. Message us on WhatsApp to be notified."
                    : "This option is out of stock.";
                return;
            }

            quantityInput.disabled = false;
            addButton.disabled = false;

            let quantity = Number(quantityInput.value);

            if (!Number.isInteger(quantity) || quantity < 1 || quantity > stock) {
                quantity = 1;
                quantityInput.value = "1";
            }

            total.textContent =
                `Total: ${money(quantity * Number(latest.price))}`;
        }

        colourSelect.addEventListener("change", () => {
            const colour = findColour(current(), colourSelect.value);
            image.src = colour?.images?.[0] || "";
            image.alt = `${product.name} - ${colourSelect.value}`;
            showThumbs();
            updateOrderDetails();
        });

        sizeSelect.addEventListener("change", updateOrderDetails);
        quantityInput.addEventListener("input", updateOrderDetails);

        addButton.addEventListener("click", async () => {
            const quantity = Number(quantityInput.value);
            const colourName = colourSelect.value;
            const size = sizeSelect.value;

            addButton.disabled = true;

            // Check the newest stock before adding to the cart
            try {
                await loadProducts();
            } catch {
                alert("Could not check stock. Please check your internet connection.");
                updateOrderDetails();
                return;
            }

            const latestProduct = findProduct(product.id);
            const latestColour = findColour(latestProduct, colourName);

            if (!latestProduct || !latestColour) {
                alert("This product is no longer available.");
                displayProducts();
                return;
            }

            const stock = Number(latestColour.stock?.[size] ?? 0);

            if (!Number.isInteger(quantity) || quantity < 1 || quantity > stock) {
                alert("Please select a valid quantity within available stock.");
                updateOrderDetails();
                return;
            }

            const existingItem = cart.find(item =>
                item.productId === product.id &&
                item.colourName === colourName &&
                item.size === size
            );

            const newQuantity = (existingItem?.quantity || 0) + quantity;

            if (newQuantity > stock) {
                alert(
                    `You can add only ${Math.max(
                        0, stock - (existingItem?.quantity || 0)
                    )} more of this option.`
                );
                updateOrderDetails();
                return;
            }

            const previousCart = JSON.stringify(cart);

            if (existingItem) {
                existingItem.quantity = newQuantity;
                existingItem.price = Number(latestProduct.price);
            } else {
                cart.push({
                    productId: product.id,
                    colourName,
                    size,
                    quantity,
                    price: Number(latestProduct.price)
                });
            }

            if (!saveCart()) {
                cart = JSON.parse(previousCart);
                updateOrderDetails();
                return;
            }

            renderCart();
            updateOrderDetails();
            openCart();
        });

        const initialColour = product.colours?.[0];
        image.src = initialColour?.images?.[0] || "";
        showThumbs();

        card.append(
            image,
            thumbs,
            name,
            description,
            price,
            colourLabel,
            sizeLabel,
            stockText,
            quantityLabel,
            total,
            addButton
        );

        productContainer.appendChild(card);
        updateOrderDetails();
    });

    renderCart();
}

// When a customer arrives from "New Arrivals", scroll to that product
function scrollToLinkedProduct() {
    const id = location.hash.slice(1);
    if (!id.startsWith("p-")) return;

    const card = document.getElementById(id);
    if (!card) return;

    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("highlight");
}

(async function start() {
    await productsReady;

    if (productsLoadFailed) {
        productContainer.textContent =
            "We could not load the collection. Please check your internet connection and refresh.";
        return;
    }

    // Keep anything the browser restored into the search box
    searchText = searchInput.value;
    clearSearch.hidden = searchInput.value === "";

    displayProducts();
    scrollToLinkedProduct();
})();